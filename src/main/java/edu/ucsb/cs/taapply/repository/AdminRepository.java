package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.Admin;
import java.util.Optional;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AdminRepository extends CrudRepository<Admin, String> {
  Optional<Admin> findByEmail(String email);

  boolean existsByEmail(String email);
}
