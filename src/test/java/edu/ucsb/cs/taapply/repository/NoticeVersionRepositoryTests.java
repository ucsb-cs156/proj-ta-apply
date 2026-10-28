package edu.ucsb.cs.taapply.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import edu.ucsb.cs.taapply.entity.NoticeVersion;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.ActiveProfiles;

/** Against the Liquibase schema from changeset 012: the table exists, and "latest" means latest. */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
public class NoticeVersionRepositoryTests {

  @Autowired TestEntityManager entityManager;
  @Autowired NoticeVersionRepository noticeVersionRepository;

  private NoticeVersion save(RecruitmentType type, String content, LocalDateTime at) {
    return noticeVersionRepository.save(
        NoticeVersion.builder().type(type).content(content).createdAt(at).build());
  }

  @Test
  public void versions_round_trip_and_the_latest_per_type_is_the_highest_id() {
    NoticeVersion ta1 = save(RecruitmentType.TA, "TA v1", LocalDateTime.of(2026, 1, 1, 9, 0));
    NoticeVersion ula1 = save(RecruitmentType.ULA, "ULA v1", LocalDateTime.of(2026, 1, 1, 9, 1));
    // A long Markdown body, well past VARCHAR(4000), to prove the wide column.
    String longText = "# Terms\n\n" + "Lorem ipsum dolor sit amet. ".repeat(500);
    NoticeVersion ta2 = save(RecruitmentType.TA, longText, LocalDateTime.of(2026, 1, 2, 9, 0));
    entityManager.flush();
    entityManager.clear();

    NoticeVersion latestTa =
        noticeVersionRepository.findFirstByTypeOrderByIdDesc(RecruitmentType.TA).orElseThrow();
    assertEquals(ta2.getId(), latestTa.getId());
    assertEquals(longText, latestTa.getContent());
    assertTrue(latestTa.getContent().length() > 4000);
    assertEquals(LocalDateTime.of(2026, 1, 2, 9, 0), latestTa.getCreatedAt());

    assertEquals(
        ula1.getId(),
        noticeVersionRepository
            .findFirstByTypeOrderByIdDesc(RecruitmentType.ULA)
            .orElseThrow()
            .getId());

    assertEquals(
        List.of(ta2.getId(), ta1.getId()),
        noticeVersionRepository.findAllByTypeOrderByIdDesc(RecruitmentType.TA).stream()
            .map(NoticeVersion::getId)
            .toList());
  }

  @Test
  public void a_type_with_no_versions_has_no_latest() {
    assertTrue(noticeVersionRepository.findFirstByTypeOrderByIdDesc(RecruitmentType.ULA).isEmpty());
    assertTrue(noticeVersionRepository.findAllByTypeOrderByIdDesc(RecruitmentType.ULA).isEmpty());
  }
}
