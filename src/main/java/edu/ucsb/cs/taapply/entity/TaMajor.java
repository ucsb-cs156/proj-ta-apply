package edu.ucsb.cs.taapply.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * A major a TA applicant may choose from (Admin > TA App Settings). The name is the whole row and
 * its key.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@Entity(name = "ta_majors")
public class TaMajor {
  @Id private String name;
}
