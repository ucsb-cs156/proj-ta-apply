package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.HiddenColumn;
import java.util.List;
import java.util.Optional;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface HiddenColumnRepository extends CrudRepository<HiddenColumn, Long> {
  List<HiddenColumn> findByTableKeyAndRecruitmentIdOrderByColumnIdAsc(
      String tableKey, Long recruitmentId);

  Optional<HiddenColumn> findByTableKeyAndRecruitmentIdAndColumnId(
      String tableKey, Long recruitmentId, String columnId);
}
