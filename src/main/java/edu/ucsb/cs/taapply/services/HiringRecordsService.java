package edu.ucsb.cs.taapply.services;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.HiringRecord;
import edu.ucsb.cs.taapply.entity.User;
import edu.ucsb.cs.taapply.enums.HiringField;
import edu.ucsb.cs.taapply.enums.NewHireForm;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.HiringRecordRepository;
import edu.ucsb.cs.taapply.time.AppTime;
import java.time.LocalDateTime;
import java.util.Arrays;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Saving the Soft Offer Results page's hiring-tracking fields (issue #509), one field at a time, so
 * that a change to one field never overwrites another.
 *
 * <p>Stamps are the server's {@link AppTime#now()}, never the browser's clock. Checking a box
 * stamps it unless it is already stamped (the page only sends {@code true} on an unchecked to
 * checked change, so a repeated {@code true} keeps the first stamp); unchecking clears it, and
 * checking again records a new stamp. The New Hire form dropdown is stamped when its value is set
 * or changed, and keeps its stamp when the same value is saved again; blank clears both.
 */
@Service
public class HiringRecordsService {
  @Autowired ApplicationRepository applicationRepository;
  @Autowired HiringRecordRepository hiringRecordRepository;
  @Autowired CurrentUserService currentUserService;

  public static final String CHECKBOX_VALUE = "A checkbox takes the value true or false.";
  public static final String NEW_HIRE_FORM_VALUE =
      "New Hire form takes " + Arrays.toString(NewHireForm.values()) + " or blank.";
  public static final String STAFF_COMMENTS_TOO_LONG =
      "Staff Comments may be at most " + SoftOffersService.COMMENTS_MAX + " characters.";

  /**
   * Saves one field of an application's hiring record, creating the record on the first save.
   *
   * @param value {@code true}/{@code false} for a checkbox field, {@code DONE}/{@code NOT_NEEDED}
   *     or blank for the New Hire form, text or blank for Funding and Staff Comments
   * @throws EntityNotFoundException for an unknown application
   * @throws IllegalArgumentException for a value the field does not take
   */
  public HiringRecord update(Long applicationId, HiringField field, String value) {
    if (!applicationRepository.existsById(applicationId)) {
      throw new EntityNotFoundException(Application.class, applicationId);
    }
    HiringRecord record =
        hiringRecordRepository
            .findByApplicationId(applicationId)
            .orElseGet(() -> HiringRecord.builder().applicationId(applicationId).build());
    LocalDateTime now = AppTime.now();
    switch (field) {
      case NEW_HIRE_FORM -> {
        NewHireForm form = newHireForm(value);
        // A change of value is a new event and gets a new stamp; the same value again keeps it.
        if (form == null) {
          record.setNewHireFormAt(null);
        } else if (form != record.getNewHireForm() || record.getNewHireFormAt() == null) {
          record.setNewHireFormAt(now);
        }
        record.setNewHireForm(form);
      }
      // Issue #512, part 2, will check the abbreviation against the funding_sources table.
      case FUNDING_SOURCE -> record.setFundingSource(blankToNull(value));
      case STAFF_COMMENTS -> {
        if (value != null && value.length() > SoftOffersService.COMMENTS_MAX) {
          throw new IllegalArgumentException(STAFF_COMMENTS_TOO_LONG);
        }
        // Stored as typed, apart from nothing at all.
        record.setStaffComments(blankToNull(value));
      }
      // The six checkbox fields.
      default -> checkbox(record, field, value, now);
    }
    record.setUpdatedAt(now);
    User user = currentUserService.getUser();
    record.setUpdatedByEmail(user == null ? null : user.getEmail());
    return hiringRecordRepository.save(record);
  }

  /** Sets a checkbox field's stamp from its value; {@code field} must be one of the six. */
  static void checkbox(HiringRecord record, HiringField field, String value, LocalDateTime now) {
    switch (field) {
      case FORMAL_OFFER_SENT ->
          record.setFormalOfferSentAt(stamp(record.getFormalOfferSentAt(), value, now));
      case FORMAL_OFFER_ACCEPTED ->
          record.setFormalOfferAcceptedAt(stamp(record.getFormalOfferAcceptedAt(), value, now));
      case FLSA_CONFLICT_FOUND ->
          record.setFlsaConflictFoundAt(stamp(record.getFlsaConflictFoundAt(), value, now));
      case FLSA_CONFLICT_RESOLVED ->
          record.setFlsaConflictResolvedAt(stamp(record.getFlsaConflictResolvedAt(), value, now));
      case IN_UCPATH -> record.setInUcpathAt(stamp(record.getInUcpathAt(), value, now));
      case I9_COMPLETE -> record.setI9CompleteAt(stamp(record.getI9CompleteAt(), value, now));
      default -> throw new IllegalArgumentException(field + " is not a checkbox field.");
    }
  }

  /**
   * The checkbox's new stamp: now for a first true, the old stamp for a repeated true, null for
   * false.
   */
  static LocalDateTime stamp(LocalDateTime current, String value, LocalDateTime now) {
    if ("true".equalsIgnoreCase(value)) {
      return current == null ? now : current;
    }
    if ("false".equalsIgnoreCase(value)) {
      return null;
    }
    throw new IllegalArgumentException(CHECKBOX_VALUE);
  }

  /** The dropdown's value: null for blank, else the enum by name. */
  static NewHireForm newHireForm(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }
    try {
      return NewHireForm.valueOf(value);
    } catch (IllegalArgumentException e) {
      throw new IllegalArgumentException(NEW_HIRE_FORM_VALUE);
    }
  }

  private static String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }
}
