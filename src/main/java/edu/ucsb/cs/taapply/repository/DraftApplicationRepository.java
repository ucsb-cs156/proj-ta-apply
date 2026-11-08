package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.DraftApplication;
import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import edu.ucsb.cs.taapply.models.DraftConflict;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface DraftApplicationRepository extends CrudRepository<DraftApplication, Long> {

  /** Every draft belonging to one person, newest first. */
  List<DraftApplication> findByEmailOrderByIdDesc(String email);

  /** Every draft for one recruitment, oldest first (issue #296). */
  List<DraftApplication> findByRecruitmentIdOrderByIdAsc(Long recruitmentId);

  /** How many drafts one recruitment has (issue #296). */
  long countByRecruitmentId(Long recruitmentId);

  Optional<DraftApplication> findByEmailAndRecruitmentId(String email, Long recruitmentId);

  /**
   * Issue #417: every student with both a draft and an application to one recruitment, leaving out
   * the applications with status {@code excluded} (CANCELLED: one who cancelled may start again).
   * One row per draft and application pair, by email and then application id. A join in the
   * database, so nothing but the conflicts is loaded.
   */
  @Query(
      "select new edu.ucsb.cs.taapply.models.DraftConflict(d.email, d.id, a.id)"
          + " from draft_applications d, applications a"
          + " where d.recruitmentId = :recruitmentId"
          + " and a.recruitmentId = d.recruitmentId"
          + " and a.email = d.email"
          + " and a.status <> :excluded"
          + " order by d.email, a.id")
  List<DraftConflict> findConflictsWithApplications(
      @Param("recruitmentId") Long recruitmentId,
      @Param("excluded") ApplicationReviewStatus excluded);
}
