package edu.ucsb.cs.taapply.services;

import com.opencsv.CSVWriter;
import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.PriorCoursework;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import java.io.StringWriter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/**
 * The applications to one recruitment as a CSV document, one row per application, for an admin to
 * open in a spreadsheet.
 *
 * <p>Every answer is a column. The one-to-many answers are folded into a single column each: the
 * prior courses as the course fields separated by commas and the courses by semicolons; the topic
 * ratings, interests and course interests as {@code name:value} pairs separated by commas (e.g.
 * {@code C++:5,Java:4}), in name order. The columns differ by form type: a TA file has the
 * residency, language exam and class level columns, a ULA file the video link, previous service and
 * interests columns.
 */
@Service
public class ApplicationCsvService {

  /** One column: its header and how to read it off an application. */
  private record Column(String header, Function<Application, Object> value) {}

  private static final List<Column> BEFORE_TYPE =
      List.of(
          new Column("id", Application::getId),
          new Column("submittedAt", Application::getSubmittedAt),
          new Column("email", Application::getEmail),
          new Column("status", Application::getStatus),
          new Column("testApplication", Application::isTestApplication),
          new Column("firstName", Application::getFirstName),
          new Column("middleName", Application::getMiddleName),
          new Column("lastName", Application::getLastName),
          new Column("major", Application::getMajor),
          new Column("gpaMajor", Application::getGpaMajor),
          new Column("gpaOverall", Application::getGpaOverall),
          new Column("yearInProgram", Application::getYearInProgram),
          new Column("graduationDate", Application::getGraduationDate));

  private static final List<Column> TA_ONLY =
      List.of(
          new Column("classLevel", Application::getClassLevel),
          new Column("residencyStatus", Application::getResidencyStatus),
          new Column("languageExam", Application::getLanguageExam),
          new Column("languageExamDatePassed", Application::getLanguageExamDatePassed));

  private static final List<Column> ULA_ONLY =
      List.of(
          new Column("previousServiceAsUla", Application::getPreviousServiceAsUla),
          new Column("videoLink", Application::getVideoLink));

  private static final List<Column> AFTER_TYPE =
      List.of(
          new Column("priorCoursework", a -> courses(a.getPriorCoursework())),
          new Column("topicProficiencies", a -> pairs(a.getTopicProficiencies())),
          new Column("prevExperience", Application::getPrevExperience),
          new Column("firstChoiceCourse", Application::getFirstChoiceCourse),
          new Column("secondChoiceCourse", Application::getSecondChoiceCourse),
          new Column(
              "availableForLecturesFirstChoice", Application::isAvailableForLecturesFirstChoice),
          new Column(
              "availableForDiscussionFirstChoice",
              Application::isAvailableForDiscussionFirstChoice),
          new Column(
              "availabilityCommentsFirstChoice", Application::getAvailabilityCommentsFirstChoice),
          new Column(
              "availableForLecturesSecondChoice", Application::isAvailableForLecturesSecondChoice),
          new Column(
              "availableForDiscussionSecondChoice",
              Application::isAvailableForDiscussionSecondChoice),
          new Column(
              "availabilityCommentsSecondChoice", Application::getAvailabilityCommentsSecondChoice),
          new Column("courseInterests", a -> pairs(a.getCourseInterests())),
          new Column("comments", Application::getComments),
          new Column("postApplicationComments", Application::getPostApplicationComments),
          new Column("adminComments", Application::getAdminComments),
          new Column("noticeVersionId", Application::getNoticeVersionId));

  /** The ULA interests sit with the other ULA answers, after the topics. */
  private static final Column INTERESTS = new Column("interests", a -> pairs(a.getInterests()));

  /** The columns of a file for the given form type, in order. */
  static List<Column> columns(RecruitmentType type) {
    List<Column> columns = new ArrayList<>(BEFORE_TYPE);
    columns.addAll(type == RecruitmentType.TA ? TA_ONLY : ULA_ONLY);
    columns.addAll(AFTER_TYPE);
    if (type == RecruitmentType.ULA) {
      columns.add(INTERESTS);
    }
    return columns;
  }

  /** The document: a header row, then one row per application, every field quoted. */
  public String write(RecruitmentType type, List<Application> applications) {
    List<Column> columns = columns(type);
    StringWriter out = new StringWriter();
    // Neither flushed nor closed: CSVWriter writes each row straight through to the StringWriter.
    CSVWriter writer = new CSVWriter(out);
    writer.writeNext(columns.stream().map(Column::header).toArray(String[]::new));
    for (Application application : applications) {
      writer.writeNext(
          columns.stream().map(c -> text(c.value().apply(application))).toArray(String[]::new));
    }
    return out.toString();
  }

  /** Null reads as an empty cell; everything else as its usual string form. */
  static String text(Object value) {
    return value == null ? "" : String.valueOf(value);
  }

  /**
   * One course as its fields separated by commas: UCSB or the other school's name, the course
   * number, title, term and grade; the courses separated by semicolons, in the order given.
   */
  static String courses(List<PriorCoursework> courses) {
    if (courses == null) {
      return "";
    }
    return courses.stream()
        .map(
            c ->
                String.join(
                    ",",
                    c.isUcsbCourse() ? "UCSB" : text(c.getOtherSchool()),
                    text(c.getCourseNumber()),
                    text(c.getCourseTitle()),
                    text(c.getTerm()),
                    text(c.getGrade())))
        .collect(Collectors.joining(";"));
  }

  /** {@code name:value} pairs separated by commas, in name order, e.g. {@code C++:5,Java:4}. */
  static String pairs(Map<String, ?> values) {
    if (values == null) {
      return "";
    }
    return new TreeMap<>(values)
        .entrySet().stream()
            .map(e -> e.getKey() + ":" + text(e.getValue()))
            .collect(Collectors.joining(","));
  }
}
