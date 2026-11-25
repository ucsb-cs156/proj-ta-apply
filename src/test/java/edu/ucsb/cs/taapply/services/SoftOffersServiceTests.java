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
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.entity.SoftOfferNoticeVersion;
import edu.ucsb.cs.taapply.entity.SoftOfferResponse;
import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.enums.SoftOfferDecision;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.errors.ForbiddenException;
import edu.ucsb.cs.taapply.models.SoftOfferDto;
import edu.ucsb.cs.taapply.models.UcsbCourseOffering;
import edu.ucsb.cs.taapply.models.UcsbSection;
import edu.ucsb.cs.taapply.models.UcsbTimeLocation;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
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
  @Mock PublishedAssignmentsService publishedAssignmentsService;
  @Mock UCSBCurriculumService ucsbCurriculumService;
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
}
