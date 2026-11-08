package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.entity.RecruitmentAuditTrail;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.RecruitmentAuditTrailRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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
 * The audit trail of changes to recruitments themselves, read-only: one recruitment at a time
 * (issue #139), or the hiring-target changes of a quarter's TA and ULA recruitments together, for
 * the Budget page (issue #391). The trail of an admin's changes to individual applications is
 * {@link AuditTrailController}.
 */
@Tag(name = "RecruitmentAuditTrail")
@RequestMapping("/api/admin/recruitmentaudittrail")
@RestController
@Slf4j
public class RecruitmentAuditTrailController extends ApiController {

  @Autowired RecruitmentAuditTrailRepository recruitmentAuditTrailRepository;
  @Autowired RecruitmentRepository recruitmentRepository;

  /** The columns the page may sort by: every column of the table. */
  public static final Set<String> SORTABLE =
      Set.of(
          "id", "changedAt", "recruitmentId", "whatChanged", "oldValue", "newValue", "editorEmail");

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
    return new RecruitmentAuditTrailPageDTO(
        recruitmentAuditTrailRepository.findByRecruitmentId(
            recruitmentId, pageRequest(page, size, sort, direction)));
  }

  /** The {@code whatChanged} of a change to a recruitment's hiring target (issue #391). */
  public static final String HIRING_TARGET = "totalHiringTarget";

  /**
   * One hiring-target change, as the Budget page's Audit Trail card shows it (issue #391): a row of
   * the trail plus the type (TA or ULA) of the recruitment it belongs to.
   */
  public static record HiringTargetChangeDTO(
      Long id,
      LocalDateTime changedAt,
      Long recruitmentId,
      String whatChanged,
      String oldValue,
      String newValue,
      String editorEmail,
      RecruitmentType type) {
    public HiringTargetChangeDTO(RecruitmentAuditTrail row, RecruitmentType type) {
      this(
          row.getId(),
          row.getChangedAt(),
          row.getRecruitmentId(),
          row.getWhatChanged(),
          row.getOldValue(),
          row.getNewValue(),
          row.getEditorEmail(),
          type);
    }
  }

  /**
   * One page of hiring-target changes, in the same shape as {@link RecruitmentAuditTrailPageDTO}.
   */
  public static record HiringTargetAuditTrailPageDTO(
      List<HiringTargetChangeDTO> content,
      int number,
      int size,
      long totalElements,
      int totalPages) {
    public HiringTargetAuditTrailPageDTO(
        Page<RecruitmentAuditTrail> page, Map<Long, RecruitmentType> typeOf) {
      this(
          page.getContent().stream()
              .map(row -> new HiringTargetChangeDTO(row, typeOf.get(row.getRecruitmentId())))
              .toList(),
          page.getNumber(),
          page.getSize(),
          page.getTotalElements(),
          page.getTotalPages());
    }
  }

  @Operation(
      summary = "One page of the changes to the hiring targets of a quarter's recruitments",
      description =
          "The totalHiringTarget rows of the quarter's TA and ULA recruitments (issue #391), each"
              + " with the type of the recruitment it belongs to. Sorted by any column, ascending"
              + " or descending; newest first by default. 400 for a column that is not one of the"
              + " table's. A quarter with no recruitment, or whose targets have never changed,"
              + " gets an empty page rather than a 404.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("/hiringTargets")
  public HiringTargetAuditTrailPageDTO hiringTargetsForQuarter(
      @Parameter(name = "quarter", description = "YYYYQ, e.g. 20264") @RequestParam String quarter,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "10") int size,
      @Parameter(name = "sort", description = "A column name, e.g. changedAt")
          @RequestParam(defaultValue = "id")
          String sort,
      @Parameter(name = "direction", description = "asc or desc")
          @RequestParam(defaultValue = "desc")
          String direction) {
    PageRequest pageRequest = pageRequest(page, size, sort, direction);
    Map<Long, RecruitmentType> typeOf = new HashMap<>();
    for (RecruitmentType type : RecruitmentType.values()) {
      recruitmentRepository
          .findByQuarterAndType(quarter, type)
          .ifPresent(recruitment -> typeOf.put(recruitment.getId(), type));
    }
    // No recruitment, nothing to look up: an empty page of the size asked for.
    Page<RecruitmentAuditTrail> rows =
        typeOf.isEmpty()
            ? Page.empty(pageRequest)
            : recruitmentAuditTrailRepository.findByRecruitmentIdInAndWhatChanged(
                typeOf.keySet(), HIRING_TARGET, pageRequest);
    return new HiringTargetAuditTrailPageDTO(rows, typeOf);
  }

  /**
   * The page asked for; 400 for a column that is not the table's or a direction that is neither.
   */
  private static PageRequest pageRequest(int page, int size, String sort, String direction) {
    if (!SORTABLE.contains(sort)) {
      throw new IllegalArgumentException(
          "Cannot sort by %s (expected one of %s)"
              .formatted(sort, SORTABLE.stream().sorted().toList()));
    }
    Sort.Direction sortDirection = Sort.Direction.fromString(direction);
    return PageRequest.of(page, size, Sort.by(sortDirection, sort));
  }
}
