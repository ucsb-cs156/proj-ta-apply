package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.opencsv.CSVReader;
import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.CandidateRanking;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.CandidateRankingRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import java.io.StringReader;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
@Import({RankingsCsvService.class, AssignmentsService.class})
class RankingsCsvPersistenceTests {
  @Autowired RankingsCsvService service;
  @Autowired RecruitmentRepository recruitments;
  @Autowired RecruitmentCourseRepository courses;
  @Autowired ApplicationRepository applications;
  @Autowired CandidateRankingRepository rankings;
  @Autowired TestEntityManager entityManager;

  private Recruitment recruitment(String quarter) {
    return recruitments.save(
        Recruitment.builder().quarter(quarter).type(RecruitmentType.TA).build());
  }

  private RecruitmentCourse course(Recruitment recruitment, String section, String enroll) {
    return courses.save(
        RecruitmentCourse.builder()
            .recruitmentId(recruitment.getId())
            .courseId("CMPSC 16")
            .section(section)
            .enrollCode(enroll)
            .build());
  }

  private Application applicant(Recruitment recruitment, String email, boolean test) {
    return applications.save(
        Application.builder()
            .recruitmentId(recruitment.getId())
            .email(email)
            .testApplication(test)
            .build());
  }

  private void rank(RecruitmentCourse course, Application application, Integer value) {
    rankings.save(
        CandidateRanking.builder()
            .recruitmentCourseId(course.getId())
            .applicationId(application.getId())
            .rank(value)
            .build());
  }

  @Test
  void persisted_export_is_deterministic_and_never_reads_other_recruitment_rankings()
      throws Exception {
    Recruitment selected = recruitment("20261");
    Recruitment other = recruitment("20262");
    RecruitmentCourse secondSection = course(selected, "0200", "200");
    secondSection.setRemoved(true);
    courses.save(secondSection);
    RecruitmentCourse firstSection = course(selected, "0100", "100");
    firstSection.setAllocation(2);
    courses.save(firstSection);
    RecruitmentCourse otherCourse = course(other, "0100", "100");
    Application first = applicant(selected, "first@ucsb.edu", false);
    Application test = applicant(selected, "test@ucsb.edu", true);
    test.setTentativeAssignmentId(firstSection.getId());
    applications.save(test);
    Application unranked = applicant(selected, "unranked@ucsb.edu", false);
    Application last = applicant(selected, "last@ucsb.edu", false);
    last.setTentativeAssignmentId(firstSection.getId());
    applications.save(last);
    Application otherApplicant = applicant(other, "other@ucsb.edu", false);
    rank(firstSection, first, 3);
    rank(firstSection, last, 3);
    rank(firstSection, test, 1);
    rank(secondSection, last, 8);
    rank(secondSection, unranked, null);
    // Even an inconsistent historical record must not leak another recruitment's rank.
    rank(otherCourse, first, 99);
    rank(firstSection, otherApplicant, 77);
    rank(otherCourse, otherApplicant, 2);
    entityManager.flush();
    entityManager.clear();

    String csv = service.write(selected);
    try (CSVReader reader = new CSVReader(new StringReader(csv))) {
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
                  "tentativeAssignment",
                  "16 (section 0100)",
                  "16 (section 0200)"),
              List.of("Allocation", "", "", "", "", "", "", "", "2", "0"),
              List.of("Assigned", "", "", "", "", "", "", "", "1", "0"),
              List.of("Left to assign", "", "", "", "", "", "", "", "1", "0"),
              List.of("", "", "first@ucsb.edu", "", "", "", "", "", "3", ""),
              List.of("", "", "unranked@ucsb.edu", "", "", "", "", "", "", ""),
              List.of("", "", "last@ucsb.edu", "", "", "", "", "16 (section 0100)", "3", "8")),
          reader.readAll().stream().map(Arrays::asList).toList());
    }
    assertEquals(csv, service.write(selected));
    try (CSVReader reader = new CSVReader(new StringReader(service.write(other)))) {
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
                  "tentativeAssignment",
                  "16"),
              List.of("Allocation", "", "", "", "", "", "", "", "0"),
              List.of("Assigned", "", "", "", "", "", "", "", "0"),
              List.of("Left to assign", "", "", "", "", "", "", "", "0"),
              List.of("", "", "other@ucsb.edu", "", "", "", "", "", "2")),
          reader.readAll().stream().map(Arrays::asList).toList());
    }
  }
}
