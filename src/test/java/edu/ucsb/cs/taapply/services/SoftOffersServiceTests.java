package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.HiringRecord;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.entity.SoftOfferNoticeVersion;
import edu.ucsb.cs.taapply.entity.SoftOfferResponse;
import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import edu.ucsb.cs.taapply.enums.NewHireForm;
import edu.ucsb.cs.taapply.enums.OtherCampusJob;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.enums.SoftOfferDecision;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.errors.ForbiddenException;
import edu.ucsb.cs.taapply.models.HiringRecordDto;
import edu.ucsb.cs.taapply.models.SoftOfferDto;
import edu.ucsb.cs.taapply.models.UcsbCourseOffering;
import edu.ucsb.cs.taapply.models.UcsbSection;
import edu.ucsb.cs.taapply.models.UcsbTimeLocation;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.HiringRecordRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.repository.SoftOfferNoticeVersionRepository;
import edu.ucsb.cs.taapply.repository.SoftOfferResponseRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** Issue #486: which applications have an open soft offer, what it says, and answering it. */
@ExtendWith(MockitoExtension.class)
class SoftOffersServiceTests {
  @Mock ApplicationRepository applicationRepository;
  @Mock RecruitmentRepository recruitmentRepository;
  @Mock RecruitmentCourseRepository recruitmentCourseRepository;
  @Mock SoftOfferNoticeVersionRepository softOfferNoticeVersionRepository;
  @Mock SoftOfferResponseRepository softOfferResponseRepository;
  @Mock HiringRecordRepository hiringRecordRepository;
  @Mock PublishedAssignmentsService publishedAssignmentsService;
  @Mock UCSBCurriculumService ucsbCurriculumService;
  @Mock AssignmentsService assignmentsService;
  @InjectMocks SoftOffersService service;

  private static final String EMAIL = "cgaucho@ucsb.edu";
  private static final LocalDateTime RELEASED = LocalDateTime.of(2026, 11, 20, 9, 30);
  private static final LocalDateTime DEADLINE = LocalDateTime.of(2026, 11, 25, 17, 0);

  private static Recruitment ula(boolean released) {
    return Recruitment.builder()
        .id(2L)
        .quarter("20264")
        .type(RecruitmentType.ULA)
        .assignmentsPublished(true)
        .softOffersReleasedAt(released ? RELEASED : null)
        .softOfferDeadline(released ? DEADLINE : null)
        .build();
  }

  private static RecruitmentCourse lecture() {
    return RecruitmentCourse.builder()
        .id(10L)
        .recruitmentId(2L)
        .courseId("CMPSC   156")
        .section("0100")
        .enrollCode("07492")
        .title("ADV APP PROGRAM")
        .instructor("CONRAD P")
        .days("T R")
        .time("14:00 - 15:15")
        .build();
  }

  private static Application assigned() {
    return Application.builder()
        .id(5L)
        .recruitmentId(2L)
        .email(EMAIL)
        .status(ApplicationReviewStatus.PENDING)
        .tentativeAssignmentId(10L)
        .build();
  }

  private static UcsbSection section(String number, UcsbTimeLocation... times) {
    return UcsbSection.builder().section(number).timeLocations(List.of(times)).build();
  }

  private static UcsbTimeLocation at(String days, String begin, String end) {
    return UcsbTimeLocation.builder().days(days).beginTime(begin).endTime(end).build();
  }

  /** Everything in place for one open offer. */
  private void openOffer() {
    when(applicationRepository.findByEmailOrderByIdDesc(EMAIL)).thenReturn(List.of(assigned()));
    when(recruitmentRepository.findById(2L)).thenReturn(Optional.of(ula(true)));
    when(recruitmentCourseRepository.findById(10L)).thenReturn(Optional.of(lecture()));
  }

  // ---- mine ----

  @Test
  void mine_describes_the_lecture_its_sections_the_notice_and_the_answer_so_far() throws Exception {
    openOffer();
    when(publishedAssignmentsService.emailsByCatalogName())
        .thenReturn(Map.of("CONRAD P", "phtcon@ucsb.edu"));
    when(softOfferNoticeVersionRepository.findFirstByOrderByIdDesc())
        .thenReturn(
            Optional.of(SoftOfferNoticeVersion.builder().id(3L).content("# Welcome").build()));
    when(softOfferResponseRepository.findByApplicationIdAndRecruitmentCourseId(5L, 10L))
        .thenReturn(
            Optional.of(
                SoftOfferResponse.builder()
                    .decision(SoftOfferDecision.PROCEED)
                    .comments("Thanks")
                    .respondedAt(LocalDateTime.of(2026, 11, 21, 8, 0))
                    .build()));
    // The lecture itself, a section with two meetings, one with none, and the other lecture's.
    when(ucsbCurriculumService.getOffering("20264", "07492"))
        .thenReturn(
            UcsbCourseOffering.builder()
                .classSections(
                    List.of(
                        section("0102", at("F", "09:00", "09:50")),
                        section("0100", at("T R", "14:00", "15:15")),
                        section("0101", at("W", "09:00", "09:50"), at("W", "10:00", "10:50")),
                        section("0103"),
                        section("0201", at("M", "09:00", "09:50"))))
                .build());

    List<SoftOfferDto> offers = service.mine(EMAIL);

    assertEquals(1, offers.size());
    SoftOfferDto offer = offers.get(0);
    assertEquals(2L, offer.recruitmentId());
    assertEquals("20264", offer.quarter());
    assertEquals(5L, offer.applicationId());
    assertEquals(RELEASED, offer.releasedAt());
    assertEquals(DEADLINE, offer.deadline());
    assertEquals(new SoftOfferDto.Notice(3L, "# Welcome"), offer.notice());
    assertEquals(
        new SoftOfferDto.Course(
            10L,
            "CMPSC 156",
            "0100",
            "ADV APP PROGRAM",
            "CONRAD P",
            "phtcon@ucsb.edu",
            "T R",
            "14:00",
            "15:15"),
        offer.course());
    assertEquals(
        List.of(
            new SoftOfferDto.Meeting("0101", "W", "09:00", "09:50"),
            new SoftOfferDto.Meeting("0101", "W", "10:00", "10:50"),
            new SoftOfferDto.Meeting("0102", "F", "09:00", "09:50"),
            new SoftOfferDto.Meeting("0103", null, null, null)),
        offer.sections());
    assertEquals(
        new SoftOfferDto.Response(
            SoftOfferDecision.PROCEED, "Thanks", LocalDateTime.of(2026, 11, 21, 8, 0)),
        offer.response());
  }

