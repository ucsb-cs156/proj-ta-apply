package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.NoticeVersion;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface NoticeVersionRepository extends CrudRepository<NoticeVersion, Long> {

  /** The version currently shown to applicants of this type: the most recently saved one. */
  Optional<NoticeVersion> findFirstByTypeOrderByIdDesc(RecruitmentType type);

  /** Every version of this type, newest first. */
  List<NoticeVersion> findAllByTypeOrderByIdDesc(RecruitmentType type);
}
