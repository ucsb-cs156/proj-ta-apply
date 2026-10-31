package edu.ucsb.cs.taapply.repository;

import static org.junit.jupiter.api.Assertions.*;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.CandidateRanking;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class CandidateRankingRepositoryTests {
  @Autowired CandidateRankingRepository rankings;
  @Autowired ApplicationRepository applications;
  @Autowired RecruitmentRepository recruitments;
  @Autowired RecruitmentCourseRepository courses;
  @Autowired TestEntityManager entityManager;

  private Long[] fixture() {
    Recruitment recruitment =
        recruitments.save(Recruitment.builder().quarter("20261").type(RecruitmentType.TA).build());
    RecruitmentCourse course =
        courses.save(
            RecruitmentCourse.builder()
                .recruitmentId(recruitment.getId())
                .courseId("CMPSC   156")
                .section("0100")
                .enrollCode("12345")
                .build());
    Application application =
        applications.save(
            Application.builder()
                .recruitmentId(recruitment.getId())
                .email("candidate@ucsb.edu")
                .build());
    entityManager.flush();
    return new Long[] {recruitment.getId(), course.getId(), application.getId()};
  }

  @Test
  void nullable_ranks_round_trip_and_primary_sections_are_independent() {
    Long[] ids = fixture();
    CandidateRanking first =
        rankings.save(
            CandidateRanking.builder()
                .recruitmentCourseId(ids[1])
                .applicationId(ids[2])
                .rank(2)
                .build());
    Long rankingId = first.getId();
    RecruitmentCourse second =
        courses.save(
            RecruitmentCourse.builder()
                .recruitmentId(ids[0])
                .courseId("CMPSC   156")
                .section("0200")
                .enrollCode("67890")
                .build());
    rankings.save(
        CandidateRanking.builder()
            .recruitmentCourseId(second.getId())
            .applicationId(ids[2])
            .rank(1)
            .build());
    entityManager.flush();
    entityManager.clear();
    CandidateRanking read =
        rankings.findByRecruitmentCourseIdAndApplicationId(ids[1], ids[2]).orElseThrow();
    assertEquals(rankingId, read.getId());
    assertEquals(ids[1], read.getRecruitmentCourseId());
    assertEquals(ids[2], read.getApplicationId());
    assertEquals(2, read.getRank());
    assertEquals(1, rankings.findByRecruitmentCourseId(second.getId()).get(0).getRank());
    assertEquals(1, rankings.findByRecruitmentCourseId(ids[1]).size());
    read.setRank(null);
    rankings.save(read);
    entityManager.flush();
    entityManager.clear();
    assertNull(rankings.findById(rankingId).orElseThrow().getRank());
    assertTrue(rankings.findByRecruitmentCourseIdAndApplicationId(ids[1], 99999L).isEmpty());
  }

  @Test
  void ties_are_persisted_within_one_section() {
    Long[] ids = fixture();
    Application other =
        applications.save(
            Application.builder().recruitmentId(ids[0]).email("other-candidate@ucsb.edu").build());
    rankings.save(
        CandidateRanking.builder()
            .recruitmentCourseId(ids[1])
            .applicationId(ids[2])
            .rank(1)
            .build());
    rankings.save(
        CandidateRanking.builder()
            .recruitmentCourseId(ids[1])
            .applicationId(other.getId())
            .rank(1)
            .build());
    entityManager.flush();
    entityManager.clear();
    assertEquals(2, rankings.findByRecruitmentCourseId(ids[1]).size());
    assertTrue(
        rankings.findByRecruitmentCourseId(ids[1]).stream()
            .allMatch(ranking -> ranking.getRank() == 1));
  }

  @Test
  void duplicate_pairs_are_rejected() {
    Long[] ids = fixture();
    rankings.save(
        CandidateRanking.builder().recruitmentCourseId(ids[1]).applicationId(ids[2]).build());
    entityManager.flush();
    assertThrows(
        DataIntegrityViolationException.class,
        () ->
            rankings.save(
                CandidateRanking.builder()
                    .recruitmentCourseId(ids[1])
                    .applicationId(ids[2])
                    .rank(2)
                    .build()));
  }

  @Test
  void dangling_course_fk_is_rejected() {
    Long[] ids = fixture();
    assertThrows(
        DataIntegrityViolationException.class,
        () ->
            rankings.save(
                CandidateRanking.builder()
                    .recruitmentCourseId(99999L)
                    .applicationId(ids[2])
                    .rank(1)
                    .build()));
  }

  @Test
  void dangling_application_fk_is_rejected() {
    Long[] ids = fixture();
    assertThrows(
        DataIntegrityViolationException.class,
        () ->
            rankings.save(
                CandidateRanking.builder()
                    .recruitmentCourseId(ids[1])
                    .applicationId(99999L)
                    .rank(1)
                    .build()));
  }

  @Test
  void course_deletion_cascades() {
    Long[] ids = fixture();
    CandidateRanking ranking =
        rankings.save(
            CandidateRanking.builder()
                .recruitmentCourseId(ids[1])
                .applicationId(ids[2])
                .rank(1)
                .build());
    entityManager.flush();
    courses.deleteById(ids[1]);
    entityManager.flush();
    entityManager.clear();
    assertTrue(rankings.findById(ranking.getId()).isEmpty());
    assertTrue(applications.findById(ids[2]).isPresent());
  }

  @Test
  void application_deletion_cascades() {
    Long[] ids = fixture();
    CandidateRanking ranking =
        rankings.save(
            CandidateRanking.builder()
                .recruitmentCourseId(ids[1])
                .applicationId(ids[2])
                .rank(1)
                .build());
    entityManager.flush();
    applications.deleteById(ids[2]);
    entityManager.flush();
    entityManager.clear();
    assertTrue(rankings.findById(ranking.getId()).isEmpty());
    assertTrue(courses.findById(ids[1]).isPresent());
  }
}
