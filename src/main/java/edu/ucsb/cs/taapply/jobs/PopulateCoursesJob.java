package edu.ucsb.cs.taapply.jobs;

import edu.ucsb.cs.taapply.entity.CatalogName;
import edu.ucsb.cs.taapply.entity.Course;
import edu.ucsb.cs.taapply.models.Quarter;
import edu.ucsb.cs.taapply.models.UcsbCourse;
import edu.ucsb.cs.taapply.models.UcsbCourseOffering;
import edu.ucsb.cs.taapply.models.UcsbInstructor;
import edu.ucsb.cs.taapply.models.UcsbSection;
import edu.ucsb.cs.taapply.repository.CatalogNameRepository;
import edu.ucsb.cs.taapply.repository.CourseRepository;
import edu.ucsb.cs.taapply.services.UCSBCurriculumService;
import edu.ucsb.cs.taapply.services.UcsbQuarterService;
import edu.ucsb.cs156.jobs.services.JobContext;
import edu.ucsb.cs156.jobs.services.JobContextConsumer;
import edu.ucsb.cs156.jobs.services.JobRateLimit;
import java.util.List;
import java.util.Optional;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;

/**
 * Walks a range of quarters, asking the UCSB API which courses in the configured subject area were
 * offered at the given level, and upserts them into the courses table.
 *
 * <p>Two invariants matter here:
 *
 * <ul>
 *   <li>The admin-curated {@code needsTa} / {@code needsUla} flags are never modified. An existing
 *       row only ever has its title refreshed.
 *   <li>Nothing is ever deleted, including courses outside the requested range.
 * </ul>
 *
 * <p>Each quarter is also asked for its offerings with sections, and the instructors of record of
 * every primary section are upserted into the catalog names table (issue #120), so an admin can say
 * which catalog name each instructor goes by.
 *
 * <p>A quarter whose API call fails is logged and skipped rather than aborting the run, so one
 * transient error does not discard the quarters that already succeeded.
 *
 * <p>The same range of quarters is also saved to the quarter calendar table from the UCSB quarter
 * API (issue #151), before the courses are fetched; a failure there is logged and the courses are
 * still fetched.
 */
@Builder
@Getter
@AllArgsConstructor
@Slf4j
public class PopulateCoursesJob implements JobContextConsumer {

  private String startQuarterYYYYQ;
  private String endQuarterYYYYQ;
  private String level;
  private String subjectArea;
  private UCSBCurriculumService ucsbCurriculumService;
  private CourseRepository courseRepository;
  private CatalogNameRepository catalogNameRepository;
  private UcsbQuarterService ucsbQuarterService;
  private JobRateLimit jobRateLimit;

  @Override
  public void accept(JobContext ctx) throws Exception {
    List<Quarter> quarters = Quarter.quarterList(startQuarterYYYYQ, endQuarterYYYYQ);

    ctx.log(
        String.format(
            "Populating %s courses at level %s for %d quarter(s): %s to %s",
            subjectArea, level, quarters.size(), startQuarterYYYYQ, endQuarterYYYYQ));

    // Issue #151: the quarter calendar for the same range, kept alongside the courses.
    try {
      int saved = ucsbQuarterService.loadQuarters(startQuarterYYYYQ, endQuarterYYYYQ).size();
      ctx.log(String.format("Saved %d quarter(s) of the UCSB quarter calendar", saved));
    } catch (Exception e) {
      ctx.log(String.format("Error fetching the quarter calendar: %s", e.getMessage()));
      log.error("Error fetching the quarter calendar", e);
    }

    int added = 0;
    int updated = 0;
    int failedQuarters = 0;
    int namesAdded = 0;

    for (Quarter quarter : quarters) {
      ctx.checkCancellation();
      jobRateLimit.sleep();

      String yyyyq = quarter.getYYYYQ();
      ctx.log(String.format("Fetching %s %s level %s", subjectArea, yyyyq, level));

      List<UcsbCourse> courses;
      try {
        courses = ucsbCurriculumService.getCourses(subjectArea, yyyyq, level);
      } catch (Exception e) {
        failedQuarters++;
        ctx.log(String.format("Error fetching %s: %s", yyyyq, e.getMessage()));
        log.error("Error fetching courses for {}", yyyyq, e);
        continue;
      }

      for (UcsbCourse ucsbCourse : courses) {
        String courseId = UCSBCurriculumService.normalizeCourseId(ucsbCourse.getCourseId());
        if (courseId == null || courseId.isEmpty()) {
          continue;
        }
        Optional<Course> existing = courseRepository.findByCourseId(courseId);
        if (existing.isPresent()) {
          // Refresh the title only. needsTa/needsUla are admin data and must survive re-runs.
          Course course = existing.get();
          course.setTitle(ucsbCourse.getTitle());
          courseRepository.save(course);
          updated++;
        } else {
          courseRepository.save(
              Course.builder()
                  .courseId(courseId)
                  .title(ucsbCourse.getTitle())
                  .needsTa(false)
                  .needsUla(false)
                  .build());
          added++;
        }
      }

      ctx.log(String.format("  %s: %d course(s) returned", yyyyq, courses.size()));

      // A failing offerings fetch costs only this quarter's names, never the courses above.
      try {
        int names = upsertCatalogNames(ucsbCurriculumService.getOfferings(subjectArea, yyyyq));
        namesAdded += names;
        ctx.log(String.format("  %s: %d new catalog name(s)", yyyyq, names));
      } catch (Exception e) {
        ctx.log(String.format("Error fetching instructors for %s: %s", yyyyq, e.getMessage()));
        log.error("Error fetching offerings for {}", yyyyq, e);
      }
    }

    ctx.log(
        String.format(
            "Finished: %d added, %d updated, %d catalog name(s) added, %d quarter(s) failed",
            added, updated, namesAdded, failedQuarters));
  }

  /**
   * Records every instructor of record of a primary (lecture) section as a catalog name, and
   * returns how many were new. Secondaries are skipped: their TAs are not who the catalog names an
   * instructor by. Blank names are skipped, and a name already recorded is left alone.
   */
  int upsertCatalogNames(List<UcsbCourseOffering> offerings) {
    int added = 0;
    for (UcsbCourseOffering offering :
        offerings == null ? List.<UcsbCourseOffering>of() : offerings) {
      for (UcsbSection section :
          offering.getClassSections() == null
              ? List.<UcsbSection>of()
              : offering.getClassSections()) {
        if (!section.isPrimary() || section.getInstructors() == null) {
          continue;
        }
        for (UcsbInstructor instructor : section.getInstructors()) {
          String name =
              instructor.getInstructor() == null ? "" : instructor.getInstructor().strip();
          if (name.isEmpty() || catalogNameRepository.existsById(name)) {
            continue;
          }
          catalogNameRepository.save(CatalogName.builder().name(name).build());
          added++;
        }
      }
    }
    return added;
  }
}
