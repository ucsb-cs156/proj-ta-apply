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
import edu.ucsb.cs.taapply.enums.ClassLevel;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.CandidateRankingRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import java.io.StringReader;
import java.util.Arrays;
import java.util.List;
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
  @InjectMocks RankingsCsvService service;

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

  @Test
  void ta_exact_rows_preserve_ties_and_historical_sections_without_leaking_other_applicants()
      throws Exception {
    RecruitmentCourse removed = course(10, "CMPSC 16", "0100", "100");
    removed.setRemoved(true);
    RecruitmentCourse stale = course(20, "CMPSC 16", "0200", "200");
    stale.setStale(true);
    RecruitmentCourse cancelled = course(30, "CMPSC 24", "0100", "300");
    cancelled.setStatus(RecruitmentCourse.CANCELLED);
    RecruitmentCourse sameSection = course(40, "CMPSC 16", "0100", "101");
    when(recruitmentCourseRepository.findByRecruitmentId(7L))
        .thenReturn(List.of(cancelled, stale, sameSection, removed));
    Application test = applicant(2);
    test.setTestApplication(true);
    Application blank = Application.builder().id(4L).recruitmentId(7L).build();
    Application noInterests = applicant(5);
    noInterests.setClassLevel(ClassLevel.MS);
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(7L))
        .thenReturn(List.of(applicant(1), test, applicant(3), blank, noInterests));
    when(candidateRankingRepository.findByRecruitmentCourseId(10L))
        .thenReturn(List.of(rank(10, 1, 2), rank(10, 3, 2), rank(10, 2, 1), rank(10, 999, 99)));
    when(candidateRankingRepository.findByRecruitmentCourseId(20L))
        .thenReturn(List.of(rank(20, 1, 9), rank(20, 3, null)));
    when(candidateRankingRepository.findByRecruitmentCourseId(30L))
        .thenReturn(List.of(rank(30, 3, 4)));
    when(candidateRankingRepository.findByRecruitmentCourseId(40L))
        .thenReturn(List.of(rank(40, 1, 5)));

    String csv = service.write(recruitment(RecruitmentType.TA));
    assertEquals(
        List.of(
            List.of(
                "firstName",
                "lastName",
                "email",
                "major",
                "classLevel",
                "yearInProgram",
                "graduationDate",
                "CMPSC 16 (section 0100, enroll 100)",
                "CMPSC 16 (section 0100, enroll 101)",
                "CMPSC 16 (section 0200, enroll 200)",
                "CMPSC 24 (section 0100, enroll 300)"),
            List.of(
                "Zoë, \"星\"\nAda",
                "O’Connor",
                "a1@ucsb.edu",
                "Computer, Science",
                "PHD",
                "2",
                "Spring 2027",
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
                "2",
                "",
                "",
                "4"),
            List.of("", "", "", "", "", "", "", "", "", "", ""),
            List.of(
                "Zoë, \"星\"\nAda",
                "O’Connor",
                "a5@ucsb.edu",
                "Computer, Science",
                "MS",
                "2",
                "Spring 2027",
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
        .thenReturn(List.of(applicant(1), nullFields, emptyFields));
    when(candidateRankingRepository.findByRecruitmentCourseId(10L))
        .thenReturn(List.of(rank(10, 1, 12), rank(10, 2, null), rank(10, 3, 0)));
    String csv = service.write(recruitment(RecruitmentType.ULA));
    assertEquals(
        "\"firstName\",\"lastName\",\"email\",\"major\",\"yearInProgram\",\"graduationDate\","
            + "\"gpaMajor\",\"gpaOverall\",\"previousServiceAsUla\","
            + "\"CMPSC \"\"8\"\",\n星 (section 0100, enroll 100)\"\n"
            + "\"Zoë, \"\"星\"\"\nAda\",\"O’Connor\",\"a1@ucsb.edu\",\"Computer, Science\","
            + "\"2\",\"Spring 2027\",\"3.75\",\"3.5\",\"2\",\"12\"\n"
            + "\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\"\n"
            + "\"\",\"\",\"\",\"\",\"\",\"\",\"0.0\",\"0.0\",\"0\",\"0\"\n",
        csv);
    assertEquals(
        List.of(
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
                "CMPSC \"8\",\n星 (section 0100, enroll 100)"),
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
                "12"),
            List.of("", "", "", "", "", "", "", "", "", ""),
            List.of("", "", "", "", "", "", "0.0", "0.0", "0", "0")),
        parse(csv));
  }

  @Test
  void empty_recruitment_has_exact_ta_header_only() throws Exception {
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of());
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(7L)).thenReturn(List.of());
    assertEquals(
        List.of(
            List.of(
                "firstName",
                "lastName",
                "email",
                "major",
                "classLevel",
                "yearInProgram",
                "graduationDate")),
        parse(service.write(recruitment(RecruitmentType.TA))));
  }

  @Test
  void no_applicants_keeps_course_columns_including_null_offering_details() throws Exception {
    when(recruitmentCourseRepository.findByRecruitmentId(7L))
        .thenReturn(List.of(course(10, "CMPSC 8", null, null), course(20, null, null, null)));
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(7L)).thenReturn(List.of());
    assertEquals(
        List.of(
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
                " (section , enroll )",
                "CMPSC 8 (section , enroll )")),
        parse(service.write(recruitment(RecruitmentType.ULA))));
  }

  @Test
  void no_courses_still_exports_real_unranked_applicants() throws Exception {
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of());
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(7L))
        .thenReturn(List.of(applicant(1)));
    assertEquals(
        List.of(
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
            List.of(
                "Zoë, \"星\"\nAda",
                "O’Connor",
                "a1@ucsb.edu",
                "Computer, Science",
                "2",
                "Spring 2027",
                "3.75",
                "3.5",
                "2")),
        parse(service.write(recruitment(RecruitmentType.ULA))));
  }
}
