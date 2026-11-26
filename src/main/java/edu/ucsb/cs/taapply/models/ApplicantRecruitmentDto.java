package edu.ucsb.cs.taapply.models;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.services.RecruitmentVisibility;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * The recruitment fields applicants need, without faculty-only review lifecycle details. The hidden
 * flag (issue #496) is false for everything a student or instructor gets, since a hidden
 * recruitment is filtered out for them; an admin's own student section uses it to mark the
 * recruitment Hidden (issue #503).
 */
public record ApplicantRecruitmentDto(
    Long id,
    String quarter,
    RecruitmentType type,
    ApplicationStatus applicationStatus,
    LocalDate tentativeOpeningDate,
    LocalDate primaryConsiderationDate,
    LocalDate actualOpeningDate,
    LocalDate actualClosingDate,
    LocalDateTime courseDataLastUpdated,
    boolean hidden) {

  public static ApplicantRecruitmentDto from(Recruitment recruitment) {
    return new ApplicantRecruitmentDto(
        recruitment.getId(),
        recruitment.getQuarter(),
        recruitment.getType(),
        recruitment.getApplicationStatus(),
        recruitment.getTentativeOpeningDate(),
        recruitment.getPrimaryConsiderationDate(),
        recruitment.getActualOpeningDate(),
        recruitment.getActualClosingDate(),
        recruitment.getCourseDataLastUpdated(),
        RecruitmentVisibility.isHidden(recruitment));
  }
}
