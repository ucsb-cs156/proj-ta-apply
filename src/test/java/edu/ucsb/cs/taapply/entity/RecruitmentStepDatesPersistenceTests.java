package edu.ucsb.cs.taapply.entity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.RecruitmentAuditTrailRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.ActiveProfiles;

/** The four step dates round-trip through the Liquibase schema, and created_at backfills (#231). */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class RecruitmentStepDatesPersistenceTests {
  @Autowired RecruitmentRepository recruitments;
  @Autowired RecruitmentAuditTrailRepository auditTrail;
  @Autowired TestEntityManager entityManager;

  /** The UPDATE in changeset 041, kept in step with it by this test. */
  private static final String BACKFILL =
      "UPDATE recruitments SET created_at = (SELECT MIN(t.changed_at) FROM"
          + " recruitment_audit_trail t WHERE t.recruitment_id = recruitments.id AND"
          + " t.what_changed = 'created')";

  private Recruitment save(String quarter, RecruitmentType type) {
    return recruitments.save(
        Recruitment.builder()
            .quarter(quarter)
            .type(type)
            .tentativeOpeningDate(LocalDate.of(2026, 9, 1))
            .primaryConsiderationDate(LocalDate.of(2026, 9, 15))
            .build());
  }

  @Test
  void the_four_dates_are_stored_and_default_to_null() {
    Recruitment plain = save("20264", RecruitmentType.TA);
    Recruitment dated =
        recruitments.save(
            Recruitment.builder()
                .quarter("20264")
                .type(RecruitmentType.ULA)
                .tentativeOpeningDate(LocalDate.of(2026, 9, 1))
                .primaryConsiderationDate(LocalDate.of(2026, 9, 15))
                .createdAt(LocalDateTime.of(2026, 8, 20, 14, 30, 5))
                .allocationsReleasedAt(LocalDateTime.of(2026, 10, 3, 9, 0))
                .facultyReviewClosedAt(LocalDateTime.of(2026, 10, 16, 8, 0))
                .assignmentsPublishedAt(LocalDateTime.of(2026, 11, 1, 16, 45))
                .build());
    entityManager.flush();
    entityManager.clear();

    Recruitment foundPlain = recruitments.findById(plain.getId()).orElseThrow();
    assertNull(foundPlain.getCreatedAt());
    assertNull(foundPlain.getAllocationsReleasedAt());
    assertNull(foundPlain.getFacultyReviewClosedAt());
    assertNull(foundPlain.getAssignmentsPublishedAt());

    Recruitment found = recruitments.findById(dated.getId()).orElseThrow();
    assertEquals(LocalDateTime.of(2026, 8, 20, 14, 30, 5), found.getCreatedAt());
    assertEquals(LocalDateTime.of(2026, 10, 3, 9, 0), found.getAllocationsReleasedAt());
    assertEquals(LocalDateTime.of(2026, 10, 16, 8, 0), found.getFacultyReviewClosedAt());
    assertEquals(LocalDateTime.of(2026, 11, 1, 16, 45), found.getAssignmentsPublishedAt());
  }

  @Test
  void the_backfill_takes_created_at_from_the_audit_trail_row_and_leaves_others_null() {
    Recruitment withRow = save("20264", RecruitmentType.TA);
    Recruitment withoutRow = save("20264", RecruitmentType.ULA);
    RecruitmentAuditTrail created =
        auditTrail.save(
            RecruitmentAuditTrail.builder()
                .recruitmentId(withRow.getId())
                .whatChanged(RecruitmentAuditTrail.CREATED)
                .build());
    // A later change to the same recruitment must not be mistaken for its creation.
    auditTrail.save(
        RecruitmentAuditTrail.builder()
            .recruitmentId(withoutRow.getId())
            .whatChanged("reviewStatus")
            .oldValue("NotStarted")
            .newValue("Open")
            .build());
    entityManager.flush();

    entityManager.getEntityManager().createNativeQuery(BACKFILL).executeUpdate();
    entityManager.clear();

    assertEquals(
        recruitments.findById(withRow.getId()).orElseThrow().getCreatedAt(),
        auditTrail.findById(created.getId()).orElseThrow().getChangedAt());
    assertNull(recruitments.findById(withoutRow.getId()).orElseThrow().getCreatedAt());
  }
}
