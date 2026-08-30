package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.GradStudent;
import java.util.Optional;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GradStudentRepository extends CrudRepository<GradStudent, String> {
  Optional<GradStudent> findByEmail(String email);

  boolean existsByEmail(String email);
}
