package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import java.util.List;
import java.util.Optional;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RecruitmentCourseRepository extends CrudRepository<RecruitmentCourse, Long> {
  Optional<RecruitmentCourse> findByRecruitmentIdAndCourseId(Long recruitmentId, String courseId);

  /**
   * Every row for a recruitment, removed ones included. Callers filter and sort in Java: the padded
   * course id only sorts correctly under code-unit ordering, and Postgres' collation can treat
   * spaces as negligible.
   */
  List<RecruitmentCourse> findByRecruitmentId(Long recruitmentId);
}
