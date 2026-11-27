package edu.ucsb.cs.taapply.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * A funding source the financial office staff can put on a ULA hiring record (issue #512): a short
 * abbreviation, which is the key and what the Soft Offer Results page and its CSV show, and the
 * explanation of what it means. Admins maintain the list on Admin → Funding Sources.
 *
 * <p>The abbreviation is stored as typed, after trimming, and is case-sensitive: {@code Sub0} and
 * {@code sub0} are two rows. It is not editable once created, since hiring records will refer to
 * it; to change one, delete it and create another.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@Entity(name = "funding_sources")
public class FundingSource {
  @Id
  @Column(length = 10)
  private String abbreviation;

  @Column(nullable = false)
  private String explanation;
}
