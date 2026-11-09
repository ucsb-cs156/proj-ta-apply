package edu.ucsb.cs.taapply.services;

import edu.ucsb.cs.taapply.entity.Instructor;
import edu.ucsb.cs.taapply.entity.InstructorFeedback;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.InstructorFeedbackRepository;
import edu.ucsb.cs.taapply.repository.InstructorRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * The admin's table of instructors' allocation feedback (issue #427): every {@link
 * InstructorFeedback} row of a quarter, with the course, the instructor's catalog name and the
 * course's current TA and ULA allocations joined in.
 */
@Service
public class InstructorFeedbackReportService {

  @Autowired InstructorFeedbackRepository instructorFeedbackRepository;
  @Autowired InstructorRepository instructorRepository;
  @Autowired RecruitmentRepository recruitmentRepository;
  @Autowired RecruitmentCourseRepository recruitmentCourseRepository;

  /**
   * One feedback row as the admin's table shows it. The preferred counts are null unless their
   * "different number" box is checked: an unchecked box keeps its number on file (issue #425), and
   * that number is not meant. The allocations are null when the quarter has no recruitment of that
   * type, or the course is not in it.
   */
  public static record Row(
      Long id,
      String quarter,
      String courseId,
      String section,
      String title,
      String email,
      String instructorName,
      boolean allocReasonable,
      boolean differentTACount,
      boolean differentULACount,
      boolean otherConcerns,
      Integer taAllocation,
      Integer ulaAllocation,
      Integer numTAsPreferred,
      Integer numULAsPreferred,
      String comments,
      LocalDateTime lastUpdated) {}

  /**
   * One instructor of a course of the quarter who has not checked any of the four boxes (issue
   * #427): the course (as the feedback names it), the instructor's catalog name and email. The
   * email is null when the Instructors list has no email for that catalog name.
   */
  public static record MissingRow(
      String courseId, String section, String title, String instructorName, String email) {}

  /** Who has answered about which course: a feedback row with at least one box checked. */
  private static record Responder(Long recruitmentCourseId, String email) {}

  /**
   * A section of a course: what pairs a course's TA row with its ULA row, as the home page does.
   */
  private static record SectionKey(String courseId, String section) {
    static SectionKey of(RecruitmentCourse row) {
      return new SectionKey(row.getCourseId(), row.getSection());
    }
  }

  /**
   * Every feedback row of the quarter (YYYYQ), by course id, section and email. A row whose course
   * is gone (which the foreign key's cascade should not allow) is left out.
   */
  public List<Row> rows(String quarter) {
    List<InstructorFeedback> feedback = instructorFeedbackRepository.findByQuarter(quarter);
    Map<Long, RecruitmentCourse> courses =
        byId(
            recruitmentCourseRepository.findAllById(
                feedback.stream()
                    .map(InstructorFeedback::getRecruitmentCourseId)
                    .distinct()
                    .toList()),
            RecruitmentCourse::getId);
    Map<String, Instructor> instructors =
        byId(
            instructorRepository.findAllById(
                feedback.stream().map(InstructorFeedback::getEmail).distinct().toList()),
            Instructor::getEmail);
    Map<SectionKey, Integer> ta = allocations(quarter, RecruitmentType.TA);
    Map<SectionKey, Integer> ula = allocations(quarter, RecruitmentType.ULA);
    return feedback.stream()
        .filter(row -> courses.containsKey(row.getRecruitmentCourseId()))
        .map(
            row -> {
              RecruitmentCourse course = courses.get(row.getRecruitmentCourseId());
              SectionKey key = SectionKey.of(course);
              return new Row(
                  row.getId(),
                  row.getQuarter(),
                  course.getCourseId(),
                  course.getSection(),
                  course.getTitle(),
                  row.getEmail(),
                  Optional.ofNullable(instructors.get(row.getEmail()))
                      .map(Instructor::getCatalogName)
                      .orElse(null),
                  row.isAllocReasonable(),
                  row.isDifferentTACount(),
                  row.isDifferentULACount(),
                  row.isOtherConcerns(),
                  ta.get(key),
                  ula.get(key),
                  row.isDifferentTACount() ? row.getNumTAsPreferred() : null,
                  row.isDifferentULACount() ? row.getNumULAsPreferred() : null,
                  row.getComments(),
                  row.getLastUpdated());
            })
        .sorted(
            Comparator.comparing(Row::courseId)
                .thenComparing(Row::section, Comparator.nullsFirst(Comparator.naturalOrder()))
                .thenComparing(Row::email))
        .toList();
  }

