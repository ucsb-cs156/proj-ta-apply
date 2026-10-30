package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.entity.RecruitmentAuditTrail;
import edu.ucsb.cs.taapply.repository.RecruitmentAuditTrailRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The audit trail of changes to recruitments themselves, read-only, one recruitment at a time
 * (issue #139). The trail of an admin's changes to individual applications is {@link
 * AuditTrailController}.
 */
@Tag(name = "RecruitmentAuditTrail")
@RequestMapping("/api/admin/recruitmentaudittrail")
@RestController
@Slf4j
public class RecruitmentAuditTrailController extends ApiController {

  @Autowired RecruitmentAuditTrailRepository recruitmentAuditTrailRepository;

  /** The columns the page may sort by: every column of the table. */
  public static final Set<String> SORTABLE =
      Set.of("id", "changedAt", "recruitmentId", "whatChanged", "oldValue", "newValue");

  /** One page of the trail, in the shape the Audit Trail and Users pages already consume. */
  public static record RecruitmentAuditTrailPageDTO(
      List<RecruitmentAuditTrail> content,
      int number,
      int size,
      long totalElements,
      int totalPages) {
    public RecruitmentAuditTrailPageDTO(Page<RecruitmentAuditTrail> page) {
      this(
          page.getContent(),
          page.getNumber(),
          page.getSize(),
          page.getTotalElements(),
          page.getTotalPages());
    }
  }

  @Operation(
      summary = "One page of the changes recorded against one recruitment",
      description =
          "Sorted by any column, ascending or descending; newest first by default. 400 for a column"
              + " that is not one of the table's. A recruitment nothing has been recorded for, or"
              + " that never existed, gets an empty page rather than a 404.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("/all")
  public RecruitmentAuditTrailPageDTO forRecruitment(
      @Parameter(name = "recruitmentId") @RequestParam Long recruitmentId,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "10") int size,
      @Parameter(name = "sort", description = "A column name, e.g. changedAt")
          @RequestParam(defaultValue = "id")
          String sort,
      @Parameter(name = "direction", description = "asc or desc")
          @RequestParam(defaultValue = "desc")
          String direction) {
    if (!SORTABLE.contains(sort)) {
      throw new IllegalArgumentException(
          "Cannot sort by %s (expected one of %s)"
              .formatted(sort, SORTABLE.stream().sorted().toList()));
    }
    Sort.Direction sortDirection = Sort.Direction.fromString(direction);
    return new RecruitmentAuditTrailPageDTO(
        recruitmentAuditTrailRepository.findByRecruitmentId(
            recruitmentId, PageRequest.of(page, size, Sort.by(sortDirection, sort))));
  }
}
