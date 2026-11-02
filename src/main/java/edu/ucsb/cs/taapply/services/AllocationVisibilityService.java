package edu.ucsb.cs.taapply.services;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.AllocationVisibility;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import java.time.LocalDateTime;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Changes who may see a recruitment's allocations (issues #178 and #224). Faculty see the result,
 * so a change is recorded in the recruitment audit trail; shared by the admin endpoint and by
 * Developer Mode's fake allocations (issue #225) so both leave the same trail.
 */
@Service
public class AllocationVisibilityService {

  @Autowired RecruitmentRepository recruitmentRepository;
  @Autowired RecruitmentAuditService recruitmentAuditService;

  /**
   * Sets the recruitment's allocation visibility, saving it and recording the change, in that
   * order. The first time visibility leaves ADMINS_ONLY the release time is stamped. Choosing the
   * value the recruitment already has saves and records nothing.
   *
   * @return the recruitment, with the new value
   */
  @Transactional
  public Recruitment change(Recruitment recruitment, AllocationVisibility visibility) {
    if (visibility == recruitment.getAllocationVisibility()) {
      return recruitment;
    }
    RecruitmentAuditService.Snapshot before = recruitmentAuditService.snapshot(recruitment);
    recruitment.setAllocationVisibility(visibility);
    if (visibility != AllocationVisibility.ADMINS_ONLY
        && recruitment.getAllocationsReleasedAt() == null) {
      recruitment.setAllocationsReleasedAt(LocalDateTime.now());
    }
    recruitmentRepository.save(recruitment);
    recruitmentAuditService.recordChanges(before, recruitment);
    return recruitment;
  }
}
