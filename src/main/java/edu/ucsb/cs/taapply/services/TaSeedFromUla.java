package edu.ucsb.cs.taapply.services;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.PriorCoursework;
import java.util.List;

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
 * "anything else" comments and the prior coursework (as new rows, without ids). What does not, and
 * why, is tabled in docs/design/InitialDesign.md and on the applicant Help pages: the GPAs, the
 * first quarter box, year in program and graduation date describe the person as an undergraduate;
 * the course choices, availability and course interests refer to the ULA recruitment's courses; the
 * topic ratings use a different scale; the notice agreement is to the other form's notice; and the
 * ULA-only questions have no TA counterpart.
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
        .priorCoursework(copyOfCoursework(ula.getPriorCoursework()))
        .build();
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
