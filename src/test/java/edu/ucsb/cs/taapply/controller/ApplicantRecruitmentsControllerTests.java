package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.entity.TaMajor;
import edu.ucsb.cs.taapply.entity.TaTopic;
import edu.ucsb.cs.taapply.entity.UlaInterest;
import edu.ucsb.cs.taapply.entity.UlaMajor;
import edu.ucsb.cs.taapply.entity.UlaTopic;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.models.ApplicantRecruitmentDto;
import edu.ucsb.cs.taapply.models.CourseSections;
import edu.ucsb.cs.taapply.models.UcsbCourseOffering;
import edu.ucsb.cs.taapply.models.UcsbInstructor;
import edu.ucsb.cs.taapply.models.UcsbSection;
import edu.ucsb.cs.taapply.models.UcsbTimeLocation;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.repository.TaMajorRepository;
import edu.ucsb.cs.taapply.repository.TaTopicRepository;
import edu.ucsb.cs.taapply.repository.UlaInterestRepository;
import edu.ucsb.cs.taapply.repository.UlaMajorRepository;
import edu.ucsb.cs.taapply.repository.UlaTopicRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import edu.ucsb.cs.taapply.services.ApplicationAccessService;
import edu.ucsb.cs.taapply.services.UCSBCurriculumService;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@WebMvcTest(controllers = ApplicantRecruitmentsController.class)
@Import({edu.ucsb.cs.taapply.testconfig.TestConfig.class, ApplicationAccessService.class})
public class ApplicantRecruitmentsControllerTests extends ControllerTestCase {

  @MockitoBean RecruitmentRepository recruitmentRepository;
  @MockitoBean RecruitmentCourseRepository recruitmentCourseRepository;
  @MockitoBean UserRepository userRepository;
  @MockitoBean UCSBCurriculumService ucsbCurriculumService;
  @MockitoBean TaMajorRepository taMajorRepository;
  @MockitoBean TaTopicRepository taTopicRepository;
  @MockitoBean UlaMajorRepository ulaMajorRepository;
  @MockitoBean UlaTopicRepository ulaTopicRepository;
  @MockitoBean UlaInterestRepository ulaInterestRepository;

  private static Recruitment recruitment(
      long id,
      String quarter,
      RecruitmentType type,
      ApplicationStatus status,
      LocalDate opened,
      LocalDate closed) {
    return Recruitment.builder()
        .id(id)
        .quarter(quarter)
        .type(type)
        .applicationStatus(status)
        .tentativeOpeningDate(LocalDate.of(2026, 1, 5))
        .primaryConsiderationDate(LocalDate.of(2026, 1, 20))
        .actualOpeningDate(opened)
        .actualClosingDate(closed)
        .build();
  }

  private static final Recruitment OPEN_TA =
      recruitment(
          1L, "20262", RecruitmentType.TA, ApplicationStatus.OPEN, LocalDate.of(2026, 1, 5), null);
  private static final Recruitment OPEN_ULA =
      recruitment(
          2L, "20262", RecruitmentType.ULA, ApplicationStatus.OPEN, LocalDate.of(2026, 1, 5), null);
  private static final Recruitment UPCOMING_TA =
      recruitment(3L, "20263", RecruitmentType.TA, ApplicationStatus.CLOSED, null, null);
  private static final Recruitment CLOSED_TA =
      recruitment(
          4L,
          "20261",
          RecruitmentType.TA,
          ApplicationStatus.CLOSED,
          LocalDate.of(2025, 10, 1),
          LocalDate.of(2025, 11, 1));
  private static final Recruitment OLDER_CLOSED_TA =
      recruitment(
          5L,
          "20254",
          RecruitmentType.TA,
          ApplicationStatus.CLOSED,
          LocalDate.of(2025, 4, 1),
          LocalDate.of(2025, 5, 1));

  /** Descending by quarter, as the repository method promises. */
  private void seedAll() {
    when(recruitmentRepository.findAllByOrderByQuarterDescTypeAsc())
        .thenReturn(List.of(UPCOMING_TA, OPEN_TA, OPEN_ULA, CLOSED_TA, OLDER_CLOSED_TA));
  }

