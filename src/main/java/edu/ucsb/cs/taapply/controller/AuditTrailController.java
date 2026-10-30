package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.entity.AuditTrail;
import edu.ucsb.cs.taapply.repository.AuditTrailRepository;
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
 * The audit trail of <em>individual applications</em>, read-only: every change an admin made to a
 * student's application. Changes to recruitments themselves (creation, deletion, status, dates) are
 * served by {@link RecruitmentAuditTrailController}.
 */
@Tag(name = "AuditTrail")
@RequestMapping("/api/admin/audittrail")
@RestController
@Slf4j
public class AuditTrailController extends ApiController {

  @Autowired AuditTrailRepository auditTrailRepository;

  /** The columns the page may sort by: every column of the table. */
  public static final Set<String> SORTABLE =
      Set.of(
          "id",
          "editedAt",
          "ulaApplicationId",
          "taApplicationId",
          "fieldName",
          "oldValue",
          "newValue");

  /** One page of the trail, in the shape the Users page already consumes. */
  public static record AuditTrailPageDTO(
      List<AuditTrail> content, int number, int size, long totalElements, int totalPages) {
    public AuditTrailPageDTO(Page<AuditTrail> page) {
      this(
          page.getContent(),
          page.getNumber(),
          page.getSize(),
          page.getTotalElements(),
          page.getTotalPages());
    }
  }

  @Operation(
      summary = "One page of the audit trail",
      description =
          "Sorted by any column, ascending or descending; newest first by default. 400 for a column"
              + " that is not one of the table's.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("/all")
  public AuditTrailPageDTO pagedAuditTrail(
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "10") int size,
      @Parameter(name = "sort", description = "A column name, e.g. editedAt")
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
    return new AuditTrailPageDTO(
        auditTrailRepository.findAll(PageRequest.of(page, size, Sort.by(sortDirection, sort))));
  }

  @Operation(
      summary = "Every change recorded against one application, oldest first",
      description = "The TA or the ULA application with that id, by type.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("/application")
  public List<AuditTrail> forApplication(
      @Parameter(name = "type", description = "TA or ULA") @RequestParam String type,
      @Parameter(name = "id") @RequestParam Long id) {
    if ("TA".equals(type)) {
      return auditTrailRepository.findByTaApplicationIdOrderByIdAsc(id);
    }
    if ("ULA".equals(type)) {
      return auditTrailRepository.findByUlaApplicationIdOrderByIdAsc(id);
    }
    throw new IllegalArgumentException("type must be TA or ULA, not " + type);
  }
}