  @Test
  void mine_copes_with_no_notice_no_answer_no_instructor_email_no_times_and_an_api_failure()
      throws Exception {
    RecruitmentCourse bare = lecture();
    bare.setTime(null);
    bare.setInstructor(null);
    when(applicationRepository.findByEmailOrderByIdDesc(EMAIL)).thenReturn(List.of(assigned()));
    when(recruitmentRepository.findById(2L)).thenReturn(Optional.of(ula(true)));
    when(recruitmentCourseRepository.findById(10L)).thenReturn(Optional.of(bare));
    when(publishedAssignmentsService.emailsByCatalogName()).thenReturn(Map.of());
    when(softOfferNoticeVersionRepository.findFirstByOrderByIdDesc()).thenReturn(Optional.empty());
    when(softOfferResponseRepository.findByApplicationIdAndRecruitmentCourseId(5L, 10L))
        .thenReturn(Optional.empty());
    when(ucsbCurriculumService.getOffering("20264", "07492"))
        .thenThrow(new RuntimeException("down"));

    SoftOfferDto offer = service.mine(EMAIL).get(0);

    assertNull(offer.notice());
    assertNull(offer.response());
    assertNull(offer.sections());
    assertNull(offer.course().instructor());
    assertNull(offer.course().instructorEmail());
    assertNull(offer.course().beginTime());
    assertNull(offer.course().endTime());
  }

  @Test
  void a_one_digit_lecture_number_keeps_every_section_too_and_a_blank_end_is_null()
      throws Exception {
    RecruitmentCourse odd = lecture();
    odd.setTime("09:00 - ");
    odd.setSection("1");
    when(ucsbCurriculumService.getOffering("20264", "07492"))
        .thenReturn(
            UcsbCourseOffering.builder()
                .classSections(
                    List.of(
                        section("0201", at("M", "09:00", "09:50")),
                        UcsbSection.builder().section("0104").timeLocations(null).build()))
                .build());
    when(applicationRepository.findByEmailOrderByIdDesc(EMAIL)).thenReturn(List.of(assigned()));
    when(recruitmentRepository.findById(2L)).thenReturn(Optional.of(ula(true)));
    when(recruitmentCourseRepository.findById(10L)).thenReturn(Optional.of(odd));
    when(publishedAssignmentsService.emailsByCatalogName()).thenReturn(Map.of());
    when(softOfferNoticeVersionRepository.findFirstByOrderByIdDesc()).thenReturn(Optional.empty());
    when(softOfferResponseRepository.findByApplicationIdAndRecruitmentCourseId(5L, 10L))
        .thenReturn(Optional.empty());

    SoftOfferDto offer = service.mine(EMAIL).get(0);

    assertEquals("09:00", offer.course().beginTime());
    assertNull(offer.course().endTime());
    assertEquals(
        List.of(
            new SoftOfferDto.Meeting("0104", null, null, null),
            new SoftOfferDto.Meeting("0201", "M", "09:00", "09:50")),
        offer.sections());
  }

  @Test
  void a_two_digit_lecture_number_is_enough_to_tell_its_sections_apart() throws Exception {
    RecruitmentCourse odd = lecture();
    odd.setSection("01");
    when(ucsbCurriculumService.getOffering("20264", "07492"))
        .thenReturn(
            UcsbCourseOffering.builder()
                .classSections(
                    List.of(
                        section("0201", at("M", "09:00", "09:50")),
                        // A section with no number cannot be matched to a lecture: left out.
                        UcsbSection.builder().section(null).build(),
                        section("0101", at("W", "09:00", "09:50"))))
                .build());

    assertEquals(
        List.of(new SoftOfferDto.Meeting("0101", "W", "09:00", "09:50")),
        service.sectionsOf("20264", odd));
  }

