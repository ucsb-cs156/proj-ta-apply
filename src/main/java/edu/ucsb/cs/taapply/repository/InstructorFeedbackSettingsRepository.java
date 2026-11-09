package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.InstructorFeedbackSettings;
import java.util.List;
import java.util.Optional;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface InstructorFeedbackSettingsRepository
    extends CrudRepository<InstructorFeedbackSettings, Long> {

  /** The settings in force: the most recently saved version. */
  Optional<InstructorFeedbackSettings> findFirstByOrderByIdDesc();

  /** Every version, newest first. */
  List<InstructorFeedbackSettings> findAllByOrderByIdDesc();
}
