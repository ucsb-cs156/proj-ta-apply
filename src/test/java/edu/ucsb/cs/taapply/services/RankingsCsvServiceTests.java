package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.opencsv.CSVReader;
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
import java.io.StringReader;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class RankingsCsvServiceTests {
  @Mock ApplicationRepository applicationRepository;
  @Mock RecruitmentCourseRepository recruitmentCourseRepository;
  @Mock CandidateRankingRepository candidateRankingRepository;
  @InjectMocks AssignmentsService assignmentsService;
  @InjectMocks RankingsCsvService service;

  @BeforeEach
  void wire() {
    service.assignmentsService = assignmentsService;
  }

  private static final List<String> TA_IDENTITY =
      List.of(
          "firstName",
          "lastName",
          "email",
          "major",
          "classLevel",
          "yearInProgram",
          "graduationDate",
          "tentativeAssignment");

  private static final List<String> ULA_IDENTITY =
      List.of(
          "firstName",
          "lastName",
          "email",
          "major",
          "yearInProgram",
          "graduationDate",
          "gpaMajor",
          "gpaOverall",
          "previousServiceAsUla",
          "tentativeAssignment");

  private static Recruitment recruitment(RecruitmentType type) {
    return Recruitment.builder().id(7L).type(type).build();
  }

  private static RecruitmentCourse course(long id, String name, String section, String enroll) {
    return RecruitmentCourse.builder()
        .id(id)
        .recruitmentId(7L)
        .courseId(name)
        .section(section)
        .enrollCode(enroll)
        .build();
  }

  private static CandidateRanking rank(long courseId, long applicationId, Integer rank) {
    return CandidateRanking.builder()
        .recruitmentCourseId(courseId)
        .applicationId(applicationId)
        .rank(rank)
        .build();
  }

  private static Application applicant(long id) {
    return Application.builder()
        .id(id)
        .recruitmentId(7L)
        .firstName("Zoë, \"星\"\nAda")
        .lastName("O’Connor")
        .email("a" + id + "@ucsb.edu")
        .major("Computer, Science")
        .classLevel(ClassLevel.PHD)
        .yearInProgram("2")
        .graduationDate("Spring 2027")
        .gpaMajor(3.75)
        .gpaOverall(3.5)
        .previousServiceAsUla(2)
        .videoLink("PRIVATE VIDEO")
        .adminComments("PRIVATE ADMIN COMMENTS")
        .middleName("PRIVATE MIDDLE NAME")
        .build();
  }

  private static List<List<String>> parse(String csv) throws Exception {
    try (CSVReader reader = new CSVReader(new StringReader(csv))) {
      return reader.readAll().stream().map(Arrays::asList).toList();
    }
  }

  /**
   * A header row followed by the three planning rows: each course column is given as its header,
   * allocation, assigned count and places left.
   */
  @SafeVarargs
  private static List<List<String>> plus(List<String> identity, List<String>... courseColumns) {
    List<String> header = new ArrayList<>(identity);
    List<String> allocation = new ArrayList<>();
    List<String> assigned = new ArrayList<>();
    List<String> left = new ArrayList<>();
    allocation.add("Allocation");
    assigned.add("Assigned");
    left.add("Left to assign");
    for (int i = 1; i < identity.size(); i++) {
      allocation.add("");
      assigned.add("");
      left.add("");
    }
    for (List<String> column : courseColumns) {
      header.add(column.get(0));
      allocation.add(column.get(1));
      assigned.add(column.get(2));
      left.add(column.get(3));
    }
    return List.of(header, allocation, assigned, left);
  }

  @SafeVarargs
  private static List<List<String>> rows(List<List<String>> head, List<String>... body) {
    List<List<String>> all = new ArrayList<>(head);
    all.addAll(Arrays.asList(body));
    return all;
  }

  @Test
  void section_order_takes_precedence_over_enrollment_code() throws Exception {
    when(recruitmentCourseRepository.findByRecruitmentId(7L))
        .thenReturn(
            List.of(course(20, "CMPSC 16", "0200", "100"), course(10, "CMPSC 16", "0100", "900")));

    assertEquals(
        plus(
            TA_IDENTITY,
            List.of("16 (section 0100)", "0", "0", "0"),
            List.of("16 (section 0200)", "0", "0", "0")),
        parse(service.write(recruitment(RecruitmentType.TA))));
  }

  @Test
  void ta_exact_rows_preserve_ties_and_historical_sections_without_leaking_other_applicants()
      throws Exception {
    RecruitmentCourse removed = course(10, "CMPSC 16", "0100", "100");
    removed.setRemoved(true);
    removed.setAllocation(2);
    RecruitmentCourse stale = course(20, "CMPSC 16", "0200", "200");
    stale.setStale(true);
    RecruitmentCourse cancelled = course(30, "CMPSC 24", "0100", "300");
    cancelled.setStatus(RecruitmentCourse.CANCELLED);
    RecruitmentCourse sameSection = course(40, "CMPSC 16", "0100", "101");
    sameSection.setAllocation(3);
    when(recruitmentCourseRepository.findByRecruitmentId(7L))
        .thenReturn(List.of(cancelled, stale, sameSection, removed));
    Application first = applicant(1);
    first.setTentativeAssignmentId(40L);
    Application test = applicant(2);
    test.setTestApplication(true);
    test.setTentativeAssignmentId(10L);
    Application blank = Application.builder().id(4L).recruitmentId(7L).build();
    Application noInterests = applicant(5);
    noInterests.setClassLevel(ClassLevel.MS);
    noInterests.setTentativeAssignmentId(10L);
    Application cancelledApplicant = applicant(6);
    cancelledApplicant.setStatus(ApplicationReviewStatus.CANCELLED);
    cancelledApplicant.setTentativeAssignmentId(10L);
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(7L))
        .thenReturn(List.of(first, test, applicant(3), blank, noInterests, cancelledApplicant));
    when(candidateRankingRepository.findByRecruitmentCourseId(10L))
        .thenReturn(List.of(rank(10, 1, 2), rank(10, 3, 2), rank(10, 2, 1), rank(10, 999, 99)));
    when(candidateRankingRepository.findByRecruitmentCourseId(20L))
        .thenReturn(List.of(rank(20, 1, 9), rank(20, 3, null)));
    when(candidateRankingRepository.findByRecruitmentCourseId(30L))
        .thenReturn(List.of(rank(30, 3, 4)));
    when(candidateRankingRepository.findByRecruitmentCourseId(40L))
        .thenReturn(List.of(rank(40, 1, 5)));

    String csv = service.write(recruitment(RecruitmentType.TA));
    // Test and cancelled applicants are not counted as assigned, though the cancelled one is still
    // a row of this historical export.
    assertEquals(
        rows(
            plus(
                TA_IDENTITY,
                List.of("16 (section 0100, enroll 100)", "2", "1", "1"),
                List.of("16 (section 0100, enroll 101)", "3", "1", "2"),
                List.of("16 (section 0200)", "0", "0", "0"),
                List.of("24", "0", "0", "0")),
            List.of(
                "Zoë, \"星\"\nAda",
                "O’Connor",
                "a1@ucsb.edu",
                "Computer, Science",
                "PHD",
                "2",
                "Spring 2027",
                "16 (section 0100, enroll 101)",
                "2",
                "5",
                "9",
                ""),
            List.of(
                "Zoë, \"星\"\nAda",
                "O’Connor",
                "a3@ucsb.edu",
                "Computer, Science",
                "PHD",
                "2",
                "Spring 2027",
                "",
                "2",
                "",
                "",
                "4"),
            List.of("", "", "", "", "", "", "", "", "", "", "", ""),
            List.of(
                "Zoë, \"星\"\nAda",
                "O’Connor",
                "a5@ucsb.edu",
                "Computer, Science",
                "MS",
                "2",
                "Spring 2027",
                "16 (section 0100, enroll 100)",
                "",
                "",
                "",
                ""),
            List.of(
                "Zoë, \"星\"\nAda",
                "O’Connor",
                "a6@ucsb.edu",
                "Computer, Science",
                "PHD",
                "2",
                "Spring 2027",
                "16 (section 0100, enroll 100)",
                "",
                "",
                "",
                "")),
        parse(csv));
    verify(applicationRepository, never()).findByRecruitmentIdOrderByIdAsc(8L);
    verify(candidateRankingRepository, never()).findByRecruitmentCourseId(999L);
  }

  @Test
  void ula_exact_document_quotes_unicode_commas_and_newlines_and_preserves_stored_numbers()
      throws Exception {
    when(recruitmentCourseRepository.findByRecruitmentId(7L))
        .thenReturn(List.of(course(10, "CMPSC \"8\",\n星", "0100", "100")));
    Application assigned = applicant(1);
    assigned.setTentativeAssignmentId(10L);
    Application nullFields = Application.builder().id(2L).recruitmentId(7L).build();
    Application emptyFields =
        Application.builder()
            .id(3L)
            .recruitmentId(7L)
            .firstName("")
            .lastName("")
            .email("")
            .major("")
            .yearInProgram("")
            .graduationDate("")
            .previousServiceAsUla(0)
            .gpaMajor(0.0)
            .gpaOverall(0.0)
            .build();
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(7L))
        .thenReturn(List.of(assigned, nullFields, emptyFields));
    when(candidateRankingRepository.findByRecruitmentCourseId(10L))
        .thenReturn(List.of(rank(10, 1, 12), rank(10, 2, null), rank(10, 3, 0)));
    String csv = service.write(recruitment(RecruitmentType.ULA));
    String label = "\"\"\"8\"\",\n星\"";
    assertEquals(
        "\"firstName\",\"lastName\",\"email\",\"major\",\"yearInProgram\",\"graduationDate\","
            + "\"gpaMajor\",\"gpaOverall\",\"previousServiceAsUla\",\"tentativeAssignment\","
            + label
            + "\n"
            + "\"Allocation\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"0\"\n"
            + "\"Assigned\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"1\"\n"
            + "\"Left to assign\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"-1\"\n"
            + "\"Zoë, \"\"星\"\"\nAda\",\"O’Connor\",\"a1@ucsb.edu\",\"Computer, Science\","
            + "\"2\",\"Spring 2027\",\"3.75\",\"3.5\",\"2\","
            + label
            + ",\"12\"\n"
            + "\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\"\n"
            + "\"\",\"\",\"\",\"\",\"\",\"\",\"0.0\",\"0.0\",\"0\",\"\",\"0\"\n",
        csv);
    assertEquals(
        rows(
            plus(ULA_IDENTITY, List.of("\"8\",\n星", "0", "1", "-1")),
            List.of(
                "Zoë, \"星\"\nAda",
                "O’Connor",
                "a1@ucsb.edu",
                "Computer, Science",
                "2",
                "Spring 2027",
                "3.75",
                "3.5",
                "2",
                "\"8\",\n星",
                "12"),
            List.of("", "", "", "", "", "", "", "", "", "", ""),
            List.of("", "", "", "", "", "", "0.0", "0.0", "0", "", "0")),
        parse(csv));
  }

  @Test
  void empty_recruitment_has_exact_ta_header_and_blank_planning_rows() throws Exception {
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of());
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(7L)).thenReturn(List.of());
    assertEquals(plus(TA_IDENTITY), parse(service.write(recruitment(RecruitmentType.TA))));
  }

  @Test
  void no_applicants_keeps_course_columns_including_null_offering_details() throws Exception {
    RecruitmentCourse allocated = course(10, "CMPSC 8", null, null);
    allocated.setAllocation(4);
    when(recruitmentCourseRepository.findByRecruitmentId(7L))
        .thenReturn(List.of(allocated, course(20, null, null, null)));
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(7L)).thenReturn(List.of());
    assertEquals(
        plus(ULA_IDENTITY, List.of("", "0", "0", "0"), List.of("8", "4", "0", "4")),
        parse(service.write(recruitment(RecruitmentType.ULA))));
  }

  @Test
  void no_courses_still_exports_real_unranked_applicants_with_a_blank_assignment()
      throws Exception {
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of());
    // An assignment to a section that is no longer in the recruitment's list reads as blank.
    Application orphan = applicant(1);
    orphan.setTentativeAssignmentId(77L);
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(7L)).thenReturn(List.of(orphan));
    assertEquals(
        rows(
            plus(ULA_IDENTITY),
            List.of(
                "Zoë, \"星\"\nAda",
                "O’Connor",
                "a1@ucsb.edu",
                "Computer, Science",
                "2",
                "Spring 2027",
                "3.75",
                "3.5",
                "2",
                "")),
        parse(service.write(recruitment(RecruitmentType.ULA))));
  }
}
