package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import edu.ucsb.cs.taapply.entity.Instructor;
import edu.ucsb.cs.taapply.entity.InstructorFeedback;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.InstructorFeedbackRepository;
import edu.ucsb.cs.taapply.repository.InstructorRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.InstructorFeedbackReportService.MissingRow;
import edu.ucsb.cs.taapply.services.InstructorFeedbackReportService.Row;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/** Issue #427: a quarter's instructor feedback, with the course and its allocations joined in. */
@SpringBootTest(classes = {InstructorFeedbackReportService.class})
@ActiveProfiles("test")
public class InstructorFeedbackReportServiceTests {

  @Autowired InstructorFeedbackReportService service;
  @MockitoBean InstructorFeedbackRepository instructorFeedbackRepository;
  @MockitoBean InstructorRepository instructorRepository;
  @MockitoBean RecruitmentRepository recruitmentRepository;
  @MockitoBean RecruitmentCourseRepository recruitmentCourseRepository;

  private static final String Q = "20261";
  private static final LocalDateTime SAVED = LocalDateTime.of(2026, 1, 15, 9, 30, 5);

  private static final Recruitment TA =
      Recruitment.builder().id(10L).quarter(Q).type(RecruitmentType.TA).build();
  private static final Recruitment ULA =
      Recruitment.builder().id(11L).quarter(Q).type(RecruitmentType.ULA).build();

  private static RecruitmentCourse course(
      long id, long recruitmentId, String courseId, String section, int allocation) {
    return RecruitmentCourse.builder()
        .id(id)
        .recruitmentId(recruitmentId)
        .courseId(courseId)
        .enrollCode("E" + id)
        .section(section)
        .title("TITLE " + id)
        .allocation(allocation)
        .build();
  }

  private static InstructorFeedback.InstructorFeedbackBuilder feedback(
      long id, String email, long courseId) {
    return InstructorFeedback.builder()
        .id(id)
        .quarter(Q)
        .email(email)
        .recruitmentCourseId(courseId)
        .lastUpdated(SAVED);
  }

  private final List<RecruitmentCourse> taRows = new ArrayList<>();
  private final List<RecruitmentCourse> ulaRows = new ArrayList<>();

  @BeforeEach
  public void bothRecruitments() {
    when(recruitmentRepository.findByQuarterAndType(Q, RecruitmentType.TA))
        .thenReturn(Optional.of(TA));
    when(recruitmentRepository.findByQuarterAndType(Q, RecruitmentType.ULA))
        .thenReturn(Optional.of(ULA));
    when(recruitmentCourseRepository.findByRecruitmentId(10L)).thenReturn(taRows);
    when(recruitmentCourseRepository.findByRecruitmentId(11L)).thenReturn(ulaRows);
    when(instructorRepository.findAllById(any())).thenReturn(List.of());
  }

  /** The feedback on file, and the recruitment course rows findAllById finds for it. */
  private void onFile(List<InstructorFeedback> rows, RecruitmentCourse... courses) {
    when(instructorFeedbackRepository.findByQuarter(Q)).thenReturn(rows);
    when(recruitmentCourseRepository.findAllById(any())).thenReturn(List.of(courses));
  }

  @Test
  public void a_quarter_with_no_feedback_has_no_rows() {
    onFile(List.of());
    assertEquals(List.of(), service.rows(Q));
  }

  @Test
  public void a_course_in_both_recruitments_gets_both_allocations_and_every_field() {
    RecruitmentCourse taRow = course(2, 10, "CMPSC   156", "0100", 3);
    RecruitmentCourse ulaRow = course(5, 11, "CMPSC   156", "0100", 4);
    taRows.add(taRow);
    ulaRows.add(ulaRow);
    onFile(
        List.of(
            feedback(7, "pconrad@ucsb.edu", 2)
                .allocReasonable(true)
                .differentTACount(true)
                .differentULACount(true)
                .otherConcerns(true)
                .numTAsPreferred(5)
                .numULAsPreferred(6)
                .comments("More please")
                .build()),
        taRow);
    when(instructorRepository.findAllById(List.of("pconrad@ucsb.edu")))
        .thenReturn(
            List.of(
                Instructor.builder().email("pconrad@ucsb.edu").catalogName("CONRAD P").build()));

    assertEquals(
        List.of(
            new Row(
                7L,
                Q,
                "CMPSC   156",
                "0100",
                "TITLE 2",
                "pconrad@ucsb.edu",
                "CONRAD P",
                true,
                true,
                true,
                true,
                3,
                4,
                5,
                6,
                "More please",
                SAVED)),
        service.rows(Q));
  }

