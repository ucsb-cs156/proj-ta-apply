package edu.ucsb.cs.taapply.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import edu.ucsb.cs.taapply.entity.TaMajor;
import edu.ucsb.cs.taapply.entity.TaTopic;
import edu.ucsb.cs.taapply.entity.UlaMajor;
import edu.ucsb.cs.taapply.entity.UlaTopic;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * Runs against the Liquibase-built schema, so each of the four settings tables created by changeset
 * 010 is proven to exist and to match its entity. They are deliberately separate tables, so a row
 * in one must not show up in another.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
public class AppSettingsRepositoryTests {

  @Autowired TaMajorRepository taMajorRepository;
  @Autowired TaTopicRepository taTopicRepository;
  @Autowired UlaMajorRepository ulaMajorRepository;
  @Autowired UlaTopicRepository ulaTopicRepository;

  @Test
  public void each_list_has_its_own_table_keyed_by_name() {
    taMajorRepository.save(TaMajor.builder().name("Computer Science").build());
    taTopicRepository.save(TaTopic.builder().name("Compilers").build());
    ulaMajorRepository.save(UlaMajor.builder().name("Statistics").build());
    ulaTopicRepository.save(UlaTopic.builder().name("Python").build());

    assertTrue(taMajorRepository.existsById("Computer Science"));
    assertTrue(taTopicRepository.existsById("Compilers"));
    assertTrue(ulaMajorRepository.existsById("Statistics"));
    assertTrue(ulaTopicRepository.existsById("Python"));

    // Same name, different table: independent.
    assertFalse(ulaMajorRepository.existsById("Computer Science"));
    assertFalse(ulaTopicRepository.existsById("Compilers"));
    assertFalse(taMajorRepository.existsById("Statistics"));
    assertFalse(taTopicRepository.existsById("Python"));

    assertEquals(1, taMajorRepository.count());
    assertEquals(1, taTopicRepository.count());
    assertEquals(1, ulaMajorRepository.count());
    assertEquals(1, ulaTopicRepository.count());

    // The name is the key, so saving it again is an update, not a second row.
    taMajorRepository.save(TaMajor.builder().name("Computer Science").build());
    assertEquals(1, taMajorRepository.count());
    assertEquals(
        "Computer Science", taMajorRepository.findById("Computer Science").orElseThrow().getName());
  }
}
