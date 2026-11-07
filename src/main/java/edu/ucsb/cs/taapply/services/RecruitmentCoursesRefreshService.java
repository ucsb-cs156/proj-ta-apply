package edu.ucsb.cs.taapply.services;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.errors.UpstreamApiException;
import edu.ucsb.cs.taapply.jobs.PopulateRecruitmentCoursesJob;
import edu.ucsb.cs.taapply.models.UcsbCourseOffering;
import edu.ucsb.cs.taapply.models.UcsbSection;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.time.AppTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Refreshes a recruitment's course rows from the UCSB API while the admin waits (issue #175), so
 * the enrollment figures the Recruitment Courses page is planned from are current when it opens.
 *
 * <p>Narrower than {@link PopulateRecruitmentCoursesJob} on purpose: it only rewrites the offering
 * details of rows that already exist and are still in the API. It adds no rows, marks nothing
 * stale, and leaves the admin's own fields (removed, allocation, enrollment estimate) alone. The
 * job remains the way to pick up new courses; this is just a fresher read of the ones on file.
 *
 * <p>The enrollment figures live once per quarter in {@code budget_courses} (issue #363), checked
 * against the API by every fetch of the quarter's offerings. This refresh is the one that happens
 * on every page opening, so it is the one gated by the figures' time to live ({@link
 * BudgetCourseService#TTL}): when every figure the page shows was checked within it, the API is not
 * called at all. The one call it does make serves the whole quarter: every section of the quarter
 * on file, in whichever recruitment, gets its figures from it.
 */
@Service
@Slf4j
public class RecruitmentCoursesRefreshService {

  @Autowired UCSBCurriculumService ucsbCurriculumService;
  @Autowired RecruitmentCourseRepository recruitmentCourseRepository;
  @Autowired RecruitmentRepository recruitmentRepository;
  @Autowired BudgetCourseService budgetCourseService;

  @Value("${app.subjectArea:CMPSC}")
  String subjectArea;

  /** A lecture in the quarter's offerings, with the course it belongs to. */
  private record Offered(String courseId, UcsbCourseOffering offering, UcsbSection section) {}

  /**
   * Rewrites the offering details of every non-removed row whose enroll code the API still lists,
   * caches the quarter's enrollment figures, stamps the recruitment as refreshed, and returns how
   * many rows it rewrote. Does nothing, and returns 0, when the figures of every non-removed row
   * are younger than the time to live: the API is not called and the recruitment is not stamped.
   *
   * @throws UpstreamApiException if the API call fails; nothing is changed in that case
   */
  public int refresh(Recruitment recruitment) {
    List<RecruitmentCourse> onFile =
        recruitmentCourseRepository.findByRecruitmentId(recruitment.getId()).stream()
            .filter(row -> !row.isRemoved())
            .toList();
    if (budgetCourseService.isFresh(recruitment.getQuarter(), onFile)) {
      log.info(
          "Recruitment {}: the enrollment figures of {} were all checked within the last {} hours;"
              + " the UCSB API is not called",
          recruitment.getId(),
          recruitment.getQuarter(),
          BudgetCourseService.TTL.toHours());
      return 0;
    }

    List<UcsbCourseOffering> offerings;
    try {
      offerings = ucsbCurriculumService.getOfferings(subjectArea, recruitment.getQuarter());
    } catch (Exception e) {
      log.warn("Refresh of recruitment {} from the UCSB API failed", recruitment.getId(), e);
      throw new UpstreamApiException(
          "The UCSB API could not be reached; the stored enrollment figures were kept.", e);
    }

    Map<String, Offered> offered = new HashMap<>();
    Map<String, UcsbSection> sections = new HashMap<>();
    for (UcsbCourseOffering offering : offerings) {
      String courseId = UCSBCurriculumService.normalizeCourseId(offering.getCourseId());
      if (courseId == null || offering.getClassSections() == null) {
        continue;
      }
      for (UcsbSection section : offering.getClassSections()) {
        if (section.isPrimary() && section.getEnrollCode() != null) {
          offered.put(section.getEnrollCode(), new Offered(courseId, offering, section));
          sections.put(section.getEnrollCode(), section);
        }
      }
    }

    List<RecruitmentCourse> refreshed = new ArrayList<>();
    for (RecruitmentCourse row : onFile) {
      Offered found = offered.get(row.getEnrollCode());
      if (found == null) {
        continue;
      }
      PopulateRecruitmentCoursesJob.applyOffering(
          row, recruitment.getId(), found.courseId(), found.offering(), found.section());
      recruitmentCourseRepository.save(row);
      refreshed.add(row);
    }
    int cached = budgetCourseService.refreshCache(recruitment.getQuarter(), refreshed, sections);
    log.info(
        "Recruitment {}: cached the enrollment figures of {} section(s) of {}",
        recruitment.getId(),
        cached,
        recruitment.getQuarter());

    recruitment.setLastPopulatedAt(AppTime.now());
    recruitmentRepository.save(recruitment);
    return refreshed.size();
  }
}