  @Test
  public void the_ids_looked_up_are_each_named_once() {
    RecruitmentCourse taRow = course(2, 10, "CMPSC   156", "0100", 3);
    onFile(
        List.of(feedback(7, "a@ucsb.edu", 2).build(), feedback(8, "b@ucsb.edu", 2).build()), taRow);

    service.rows(Q);

    @SuppressWarnings("unchecked")
    ArgumentCaptor<Iterable<Long>> courseIds = ArgumentCaptor.forClass(Iterable.class);
    verify(recruitmentCourseRepository).findAllById(courseIds.capture());
    assertEquals(List.of(2L), courseIds.getValue());
    @SuppressWarnings("unchecked")
    ArgumentCaptor<Iterable<String>> emails = ArgumentCaptor.forClass(Iterable.class);
    verify(instructorRepository).findAllById(emails.capture());
    assertEquals(List.of("a@ucsb.edu", "b@ucsb.edu"), emails.getValue());
  }

  @Test
  public void an_unchecked_box_hides_its_stored_count() {
    RecruitmentCourse taRow = course(2, 10, "CMPSC   156", "0100", 3);
    taRows.add(taRow);
    onFile(
        List.of(
            feedback(7, "pconrad@ucsb.edu", 2)
                .differentTACount(false)
                .differentULACount(false)
                .numTAsPreferred(5)
                .numULAsPreferred(6)
                .build()),
        taRow);

    Row row = service.rows(Q).get(0);
    assertFalse(row.differentTACount());
    assertFalse(row.differentULACount());
    assertNull(row.numTAsPreferred());
    assertNull(row.numULAsPreferred());
    assertFalse(row.allocReasonable());
    assertFalse(row.otherConcerns());
  }

  @Test
  public void a_ula_only_course_has_no_ta_allocation_and_an_unlisted_instructor_has_no_name() {
    RecruitmentCourse other = course(3, 10, "CMPSC   8", "0100", 9);
    RecruitmentCourse ulaRow = course(5, 11, "CMPSC   156", "0100", 4);
    taRows.add(other);
    ulaRows.add(ulaRow);
    onFile(List.of(feedback(7, "pconrad@ucsb.edu", 5).build()), ulaRow);

    Row row = service.rows(Q).get(0);
    assertNull(row.taAllocation());
    assertEquals(4, row.ulaAllocation());
    assertNull(row.instructorName());
  }

  @Test
  public void a_quarter_without_a_ula_recruitment_has_no_ula_allocations() {
    when(recruitmentRepository.findByQuarterAndType(Q, RecruitmentType.ULA))
        .thenReturn(Optional.empty());
    RecruitmentCourse taRow = course(2, 10, "CMPSC   156", "0100", 3);
    taRows.add(taRow);
    onFile(List.of(feedback(7, "pconrad@ucsb.edu", 2).build()), taRow);

    Row row = service.rows(Q).get(0);
    assertEquals(3, row.taAllocation());
    assertNull(row.ulaAllocation());
  }

  @Test
  public void another_section_and_a_removed_row_do_not_pair() {
    RecruitmentCourse taRow = course(2, 10, "CMPSC   156", "0100", 3);
    taRows.add(taRow);
    ulaRows.add(course(5, 11, "CMPSC   156", "0200", 4));
    ulaRows.add(course(6, 11, "CMPSC   156", "0100", 8).toBuilder().removed(true).build());
    onFile(List.of(feedback(7, "pconrad@ucsb.edu", 2).build()), taRow);

    assertNull(service.rows(Q).get(0).ulaAllocation());
  }

  @Test
  public void two_rows_of_one_section_keep_the_first() {
    RecruitmentCourse taRow = course(2, 10, "CMPSC   156", "0100", 3);
    taRows.add(taRow);
    taRows.add(course(4, 10, "CMPSC   156", "0100", 7));
    onFile(List.of(feedback(7, "pconrad@ucsb.edu", 2).build()), taRow);

    assertEquals(3, service.rows(Q).get(0).taAllocation());
  }

  @Test
  public void feedback_whose_course_is_gone_is_left_out() {
    RecruitmentCourse taRow = course(2, 10, "CMPSC   156", "0100", 3);
    taRows.add(taRow);
    onFile(
        List.of(feedback(7, "a@ucsb.edu", 2).build(), feedback(8, "b@ucsb.edu", 99).build()),
        taRow);

    List<Row> rows = service.rows(Q);
    assertEquals(1, rows.size());
    assertEquals(7L, rows.get(0).id());
  }

