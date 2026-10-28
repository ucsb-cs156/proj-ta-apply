package edu.ucsb.cs.taapply.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * A topic a TA applicant may claim knowledge of (Admin > TA App Settings). The name is the whole
 * row and its key.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@Entity(name = "ta_topics")
public class TaTopic {
  @Id private String name;
}