  private String getJson(String url) throws Exception {
    MvcResult response = mockMvc.perform(get(url)).andExpect(status().isOk()).andReturn();
    return response.getResponse().getContentAsString();
  }

  private String applicantJson(List<Recruitment> recruitments) throws Exception {
    return mapper.writeValueAsString(
        recruitments.stream().map(ApplicantRecruitmentDto::from).toList());
  }

  // ---- authorization ----

  @Test
  public void logged_out_users_get_nothing() throws Exception {
    mockMvc.perform(get("/api/recruitments/open")).andExpect(status().is(403));
    mockMvc.perform(get("/api/recruitments/upcoming")).andExpect(status().is(403));
    mockMvc.perform(get("/api/recruitments/recentlyClosed")).andExpect(status().is(403));
  }

  // ---- open ----

  /** Both types are open, and a signed-in user sees both; each carries its type. */
  @WithMockUser(roles = {"USER"})
  @Test
  public void a_signed_in_user_sees_every_open_recruitment_of_either_type() throws Exception {
    seedAll();

    assertEquals(applicantJson(List.of(OPEN_TA, OPEN_ULA)), getJson("/api/recruitments/open"));
  }

  /** Admins and instructors hold ROLE_USER too, so the same answer comes back for them. */
  @WithMockUser(roles = {"USER", "ADMIN", "INSTRUCTOR"})
  @Test
  public void an_admin_or_instructor_sees_the_same_recruitments() throws Exception {
    seedAll();

    assertEquals(applicantJson(List.of(OPEN_TA, OPEN_ULA)), getJson("/api/recruitments/open"));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void nothing_open_is_an_empty_list() throws Exception {
    when(recruitmentRepository.findAllByOrderByQuarterDescTypeAsc())
        .thenReturn(List.of(UPCOMING_TA, CLOSED_TA));

    assertEquals("[]", getJson("/api/recruitments/open"));
  }

  // ---- upcoming ----

  /** Created but never opened; the closed one that has opened before is not upcoming. */
  @WithMockUser(roles = {"USER"})
  @Test
  public void upcoming_is_the_closed_recruitment_that_has_never_opened() throws Exception {
    seedAll();

    assertEquals(applicantJson(List.of(UPCOMING_TA)), getJson("/api/recruitments/upcoming"));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void an_open_recruitment_is_not_upcoming() throws Exception {
    when(recruitmentRepository.findAllByOrderByQuarterDescTypeAsc()).thenReturn(List.of(OPEN_TA));

    assertEquals("[]", getJson("/api/recruitments/upcoming"));
  }

  // ---- recently closed ----

  /** Both TA rounds have closed; only the most recent quarter is reported. */
  @WithMockUser(roles = {"USER"})
  @Test
  public void recently_closed_reports_only_the_most_recent() throws Exception {
    seedAll();

    assertEquals(applicantJson(List.of(CLOSED_TA)), getJson("/api/recruitments/recentlyClosed"));
  }

  /** One per type: the last TA round and the last ULA round, each the most recent of its kind. */
  @WithMockUser(roles = {"USER"})
  @Test
  public void recently_closed_reports_the_most_recent_of_each_type() throws Exception {
    Recruitment closedUla =
        recruitment(
            7L,
            "20254",
            RecruitmentType.ULA,
            ApplicationStatus.CLOSED,
            LocalDate.of(2025, 4, 1),
            LocalDate.of(2025, 5, 1));
    Recruitment olderClosedUla =
        recruitment(
            8L,
            "20253",
            RecruitmentType.ULA,
            ApplicationStatus.CLOSED,
            LocalDate.of(2025, 1, 1),
            LocalDate.of(2025, 2, 1));
    when(recruitmentRepository.findAllByOrderByQuarterDescTypeAsc())
        .thenReturn(List.of(CLOSED_TA, OLDER_CLOSED_TA, closedUla, olderClosedUla));

    assertEquals(
        applicantJson(List.of(CLOSED_TA, closedUla)), getJson("/api/recruitments/recentlyClosed"));
  }

  /** A recruitment that has never opened has never closed either. */
  @WithMockUser(roles = {"USER"})
  @Test
  public void a_never_opened_recruitment_is_not_recently_closed() throws Exception {
    when(recruitmentRepository.findAllByOrderByQuarterDescTypeAsc())
        .thenReturn(List.of(UPCOMING_TA));

    assertEquals("[]", getJson("/api/recruitments/recentlyClosed"));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void an_open_recruitment_is_not_recently_closed() throws Exception {
    when(recruitmentRepository.findAllByOrderByQuarterDescTypeAsc()).thenReturn(List.of(OPEN_TA));

    assertEquals("[]", getJson("/api/recruitments/recentlyClosed"));
  }

  /**
   * A reopened recruitment still carries the closing date of its earlier round, so having closed
   * once is not enough to report it as closed now.
   */
  @WithMockUser(roles = {"USER"})
  @Test
  public void a_reopened_recruitment_is_not_recently_closed() throws Exception {
    Recruitment reopened =
        recruitment(
            6L,
            "20262",
            RecruitmentType.TA,
            ApplicationStatus.OPEN,
            LocalDate.of(2026, 1, 5),
            LocalDate.of(2026, 1, 25));
    when(recruitmentRepository.findAllByOrderByQuarterDescTypeAsc()).thenReturn(List.of(reopened));

    assertEquals("[]", getJson("/api/recruitments/recentlyClosed"));
  }

  // ---- applicable ----

  /** Everything, whatever its type or state, so a user's own applications can be labelled. */
  @WithMockUser(roles = {"USER"})
  @Test
  public void applicable_is_every_recruitment() throws Exception {
    seedAll();

    assertEquals(
        applicantJson(List.of(UPCOMING_TA, OPEN_TA, OPEN_ULA, CLOSED_TA, OLDER_CLOSED_TA)),
        getJson("/api/recruitments/applicable"));
  }

  @Test
  public void logged_out_users_cannot_read_applicable_recruitments() throws Exception {
    mockMvc.perform(get("/api/recruitments/applicable")).andExpect(status().is(403));
  }

  // ---- course choices ----

  private static RecruitmentCourse course(long id, String courseId, boolean removed) {
    return RecruitmentCourse.builder()
        .id(id)
        .recruitmentId(1L)
        .courseId(courseId)
        .enrollCode("EC" + id)
        .removed(removed)
        .build();
  }

  /**
   * A course with two lectures is two rows in the recruitment but one choice on the form, and a
   * removed row is not on offer at all.
   */
  @WithMockUser(roles = {"USER"})
  @Test
  public void course_choices_are_distinct_sorted_and_exclude_removed_and_stale() throws Exception {
    when(recruitmentRepository.existsById(1L)).thenReturn(true);
    // Issue #122: a stale row is as good as removed for an applicant.
    RecruitmentCourse stale = course(5L, "CMPSC    16", false);
    stale.setStale(true);
    when(recruitmentCourseRepository.findByRecruitmentId(1L))
        .thenReturn(
            List.of(
                course(1L, "CMPSC   156", false),
                course(2L, "CMPSC   156", false),
                course(3L, "CMPSC     8", false),
                course(4L, "CMPSC   130A", true),
                stale));

    assertEquals(
        mapper.writeValueAsString(List.of("CMPSC     8", "CMPSC   156")),
        getJson("/api/recruitments/courses?recruitmentId=1"));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void course_choices_are_empty_for_a_recruitment_that_does_not_exist() throws Exception {
    when(recruitmentRepository.existsById(99L)).thenReturn(false);

    assertEquals("[]", getJson("/api/recruitments/courses?recruitmentId=99"));
    verify(recruitmentCourseRepository, never()).findByRecruitmentId(any());
  }

  private static RecruitmentCourse withStatus(long id, String courseId, String status) {
    RecruitmentCourse c = course(id, courseId, false);
    c.setEnrollCode("0" + id);
    c.setStatus(status);
    return c;
  }

  /** Issue #123: a course is dropped only when all of its lectures are cancelled. */
  @WithMockUser(roles = {"USER"})
  @Test
  public void a_course_whose_every_lecture_is_cancelled_is_not_offered() throws Exception {
    when(recruitmentRepository.existsById(1L)).thenReturn(true);
    when(recruitmentCourseRepository.findByRecruitmentId(1L))
        .thenReturn(
            List.of(
                withStatus(1L, "CMPSC   156", "cancelled"),
                withStatus(2L, "CMPSC   156", "open"),
                withStatus(3L, "CMPSC     8", "cancelled"),
                withStatus(4L, "CMPSC    16", "closed"),
                withStatus(5L, "CMPSC    24", null)));

    assertEquals(
        mapper.writeValueAsString(List.of("CMPSC    16", "CMPSC    24", "CMPSC   156")),
        getJson("/api/recruitments/courses?recruitmentId=1"));
  }

  /** The section lookup goes by a lecture still on offer, not a cancelled one. */
  @WithMockUser(roles = {"USER"})
  @Test
  public void section_times_skip_a_cancelled_lecture() throws Exception {
    seedAll();
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));
    RecruitmentCourse cancelled = withStatus(1L, "CMPSC   156", "cancelled");
    cancelled.setEnrollCode("00001");
    RecruitmentCourse open = withStatus(2L, "CMPSC   156", "open");
    open.setEnrollCode("07492");
    when(recruitmentCourseRepository.findByRecruitmentId(1L)).thenReturn(List.of(cancelled, open));
    when(ucsbCurriculumService.getOffering("20262", "07492")).thenReturn(offering());

    sectionsJson(1L);

    verify(ucsbCurriculumService).getOffering("20262", "07492");
    verify(ucsbCurriculumService, never()).getOffering("20262", "00001");
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void a_course_with_only_a_cancelled_lecture_has_no_section_times() throws Exception {
    seedAll();
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));
    RecruitmentCourse cancelled = withStatus(1L, "CMPSC   156", "cancelled");
    cancelled.setEnrollCode("07492");
    when(recruitmentCourseRepository.findByRecruitmentId(1L)).thenReturn(List.of(cancelled));

    assertEquals(
        mapper.writeValueAsString(CourseSections.none("CMPSC   156", "20262")), sectionsJson(1L));
    verify(ucsbCurriculumService, never()).getOffering(any(), any());
  }

  @Test
  public void logged_out_users_cannot_read_course_choices() throws Exception {
    mockMvc.perform(get("/api/recruitments/courses?recruitmentId=1")).andExpect(status().is(403));
  }

  // ---- course instructors (issue #121) ----

  private static RecruitmentCourse taught(
      long id, String courseId, String instructor, boolean removed) {
    RecruitmentCourse c = course(id, courseId, removed);
    c.setInstructor(instructor);
    return c;
  }

  /** Two lectures with different instructors are joined; removed rows and blanks are left out. */
  @WithMockUser(roles = {"USER"})
  @Test
  public void course_instructors_are_joined_distinct_sorted_and_exclude_removed_and_blank()
      throws Exception {
    when(recruitmentRepository.existsById(1L)).thenReturn(true);
    when(recruitmentCourseRepository.findByRecruitmentId(1L))
        .thenReturn(
            List.of(
                taught(1L, "CMPSC   156", "GAUCHO C", false),
                taught(2L, "CMPSC   156", " CONRAD P ", false),
                taught(3L, "CMPSC   156", "CONRAD P", false),
                taught(4L, "CMPSC     8", null, false),
                taught(5L, "CMPSC    16", "  ", false),
                taught(6L, "CMPSC   130A", "REMOVED R", true)));

    assertEquals(
        "{\"CMPSC   156\":\"CONRAD P, GAUCHO C\"}",
        getJson("/api/recruitments/instructors?recruitmentId=1"));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void course_instructors_are_empty_for_a_recruitment_that_does_not_exist()
      throws Exception {
    when(recruitmentRepository.existsById(99L)).thenReturn(false);

    assertEquals("{}", getJson("/api/recruitments/instructors?recruitmentId=99"));
    verify(recruitmentCourseRepository, never()).findByRecruitmentId(any());
  }

  @Test
  public void logged_out_users_cannot_read_course_instructors() throws Exception {
    mockMvc
        .perform(get("/api/recruitments/instructors?recruitmentId=1"))
        .andExpect(status().is(403));
  }

  // ---- section times ----

  private static UcsbCourseOffering offering() {
    return UcsbCourseOffering.builder()
        .courseId("CMPSC   156")
        .title("ADV APP PROGRAM")
        .classSections(
            List.of(
                UcsbSection.builder()
                    .enrollCode("07492")
                    .section("0100")
                    .timeLocations(
                        List.of(
                            UcsbTimeLocation.builder()
                                .days("T R")
                                .beginTime("14:00")
                                .endTime("15:15")
                                .building("PHELP")
                                .room("3526")
                                .build()))
                    .instructors(List.of(UcsbInstructor.builder().instructor("CONRAD P").build()))
                    .build(),
                UcsbSection.builder()
                    .enrollCode("07500")
                    .section("0101")
                    .timeLocations(
                        List.of(
                            UcsbTimeLocation.builder()
                                .days("W")
                                .beginTime("09:00")
                                .endTime("09:50")
                                .building("PHELP")
                                .room("1401")
                                .build()))
                    .instructors(List.of(UcsbInstructor.builder().instructor("GAUCHO C").build()))
                    .build()))
        .build();
  }

  /** The padded course id goes as a parameter; MockMvc would not decode it from the URL. */
  private static MockHttpServletRequestBuilder sectionsRequest(long recruitmentId) {
    return get("/api/recruitments/sections")
        .param("recruitmentId", String.valueOf(recruitmentId))
        .param("courseId", "CMPSC   156");
  }

  private String sectionsJson(long recruitmentId) throws Exception {
    return mockMvc
        .perform(sectionsRequest(recruitmentId))
        .andExpect(status().isOk())
        .andReturn()
        .getResponse()
        .getContentAsString();
  }

  /**
   * The lowest enroll code of the course's lectures is looked up; a removed row and other courses
   * play no part. The answer is the offering's sections, lectures flagged, in section order.
   */
  @WithMockUser(roles = {"USER"})
  @Test
  public void section_times_come_from_the_ucsb_api_via_the_lowest_lecture_enroll_code()
      throws Exception {
    seedAll();
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));
    RecruitmentCourse removed = course(1L, "CMPSC   156", true);
    removed.setEnrollCode("00001");
    RecruitmentCourse second = course(2L, "CMPSC   156", false);
    second.setEnrollCode("07600");
    RecruitmentCourse first = course(3L, "CMPSC   156", false);
    first.setEnrollCode("07492");
    RecruitmentCourse other = course(4L, "CMPSC     8", false);
    other.setEnrollCode("00002");
    when(recruitmentCourseRepository.findByRecruitmentId(1L))
        .thenReturn(List.of(removed, second, first, other));
    when(ucsbCurriculumService.getOffering("20262", "07492")).thenReturn(offering());

    CourseSections expected =
        new CourseSections(
            "CMPSC   156",
            "20262",
            "ADV APP PROGRAM",
            List.of(
                new CourseSections.Meeting(
                    "0100", true, "07492", "T R", "14:00", "15:15", "PHELP 3526", "CONRAD P"),
                new CourseSections.Meeting(
                    "0101", false, "07500", "W", "09:00", "09:50", "PHELP 1401", "GAUCHO C")));

    assertEquals(mapper.writeValueAsString(expected), sectionsJson(1L));
    verify(ucsbCurriculumService).getOffering("20262", "07492");
  }