  /**
   * Every instructor of a course of the quarter who has not checked any of the four boxes: those
   * with no feedback row for the course, and those whose row has all four unchecked (whatever its
   * counts or comments). The courses are the non-removed rows of the quarter's TA and ULA
   * recruitments, a section in both once (named by its TA row, as the feedback is). A course's
   * instructors are the emails the Instructors list maps its instructors of record's catalog names
   * to, as the feedback form decides who teaches a course (issue #425); a catalog name with no
   * email is listed once with a null email. By course id, section, email (no email last) and name.
   */
  public List<MissingRow> missing(String quarter) {
    Map<SectionKey, RecruitmentCourse> courses = new LinkedHashMap<>();
    Map<SectionKey, Set<String>> names = new HashMap<>();
    List<RecruitmentCourse> rows = new ArrayList<>(sectionRows(quarter, RecruitmentType.TA));
    rows.addAll(sectionRows(quarter, RecruitmentType.ULA));
    for (RecruitmentCourse row : rows) {
      SectionKey key = SectionKey.of(row);
      courses.putIfAbsent(key, row);
      if (row.getInstructor() != null) {
        names.computeIfAbsent(key, k -> new TreeSet<>()).add(row.getInstructor());
      }
    }
    Map<String, List<String>> emails =
        StreamSupport.stream(instructorRepository.findAll().spliterator(), false)
            .filter(instructor -> instructor.getCatalogName() != null)
            .collect(
                Collectors.groupingBy(
                    Instructor::getCatalogName,
                    Collectors.mapping(Instructor::getEmail, Collectors.toList())));
    Set<Responder> responded =
        instructorFeedbackRepository.findByQuarter(quarter).stream()
            .filter(InstructorFeedbackReportService::anyChecked)
            .map(row -> new Responder(row.getRecruitmentCourseId(), row.getEmail()))
            .collect(Collectors.toSet());

    List<MissingRow> missing = new ArrayList<>();
    courses.forEach(
        (key, course) -> {
          for (String name : names.getOrDefault(key, Set.of())) {
            List<String> theirs = emails.getOrDefault(name, List.of());
            if (theirs.isEmpty()) {
              missing.add(missingRow(course, name, null));
            }
            for (String email : theirs) {
              if (!responded.contains(new Responder(course.getId(), email))) {
                missing.add(missingRow(course, name, email));
              }
            }
          }
        });
    missing.sort(
        Comparator.comparing(MissingRow::courseId)
            .thenComparing(MissingRow::section, Comparator.nullsFirst(Comparator.naturalOrder()))
            .thenComparing(MissingRow::email, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(MissingRow::instructorName));
    return missing;
  }

  private static MissingRow missingRow(RecruitmentCourse course, String name, String email) {
    return new MissingRow(
        course.getCourseId(), course.getSection(), course.getTitle(), name, email);
  }

  /** Whether the instructor checked at least one of the four boxes. */
  private static boolean anyChecked(InstructorFeedback row) {
    return row.isAllocReasonable()
        || row.isDifferentTACount()
        || row.isDifferentULACount()
        || row.isOtherConcerns();
  }

  /**
   * The non-removed rows of the quarter's recruitment of one type; none when the quarter has no
   * such recruitment.
   */
  private List<RecruitmentCourse> sectionRows(String quarter, RecruitmentType type) {
    return recruitmentRepository
        .findByQuarterAndType(quarter, type)
        .map(
            recruitment ->
                recruitmentCourseRepository.findByRecruitmentId(recruitment.getId()).stream()
                    .filter(row -> !row.isRemoved())
                    .toList())
        .orElse(List.of());
  }

  /** The allocation of each section in the quarter's recruitment of one type (see sectionRows). */
  private Map<SectionKey, Integer> allocations(String quarter, RecruitmentType type) {
    return sectionRows(quarter, type).stream()
        .collect(
            Collectors.toMap(
                SectionKey::of,
                RecruitmentCourse::getAllocation,
                // Two rows of one section cannot both be on file (the enroll code is unique per
                // recruitment), but keep the first all the same.
                (first, second) -> first));
  }

  /** The rows a findAllById returns (each id at most once), by their id. */
  private static <K, V> Map<K, V> byId(Iterable<V> values, Function<V, K> key) {
    return StreamSupport.stream(values.spliterator(), false)
        .collect(Collectors.toMap(key, Function.identity()));
  }
}
