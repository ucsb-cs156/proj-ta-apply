package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.Instructor;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.InstructorRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.services.PublishedAssignmentsService.Table;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest(classes = {PublishedAssignmentsService.class})
@ActiveProfiles("test")
public class PublishedAssignmentsServiceTests {

  @Autowired PublishedAssignmentsService service;
  @MockitoBean AssignmentsService assignmentsService;
  @MockitoBean RecruitmentCourseRepository recruitmentCourseRepository;
  @MockitoBean InstructorRepository instructorRepository;

  private static Recruitment recruitment(RecruitmentType type, Boolean published) {
    return Recruitment.builder()
        .id(7L)
        .quarter("20264")
        .type(type)
        .assignmentsPublished(published)
        .build();
  }

  private static RecruitmentCourse course(
      long id, String courseId, String section, String instructor, boolean removed) {
    return RecruitmentCourse.builder()
        .id(id)
        .recruitmentId(7L)
        .courseId(courseId)
        .section(section)
        .enrollCode("EC" + id)
        .instructor(instructor)
        .removed(removed)
        .build();
  }

  private static Application person(
      long id, String first, String last, String email, Long course, Integer ulaQuarters) {
    return Application.builder()
        .id(id)
        .recruitmentId(7L)
        .firstName(first)
        .lastName(last)
        .email(email)
        .tentativeAssignmentId(course)
        .previousServiceAsUla(ulaQuarters)
        .build();
  }

  private static Instructor instructor(String email, String catalogName) {
    return Instructor.builder().email(email).catalogName(catalogName).build();
  }

  // Three live sections (given out of order), one removed with nobody, one removed with someone.
  private final RecruitmentCourse c16 = course(20L, "CMPSC    16", "0100", "SMITH J", false);
  private final RecruitmentCourse c8 = course(10L, "CMPSC     8", "0100", "CONRAD P", false);
  private final RecruitmentCourse c130a = course(30L, "CMPSC   130A", "0100", null, false);
  private final RecruitmentCourse gone = course(40L, "CMPSC    40", "0100", "CONRAD P", true);
  private final RecruitmentCourse goneButStaffed =
      course(50L, "CMPSC    24", "0200", "DOE X", true);

  @BeforeEach
  public void setUp() {
    when(recruitmentCourseRepository.findByRecruitmentId(7L))
        .thenReturn(List.of(c16, c8, c130a, gone, goneButStaffed));
    // CONRAD P maps to one address, DOE X to two (ambiguous), one instructor has no name yet.
    when(instructorRepository.findAll())
        .thenReturn(
            List.of(
                instructor("pconrad@ucsb.edu", "CONRAD P"),
                instructor("doe1@ucsb.edu", "DOE X"),
                instructor("doe2@ucsb.edu", "DOE X"),
                instructor("nobody@ucsb.edu", null)));
    when(assignmentsService.realApplications(7L))
        .thenReturn(
            List.of(
                person(1L, "Zed", "brown", "zed@ucsb.edu", 10L, 0),
                person(2L, "Ada", "Lovelace", "ada@ucsb.edu", 20L, 2),
                person(3L, "Alan", "Turing", "alan@ucsb.edu", null, null),
                person(4L, "Grace", "Hopper", "grace@ucsb.edu", 10L, null),
                person(5L, "Bob", "Brown", "bob@ucsb.edu", 50L, 1),
                person(6L, "Lost", "Soul", "lost@ucsb.edu", 999L, 0),
                person(7L, null, null, null, 20L, 3)));
  }

  // ---- guards ----

  @Test
  public void an_unknown_layout_is_refused_before_anything_is_read() {
    IllegalArgumentException e =
        assertThrows(
            IllegalArgumentException.class,
            () -> service.table(recruitment(RecruitmentType.TA, true), "Course"));
    assertEquals("layout must be course or student", e.getMessage());
    verify(recruitmentCourseRepository, never()).findByRecruitmentId(any());
  }

