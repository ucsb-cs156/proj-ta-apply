package edu.ucsb.cs.taapply.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import lombok.*;

/**
 * The money available for one quarter's TA and ULA hiring, for the Budget for Quarter page (issue
 * #177). One row per quarter, keyed on the quarter in YYYYQ form like {@link Recruitment#quarter},
 * created the first time an admin opens the quarter's budget page.
 *
 * <p>Any of the three lines may include subzero and/or gift money, and any may be zero in a given
 * quarter. For planning, the restricted lines are spent first and anything further comes from the
 * unrestricted pool. Planning figures: changes are not audited.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@Entity(name = "budgets")
public class Budget {
  /** What a quarter's conversion factor is until an admin sets it (issue #358). */
  public static final double DEFAULT_CONVERSION_TA_TO_ULA = 3.0;

  /** YYYYQ, e.g. "20264". */
  @Id private String quarter;

  /** Funds that may be spent on either TAs or ULAs, in dollars and cents. */
  @Column(name = "unrestricted_budget", nullable = false, precision = 12, scale = 2)
  @Builder.Default
  private BigDecimal unrestrictedBudget = BigDecimal.ZERO;

  /** Additional funds that may be spent only on TAs. */
  @Column(name = "tas_only_budget", nullable = false, precision = 12, scale = 2)
  @Builder.Default
  private BigDecimal tasOnlyBudget = BigDecimal.ZERO;

  /** Additional funds that may be spent only on ULAs. */
  @Column(name = "ulas_only_budget", nullable = false, precision = 12, scale = 2)
  @Builder.Default
  private BigDecimal ulasOnlyBudget = BigDecimal.ZERO;

  /**
   * How many ULAs count as one TA when the Combined Allocation page computes the overall
   * ASE:Student ratio (issue #358). Greater than zero; 3 until an admin sets it.
   */
  @Column(name = "conversion_ta_to_ula", nullable = false)
  @Builder.Default
  private Double conversionTAtoULA = DEFAULT_CONVERSION_TA_TO_ULA;

  /**
   * How many times this budget has been saved (issue #277). JPA checks it and adds one on every
   * save (optimistic locking), and a save that carries an older count than the budget now has is
   * refused, so two tabs or admins cannot silently overwrite each other's change.
   */
  @Version private Integer version;
}
