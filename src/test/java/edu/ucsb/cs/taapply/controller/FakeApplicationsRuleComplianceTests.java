package edu.ucsb.cs.taapply.controller;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import edu.ucsb.cs.taapply.controller.ApplicationsController.ApplicationFields;
import edu.ucsb.cs.taapply.controller.ApplicationsController.PriorCourseworkFields;
import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.TaTopic;
import edu.ucsb.cs.taapply.entity.UlaInterest;
import edu.ucsb.cs.taapply.entity.UlaTopic;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.CourseRepository;
import edu.ucsb.cs.taapply.repository.TaMajorRepository;
import edu.ucsb.cs.taapply.repository.TaTopicRepository;
import edu.ucsb.cs.taapply.repository.UlaInterestRepository;
import edu.ucsb.cs.taapply.repository.UlaMajorRepository;
import edu.ucsb.cs.taapply.repository.UlaTopicRepository;
import edu.ucsb.cs.taapply.services.fake.FakeApplicationGenerator;
import edu.ucsb.cs.taapply.services.fake.FakeCoursework;
import edu.ucsb.cs.taapply.services.fake.FakeCoverage;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import org.junit.jupiter.api.Test;

/**
 * A fake application must pass every rule a real one is held to (issues #213 and #214, and the
 * prior coursework minimum), or it could not stand in for one. The checks here are the controller's
 * own, run on what the generator produces.
 */
public class FakeApplicationsRuleComplianceTests {

  private static final List<String> COURSES = List.of("CMPSC   16", "CMPSC  156", "CMPSC  170");

  private final TaTopicRepository taTopics = mock(TaTopicRepository.class);
  private final UlaTopicRepository ulaTopics = mock(UlaTopicRepository.class);
  private final UlaInterestRepository ulaInterests = mock(UlaInterestRepository.class);
  private final FakeApplicationGenerator generator =
      new FakeApplicationGenerator(
          new FakeCoursework(),
          mock(CourseRepository.class),
          taTopics,
          ulaTopics,
          ulaInterests,
          mock(TaMajorRepository.class),
          mock(UlaMajorRepository.class));

  private static ApplicationFields fieldsOf(Application a) {
    List<PriorCourseworkFields> prior =
        a.getPriorCoursework().stream()
            .map(
                c ->
                    new PriorCourseworkFields(
                        c.isUcsbCourse(),
                        c.getOtherSchool(),
                        c.getCourseNumber(),
                        c.getCourseTitle(),
                        c.getTerm(),
                        c.getGrade()))
            .toList();
    return new ApplicationFields(
        a.getFirstName(),
        a.getMiddleName(),
        a.getLastName(),
        a.getMajor(),
        a.getGpaMajor(),
        a.getGpaOverall(),
        a.getYearInProgram(),
        a.getGraduationDate(),
        prior,
        a.getTopicProficiencies(),
        a.getInterests(),
        a.getPrevExperience(),
        a.getComments(),
        a.getFirstChoiceCourse(),
        a.getSecondChoiceCourse(),
        a.isAvailableForLecturesFirstChoice(),
        a.isAvailableForLecturesSecondChoice(),
        a.isAvailableForDiscussionFirstChoice(),
        a.isAvailableForDiscussionSecondChoice(),
        a.getAvailabilityCommentsFirstChoice(),
        a.getAvailabilityCommentsSecondChoice(),
        a.getCourseInterests(),
        a.getResidencyStatus(),
        a.getLanguageExam(),
        a.getLanguageExamDatePassed(),
        a.getClassLevel(),
        a.getVideoLink(),
        a.getPreviousServiceAsUla(),
        a.getPermNumber(),
        a.getBsMsStudent(),
        a.getStudentStatusNextQuarter(),
        a.getWantsTaEligibility(),
        a.getOtherCampusJob(),
        a.getPriorUcsbEmployment(),
        a.getEmployeeId(),
        a.getI9Appointment(),
        a.getTrainingCommitment(),
        a.getTrainingCommitmentExplanation(),
        a.getChangingMajor(),
        a.getNoticeVersionId(),
        a.isFirstQuarter());
  }

  private void check(RecruitmentType type) {
    when(taTopics.findAll()).thenReturn(List.of(TaTopic.builder().name("Python").build()));
    when(ulaTopics.findAll()).thenReturn(List.of(UlaTopic.builder().name("Git").build()));
    when(ulaInterests.findAll()).thenReturn(List.of(UlaInterest.builder().name("Grading").build()));
    Recruitment recruitment = Recruitment.builder().id(1L).quarter("20261").type(type).build();

    for (Application a :
        generator.generate(
            recruitment,
            COURSES,
            500,
            FakeCoverage.ALL,
            new Random(11),
            new HashSet<>(),
            java.time.LocalDate.of(2026, 2, 10))) {
      ApplicationFields fields = fieldsOf(a);
      ApplicationsController.requireCoursework(type, fields);
      ApplicationsController.requireUlaAnswers(type, fields);
      ApplicationsController.requireTaAnswers(type, fields);
    }
  }

  @Test
  public void fake_ta_applications_pass_the_ta_rules() {
    check(RecruitmentType.TA);
  }

  @Test
  public void fake_ula_applications_pass_the_ula_rules() {
    check(RecruitmentType.ULA);
  }
}
