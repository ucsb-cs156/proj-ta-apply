package edu.ucsb.cs.taapply.models;

import edu.ucsb.cs.taapply.entity.HiringRecord;
import edu.ucsb.cs.taapply.enums.NewHireForm;
import java.time.LocalDateTime;

/**
 * One {@link HiringRecord} as the Soft Offer Results carry it (issue #509): the stamp of each
 * checkbox (null when unchecked), the New Hire form choice and its stamp, the funding source's
 * abbreviation, the staff's comments, and who saved last and when. For admins and hiring staff
 * only; it never travels to an applicant.
 */
public record HiringRecordDto(
    Long id,
    Long applicationId,
    LocalDateTime formalOfferSentAt,
    LocalDateTime formalOfferAcceptedAt,
    NewHireForm newHireForm,
    LocalDateTime newHireFormAt,
    LocalDateTime flsaConflictFoundAt,
    LocalDateTime flsaConflictResolvedAt,
    LocalDateTime inUcpathAt,
    LocalDateTime i9CompleteAt,
    String fundingSource,
    String staffComments,
    LocalDateTime updatedAt,
    String updatedByEmail) {

  public static HiringRecordDto of(HiringRecord record) {
    return new HiringRecordDto(
        record.getId(),
        record.getApplicationId(),
        record.getFormalOfferSentAt(),
        record.getFormalOfferAcceptedAt(),
        record.getNewHireForm(),
        record.getNewHireFormAt(),
        record.getFlsaConflictFoundAt(),
        record.getFlsaConflictResolvedAt(),
        record.getInUcpathAt(),
        record.getI9CompleteAt(),
        record.getFundingSource(),
        record.getStaffComments(),
        record.getUpdatedAt(),
        record.getUpdatedByEmail());
  }
}
