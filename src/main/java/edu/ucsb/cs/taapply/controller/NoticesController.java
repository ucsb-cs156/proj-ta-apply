package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.entity.NoticeVersion;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.repository.NoticeVersionRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDateTime;
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
 * The "Notices, Terms and Conditions" text for the TA and ULA application forms, kept as an
 * append-only history of versions. Applicants read; admins read the history and append.
 */
@Tag(name = "Notices")
@RequestMapping("/api")
@RestController
@Slf4j
public class NoticesController extends ApiController {

  @Autowired NoticeVersionRepository noticeVersionRepository;

  /** The body of a save: the new text. */
  public static record NoticeContent(String content) {}

  @Operation(
      summary = "The current notice for a form type, as a list of zero or one",
      description =
          "The most recently saved version for TA or ULA. An empty list means no notice has been"
              + " written yet, in which case the form shows none and asks for no agreement.")
  @PreAuthorize("hasAnyRole('ROLE_GRAD_STUDENT','ROLE_UNDERGRAD','ROLE_ADMIN')")
  @GetMapping("/notices/current")
  public List<NoticeVersion> current(@Parameter(name = "type") @RequestParam RecruitmentType type) {
    return noticeVersionRepository.findFirstByTypeOrderByIdDesc(type).stream().toList();
  }

  @Operation(
      summary = "One saved version by id",
      description = "So an application can show exactly the text its applicant agreed to.")
  @PreAuthorize("hasAnyRole('ROLE_GRAD_STUDENT','ROLE_UNDERGRAD','ROLE_ADMIN')")
  @GetMapping("/notices")
  public NoticeVersion byId(@Parameter(name = "id") @RequestParam Long id) {
    return noticeVersionRepository
        .findById(id)
        .orElseThrow(() -> new EntityNotFoundException(NoticeVersion.class, id));
  }

  @Operation(summary = "Every saved version for a form type, newest first")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("/admin/notices/all")
  public List<NoticeVersion> history(@Parameter(name = "type") @RequestParam RecruitmentType type) {
    return noticeVersionRepository.findAllByTypeOrderByIdDesc(type);
  }

  @Operation(
      summary = "Save a new version of the notice for a form type",
      description =
          "Every save is a new version with its own id and timestamp; earlier versions are kept so"
              + " applications can keep pointing at the text their applicants agreed to. 400 if the"
              + " text is blank.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PostMapping("/admin/notices")
  public NoticeVersion save(
      @Parameter(name = "type") @RequestParam RecruitmentType type,
      @RequestBody NoticeContent body) {
    String content = body.content() == null ? "" : body.content().strip();
    if (content.isEmpty()) {
      throw new IllegalArgumentException("The notice text cannot be blank");
    }
    NoticeVersion version =
        NoticeVersion.builder().type(type).content(content).createdAt(LocalDateTime.now()).build();
    return noticeVersionRepository.save(version);
  }
}
