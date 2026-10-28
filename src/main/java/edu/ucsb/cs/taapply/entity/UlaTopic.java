package edu.ucsb.cs.taapply.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * A topic a ULA applicant may claim knowledge of (Admin > ULA App Settings). The name is the whole
 * row and its key.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@Entity(name = "ula_topics")
public class UlaTopic {
  @Id private String name;
}