  @Test
  void a_time_with_only_a_start_has_no_end_and_a_lecture_with_no_section_keeps_every_section()
      throws Exception {
    RecruitmentCourse odd = lecture();
    odd.setTime("09:00");
    odd.setSection(null);
    when(applicationRepository.findByEmailOrderByIdDesc(EMAIL)).thenReturn(List.of(assigned()));
    when(recruitmentRepository.findById(2L)).thenReturn(Optional.of(ula(true)));
    when(recruitmentCourseRepository.findById(10L)).thenReturn(Optional.of(odd));
    when(publishedAssignmentsService.emailsByCatalogName()).thenReturn(Map.of());
    when(softOfferNoticeVersionRepository.findFirstByOrderByIdDesc()).thenReturn(Optional.empty());
    when(softOfferResponseRepository.findByApplicationIdAndRecruitmentCourseId(5L, 10L))
        .thenReturn(Optional.empty());
    when(ucsbCurriculumService.getOffering("20264", "07492"))
        .thenReturn(
            UcsbCourseOffering.builder()
                .classSections(
                    List.of(
                        section("0201", at("M", "09:00", "09:50")),
                        UcsbSection.builder().section(null).build(),
                        section("0101", at("W", "09:00", "09:50"))))
                .build());

    SoftOfferDto offer = service.mine(EMAIL).get(0);

    assertEquals("09:00", offer.course().beginTime());
    assertNull(offer.course().endTime());
    assertEquals(
        List.of(
            new SoftOfferDto.Meeting(null, null, null, null),
            new SoftOfferDto.Meeting("0101", "W", "09:00", "09:50"),
            new SoftOfferDto.Meeting("0201", "M", "09:00", "09:50")),
        offer.sections());
  }

  @Test
  void an_offering_with_no_sections_at_all_gives_an_empty_list() throws Exception {
    when(ucsbCurriculumService.getOffering("20264", "07492"))
        .thenReturn(UcsbCourseOffering.builder().classSections(null).build());
    assertEquals(List.of(), service.sectionsOf("20264", lecture()));
  }

  @Test
  void mine_skips_applications_without_an_offer_and_asks_for_the_emails_and_notice_once()
      throws Exception {
    Application cancelled = assigned();
    cancelled.setId(4L);
    cancelled.setStatus(ApplicationReviewStatus.CANCELLED);
    Application second = assigned();
    second.setId(6L);
    second.setRecruitmentId(3L);
    second.setTentativeAssignmentId(30L);
    Recruitment other = ula(true);
    other.setId(3L);
    RecruitmentCourse otherLecture = lecture();
    otherLecture.setId(30L);
    otherLecture.setRecruitmentId(3L);
    when(applicationRepository.findByEmailOrderByIdDesc(EMAIL))
        .thenReturn(List.of(second, assigned(), cancelled));
    when(recruitmentRepository.findById(2L)).thenReturn(Optional.of(ula(true)));
    when(recruitmentRepository.findById(3L)).thenReturn(Optional.of(other));
    when(recruitmentCourseRepository.findById(10L)).thenReturn(Optional.of(lecture()));
    when(recruitmentCourseRepository.findById(30L)).thenReturn(Optional.of(otherLecture));
    when(publishedAssignmentsService.emailsByCatalogName()).thenReturn(Map.of());
    when(softOfferNoticeVersionRepository.findFirstByOrderByIdDesc()).thenReturn(Optional.empty());
    when(softOfferResponseRepository.findByApplicationIdAndRecruitmentCourseId(any(), any()))
        .thenReturn(Optional.empty());
    when(ucsbCurriculumService.getOffering(any(), any())).thenThrow(new RuntimeException("down"));

    List<SoftOfferDto> offers = service.mine(EMAIL);

    assertEquals(List.of(6L, 5L), offers.stream().map(SoftOfferDto::applicationId).toList());
    assertEquals(List.of(3L, 2L), offers.stream().map(SoftOfferDto::recruitmentId).toList());
    verify(publishedAssignmentsService, org.mockito.Mockito.times(1)).emailsByCatalogName();
    verify(softOfferNoticeVersionRepository, org.mockito.Mockito.times(1))
        .findFirstByOrderByIdDesc();
  }

  @Test
  void mine_is_empty_with_no_applications_and_asks_for_no_emails_or_notice() {
    when(applicationRepository.findByEmailOrderByIdDesc(EMAIL)).thenReturn(List.of());
    assertEquals(List.of(), service.mine(EMAIL));
    verify(publishedAssignmentsService, never()).emailsByCatalogName();
    verify(softOfferNoticeVersionRepository, never()).findFirstByOrderByIdDesc();
  }

  // ---- openOffer: when there is none ----

  @Test
  void a_cancelled_hidden_or_unassigned_application_has_no_offer() {
    Application cancelled = assigned();
    cancelled.setStatus(ApplicationReviewStatus.CANCELLED);
    Application hidden = assigned();
    hidden.setHidden(true);
    Application unassigned = assigned();
    unassigned.setTentativeAssignmentId(null);

    assertNull(service.openOffer(cancelled));
    assertNull(service.openOffer(hidden));
    assertNull(service.openOffer(unassigned));
    verify(recruitmentRepository, never()).findById(any());
  }

  @Test
  void a_missing_ta_or_unreleased_recruitment_has_no_offer() {
    when(recruitmentRepository.findById(2L))
        .thenReturn(
            Optional.empty(),
            Optional.of(
                Recruitment.builder()
                    .id(2L)
                    .type(RecruitmentType.TA)
                    .softOffersReleasedAt(RELEASED)
                    .build()),
            Optional.of(ula(false)));

    assertNull(service.openOffer(assigned()));
    assertNull(service.openOffer(assigned()));
    assertNull(service.openOffer(assigned()));
    verify(recruitmentCourseRepository, never()).findById(any());
  }

  @Test
  void a_lecture_that_is_gone_or_belongs_to_another_recruitment_has_no_offer() {
    when(recruitmentRepository.findById(2L)).thenReturn(Optional.of(ula(true)));
    RecruitmentCourse elsewhere = lecture();
    elsewhere.setRecruitmentId(9L);
    when(recruitmentCourseRepository.findById(10L))
        .thenReturn(Optional.empty(), Optional.of(elsewhere));

    assertNull(service.openOffer(assigned()));
    assertNull(service.openOffer(assigned()));
  }

  // ---- respond ----

