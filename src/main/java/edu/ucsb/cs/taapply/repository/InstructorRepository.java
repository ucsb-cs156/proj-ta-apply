package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.Instructor;
import java.util.Optional;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface InstructorRepository extends CrudRepository<Instructor, String> {
  Optional<Instructor> findByEmail(String email);

  boolean existsByEmail(String email);
}
