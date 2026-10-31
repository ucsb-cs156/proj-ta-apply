package edu.ucsb.cs.taapply.services;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.errors.UpstreamApiException;
import edu.ucsb.cs.taapply.jobs.PopulateRecruitmentCoursesJob;
import edu.ucsb.cs.taapply.models.UcsbCourseOffering;
import edu.ucsb.cs.taapply.models.UcsbSection;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import java.time.LocalDateTime;
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
 */
@Service
@Slf4j
public class RecruitmentCoursesRefreshService {

  @Autowired UCSBCurriculumService ucsbCurriculumService;
  @Autowired RecruitmentCourseRepository recruitmentCourseRepository;
  @Autowired RecruitmentRepository recruitmentRepository;

  @Value("${app.subjectArea:CMPSC}")
  String subjectArea;

  /** A lecture in the quarter's offerings, with the course it belongs to. */
  private record Offered(String courseId, UcsbCourseOffering offering, UcsbSection section) {}

  /**
   * Rewrites the offering details of every non-removed row whose enroll code the API still lists,
   * stamps the recruitment as refreshed, and returns how many rows it rewrote.
   *
   * @throws UpstreamApiException if the API call fails; nothing is changed in that case
   */
  public int refresh(Recruitment recruitment) {
    List<UcsbCourseOffering> offerings;
    try {
      offerings = ucsbCurriculumService.getOfferings(subjectArea, recruitment.getQuarter());
    } catch (Exception e) {
      log.warn("Refresh of recruitment {} from the UCSB API failed", recruitment.getId(), e);
      throw new UpstreamApiException(
          "The UCSB API could not be reached; the stored enrollment figures were kept.", e);
    }

    Map<String, Offered> offered = new HashMap<>();
    for (UcsbCourseOffering offering : offerings) {
      String courseId = UCSBCurriculumService.normalizeCourseId(offering.getCourseId());
      if (courseId == null || offering.getClassSections() == null) {
        continue;
      }
      for (UcsbSection section : offering.getClassSections()) {
        if (section.isPrimary() && section.getEnrollCode() != null) {
          offered.put(section.getEnrollCode(), new Offered(courseId, offering, section));
        }
      }
    }

    int refreshed = 0;
    for (RecruitmentCourse row :
        recruitmentCourseRepository.findByRecruitmentId(recruitment.getId())) {
      Offered found = offered.get(row.getEnrollCode());
      if (row.isRemoved() || found == null) {
        continue;
      }
      PopulateRecruitmentCoursesJob.applyOffering(
          row, recruitment.getId(), found.courseId(), found.offering(), found.section());
      recruitmentCourseRepository.save(row);
      refreshed++;
    }

    recruitment.setLastPopulatedAt(LocalDateTime.now());
    recruitmentRepository.save(recruitment);
    return refreshed;
  }
}
