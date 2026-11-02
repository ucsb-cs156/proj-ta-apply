package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.RankingListVersion;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface RankingListVersionRepository extends CrudRepository<RankingListVersion, Long> {

  /** Adds one to the course's version if, and only if, it is still {@code expected}. */
  @Transactional
  @Modifying(clearAutomatically = true)
  @Query(
      "update ranking_list_version v set v.version = v.version + 1"
          + " where v.recruitmentCourseId = :id and v.version = :expected")
  int advance(@Param("id") Long recruitmentCourseId, @Param("expected") Integer expected);

  /** Adds one to the course's version, whatever it is. */
  @Transactional
  @Modifying(clearAutomatically = true)
  @Query(
      "update ranking_list_version v set v.version = v.version + 1"
          + " where v.recruitmentCourseId = :id")
  int increment(@Param("id") Long recruitmentCourseId);

  /** Starts the course's version at 1; fails if there is a row already. */
  @Transactional
  @Modifying
  @Query(
      value = "insert into ranking_list_versions (recruitment_course_id, version) values (:id, 1)",
      nativeQuery = true)
  int create(@Param("id") Long recruitmentCourseId);
}
