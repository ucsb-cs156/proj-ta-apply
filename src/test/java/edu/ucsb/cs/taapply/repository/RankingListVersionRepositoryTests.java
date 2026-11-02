package edu.ucsb.cs.taapply.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import edu.ucsb.cs.taapply.entity.RankingListVersion;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class RankingListVersionRepositoryTests {
  @Autowired RankingListVersionRepository versions;

  private int versionOf(long courseId) {
    return versions.findById(courseId).orElseThrow().getVersion();
  }

  @Test
  void create_starts_a_course_at_version_1_and_only_once() {
    assertEquals(1, versions.create(901L));
    assertEquals(1, versionOf(901L));
    assertThrows(DataIntegrityViolationException.class, () -> versions.create(901L));
  }

  @Test
  void advance_moves_only_the_expected_version() {
    versions.create(902L);
    assertEquals(0, versions.advance(902L, 5));
    assertEquals(1, versionOf(902L));
    assertEquals(1, versions.advance(902L, 1));
    assertEquals(2, versionOf(902L));
    assertEquals(0, versions.advance(902L, 1));
    assertEquals(2, versionOf(902L));
  }

  @Test
  void advance_leaves_other_courses_alone() {
    versions.create(903L);
    versions.create(904L);
    assertEquals(1, versions.advance(903L, 1));
    assertEquals(2, versionOf(903L));
    assertEquals(1, versionOf(904L));
  }

  @Test
  void increment_adds_one_whatever_the_version_and_does_nothing_without_a_row() {
    assertEquals(0, versions.increment(905L));
    versions.save(new RankingListVersion(905L, 7));
    assertEquals(1, versions.increment(905L));
    assertEquals(8, versionOf(905L));
  }
}
