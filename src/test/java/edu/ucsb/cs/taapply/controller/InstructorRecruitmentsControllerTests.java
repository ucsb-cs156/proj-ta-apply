package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.controller.InstructorRecruitmentsController.InstructorRecruitment;
import edu.ucsb.cs.taapply.entity.Instructor;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.InstructorRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(controllers = InstructorRecruitmentsController.class)
@Import(edu.ucsb.cs.taapply.testconfig.TestConfig.class)
public class InstructorRecruitmentsControllerTests extends ControllerTestCase {

  @MockitoBean InstructorRepository instructorRepository;
  @MockitoBean RecruitmentRepository recruitmentRepository;
  @MockitoBean RecruitmentCourseRepository recruitmentCourseRepository;
  @MockitoBean UserRepository userRepository;

  private static final String EMAIL = "pconrad@ucsb.edu";
  private static final String URL = "/api/instructor/recruitments?email=" + EMAIL;

  private static Recruitment recruitment(long id, String quarter, RecruitmentType type) {
    return Recruitment.builder()
        .id(id)
        .quarter(quarter)
        .type(type)
        .applicationStatus(ApplicationStatus.OPEN)
        .tentativeOpeningDate(LocalDate.of(2026, 1, 5))
        .primaryConsiderationDate(LocalDate.of(2026, 1, 20))
        .actualOpeningDate(LocalDate.of(2026, 1, 6))
        .actualClosingDate(null)
        .build();
  }

  private static RecruitmentCourse row(
      long id, long recruitmentId, String courseId, String section, boolean removed) {
    return RecruitmentCourse.builder()
        .id(id)
        .recruitmentId(recruitmentId)
        .courseId(courseId)
        .section(section)
        .enrollCode("0" + id)
        .title("TITLE " + id)
        .instructor("CONRAD P")
        .removed(removed)
        .build();
  }

  private void instructorWithCatalogName(String catalogName) {
    when(instructorRepository.findByEmail(EMAIL))
        .thenReturn(
            Optional.of(Instructor.builder().email(EMAIL).catalogName(catalogName).build()));
  }

