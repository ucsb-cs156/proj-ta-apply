package edu.ucsb.cs.taapply.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * A major a ULA applicant may choose from (Admin > ULA App Settings). The name is the whole row and
 * its key.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@Entity(name = "ula_majors")
public class UlaMajor {
  @Id private String name;
}
