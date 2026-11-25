package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.SoftOfferResponse;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SoftOfferResponseRepository extends CrudRepository<SoftOfferResponse, Long> {

  /** The answer to one (application, course) soft offer, if given. */
  Optional<SoftOfferResponse> findByApplicationIdAndRecruitmentCourseId(
      Long applicationId, Long recruitmentCourseId);

  /** Every answer by any of the given applications, for the admin's results (issue #487). */
  List<SoftOfferResponse> findByApplicationIdIn(Collection<Long> applicationIds);
}
