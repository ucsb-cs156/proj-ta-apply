package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.BudgetCourse;
import java.util.List;
import java.util.Optional;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

/** One row per section per quarter, keyed on the quarter and the enroll code (issue #363). */
@Repository
public interface BudgetCourseRepository extends CrudRepository<BudgetCourse, Long> {
  /** Every section of the quarter, in no particular order; callers key them by enroll code. */
  List<BudgetCourse> findByQuarter(String quarter);

  Optional<BudgetCourse> findByQuarterAndEnrollCode(String quarter, String enrollCode);
}
