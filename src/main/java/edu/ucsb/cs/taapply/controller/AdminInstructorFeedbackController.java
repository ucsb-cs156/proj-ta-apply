package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.services.InstructorFeedbackReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The admin's Instructor Feedback page (issue #427), /admin/instructorFeedback/QXX: every
 * instructor's feedback on their TA/ULA allocation in one quarter (issue #425). Read only.
 */
@Tag(name = "InstructorFeedback (admin)")
@RequestMapping("/api/admin/instructorFeedback")
@RestController
public class AdminInstructorFeedbackController extends ApiController {

  @Autowired InstructorFeedbackReportService instructorFeedbackReportService;

  @Operation(
      summary = "Every instructor's allocation feedback in a quarter",
      description =
          "One entry per feedback row, by course id, section and email: the course, the"
              + " instructor's email and catalog name, the four checkboxes, the course's current"
              + " TA and ULA allocations (null when the quarter has no recruitment of that type or"
              + " the course is not in it), the preferred counts (null unless their box is"
              + " checked), the comments and when the row was last saved. Empty for a quarter"
              + " with no feedback.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("")
  public List<InstructorFeedbackReportService.Row> feedback(
      @Parameter(name = "quarter", description = "YYYYQ, e.g. 20264") @RequestParam
          String quarter) {
    return instructorFeedbackReportService.rows(quarter);
  }
}
