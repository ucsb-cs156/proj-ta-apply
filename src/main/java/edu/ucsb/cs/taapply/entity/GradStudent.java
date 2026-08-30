package edu.ucsb.cs.taapply.entity;

import jakarta.persistence.*;
import lombok.*;

@Data
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@Entity(name = "grad_students")
public class GradStudent {
  @Id private String email;
}
