package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.UlaTopic;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UlaTopicRepository extends CrudRepository<UlaTopic, String> {}
