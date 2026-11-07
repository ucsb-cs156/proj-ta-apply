/** What GET /api/admin/budget returns (issue #177). Money is in dollars with cents as decimals. */

export type BudgetRow = {
  quarter: string;
  unrestrictedBudget: number;
  tasOnlyBudget: number;
  ulasOnlyBudget: number;
  /** What one ULA is paid per hour (issue #388); null until entered. */
  ulaRateDollarsPerHour: number | null;
  /** How many hours one ULA is expected to work in the quarter (issue #388); null until entered. */
  estimatedHoursPerULAPerQuarter: number | null;
  /** Other funds available for ASEs, such as gift funds (issue #388); null until entered. */
  giftFundsForASEs: number | null;
  /** How many ULAs count as one TA on the Combined Allocation page (issue #358); 3 by default. */
  conversionTAtoULA: number;
  /** How many times the lines have been saved; a line save carries it so a stale one is refused. */
  version: number;
  /**
   * How many times the conversion factor has been saved (issue #375), counted apart from the lines
   * so that the Budget page and the Combined Allocation page do not refuse each other's saves; a
   * factor save carries it.
   */
  conversionVersion: number;
};

/** One recruitment's side of the budget; null in the summary when the quarter has none. */
export type BudgetSide = {
  recruitmentId: number;
  totalHiringTarget: number;
  /**
   * The estimated cost of one position per quarter: the TA recruitment's own stored cost per TA;
   * on the ULA side the budget's computed cost per ULA, its rate times its hours (issue #388).
   */
  avgCostPerPosition: number | null;
  totalAllocation: number;
  totalEnrollmentEstimate: number;
  /** totalAllocation minus totalHiringTarget; 0 when they agree. */
  allocationDifference: number;
  /** The n of "1:n"; null when there are no enrollment estimates. */
  studentsPerPosition: number | null;
  anticipatedCost: number;
};

export type BudgetSummary = {
  quarter: string;
  budget: BudgetRow;
  ta: BudgetSide | null;
  ula: BudgetSide | null;
  /** The ULA hourly rate times the hours per ULA (issue #388); null until both are entered. */
  estimatedCostPerULAPerQuarter: number | null;
  totalExpenses: number;
  /** The three subzero lines and the other funds for ASEs added. */
  totalFunds: number;
  bottomLine: number;
};

/** What GET /api/admin/budget/quarters returns: a quarter with at least one recruitment. */
export type BudgetQuarter = {
  quarter: string;
  hasTa: boolean;
  hasUla: boolean;
};
