package edu.ucsb.cs.taapply.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.NoticeVersion;
import edu.ucsb.cs.taapply.entity.PriorCoursework;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import edu.ucsb.cs.taapply.enums.ClassLevel;
import edu.ucsb.cs.taapply.enums.CourseInterest;
import edu.ucsb.cs.taapply.enums.LanguageExamStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.enums.ResidencyStatus;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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
 * like the prior coursework rows, that is worth proving rather than assuming.
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

  @Autowired private NoticeVersionRepository noticeVersionRepository;

  @Test
  public void every_column_round_trips() {
    Recruitment r = recruitment("20261", RecruitmentType.TA);
    NoticeVersion notice =
        noticeVersionRepository.save(
            NoticeVersion.builder()
                .type(RecruitmentType.TA)
                .content("Terms")
                .createdAt(LocalDateTime.of(2026, 1, 1, 0, 0))
                .build());

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
            .priorCoursework(
                new ArrayList<>(
                    List.of(
                        PriorCoursework.builder()
                            .ucsbCourse(true)
                            .courseNumber("CMPSC 156")
                            .courseTitle("Advanced App Programming")
                            .term("W26")
                            .grade("A")
                            .build(),
                        PriorCoursework.builder()
                            .ucsbCourse(false)
                            .otherSchool("UCLA")
                            .courseNumber("CS 31")
                            .build())))
            .topicProficiencies(new HashMap<>(Map.of("Java", 5, "React", 3)))
            .interests(new HashMap<>(Map.of("Tutoring", 4, "Grading", 1)))
            .prevExperience("TA for CS16")
            .comments("Keen")
            .postApplicationComments("Still available")
            .firstChoiceCourse("CMPSC   156")
            .secondChoiceCourse("CMPSC   130A")
            .availableForLecturesFirstChoice(true)
            .availableForDiscussionSecondChoice(true)
            .availabilityCommentsFirstChoice("Free T R afternoons")
            .availabilityCommentsSecondChoice("Any section but Friday")
            .courseInterests(
                new HashMap<>(
                    Map.of(
                        "CMPSC     8",
                        CourseInterest.ENTHUSIASTIC,
                        "CMPSC    16",
                        CourseInterest.WOULD_CONSIDER)))
            .residencyStatus(ResidencyStatus.F1_STUDENT_VISA)
            .languageExam(LanguageExamStatus.PASSED)
            .languageExamDatePassed(LocalDate.of(2025, 9, 1))
            .classLevel(ClassLevel.PHD)
            .videoLink("https://example.org/v")
            .previousServiceAsUla(2)
            .noticeVersionId(notice.getId())
            .build());

    entityManager.flush();
    entityManager.clear();

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
    // The columns added by changeset 011.
    assertEquals("Free T R afternoons", found.getAvailabilityCommentsFirstChoice());
    assertEquals("Any section but Friday", found.getAvailabilityCommentsSecondChoice());
    // The element collection comes back from its own table, keys padded as stored.
    assertEquals(
        Map.of(
            "CMPSC     8",
            CourseInterest.ENTHUSIASTIC,
            "CMPSC    16",
            CourseInterest.WOULD_CONSIDER),
        found.getCourseInterests());
    // Topic ratings live in their own table too (changeset 011), keyed by topic name.
    assertEquals(Map.of("Java", 5, "React", 3), found.getTopicProficiencies());
    // So do the ULA interest levels (changeset 015), keyed by interest name.
    assertEquals(Map.of("Tutoring", 4, "Grading", 1), found.getInterests());
    assertEquals(ResidencyStatus.F1_STUDENT_VISA, found.getResidencyStatus());
    assertEquals(LanguageExamStatus.PASSED, found.getLanguageExam());
    assertEquals(LocalDate.of(2025, 9, 1), found.getLanguageExamDatePassed());
    assertEquals(ClassLevel.PHD, found.getClassLevel());
    // Prior courses come back from their own table, in the order they were given, with ids.
    assertEquals(2, found.getPriorCoursework().size());
    assertEquals("CMPSC 156", found.getPriorCoursework().get(0).getCourseNumber());
    assertEquals("A", found.getPriorCoursework().get(0).getGrade());
    assertEquals("UCLA", found.getPriorCoursework().get(1).getOtherSchool());
    assertFalse(found.getPriorCoursework().get(1).isUcsbCourse());
    assertTrue(found.getPriorCoursework().get(1).getId() > 0);
    assertEquals("https://example.org/v", found.getVideoLink());
    assertEquals(2, found.getPreviousServiceAsUla());
    // The agreed notice version is a plain id column with a foreign key (changeset 012).
    assertEquals(notice.getId(), found.getNoticeVersionId());
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

  /** The column added by changeset 009 exists and the entity reads and writes it. */
  @Test
  public void test_application_defaults_to_false_and_round_trips() {
    Recruitment r = recruitment("20261", RecruitmentType.TA);

    Application real =
        applicationRepository.save(
            Application.builder().recruitmentId(r.getId()).email("grad@ucsb.edu").build());
    Application test =
        applicationRepository.save(
            Application.builder()
                .recruitmentId(r.getId())
                .email("admin@ucsb.edu")
                .testApplication(true)
                .build());
    entityManager.flush();
    entityManager.clear();

    assertFalse(applicationRepository.findById(real.getId()).orElseThrow().isTestApplication());
    assertTrue(applicationRepository.findById(test.getId()).orElseThrow().isTestApplication());
  }

  private long interestRows() {
    return ((Number)
            entityManager
                .getEntityManager()
                .createNativeQuery("select count(*) from application_course_interests")
                .getSingleResult())
        .longValue();
  }

  /**
   * The table added by changeset 010: an update replaces the earlier rows rather than piling up,
   * and deleting the application takes its rows with it via the cascading foreign key.
   */
  @Test
  public void course_interests_are_replaced_on_update_and_deleted_with_the_application() {
    Recruitment r = recruitment("20261", RecruitmentType.TA);
    Application saved =
        applicationRepository.save(
            Application.builder()
                .recruitmentId(r.getId())
                .email("grad@ucsb.edu")
                .courseInterests(
                    new HashMap<>(
                        Map.of(
                            "CMPSC     8",
                            CourseInterest.ENTHUSIASTIC,
                            "CMPSC    16",
                            CourseInterest.WOULD_CONSIDER)))
                .build());
    entityManager.flush();
    entityManager.clear();
    assertEquals(2, interestRows());

    Application loaded = applicationRepository.findById(saved.getId()).orElseThrow();
    loaded.setCourseInterests(new HashMap<>(Map.of("CMPSC    24", CourseInterest.ENTHUSIASTIC)));
    applicationRepository.save(loaded);
    entityManager.flush();
    entityManager.clear();

    assertEquals(
        Map.of("CMPSC    24", CourseInterest.ENTHUSIASTIC),
        applicationRepository.findById(saved.getId()).orElseThrow().getCourseInterests());
    assertEquals(1, interestRows());

    applicationRepository.deleteById(saved.getId());
    entityManager.flush();
    assertEquals(0, interestRows());
  }

  @Test
  public void topic_ratings_are_replaced_on_update_and_deleted_with_the_application() {
    Recruitment r = recruitment("20261", RecruitmentType.TA);
    Application saved =
        applicationRepository.save(
            Application.builder()
                .recruitmentId(r.getId())
                .email("grad@ucsb.edu")
                .topicProficiencies(new HashMap<>(Map.of("Java", 5, "React", 3)))
                .build());
    entityManager.flush();
    entityManager.clear();

    Application loaded = applicationRepository.findById(saved.getId()).orElseThrow();
    loaded.setTopicProficiencies(new HashMap<>(Map.of("Python", 2)));
    applicationRepository.save(loaded);
    entityManager.flush();
    entityManager.clear();

    assertEquals(
        Map.of("Python", 2),
        applicationRepository.findById(saved.getId()).orElseThrow().getTopicProficiencies());

    applicationRepository.deleteById(saved.getId());
    entityManager.flush();
    assertEquals(
        0L,
        ((Number)
                entityManager
                    .getEntityManager()
                    .createNativeQuery("select count(*) from application_topic_proficiencies")
                    .getSingleResult())
            .longValue());
  }

  /** The admin review page lists a recruitment's applications in the order they arrived. */
  @Test
  public void applications_to_a_recruitment_are_found_oldest_first_with_their_submission_time() {
    Recruitment r = recruitment("20261", RecruitmentType.TA);
    Recruitment other = recruitment("20262", RecruitmentType.ULA);
    Application second =
        applicationRepository.save(
            Application.builder().recruitmentId(r.getId()).email("b@ucsb.edu").build());
    Application first =
        applicationRepository.save(
            Application.builder().recruitmentId(r.getId()).email("a@ucsb.edu").build());
    applicationRepository.save(
        Application.builder().recruitmentId(other.getId()).email("c@ucsb.edu").build());
    entityManager.flush();
    entityManager.clear();

    List<Application> found = applicationRepository.findByRecruitmentIdOrderByIdAsc(r.getId());
    assertEquals(
        List.of(second.getId(), first.getId()), found.stream().map(Application::getId).toList());
    // Stamped on insert (changeset 016), so the page can show when each one came in.
    assertNotNull(found.get(0).getSubmittedAt());
    assertNull(found.get(0).getAdminComments());
    assertEquals(List.of(), applicationRepository.findByRecruitmentIdOrderByIdAsc(999L));
  }

  /** The admin's notes are stored with the application and survive a reload. */
  @Test
  public void admin_comments_are_stored_and_the_submission_time_is_not_changed_by_an_edit() {
    Recruitment r = recruitment("20261", RecruitmentType.TA);
    Application saved =
        applicationRepository.save(
            Application.builder().recruitmentId(r.getId()).email("a@ucsb.edu").build());
    entityManager.flush();
    entityManager.clear();
    LocalDateTime submitted =
        applicationRepository.findById(saved.getId()).orElseThrow().getSubmittedAt();

    Application loaded = applicationRepository.findById(saved.getId()).orElseThrow();
    loaded.setAdminComments("Strong candidate");
    loaded.setSubmittedAt(LocalDateTime.of(2000, 1, 1, 0, 0));
    applicationRepository.save(loaded);
    entityManager.flush();
    entityManager.clear();

    Application again = applicationRepository.findById(saved.getId()).orElseThrow();
    assertEquals("Strong candidate", again.getAdminComments());
    // updatable = false: the stamp set on insert wins over the value an edit tried to write.
    assertEquals(submitted, again.getSubmittedAt());
  }

  @Test
  public void interest_levels_are_replaced_on_update_and_deleted_with_the_application() {
    Recruitment r = recruitment("20261", RecruitmentType.ULA);
    Application saved =
        applicationRepository.save(
            Application.builder()
                .recruitmentId(r.getId())
                .email("ula@ucsb.edu")
                .interests(new HashMap<>(Map.of("Tutoring", 4, "Grading", 1)))
                .build());
    entityManager.flush();
    entityManager.clear();

    Application loaded = applicationRepository.findById(saved.getId()).orElseThrow();
    loaded.setInterests(new HashMap<>(Map.of("Office hours", 5)));
    applicationRepository.save(loaded);
    entityManager.flush();
    entityManager.clear();

    assertEquals(
        Map.of("Office hours", 5),
        applicationRepository.findById(saved.getId()).orElseThrow().getInterests());

    applicationRepository.deleteById(saved.getId());
    entityManager.flush();
    assertEquals(
        0L,
        ((Number)
                entityManager
                    .getEntityManager()
                    .createNativeQuery("select count(*) from application_interests")
                    .getSingleResult())
            .longValue());
  }

  @Test
  public void prior_coursework_is_replaced_on_update_and_deleted_with_the_application() {
    Recruitment r = recruitment("20261", RecruitmentType.TA);
    Application saved =
        applicationRepository.save(
            Application.builder()
                .recruitmentId(r.getId())
                .email("grad@ucsb.edu")
                .priorCoursework(
                    new ArrayList<>(
                        List.of(
                            PriorCoursework.builder().courseNumber("OLD 1").build(),
                            PriorCoursework.builder().courseNumber("OLD 2").build())))
                .build());
    entityManager.flush();
    entityManager.clear();

    Application loaded = applicationRepository.findById(saved.getId()).orElseThrow();
    loaded.getPriorCoursework().clear();
    loaded.getPriorCoursework().add(PriorCoursework.builder().courseNumber("NEW 1").build());
    applicationRepository.save(loaded);
    entityManager.flush();
    entityManager.clear();

    assertEquals(
        List.of("NEW 1"),
        applicationRepository.findById(saved.getId()).orElseThrow().getPriorCoursework().stream()
            .map(PriorCoursework::getCourseNumber)
            .toList());
    assertEquals(1L, countRows("prior_coursework"));

    applicationRepository.deleteById(saved.getId());
    entityManager.flush();
    assertEquals(0L, countRows("prior_coursework"));
  }

  private long countRows(String table) {
    return ((Number)
            entityManager
                .getEntityManager()
                .createNativeQuery("select count(*) from " + table)
                .getSingleResult())
        .longValue();
  }
}
