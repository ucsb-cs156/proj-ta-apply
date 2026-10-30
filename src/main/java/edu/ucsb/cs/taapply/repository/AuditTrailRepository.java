package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.AuditTrail;
import java.util.List;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.PagingAndSortingRepository;
import org.springframework.stereotype.Repository;

/**
 * The audit trail of an admin's changes to individual applications. Changes to recruitments
 * themselves are {@link RecruitmentAuditTrailRepository}.
 */
@Repository
public interface AuditTrailRepository
    extends CrudRepository<AuditTrail, Long>, PagingAndSortingRepository<AuditTrail, Long> {

  /** The changes recorded against one TA application, oldest first. */
  List<AuditTrail> findByTaApplicationIdOrderByIdAsc(Long taApplicationId);

  /** The changes recorded against one ULA application, oldest first. */
  List<AuditTrail> findByUlaApplicationIdOrderByIdAsc(Long ulaApplicationId);
}
