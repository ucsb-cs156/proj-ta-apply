package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.DraftApplication;
import edu.ucsb.cs.taapply.entity.PriorCoursework;
import edu.ucsb.cs.taapply.enums.ApplicationOrigin;
import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import edu.ucsb.cs.taapply.enums.ClassLevel;
import edu.ucsb.cs.taapply.enums.CourseInterest;
import edu.ucsb.cs.taapply.enums.LanguageExamStatus;
import edu.ucsb.cs.taapply.enums.OtherCampusJob;
import edu.ucsb.cs.taapply.enums.ResidencyStatus;
import edu.ucsb.cs.taapply.enums.StudentStatus;
import edu.ucsb.cs.taapply.enums.TrainingCommitment;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

/**
 * Issue #420: the draft made from a cancelled application holds every answer the two share, and
 * nothing that only a submitted application has.
 */
public class DraftApplicationServiceTests {

  /** What a draft has that no application gives it. */
  private static final Set<String> DRAFT_ONLY = Set.of("id", "version", "updatedAt");

  /**
   * What an application has that its draft does not: the review, the cancellation, the staff's
   * notes and plans, and the bookkeeping of the submitted row. The admin comments travel
   * separately, to the draft's own comment row. Whether an admin hid the application (issue #440)
   * does not travel: a draft is on no list an application can be hidden from, and the application
   * submitted from it is a new one.
   */
  private static final Set<String> APPLICATION_ONLY =
      Set.of(
          "id",
          "version",
          "attemptNumber",
          "status",
          "postApplicationComments",
          "submittedAt",
          "adminComments",
          "origin",
          "hidden",
          "cancellationReason",
          "cancelledAt",
          "tentativeAssignmentId");

  /** Every answer filled in, each with a value no default would have. */
  private static Application everythingAnswered() {
    return Application.builder()
        .id(50L)
        .version(4)
        .attemptNumber(2)
        .recruitmentId(1L)
        .email("ada@ucsb.edu")
        .status(ApplicationReviewStatus.CANCELLED)
        .postApplicationComments("Since applying")
        .submittedAt(LocalDateTime.of(2026, 10, 1, 8, 0))
        .adminComments("Strong in 156")
        .origin(ApplicationOrigin.ADMIN_TEST)
        .noticeVersionId(7L)
        .firstName("Ada")
        .middleName("B")
        .lastName("Lovelace")
        .major("Computer Science")
        .gpaMajor(3.5)
        .gpaOverall(3.25)
        .firstQuarter(true)
        .yearInProgram("Third")
        .graduationDate("S27")
        .prevExperience("Some experience")
        .comments("Some comments")
        .firstChoiceCourse("CMPSC   156")
        .secondChoiceCourse("CMPSC   130A")
        .availableForLecturesFirstChoice(true)
        .availableForLecturesSecondChoice(true)
        .availableForDiscussionFirstChoice(true)
        .availableForDiscussionSecondChoice(true)
        .availabilityCommentsFirstChoice("Mornings")
        .availabilityCommentsSecondChoice("Afternoons")
        .courseInterests(new HashMap<>(Map.of("CMPSC   8", CourseInterest.ENTHUSIASTIC)))
        .topicProficiencies(new HashMap<>(Map.of("Java", 4)))
        .interests(new HashMap<>(Map.of("Research", 3)))
        .priorCoursework(
            new ArrayList<>(
                List.of(
                    PriorCoursework.builder()
                        .id(900L)
                        .ucsbCourse(false)
                        .otherSchool("De Anza")
                        .courseNumber("CIS 22A")
                        .courseTitle("Intro")
                        .term("F24")
                        .grade("A")
                        .build())))
        .residencyStatus(ResidencyStatus.US_CITIZEN)
        .languageExam(LanguageExamStatus.PASSED_F1_OR_J1_VISA)
        .languageExamDatePassed("F25")
        .classLevel(ClassLevel.PHD)
        .videoLink("https://example.org/video")
        .previousServiceAsUla(2)
        .permNumber("A1B2C3D")
        .bsMsStudent(true)
        .studentStatusNextQuarter(StudentStatus.UNDERGRADUATE)
        .wantsTaEligibility(true)
        .otherCampusJob(OtherCampusJob.NO)
        .priorUcsbEmployment(true)
        .employeeId("1234567")
        .i9Appointment(true)
        .trainingCommitment(TrainingCommitment.AGREE)
        .trainingCommitmentExplanation("Because")
        .changingMajor(true)
        .cancellationReason("Took an internship")
        .cancelledAt(LocalDateTime.of(2026, 11, 1, 9, 30))
        .tentativeAssignmentId(33L)
        .build();
  }

