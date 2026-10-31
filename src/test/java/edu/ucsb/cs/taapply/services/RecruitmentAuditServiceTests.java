package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentAuditTrail;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.RecruitmentAuditTrailRepository;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest(classes = {RecruitmentAuditService.class})
@ActiveProfiles("test")
public class RecruitmentAuditServiceTests {

  @Autowired RecruitmentAuditService service;
  @MockitoBean RecruitmentAuditTrailRepository repository;

  private static Recruitment recruitment() {
    return Recruitment.builder()
        .id(7L)
        .quarter("20261")
        .type(RecruitmentType.TA)
        .applicationStatus(ApplicationStatus.CLOSED)
        .tentativeOpeningDate(LocalDate.of(2026, 1, 5))
        .primaryConsiderationDate(LocalDate.of(2026, 1, 20))
        .build();
  }

  @Test
  public void the_audited_fields_include_both_lifecycles_and_all_dates_in_order() {
    assertEquals(
        List.of(
            "applicationStatus",
            "tentativeOpeningDate",
            "primaryConsiderationDate",
            "actualOpeningDate",
            "actualClosingDate",
            "reviewStatus",
            "facultyReviewOpeningDate",
            "facultyRankingDeadline"),
        new ArrayList<>(RecruitmentAuditService.FIELDS.keySet()));
  }

  @Test
  public void a_snapshot_holds_the_fields_as_strings_with_null_for_an_unset_one() {
    Recruitment r = recruitment();
    r.setActualClosingDate(LocalDate.of(2026, 2, 1));

    RecruitmentAuditService.Snapshot snapshot = service.snapshot(r);

    assertEquals(7L, snapshot.recruitmentId());
    Map<String, String> fields = snapshot.fields();
    assertEquals(
        List.of(
            "applicationStatus",
            "tentativeOpeningDate",
            "primaryConsiderationDate",
            "actualOpeningDate",
            "actualClosingDate",
            "reviewStatus",
            "facultyReviewOpeningDate",
            "facultyRankingDeadline"),
        new ArrayList<>(fields.keySet()));
    assertEquals("CLOSED", fields.get("applicationStatus"));
    assertEquals("2026-01-05", fields.get("tentativeOpeningDate"));
    assertEquals("2026-01-20", fields.get("primaryConsiderationDate"));
    assertNull(fields.get("actualOpeningDate"));
    assertTrue(fields.containsKey("actualOpeningDate"));
    assertEquals("2026-02-01", fields.get("actualClosingDate"));
    assertEquals("NotStarted", fields.get("reviewStatus"));
    assertNull(fields.get("facultyReviewOpeningDate"));
    assertNull(fields.get("facultyRankingDeadline"));
  }

  @Test
  public void opening_reviews_records_status_first_open_date_and_ranking_deadline() {
    Recruitment r = recruitment();
    RecruitmentAuditService.Snapshot before = service.snapshot(r);
    r.setReviewStatus("Open");
    r.setFacultyReviewOpeningDate(LocalDate.of(2026, 1, 21));
    r.setFacultyRankingDeadline(LocalDate.of(2026, 2, 15));

    List<RecruitmentAuditTrail> changes = service.recordChanges(before, r);

    assertEquals(
        List.of("reviewStatus", "facultyReviewOpeningDate", "facultyRankingDeadline"),
        changes.stream().map(RecruitmentAuditTrail::getWhatChanged).toList());
    assertEquals("NotStarted", changes.get(0).getOldValue());
    assertEquals("Open", changes.get(0).getNewValue());
    assertNull(changes.get(1).getOldValue());
    assertEquals("2026-01-21", changes.get(1).getNewValue());
    assertNull(changes.get(2).getOldValue());
    assertEquals("2026-02-15", changes.get(2).getNewValue());
    verify(repository).saveAll(changes);
  }

  @Test
  public void editing_the_ranking_deadline_records_its_old_and_new_dates() {
    Recruitment r = recruitment();
    r.setFacultyRankingDeadline(LocalDate.of(2026, 2, 1));
    RecruitmentAuditService.Snapshot before = service.snapshot(r);
    r.setFacultyRankingDeadline(LocalDate.of(2026, 2, 15));

    List<RecruitmentAuditTrail> changes = service.recordChanges(before, r);

    assertEquals(1, changes.size());
    assertEquals("facultyRankingDeadline", changes.get(0).getWhatChanged());
    assertEquals("2026-02-01", changes.get(0).getOldValue());
    assertEquals("2026-02-15", changes.get(0).getNewValue());
    verify(repository).saveAll(changes);
  }

