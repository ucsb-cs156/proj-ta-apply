package edu.ucsb.cs.taapply.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * An email that holds the Hiring Staff role (issue #504): the hiring and financial office staff who
 * process ULA soft offers. Like {@link Admin} and {@link Instructor}, a row is the role; there is
 * no environment-variable seed list, so hiring staff are always added through the Admin menu.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@Entity(name = "hiring_staff")
public class HiringStaff {
  @Id private String email;
}