  @Test
  public void logged_out_users_cannot_ask() throws Exception {
    mockMvc.perform(get(URL)).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void plain_users_cannot_ask() throws Exception {
    mockMvc.perform(get(URL)).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void an_email_that_is_not_an_instructor_gets_an_empty_list() throws Exception {
    when(instructorRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());

    MvcResult response = mockMvc.perform(get(URL)).andExpect(status().isOk()).andReturn();

    assertEquals("[]", response.getResponse().getContentAsString());
    verify(recruitmentCourseRepository, never()).findByInstructor(any());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void an_instructor_without_a_catalog_name_yet_gets_an_empty_list() throws Exception {
    instructorWithCatalogName(null);

    MvcResult response = mockMvc.perform(get(URL)).andExpect(status().isOk()).andReturn();

    assertEquals("[]", response.getResponse().getContentAsString());
    verify(recruitmentCourseRepository, never()).findByInstructor(any());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void a_catalog_name_with_no_course_rows_gets_an_empty_list() throws Exception {
    instructorWithCatalogName("CONRAD P");
    when(recruitmentCourseRepository.findByInstructor("CONRAD P")).thenReturn(List.of());

    MvcResult response = mockMvc.perform(get(URL)).andExpect(status().isOk()).andReturn();

    assertEquals("[]", response.getResponse().getContentAsString());
    verify(recruitmentRepository, never()).findAllById(any());
  }

  /** Only removed rows is the same as none: no recruitment is listed for them. */
  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void removed_rows_do_not_count() throws Exception {
    instructorWithCatalogName("CONRAD P");
    when(recruitmentCourseRepository.findByInstructor("CONRAD P"))
        .thenReturn(List.of(row(1L, 10L, "CMPSC   156", "0100", true)));

    MvcResult response = mockMvc.perform(get(URL)).andExpect(status().isOk()).andReturn();

    assertEquals("[]", response.getResponse().getContentAsString());
    verify(recruitmentRepository, never()).findAllById(any());
  }

  /**
   * Rows across three recruitments: the newest quarter first and TA before ULA within a quarter,
   * each with its courses in course-then-section order, removed rows left out.
   */
  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void an_instructor_gets_their_recruitments_newest_first_with_courses_in_order()
      throws Exception {
    instructorWithCatalogName("CONRAD P");
    RecruitmentCourse ula156 = row(1L, 12L, "CMPSC   156", "0100", false);
    RecruitmentCourse ta156b = row(2L, 11L, "CMPSC   156", "0200", false);
    RecruitmentCourse ta156a = row(3L, 11L, "CMPSC   156", "0100", false);
    RecruitmentCourse ta8 = row(4L, 11L, "CMPSC     8", null, false);
    RecruitmentCourse removed = row(5L, 11L, "CMPSC     1A", "0100", true);
    RecruitmentCourse old = row(6L, 10L, "CMPSC   156", "0100", false);
    when(recruitmentCourseRepository.findByInstructor("CONRAD P"))
        .thenReturn(List.of(ula156, ta156b, ta156a, ta8, removed, old));
    Recruitment oldTa = recruitment(10L, "20254", RecruitmentType.TA);
    Recruitment ta = recruitment(11L, "20261", RecruitmentType.TA);
    Recruitment ula = recruitment(12L, "20261", RecruitmentType.ULA);
    when(recruitmentRepository.findAllById(Set.of(10L, 11L, 12L)))
        .thenReturn(List.of(ula, oldTa, ta));

    MvcResult response = mockMvc.perform(get(URL)).andExpect(status().isOk()).andReturn();

    List<InstructorRecruitment> expected =
        List.of(
            InstructorRecruitment.of(ta, List.of(ta8, ta156a, ta156b)),
            InstructorRecruitment.of(ula, List.of(ula156)),
            InstructorRecruitment.of(oldTa, List.of(old)));
    assertEquals(mapper.writeValueAsString(expected), response.getResponse().getContentAsString());
  }

  /** The record carries every field the recruitment cards show. */
  @Test
  public void the_record_copies_the_recruitment_fields() {
    Recruitment r =
        Recruitment.builder()
            .id(3L)
            .quarter("20262")
            .type(RecruitmentType.ULA)
            .applicationStatus(ApplicationStatus.CLOSED)
            .tentativeOpeningDate(LocalDate.of(2026, 3, 30))
            .primaryConsiderationDate(LocalDate.of(2026, 4, 15))
            .actualOpeningDate(LocalDate.of(2026, 4, 1))
            .actualClosingDate(LocalDate.of(2026, 5, 1))
            .reviewStatus("Open")
            .facultyReviewOpeningDate(LocalDate.of(2026, 4, 2))
            .facultyRankingDeadline(LocalDate.of(2026, 4, 20))
            .build();
    RecruitmentCourse course = row(9L, 3L, "CMPSC    16", "0100", false);

    InstructorRecruitment ir = InstructorRecruitment.of(r, List.of(course));

    // Each accessor, since the JSON comes from them rather than from equals().
    assertEquals(3L, ir.id());
    assertEquals("20262", ir.quarter());
    assertEquals(RecruitmentType.ULA, ir.type());
    assertEquals(ApplicationStatus.CLOSED, ir.applicationStatus());
    assertEquals(LocalDate.of(2026, 3, 30), ir.tentativeOpeningDate());
    assertEquals(LocalDate.of(2026, 4, 15), ir.primaryConsiderationDate());
    assertEquals(LocalDate.of(2026, 4, 1), ir.actualOpeningDate());
    assertEquals(LocalDate.of(2026, 5, 1), ir.actualClosingDate());
    assertEquals("Open", ir.reviewStatus());
    assertEquals(LocalDate.of(2026, 4, 2), ir.facultyReviewOpeningDate());
    assertEquals(LocalDate.of(2026, 4, 20), ir.facultyRankingDeadline());
    assertEquals(List.of(course), ir.courses());
    assertEquals(
        new InstructorRecruitment(
            3L,
            "20262",
            RecruitmentType.ULA,
            ApplicationStatus.CLOSED,
            LocalDate.of(2026, 3, 30),
            LocalDate.of(2026, 4, 15),
            LocalDate.of(2026, 4, 1),
            LocalDate.of(2026, 5, 1),
            "Open",
            LocalDate.of(2026, 4, 2),
            LocalDate.of(2026, 4, 20),
            List.of(course)),
        ir);
  }

  /** Admins may look an instructor up too, for support. */
  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_admin_can_ask_about_an_instructor() throws Exception {
    instructorWithCatalogName("CONRAD P");
    RecruitmentCourse one = row(1L, 11L, "CMPSC   156", "0100", false);
    when(recruitmentCourseRepository.findByInstructor("CONRAD P")).thenReturn(List.of(one));
    Recruitment ta = recruitment(11L, "20261", RecruitmentType.TA);
    when(recruitmentRepository.findAllById(Set.of(11L))).thenReturn(List.of(ta));

    MvcResult response = mockMvc.perform(get(URL)).andExpect(status().isOk()).andReturn();

    assertEquals(
        mapper.writeValueAsString(List.of(InstructorRecruitment.of(ta, List.of(one)))),
        response.getResponse().getContentAsString());
  }
}
