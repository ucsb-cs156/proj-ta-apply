package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.RecruitmentAuditTrail;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.PagingAndSortingRepository;
import org.springframework.stereotype.Repository;

/**
 * The audit trail of changes to recruitments themselves (issue #139). The trail of an admin's
 * changes to individual applications is {@link AuditTrailRepository}.
 */
@Repository
public interface RecruitmentAuditTrailRepository
    extends CrudRepository<RecruitmentAuditTrail, Long>,
        PagingAndSortingRepository<RecruitmentAuditTrail, Long> {

  /** One page of the changes recorded against one recruitment, in the page's order. */
  Page<RecruitmentAuditTrail> findByRecruitmentId(Long recruitmentId, Pageable pageable);
}
