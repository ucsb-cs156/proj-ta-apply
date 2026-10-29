package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.UlaInterest;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UlaInterestRepository extends CrudRepository<UlaInterest, String> {}
