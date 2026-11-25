package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.SoftOfferNoticeVersion;
import java.util.List;
import java.util.Optional;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SoftOfferNoticeVersionRepository
    extends CrudRepository<SoftOfferNoticeVersion, Long> {

  /** The version currently shown to applicants: the most recently saved one. */
  Optional<SoftOfferNoticeVersion> findFirstByOrderByIdDesc();

  /** Every version, newest first. */
  List<SoftOfferNoticeVersion> findAllByOrderByIdDesc();
}
