package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import java.util.List;
import java.util.Optional;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RecruitmentCourseRepository extends CrudRepository<RecruitmentCourse, Long> {
  /** Keyed on the enroll code, since one course may have several primary sections. */
  Optional<RecruitmentCourse> findByRecruitmentIdAndEnrollCode(
      Long recruitmentId, String enrollCode);

  /**
   * Every row for a recruitment, removed ones included. Callers filter and sort in Java: the padded
   * course id only sorts correctly under code-unit ordering, and Postgres' collation can treat
   * spaces as negligible.
   */
  List<RecruitmentCourse> findByRecruitmentId(Long recruitmentId);
}
