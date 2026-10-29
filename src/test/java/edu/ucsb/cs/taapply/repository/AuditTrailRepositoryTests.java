package edu.ucsb.cs.taapply.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import edu.ucsb.cs.taapply.entity.AuditTrail;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.test.context.ActiveProfiles;

/**
 * Runs against the Liquibase-built schema, so the check constraint from changeset 017 is really
 * there, not merely implied by the entity.
 */
@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=none")
@ActiveProfiles("test")
public class AuditTrailRepositoryTests {

  @Autowired AuditTrailRepository auditTrailRepository;
  @Autowired TestEntityManager entityManager;

  private static AuditTrail row(Long ta, Long ula, String field, String oldValue, String newValue) {
    return AuditTrail.builder()
        .taApplicationId(ta)
        .ulaApplicationId(ula)
        .fieldName(field)
        .oldValue(oldValue)
        .newValue(newValue)
        .build();
  }

  @Test
  public void a_row_round_trips_with_its_timestamp_stamped_on_insert() {
    AuditTrail saved = auditTrailRepository.save(row(7L, null, "major", "CS", "CE"));
    entityManager.flush();
    entityManager.clear();

    AuditTrail found = auditTrailRepository.findById(saved.getId()).orElseThrow();
    assertEquals(7L, found.getTaApplicationId());
    assertEquals(null, found.getUlaApplicationId());
    assertEquals("major", found.getFieldName());
    assertEquals("CS", found.getOldValue());
    assertEquals("CE", found.getNewValue());
    assertNotNull(found.getEditedAt());
  }

  /**
   * Either value may be null: a field that was blank, a row added, a field blanked, a row deleted.
   */
  @Test
  public void old_and_new_values_may_be_null() {
    AuditTrail added = auditTrailRepository.save(row(null, 9L, "priorCoursework", null, "{...}"));
    AuditTrail cleared = auditTrailRepository.save(row(null, 9L, "comments", "Keen", null));
    entityManager.flush();
    entityManager.clear();

    assertEquals(null, auditTrailRepository.findById(added.getId()).orElseThrow().getOldValue());
    assertEquals(null, auditTrailRepository.findById(cleared.getId()).orElseThrow().getNewValue());
  }

  /** The check constraint: exactly one of the two application ids. */
  @Test
  public void a_row_with_neither_application_id_is_refused() {
    // The identity column makes the insert immediate, so the save itself is refused.
    assertThrows(
        DataIntegrityViolationException.class,
        () -> {
          auditTrailRepository.save(row(null, null, "major", "a", "b"));
          entityManager.flush();
        });
  }

  @Test
  public void a_row_with_both_application_ids_is_refused() {
    // The identity column makes the insert immediate, so the save itself is refused.
    assertThrows(
        DataIntegrityViolationException.class,
        () -> {
          auditTrailRepository.save(row(7L, 9L, "major", "a", "b"));
          entityManager.flush();
        });
  }

  @Test
  public void the_field_name_is_required() {
    // The identity column makes the insert immediate, so the save itself is refused.
    assertThrows(
        DataIntegrityViolationException.class,
        () -> {
          auditTrailRepository.save(row(7L, null, null, "a", "b"));
          entityManager.flush();
        });
  }

  @Test
  public void rows_are_found_per_application_oldest_first_and_paged_sorted_over_all() {
    AuditTrail first = auditTrailRepository.save(row(7L, null, "major", "CS", "CE"));
    AuditTrail second = auditTrailRepository.save(row(7L, null, "comments", null, "x"));
    AuditTrail other = auditTrailRepository.save(row(null, 7L, "major", "Math", "Stats"));
    entityManager.flush();
    entityManager.clear();

    assertEquals(
        List.of(first.getId(), second.getId()),
        auditTrailRepository.findByTaApplicationIdOrderByIdAsc(7L).stream()
            .map(AuditTrail::getId)
            .toList());
    assertEquals(
        List.of(other.getId()),
        auditTrailRepository.findByUlaApplicationIdOrderByIdAsc(7L).stream()
            .map(AuditTrail::getId)
            .toList());
    assertEquals(List.of(), auditTrailRepository.findByTaApplicationIdOrderByIdAsc(99L));

    // The page the Audit Trail page asks for: sorted by a column, sliced.
    Page<AuditTrail> page =
        auditTrailRepository.findAll(
            PageRequest.of(0, 2, Sort.by(Sort.Direction.ASC, "fieldName")));
    assertEquals(3, page.getTotalElements());
    assertEquals(2, page.getTotalPages());
    assertEquals(
        List.of("comments", "major"),
        page.getContent().stream().map(AuditTrail::getFieldName).toList());
  }
}
