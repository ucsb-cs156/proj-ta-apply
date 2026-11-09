package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.InstructorFeedback;
import java.util.List;
import java.util.Optional;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

/**
 * Instructors' feedback on their allocations (issue #425), one row per quarter, email and course.
 */
@Repository
public interface InstructorFeedbackRepository extends CrudRepository<InstructorFeedback, Long> {
  /** Every row of one instructor, in no particular order. */
  List<InstructorFeedback> findByEmail(String email);

  Optional<InstructorFeedback> findByQuarterAndEmailAndRecruitmentCourseId(
      String quarter, String email, Long recruitmentCourseId);
}
