package edu.ucsb.cs.taapply.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import edu.ucsb.cs.taapply.entity.InstructorFeedbackSettings;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.ActiveProfiles;

/**
 * Against the Liquibase schema from changeset 069 (issue #429): the version it installs, a text far
 * longer than any VARCHAR the app uses, and "latest" meaning the highest id; and changeset 070's
 * ask_for_feedback (issue #430).
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
public class InstructorFeedbackSettingsRepositoryTests {

  @Autowired TestEntityManager entityManager;
  @Autowired InstructorFeedbackSettingsRepository repository;

  @Test
  public void the_changeset_installs_the_notes_the_form_showed_before_as_the_first_version() {
    InstructorFeedbackSettings first = repository.findAllByOrderByIdDesc().getLast();

    assertNull(first.getEditorEmail());
    assertNotNull(first.getCreatedAt());
    // Changeset 070 (issue #430): the versions saved before it ask for feedback.
    assertTrue(first.isAskForFeedback());
    assertEquals(
        "Note that the current estimated cost of a TA is ${estimatedCostPerTA} while the"
            + " estimated cost of a ULA is ${estimatedCostPerULA}. This means that on a cost"
            + " basis, the ratio of TA to ULA is ${taToUlaCostRatio}.\n\n"
            + "On the other hand, TAs work 20 hours per week, while ULAs work 10 hours per week.\n\n"
            + "We are not always in a position to trade off TAs for ULAs in precisely the way each"
            + " faculty member would prefer; there are constraints other than faculty preferences"
            + " that we must satisfy. That being said, we will do our best to take your preferences"
            + " into consideration.",
        first.getNotesText());
  }

  @Test
  public void versions_round_trip_and_the_latest_is_the_highest_id() {
    String longText = "# Notes\n\n" + "Lorem ipsum dolor sit amet. ".repeat(8000);
    InstructorFeedbackSettings a =
        repository.save(
            InstructorFeedbackSettings.builder()
                .createdAt(LocalDateTime.of(2026, 11, 9, 9, 0))
                .editorEmail("admin@ucsb.edu")
                .notesText("Short")
                .build());
    InstructorFeedbackSettings b =
        repository.save(
            InstructorFeedbackSettings.builder()
                .createdAt(LocalDateTime.of(2026, 11, 9, 9, 5))
                .editorEmail("other@ucsb.edu")
                .notesText(longText)
                .askForFeedback(false)
                .build());
    entityManager.flush();
    entityManager.clear();

    InstructorFeedbackSettings latest = repository.findFirstByOrderByIdDesc().orElseThrow();
    assertEquals(b.getId(), latest.getId());
    assertEquals(longText, latest.getNotesText());
    assertTrue(latest.getNotesText().length() > 100000);
    assertEquals("other@ucsb.edu", latest.getEditorEmail());
    assertFalse(latest.isAskForFeedback());
    assertTrue(repository.findById(a.getId()).orElseThrow().isAskForFeedback());
    assertEquals(LocalDateTime.of(2026, 11, 9, 9, 5), latest.getCreatedAt());

    List<Long> ids =
        repository.findAllByOrderByIdDesc().stream()
            .map(InstructorFeedbackSettings::getId)
            .toList();
    assertEquals(List.of(b.getId(), a.getId()), ids.subList(0, 2));
    assertTrue(ids.get(1) > ids.get(2));
  }
}
