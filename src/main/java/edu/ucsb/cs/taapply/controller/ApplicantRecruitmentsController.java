package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.entity.TaMajor;
import edu.ucsb.cs.taapply.entity.TaTopic;
import edu.ucsb.cs.taapply.entity.UlaMajor;
import edu.ucsb.cs.taapply.entity.UlaTopic;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.models.CourseSections;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.repository.TaMajorRepository;
import edu.ucsb.cs.taapply.repository.TaTopicRepository;
import edu.ucsb.cs.taapply.repository.UlaMajorRepository;
import edu.ucsb.cs.taapply.repository.UlaTopicRepository;
import edu.ucsb.cs.taapply.services.ApplicationAccessService;
import edu.ucsb.cs.taapply.services.UCSBCurriculumService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * What an applicant needs to know about recruitments: whether they can apply now, when a past one
 * ran, and when an upcoming one is expected to open.
 *
 * <p>Any signed-in user may apply to any recruitment, TA or ULA, so nothing here is filtered by who
 * is asking; each recruitment carries its type for the page to show.
 */
@Tag(name = "ApplicantRecruitments")
@RequestMapping("/api/recruitments")
@RestController
@Slf4j
public class ApplicantRecruitmentsController extends ApiController {

  @Autowired RecruitmentRepository recruitmentRepository;
  @Autowired RecruitmentCourseRepository recruitmentCourseRepository;
  @Autowired ApplicationAccessService applicationAccessService;
  @Autowired UCSBCurriculumService ucsbCurriculumService;
  @Autowired TaMajorRepository taMajorRepository;
  @Autowired TaTopicRepository taTopicRepository;
  @Autowired UlaMajorRepository ulaMajorRepository;
  @Autowired UlaTopicRepository ulaTopicRepository;

  /** The admin-maintained lists the application form for one recruitment offers. */
  public static record ApplicationOptions(List<String> majors, List<String> topics) {}

  /** Every recruitment, most recent quarter first, TA before ULA within a quarter. */
  private List<Recruitment> all() {
    return recruitmentRepository.findAllByOrderByQuarterDescTypeAsc();
  }

  @Operation(
      summary = "Open recruitments, of either type",
      description = "Each carries its type, so the page can say which positions it is for.")
  @PreAuthorize("hasRole('ROLE_USER')")
  @GetMapping("/open")
  public List<Recruitment> openRecruitments() {
    return all().stream().filter(applicationAccessService::acceptingApplications).toList();
  }

  @Operation(
      summary = "Recruitments created but not yet opened",
      description = "So the home page can show when applications are expected to open.")
  @PreAuthorize("hasRole('ROLE_USER')")
  @GetMapping("/upcoming")
  public List<Recruitment> upcomingRecruitments() {
    // Never opened is the whole test: actualOpeningDate is stamped the first time a recruitment
    // opens and never cleared, so a null one has not opened yet and is necessarily still closed.
    return all().stream().filter(r -> r.getActualOpeningDate() == null).toList();
  }

  @Operation(
      summary = "The most recently closed recruitment of each type",
      description = "So the home page can say when the last TA round and the last ULA round ran.")
  @PreAuthorize("hasRole('ROLE_USER')")
  @GetMapping("/recentlyClosed")
  public List<Recruitment> recentlyClosed() {
    // Both conditions matter: a reopened recruitment keeps the closing date of its earlier round,
    // so having closed once is not enough; it has to be closed now.
    // Already sorted most recent quarter first, so the first match of each type is the one to show.
    Set<RecruitmentType> seen = new HashSet<>();
    return all().stream()
        .filter(r -> r.getApplicationStatus() == ApplicationStatus.CLOSED)
        .filter(r -> r.getActualClosingDate() != null)
        .filter(r -> seen.add(r.getType()))
        .toList();
  }

