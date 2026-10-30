package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.UCSBAPIQuarter;
import java.util.List;
import java.util.Optional;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

/** The UCSB quarter calendar on file (issue #151), keyed by YYYYQ. */
@Repository
public interface UCSBAPIQuarterRepository extends CrudRepository<UCSBAPIQuarter, String> {

  List<UCSBAPIQuarter> findAllByOrderByQuarterAsc();

  List<UCSBAPIQuarter> findAllByOrderByQuarterDesc();

  /** The latest quarter on file, if any: where a refresh starts from. */
  Optional<UCSBAPIQuarter> findTopByOrderByQuarterDesc();
}
