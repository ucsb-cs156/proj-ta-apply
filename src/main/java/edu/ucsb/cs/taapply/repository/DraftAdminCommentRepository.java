package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.DraftAdminComment;
import java.util.Collection;
import java.util.List;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

/** Keyed by the draft's id. */
@Repository
public interface DraftAdminCommentRepository extends CrudRepository<DraftAdminComment, Long> {

  /** The comments on any of the given drafts, for listing a recruitment's drafts in one query. */
  List<DraftAdminComment> findByDraftIdIn(Collection<Long> draftIds);
}