  @Test
  void respond_saves_the_answer_for_the_lecture_with_trimmed_comments_and_the_notice_version() {
    Application application = assigned();
    when(applicationRepository.findById(5L)).thenReturn(Optional.of(application));
    when(recruitmentRepository.findById(2L)).thenReturn(Optional.of(ula(true)));
    when(recruitmentCourseRepository.findById(10L)).thenReturn(Optional.of(lecture()));
    when(softOfferResponseRepository.findByApplicationIdAndRecruitmentCourseId(5L, 10L))
        .thenReturn(Optional.empty());
    when(softOfferNoticeVersionRepository.findFirstByOrderByIdDesc())
        .thenReturn(Optional.of(SoftOfferNoticeVersion.builder().id(3L).content("x").build()));
    SoftOfferResponse saved = SoftOfferResponse.builder().id(77L).build();
    when(softOfferResponseRepository.save(any())).thenReturn(saved);

    SoftOfferResponse answer =
        service.respond(EMAIL, 5L, SoftOfferDecision.PROCEED, "  Looking forward to it  ");

    assertSame(saved, answer);
    ArgumentCaptor<SoftOfferResponse> captor = ArgumentCaptor.forClass(SoftOfferResponse.class);
    verify(softOfferResponseRepository).save(captor.capture());
    SoftOfferResponse row = captor.getValue();
    assertEquals(5L, row.getApplicationId());
    assertEquals(10L, row.getRecruitmentCourseId());
    assertEquals(SoftOfferDecision.PROCEED, row.getDecision());
    assertEquals("Looking forward to it", row.getComments());
    assertEquals(3L, row.getSoftOfferNoticeVersionId());
  }

  @Test
  void blank_or_missing_comments_are_stored_as_null_and_no_notice_as_null() {
    when(applicationRepository.findById(5L)).thenReturn(Optional.of(assigned()));
    when(recruitmentRepository.findById(2L)).thenReturn(Optional.of(ula(true)));
    when(recruitmentCourseRepository.findById(10L)).thenReturn(Optional.of(lecture()));
    when(softOfferResponseRepository.findByApplicationIdAndRecruitmentCourseId(5L, 10L))
        .thenReturn(Optional.empty());
    when(softOfferNoticeVersionRepository.findFirstByOrderByIdDesc()).thenReturn(Optional.empty());
    when(softOfferResponseRepository.save(any())).thenAnswer(i -> i.getArgument(0));

    SoftOfferResponse blank = service.respond(EMAIL, 5L, SoftOfferDecision.DECLINE, "   ");
    SoftOfferResponse missing = service.respond(EMAIL, 5L, SoftOfferDecision.DECLINE, null);

    assertNull(blank.getComments());
    assertNull(missing.getComments());
    assertNull(blank.getSoftOfferNoticeVersionId());
    assertEquals(SoftOfferDecision.DECLINE, blank.getDecision());
  }

  @Test
  void respond_refuses_an_unknown_or_someone_elses_application() {
    when(applicationRepository.findById(5L)).thenReturn(Optional.empty());
    assertThrows(
        EntityNotFoundException.class,
        () -> service.respond(EMAIL, 5L, SoftOfferDecision.PROCEED, null));

    when(applicationRepository.findById(5L)).thenReturn(Optional.of(assigned()));
    ForbiddenException forbidden =
        assertThrows(
            ForbiddenException.class,
            () -> service.respond("other@ucsb.edu", 5L, SoftOfferDecision.PROCEED, null));
    assertEquals("That application belongs to someone else", forbidden.getMessage());
    verify(softOfferResponseRepository, never()).save(any());
  }

  @Test
  void respond_refuses_when_no_offer_is_open_or_the_comments_are_too_long() {
    Application unassigned = assigned();
    unassigned.setTentativeAssignmentId(null);
    when(applicationRepository.findById(5L)).thenReturn(Optional.of(unassigned));
    IllegalArgumentException none =
        assertThrows(
            IllegalArgumentException.class,
            () -> service.respond(EMAIL, 5L, SoftOfferDecision.PROCEED, null));
    assertEquals("There is no soft offer open for this application.", none.getMessage());

    when(applicationRepository.findById(5L)).thenReturn(Optional.of(assigned()));
    when(recruitmentRepository.findById(2L)).thenReturn(Optional.of(ula(true)));
    when(recruitmentCourseRepository.findById(10L)).thenReturn(Optional.of(lecture()));
    IllegalArgumentException tooLong =
        assertThrows(
            IllegalArgumentException.class,
            () -> service.respond(EMAIL, 5L, SoftOfferDecision.PROCEED, "x".repeat(4001)));
    assertEquals("Comments may be at most 4000 characters.", tooLong.getMessage());
    verify(softOfferResponseRepository, never()).save(any());
  }

  @Test
  void respond_refuses_a_second_answer_for_the_same_lecture() {
    when(applicationRepository.findById(5L)).thenReturn(Optional.of(assigned()));
    when(recruitmentRepository.findById(2L)).thenReturn(Optional.of(ula(true)));
    when(recruitmentCourseRepository.findById(10L)).thenReturn(Optional.of(lecture()));
    when(softOfferResponseRepository.findByApplicationIdAndRecruitmentCourseId(5L, 10L))
        .thenReturn(Optional.of(SoftOfferResponse.builder().id(1L).build()));

    IllegalStateException again =
        assertThrows(
            IllegalStateException.class,
            () -> service.respond(EMAIL, 5L, SoftOfferDecision.PROCEED, "x".repeat(4000)));

    assertEquals("This soft offer has already been answered.", again.getMessage());
    verify(softOfferResponseRepository, never()).save(any());
  }

