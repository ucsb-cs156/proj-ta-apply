package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.UlaMajor;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UlaMajorRepository extends CrudRepository<UlaMajor, String> {}
