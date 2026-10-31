package edu.ucsb.cs.taapply.services;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentAuditTrail;
import edu.ucsb.cs.taapply.repository.RecruitmentAuditTrailRepository;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Writes the audit trail of changes to recruitments themselves (issue #139): a row when one is
 * created, a row when one is deleted, and a row per field that changed when one is edited, opened
 * or closed. (The trail of an admin's changes to individual applications is {@link
 * ApplicationAuditService}.)
 *
 * <p>For an edit, the caller takes a {@link #snapshot} before applying it and calls {@link
 * #recordChanges} with it afterwards; only the fields whose value differs get a row, so a request
 * that changes nothing writes nothing. Creation and deletion get just their one row: the values a
 * recruitment was created with are not also written as changes.
 */
@Service
public class RecruitmentAuditService {

  @Autowired private RecruitmentAuditTrailRepository repository;

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
  }

  /** A recruitment's audited fields as strings, keyed by field name; a null field is null. */
  public record Snapshot(Long recruitmentId, Map<String, String> fields) {}

  public Snapshot snapshot(Recruitment recruitment) {
    Map<String, String> fields = new LinkedHashMap<>();
    FIELDS.forEach((name, getter) -> fields.put(name, text(getter.apply(recruitment))));
    return new Snapshot(recruitment.getId(), fields);
  }

  /** Records that the recruitment was just created, and returns the row written. */
  public RecruitmentAuditTrail recordCreated(Recruitment recruitment) {
    return repository.save(row(recruitment.getId(), RecruitmentAuditTrail.CREATED, null, null));
  }

  /** Records that the recruitment is about to be deleted, and returns the row written. */
  public RecruitmentAuditTrail recordDeleted(Recruitment recruitment) {
    return repository.save(row(recruitment.getId(), RecruitmentAuditTrail.DELETED, null, null));
  }

  /**
   * Records every field whose value differs between the snapshot taken before an edit and the
   * recruitment as it is now, one row each, and returns the rows written (empty when nothing
   * changed).
   */
  public List<RecruitmentAuditTrail> recordChanges(Snapshot before, Recruitment after) {
    Snapshot now = snapshot(after);
    List<RecruitmentAuditTrail> changes = new ArrayList<>();
    before
        .fields()
        .forEach(
            (name, old) -> {
              String current = now.fields().get(name);
              if (!Objects.equals(old, current)) {
                changes.add(row(before.recruitmentId(), name, old, current));
              }
            });
    if (!changes.isEmpty()) {
      repository.saveAll(changes);
    }
    return changes;
  }

  private static RecruitmentAuditTrail row(
      Long recruitmentId, String whatChanged, String oldValue, String newValue) {
    return RecruitmentAuditTrail.builder()
        .recruitmentId(recruitmentId)
        .whatChanged(whatChanged)
        .oldValue(oldValue)
        .newValue(newValue)
        .build();
  }

  private static String text(Object value) {
    return value == null ? null : String.valueOf(value);
  }
}
