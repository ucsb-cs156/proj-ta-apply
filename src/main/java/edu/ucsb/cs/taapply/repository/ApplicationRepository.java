package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.Application;
import java.util.List;
import java.util.Optional;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ApplicationRepository extends CrudRepository<Application, Long> {

  /** Every application belonging to one person, newest first. */
  List<Application> findByEmailOrderByIdDesc(String email);

  Optional<Application> findByEmailAndRecruitmentId(String email, Long recruitmentId);

  boolean existsByEmailAndRecruitmentId(String email, Long recruitmentId);
}
