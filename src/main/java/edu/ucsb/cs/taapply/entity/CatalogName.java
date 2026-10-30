package edu.ucsb.cs.taapply.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * An instructor's name as the UCSB course catalog spells it, e.g. "CONRAD P" (issue #120). Rows are
 * collected by the Populate Courses job from the instructors of record of every primary section it
 * sees, and an admin picks one of them for each instructor so their courses can be matched.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@Entity(name = "catalog_names")
public class CatalogName {
  @Id private String name;
}
