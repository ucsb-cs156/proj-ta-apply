package edu.ucsb.cs.taapply.services;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentAuditTrail;
import edu.ucsb.cs.taapply.entity.User;
import edu.ucsb.cs.taapply.repository.RecruitmentAuditTrailRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Writes the audit trail of changes to recruitments themselves (issue #139): a row when one is
 * created, a row when one is deleted, and a row per field that changed when one is edited, opened
 * or closed. (The trail of an admin's changes to individual applications is {@link
 * ApplicationAuditService}.)
 *
 * <p>Each change goes through one of {@link #saveAndRecordCreated}, {@link #saveAndRecordChanges}
 * and {@link #deleteAndRecord}, which write the recruitment and its rows in one database
 * transaction (issue #377): both are committed, or neither is. For an edit, the caller takes a
 * {@link #snapshot} before applying it and passes it in afterwards; only the fields whose value
 * differs get a row, so a request that changes nothing writes nothing. Creation and deletion get
 * just their one row: the values a recruitment was created with are not also written as changes.
 *
 * <p>Every row carries the email of the logged-in user who made the change (issue #337), read from
 * {@link CurrentUserService} here rather than passed in by each caller, so every path that writes
 * rows records it: the admin endpoints, {@link AllocationVisibilityService}, and Developer Mode's
 * fake allocations. A row written with no user logged in (no path does so today) would carry null,
 * as the rows from before the column existed do.
 */
@Service
public class RecruitmentAuditService {

  @Autowired private RecruitmentRepository recruitmentRepository;
  @Autowired private RecruitmentAuditTrailRepository repository;
  @Autowired private CurrentUserService currentUserService;

  /** The fields a change is recorded for, in the order their rows are written. */
  static final Map<String, Function<Recruitment, Object>> FIELDS = new LinkedHashMap<>();

  static {
    FIELDS.put("applicationStatus", Recruitment::getApplicationStatus);
    FIELDS.put("tentativeOpeningDate", Recruitment::getTentativeOpeningDate);
    FIELDS.put("primaryConsiderationDate", Recruitment::getPrimaryConsiderationDate);
    FIELDS.put("actualOpeningDate", Recruitment::getActualOpeningDate);
    FIELDS.put("actualClosingDate", Recruitment::getActualClosingDate);
    FIELDS.put("reviewStatus", Recruitment::getReviewStatus);
    FIELDS.put("facultyReviewOpeningDate", Recruitment::getFacultyReviewOpeningDate);
    FIELDS.put("facultyRankingDeadline", Recruitment::getFacultyRankingDeadline);
    FIELDS.put("allocationVisibility", Recruitment::getAllocationVisibility);
    FIELDS.put("assignmentsPublished", Recruitment::getAssignmentsPublished);
    // Issue #391: the hiring target, a planning figure, is audited too; the Budget page lists its
    // changes for the quarter's two recruitments.
    FIELDS.put("totalHiringTarget", Recruitment::getTotalHiringTarget);
  }

  /** A recruitment's audited fields as strings, keyed by field name; a null field is null. */
  public record Snapshot(Long recruitmentId, Map<String, String> fields) {}

  public Snapshot snapshot(Recruitment recruitment) {
    Map<String, String> fields = new LinkedHashMap<>();
    FIELDS.forEach((name, getter) -> fields.put(name, text(getter.apply(recruitment))));
    return new Snapshot(recruitment.getId(), fields);
  }

  /**
   * Saves a new recruitment and records its creation, in one transaction, and returns the
   * recruitment as saved (with its id).
   */
  @Transactional
  public Recruitment saveAndRecordCreated(Recruitment recruitment) {
    Recruitment saved = recruitmentRepository.save(recruitment);
    recordCreated(saved);
    return saved;
  }

  /**
   * Saves an edited recruitment and records every field that differs from the snapshot taken before
   * the edit, in one transaction, and returns the rows written (empty when nothing changed).
   */
  @Transactional
  public List<RecruitmentAuditTrail> saveAndRecordChanges(Snapshot before, Recruitment after) {
    recruitmentRepository.save(after);
    return recordChanges(before, after);
  }

  /**
   * Records that the recruitment is being deleted and deletes it, in one transaction, and returns
   * the row written. The row survives the recruitment: it is the record that it existed.
   */
  @Transactional
  public RecruitmentAuditTrail deleteAndRecord(Recruitment recruitment) {
    RecruitmentAuditTrail row = recordDeleted(recruitment);
    recruitmentRepository.delete(recruitment);
    return row;
  }

  /**
   * Records that the recruitment was just created, by the logged-in user, and returns the row
   * written.
   */
  public RecruitmentAuditTrail recordCreated(Recruitment recruitment) {
    return repository.save(
        row(recruitment.getId(), RecruitmentAuditTrail.CREATED, null, null, editorEmail()));
  }

  /**
   * Records that the recruitment is about to be deleted, by the logged-in user, and returns the row
   * written.
   */
  public RecruitmentAuditTrail recordDeleted(Recruitment recruitment) {
    return repository.save(
        row(recruitment.getId(), RecruitmentAuditTrail.DELETED, null, null, editorEmail()));
  }

  /**
   * Records every field whose value differs between the snapshot taken before an edit and the
   * recruitment as it is now, one row each naming the logged-in user as its editor, and returns the
   * rows written (empty when nothing changed). Writers go through {@link #saveAndRecordChanges},
   * which calls this inside the transaction that saves the recruitment.
   */
  public List<RecruitmentAuditTrail> recordChanges(Snapshot before, Recruitment after) {
    Snapshot now = snapshot(after);
    String editor = editorEmail();
    List<RecruitmentAuditTrail> changes = new ArrayList<>();
    before
        .fields()
        .forEach(
            (name, old) -> {
              String current = now.fields().get(name);
              if (!Objects.equals(old, current)) {
                changes.add(row(before.recruitmentId(), name, old, current, editor));
              }
            });
    if (!changes.isEmpty()) {
      repository.saveAll(changes);
    }
    return changes;
  }

  /** The email of the logged-in user, who is the one making the change; null if there is none. */
  private String editorEmail() {
    User user = currentUserService.getUser();
    return user == null ? null : user.getEmail();
  }

  private static RecruitmentAuditTrail row(
      Long recruitmentId, String whatChanged, String oldValue, String newValue, String editor) {
    return RecruitmentAuditTrail.builder()
        .recruitmentId(recruitmentId)
        .whatChanged(whatChanged)
        .oldValue(oldValue)
        .newValue(newValue)
        .editorEmail(editor)
        .build();
  }

  private static String text(Object value) {
    return value == null ? null : String.valueOf(value);
  }
}
