package edu.ucsb.cs.taapply.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import edu.ucsb.cs.taapply.entity.DraftAdminComment;
import edu.ucsb.cs.taapply.entity.DraftApplication;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.ActiveProfiles;

/**
 * Admin comments on drafts (issue #296) against the real Liquibase-built schema, along with the
 * per-recruitment queries on drafts the admin pages use.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
public class DraftAdminCommentRepositoryTests {

  @Autowired private TestEntityManager entityManager;
  @Autowired private DraftApplicationRepository draftApplicationRepository;
  @Autowired private DraftAdminCommentRepository draftAdminCommentRepository;
  @Autowired private RecruitmentRepository recruitmentRepository;

  @BeforeEach
  void clean() {
    draftApplicationRepository.deleteAll();
    recruitmentRepository.deleteAll();
  }

  private Recruitment recruitment(String quarter) {
    return recruitmentRepository.save(
        Recruitment.builder()
            .quarter(quarter)
            .type(RecruitmentType.TA)
            .tentativeOpeningDate(LocalDate.of(2026, 1, 5))
            .primaryConsiderationDate(LocalDate.of(2026, 1, 20))
            .build());
  }

  private DraftApplication draft(Recruitment r, String email) {
    return draftApplicationRepository.save(
        DraftApplication.builder().recruitmentId(r.getId()).email(email).build());
  }

  private void flushAndForget() {
    entityManager.flush();
    entityManager.clear();
  }

  @Test
  public void drafts_are_listed_and_counted_for_their_own_recruitment_only() {
    Recruitment winter = recruitment("20261");
    Recruitment spring = recruitment("20262");
    DraftApplication first = draft(winter, "a@ucsb.edu");
    DraftApplication other = draft(spring, "a@ucsb.edu");
    DraftApplication second = draft(winter, "b@ucsb.edu");
    flushAndForget();

    List<DraftApplication> winters =
        draftApplicationRepository.findByRecruitmentIdOrderByIdAsc(winter.getId());

    assertEquals(
        List.of(first.getId(), second.getId()),
        winters.stream().map(DraftApplication::getId).toList());
    assertEquals(2, draftApplicationRepository.countByRecruitmentId(winter.getId()));
    assertEquals(1, draftApplicationRepository.countByRecruitmentId(spring.getId()));
    assertEquals(
        List.of(other.getId()),
        draftApplicationRepository.findByRecruitmentIdOrderByIdAsc(spring.getId()).stream()
            .map(DraftApplication::getId)
            .toList());
    assertEquals(0, draftApplicationRepository.countByRecruitmentId(-1L));
  }

  @Test
  public void comments_are_kept_per_draft_and_found_for_several_at_once() {
    Recruitment r = recruitment("20261");
    DraftApplication first = draft(r, "a@ucsb.edu");
    DraftApplication second = draft(r, "b@ucsb.edu");
    DraftApplication uncommented = draft(r, "c@ucsb.edu");
    draftAdminCommentRepository.save(new DraftAdminComment(first.getId(), "one"));
    draftAdminCommentRepository.save(new DraftAdminComment(second.getId(), "two"));
    flushAndForget();

    List<DraftAdminComment> found =
        draftAdminCommentRepository.findByDraftIdIn(
            List.of(first.getId(), second.getId(), uncommented.getId()));

    assertEquals(2, found.size());
    assertEquals(
        "one", draftAdminCommentRepository.findById(first.getId()).orElseThrow().getComments());
    assertTrue(draftAdminCommentRepository.findById(uncommented.getId()).isEmpty());
  }

  @Test
  public void saving_comments_again_replaces_them_and_leaves_the_draft_s_version_alone() {
    Recruitment r = recruitment("20261");
    DraftApplication draft = draft(r, "a@ucsb.edu");
    flushAndForget();
    Integer version = draftApplicationRepository.findById(draft.getId()).orElseThrow().getVersion();

    draftAdminCommentRepository.save(new DraftAdminComment(draft.getId(), "first"));
    flushAndForget();
    draftAdminCommentRepository.save(new DraftAdminComment(draft.getId(), "second"));
    flushAndForget();

    assertEquals(1, draftAdminCommentRepository.count());
    assertEquals(
        "second", draftAdminCommentRepository.findById(draft.getId()).orElseThrow().getComments());
    assertEquals(
        version, draftApplicationRepository.findById(draft.getId()).orElseThrow().getVersion());
  }

  /** A draft that is withdrawn or removed takes its comments with it. */
  @Test
  public void deleting_a_draft_deletes_its_comments() {
    Recruitment r = recruitment("20261");
    DraftApplication draft = draft(r, "a@ucsb.edu");
    draftAdminCommentRepository.save(new DraftAdminComment(draft.getId(), "gone soon"));
    flushAndForget();

    draftApplicationRepository.deleteById(draft.getId());
    flushAndForget();

    assertEquals(0, draftAdminCommentRepository.count());
  }
}
