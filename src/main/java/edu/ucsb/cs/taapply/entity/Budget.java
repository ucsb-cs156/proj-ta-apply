package edu.ucsb.cs.taapply.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import lombok.*;

/**
 * The money available for one quarter's TA and ULA hiring, for the Budget for Quarter page (issue
 * #177). One row per quarter, keyed on the quarter in YYYYQ form like {@link Recruitment#quarter},
 * created the first time anything needs it: when a recruitment of the quarter first gets a course,
 * or when an admin first opens the quarter's budget page (see {@code BudgetCreationService}).
 *
 * <p>The three temp subzero lines may each be zero in a given quarter; other funds for ASEs, such
 * as gift funds, are a line of their own (issue #388). For planning, the restricted lines are spent
 * first and anything further comes from the unrestricted pool. The row also holds the estimated
 * cost per TA per quarter, the ULA hourly rate and the estimated hours per ULA per quarter (issue
 * #388), the last two's product being the estimated cost per ULA per quarter: computed, never
 * stored. Every planning figure but the hiring targets lives here, and a new quarter's row starts
 * as a copy of the most recent earlier quarter's (issue #384), the two version counters apart.
 * Planning figures: changes are not audited.
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
   * The estimated cost of one TA for the quarter, in dollars and cents (issue #388; before it, the
   * TA recruitment's avgCostPerPosition, issue #177). Null until an admin enters it.
   */
  @Column(name = "ta_cost_per_quarter", precision = 12, scale = 2)
  private BigDecimal taCostPerQuarter;

  /**
   * What one ULA is paid per hour, in dollars and cents (issue #388). Null until an admin enters
   * it; with {@link #estimatedHoursPerULAPerQuarter} it gives the estimated cost per ULA per
   * quarter.
   */
  @Column(name = "ula_rate_dollars_per_hour", precision = 12, scale = 2)
  private BigDecimal ulaRateDollarsPerHour;

  /** How many hours one ULA is expected to work in the quarter (issue #388). Null until entered. */
  @Column(name = "estimated_hours_per_ula_per_quarter", precision = 12, scale = 2)
  private BigDecimal estimatedHoursPerULAPerQuarter;

  /**
   * Other funds available for ASEs, such as gift funds, in dollars and cents (issue #388). Null
   * until entered, and counted as zero in the total funds until then.
   */
  @Column(name = "gift_funds_for_ases", precision = 12, scale = 2)
  private BigDecimal giftFundsForASEs;

  /**
   * How many ULAs count as one TA when the Combined Allocation page computes the overall
   * ASE:Student ratio (issue #358). Greater than zero; 3 until an admin sets it.
   */
  @Column(name = "conversion_ta_to_ula", nullable = false)
  @Builder.Default
  private Double conversionTAtoULA = DEFAULT_CONVERSION_TA_TO_ULA;

  /**
   * How many times the budget lines have been saved (issue #277): the three subzero lines, and
   * since issue #388 the ULA rate, the hours per ULA and the other funds too. The controller
   * compares it to the one the page last saw and adds one on every save of a line, so a save made
   * from a stale copy of the Budget page is refused instead of silently overwriting another admin's
   * change. A change to the conversion factor does not touch it (issue #375).
   */
  @Column(nullable = false)
  @Builder.Default
  private Integer version = 0;

  /**
   * How many times the conversion factor has been saved (issue #375): the same check as {@link
   * #version}, kept apart from it so that the Budget page and the Combined Allocation page, which
   * edit different figures of this row, do not refuse each other's saves.
   */
  @Column(name = "conversion_version", nullable = false)
  @Builder.Default
  private Integer conversionVersion = 0;
}
