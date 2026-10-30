package edu.ucsb.cs.taapply.entity;

import jakarta.persistence.*;
import lombok.*;

@Data
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@Entity(name = "instructors")
public class Instructor {
  @Id private String email;

  /**
   * The name this instructor goes by in the course catalog, chosen by an admin from the
   * catalog_names table (a foreign key); null until chosen (issue #120).
   */
  @Column(name = "catalog_name")
  private String catalogName;
}
