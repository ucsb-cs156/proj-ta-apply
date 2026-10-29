package edu.ucsb.cs.taapply.entity;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;

@Data
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@Entity(name = "users")
public class User {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private long id;

  private String email;
  private String googleSub;
  private String pictureUrl;
  private String fullName;
  private String givenName;
  private String familyName;

  /**
   * When this user last used the app: stamped at sign-in and refreshed by {@code
   * LastOnlineInterceptor} as they make requests. Null for a row created before the column was.
   */
  private Instant lastOnline;
}
