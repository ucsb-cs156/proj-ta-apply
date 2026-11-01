package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.AssignmentsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The admin Assignments page (issue #179): faculty rankings side by side with the admin's tentative
 * assignment of each applicant to a section. Admin only; nothing here is shown to applicants or
 * faculty at this stage.
 */
@Tag(name = "AdminAssignments")
@RequestMapping("/api/admin/assignments")
@RestController
public class AdminAssignmentsController extends ApiController {
  @Autowired RecruitmentRepository recruitmentRepository;
  @Autowired RecruitmentCourseRepository recruitmentCourseRepository;
  @Autowired ApplicationRepository applicationRepository;
  @Autowired AssignmentsService assignmentsService;

  @Operation(
      summary = "A recruitment's sections, applicants, rankings and tentative assignments",
      description =
          "Real, uncancelled applications only, with the identity columns of the rankings CSV for"
              + " the recruitment's type. Every section not removed is listed; a removed section"
              + " only while it still has rankings or an assignee. Each section carries its"
              + " allocation, how many are assigned to it and how many places are left. 404 for a"
              + " recruitment that does not exist.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("")
  public AssignmentsService.Assignments forRecruitment(
      @Parameter(name = "recruitmentId") @RequestParam Long recruitmentId) {
    return assignmentsService.assignments(recruitmentOf(recruitmentId));
  }

  @Operation(
      summary = "A recruitment's cancelled applications",
      description =
          "Name, email and the applicant's reason, for the bottom of the Assignments page (issue"
              + " #199). Test applications are left out. 404 for a recruitment that does not"
              + " exist.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("/cancelled")
  public List<AssignmentsService.CancelledApplication> cancelled(
      @Parameter(name = "recruitmentId") @RequestParam Long recruitmentId) {
    return assignmentsService.cancelledApplications(recruitmentOf(recruitmentId).getId());
  }

  @Operation(
      summary = "Tentatively assign an applicant to a section, or clear the assignment",
      description =
          "Leave recruitmentCourseId out to clear. 400 if the section is not part of the"
              + " application's recruitment; 404 for an application or section that does not exist."
              + " Returns the recruitment's assignments as the GET does, with the new counts.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PutMapping("/tentative")
  public AssignmentsService.Assignments setTentative(
      @Parameter(name = "applicationId") @RequestParam Long applicationId,
      @Parameter(name = "recruitmentCourseId") @RequestParam(required = false)
          Long recruitmentCourseId) {
    Application application =
        applicationRepository
            .findById(applicationId)
            .orElseThrow(() -> new EntityNotFoundException(Application.class, applicationId));
    if (recruitmentCourseId != null) {
      RecruitmentCourse course =
          recruitmentCourseRepository
              .findById(recruitmentCourseId)
              .orElseThrow(
                  () -> new EntityNotFoundException(RecruitmentCourse.class, recruitmentCourseId));
      if (!course.getRecruitmentId().equals(application.getRecruitmentId())) {
        throw new IllegalArgumentException(
            "RecruitmentCourse %d is not part of recruitment %d"
                .formatted(recruitmentCourseId, application.getRecruitmentId()));
      }
    }
    application.setTentativeAssignmentId(recruitmentCourseId);
    applicationRepository.save(application);
    return assignmentsService.assignments(recruitmentOf(application.getRecruitmentId()));
  }

  private Recruitment recruitmentOf(Long recruitmentId) {
    return recruitmentRepository
        .findById(recruitmentId)
        .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, recruitmentId));
  }
}
