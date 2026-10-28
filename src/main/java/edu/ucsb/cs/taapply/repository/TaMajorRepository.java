package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.TaMajor;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TaMajorRepository extends CrudRepository<TaMajor, String> {}
