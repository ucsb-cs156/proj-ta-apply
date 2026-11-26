package edu.ucsb.cs.taapply.models;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;

public class ApplicantRecruitmentDtoTests {

  private static Recruitment.RecruitmentBuilder w26Ula() {
    return Recruitment.builder()
        .id(7L)
        .quarter("20261")
        .type(RecruitmentType.ULA)
        .applicationStatus(ApplicationStatus.CLOSED)
        .tentativeOpeningDate(LocalDate.of(2026, 1, 5))
        .primaryConsiderationDate(LocalDate.of(2026, 1, 20))
        .actualOpeningDate(LocalDate.of(2026, 1, 6))
        .actualClosingDate(LocalDate.of(2026, 2, 1))
        .courseDataLastUpdated(LocalDateTime.of(2026, 1, 4, 9, 30));
  }

  @Test
  public void from_copies_every_applicant_facing_field() {
    ApplicantRecruitmentDto dto = ApplicantRecruitmentDto.from(w26Ula().hidden(false).build());

    assertEquals(7L, dto.id());
    assertEquals("20261", dto.quarter());
    assertEquals(RecruitmentType.ULA, dto.type());
    assertEquals(ApplicationStatus.CLOSED, dto.applicationStatus());
    assertEquals(LocalDate.of(2026, 1, 5), dto.tentativeOpeningDate());
    assertEquals(LocalDate.of(2026, 1, 20), dto.primaryConsiderationDate());
    assertEquals(LocalDate.of(2026, 1, 6), dto.actualOpeningDate());
    assertEquals(LocalDate.of(2026, 2, 1), dto.actualClosingDate());
    assertEquals(LocalDateTime.of(2026, 1, 4, 9, 30), dto.courseDataLastUpdated());
    assertFalse(dto.hidden());
  }

  /** Issue #503: the flag is carried so an admin's own upcoming row can be marked Hidden. */
  @Test
  public void hidden_is_true_only_when_the_admin_hid_the_recruitment() {
    assertTrue(ApplicantRecruitmentDto.from(w26Ula().hidden(true).build()).hidden());
    // No value, as a recruitment from before the flag existed has, means shown.
    assertFalse(ApplicantRecruitmentDto.from(w26Ula().hidden(null).build()).hidden());
  }
}
