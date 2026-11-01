package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.RecruitmentStepsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The Recruitment Steps diagram's data for one recruitment (issue #231). */
@Tag(name = "Recruitment steps")
@RequestMapping("/api/admin/recruitments")
@RestController
public class RecruitmentStepsController extends ApiController {

  @Autowired RecruitmentRepository recruitmentRepository;
  @Autowired RecruitmentStepsService recruitmentStepsService;

  @Operation(
      summary = "Where a recruitment stands in the nine Recruitment Steps",
      description =
          "For each step: whether it is done, the label for the bottom of its box, and the page or"
              + " card modal its title opens. 404 for an unknown recruitment.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("/{id}/steps")
  public RecruitmentStepsService.Steps steps(@PathVariable Long id) {
    Recruitment recruitment =
        recruitmentRepository
            .findById(id)
            .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, id));
    return recruitmentStepsService.stepsFor(recruitment);
  }
}
