package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.RecruitmentAuditTrail;
import java.util.Collection;
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

  /**
   * One page of the changes to one field of any of the given recruitments, in the page's order
   * (issue #391: the hiring-target changes of a quarter's TA and ULA recruitments).
   */
  Page<RecruitmentAuditTrail> findByRecruitmentIdInAndWhatChanged(
      Collection<Long> recruitmentIds, String whatChanged, Pageable pageable);
}
