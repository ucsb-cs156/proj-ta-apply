package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.DraftAdminComment;
import edu.ucsb.cs.taapply.entity.DraftApplication;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.DraftAdminCommentRepository;
import edu.ucsb.cs.taapply.repository.DraftApplicationRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Issue #417: submitting an application and deleting the draft it grew from are one database
 * transaction, and a draft is opened or saved only after checking, in its own transaction, that the
 * student has no application. These run against the real repositories and the Liquibase-built
 * schema, outside any test-managed transaction, so what they check is what is left in the database
 * after the service returns or throws.
 */
@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=none")
@ActiveProfiles("test")
@Import(DraftApplicationService.class)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
public class DraftApplicationServiceTransactionTests {

  private static final String EMAIL = "ada@ucsb.edu";

  @Autowired DraftApplicationService service;
  @Autowired ApplicationRepository applicationRepository;
  @Autowired RecruitmentRepository recruitmentRepository;
  @MockitoSpyBean DraftApplicationRepository draftApplicationRepository;
  @MockitoSpyBean DraftAdminCommentRepository draftAdminCommentRepository;

  private Long recruitmentId;
  private Long draftId;

  /** Ada has a draft to the recruitment, with an admin's comment on it. */
  @BeforeEach
  public void a_draft_is_on_file() {
    Recruitment recruitment =
        recruitmentRepository.save(
            Recruitment.builder().quarter("20261").type(RecruitmentType.TA).build());
    recruitmentId = recruitment.getId();
    draftId =
        draftApplicationRepository
            .save(
                DraftApplication.builder()
                    .recruitmentId(recruitmentId)
                    .email(EMAIL)
                    .firstName("Ada")
                    .build())
            .getId();
    draftAdminCommentRepository.save(new DraftAdminComment(draftId, "Promising"));
  }

  /** Each test commits for real, so each cleans up after itself. */
  @AfterEach
  public void nothing_is_left_behind() {
    draftAdminCommentRepository.deleteAll();
    draftApplicationRepository.deleteAll();
    applicationRepository.deleteAll();
    recruitmentRepository.deleteAll();
  }

  private Application newApplication() {
    return Application.builder()
        .recruitmentId(recruitmentId)
        .email(EMAIL)
        .firstName("Ada")
        .lastName("Lovelace")
        .build();
  }

  private void anApplicationWithStatus(ApplicationReviewStatus status) {
    applicationRepository.save(newApplication().toBuilder().status(status).build());
  }

  // ---- submitting ----

  @Test
  public void submitting_saves_the_application_and_deletes_the_draft_and_its_comment() {
    Application application = newApplication();

    service.submit(application);

    Application stored = applicationRepository.findById(application.getId()).orElseThrow();
    assertEquals("Promising", stored.getAdminComments());
    assertEquals(0, draftApplicationRepository.count());
    assertEquals(0, draftAdminCommentRepository.count());
  }

  /** The draft cannot be deleted, so the application must not be in the database either. */
  @Test
  public void when_the_draft_cannot_be_deleted_the_application_is_rolled_back() {
    doThrow(new DataAccessResourceFailureException("connection lost"))
        .when(draftApplicationRepository)
        .delete(any());

    assertThrows(DataAccessResourceFailureException.class, () -> service.submit(newApplication()));

    assertEquals(0, applicationRepository.count());
    assertTrue(draftApplicationRepository.findById(draftId).isPresent());
    assertEquals(
        "Promising", draftAdminCommentRepository.findById(draftId).orElseThrow().getComments());
  }

  /** The comment cannot be deleted: the same, and the draft is not deleted after it. */
  @Test
  public void when_the_draft_s_comment_cannot_be_deleted_nothing_is_kept() {
    doThrow(new DataAccessResourceFailureException("connection lost"))
        .when(draftAdminCommentRepository)
        .deleteById(any());

    assertThrows(DataAccessResourceFailureException.class, () -> service.submit(newApplication()));

    assertEquals(0, applicationRepository.count());
    assertTrue(draftApplicationRepository.findById(draftId).isPresent());
    assertTrue(draftAdminCommentRepository.findById(draftId).isPresent());
  }

  // ---- opening and saving a draft ----

  @Test
  public void a_draft_is_not_opened_once_there_is_an_application() {
    draftApplicationRepository.deleteAll();
    anApplicationWithStatus(ApplicationReviewStatus.PENDING);

    IllegalArgumentException e =
        assertThrows(IllegalArgumentException.class, () -> service.open(EMAIL, recruitmentId));

    assertEquals(DraftApplicationService.ALREADY_APPLIED, e.getMessage());
    assertEquals(0, draftApplicationRepository.count());
  }

  /** Issue #318: one who cancelled may start again, with a new draft. */
  @Test
  public void a_draft_is_opened_after_a_cancelled_application() {
    draftApplicationRepository.deleteAll();
    anApplicationWithStatus(ApplicationReviewStatus.CANCELLED);

    DraftApplication opened = service.open(EMAIL, recruitmentId);

    assertEquals(
        EMAIL, draftApplicationRepository.findById(opened.getId()).orElseThrow().getEmail());
  }

  @Test
  public void opening_returns_the_draft_already_on_file() {
    assertEquals(draftId, service.open(EMAIL, recruitmentId).getId());
    assertEquals(1, draftApplicationRepository.count());
  }

  @Test
  public void a_draft_is_not_saved_once_there_is_an_application() {
    anApplicationWithStatus(ApplicationReviewStatus.PENDING);
    DraftApplication draft = draftApplicationRepository.findById(draftId).orElseThrow();
    draft.setFirstName("Grace");

    IllegalArgumentException e =
        assertThrows(IllegalArgumentException.class, () -> service.save(draft));

    assertEquals(DraftApplicationService.ALREADY_APPLIED, e.getMessage());
    assertEquals("Ada", draftApplicationRepository.findById(draftId).orElseThrow().getFirstName());
  }

  @Test
  public void a_draft_is_saved_beside_a_cancelled_application() {
    anApplicationWithStatus(ApplicationReviewStatus.CANCELLED);
    DraftApplication draft = draftApplicationRepository.findById(draftId).orElseThrow();
    draft.setFirstName("Grace");

    assertEquals("Grace", service.save(draft).getFirstName());
    assertEquals(
        "Grace", draftApplicationRepository.findById(draftId).orElseThrow().getFirstName());
  }
}
