package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public interface RecruitmentRepository extends CrudRepository<Recruitment, Long> {
  Optional<Recruitment> findByQuarterAndType(String quarter, RecruitmentType type);

  boolean existsByQuarterAndType(String quarter, RecruitmentType type);

  /** Most recent quarter first, as the admin listing shows them. */
  List<Recruitment> findAllByOrderByQuarterDescTypeAsc();

  /**
   * Counts the recruitment's assignments version up by one, but only if it is still {@code
   * expected} (issue #280). The comparison and the increment are one statement, so two saves cannot
   * both pass. Returns 1 if it did, 0 if the version had moved (or there is no such recruitment).
   */
  @Transactional
  @Modifying(clearAutomatically = true, flushAutomatically = true)
  @Query(
      "update recruitments r set r.assignmentsVersion = r.assignmentsVersion + 1"
          + " where r.id = :id and r.assignmentsVersion = :expected")
  int bumpAssignmentsVersionIf(@Param("id") Long id, @Param("expected") Integer expected);

  /** Counts the recruitment's assignments version up by one, whatever it is (issue #280). */
  @Transactional
  @Modifying(clearAutomatically = true, flushAutomatically = true)
  @Query(
      "update recruitments r set r.assignmentsVersion = r.assignmentsVersion + 1"
          + " where r.id = :id")
  int bumpAssignmentsVersion(@Param("id") Long id);
}
