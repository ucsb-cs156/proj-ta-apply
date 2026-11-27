package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.HiringRecord;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface HiringRecordRepository extends CrudRepository<HiringRecord, Long> {

  /** The staff's hiring record for one application, if they have saved anything yet. */
  Optional<HiringRecord> findByApplicationId(Long applicationId);

  /** The records of any of the given applications, for the Soft Offer Results (issue #509). */
  List<HiringRecord> findByApplicationIdIn(Collection<Long> applicationIds);
}
