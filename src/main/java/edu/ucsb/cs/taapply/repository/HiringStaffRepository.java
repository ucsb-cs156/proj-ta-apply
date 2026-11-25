package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.HiringStaff;
import java.util.Optional;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface HiringStaffRepository extends CrudRepository<HiringStaff, String> {
  Optional<HiringStaff> findByEmail(String email);

  boolean existsByEmail(String email);
}
