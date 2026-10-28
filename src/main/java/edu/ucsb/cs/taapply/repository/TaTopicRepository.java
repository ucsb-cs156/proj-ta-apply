package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.TaTopic;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TaTopicRepository extends CrudRepository<TaTopic, String> {}
