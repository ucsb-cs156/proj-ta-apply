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
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
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
   * The allocation of each section in the quarter's recruitment of one type, leaving out the
   * courses an admin removed; none when the quarter has no such recruitment.
   */
  private Map<SectionKey, Integer> allocations(String quarter, RecruitmentType type) {
    return recruitmentRepository
        .findByQuarterAndType(quarter, type)
        .map(
            recruitment ->
                recruitmentCourseRepository.findByRecruitmentId(recruitment.getId()).stream()
                    .filter(row -> !row.isRemoved())
                    .collect(
                        Collectors.toMap(
                            SectionKey::of,
                            RecruitmentCourse::getAllocation,
                            // Two rows of one section cannot both be on file (the enroll code
                            // is unique per recruitment), but keep the first all the same.
                            (first, second) -> first)))
        .orElse(Map.of());
  }

  /** The rows a findAllById returns (each id at most once), by their id. */
  private static <K, V> Map<K, V> byId(Iterable<V> values, Function<V, K> key) {
    return StreamSupport.stream(values.spliterator(), false)
        .collect(Collectors.toMap(key, Function.identity()));
  }
}