  // ---- results (issue #487) ----

  private static Application person(long id, String first, String last, Long tentative) {
    return Application.builder()
        .id(id)
        .recruitmentId(2L)
        .email(first.toLowerCase() + "@ucsb.edu")
        .firstName(first)
        .lastName(last)
        .status(ApplicationReviewStatus.PENDING)
        .tentativeAssignmentId(tentative)
        .previousServiceAsUla(id == 1L ? 0 : 2)
        // Issue #500: the fields the financial office staff need; Ada has them all, the rest none.
        .permNumber(id == 1L ? "A123456" : null)
        .graduationDate(id == 1L ? "Spring 2027" : null)
        .otherCampusJob(id == 1L ? OtherCampusJob.NOT_SURE : null)
        .employeeId(id == 1L ? "12345678" : null)
        .build();
  }

  private static SoftOfferResponse answer(
      long applicationId,
      long courseId,
      SoftOfferDecision decision,
      String comments,
      LocalDateTime at) {
    return SoftOfferResponse.builder()
        .applicationId(applicationId)
        .recruitmentCourseId(courseId)
        .decision(decision)
        .comments(comments)
        .respondedAt(at)
        .build();
  }

  @Test
  void results_list_each_assigned_ula_with_their_answer_for_the_lecture_they_now_hold() {
    Recruitment ula = ula(true);
    RecruitmentCourse cs156 = lecture();
    RecruitmentCourse cs8 = lecture();
    cs8.setId(20L);
    cs8.setCourseId("CMPSC     8");
    cs8.setInstructor(null);
    when(recruitmentCourseRepository.findByRecruitmentId(2L)).thenReturn(List.of(cs156, cs8));
    // Ada answered for 156 (late); Grace answered for 8 but now holds 156; Alan has not answered;
    // Linus declined 156 and has since been unassigned; Edsger was never assigned.
    Application ada = person(1L, "Ada", "Lovelace", 10L);
    Application grace = person(2L, "Grace", "Hopper", 10L);
    Application alan = person(3L, "Alan", "Turing", 20L);
    Application linus = person(4L, "Linus", "Torvalds", null);
    Application edsger = person(5L, "Edsger", "Dijkstra", null);
    when(assignmentsService.realApplications(2L))
        .thenReturn(List.of(grace, ada, alan, linus, edsger));
    when(publishedAssignmentsService.emailsByCatalogName())
        .thenReturn(Map.of("CONRAD P", "phtcon@ucsb.edu"));
    when(softOfferResponseRepository.findByApplicationIdIn(List.of(2L, 1L, 3L, 4L, 5L)))
        .thenReturn(
            List.of(
                answer(
                    1L,
                    10L,
                    SoftOfferDecision.PROCEED,
                    "Yes!",
                    LocalDateTime.of(2026, 11, 26, 9, 0)),
                answer(
                    2L, 20L, SoftOfferDecision.PROCEED, null, LocalDateTime.of(2026, 11, 22, 8, 0)),
                answer(
                    2L,
                    30L,
                    SoftOfferDecision.DECLINE,
                    "old",
                    LocalDateTime.of(2026, 11, 21, 8, 0)),
                answer(
                    4L,
                    10L,
                    SoftOfferDecision.DECLINE,
                    "Moving",
                    LocalDateTime.of(2026, 11, 23, 10, 30))));
    // Issue #509: the staff have saved something for Ada only, looked up for the rows in one go.
    HiringRecord adas =
        HiringRecord.builder()
            .id(30L)
            .applicationId(1L)
            .inUcpathAt(LocalDateTime.of(2026, 11, 27, 10, 0))
            .updatedAt(LocalDateTime.of(2026, 11, 27, 10, 0))
            .updatedByEmail("staff@ucsb.edu")
            .build();
    when(hiringRecordRepository.findByApplicationIdIn(List.of(2L, 1L, 3L)))
        .thenReturn(List.of(adas));

    SoftOffersService.Results results = service.results(ula);

    // Issue #509: a row's identity is its application id, in row order.
    assertEquals(List.of(2L, 1L, 3L), results.applicationIds());
    assertEquals(Map.of(1L, HiringRecordDto.of(adas)), results.hiring());
    assertEquals(2L, results.recruitmentId());
    assertEquals("20264", results.quarter());
    assertEquals(RELEASED, results.releasedAt());
    assertEquals(DEADLINE, results.deadline());
    assertEquals(new SoftOffersService.Counts(3, 1, 0, 2), results.counts());
    assertEquals(SoftOffersService.RESULTS_HEADERS, results.headers());
    assertEquals(
        List.of(
            List.of(
                "Grace",
                "Hopper",
                "grace@ucsb.edu",
                "",
                "2",
                "",
                "",
                "",
                "CMPSC 156",
                "CONRAD P",
                "phtcon@ucsb.edu",
                "no",
                "Proceed (for CMPSC 8)",
                "2026-11-22T08:00",
                ""),
            List.of(
                "Ada",
                "Lovelace",
                "ada@ucsb.edu",
                "A123456",
                "0",
                "Spring 2027",
                "Not sure yet",
                "12345678",
                "CMPSC 156",
                "CONRAD P",
                "phtcon@ucsb.edu",
                "yes",
                "Proceed",
                "2026-11-26T09:00 (late)",
                "Yes!"),
            List.of(
                "Alan",
                "Turing",
                "alan@ucsb.edu",
                "",
                "2",
                "",
                "",
                "",
                "CMPSC 8",
                "",
                "Not mapped",
                "no",
                "",
                "",
                "")),
        results.rows());
    assertEquals(SoftOffersService.UNASSIGNED_HEADERS, results.unassignedHeaders());
    assertEquals(
        List.of(
            List.of(
                "Linus",
                "Torvalds",
                "linus@ucsb.edu",
                "CMPSC 156",
                "Declined",
                "2026-11-23T10:30",
                "Moving")),
        results.unassigned());
  }

