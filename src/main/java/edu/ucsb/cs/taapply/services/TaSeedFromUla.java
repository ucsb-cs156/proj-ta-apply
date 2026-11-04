package edu.ucsb.cs.taapply.services;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.PriorCoursework;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Issue #307: the answers a person's first TA application starts with when all they have on file is
 * a ULA application. A pure function of the ULA application: nothing is read from or written to a
 * database.
 *
 * <p>The result is built from scratch with only the fields that mean the same thing on both forms,
 * rather than by copying the ULA application and clearing what does not belong. A field added to
 * {@link Application} later is therefore left out of the seed until someone decides it should carry
 * over, so nothing (review state, admin notes, cancellation, ids, timestamps, ULA-only answers) can
 * leak into a TA application by accident.
 *
 * <p>What carries over: the three name fields, the major, the previous teaching experience, the
 * "anything else" comments, the prior coursework (as new rows, without ids), the first and second
 * choice courses, the interest in each other course, and the topic ratings (translated to the TA 1
 * to 5 scale). The course and topic answers are keyed by name and the ULA recruitment need not
 * offer what the TA one does, so the apply page keeps only those that the new recruitment also has.
 * What does not carry over, and why, is tabled in docs/design/InitialDesign.md and on the applicant
 * Help pages: the GPAs, the first quarter box, year in program and graduation date describe the
 * person as an undergraduate; the availability answers have no place on the TA form; the notice
 * agreement is to the other form's notice; and the ULA-only questions and interest areas have no TA
 * counterpart.
 */
public final class TaSeedFromUla {
  private TaSeedFromUla() {}

  /** The ULA application's carried-over answers, as an unsaved TA-shaped application. */
  public static Application seed(Application ula) {
    return Application.builder()
        .firstName(ula.getFirstName())
        .middleName(ula.getMiddleName())
        .lastName(ula.getLastName())
        .major(ula.getMajor())
        .prevExperience(ula.getPrevExperience())
        .comments(ula.getComments())
        .firstChoiceCourse(ula.getFirstChoiceCourse())
        .secondChoiceCourse(ula.getSecondChoiceCourse())
        .courseInterests(new HashMap<>(ula.getCourseInterests()))
        .topicProficiencies(toTaScale(ula.getTopicProficiencies()))
        .priorCoursework(copyOfCoursework(ula.getPriorCoursework()))
        .build();
  }

  /**
   * The ULA scale runs 1 (very comfortable) to 3 (not familiar); the TA scale 1 (lowest) to 5
   * (highest). So 1 becomes 5, 2 becomes 3 and 3 becomes 1.
   */
  private static Map<String, Integer> toTaScale(Map<String, Integer> ulaRatings) {
    Map<String, Integer> ta = new HashMap<>();
    ulaRatings.forEach((topic, level) -> ta.put(topic, 7 - 2 * level));
    return ta;
  }

  private static List<PriorCoursework> copyOfCoursework(List<PriorCoursework> courses) {
    return courses.stream()
        .map(
            course ->
                PriorCoursework.builder()
                    .ucsbCourse(course.isUcsbCourse())
                    .otherSchool(course.getOtherSchool())
                    .courseNumber(course.getCourseNumber())
                    .courseTitle(course.getCourseTitle())
                    .term(course.getTerm())
                    .grade(course.getGrade())
                    .build())
        .toList();
  }
}
