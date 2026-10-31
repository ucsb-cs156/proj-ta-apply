package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.CandidateRanking;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import edu.ucsb.cs.taapply.enums.ClassLevel;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.CandidateRankingRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.services.AssignmentsService.AssignmentRow;
import edu.ucsb.cs.taapply.services.AssignmentsService.Assignments;
import edu.ucsb.cs.taapply.services.AssignmentsService.CourseSummary;
import edu.ucsb.cs.taapply.services.AssignmentsService.IdentityColumn;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AssignmentsServiceTests {
  @Mock ApplicationRepository applicationRepository;
  @Mock RecruitmentCourseRepository recruitmentCourseRepository;
  @Mock CandidateRankingRepository candidateRankingRepository;
  @InjectMocks AssignmentsService service;

  private static Recruitment recruitment(RecruitmentType type) {
    return Recruitment.builder().id(7L).type(type).build();
  }

  private static RecruitmentCourse course(
      long id, String name, String section, String enroll, int allocation) {
    return RecruitmentCourse.builder()
        .id(id)
        .recruitmentId(7L)
        .courseId(name)
        .section(section)
        .enrollCode(enroll)
        .allocation(allocation)
        .build();
  }

  private static CandidateRanking rank(long courseId, long applicationId, Integer rank) {
    return CandidateRanking.builder()
        .recruitmentCourseId(courseId)
        .applicationId(applicationId)
        .rank(rank)
        .build();
  }

  private static Application applicant(long id, Long tentative) {
    return Application.builder()
        .id(id)
        .recruitmentId(7L)
        .firstName("Ada")
        .lastName("Lovelace")
        .email("a" + id + "@ucsb.edu")
        .major("Computer Science")
        .classLevel(ClassLevel.PHD)
        .yearInProgram("2")
        .graduationDate("Spring 2027")
        .gpaMajor(3.75)
        .gpaOverall(3.5)
        .previousServiceAsUla(2)
        .videoLink("PRIVATE VIDEO")
        .adminComments("PRIVATE ADMIN COMMENTS")
        .middleName("PRIVATE MIDDLE NAME")
        .tentativeAssignmentId(tentative)
        .build();
  }

  private static List<String> headers(List<IdentityColumn> columns) {
    return columns.stream().map(IdentityColumn::header).toList();
  }

  private static List<Object> values(List<IdentityColumn> columns, Application application) {
    return columns.stream().map(c -> c.value().apply(application)).toList();
  }

  // ---- identity columns ----

  @Test
  void ta_identity_columns_in_csv_order_with_class_level_and_no_private_fields() {
    List<IdentityColumn> columns = AssignmentsService.identityColumns(RecruitmentType.TA);
    assertEquals(
        List.of(
            "firstName",
            "lastName",
            "email",
            "major",
            "classLevel",
            "yearInProgram",
            "graduationDate"),
        headers(columns));
    assertEquals(
        List.of(
            "Ada",
            "Lovelace",
            "a1@ucsb.edu",
            "Computer Science",
            ClassLevel.PHD,
            "2",
            "Spring 2027"),
        values(columns, applicant(1, null)));
  }

  @Test
  void ula_identity_columns_in_csv_order_with_gpas_and_service() {
    List<IdentityColumn> columns = AssignmentsService.identityColumns(RecruitmentType.ULA);
    assertEquals(
        List.of(
            "firstName",
            "lastName",
            "email",
            "major",
            "yearInProgram",
            "graduationDate",
            "gpaMajor",
            "gpaOverall",
            "previousServiceAsUla"),
        headers(columns));
    assertEquals(
        List.of(
            "Ada", "Lovelace", "a1@ucsb.edu", "Computer Science", "2", "Spring 2027", 3.75, 3.5, 2),
        values(columns, applicant(1, null)));
  }

  @Test
  void identity_columns_are_a_fresh_list_each_time() {
    List<IdentityColumn> first = AssignmentsService.identityColumns(RecruitmentType.TA);
    first.clear();
    assertEquals(7, AssignmentsService.identityColumns(RecruitmentType.TA).size());
  }

  // ---- ordering and labels ----

  @Test
  void courses_sort_by_course_id_then_section_then_enrollment_code_with_nulls_first() {
    RecruitmentCourse a = course(1, "CMPSC 16", "0100", "900", 0);
    RecruitmentCourse b = course(2, "CMPSC 16", "0200", "100", 0);
    RecruitmentCourse c = course(3, "CMPSC 16", "0100", "100", 0);
    RecruitmentCourse d = course(4, "CMPSC 8", null, null, 0);
    RecruitmentCourse e = course(5, null, null, null, 0);
    List<RecruitmentCourse> sorted = new ArrayList<>(List.of(a, b, c, d, e));
    sorted.sort(AssignmentsService.BY_COURSE_SECTION_ENROLL);
    assertEquals(List.of(e, c, a, b, d), sorted);
  }

  @Test
  void label_names_course_section_and_enrollment_code_with_nulls_blank() {
    assertEquals(
        "CMPSC 16 (section 0100, enroll 900)",
        AssignmentsService.label(course(1, "CMPSC 16", "0100", "900", 0)));
    assertEquals(" (section , enroll )", AssignmentsService.label(course(2, null, null, null, 0)));
  }

  // ---- real applications and counts ----

  @Test
  void real_applications_leave_out_test_and_cancelled_in_creation_order() {
    Application real = applicant(1, 10L);
    Application test = applicant(2, 10L);
    test.setTestApplication(true);
    Application cancelled = applicant(3, 10L);
    cancelled.setStatus(ApplicationReviewStatus.CANCELLED);
    Application hired = applicant(4, null);
    hired.setStatus(ApplicationReviewStatus.HIRED);
    Application notHired = applicant(5, null);
    notHired.setStatus(ApplicationReviewStatus.NOT_HIRED);
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(7L))
        .thenReturn(List.of(real, test, cancelled, hired, notHired));
    assertEquals(List.of(real, hired, notHired), service.realApplications(7L));
  }

  @Test
  void assigned_counts_per_course_ignore_unassigned() {
    Map<Long, Integer> counts =
        AssignmentsService.assignedCounts(
            List.of(applicant(1, 10L), applicant(2, null), applicant(3, 10L), applicant(4, 20L)));
    assertEquals(Map.of(10L, 2, 20L, 1), counts);
    assertEquals(Map.of(), AssignmentsService.assignedCounts(List.of()));
  }

  @Test
  void ranks_for_a_section_are_keyed_by_application_and_keep_null_ranks() {
    when(candidateRankingRepository.findByRecruitmentCourseId(10L))
        .thenReturn(List.of(rank(10, 1, 2), rank(10, 3, null)));
    Map<Long, Integer> ranks = service.ranksFor(course(10, "CMPSC 16", "0100", "100", 0));
    Map<Long, Integer> expected = new HashMap<>();
    expected.put(1L, 2);
    expected.put(3L, null);
    assertEquals(expected, ranks);
    assertTrue(ranks.containsKey(3L));
  }

  // ---- the page ----

  @Test
  void assignments_list_sections_applicants_counts_and_rankings_exactly() {
    RecruitmentCourse offered = course(10, "CMPSC 16", "0100", "100", 3);
    RecruitmentCourse stale = course(20, "CMPSC 16", "0200", "200", 0);
    stale.setStale(true);
    RecruitmentCourse removedRanked = course(30, "CMPSC 24", "0100", "300", 2);
    removedRanked.setRemoved(true);
    RecruitmentCourse removedForgotten = course(40, "CMPSC 24", "0200", "400", 1);
    removedForgotten.setRemoved(true);
    RecruitmentCourse removedAssigned = course(50, "CMPSC 8", "0100", "500", 1);
    removedAssigned.setRemoved(true);
    RecruitmentCourse cancelled = course(60, "CMPSC 9", "0100", "600", 0);
    cancelled.setStatus(RecruitmentCourse.CANCELLED);
    when(recruitmentCourseRepository.findByRecruitmentId(7L))
        .thenReturn(
            List.of(cancelled, removedForgotten, stale, removedAssigned, offered, removedRanked));

    Application first = applicant(1, 10L);
    Application test = applicant(2, 10L);
    test.setTestApplication(true);
    Application third = applicant(3, 50L);
    Application cancelledApplicant = applicant(4, 10L);
    cancelledApplicant.setStatus(ApplicationReviewStatus.CANCELLED);
    Application blank = Application.builder().id(5L).recruitmentId(7L).build();
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(7L))
        .thenReturn(List.of(first, test, third, cancelledApplicant, blank));

    when(candidateRankingRepository.findByRecruitmentCourseId(10L))
        .thenReturn(List.of(rank(10, 1, 2), rank(10, 3, null), rank(10, 2, 1), rank(10, 999, 7)));
    when(candidateRankingRepository.findByRecruitmentCourseId(20L)).thenReturn(List.of());
    when(candidateRankingRepository.findByRecruitmentCourseId(30L))
        .thenReturn(List.of(rank(30, 1, 4)));
    when(candidateRankingRepository.findByRecruitmentCourseId(40L)).thenReturn(List.of());
    when(candidateRankingRepository.findByRecruitmentCourseId(50L)).thenReturn(List.of());
    when(candidateRankingRepository.findByRecruitmentCourseId(60L)).thenReturn(List.of());

    Assignments result = service.assignments(recruitment(RecruitmentType.TA));

    assertEquals(7L, result.recruitmentId());
    assertEquals(RecruitmentType.TA, result.type());
    assertEquals(
        List.of(
            "firstName",
            "lastName",
            "email",
            "major",
            "classLevel",
            "yearInProgram",
            "graduationDate"),
        result.identityHeaders());
    assertEquals(
        List.of(
            new CourseSummary(10L, "CMPSC 16", "0100", "100", 3, 1, 2, false),
            new CourseSummary(20L, "CMPSC 16", "0200", "200", 0, 0, 0, true),
            new CourseSummary(30L, "CMPSC 24", "0100", "300", 2, 0, 2, true),
            new CourseSummary(50L, "CMPSC 8", "0100", "500", 1, 1, 0, true),
            new CourseSummary(60L, "CMPSC 9", "0100", "600", 0, 0, 0, true)),
        result.courses());

    Map<String, String> identity = new LinkedHashMap<>();
    identity.put("firstName", "Ada");
    identity.put("lastName", "Lovelace");
    identity.put("email", "a1@ucsb.edu");
    identity.put("major", "Computer Science");
    identity.put("classLevel", "PHD");
    identity.put("yearInProgram", "2");
    identity.put("graduationDate", "Spring 2027");
    Map<Long, Integer> firstRanks = new LinkedHashMap<>();
    firstRanks.put(10L, 2);
    firstRanks.put(30L, 4);
    Map<String, String> thirdIdentity = new LinkedHashMap<>(identity);
    thirdIdentity.put("email", "a3@ucsb.edu");
    Map<Long, Integer> thirdRanks = new LinkedHashMap<>();
    thirdRanks.put(10L, null);
    Map<String, String> blankIdentity = new LinkedHashMap<>();
    for (String header : result.identityHeaders()) {
      blankIdentity.put(header, "");
    }
    assertEquals(
        List.of(
            new AssignmentRow(1L, identity, 10L, firstRanks),
            new AssignmentRow(3L, thirdIdentity, 50L, thirdRanks),
            new AssignmentRow(5L, blankIdentity, null, Map.of())),
        result.rows());
    // Column order is preserved, not just membership.
    assertEquals(List.of(10L, 30L), new ArrayList<>(result.rows().get(0).rankings().keySet()));
    assertEquals(
        List.of(
            "firstName",
            "lastName",
            "email",
            "major",
            "classLevel",
            "yearInProgram",
            "graduationDate"),
        new ArrayList<>(result.rows().get(0).identity().keySet()));
    assertTrue(result.rows().get(1).rankings().containsKey(10L));
    assertNull(result.rows().get(1).rankings().get(10L));
    assertFalse(result.rows().get(2).rankings().containsKey(10L));
    verify(candidateRankingRepository, never()).findByRecruitmentCourseId(999L);
  }

  @Test
  void ula_assignments_use_ula_identity_and_text_values() {
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of());
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(7L))
        .thenReturn(List.of(applicant(1, null)));
    Assignments result = service.assignments(recruitment(RecruitmentType.ULA));
    assertEquals(RecruitmentType.ULA, result.type());
    assertEquals(List.of(), result.courses());
    Map<String, String> identity = new LinkedHashMap<>();
    identity.put("firstName", "Ada");
    identity.put("lastName", "Lovelace");
    identity.put("email", "a1@ucsb.edu");
    identity.put("major", "Computer Science");
    identity.put("yearInProgram", "2");
    identity.put("graduationDate", "Spring 2027");
    identity.put("gpaMajor", "3.75");
    identity.put("gpaOverall", "3.5");
    identity.put("previousServiceAsUla", "2");
    assertEquals(List.of(new AssignmentRow(1L, identity, null, Map.of())), result.rows());
    assertEquals(new ArrayList<>(identity.keySet()), result.identityHeaders());
  }

  @Test
  void empty_recruitment_has_headers_and_nothing_else() {
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of());
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(7L)).thenReturn(List.of());
    Assignments result = service.assignments(recruitment(RecruitmentType.TA));
    assertEquals(
        new Assignments(
            7L,
            RecruitmentType.TA,
            List.of(
                "firstName",
                "lastName",
                "email",
                "major",
                "classLevel",
                "yearInProgram",
                "graduationDate"),
            List.of(),
            List.of()),
        result);
  }

  @Test
  void over_assigned_section_has_negative_places_left() {
    RecruitmentCourse offered = course(10, "CMPSC 16", "0100", "100", 1);
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of(offered));
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(7L))
        .thenReturn(List.of(applicant(1, 10L), applicant(2, 10L), applicant(3, 10L)));
    when(candidateRankingRepository.findByRecruitmentCourseId(10L)).thenReturn(List.of());
    Assignments result = service.assignments(recruitment(RecruitmentType.TA));
    assertEquals(
        List.of(new CourseSummary(10L, "CMPSC 16", "0100", "100", 1, 3, -2, false)),
        result.courses());
  }
}
