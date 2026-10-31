package edu.ucsb.cs.taapply.entity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.HiddenColumnRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;

/** The hidden_columns table through the Liquibase schema (issue #185). */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class HiddenColumnPersistenceTests {
  @Autowired HiddenColumnRepository hiddenColumns;
  @Autowired RecruitmentRepository recruitments;
  @Autowired TestEntityManager entityManager;

  private Recruitment recruitment() {
    return recruitments.save(
        Recruitment.builder()
            .quarter("20264")
            .type(RecruitmentType.TA)
            .tentativeOpeningDate(LocalDate.of(2026, 9, 1))
            .primaryConsiderationDate(LocalDate.of(2026, 9, 15))
            .build());
  }

  private static HiddenColumn hidden(Long recruitmentId, String columnId) {
    return HiddenColumn.builder()
        .tableKey("recruitmentCourses")
        .recruitmentId(recruitmentId)
        .columnId(columnId)
        .build();
  }

  @Test
  void hidden_columns_are_found_by_table_and_recruitment_in_column_order() {
    Recruitment r = recruitment();
    hiddenColumns.save(hidden(r.getId(), "room"));
    hiddenColumns.save(hidden(r.getId(), "days"));
    HiddenColumn other = hidden(r.getId(), "days");
    other.setTableKey("applications");
    hiddenColumns.save(other);
    entityManager.flush();
    entityManager.clear();

    List<HiddenColumn> found =
        hiddenColumns.findByTableKeyAndRecruitmentIdOrderByColumnIdAsc(
            "recruitmentCourses", r.getId());
    assertEquals(List.of("days", "room"), found.stream().map(HiddenColumn::getColumnId).toList());
    assertTrue(
        hiddenColumns
            .findByTableKeyAndRecruitmentIdAndColumnId("recruitmentCourses", r.getId(), "room")
            .isPresent());
    assertTrue(
        hiddenColumns
            .findByTableKeyAndRecruitmentIdAndColumnId("recruitmentCourses", r.getId(), "title")
            .isEmpty());
  }

  @Test
  void the_same_column_cannot_be_hidden_twice_on_one_table() {
    Recruitment r = recruitment();
    hiddenColumns.save(hidden(r.getId(), "room"));
    entityManager.flush();

    assertThrows(
        DataIntegrityViolationException.class,
        () -> {
          hiddenColumns.save(hidden(r.getId(), "room"));
          entityManager.flush();
        });
  }

  @Test
  void a_hidden_column_needs_an_existing_recruitment() {
    assertThrows(
        DataIntegrityViolationException.class,
        () -> {
          hiddenColumns.save(hidden(999L, "room"));
          entityManager.flush();
        });
  }
}