  @Test
  public void unpublished_assignments_are_refused() {
    IllegalArgumentException e =
        assertThrows(
            IllegalArgumentException.class,
            () -> service.table(recruitment(RecruitmentType.TA, false), "course"));
    assertEquals("Assignments for recruitment 7 have not been published", e.getMessage());
    assertThrows(
        IllegalArgumentException.class,
        () -> service.table(recruitment(RecruitmentType.TA, null), "student"));
    verify(recruitmentCourseRepository, never()).findByRecruitmentId(any());
  }

  // ---- one row per course ----

  @Test
  public void course_layout_lists_every_live_section_in_order_with_its_people() {
    Table table = service.table(recruitment(RecruitmentType.TA, true), "course");

    assertEquals(7L, table.recruitmentId());
    assertEquals(RecruitmentType.TA, table.type());
    assertEquals("course", table.layout());
    // Two people at most in one section, so two TA columns.
    assertEquals(List.of("Course", "Instructor", "Instructor email", "TA", "TA"), table.headers());
    assertEquals(
        List.of(
            // Sorted by last name then first name, case-insensitively: brown before Hopper.
            List.of(
                "CMPSC 8",
                "CONRAD P",
                "pconrad@ucsb.edu",
                "Zed brown (zed@ucsb.edu)",
                "Grace Hopper (grace@ucsb.edu)"),
            // Null names read as blanks and sort first; SMITH J has no instructor record.
            List.of("CMPSC 16", "SMITH J", "Not mapped", "  ()", "Ada Lovelace (ada@ucsb.edu)"),
            // Removed but still staffed; DOE X maps to two addresses.
            List.of("CMPSC 24", "DOE X", "Not mapped", "Bob Brown (bob@ucsb.edu)", ""),
            // Nobody assigned, and no instructor at all.
            List.of("CMPSC 130A", "", "Not mapped", "", "")),
        table.rows());
  }

  @Test
  public void course_layout_has_no_position_columns_when_nobody_is_assigned() {
    when(assignmentsService.realApplications(7L))
        .thenReturn(List.of(person(3L, "Alan", "Turing", "alan@ucsb.edu", null, null)));

    Table table = service.table(recruitment(RecruitmentType.ULA, true), "course");

    assertEquals(List.of("Course", "Instructor", "Instructor email"), table.headers());
    assertEquals(
        List.of(
            List.of("CMPSC 8", "CONRAD P", "pconrad@ucsb.edu"),
            List.of("CMPSC 16", "SMITH J", "Not mapped"),
            List.of("CMPSC 130A", "", "Not mapped")),
        table.rows());
  }

  @Test
  public void course_layout_heads_the_position_columns_ULA_for_a_ULA_recruitment() {
    when(assignmentsService.realApplications(7L))
        .thenReturn(List.of(person(1L, "Zed", "Brown", "zed@ucsb.edu", 30L, 0)));

    Table table = service.table(recruitment(RecruitmentType.ULA, true), "course");

    assertEquals(List.of("Course", "Instructor", "Instructor email", "ULA"), table.headers());
    assertEquals(
        List.of("CMPSC 130A", "", "Not mapped", "Zed Brown (zed@ucsb.edu)"), table.rows().get(2));
  }

  // ---- one row per TA or ULA ----

  @Test
  public void student_layout_for_a_ULA_recruitment_says_who_is_a_first_time_ULA() {
    Table table = service.table(recruitment(RecruitmentType.ULA, true), "student");

    assertEquals("student", table.layout());
    assertEquals(
        List.of(
            "First name",
            "Last name",
            "Email",
            "Course assignment",
            "Course instructor",
            "Course instructor email",
            "First time ULA"),
        table.headers());
    assertEquals(
        List.of(
            List.of("", "", "", "CMPSC 16", "SMITH J", "Not mapped", "no"),
            List.of("Bob", "Brown", "bob@ucsb.edu", "CMPSC 24", "DOE X", "Not mapped", "no"),
            List.of(
                "Zed", "brown", "zed@ucsb.edu", "CMPSC 8", "CONRAD P", "pconrad@ucsb.edu", "yes"),
            List.of(
                "Grace",
                "Hopper",
                "grace@ucsb.edu",
                "CMPSC 8",
                "CONRAD P",
                "pconrad@ucsb.edu",
                "yes"),
            List.of("Ada", "Lovelace", "ada@ucsb.edu", "CMPSC 16", "SMITH J", "Not mapped", "no")),
        table.rows());
  }

