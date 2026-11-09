package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.CandidateRanking;
import java.util.List;
import java.util.Optional;
import org.springframework.data.repository.CrudRepository;

public interface CandidateRankingRepository extends CrudRepository<CandidateRanking, Long> {
  List<CandidateRanking> findByRecruitmentCourseId(Long recruitmentCourseId);

  Optional<CandidateRanking> findByRecruitmentCourseIdAndApplicationId(
      Long recruitmentCourseId, Long applicationId);

  /**
   * Removes every faculty ranking of one application, for when the application itself is deleted
   * (issue #420). Must run inside a transaction.
   */
  long deleteByApplicationId(Long applicationId);
}
