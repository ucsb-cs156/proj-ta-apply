package edu.ucsb.cs.taapply.controller;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import edu.ucsb.cs.taapply.entity.DraftAdminComment;
import edu.ucsb.cs.taapply.entity.DraftApplication;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.repository.DraftAdminCommentRepository;
import edu.ucsb.cs.taapply.repository.DraftApplicationRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * An admin's view of the drafts of a recruitment (issue #296): the list, one draft in full, how
 * many there are, and the admin's own comments on each. Nothing here changes what the applicant
 * wrote: there is deliberately no way for an admin to edit a draft, only to comment on it.
 */
@Tag(name = "AdminDraftApplications")
@RequestMapping("/api/admin/draftApplications")
@RestController
public class AdminDraftApplicationsController extends ApiController {

  @Autowired DraftApplicationRepository draftApplicationRepository;
  @Autowired DraftAdminCommentRepository draftAdminCommentRepository;
  @Autowired RecruitmentRepository recruitmentRepository;

  /**
   * A draft as an admin sees it: every field of the draft at the top level of the JSON, as for the
   * applicant, plus the admin's comments under the name an application's use.
   */
  public record AdminDraftView(@JsonUnwrapped DraftApplication draft, String adminComments) {}

  private void requireRecruitment(Long recruitmentId) {
    if (!recruitmentRepository.existsById(recruitmentId)) {
      throw new EntityNotFoundException(Recruitment.class, recruitmentId);
    }
  }

  private DraftApplication draft(Long id) {
    return draftApplicationRepository
        .findById(id)
        .orElseThrow(() -> new EntityNotFoundException(DraftApplication.class, id));
  }

  @Operation(
      summary = "Every draft application to a recruitment, oldest first",
      description =
          "Only that recruitment's drafts. A draft that has been submitted is no longer one: it is"
              + " an application then. 404 for a recruitment that does not exist.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("/all")
  public List<AdminDraftView> allForRecruitment(
      @Parameter(name = "recruitmentId") @RequestParam Long recruitmentId) {
    requireRecruitment(recruitmentId);
    List<DraftApplication> drafts =
        draftApplicationRepository.findByRecruitmentIdOrderByIdAsc(recruitmentId);
    Map<Long, String> comments = new HashMap<>();
    draftAdminCommentRepository
        .findByDraftIdIn(drafts.stream().map(DraftApplication::getId).toList())
        .forEach(c -> comments.put(c.getDraftId(), c.getComments()));
    return drafts.stream().map(d -> new AdminDraftView(d, comments.get(d.getId()))).toList();
  }

  @Operation(
      summary = "How many drafts a recruitment has",
      description = "404 for a recruitment that does not exist.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("/count")
  public long count(@Parameter(name = "recruitmentId") @RequestParam Long recruitmentId) {
    requireRecruitment(recruitmentId);
    return draftApplicationRepository.countByRecruitmentId(recruitmentId);
  }

  @Operation(summary = "One draft, whoever it belongs to")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("")
  public AdminDraftView getDraft(@Parameter(name = "id") @RequestParam Long id) {
    DraftApplication draft = draft(id);
    String comments =
        draftAdminCommentRepository.findById(id).map(DraftAdminComment::getComments).orElse(null);
    return new AdminDraftView(draft, comments);
  }

  @Operation(
      summary = "Save the admin's comments on a draft",
      description =
          "Free text, kept apart from the applicant's own answers; replaces the earlier text. The"
              + " draft itself, its version included, is untouched, so the applicant's autosave is"
              + " not disturbed. The comments are copied to the application when it is submitted.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PutMapping("/adminComments")
  public AdminDraftView updateAdminComments(
      @Parameter(name = "id") @RequestParam Long id,
      @Parameter(name = "adminComments") @RequestParam String adminComments) {
    DraftApplication draft = draft(id);
    draftAdminCommentRepository.save(new DraftAdminComment(id, adminComments));
    return new AdminDraftView(draft, adminComments);
  }
}