  private static Set<String> fieldNames(Class<?> type) {
    return Arrays.stream(type.getDeclaredFields())
        .filter(f -> !Modifier.isStatic(f.getModifiers()))
        .map(Field::getName)
        .collect(Collectors.toCollection(TreeSet::new));
  }

  private static Object valueOf(Object target, String name) throws Exception {
    Field field = target.getClass().getDeclaredField(name);
    field.setAccessible(true);
    return field.get(target);
  }

  /** A prior course row without its id, which a draft's copies never have. */
  private static PriorCoursework withoutId(PriorCoursework row) {
    return PriorCoursework.builder()
        .ucsbCourse(row.isUcsbCourse())
        .otherSchool(row.getOtherSchool())
        .courseNumber(row.getCourseNumber())
        .courseTitle(row.getCourseTitle())
        .term(row.getTerm())
        .grade(row.getGrade())
        .build();
  }

  /**
   * The two entities' fields are those shared, plus each one's own; a field added to one and not
   * the other fails here until someone decides whether it carries over.
   */
  @Test
  public void the_shared_fields_are_everything_but_each_ones_own() {
    Set<String> shared = fieldNames(Application.class);
    shared.removeAll(APPLICATION_ONLY);
    Set<String> draftShared = fieldNames(DraftApplication.class);
    draftShared.removeAll(DRAFT_ONLY);
    assertEquals(shared, draftShared);
  }

  @Test
  public void every_shared_answer_is_copied() throws Exception {
    Application application = everythingAnswered();

    DraftApplication draft = DraftApplicationService.draftFrom(application);

    Set<String> shared = fieldNames(DraftApplication.class);
    shared.removeAll(DRAFT_ONLY);
    for (String name : shared) {
      Object expected = valueOf(application, name);
      assertNotNull(expected, name);
      if (name.equals("priorCoursework")) {
        expected = application.getPriorCoursework().stream().map(r -> withoutId(r)).toList();
      }
      assertEquals(expected, valueOf(draft, name), name);
    }
    for (String name : DRAFT_ONLY) {
      assertNull(valueOf(draft, name), name);
    }
  }

  /** The draft's collections are its own, so changing one leaves the application as it was. */
  @Test
  public void the_draft_s_collections_are_copies() {
    Application application = everythingAnswered();

    DraftApplication draft = DraftApplicationService.draftFrom(application);
    draft.getCourseInterests().clear();
    draft.getTopicProficiencies().clear();
    draft.getInterests().clear();
    draft.getPriorCoursework().clear();

    assertEquals(1, application.getCourseInterests().size());
    assertEquals(1, application.getTopicProficiencies().size());
    assertEquals(1, application.getInterests().size());
    assertEquals(1, application.getPriorCoursework().size());
    assertEquals(900L, application.getPriorCoursework().get(0).getId());
  }

  /** Unticked boxes copy as false, not as unanswered. */
  @Test
  public void false_answers_stay_false() {
    Application application =
        Application.builder().recruitmentId(1L).email("ada@ucsb.edu").firstName("Ada").build();

    DraftApplication draft = DraftApplicationService.draftFrom(application);

    assertEquals(Boolean.FALSE, draft.getFirstQuarter());
    assertEquals(Boolean.FALSE, draft.getAvailableForLecturesFirstChoice());
    assertEquals(Boolean.FALSE, draft.getAvailableForLecturesSecondChoice());
    assertEquals(Boolean.FALSE, draft.getAvailableForDiscussionFirstChoice());
    assertEquals(Boolean.FALSE, draft.getAvailableForDiscussionSecondChoice());
  }

  /** The form tells a draft it has saved by its first name, so the draft always has one. */
  @Test
  public void a_missing_first_name_becomes_empty() {
    Application application = Application.builder().recruitmentId(1L).email("ada@ucsb.edu").build();

    assertEquals("", DraftApplicationService.draftFrom(application).getFirstName());
  }
}
