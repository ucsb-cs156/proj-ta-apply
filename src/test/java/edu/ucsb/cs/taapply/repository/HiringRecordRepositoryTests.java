package edu.ucsb.cs.taapply.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.HiringRecord;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.NewHireForm;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;

/** Against the Liquibase schema from changeset 079: one hiring record per application (#509). */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
public class HiringRecordRepositoryTests {

  @Autowired TestEntityManager entityManager;
  @Autowired HiringRecordRepository repository;
  @Autowired ApplicationRepository applicationRepository;
  @Autowired RecruitmentRepository recruitmentRepository;

  private Long recruitmentId;

  /** Applications need a recruitment to belong to (a foreign key). */
  private Long application(String email) {
    if (recruitmentId == null) {
      recruitmentId =
          recruitmentRepository
              .save(
                  Recruitment.builder()
                      .quarter("20264")
                      .type(RecruitmentType.ULA)
                      .tentativeOpeningDate(LocalDate.of(2026, 9, 1))
                      .primaryConsiderationDate(LocalDate.of(2026, 9, 20))
                      .build())
              .getId();
    }
    return applicationRepository
        .save(Application.builder().recruitmentId(recruitmentId).email(email).build())
        .getId();
  }

  private static final LocalDateTime AT = LocalDateTime.of(2026, 11, 21, 8, 5);

  private HiringRecord record(Long applicationId) {
    return repository.save(
        HiringRecord.builder()
            .applicationId(applicationId)
            .formalOfferSentAt(AT)
            .newHireForm(NewHireForm.NOT_NEEDED)
            .newHireFormAt(AT)
            .fundingSource("TA")
            .staffComments("ok")
            .updatedAt(AT)
            .updatedByEmail("staff@ucsb.edu")
            .build());
  }

  @Test
  public void records_round_trip_and_are_found_by_application_and_by_applications() {
    Long ada = application("ada@ucsb.edu");
    Long grace = application("grace@ucsb.edu");
    Long alan = application("alan@ucsb.edu");
    HiringRecord first = record(ada);
    record(grace);
    entityManager.flush();
    entityManager.clear();

    HiringRecord found = repository.findByApplicationId(ada).orElseThrow();
    assertEquals(first.getId(), found.getId());
    assertEquals(AT, found.getFormalOfferSentAt());
    assertEquals(NewHireForm.NOT_NEEDED, found.getNewHireForm());
    assertEquals(AT, found.getNewHireFormAt());
    assertEquals("TA", found.getFundingSource());
    assertEquals("ok", found.getStaffComments());
    assertEquals(AT, found.getUpdatedAt());
    assertEquals("staff@ucsb.edu", found.getUpdatedByEmail());
    assertTrue(repository.findByApplicationId(alan).isEmpty());
    assertEquals(2, repository.findByApplicationIdIn(List.of(ada, grace, alan)).size());
    assertEquals(1, repository.findByApplicationIdIn(List.of(grace)).size());
    assertEquals(0, repository.findByApplicationIdIn(List.of()).size());
    // Issue #512, part 2: how many records carry a funding source, for the delete rule.
    assertEquals(2, repository.countByFundingSource("TA"));
    assertEquals(0, repository.countByFundingSource("sub0"));
  }

  @Test
  public void an_application_has_at_most_one_record() {
    Long ada = application("ada@ucsb.edu");
    record(ada);
    entityManager.flush();

    assertThrows(
        DataIntegrityViolationException.class,
        () -> {
          record(ada);
          entityManager.flush();
        });
  }

  @Test
  public void a_record_goes_with_its_application_when_that_is_deleted() {
    Long ada = application("ada@ucsb.edu");
    record(ada);
    entityManager.flush();
    entityManager.clear();

    applicationRepository.deleteById(ada);
    entityManager.flush();
    entityManager.clear();

    assertTrue(repository.findByApplicationId(ada).isEmpty());
  }
}