  @Test
  public void rows_come_by_course_id_then_section_nulls_first_then_email() {
    RecruitmentCourse c8 = course(1, 10, "CMPSC   8", "0100", 1);
    RecruitmentCourse c156a = course(2, 10, "CMPSC   156", "0100", 1);
    RecruitmentCourse c156none = course(3, 10, "CMPSC   156", null, 1);
    RecruitmentCourse c156b = course(4, 10, "CMPSC   156", "0200", 1);
    onFile(
        List.of(
            feedback(1, "a@ucsb.edu", 1).build(),
            feedback(2, "z@ucsb.edu", 4).build(),
            feedback(3, "b@ucsb.edu", 2).build(),
            feedback(4, "a@ucsb.edu", 2).build(),
            feedback(5, "a@ucsb.edu", 3).build()),
        c8,
        c156a,
        c156none,
        c156b);

    List<Long> ids = service.rows(Q).stream().map(Row::id).toList();
    // By the stored course id as it is: "CMPSC   156" before "CMPSC   8".
    assertEquals(List.of(5L, 4L, 3L, 2L, 1L), ids);
  }

  // ---- missing(): who has not checked any box ----

  /** A course row taught by the given catalog name. */
  private static RecruitmentCourse taught(
      long id, long recruitmentId, String courseId, String section, String instructor) {
    return course(id, recruitmentId, courseId, section, 0).toBuilder()
        .instructor(instructor)
        .build();
  }

  private static Instructor instructor(String email, String catalogName) {
    return Instructor.builder().email(email).catalogName(catalogName).build();
  }

  private void instructors(Instructor... list) {
    when(instructorRepository.findAll()).thenReturn(List.of(list));
  }

  private void feedbackOnFile(InstructorFeedback... rows) {
    when(instructorFeedbackRepository.findByQuarter(Q)).thenReturn(List.of(rows));
  }

  private static MissingRow missing(
      String courseId, String section, long id, String name, String email) {
    return new MissingRow(courseId, section, "TITLE " + id, name, email);
  }

  @Test
  public void an_instructor_with_no_feedback_row_is_listed() {
    taRows.add(taught(2, 10, "CMPSC   156", "0100", "CONRAD P"));
    instructors(instructor("pconrad@ucsb.edu", "CONRAD P"));
    feedbackOnFile();

    assertEquals(
        List.of(missing("CMPSC   156", "0100", 2, "CONRAD P", "pconrad@ucsb.edu")),
        service.missing(Q));
  }

  @Test
  public void a_row_with_no_box_checked_is_listed_whatever_its_counts_and_comments() {
    taRows.add(taught(2, 10, "CMPSC   156", "0100", "CONRAD P"));
    instructors(instructor("pconrad@ucsb.edu", "CONRAD P"));
    feedbackOnFile(
        feedback(7, "pconrad@ucsb.edu", 2)
            .numTAsPreferred(4)
            .numULAsPreferred(2)
            .comments("Thinking about it")
            .build());

    assertEquals(
        List.of(missing("CMPSC   156", "0100", 2, "CONRAD P", "pconrad@ucsb.edu")),
        service.missing(Q));
  }

  @Test
  public void any_one_box_checked_counts_as_feedback() {
    // Five co-instructors of one course (five emails mapped to one catalog name): each of the
    // first four checked one box, the fifth none.
    taRows.add(taught(2, 10, "CMPSC   156", "0100", "CONRAD P"));
    instructors(
        instructor("a@ucsb.edu", "CONRAD P"),
        instructor("b@ucsb.edu", "CONRAD P"),
        instructor("c@ucsb.edu", "CONRAD P"),
        instructor("d@ucsb.edu", "CONRAD P"),
        instructor("e@ucsb.edu", "CONRAD P"));
    feedbackOnFile(
        feedback(1, "a@ucsb.edu", 2).allocReasonable(true).build(),
        feedback(2, "b@ucsb.edu", 2).differentTACount(true).build(),
        feedback(3, "c@ucsb.edu", 2).differentULACount(true).build(),
        feedback(4, "d@ucsb.edu", 2).otherConcerns(true).build(),
        feedback(5, "e@ucsb.edu", 2).build());

    assertEquals(
        List.of(missing("CMPSC   156", "0100", 2, "CONRAD P", "e@ucsb.edu")), service.missing(Q));
  }

  @Test
  public void a_co_taught_course_lists_only_the_instructor_who_did_not_respond() {
    // The TA row's instructor of record is one co-instructor, the ULA row's the other.
    taRows.add(taught(2, 10, "CMPSC   156", "0100", "CONRAD P"));
    ulaRows.add(taught(5, 11, "CMPSC   156", "0100", "WANG R"));
    instructors(instructor("pconrad@ucsb.edu", "CONRAD P"), instructor("wang@ucsb.edu", "WANG R"));
    feedbackOnFile(feedback(7, "pconrad@ucsb.edu", 2).allocReasonable(true).build());

    assertEquals(
        List.of(missing("CMPSC   156", "0100", 2, "WANG R", "wang@ucsb.edu")), service.missing(Q));
  }

