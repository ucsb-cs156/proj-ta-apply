package edu.ucsb.cs.taapply.jobs;

import edu.ucsb.cs.taapply.entity.Course;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.models.UcsbCourseOffering;
import edu.ucsb.cs.taapply.models.UcsbInstructor;
import edu.ucsb.cs.taapply.models.UcsbSection;
import edu.ucsb.cs.taapply.models.UcsbTimeLocation;
import edu.ucsb.cs.taapply.repository.CourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.services.UCSBCurriculumService;
import edu.ucsb.cs156.jobs.services.JobContext;
import edu.ucsb.cs156.jobs.services.JobContextConsumer;
import edu.ucsb.cs156.jobs.services.JobRateLimit;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;

/**
 * Fills a recruitment's course list: every primary section, of every course flagged for this
 * recruitment's type, that is actually offered in its quarter.
 *
 * <p>Three things this must get right:
 *
 * <ul>
 *   <li>A course with two lectures produces two rows, keyed on enroll code. They are planned
 *       separately and often have different instructors.
 *   <li>A row the admin removed stays removed. Re-running must not undo that decision.
 *   <li>Which courses are eligible follows the recruitment type: TA reads {@code needsTa}, ULA
 *       reads {@code needsUla}.
 * </ul>
 */
@Builder
@Getter
@AllArgsConstructor
@Slf4j
public class PopulateRecruitmentCoursesJob implements JobContextConsumer {

  private Recruitment recruitment;
  private String subjectArea;
  private UCSBCurriculumService ucsbCurriculumService;
  private CourseRepository courseRepository;
  private RecruitmentCourseRepository recruitmentCourseRepository;
  private JobRateLimit jobRateLimit;

  @Override
  public void accept(JobContext ctx) throws Exception {
    String quarter = recruitment.getQuarter();
    RecruitmentType type = recruitment.getType();

    Set<String> wanted = eligibleCourseIds();
    ctx.log(
        String.format(
            "Populating %s recruitment for %s: %d course(s) flagged for %s",
            type, quarter, wanted.size(), type));

    if (wanted.isEmpty()) {
      ctx.log("No courses are flagged for this type; nothing to do.");
      return;
    }

    ctx.checkCancellation();
    jobRateLimit.sleep();

    List<UcsbCourseOffering> offerings;
    try {
      offerings = ucsbCurriculumService.getOfferings(subjectArea, quarter);
    } catch (Exception e) {
      ctx.log(String.format("Error fetching offerings for %s: %s", quarter, e.getMessage()));
      log.error("Error fetching offerings for {}", quarter, e);
      throw e;
    }

    int added = 0;
    int updated = 0;
    int skippedRemoved = 0;

    for (UcsbCourseOffering offering : offerings) {
      ctx.checkCancellation();

      String courseId = UCSBCurriculumService.normalizeCourseId(offering.getCourseId());
      if (courseId == null || !wanted.contains(courseId)) {
        continue;
      }
      if (offering.getClassSections() == null) {
        continue;
      }

      for (UcsbSection section : offering.getClassSections()) {
        // Only lectures: discussions and labs are not recruited for separately.
        if (!section.isPrimary() || section.getEnrollCode() == null) {
          continue;
        }

        Optional<RecruitmentCourse> existing =
            recruitmentCourseRepository.findByRecruitmentIdAndEnrollCode(
                recruitment.getId(), section.getEnrollCode());

        if (existing.isPresent() && existing.get().isRemoved()) {
          // The admin took this one out on purpose; leave it out.
          skippedRemoved++;
          continue;
        }

        RecruitmentCourse row = existing.orElseGet(() -> RecruitmentCourse.builder().build());
        row.setRecruitmentId(recruitment.getId());
        row.setCourseId(courseId);
        row.setEnrollCode(section.getEnrollCode());
        row.setSection(section.getSection());
        row.setTitle(offering.getTitle());
        row.setInstructor(firstInstructor(section));
        row.setDays(firstDays(section));
        row.setTime(firstTime(section));
        row.setRoom(firstRoom(section));
        row.setEnrollment(section.getEnrolledTotal());
        row.setMaxEnroll(section.getMaxEnroll());
        row.setStatus(statusOf(section));
        row.setSummerSession(section.getSession());
        recruitmentCourseRepository.save(row);

        if (existing.isPresent()) {
          updated++;
        } else {
          added++;
        }
        ctx.log(String.format("  %s section %s", courseId, section.getSection()));
      }
    }

    ctx.log(
        String.format(
            "Finished: %d added, %d updated, %d left removed", added, updated, skippedRemoved));
  }

  /** Course ids flagged for this recruitment's type. */
  private Set<String> eligibleCourseIds() {
    return StreamSupport.stream(courseRepository.findAll().spliterator(), false)
        .filter(this::wantsThisType)
        .map(Course::getCourseId)
        .collect(Collectors.toSet());
  }

  private boolean wantsThisType(Course course) {
    return recruitment.getType() == RecruitmentType.TA ? course.isNeedsTa() : course.isNeedsUla();
  }

  /** The first time-location of a primary section; the design ignores any others. */
  private static UcsbTimeLocation firstTimeLocation(UcsbSection section) {
    List<UcsbTimeLocation> locations = section.getTimeLocations();
    return (locations == null || locations.isEmpty()) ? null : locations.get(0);
  }

  static String firstInstructor(UcsbSection section) {
    List<UcsbInstructor> instructors = section.getInstructors();
    if (instructors == null || instructors.isEmpty()) {
      return null;
    }
    return instructors.get(0).getInstructor();
  }

  static String firstDays(UcsbSection section) {
    UcsbTimeLocation location = firstTimeLocation(section);
    return location == null ? null : location.getDays();
  }

  /** Rendered as "begin - end"; null if the section has no meeting time (an online course, say). */
  static String firstTime(UcsbSection section) {
    UcsbTimeLocation location = firstTimeLocation(section);
    if (location == null || location.getBeginTime() == null) {
      return null;
    }
    return location.getBeginTime() + " - " + location.getEndTime();
  }

  /** Building and room together, since neither is much use alone. */
  static String firstRoom(UcsbSection section) {
    UcsbTimeLocation location = firstTimeLocation(section);
    if (location == null) {
      return null;
    }
    if (location.getBuilding() == null) {
      return location.getRoom();
    }
    return (location.getBuilding() + " " + orEmpty(location.getRoom())).trim();
  }

  private static String orEmpty(String value) {
    return value == null ? "" : value;
  }

  /** Cancellation wins over closure: a cancelled class is not merely full. */
  static String statusOf(UcsbSection section) {
    if (isYes(section.getCourseCancelled())) {
      return "cancelled";
    }
    return isYes(section.getClassClosed()) ? "closed" : "open";
  }

  private static boolean isYes(String flag) {
    return flag != null && !flag.isBlank();
  }
}
