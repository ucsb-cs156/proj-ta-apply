package edu.ucsb.cs.taapply.entity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.BudgetRepository;
import edu.ucsb.cs.taapply.repository.InstructorFeedbackRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;

/** The instructor_feedback table round-trips through the Liquibase schema (issue #425). */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class InstructorFeedbackPersistenceTests {
  @Autowired BudgetRepository budgets;
  @Autowired RecruitmentRepository recruitments;
  @Autowired RecruitmentCourseRepository recruitmentCourses;
  @Autowired InstructorFeedbackRepository feedback;
  @Autowired TestEntityManager entityManager;

  private Long courseId;

  @BeforeEach
  void aCourseInABudgetedQuarter() {
    budgets.save(Budget.builder().quarter("20264").build());
    Recruitment recruitment =
        recruitments.save(
            Recruitment.builder()
                .quarter("20264")
                .type(RecruitmentType.TA)
                .tentativeOpeningDate(LocalDate.of(2026, 9, 1))
                .primaryConsiderationDate(LocalDate.of(2026, 9, 15))
                .build());
    courseId =
        recruitmentCourses
            .save(
                RecruitmentCourse.builder()
                    .recruitmentId(recruitment.getId())
                    .courseId("CMPSC   156")
                    .enrollCode("07492")
                    .section("0100")
                    .build())
            .getId();
  }

  private InstructorFeedback.InstructorFeedbackBuilder row() {
    return InstructorFeedback.builder()
        .quarter("20264")
        .email("pconrad@ucsb.edu")
        .recruitmentCourseId(courseId);
  }

  @Test
  void a_row_keeps_every_column() {
    LocalDateTime saved = LocalDateTime.of(2026, 11, 8, 14, 5, 0);
    String comments = "x".repeat(InstructorFeedback.MAX_COMMENTS);
    feedback.save(
        row()
            .allocReasonable(true)
            .differentTACount(true)
            .differentULACount(true)
            .otherConcerns(true)
            .numTAsPreferred(3)
            .numULAsPreferred(0)
            .comments(comments)
            .lastUpdated(saved)
            .build());
    entityManager.flush();
    entityManager.clear();

    InstructorFeedback found =
        feedback
            .findByQuarterAndEmailAndRecruitmentCourseId("20264", "pconrad@ucsb.edu", courseId)
            .orElseThrow();
    assertTrue(found.isAllocReasonable());
    assertTrue(found.isDifferentTACount());
    assertTrue(found.isDifferentULACount());
    assertTrue(found.isOtherConcerns());
    assertEquals(3, found.getNumTAsPreferred());
    assertEquals(0, found.getNumULAsPreferred());
    assertEquals(comments, found.getComments());
    assertEquals(saved, found.getLastUpdated());
    assertEquals(1, feedback.findByEmail("pconrad@ucsb.edu").size());
    assertTrue(feedback.findByEmail("someone@ucsb.edu").isEmpty());
  }

  @Test
  void a_new_row_has_every_box_unchecked_and_nothing_else() {
    feedback.save(row().build());
    entityManager.flush();
    entityManager.clear();

    InstructorFeedback found = feedback.findByEmail("pconrad@ucsb.edu").get(0);
    assertFalse(found.isAllocReasonable());
    assertFalse(found.isDifferentTACount());
    assertFalse(found.isDifferentULACount());
    assertFalse(found.isOtherConcerns());
    assertNull(found.getNumTAsPreferred());
    assertNull(found.getNumULAsPreferred());
    assertNull(found.getComments());
    assertNull(found.getLastUpdated());
  }

  @Test
  void the_booleans_default_to_false_in_the_database_too() {
    entityManager
        .getEntityManager()
        .createNativeQuery(
            "INSERT INTO instructor_feedback (quarter, email, recruitment_course_id) VALUES"
                + " ('20264', 'pconrad@ucsb.edu', "
                + courseId
                + ")")
        .executeUpdate();
    entityManager.clear();

    InstructorFeedback found = feedback.findByEmail("pconrad@ucsb.edu").get(0);
    assertFalse(found.isAllocReasonable());
    assertFalse(found.isOtherConcerns());
  }

  @Test
  void one_row_per_quarter_instructor_and_course() {
    feedback.save(row().build());
    entityManager.flush();
    // A co-instructor has a row of their own.
    feedback.save(row().email("coteacher@ucsb.edu").build());
    entityManager.flush();

    assertThrows(
        DataIntegrityViolationException.class,
        () -> {
          feedback.save(row().build());
          entityManager.flush();
        });
  }

  @Test
  void the_quarter_must_have_a_budget() {
    assertThrows(
        DataIntegrityViolationException.class,
        () -> {
          feedback.save(row().quarter("20271").build());
          entityManager.flush();
        });
  }

  @Test
  void the_course_must_exist() {
    assertThrows(
        DataIntegrityViolationException.class,
        () -> {
          feedback.save(row().recruitmentCourseId(courseId + 1000).build());
          entityManager.flush();
        });
  }

  @Test
  void the_comments_hold_no_more_than_2048_characters() {
    assertThrows(
        DataIntegrityViolationException.class,
        () -> {
          feedback.save(row().comments("x".repeat(InstructorFeedback.MAX_COMMENTS + 1)).build());
          entityManager.flush();
        });
  }

  @Test
  void deleting_the_course_takes_its_feedback_with_it() {
    feedback.save(row().build());
    entityManager.flush();

    entityManager
        .getEntityManager()
        .createNativeQuery("DELETE FROM recruitment_courses WHERE id = " + courseId)
        .executeUpdate();
    entityManager.clear();

    assertTrue(feedback.findByEmail("pconrad@ucsb.edu").isEmpty());
  }
}
