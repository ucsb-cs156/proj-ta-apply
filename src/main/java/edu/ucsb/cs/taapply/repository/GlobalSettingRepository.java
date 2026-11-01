package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.GlobalSetting;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

/** Settings are keyed by name; see {@link GlobalSetting}. */
@Repository
public interface GlobalSettingRepository extends CrudRepository<GlobalSetting, String> {}
