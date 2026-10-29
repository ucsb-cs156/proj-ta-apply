package edu.ucsb.cs.taapply.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.AuditTrail;
import edu.ucsb.cs.taapply.entity.PriorCoursework;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.AuditTrailRepository;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.function.Function;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Writes the audit trail for an admin's edit of a student's application: one row per field whose
 * value changed, with the value before and after as strings.
 *
 * <p>The caller takes a {@link #snapshot} before applying the edit and calls {@link #record} with
 * it afterwards. A snapshot is the application's answers as strings, keyed by field name: the plain
 * fields one entry each, and each row of the join tables (a prior course, a topic rating, an
 * interest level, a course interest) as the JSON of that row. Rows are compared as a set, so a row
 * that disappeared is recorded with a null new value, and a row that appeared with a null old
 * value; a prior course that was edited therefore shows as one row removed and one added, since the
 * form rebuilds those rows on every save and they carry no identity across it.
 */
@Service
public class ApplicationAuditService {

  @Autowired private AuditTrailRepository auditTrailRepository;
  @Autowired private ObjectMapper objectMapper;

  /** The fields an admin may change, with how to read each as a string; null reads as null. */
  private static final Map<String, Function<Application, Object>> FIELDS = new LinkedHashMap<>();

  static {
    FIELDS.put("firstName", Application::getFirstName);
    FIELDS.put("middleName", Application::getMiddleName);
    FIELDS.put("lastName", Application::getLastName);
    FIELDS.put("major", Application::getMajor);
    FIELDS.put("gpaMajor", Application::getGpaMajor);
    FIELDS.put("gpaOverall", Application::getGpaOverall);
    FIELDS.put("yearInProgram", Application::getYearInProgram);
    FIELDS.put("graduationDate", Application::getGraduationDate);
    FIELDS.put("prevExperience", Application::getPrevExperience);
    FIELDS.put("comments", Application::getComments);
    FIELDS.put("firstChoiceCourse", Application::getFirstChoiceCourse);
    FIELDS.put("secondChoiceCourse", Application::getSecondChoiceCourse);
    FIELDS.put("availableForLecturesFirstChoice", Application::isAvailableForLecturesFirstChoice);
    FIELDS.put("availableForLecturesSecondChoice", Application::isAvailableForLecturesSecondChoice);
    FIELDS.put(
        "availableForDiscussionFirstChoice", Application::isAvailableForDiscussionFirstChoice);
    FIELDS.put(
        "availableForDiscussionSecondChoice", Application::isAvailableForDiscussionSecondChoice);
    FIELDS.put("availabilityCommentsFirstChoice", Application::getAvailabilityCommentsFirstChoice);
    FIELDS.put(
        "availabilityCommentsSecondChoice", Application::getAvailabilityCommentsSecondChoice);
    FIELDS.put("residencyStatus", Application::getResidencyStatus);
    FIELDS.put("languageExam", Application::getLanguageExam);
    FIELDS.put("languageExamDatePassed", Application::getLanguageExamDatePassed);
    FIELDS.put("classLevel", Application::getClassLevel);
    FIELDS.put("videoLink", Application::getVideoLink);
    FIELDS.put("previousServiceAsUla", Application::getPreviousServiceAsUla);
    FIELDS.put("permNumber", Application::getPermNumber);
    FIELDS.put("bsMsStudent", Application::getBsMsStudent);
    FIELDS.put("studentStatusNextQuarter", Application::getStudentStatusNextQuarter);
    FIELDS.put("wantsTaEligibility", Application::getWantsTaEligibility);
    FIELDS.put("otherCampusJob", Application::getOtherCampusJob);
    FIELDS.put("priorUcsbEmployment", Application::getPriorUcsbEmployment);
    FIELDS.put("employeeId", Application::getEmployeeId);
    FIELDS.put("i9Appointment", Application::getI9Appointment);
    FIELDS.put("trainingCommitment", Application::getTrainingCommitment);
    FIELDS.put("trainingCommitmentExplanation", Application::getTrainingCommitmentExplanation);
    FIELDS.put("changingMajor", Application::getChangingMajor);
    FIELDS.put("noticeVersionId", Application::getNoticeVersionId);
  }

  /** The answers as strings: a plain field's value, or a join table's rows as JSON. */
  public record Snapshot(Map<String, String> fields, Map<String, Set<String>> rows) {}

  public Snapshot snapshot(Application application) {
    Map<String, String> fields = new LinkedHashMap<>();
    FIELDS.forEach((name, getter) -> fields.put(name, text(getter.apply(application))));

    Map<String, Set<String>> rows = new LinkedHashMap<>();
    rows.put("priorCoursework", courseRows(application.getPriorCoursework()));
    rows.put(
        "topicProficiencies", mapRows(application.getTopicProficiencies(), "topic", "proficiency"));
    rows.put("interests", mapRows(application.getInterests(), "interest", "level"));
    rows.put("courseInterests", mapRows(application.getCourseInterests(), "courseId", "interest"));
    return new Snapshot(fields, rows);
  }

  /**
   * Records every difference between the snapshot taken before the edit and the application as it
   * is now, and returns the rows written (empty when nothing changed).
   */
  public List<AuditTrail> record(Snapshot before, Application after, RecruitmentType type) {
    Snapshot now = snapshot(after);
    Long taId = type == RecruitmentType.TA ? after.getId() : null;
    Long ulaId = type == RecruitmentType.ULA ? after.getId() : null;
    List<AuditTrail> changes = new ArrayList<>();

    before
        .fields()
        .forEach(
            (name, old) -> {
              String current = now.fields().get(name);
              if (!Objects.equals(old, current)) {
                changes.add(row(taId, ulaId, name, old, current));
              }
            });

    before
        .rows()
        .forEach(
            (name, oldRows) -> {
              Set<String> newRows = now.rows().get(name);
              for (String gone : oldRows) {
                if (!newRows.contains(gone)) {
                  changes.add(row(taId, ulaId, name, gone, null));
                }
              }
              for (String added : newRows) {
                if (!oldRows.contains(added)) {
                  changes.add(row(taId, ulaId, name, null, added));
                }
              }
            });

    if (!changes.isEmpty()) {
      auditTrailRepository.saveAll(changes);
    }
    return changes;
  }

  private static AuditTrail row(
      Long taId, Long ulaId, String field, String oldValue, String newValue) {
    return AuditTrail.builder()
        .taApplicationId(taId)
        .ulaApplicationId(ulaId)
        .fieldName(field)
        .oldValue(oldValue)
        .newValue(newValue)
        .build();
  }

  /** A blank answer and no answer are the same thing: the form sends "" for a field left empty. */
  private static String text(Object value) {
    if (value == null) {
      return null;
    }
    String text = String.valueOf(value);
    return text.isBlank() ? null : text;
  }

  /**
   * Each prior course as JSON, without its id: the rows are rebuilt on every save, so ids differ.
   */
  private Set<String> courseRows(List<PriorCoursework> courses) {
    Set<String> rows = new LinkedHashSet<>();
    for (PriorCoursework course : courses == null ? List.<PriorCoursework>of() : courses) {
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("ucsbCourse", course.isUcsbCourse());
      row.put("otherSchool", course.getOtherSchool());
      row.put("courseNumber", course.getCourseNumber());
      row.put("courseTitle", course.getCourseTitle());
      row.put("term", course.getTerm());
      row.put("grade", course.getGrade());
      rows.add(json(row));
    }
    return rows;
  }

  /** Each map entry as a JSON row with the given key and value names, in key order. */
  private Set<String> mapRows(Map<String, ?> values, String keyName, String valueName) {
    Set<String> rows = new LinkedHashSet<>();
    Map<String, ?> sorted = values == null ? Map.of() : new TreeMap<>(values);
    sorted.forEach(
        (key, value) -> {
          Map<String, Object> row = new LinkedHashMap<>();
          row.put(keyName, key);
          row.put(valueName, value);
          rows.add(json(row));
        });
    return rows;
  }

  /** valueToTree rather than writeValueAsString: a map of simple values has no checked failure. */
  private String json(Map<String, Object> row) {
    return objectMapper.valueToTree(row).toString();
  }
}
