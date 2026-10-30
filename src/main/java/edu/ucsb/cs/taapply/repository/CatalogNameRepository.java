package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.CatalogName;
import java.util.List;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CatalogNameRepository extends CrudRepository<CatalogName, String> {
  /** Every name, alphabetically, for the dropdown. */
  List<CatalogName> findAllByOrderByNameAsc();
}
