package edu.ucsb.cs.taapply.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * One app-wide setting an admin can switch (issue #217), keyed by name. The first is {@code
 * developerMode}, whose value is "On" or "Off". The columns are {@code setting_key} and {@code
 * setting_value} because KEY and VALUE are reserved words in some databases. Not audited.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@Entity(name = "global_settings")
public class GlobalSetting {
  @Id
  @Column(name = "setting_key", nullable = false, length = 64)
  private String key;

  @Column(name = "setting_value", nullable = false)
  private String value;
}
