package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.FundingSource;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface FundingSourceRepository extends CrudRepository<FundingSource, String> {}