  @Test
  public void student_layout_for_a_TA_recruitment_has_no_first_time_column() {
    Table table = service.table(recruitment(RecruitmentType.TA, true), "student");

    assertEquals(
        List.of(
            "First name",
            "Last name",
            "Email",
            "Course assignment",
            "Course instructor",
            "Course instructor email"),
        table.headers());
    assertEquals(5, table.rows().size());
    assertEquals(
        List.of("Zed", "brown", "zed@ucsb.edu", "CMPSC 8", "CONRAD P", "pconrad@ucsb.edu"),
        table.rows().get(2));
  }

  // ---- csv ----

  @Test
  public void csv_is_the_same_table_with_every_cell_quoted() {
    when(assignmentsService.realApplications(7L))
        .thenReturn(List.of(person(1L, "Zed", "Brown", "zed@ucsb.edu", 10L, 0)));

    String csv = service.csv(recruitment(RecruitmentType.TA, true), "student");

    assertEquals(
        "\"First name\",\"Last name\",\"Email\",\"Course assignment\",\"Course instructor\","
            + "\"Course instructor email\"\n"
            + "\"Zed\",\"Brown\",\"zed@ucsb.edu\",\"CMPSC 8\",\"CONRAD P\",\"pconrad@ucsb.edu\"\n",
        csv);

    String byCourse = service.csv(recruitment(RecruitmentType.TA, true), "course");
    assertEquals(
        "\"Course\",\"Instructor\",\"Instructor email\",\"TA\"\n"
            + "\"CMPSC 8\",\"CONRAD P\",\"pconrad@ucsb.edu\",\"Zed Brown (zed@ucsb.edu)\"\n"
            + "\"CMPSC 16\",\"SMITH J\",\"Not mapped\",\"\"\n"
            + "\"CMPSC 130A\",\"\",\"Not mapped\",\"\"\n",
        byCourse);
  }

  @Test
  public void csv_of_unpublished_assignments_is_refused() {
    assertThrows(
        IllegalArgumentException.class,
        () -> service.csv(recruitment(RecruitmentType.TA, false), "course"));
  }

  // ---- helpers ----

  @Test
  public void course_numbers_collapse_the_catalog_padding() {
    assertEquals("CMPSC 8", PublishedAssignmentsService.courseNumber(c8));
    assertEquals("CMPSC 130A", PublishedAssignmentsService.courseNumber(c130a));
    assertEquals("", PublishedAssignmentsService.courseNumber(course(1L, null, null, null, false)));
    assertEquals(
        "ECE 1 A",
        PublishedAssignmentsService.courseNumber(course(1L, " ECE  1 A ", null, null, false)));
  }

  @Test
  public void a_first_time_ULA_has_no_previous_quarters() {
    assertEquals(
        "yes", PublishedAssignmentsService.firstTimeUla(person(1L, "a", "b", "c", 1L, null)));
    assertEquals("yes", PublishedAssignmentsService.firstTimeUla(person(1L, "a", "b", "c", 1L, 0)));
    assertEquals("no", PublishedAssignmentsService.firstTimeUla(person(1L, "a", "b", "c", 1L, 1)));
    assertEquals("no", PublishedAssignmentsService.firstTimeUla(person(1L, "a", "b", "c", 1L, 5)));
  }

  @Test
  public void people_sort_by_last_name_then_first_name_ignoring_case() {
    List<Application> people =
        List.of(
            person(1L, "Bob", "Brown", "", 1L, 0),
            person(2L, "alice", "brown", "", 1L, 0),
            person(3L, "Zed", "Adams", "", 1L, 0),
            person(4L, null, "Brown", "", 1L, 0));
    List<Long> order =
        people.stream()
            .sorted(PublishedAssignmentsService.BY_NAME)
            .map(Application::getId)
            .toList();
    assertEquals(List.of(3L, 4L, 2L, 1L), order);
  }
}
