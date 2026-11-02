package edu.ucsb.cs.taapply.jobs;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.fake.FakeApplicationGenerator;
import edu.ucsb.cs.taapply.services.fake.FakeCoverage;
import edu.ucsb.cs156.jobs.services.JobContext;
import edu.ucsb.cs156.jobs.services.JobContextConsumer;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.TreeSet;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

/**
 * Developer Mode's "Create Fake Applications" (issue #219): adds {@code count} fake applications,
 * origin DEVELOPER_MODE, to one recruitment. Runs as a job because a few hundred applications, each
 * with its coursework and interests, take a moment to save. Existing applications, real or fake,
 * are never touched, and no fake email repeats one already in the recruitment.
 */
@Builder
@Getter
@AllArgsConstructor
public class CreateFakeApplicationsJob implements JobContextConsumer {

  private Long recruitmentId;
  private int count;
  private FakeCoverage coverage;
  private Random random;

  /** The date the applications are made; their coursework terms run back from its quarter. */
  private LocalDate today;

  private FakeApplicationGenerator generator;
  private RecruitmentRepository recruitmentRepository;
  private RecruitmentCourseRepository recruitmentCourseRepository;
  private ApplicationRepository applicationRepository;

  @Override
  public void accept(JobContext ctx) throws Exception {
    Recruitment recruitment =
        recruitmentRepository
            .findById(recruitmentId)
            .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, recruitmentId));

    // Applicants choose from the courses on offer, by course id; several sections share one id.
    Set<String> courseIds = new TreeSet<>();
    for (RecruitmentCourse course :
        recruitmentCourseRepository.findByRecruitmentId(recruitmentId)) {
      if (!course.isRemoved()) {
        courseIds.add(course.getCourseId());
      }
    }
    Set<String> takenEmails = new HashSet<>();
    applicationRepository
        .findByRecruitmentIdOrderByIdAsc(recruitmentId)
        .forEach(existing -> takenEmails.add(existing.getEmail()));

    ctx.log(
        "Creating %d fake %s applications to %s with %s coverage over %d course(s)"
            .formatted(
                count,
                recruitment.getType(),
                recruitment.getQuarter(),
                coverage,
                courseIds.size()));
    List<Application> applications =
        generator.generate(
            recruitment, List.copyOf(courseIds), count, coverage, random, takenEmails, today);
    applicationRepository.saveAll(applications);
    ctx.log("Created %d fake application(s).".formatted(applications.size()));
  }
}
