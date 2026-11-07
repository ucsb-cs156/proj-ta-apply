package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentAuditTrail;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.RecruitmentAuditTrailRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Issue #377: a change to a recruitment (its creation, an edit, its deletion) and its audit rows
 * are one database transaction. These tests run against the real repositories and the
 * Liquibase-built schema, outside any test-managed transaction, so what they check is what is left
 * in the database after the service returns or throws. A failure is forced from each side: the
 * audit repository refusing its row(s), and the recruitment's own write failing.
 */
@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=none")
@ActiveProfiles("test")
@Import(RecruitmentAuditService.class)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
public class RecruitmentAuditServiceTransactionTests {

  @Autowired RecruitmentAuditService service;
  @MockitoSpyBean RecruitmentRepository recruitmentRepository;
  @MockitoSpyBean RecruitmentAuditTrailRepository auditTrailRepository;

  /** Each test commits for real, so each cleans up after itself. */
  @AfterEach
  public void nothing_is_left_behind() {
    auditTrailRepository.deleteAll();
    recruitmentRepository.deleteAll();
  }

  private static Recruitment recruitment() {
    return Recruitment.builder().quarter("20261").type(RecruitmentType.TA).build();
  }

  private Recruitment stored(Long id) {
    return recruitmentRepository.findById(id).orElseThrow();
  }

  private List<String> whatChanged(Long recruitmentId) {
    List<String> changes = new ArrayList<>();
    for (RecruitmentAuditTrail row : auditTrailRepository.findAll()) {
      if (recruitmentId.equals(row.getRecruitmentId())) {
        changes.add(row.getWhatChanged());
      }
    }
    return changes;
  }

  // ---- creation ----

  @Test
  public void a_creation_and_its_row_are_both_committed() {
    Recruitment saved = service.saveAndRecordCreated(recruitment());

    assertTrue(recruitmentRepository.existsById(saved.getId()));
    assertEquals(List.of("created"), whatChanged(saved.getId()));
  }

  /**
   * The recruitment is inserted first (its row needs the id), so the insert is what a failing audit
   * write must undo.
   */
  @Test
  public void when_the_created_row_cannot_be_written_the_recruitment_is_not_created() {
    doThrow(new DataAccessResourceFailureException("connection lost"))
        .when(auditTrailRepository)
        .save(any());

    assertThrows(
        DataAccessResourceFailureException.class,
        () -> service.saveAndRecordCreated(recruitment()));

    verify(recruitmentRepository).save(any());
    assertEquals(0, recruitmentRepository.count());
    assertEquals(0, auditTrailRepository.count());
  }

  // ---- an edit ----

  @Test
  public void an_edit_and_its_rows_are_both_committed() {
    Recruitment r = recruitmentRepository.save(recruitment());
    RecruitmentAuditService.Snapshot before = service.snapshot(r);
    r.setApplicationStatus(ApplicationStatus.OPEN);

    service.saveAndRecordChanges(before, r);

    assertEquals(ApplicationStatus.OPEN, stored(r.getId()).getApplicationStatus());
    assertEquals(List.of("applicationStatus"), whatChanged(r.getId()));
  }

  /** Side one: the audit rows cannot be written, so the edit must not be in the database. */
  @Test
  public void when_the_audit_rows_cannot_be_written_the_edit_is_rolled_back() {
    Recruitment r = recruitmentRepository.save(recruitment());
    doThrow(new DataAccessResourceFailureException("connection lost"))
        .when(auditTrailRepository)
        .saveAll(any());
    RecruitmentAuditService.Snapshot before = service.snapshot(r);
    r.setApplicationStatus(ApplicationStatus.OPEN);

    assertThrows(
        DataAccessResourceFailureException.class, () -> service.saveAndRecordChanges(before, r));

    assertEquals(ApplicationStatus.CLOSED, stored(r.getId()).getApplicationStatus());
    assertEquals(0, auditTrailRepository.count());
  }

  /**
   * Side two: the edit cannot be saved, so no audit row may remain. The review status column is
   * VARCHAR(16), and the UPDATE that overflows it runs when the transaction flushes, after the
   * audit rows have already been inserted; the rollback has to take those rows with it.
   */
  @Test
  public void when_the_edit_cannot_be_saved_no_audit_rows_remain() {
    Recruitment r = recruitmentRepository.save(recruitment());
    RecruitmentAuditService.Snapshot before = service.snapshot(r);
    r.setReviewStatus("x".repeat(17));

    assertThrows(DataAccessException.class, () -> service.saveAndRecordChanges(before, r));

    // The rows were written before the database refused the edit, and are gone afterwards.
    verify(auditTrailRepository).saveAll(any());
    assertEquals(0, auditTrailRepository.count());
    assertEquals("NotStarted", stored(r.getId()).getReviewStatus());
  }

  // ---- deletion ----

  @Test
  public void a_deletion_and_its_row_are_both_committed() {
    Recruitment r = recruitmentRepository.save(recruitment());

    service.deleteAndRecord(r);

    assertFalse(recruitmentRepository.existsById(r.getId()));
    assertEquals(List.of("deleted"), whatChanged(r.getId()));
  }

  /** The row is written before the delete, so a failing delete must undo the row. */
  @Test
  public void when_the_recruitment_cannot_be_deleted_no_deleted_row_remains() {
    Recruitment r = recruitmentRepository.save(recruitment());
    doThrow(new DataAccessResourceFailureException("connection lost"))
        .when(recruitmentRepository)
        .delete(any());

    assertThrows(DataAccessResourceFailureException.class, () -> service.deleteAndRecord(r));

    verify(auditTrailRepository).save(any());
    assertEquals(0, auditTrailRepository.count());
    assertTrue(recruitmentRepository.existsById(r.getId()));
  }
}
