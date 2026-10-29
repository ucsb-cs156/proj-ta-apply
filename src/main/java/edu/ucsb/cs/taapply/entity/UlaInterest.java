package edu.ucsb.cs.taapply.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * An area a ULA applicant may say how interested they are in (Admin > ULA App Settings). The name
 * is the whole row and its key.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@Entity(name = "ula_interests")
public class UlaInterest {
  @Id private String name;
}
