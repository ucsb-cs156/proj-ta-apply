package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.entity.HiddenColumn;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.repository.HiddenColumnRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Which columns are hidden on a recruitment's tables (issue #185). The frontend asks for the list
 * when a page opens and tells the backend each time a column is hidden or shown; both calls answer
 * with the current list of hidden column ids, sorted.
 */
@Tag(name = "Hidden columns")
@RequestMapping("/api/admin/hiddencolumns")
@RestController
public class HiddenColumnsController extends ApiController {

  @Autowired HiddenColumnRepository hiddenColumnRepository;
  @Autowired RecruitmentRepository recruitmentRepository;

  @Operation(summary = "The ids of the columns hidden on one of a recruitment's tables")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("")
  public List<String> hiddenColumns(
      @Parameter(name = "tableKey") @RequestParam String tableKey,
      @Parameter(name = "recruitmentId") @RequestParam Long recruitmentId) {
    requireRecruitment(recruitmentId);
    return columnIds(tableKey, recruitmentId);
  }

  @Operation(
      summary = "Hide or show one column on one of a recruitment's tables",
      description =
          "Hiding a column that is already hidden, or showing one that is shown, changes nothing."
              + " Returns the ids of the columns now hidden.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PutMapping("")
  public List<String> setHidden(
      @Parameter(name = "tableKey") @RequestParam String tableKey,
      @Parameter(name = "recruitmentId") @RequestParam Long recruitmentId,
      @Parameter(name = "columnId") @RequestParam String columnId,
      @Parameter(name = "hidden") @RequestParam boolean hidden) {
    requireRecruitment(recruitmentId);
    Optional<HiddenColumn> existing =
        hiddenColumnRepository.findByTableKeyAndRecruitmentIdAndColumnId(
            tableKey, recruitmentId, columnId);
    if (hidden && existing.isEmpty()) {
      hiddenColumnRepository.save(
          HiddenColumn.builder()
              .tableKey(tableKey)
              .recruitmentId(recruitmentId)
              .columnId(columnId)
              .build());
    } else if (!hidden && existing.isPresent()) {
      hiddenColumnRepository.delete(existing.get());
    }
    return columnIds(tableKey, recruitmentId);
  }

  private void requireRecruitment(Long recruitmentId) {
    recruitmentRepository
        .findById(recruitmentId)
        .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, recruitmentId));
  }

  private List<String> columnIds(String tableKey, Long recruitmentId) {
    return hiddenColumnRepository
        .findByTableKeyAndRecruitmentIdOrderByColumnIdAsc(tableKey, recruitmentId)
        .stream()
        .map(HiddenColumn::getColumnId)
        .toList();
  }
}
