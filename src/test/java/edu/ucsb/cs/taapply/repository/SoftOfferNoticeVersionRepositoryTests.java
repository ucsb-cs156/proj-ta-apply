package edu.ucsb.cs.taapply.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import edu.ucsb.cs.taapply.entity.SoftOfferNoticeVersion;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.ActiveProfiles;

/** Against the Liquibase schema from changeset 073: the table exists, and "latest" means latest. */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
public class SoftOfferNoticeVersionRepositoryTests {

  @Autowired TestEntityManager entityManager;
  @Autowired SoftOfferNoticeVersionRepository repository;

  private SoftOfferNoticeVersion save(String content, LocalDateTime at) {
    return repository.save(SoftOfferNoticeVersion.builder().content(content).createdAt(at).build());
  }

  @Test
  public void versions_round_trip_and_the_latest_is_the_highest_id() {
    SoftOfferNoticeVersion v1 = save("v1", LocalDateTime.of(2026, 1, 1, 9, 0));
    // A long Markdown body, well past VARCHAR(4000), to prove the wide column.
    String longText = "# Soft offer\n\n" + "Lorem ipsum dolor sit amet. ".repeat(500);
    SoftOfferNoticeVersion v2 = save(longText, LocalDateTime.of(2026, 1, 2, 9, 0));
    entityManager.flush();
    entityManager.clear();

    SoftOfferNoticeVersion latest = repository.findFirstByOrderByIdDesc().orElseThrow();
    assertEquals(v2.getId(), latest.getId());
    assertEquals(longText, latest.getContent());
    assertTrue(latest.getContent().length() > 4000);
    assertEquals(LocalDateTime.of(2026, 1, 2, 9, 0), latest.getCreatedAt());

    assertEquals(
        List.of(v2.getId(), v1.getId()),
        repository.findAllByOrderByIdDesc().stream().map(SoftOfferNoticeVersion::getId).toList());
  }

  @Test
  public void with_no_versions_there_is_no_latest() {
    assertTrue(repository.findFirstByOrderByIdDesc().isEmpty());
    assertTrue(repository.findAllByOrderByIdDesc().isEmpty());
  }
}
