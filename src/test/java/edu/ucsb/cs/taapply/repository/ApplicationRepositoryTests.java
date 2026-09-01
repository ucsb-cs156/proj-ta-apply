package edu.ucsb.cs.taapply.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import edu.ucsb.cs.taapply.enums.ClassLevel;
import edu.ucsb.cs.taapply.enums.LanguageExamStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.enums.ResidencyStatus;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;

/**
 * Exercises the entity against the real Liquibase-built schema, so a column the entity names and
 * one the changeset creates cannot drift apart. With thirty-odd columns, including awkward ones
 * like coursework290, that is worth proving rather than assuming.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
public class ApplicationRepositoryTests {

  @Autowired private TestEntityManager entityManager;
  @Autowired private ApplicationRepository applicationRepository;
  @Autowired private RecruitmentRepository recruitmentRepository;

  @BeforeEach
  void clean() {
    applicationRepository.deleteAll();
    recruitmentRepository.deleteAll();
  }

  private Recruitment recruitment(String quarter, RecruitmentType type) {
    return recruitmentRepository.save(
        Recruitment.builder()
            .quarter(quarter)
            .type(type)
            .tentativeOpeningDate(LocalDate.of(2026, 1, 5))
            .primaryConsiderationDate(LocalDate.of(2026, 1, 20))
            .build());
  }

  @Test
  public void every_column_round_trips() {
    Recruitment r = recruitment("20261", RecruitmentType.TA);

    applicationRepository.save(
        Application.builder()
            .recruitmentId(r.getId())
            .email("grad@ucsb.edu")
            .firstName("Chris")
            .middleName("Q")
            .lastName("Gaucho")
            .major("Computer Science")
            .gpaMajor(3.8)
            .gpaOverall(3.7)
            .yearInProgram("2")
            .graduationDate("20272")
            .courseworkUcsb("CMPSC 156")
            .knowledge("Java, React")
            .prevExperience("TA for CS16")
            .desiredCourses("CMPSC 156")
            .comments("Keen")
            .postApplicationComments("Still available")
            .firstChoiceCourse("CMPSC   156")
            .secondChoiceCourse("CMPSC   130A")
            .availableForLecturesFirstChoice(true)
            .availableForDiscussionSecondChoice(true)
            .residencyStatus(ResidencyStatus.F1_STUDENT_VISA)
            .languageExam(LanguageExamStatus.PASSED)
            .languageExamDatePassed(LocalDate.of(2025, 9, 1))
            .classLevel(ClassLevel.PHD)
            .courseworkOther("Algorithms elsewhere")
            .coursework290("CMPSC 290A")
            .videoLink("https://example.org/v")
            .previousServiceAsUla(2)
            .build());

    Application found =
        applicationRepository.findByEmailAndRecruitmentId("grad@ucsb.edu", r.getId()).orElseThrow();

    assertEquals(ApplicationReviewStatus.PENDING, found.getStatus());
    assertEquals("Chris", found.getFirstName());
    assertEquals("Q", found.getMiddleName());
    assertEquals(3.8, found.getGpaMajor());
    assertEquals("20272", found.getGraduationDate());
    assertEquals("Still available", found.getPostApplicationComments());
    // The padded course id survives, matching the recruitment course list.
    assertEquals("CMPSC   156", found.getFirstChoiceCourse());
    assertTrue(found.isAvailableForLecturesFirstChoice());
    assertFalse(found.isAvailableForLecturesSecondChoice());
    assertTrue(found.isAvailableForDiscussionSecondChoice());
    assertEquals(ResidencyStatus.F1_STUDENT_VISA, found.getResidencyStatus());
    assertEquals(LanguageExamStatus.PASSED, found.getLanguageExam());
    assertEquals(LocalDate.of(2025, 9, 1), found.getLanguageExamDatePassed());
    assertEquals(ClassLevel.PHD, found.getClassLevel());
    assertEquals("CMPSC 290A", found.getCoursework290());
    assertEquals("https://example.org/v", found.getVideoLink());
    assertEquals(2, found.getPreviousServiceAsUla());
  }

  @Test
  public void an_application_defaults_to_pending() {
    Recruitment r = recruitment("20261", RecruitmentType.TA);
    Application saved =
        applicationRepository.save(
            Application.builder().recruitmentId(r.getId()).email("grad@ucsb.edu").build());

    assertEquals(
        ApplicationReviewStatus.PENDING,
        applicationRepository.findById(saved.getId()).orElseThrow().getStatus());
  }

  /** One application per person per recruitment; a second is rejected by the database. */
  @Test
  public void the_same_person_cannot_apply_twice_to_one_recruitment() {
    Recruitment r = recruitment("20261", RecruitmentType.TA);
    applicationRepository.save(
        Application.builder().recruitmentId(r.getId()).email("grad@ucsb.edu").build());

    assertThrows(
        DataIntegrityViolationException.class,
        () -> {
          applicationRepository.save(
              Application.builder().recruitmentId(r.getId()).email("grad@ucsb.edu").build());
          entityManager.flush();
        });
  }

  /** The history the design doc asks for: the same person across several recruitments. */
  @Test
  public void one_person_may_apply_to_several_recruitments() {
    Recruitment first = recruitment("20261", RecruitmentType.TA);
    Recruitment second = recruitment("20262", RecruitmentType.TA);

    applicationRepository.save(
        Application.builder().recruitmentId(first.getId()).email("grad@ucsb.edu").build());
    applicationRepository.save(
        Application.builder().recruitmentId(second.getId()).email("grad@ucsb.edu").build());

    List<Application> mine = applicationRepository.findByEmailOrderByIdDesc("grad@ucsb.edu");
    assertEquals(2, mine.size());
    // Newest first.
    assertEquals(second.getId(), mine.get(0).getRecruitmentId());
  }

  @Test
  public void findByEmail_returns_only_that_persons_applications() {
    Recruitment r = recruitment("20261", RecruitmentType.TA);
    applicationRepository.save(
        Application.builder().recruitmentId(r.getId()).email("grad@ucsb.edu").build());
    applicationRepository.save(
        Application.builder().recruitmentId(r.getId()).email("other@ucsb.edu").build());

    assertEquals(1, applicationRepository.findByEmailOrderByIdDesc("grad@ucsb.edu").size());
    assertTrue(applicationRepository.existsByEmailAndRecruitmentId("other@ucsb.edu", r.getId()));
    assertFalse(applicationRepository.existsByEmailAndRecruitmentId("nobody@ucsb.edu", r.getId()));
  }
}