  /** An admin previewing the form is a signed-in user like any other here. */
  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void an_admin_can_read_section_times_for_any_recruitment() throws Exception {
    seedAll();
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));
    RecruitmentCourse row = course(3L, "CMPSC   156", false);
    row.setEnrollCode("07492");
    when(recruitmentCourseRepository.findByRecruitmentId(1L)).thenReturn(List.of(row));
    when(ucsbCurriculumService.getOffering("20262", "07492")).thenReturn(offering());

    String json = sectionsJson(1L);
    assertEquals(
        mapper.writeValueAsString(CourseSections.from("CMPSC   156", "20262", offering())), json);
  }

  /** A course the recruitment does not list is answered with no meetings, and no API call. */
  @WithMockUser(roles = {"USER"})
  @Test
  public void a_course_not_in_the_recruitment_has_no_section_times() throws Exception {
    seedAll();
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));
    RecruitmentCourse removed = course(1L, "CMPSC   156", true);
    removed.setEnrollCode("07492");
    // Issue #122: a stale lecture is not looked up either.
    RecruitmentCourse stale = course(2L, "CMPSC   156", false);
    stale.setEnrollCode("07600");
    stale.setStale(true);
    when(recruitmentCourseRepository.findByRecruitmentId(1L)).thenReturn(List.of(removed, stale));

    assertEquals(
        mapper.writeValueAsString(CourseSections.none("CMPSC   156", "20262")), sectionsJson(1L));
    verify(ucsbCurriculumService, never()).getOffering(any(), any());
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void section_times_for_a_missing_recruitment_are_a_404() throws Exception {
    seedAll();
    when(recruitmentRepository.findById(99L)).thenReturn(Optional.empty());

    mockMvc.perform(sectionsRequest(99L)).andExpect(status().is(404));
    verify(ucsbCurriculumService, never()).getOffering(any(), any());
  }

  @Test
  public void logged_out_users_cannot_read_section_times() throws Exception {
    mockMvc.perform(sectionsRequest(1L)).andExpect(status().is(403));
  }

  // ---- options: the majors and topics lists ----

  private void seedLists() {
    when(taMajorRepository.findAll())
        .thenReturn(
            List.of(
                TaMajor.builder().name("Statistics").build(),
                TaMajor.builder().name("computer engineering").build(),
                TaMajor.builder().name("Computer Science").build()));
    when(taTopicRepository.findAll())
        .thenReturn(
            List.of(
                TaTopic.builder().name("Python").build(), TaTopic.builder().name("Java").build()));
    when(ulaMajorRepository.findAll()).thenReturn(List.of(UlaMajor.builder().name("Math").build()));
    when(ulaTopicRepository.findAll())
        .thenReturn(List.of(UlaTopic.builder().name("Web Development").build()));
    when(ulaInterestRepository.findAll())
        .thenReturn(
            List.of(
                UlaInterest.builder().name("Tutoring").build(),
                UlaInterest.builder().name("grading").build()));
  }

  /** A TA recruitment offers the TA lists, sorted case-insensitively. */
  @WithMockUser(roles = {"USER"})
  @Test
  public void options_for_a_ta_recruitment_are_the_ta_lists_sorted() throws Exception {
    seedLists();
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));

    assertEquals(
        mapper.writeValueAsString(
            new ApplicantRecruitmentsController.ApplicationOptions(
                List.of("computer engineering", "Computer Science", "Statistics"),
                List.of("Java", "Python"),
                List.of())),
        getJson("/api/recruitments/options?recruitmentId=1"));
    verify(ulaMajorRepository, never()).findAll();
    verify(ulaTopicRepository, never()).findAll();
    // A TA form has no interests section, so the list is not even read.
    verify(ulaInterestRepository, never()).findAll();
  }

  /** A ULA recruitment offers the ULA lists, and an admin may ask for any recruitment's lists. */
  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void options_for_a_ula_recruitment_are_the_ula_lists() throws Exception {
    seedLists();
    when(recruitmentRepository.findById(2L)).thenReturn(Optional.of(OPEN_ULA));

    assertEquals(
        mapper.writeValueAsString(
            new ApplicantRecruitmentsController.ApplicationOptions(
                List.of("Math"), List.of("Web Development"), List.of("grading", "Tutoring"))),
        getJson("/api/recruitments/options?recruitmentId=2"));
    verify(taMajorRepository, never()).findAll();
    verify(taTopicRepository, never()).findAll();
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void options_for_an_unknown_recruitment_are_a_404() throws Exception {
    when(recruitmentRepository.findById(99L)).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(get("/api/recruitments/options?recruitmentId=99"))
            .andExpect(status().is(404))
            .andReturn();
    assertEquals("Recruitment with id 99 not found", responseToJson(response).get("message"));
  }

  @Test
  public void logged_out_users_cannot_read_options() throws Exception {
    mockMvc.perform(get("/api/recruitments/options?recruitmentId=1")).andExpect(status().is(403));
  }
}
