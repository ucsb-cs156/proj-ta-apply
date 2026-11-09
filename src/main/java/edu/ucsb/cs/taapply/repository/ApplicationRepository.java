package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import java.util.List;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;
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

  /**
   * The highest attempt number among one person's applications to one recruitment, cancelled or
   * not, or 0 if they have none; a new application is one more (issue #318). Not the count: a
   * cancelled application turned back into a draft is deleted (issue #420), and when it was not the
   * newest, one more than the count is a number a later cancelled row still has.
   */
  @Query(
      "select coalesce(max(a.attemptNumber), 0) from applications a"
          + " where a.email = :email and a.recruitmentId = :recruitmentId")
  int maxAttemptNumber(@Param("email") String email, @Param("recruitmentId") Long recruitmentId);

  /** Whether the person has an application to the recruitment other than one with this status. */
  boolean existsByEmailAndRecruitmentIdAndStatusNot(
      String email, Long recruitmentId, ApplicationReviewStatus status);

  /** Every application to one recruitment, in the order they were created. */
  List<Application> findByRecruitmentIdOrderByIdAsc(Long recruitmentId);

  boolean existsByEmailAndRecruitmentId(String email, Long recruitmentId);
}
