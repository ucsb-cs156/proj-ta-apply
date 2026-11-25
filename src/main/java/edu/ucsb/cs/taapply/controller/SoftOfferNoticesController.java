package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.entity.SoftOfferNoticeVersion;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.repository.SoftOfferNoticeVersionRepository;
import edu.ucsb.cs.taapply.time.AppTime;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The "Soft Offer Notices" text shown to assigned ULA applicants once soft offers are released
 * (issue #484), kept as an append-only history of versions like the Notices, Terms and Conditions.
 * Applicants read; admins read the history and append.
 */
@Tag(name = "Soft Offer Notices")
@RequestMapping("/api")
@RestController
@Slf4j
public class SoftOfferNoticesController extends ApiController {

  @Autowired SoftOfferNoticeVersionRepository softOfferNoticeVersionRepository;

  /** The body of a save: the new text. */
  public static record NoticeContent(String content) {}

  @Operation(
      summary = "The current soft offer notice, as a list of zero or one",
      description =
          "The most recently saved version. An empty list means none has been written yet, in"
              + " which case a soft offer shows the course details and the question without it.")
  @PreAuthorize("hasRole('ROLE_USER')")
  @GetMapping("/softOfferNotices/current")
  public List<SoftOfferNoticeVersion> current() {
    return softOfferNoticeVersionRepository.findFirstByOrderByIdDesc().stream().toList();
  }

  @Operation(
      summary = "One saved version by id",
      description = "So a response can show exactly the text its applicant read.")
  @PreAuthorize("hasRole('ROLE_USER')")
  @GetMapping("/softOfferNotices")
  public SoftOfferNoticeVersion byId(@Parameter(name = "id") @RequestParam Long id) {
    return softOfferNoticeVersionRepository
        .findById(id)
        .orElseThrow(() -> new EntityNotFoundException(SoftOfferNoticeVersion.class, id));
  }

  @Operation(summary = "Every saved version, newest first")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("/admin/softOfferNotices/all")
  public List<SoftOfferNoticeVersion> history() {
    return softOfferNoticeVersionRepository.findAllByOrderByIdDesc();
  }

  @Operation(
      summary = "Save a new version of the soft offer notice",
      description =
          "Every save is a new version with its own id and timestamp; earlier versions are kept so"
              + " responses can keep pointing at the text their applicants read. 400 if the text is"
              + " blank.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PostMapping("/admin/softOfferNotices")
  public SoftOfferNoticeVersion save(@RequestBody NoticeContent body) {
    String content = body.content() == null ? "" : body.content().strip();
    if (content.isEmpty()) {
      throw new IllegalArgumentException("The notice text cannot be blank");
    }
    SoftOfferNoticeVersion version =
        SoftOfferNoticeVersion.builder().content(content).createdAt(AppTime.now()).build();
    return softOfferNoticeVersionRepository.save(version);
  }
}