  @Test
  void results_name_a_lecture_no_longer_on_file_by_id_and_cope_with_no_deadline_or_stamp() {
    Recruitment ula = ula(true);
    ula.setSoftOfferDeadline(null);
    when(recruitmentCourseRepository.findByRecruitmentId(2L)).thenReturn(List.of(lecture()));
    Application ada = person(1L, "Ada", "Lovelace", 10L);
    Application bob = person(2L, "Bob", "Builder", null);
    when(assignmentsService.realApplications(2L)).thenReturn(List.of(ada, bob));
    when(publishedAssignmentsService.emailsByCatalogName()).thenReturn(Map.of());
    when(softOfferResponseRepository.findByApplicationIdIn(List.of(1L, 2L)))
        .thenReturn(
            List.of(
                answer(1L, 99L, SoftOfferDecision.DECLINE, null, null),
                answer(
                    2L, 10L, SoftOfferDecision.DECLINE, "no", LocalDateTime.of(2026, 1, 1, 1, 1))));

    SoftOffersService.Results results = service.results(ula);

    assertEquals(new SoftOffersService.Counts(1, 0, 0, 1), results.counts());
    assertEquals(
        List.of(
            "Ada",
            "Lovelace",
            "ada@ucsb.edu",
            "A123456",
            "0",
            "Spring 2027",
            "Not sure yet",
            "12345678",
            "CMPSC 156",
            "CONRAD P",
            "Not mapped",
            "yes",
            "Declined (for lecture 99)",
            "",
            ""),
        results.rows().get(0));
    assertEquals(
        List.of(
            "Bob", "Builder", "bob@ucsb.edu", "CMPSC 156", "Declined", "2026-01-01T01:01", "no"),
        results.unassigned().get(0));
  }

  @Test
  void
      a_declined_answer_for_the_current_lecture_counts_as_declined_and_is_on_time_at_the_deadline() {
    Recruitment ula = ula(true);
    when(recruitmentCourseRepository.findByRecruitmentId(2L)).thenReturn(List.of(lecture()));
    Application ada = person(1L, "Ada", "Lovelace", 10L);
    when(assignmentsService.realApplications(2L)).thenReturn(List.of(ada));
    when(publishedAssignmentsService.emailsByCatalogName()).thenReturn(Map.of());
    when(softOfferResponseRepository.findByApplicationIdIn(List.of(1L)))
        .thenReturn(List.of(answer(1L, 10L, SoftOfferDecision.DECLINE, null, DEADLINE)));

    SoftOffersService.Results results = service.results(ula);

    assertEquals(new SoftOffersService.Counts(1, 0, 1, 0), results.counts());
    assertEquals("Declined", results.rows().get(0).get(12));
    assertEquals("2026-11-25T17:00", results.rows().get(0).get(13));
  }

  @Test
  void an_answer_with_no_stamp_is_not_late_even_with_a_deadline() {
    Recruitment ula = ula(true);
    when(recruitmentCourseRepository.findByRecruitmentId(2L)).thenReturn(List.of(lecture()));
    when(assignmentsService.realApplications(2L))
        .thenReturn(List.of(person(1L, "Ada", "Lovelace", 10L)));
    when(publishedAssignmentsService.emailsByCatalogName()).thenReturn(Map.of());
    when(softOfferResponseRepository.findByApplicationIdIn(List.of(1L)))
        .thenReturn(List.of(answer(1L, 10L, SoftOfferDecision.PROCEED, "x", null)));

    SoftOffersService.Results results = service.results(ula);

    assertEquals("", results.rows().get(0).get(13));
    assertEquals("Proceed", results.rows().get(0).get(12));
  }

  @Test
  void unassigned_answers_are_listed_by_last_name_then_first_name() {
    Recruitment ula = ula(true);
    when(recruitmentCourseRepository.findByRecruitmentId(2L)).thenReturn(List.of(lecture()));
    // By last name ignoring case, then first name: Adams/adams before Young, Amy before Zed.
    Application zed = person(1L, "Zed", "Adams", null);
    Application bob = person(2L, "Bob", "Young", null);
    Application amy = person(3L, "Amy", "adams", null);
    when(assignmentsService.realApplications(2L)).thenReturn(List.of(zed, bob, amy));
    when(publishedAssignmentsService.emailsByCatalogName()).thenReturn(Map.of());
    LocalDateTime at = LocalDateTime.of(2026, 1, 1, 1, 1);
    when(softOfferResponseRepository.findByApplicationIdIn(List.of(1L, 2L, 3L)))
        .thenReturn(
            List.of(
                answer(1L, 10L, SoftOfferDecision.DECLINE, null, at),
                answer(2L, 10L, SoftOfferDecision.PROCEED, null, at),
                answer(3L, 10L, SoftOfferDecision.DECLINE, null, at)));

    SoftOffersService.Results results = service.results(ula);

    assertEquals(
        List.of("Amy", "Zed", "Bob"),
        results.unassigned().stream().map(row -> row.get(0)).toList());
    assertEquals(new SoftOffersService.Counts(0, 0, 0, 0), results.counts());
  }

