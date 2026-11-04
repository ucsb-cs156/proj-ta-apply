package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import java.util.List;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ApplicationRepository extends CrudRepository<Application, Long> {

  /** Every application belonging to one person, newest first. */
  List<Application> findByEmailOrderByIdDesc(String email);

  /**
   * One person's applications to one recruitment, newest first: several only when they cancelled
   * and started again (issue #318).
   */
  List<Application> findByEmailAndRecruitmentIdOrderByIdDesc(String email, Long recruitmentId);

  /** How many applications, cancelled or not, one person has made to one recruitment. */
  long countByEmailAndRecruitmentId(String email, Long recruitmentId);

  /** Whether the person has an application to the recruitment other than one with this status. */
  boolean existsByEmailAndRecruitmentIdAndStatusNot(
      String email, Long recruitmentId, ApplicationReviewStatus status);

  /** Every application to one recruitment, in the order they were created. */
  List<Application> findByRecruitmentIdOrderByIdAsc(Long recruitmentId);

  boolean existsByEmailAndRecruitmentId(String email, Long recruitmentId);
}