  @Test
  public void creating_writes_one_created_row_with_no_values() {
    RecruitmentAuditTrail saved = RecruitmentAuditTrail.builder().id(1L).build();
    when(repository.save(any())).thenReturn(saved);

    RecruitmentAuditTrail result = service.recordCreated(recruitment());

    assertSame(saved, result);
    ArgumentCaptor<RecruitmentAuditTrail> captor =
        ArgumentCaptor.forClass(RecruitmentAuditTrail.class);
    verify(repository, times(1)).save(captor.capture());
    RecruitmentAuditTrail row = captor.getValue();
    assertEquals(7L, row.getRecruitmentId());
    assertEquals("created", row.getWhatChanged());
    assertNull(row.getOldValue());
    assertNull(row.getNewValue());
    assertNull(row.getId());
    verify(repository, never()).saveAll(any());
  }

  @Test
  public void deleting_writes_one_deleted_row_with_no_values() {
    RecruitmentAuditTrail saved = RecruitmentAuditTrail.builder().id(2L).build();
    when(repository.save(any())).thenReturn(saved);

    RecruitmentAuditTrail result = service.recordDeleted(recruitment());

    assertSame(saved, result);
    ArgumentCaptor<RecruitmentAuditTrail> captor =
        ArgumentCaptor.forClass(RecruitmentAuditTrail.class);
    verify(repository, times(1)).save(captor.capture());
    RecruitmentAuditTrail row = captor.getValue();
    assertEquals(7L, row.getRecruitmentId());
    assertEquals("deleted", row.getWhatChanged());
    assertNull(row.getOldValue());
    assertNull(row.getNewValue());
  }

  @Test
  public void an_edit_that_changes_nothing_writes_nothing() {
    Recruitment r = recruitment();
    RecruitmentAuditService.Snapshot before = service.snapshot(r);

    List<RecruitmentAuditTrail> changes = service.recordChanges(before, r);

    assertEquals(List.of(), changes);
    verify(repository, never()).saveAll(any());
    verify(repository, never()).save(any());
  }

  @Test
  public void opening_writes_a_row_per_changed_field_in_field_order_with_old_and_new_values() {
    Recruitment r = recruitment();
    RecruitmentAuditService.Snapshot before = service.snapshot(r);
    r.setApplicationStatus(ApplicationStatus.OPEN);
    r.setActualOpeningDate(LocalDate.of(2026, 1, 6));

    List<RecruitmentAuditTrail> changes = service.recordChanges(before, r);

    assertEquals(2, changes.size());
    RecruitmentAuditTrail status = changes.get(0);
    assertEquals(7L, status.getRecruitmentId());
    assertEquals("applicationStatus", status.getWhatChanged());
    assertEquals("CLOSED", status.getOldValue());
    assertEquals("OPEN", status.getNewValue());
    RecruitmentAuditTrail opened = changes.get(1);
    assertEquals(7L, opened.getRecruitmentId());
    assertEquals("actualOpeningDate", opened.getWhatChanged());
    assertNull(opened.getOldValue());
    assertEquals("2026-01-06", opened.getNewValue());
    verify(repository, times(1)).saveAll(changes);
    verify(repository, never()).save(any());
  }

  @Test
  public void a_date_edited_or_blanked_is_recorded_with_both_values() {
    Recruitment r = recruitment();
    r.setActualClosingDate(LocalDate.of(2026, 2, 1));
    RecruitmentAuditService.Snapshot before = service.snapshot(r);
    r.setTentativeOpeningDate(LocalDate.of(2026, 1, 7));
    r.setActualClosingDate(null);

    List<RecruitmentAuditTrail> changes = service.recordChanges(before, r);

    assertEquals(2, changes.size());
    assertEquals("tentativeOpeningDate", changes.get(0).getWhatChanged());
    assertEquals("2026-01-05", changes.get(0).getOldValue());
    assertEquals("2026-01-07", changes.get(0).getNewValue());
    assertEquals("actualClosingDate", changes.get(1).getWhatChanged());
    assertEquals("2026-02-01", changes.get(1).getOldValue());
    assertNull(changes.get(1).getNewValue());
    verify(repository, times(1)).saveAll(changes);
  }

  @Test
  public void the_rows_carry_the_snapshot_s_recruitment_id() {
    Recruitment r = recruitment();
    RecruitmentAuditService.Snapshot before =
        new RecruitmentAuditService.Snapshot(99L, service.snapshot(r).fields());
    r.setApplicationStatus(ApplicationStatus.OPEN);

    List<RecruitmentAuditTrail> changes = service.recordChanges(before, r);

    assertEquals(1, changes.size());
    assertEquals(99L, changes.get(0).getRecruitmentId());
  }
}