  @Test
  void results_are_refused_for_a_ta_recruitment_or_before_soft_offers_are_released() {
    Recruitment ta = Recruitment.builder().id(2L).type(RecruitmentType.TA).build();
    assertEquals(
        "Soft offers are a ULA feature.",
        assertThrows(IllegalArgumentException.class, () -> service.results(ta)).getMessage());
    assertEquals(
        "Soft offers have not been released for this recruitment.",
        assertThrows(IllegalArgumentException.class, () -> service.results(ula(false)))
            .getMessage());
    verify(assignmentsService, never()).realApplications(any());
  }

  @Test
  void the_csv_is_the_header_row_then_a_row_per_assigned_ula_every_cell_quoted() {
    Recruitment ula = ula(true);
    when(recruitmentCourseRepository.findByRecruitmentId(2L)).thenReturn(List.of(lecture()));
    // Ada has a hiring record with some of everything (issue #509); Bob has none.
    when(assignmentsService.realApplications(2L))
        .thenReturn(List.of(person(1L, "Ada", "Lovelace", 10L), person(2L, "Bob", "Builder", 10L)));
    when(publishedAssignmentsService.emailsByCatalogName()).thenReturn(Map.of());
    when(softOfferResponseRepository.findByApplicationIdIn(List.of(1L, 2L)))
        .thenReturn(
            List.of(
                answer(
                    1L,
                    10L,
                    SoftOfferDecision.PROCEED,
                    "Yes, \"please\"",
                    LocalDateTime.of(2026, 11, 21, 8, 5))));
    when(hiringRecordRepository.findByApplicationIdIn(List.of(2L, 1L)))
        .thenReturn(
            List.of(
                HiringRecord.builder()
                    .id(30L)
                    .applicationId(1L)
                    .formalOfferSentAt(LocalDateTime.of(2026, 11, 21, 8, 5))
                    .newHireForm(NewHireForm.NOT_NEEDED)
                    .newHireFormAt(LocalDateTime.of(2026, 11, 22, 9, 0))
                    .flsaConflictFoundAt(LocalDateTime.of(2026, 11, 22, 10, 0))
                    .inUcpathAt(LocalDateTime.of(2026, 11, 23, 11, 0))
                    .fundingSource("TA")
                    .staffComments("Call \"HR\"")
                    .updatedAt(LocalDateTime.of(2026, 11, 23, 11, 0))
                    .updatedByEmail("staff@ucsb.edu")
                    .build()));

    String csv = service.resultsCsv(ula);

    String[] lines = csv.split("\n");
    assertEquals(3, lines.length);
    // Issue #500: the five applicant columns, Funding, Student Comments and the staff's columns;
    // issue #509: each stamped staff column is two, the value and its date/time.
    assertEquals(
        "\"First name\",\"Last name\",\"Email\",\"Perm number\",\"Prev LA Qtrs\","
            + "\"Expected grad date\",\"Other Campus Job?\",\"Employee ID number\","
            + "\"Course assignment\",\"Funding\",\"Course instructor\","
            + "\"Course instructor email\",\"First time ULA\",\"Offer Status\","
            + "\"Offer Response Date/Time\",\"Student Comments\",\"Formal Offer Sent\","
            + "\"Formal Offer Sent Date/Time\",\"Formal Offer Accepted\","
            + "\"Formal Offer Accepted Date/Time\",\"New Hire form done (or not needed)\","
            + "\"New Hire form Date/Time\",\"Other Campus Job FLSA conflict found\","
            + "\"Other Campus Job FLSA conflict found Date/Time\","
            + "\"Other Campus Job FLSA conflict resolved\","
            + "\"Other Campus Job FLSA conflict resolved Date/Time\",\"In UCPath\","
            + "\"In UCPath Date/Time\",\"I-9 Complete\",\"I-9 Complete Date/Time\","
            + "\"Staff Comments\"",
        lines[0].trim());
    // Bob: no answer and no hiring record, so blanks throughout.
    assertEquals(
        "\"Bob\",\"Builder\",\"bob@ucsb.edu\",\"\",\"2\",\"\",\"\",\"\",\"CMPSC 156\",\"\","
            + "\"CONRAD P\",\"Not mapped\",\"no\",\"\",\"\",\"\","
            + "\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\"",
        lines[1].trim());
    // Ada: a checked box is Yes with its stamp, an unchecked one two blanks, the dropdown as the
    // page words it, and the staff's comments quoted like the student's.
    assertEquals(
        "\"Ada\",\"Lovelace\",\"ada@ucsb.edu\",\"A123456\",\"0\",\"Spring 2027\",\"Not sure yet\","
            + "\"12345678\",\"CMPSC 156\",\"TA\",\"CONRAD P\",\"Not mapped\",\"yes\","
            + "\"Proceed\",\"2026-11-21T08:05\",\"Yes, \"\"please\"\"\","
            + "\"Yes\",\"2026-11-21T08:05\",\"\",\"\",\"Not needed\",\"2026-11-22T09:00\","
            + "\"Yes\",\"2026-11-22T10:00\",\"\",\"\",\"Yes\",\"2026-11-23T11:00\",\"\",\"\","
            + "\"Call \"\"HR\"\"\"",
        lines[2].trim());
    assertEquals(31, SoftOffersService.CSV_HEADERS.size());
    assertEquals(31, lines[1].split("\",\"").length);
    assertEquals(31, lines[2].split("\",\"").length);
  }

  // ---- issue #509: the staff's CSV cells ----

