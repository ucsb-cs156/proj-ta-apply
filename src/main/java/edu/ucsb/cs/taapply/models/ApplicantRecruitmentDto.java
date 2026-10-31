package edu.ucsb.cs.taapply.models;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** The recruitment fields applicants need, without faculty-only review lifecycle details. */
public record ApplicantRecruitmentDto(
    Long id,
    String quarter,
    RecruitmentType type,
    ApplicationStatus applicationStatus,
    LocalDate tentativeOpeningDate,
    LocalDate primaryConsiderationDate,
    LocalDate actualOpeningDate,
    LocalDate actualClosingDate,
    LocalDateTime lastPopulatedAt) {

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
        recruitment.getLastPopulatedAt());
  }
}
