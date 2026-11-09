package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.controller.InstructorFeedbackController.TradeoffCosts;
import edu.ucsb.cs.taapply.entity.InstructorFeedbackSettings;
import edu.ucsb.cs.taapply.repository.BudgetRepository;
import edu.ucsb.cs.taapply.repository.InstructorFeedbackSettingsRepository;
import edu.ucsb.cs.taapply.time.AppTime;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Instructor Feedback Settings (issue #429), kept as an append-only history of versions: admins
 * read the history and save new versions; instructors read the newest, whose notes the allocation
 * feedback form shows as its "Notes on TA/ULA tradeoffs", and whose askForFeedback (issue #430)
 * says whether the home page shows the feedback parts at all.
 */
@Tag(name = "InstructorFeedbackSettings")
@RequestMapping("/api")
@RestController
public class InstructorFeedbackSettingsController extends ApiController {

  @Autowired InstructorFeedbackSettingsRepository instructorFeedbackSettingsRepository;
  @Autowired BudgetRepository budgetRepository;

  /**
   * The body of a save: the settings it changes. A field left out (or null) keeps the newest
   * version's value, so a page that saves one setting at a time never overwrites the others: the
   * notes editor sends only {@code notesText}, the checkbox (issue #430) only {@code
   * askForFeedback}.
   */
  public static record SettingsUpdate(String notesText, Boolean askForFeedback) {}

  @Operation(
      summary = "The settings in force, for an instructor, as a list of zero or one",
      description =
          "The most recently saved version. Empty only if every version has been deleted by hand,"
              + " in which case the feedback form shows no notes.")
  @PreAuthorize("hasRole('ROLE_INSTRUCTOR')")
  @GetMapping("/instructor/feedback/settings")
  public List<InstructorFeedbackSettings> current() {
    return instructorFeedbackSettingsRepository.findFirstByOrderByIdDesc().stream().toList();
  }

  @Operation(summary = "Every saved version of the settings, newest first")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("/admin/instructorFeedbackSettings/all")
  public List<InstructorFeedbackSettings> history() {
    return instructorFeedbackSettingsRepository.findAllByOrderByIdDesc();
  }

  @Operation(
      summary = "Save a new version of the settings",
      description =
          "Every save is a new version with its own id, timestamp and editor; earlier versions are"
              + " kept. Body: notesText (Markdown) and askForFeedback (true or false); a field the"
              + " body leaves out, or sends as null, keeps the newest version's value. 400 if the"
              + " notes sent are blank or longer than 1,000,000 characters.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PostMapping("/admin/instructorFeedbackSettings")
  public InstructorFeedbackSettings save(@RequestBody SettingsUpdate body) {
    Optional<InstructorFeedbackSettings> latest =
        instructorFeedbackSettingsRepository.findFirstByOrderByIdDesc();
    String notesText =
        body.notesText() == null
            // Copied forward unchecked: a save of the checkbox alone must not fail over the notes,
            // even when there is no version to copy them from (then there are none).
            ? latest.map(InstructorFeedbackSettings::getNotesText).orElse("")
            : checkedNotes(body.notesText());
    boolean askForFeedback =
        Optional.ofNullable(body.askForFeedback())
            .orElseGet(() -> InstructorFeedbackSettings.askingForFeedback(latest));
    return instructorFeedbackSettingsRepository.save(
        InstructorFeedbackSettings.builder()
            .createdAt(AppTime.now())
            .editorEmail(getCurrentUser().getUser().getEmail())
            .notesText(notesText)
            .askForFeedback(askForFeedback)
            .build());
  }

  /** Notes the admin typed: trimmed, and refused when blank or too long. */
  private static String checkedNotes(String typed) {
    String notesText = typed.strip();
    if (notesText.isEmpty()) {
      throw new IllegalArgumentException("The notes cannot be blank");
    }
    if (notesText.length() > InstructorFeedbackSettings.MAX_NOTES_LENGTH) {
      throw new IllegalArgumentException(
          "The notes may be at most "
              + InstructorFeedbackSettings.MAX_NOTES_LENGTH
              + " characters");
    }
    return notesText;
  }

  @Operation(
      summary = "A quarter's estimated cost per TA and per ULA, for the editor's preview",
      description =
          "The figures instructors see in ${estimatedCostPerTA}, ${estimatedCostPerULA} and"
              + " ${taToUlaCostRatio}: each null until entered, both null for a quarter with no"
              + " budget. Reading never creates a budget.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("/admin/instructorFeedbackSettings/costs")
  public TradeoffCosts costs(@Parameter(name = "quarter") @RequestParam String quarter) {
    return TradeoffCosts.of(quarter, budgetRepository);
  }
}
