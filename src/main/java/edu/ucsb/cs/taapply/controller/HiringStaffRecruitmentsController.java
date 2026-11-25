package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.SoftOffers;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * What the Hiring Staff role sees (issue #505): the ULA recruitments whose soft offers have been
 * released, each the subject of a Soft Offer Results page. Admins may read it too, since the
 * results page looks the recruitment up here whoever is looking.
 */
@Tag(name = "Hiring Staff recruitments")
@RequestMapping("/api/hiringStaff")
@RestController
@Slf4j
public class HiringStaffRecruitmentsController extends ApiController {

  @Autowired RecruitmentRepository recruitmentRepository;

  /** Whether a recruitment has a Soft Offer Results page: a ULA one with soft offers released. */
  public static boolean hasSoftOfferResults(Recruitment r) {
    return r.getType() == RecruitmentType.ULA && SoftOffers.isReleased(r);
  }

  @Operation(
      summary = "The ULA recruitments with soft offers released, most recent quarter first",
      description =
          "The recruitments that have a Soft Offer Results page (issue #487), for the Hiring Staff"
              + " section of the home page. Hidden recruitments are included: hiding is from"
              + " students and instructors, and hiring staff are neither.")
  @PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_HIRING_STAFF')")
  @GetMapping("/recruitments")
  public List<Recruitment> recruitments() {
    return recruitmentRepository.findAllByOrderByQuarterDescTypeAsc().stream()
        .filter(HiringStaffRecruitmentsController::hasSoftOfferResults)
        .toList();
  }
}