  @Operation(
      summary = "Every recruitment, past or present",
      description =
          "So a listing of a user's own applications can name the quarter and dates behind each"
              + " one.")
  @PreAuthorize("hasRole('ROLE_USER')")
  @GetMapping("/applicable")
  public List<Recruitment> applicableRecruitments() {
    return all();
  }

  @Operation(
      summary = "The course numbers an applicant may choose from",
      description =
          "Distinct and sorted, since a course with two lectures appears twice in the recruitment."
              + " Empty for a recruitment that does not exist.")
  @PreAuthorize("hasRole('ROLE_USER')")
  @GetMapping("/courses")
  public List<String> courseChoices(
      @Parameter(name = "recruitmentId") @RequestParam Long recruitmentId) {

    if (!recruitmentRepository.existsById(recruitmentId)) {
      return List.of();
    }

    return recruitmentCourseRepository.findByRecruitmentId(recruitmentId).stream()
        .filter(c -> !c.isRemoved())
        .map(c -> c.getCourseId())
        .distinct()
        .sorted()
        .toList();
  }

  @Operation(
      summary = "When a course's lectures and sections meet",
      description =
          "Looked up live from the UCSB API via the enroll code of the course's lecture in the"
              + " recruitment, so an applicant choosing the course can see whether they are free."
              + " 404 for a recruitment that does not exist. A course the recruitment does not list"
              + " comes back with no meetings rather than an error.")
  @PreAuthorize("hasRole('ROLE_USER')")
  @GetMapping("/sections")
  public CourseSections courseSections(
      @Parameter(name = "recruitmentId") @RequestParam Long recruitmentId,
      @Parameter(name = "courseId", description = "Padded course id, e.g. \"CMPSC   156\"")
          @RequestParam
          String courseId)
      throws Exception {

    Recruitment recruitment =
        recruitmentRepository
            .findById(recruitmentId)
            .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, recruitmentId));

    // Any one lecture's enroll code finds the whole offering, every section included, so the
    // lowest is as good as any and keeps the request the same from one call to the next.
    Optional<String> enrollCode =
        recruitmentCourseRepository.findByRecruitmentId(recruitmentId).stream()
            .filter(c -> !c.isRemoved() && courseId.equals(c.getCourseId()))
            .map(RecruitmentCourse::getEnrollCode)
            .sorted()
            .findFirst();
    if (enrollCode.isEmpty()) {
      return CourseSections.none(courseId, recruitment.getQuarter());
    }

    return CourseSections.from(
        courseId,
        recruitment.getQuarter(),
        ucsbCurriculumService.getOffering(recruitment.getQuarter(), enrollCode.get()));
  }

  private static List<String> sorted(Stream<String> names) {
    return names.sorted(String.CASE_INSENSITIVE_ORDER).toList();
  }

  @Operation(
      summary = "The majors and topics lists the application form for a recruitment offers",
      description =
          "The TA lists for a TA recruitment, the ULA lists for a ULA one, each sorted. 404 for an"
              + " unknown recruitment.")
  @PreAuthorize("hasRole('ROLE_USER')")
  @GetMapping("/options")
  public ApplicationOptions applicationOptions(
      @Parameter(name = "recruitmentId") @RequestParam Long recruitmentId) {
    Recruitment recruitment =
        recruitmentRepository
            .findById(recruitmentId)
            .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, recruitmentId));

    if (recruitment.getType() == RecruitmentType.TA) {
      return new ApplicationOptions(
          sorted(
              StreamSupport.stream(taMajorRepository.findAll().spliterator(), false)
                  .map(TaMajor::getName)),
          sorted(
              StreamSupport.stream(taTopicRepository.findAll().spliterator(), false)
                  .map(TaTopic::getName)));
    }
    return new ApplicationOptions(
        sorted(
            StreamSupport.stream(ulaMajorRepository.findAll().spliterator(), false)
                .map(UlaMajor::getName)),
        sorted(
            StreamSupport.stream(ulaTopicRepository.findAll().spliterator(), false)
                .map(UlaTopic::getName)));
  }
}
