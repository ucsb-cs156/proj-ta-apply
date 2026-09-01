package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RecruitmentRepository extends CrudRepository<Recruitment, Long> {
  Optional<Recruitment> findByQuarterAndType(String quarter, RecruitmentType type);

  boolean existsByQuarterAndType(String quarter, RecruitmentType type);

  /** Most recent quarter first, as the admin listing shows them. */
  List<Recruitment> findAllByOrderByQuarterDescTypeAsc();
}
