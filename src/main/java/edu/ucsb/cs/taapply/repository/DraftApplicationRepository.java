package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.DraftApplication;
import java.util.List;
import java.util.Optional;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DraftApplicationRepository extends CrudRepository<DraftApplication, Long> {

  /** Every draft belonging to one person, newest first. */
  List<DraftApplication> findByEmailOrderByIdDesc(String email);

  Optional<DraftApplication> findByEmailAndRecruitmentId(String email, Long recruitmentId);
}
