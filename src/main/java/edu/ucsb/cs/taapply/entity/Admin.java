package edu.ucsb.cs.taapply.entity;

import jakarta.persistence.*;
import lombok.*;

@Data
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@Entity(name = "admins")
public class Admin {
  @Id private String email;
}
