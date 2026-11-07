package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.AuditTrail;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.User;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.AuditTrailRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Issue #377: an admin's edit of an application and its audit rows are one database transaction.
 * These tests run against the real repositories and the Liquibase-built schema, outside any
 * test-managed transaction, so what they check is what is left in the database after {@link
 * ApplicationAuditService#saveAndRecord} returns or throws. A failure is forced from each side: the
 * audit repository refusing the rows (a lost connection, say), and the database refusing the edit
 * itself when the transaction flushes.
 */
@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=none")
@ActiveProfiles("test")
@Import({ApplicationAuditService.class, ObjectMapper.class})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
public class ApplicationAuditServiceTransactionTests {

  @Autowired ApplicationAuditService service;
  @Autowired ApplicationRepository applicationRepository;
  @Autowired RecruitmentRepository recruitmentRepository;
  @MockitoSpyBean AuditTrailRepository auditTrailRepository;
  @MockitoBean CurrentUserService currentUserService;

  private Long applicationId;

  /** The admin making the edit (issue #337). */
  @BeforeEach
  public void an_admin_is_logged_in() {
    when(currentUserService.getUser())
        .thenReturn(User.builder().id(3L).email("admin@ucsb.edu").build());
  }

  @BeforeEach
  public void an_application_is_on_file() {
    Recruitment recruitment =
        recruitmentRepository.save(
            Recruitment.builder().quarter("20261").type(RecruitmentType.TA).build());
    applicationId =
        applicationRepository
            .save(
                Application.builder()
                    .recruitmentId(recruitment.getId())
                    .email("ada@ucsb.edu")
                    .firstName("Ada")
                    .lastName("Lovelace")
                    .build())
            .getId();
  }

  /** Each test commits for real, so each cleans up after itself. */
  @AfterEach
  public void nothing_is_left_behind() {
    auditTrailRepository.deleteAll();
    applicationRepository.deleteAll();
    recruitmentRepository.deleteAll();
  }

  private Application stored() {
    return applicationRepository.findById(applicationId).orElseThrow();
  }

  @Test
  public void an_edit_and_its_audit_rows_are_both_committed() {
    Application application = stored();
    ApplicationAuditService.Snapshot before = service.snapshot(application);
    application.setFirstName("Grace");

    Application saved = service.saveAndRecord(before, application, RecruitmentType.TA);

    assertEquals("Grace", saved.getFirstName());
    assertEquals("Grace", stored().getFirstName());
    List<AuditTrail> rows = auditTrailRepository.findByTaApplicationIdOrderByIdAsc(applicationId);
    assertEquals(1, rows.size());
    assertEquals("firstName", rows.get(0).getFieldName());
    assertEquals("Ada", rows.get(0).getOldValue());
    assertEquals("Grace", rows.get(0).getNewValue());
    // Issue #337: the row names the admin who made the edit, stored in the new column.
    assertEquals("admin@ucsb.edu", rows.get(0).getEditorEmail());
  }

  /** Side one: the audit rows cannot be written, so the edit must not be in the database. */
  @Test
  public void when_the_audit_rows_cannot_be_written_the_edit_is_rolled_back() {
    doThrow(new DataAccessResourceFailureException("connection lost"))
        .when(auditTrailRepository)
        .saveAll(any());
    Application application = stored();
    ApplicationAuditService.Snapshot before = service.snapshot(application);
    application.setFirstName("Grace");

    assertThrows(
        DataAccessResourceFailureException.class,
        () -> service.saveAndRecord(before, application, RecruitmentType.TA));

    assertEquals("Ada", stored().getFirstName());
    assertEquals(0, auditTrailRepository.count());
  }

  /**
   * Side two: the edit cannot be saved, so no audit row may remain. The origin column is NOT NULL,
   * and the UPDATE that violates it runs when the transaction flushes, after the audit rows have
   * already been inserted; the rollback has to take those rows with it.
   */
  @Test
  public void when_the_edit_cannot_be_saved_no_audit_rows_remain() {
    Application application = stored();
    ApplicationAuditService.Snapshot before = service.snapshot(application);
    application.setFirstName("Grace");
    application.setOrigin(null);

    assertThrows(
        DataAccessException.class,
        () -> service.saveAndRecord(before, application, RecruitmentType.TA));

    // The rows were written before the database refused the edit, and are gone afterwards.
    verify(auditTrailRepository).saveAll(any());
    assertEquals(0, auditTrailRepository.count());
    assertEquals("Ada", stored().getFirstName());
  }
}
