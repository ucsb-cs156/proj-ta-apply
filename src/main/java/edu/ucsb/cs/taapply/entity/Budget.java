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
}