  @Test
  public void a_course_in_both_recruitments_is_listed_once_by_its_ta_row() {
    taRows.add(taught(2, 10, "CMPSC   156", "0100", "CONRAD P"));
    ulaRows.add(taught(5, 11, "CMPSC   156", "0100", "CONRAD P"));
    // A ULA-only course is named by its ULA row.
    ulaRows.add(taught(6, 11, "CMPSC    16", "0100", "CONRAD P"));
    instructors(instructor("pconrad@ucsb.edu", "CONRAD P"));
    feedbackOnFile();

    assertEquals(
        List.of(
            missing("CMPSC    16", "0100", 6, "CONRAD P", "pconrad@ucsb.edu"),
            missing("CMPSC   156", "0100", 2, "CONRAD P", "pconrad@ucsb.edu")),
        service.missing(Q));
  }

  @Test
  public void feedback_on_the_ula_row_of_a_course_with_a_ta_row_does_not_count() {
    // The form names a course by its TA row, so a row on the ULA id is not this course's.
    taRows.add(taught(2, 10, "CMPSC   156", "0100", "CONRAD P"));
    ulaRows.add(taught(5, 11, "CMPSC   156", "0100", "CONRAD P"));
    instructors(instructor("pconrad@ucsb.edu", "CONRAD P"));
    feedbackOnFile(feedback(7, "pconrad@ucsb.edu", 5).allocReasonable(true).build());

    assertEquals(1, service.missing(Q).size());
  }

  @Test
  public void an_instructor_with_no_email_is_listed_without_one_and_last() {
    taRows.add(taught(2, 10, "CMPSC   156", "0100", "NOBODY N"));
    ulaRows.add(taught(5, 11, "CMPSC   156", "0100", "CONRAD P"));
    ulaRows.add(taught(6, 11, "CMPSC   156", "0100", "ANON A"));
    // An Instructors entry whose catalog name is not chosen yet maps no one.
    instructors(instructor("pconrad@ucsb.edu", "CONRAD P"), instructor("x@ucsb.edu", null));
    feedbackOnFile();

    assertEquals(
        List.of(
            missing("CMPSC   156", "0100", 2, "CONRAD P", "pconrad@ucsb.edu"),
            missing("CMPSC   156", "0100", 2, "ANON A", null),
            missing("CMPSC   156", "0100", 2, "NOBODY N", null)),
        service.missing(Q));
  }

  @Test
  public void removed_rows_and_rows_with_no_instructor_are_not_listed() {
    taRows.add(taught(2, 10, "CMPSC   156", "0100", "CONRAD P").toBuilder().removed(true).build());
    taRows.add(taught(3, 10, "CMPSC   130A", "0100", null));
    instructors(instructor("pconrad@ucsb.edu", "CONRAD P"));
    feedbackOnFile();

    assertEquals(List.of(), service.missing(Q));
  }

  @Test
  public void a_quarter_without_recruitments_lists_no_one() {
    when(recruitmentRepository.findByQuarterAndType(Q, RecruitmentType.TA))
        .thenReturn(Optional.empty());
    when(recruitmentRepository.findByQuarterAndType(Q, RecruitmentType.ULA))
        .thenReturn(Optional.empty());
    instructors(instructor("pconrad@ucsb.edu", "CONRAD P"));
    feedbackOnFile();

    assertEquals(List.of(), service.missing(Q));
  }

  @Test
  public void the_list_is_by_course_id_then_section_nulls_first_then_email() {
    taRows.add(taught(1, 10, "CMPSC   8", "0100", "B B"));
    taRows.add(taught(2, 10, "CMPSC   156", "0200", "A A"));
    taRows.add(taught(3, 10, "CMPSC   156", null, "A A"));
    taRows.add(taught(4, 10, "CMPSC   156", "0100", "A A"));
    ulaRows.add(taught(5, 11, "CMPSC   156", "0100", "B B"));
    instructors(instructor("z@ucsb.edu", "A A"), instructor("y@ucsb.edu", "B B"));
    feedbackOnFile();

    assertEquals(
        List.of(
            missing("CMPSC   156", null, 3, "A A", "z@ucsb.edu"),
            missing("CMPSC   156", "0100", 4, "B B", "y@ucsb.edu"),
            missing("CMPSC   156", "0100", 4, "A A", "z@ucsb.edu"),
            missing("CMPSC   156", "0200", 2, "A A", "z@ucsb.edu"),
            missing("CMPSC   8", "0100", 1, "B B", "y@ucsb.edu")),
        service.missing(Q));
  }
}
