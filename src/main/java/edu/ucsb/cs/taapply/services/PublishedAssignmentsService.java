package edu.ucsb.cs.taapply.services;

import com.opencsv.CSVWriter;
import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.Instructor;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.InstructorRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import java.io.StringWriter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * The published assignments of a recruitment (issue #180), as the read-only page and its CSV
 * downloads show them: one row per course with the people assigned to it, or one row per TA or ULA
 * with their course. Both come as a header row and text rows, so the page and the CSV are the same
 * table. Only real, uncancelled applications with a tentative assignment take part.
 */
@Service
public class PublishedAssignmentsService {
  @Autowired AssignmentsService assignmentsService;
  @Autowired RecruitmentCourseRepository recruitmentCourseRepository;
  @Autowired InstructorRepository instructorRepository;

  public static final String LAYOUT_COURSE = "course";
  public static final String LAYOUT_STUDENT = "student";

  /** What an instructor's email reads when the catalog name maps to no, or several, instructors. */
  public static final String NOT_MAPPED = "Not mapped";

  /** A table: the headers, then one list of cells per row, every cell text. */
  public record Table(
      Long recruitmentId,
      RecruitmentType type,
      String layout,
      List<String> headers,
      List<List<String>> rows) {}

  /** Last name, then first name, case-insensitively, a null reading as "". */
  static final Comparator<Application> BY_NAME =
      Comparator.comparing(
              (Application a) -> ApplicationCsvService.text(a.getLastName()),
              String.CASE_INSENSITIVE_ORDER)
          .thenComparing(
              a -> ApplicationCsvService.text(a.getFirstName()), String.CASE_INSENSITIVE_ORDER);

  /**
   * The table for one layout.
   *
   * @throws IllegalArgumentException for a layout other than "course" or "student", or when the
   *     recruitment's assignments are not published
   */
  public Table table(Recruitment recruitment, String layout) {
    if (!LAYOUT_COURSE.equals(layout) && !LAYOUT_STUDENT.equals(layout)) {
      throw new IllegalArgumentException("layout must be course or student");
    }
    if (!Boolean.TRUE.equals(recruitment.getAssignmentsPublished())) {
      throw new IllegalArgumentException(
          "Assignments for recruitment %d have not been published".formatted(recruitment.getId()));
    }
    List<RecruitmentCourse> courses =
        new ArrayList<>(recruitmentCourseRepository.findByRecruitmentId(recruitment.getId()));
    courses.sort(AssignmentsService.BY_COURSE_SECTION_ENROLL);
    Map<Long, RecruitmentCourse> byId = new HashMap<>();
    for (RecruitmentCourse course : courses) {
      byId.put(course.getId(), course);
    }
    List<Application> assigned =
        assignmentsService.realApplications(recruitment.getId()).stream()
            .filter(a -> byId.containsKey(a.getTentativeAssignmentId()))
            .sorted(BY_NAME)
            .toList();
    Map<String, String> emails = emailsByCatalogName();

    List<String> headers;
    List<List<String>> rows = new ArrayList<>();
    if (LAYOUT_COURSE.equals(layout)) {
      Map<Long, List<Application>> byCourse =
          assigned.stream().collect(Collectors.groupingBy(Application::getTentativeAssignmentId));
      int width = 0;
      for (RecruitmentCourse course : courses) {
        List<Application> people = byCourse.getOrDefault(course.getId(), List.of());
        // A removed section only while someone is still assigned to it.
        if (course.isRemoved() && people.isEmpty()) {
          continue;
        }
        width = Math.max(width, people.size());
        List<String> row = new ArrayList<>();
        row.add(courseNumber(course));
        row.add(ApplicationCsvService.text(course.getInstructor()));
        row.add(emailFor(course, emails));
        for (Application person : people) {
          row.add(
              "%s %s (%s)"
                  .formatted(
                      ApplicationCsvService.text(person.getFirstName()),
                      ApplicationCsvService.text(person.getLastName()),
                      ApplicationCsvService.text(person.getEmail())));
        }
        rows.add(row);
      }
      headers = new ArrayList<>(List.of("Course", "Instructor", "Instructor email"));
      for (int i = 0; i < width; i++) {
        headers.add(recruitment.getType().name());
      }
      for (List<String> row : rows) {
        while (row.size() < headers.size()) {
          row.add("");
        }
      }
    } else {
      boolean ula = recruitment.getType() == RecruitmentType.ULA;
      headers =
          new ArrayList<>(
              List.of(
                  "First name",
                  "Last name",
                  "Email",
                  "Course assignment",
                  "Course instructor",
                  "Course instructor email"));
      if (ula) {
        headers.add("First time ULA");
      }
      for (Application person : assigned) {
        RecruitmentCourse course = byId.get(person.getTentativeAssignmentId());
        List<String> row = new ArrayList<>();
        row.add(ApplicationCsvService.text(person.getFirstName()));
        row.add(ApplicationCsvService.text(person.getLastName()));
        row.add(ApplicationCsvService.text(person.getEmail()));
        row.add(courseNumber(course));
        row.add(ApplicationCsvService.text(course.getInstructor()));
        row.add(emailFor(course, emails));
        if (ula) {
          row.add(firstTimeUla(person));
        }
        rows.add(row);
      }
    }
    return new Table(recruitment.getId(), recruitment.getType(), layout, headers, rows);
  }

  /** The table as CSV: the header row, then the rows, every cell quoted. */
  public String csv(Recruitment recruitment, String layout) {
    Table table = table(recruitment, layout);
    StringWriter out = new StringWriter();
    CSVWriter writer = new CSVWriter(out);
    writer.writeNext(table.headers().toArray(String[]::new));
    for (List<String> row : table.rows()) {
      writer.writeNext(row.toArray(String[]::new));
    }
    return out.toString();
  }

  /** "CMPSC 8" as the catalog pads it reads "CMPSC 8". */
  static String courseNumber(RecruitmentCourse course) {
    return ApplicationCsvService.text(course.getCourseId()).trim().replaceAll("\\s+", " ");
  }

  /** "yes" for someone who reports no previous quarters as a ULA, "no" otherwise. */
  static String firstTimeUla(Application application) {
    Integer quarters = application.getPreviousServiceAsUla();
    return quarters == null || quarters == 0 ? "yes" : "no";
  }

  /** Each catalog name that exactly one instructor goes by, with that instructor's email. */
  private Map<String, String> emailsByCatalogName() {
    Map<String, List<String>> all =
        StreamSupport.stream(instructorRepository.findAll().spliterator(), false)
            .filter(instructor -> instructor.getCatalogName() != null)
            .collect(
                Collectors.groupingBy(
                    Instructor::getCatalogName,
                    Collectors.mapping(Instructor::getEmail, Collectors.toList())));
    Map<String, String> unique = new HashMap<>();
    all.forEach(
        (name, emails) -> {
          if (emails.size() == 1) {
            unique.put(name, emails.get(0));
          }
        });
    return unique;
  }

  private static String emailFor(RecruitmentCourse course, Map<String, String> emails) {
    // A null instructor is simply absent from the map.
    String email = emails.get(course.getInstructor());
    return email == null ? NOT_MAPPED : email;
  }
}
