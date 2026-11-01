package edu.ucsb.cs.taapply.entity;

import static org.junit.jupiter.api.Assertions.assertEquals;

import edu.ucsb.cs.taapply.enums.AllocationVisibility;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.ActiveProfiles;

/** The allocation_visibility column through the Liquibase schema (issue #224). */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class AllocationVisibilityPersistenceTests {
  @Autowired RecruitmentRepository recruitments;
  @Autowired TestEntityManager entityManager;

  private Recruitment save(AllocationVisibility visibility) {
    Recruitment.RecruitmentBuilder builder =
        Recruitment.builder()
            .quarter("20264")
            .type(RecruitmentType.TA)
            .tentativeOpeningDate(LocalDate.of(2026, 9, 1))
            .primaryConsiderationDate(LocalDate.of(2026, 9, 15));
    if (visibility != null) {
      builder.allocationVisibility(visibility);
    }
    Recruitment saved = recruitments.save(builder.build());
    entityManager.flush();
    entityManager.clear();
    return saved;
  }

  @Test
  void a_new_recruitment_is_for_admins_only() {
    Recruitment saved = save(null);
    assertEquals(
        AllocationVisibility.ADMINS_ONLY,
        recruitments.findById(saved.getId()).orElseThrow().getAllocationVisibility());
  }

  @Test
  void each_visibility_round_trips() {
    for (AllocationVisibility visibility : AllocationVisibility.values()) {
      Recruitment r = recruitments.save(newRecruitment(visibility));
      entityManager.flush();
      entityManager.clear();
      assertEquals(
          visibility, recruitments.findById(r.getId()).orElseThrow().getAllocationVisibility());
    }
  }

  private static Recruitment newRecruitment(AllocationVisibility visibility) {
    return Recruitment.builder()
        .quarter("2026" + (visibility.ordinal() + 1))
        .type(RecruitmentType.ULA)
        .tentativeOpeningDate(LocalDate.of(2026, 9, 1))
        .primaryConsiderationDate(LocalDate.of(2026, 9, 15))
        .allocationVisibility(visibility)
        .build();
  }
}