  @Test
  void the_staff_headers_are_two_per_stamped_field_then_staff_comments() {
    assertEquals(
        List.of(
            "Formal Offer Sent",
            "Formal Offer Sent Date/Time",
            "Formal Offer Accepted",
            "Formal Offer Accepted Date/Time",
            "New Hire form done (or not needed)",
            "New Hire form Date/Time",
            "Other Campus Job FLSA conflict found",
            "Other Campus Job FLSA conflict found Date/Time",
            "Other Campus Job FLSA conflict resolved",
            "Other Campus Job FLSA conflict resolved Date/Time",
            "In UCPath",
            "In UCPath Date/Time",
            "I-9 Complete",
            "I-9 Complete Date/Time",
            "Staff Comments"),
        SoftOffersService.STAFF_HEADERS);
  }

  @Test
  void a_row_with_no_hiring_record_has_a_blank_funding_cell_and_blank_staff_cells() {
    assertEquals("", SoftOffersService.funding(null));
    List<String> cells = SoftOffersService.staffCells(null);
    assertEquals(15, cells.size());
    assertEquals(List.of("", "", "", "", "", "", "", "", "", "", "", "", "", "", ""), cells);
  }

  @Test
  void a_record_with_nothing_set_yet_also_exports_blanks() {
    HiringRecordDto empty =
        HiringRecordDto.of(HiringRecord.builder().id(1L).applicationId(2L).build());
    assertEquals("", SoftOffersService.funding(empty));
    assertEquals(SoftOffersService.staffCells(null), SoftOffersService.staffCells(empty));
  }

  @Test
  void every_staff_cell_is_filled_from_its_field() {
    HiringRecordDto all =
        HiringRecordDto.of(
            HiringRecord.builder()
                .id(1L)
                .applicationId(2L)
                .formalOfferSentAt(LocalDateTime.of(2026, 1, 1, 1, 1))
                .formalOfferAcceptedAt(LocalDateTime.of(2026, 1, 2, 2, 2))
                .newHireForm(NewHireForm.DONE)
                .newHireFormAt(LocalDateTime.of(2026, 1, 3, 3, 3))
                .flsaConflictFoundAt(LocalDateTime.of(2026, 1, 4, 4, 4))
                .flsaConflictResolvedAt(LocalDateTime.of(2026, 1, 5, 5, 5))
                .inUcpathAt(LocalDateTime.of(2026, 1, 6, 6, 6))
                .i9CompleteAt(LocalDateTime.of(2026, 1, 7, 7, 7))
                .fundingSource("GSR")
                .staffComments("All set")
                .build());
    assertEquals("GSR", SoftOffersService.funding(all));
    assertEquals(
        List.of(
            "Yes",
            "2026-01-01T01:01",
            "Yes",
            "2026-01-02T02:02",
            "Done",
            "2026-01-03T03:03",
            "Yes",
            "2026-01-04T04:04",
            "Yes",
            "2026-01-05T05:05",
            "Yes",
            "2026-01-06T06:06",
            "Yes",
            "2026-01-07T07:07",
            "All set"),
        SoftOffersService.staffCells(all));
  }

  @Test
  void the_new_hire_form_choice_and_the_checkboxes_export_as_the_page_words_them() {
    assertEquals("Done", SoftOffersService.newHireForm(NewHireForm.DONE));
    assertEquals("Not needed", SoftOffersService.newHireForm(NewHireForm.NOT_NEEDED));
    assertEquals("", SoftOffersService.newHireForm(null));
    assertEquals("Yes", SoftOffersService.checked(LocalDateTime.of(2026, 1, 1, 1, 1)));
    assertEquals("", SoftOffersService.checked(null));
  }

  // ---- issue #500: the page's headers against the CSV's ----

  @Test
  void the_page_headers_hold_the_five_applicant_columns_between_email_and_course_assignment() {
    assertEquals(
        List.of(
            "Email",
            "Perm number",
            "Prev LA Qtrs",
            "Expected grad date",
            "Other Campus Job?",
            "Employee ID number",
            "Course assignment"),
        SoftOffersService.RESULTS_HEADERS.subList(2, 9));
    assertEquals("Comments", SoftOffersService.RESULTS_HEADERS.get(14));
    assertEquals(15, SoftOffersService.RESULTS_HEADERS.size());
    // The CSV differs only as issue #500 asks: Funding after Course assignment, Student Comments,
    // and the staff's columns at the end.
    List<String> csv = SoftOffersService.CSV_HEADERS;
    assertEquals(SoftOffersService.RESULTS_HEADERS.subList(0, 9), csv.subList(0, 9));
    assertEquals("Funding", csv.get(9));
    assertEquals(SoftOffersService.RESULTS_HEADERS.subList(9, 14), csv.subList(10, 15));
    assertEquals("Student Comments", csv.get(15));
    assertEquals(SoftOffersService.STAFF_HEADERS, csv.subList(16, 31));
  }

  @Test
  void the_other_campus_job_answer_is_shown_as_the_form_offered_it() {
    assertEquals("Yes", SoftOffersService.otherCampusJob(OtherCampusJob.YES));
    assertEquals("No", SoftOffersService.otherCampusJob(OtherCampusJob.NO));
    assertEquals("Not sure yet", SoftOffersService.otherCampusJob(OtherCampusJob.NOT_SURE));
    assertEquals("", SoftOffersService.otherCampusJob(null));
  }

  // ---- hidden recruitments (issue #496) ----

  @Test
  void a_hidden_recruitment_has_no_offer_even_when_released() {
    Recruitment hidden = ula(true);
    hidden.setHidden(true);
    when(recruitmentRepository.findById(2L)).thenReturn(Optional.of(hidden));

    assertNull(service.openOffer(assigned()));
    verify(recruitmentCourseRepository, never()).findById(any());
  }
}
