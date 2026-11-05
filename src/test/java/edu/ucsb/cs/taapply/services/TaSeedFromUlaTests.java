package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.PriorCoursework;
import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import edu.ucsb.cs.taapply.enums.CourseInterest;
import edu.ucsb.cs.taapply.enums.OtherCampusJob;
import edu.ucsb.cs.taapply.enums.StudentStatus;
import edu.ucsb.cs.taapply.enums.TrainingCommitment;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

public class TaSeedFromUlaTests {

  private static Application fullUla() {
    return Application.builder()
        .id(7L)
        .recruitmentId(3L)
        .version(4)
        .attemptNumber(2)
        .email("ula@ucsb.edu")
        .status(ApplicationReviewStatus.HIRED)
        .postApplicationComments("post")
        .submittedAt(LocalDateTime.of(2025, 1, 2, 3, 4))
        .adminComments("admin")
        .noticeVersionId(9L)
        .firstName("Ula")
        .middleName("M")
        .lastName("Learner")
        .major("Computer Science")
        .gpaMajor(3.9)
        .gpaOverall(3.8)
        .firstQuarter(true)
        .yearInProgram("3rd")
        .graduationDate("2027")
        .prevExperience("tutored")
        .comments("hello")
        .firstChoiceCourse("CMPSC   8")
        .secondChoiceCourse("CMPSC  16")
        .availableForLecturesFirstChoice(true)
        .availableForLecturesSecondChoice(true)
        .availableForDiscussionFirstChoice(true)
        .availableForDiscussionSecondChoice(true)
        .availabilityCommentsFirstChoice("mwf")
        .availabilityCommentsSecondChoice("tr")
        .courseInterests(Map.of("CMPSC  24", CourseInterest.ENTHUSIASTIC))
        .topicProficiencies(Map.of("Python", 1, "Java", 2, "Git", 3))
        .interests(Map.of("Teaching", 5))
        .priorCoursework(
            List.of(
                PriorCoursework.builder()
                    .id(11L)
                    .ucsbCourse(false)
                    .otherSchool("SBCC")
                    .courseNumber("CS 101")
                    .courseTitle("Intro")
                    .term("F24")
                    .grade("A")
                    .build(),
                PriorCoursework.builder().id(12L).courseNumber("CMPSC 156").build()))
        .videoLink("https://example.org/v")
        .previousServiceAsUla(2)
        .permNumber("1234567")
        .bsMsStudent(true)
        .studentStatusNextQuarter(StudentStatus.GRADUATE)
        .wantsTaEligibility(true)
        .otherCampusJob(OtherCampusJob.NO)
        .priorUcsbEmployment(true)
        .employeeId("123")
        .i9Appointment(true)
        .trainingCommitment(TrainingCommitment.UNSURE)
        .trainingCommitmentExplanation("why")
        .changingMajor(true)
        .cancellationReason("because")
        .cancelledAt(LocalDateTime.of(2025, 2, 3, 4, 5))
        .tentativeAssignmentId(5L)
        .build();
  }

  @Test
  public void answers_that_mean_the_same_thing_carry_over() {
    Application seed = TaSeedFromUla.seed(fullUla());

    assertEquals("Ula", seed.getFirstName());
    assertEquals("M", seed.getMiddleName());
    assertEquals("Learner", seed.getLastName());
    assertEquals("Computer Science", seed.getMajor());
    assertEquals("tutored", seed.getPrevExperience());
    assertEquals("hello", seed.getComments());
  }

  @Test
  public void course_choices_and_interests_carry_over_by_name_as_copies() {
    Application ula = fullUla();
    Application seed = TaSeedFromUla.seed(ula);

    assertEquals("CMPSC   8", seed.getFirstChoiceCourse());
    assertEquals("CMPSC  16", seed.getSecondChoiceCourse());
    assertEquals(Map.of("CMPSC  24", CourseInterest.ENTHUSIASTIC), seed.getCourseInterests());
    assertNotSame(ula.getCourseInterests(), seed.getCourseInterests());
  }

  /** ULA 1 (very comfortable) to 3 (not familiar) becomes TA 5 (highest) to 1 (lowest). */
  @Test
  public void topic_ratings_are_translated_to_the_ta_scale() {
    Application seed = TaSeedFromUla.seed(fullUla());

    assertEquals(Map.of("Python", 5, "Java", 3, "Git", 1), seed.getTopicProficiencies());
  }

  @Test
  public void prior_coursework_is_copied_as_new_rows_without_ids() {
    Application ula = fullUla();
    Application seed = TaSeedFromUla.seed(ula);

    assertEquals(2, seed.getPriorCoursework().size());
    PriorCoursework first = seed.getPriorCoursework().get(0);
    assertNull(first.getId());
    assertFalse(first.isUcsbCourse());
    assertEquals("SBCC", first.getOtherSchool());
    assertEquals("CS 101", first.getCourseNumber());
    assertEquals("Intro", first.getCourseTitle());
    assertEquals("F24", first.getTerm());
    assertEquals("A", first.getGrade());
    PriorCoursework second = seed.getPriorCoursework().get(1);
    assertNull(second.getId());
    assertTrue(second.isUcsbCourse());
    assertNotSame(ula.getPriorCoursework().get(1), second);
  }

  /**
   * Issue #334: a ULA application that lists a course twice seeds a TA application with it once.
   */
  @Test
  public void identical_courses_are_seeded_once() {
    Application ula = fullUla();
    ula.setPriorCoursework(
        List.of(
            PriorCoursework.builder().courseNumber("CMPSC 8").term("F24").grade("A").build(),
            PriorCoursework.builder().courseNumber("cmpsc8").term("F24").grade("B").build(),
            PriorCoursework.builder().courseNumber("CMPSC 8").term("W25").grade("C").build()));

    List<PriorCoursework> seeded = TaSeedFromUla.seed(ula).getPriorCoursework();

    assertEquals(List.of("B", "C"), seeded.stream().map(PriorCoursework::getGrade).toList());
  }

  /**
   * Everything else is as on a brand new application: no ids, no state, no availability, no
   * ULA-only answers.
   */
  @Test
  public void nothing_else_carries_over() {
    Application seed = TaSeedFromUla.seed(fullUla());
    Application expected =
        Application.builder()
            .firstName("Ula")
            .middleName("M")
            .lastName("Learner")
            .major("Computer Science")
            .prevExperience("tutored")
            .comments("hello")
            .firstChoiceCourse("CMPSC   8")
            .secondChoiceCourse("CMPSC  16")
            .courseInterests(Map.of("CMPSC  24", CourseInterest.ENTHUSIASTIC))
            .topicProficiencies(Map.of("Python", 5, "Java", 3, "Git", 1))
            .priorCoursework(seed.getPriorCoursework())
            .build();

    assertEquals(expected, seed);
    assertEquals(ApplicationReviewStatus.PENDING, seed.getStatus());
  }
}
