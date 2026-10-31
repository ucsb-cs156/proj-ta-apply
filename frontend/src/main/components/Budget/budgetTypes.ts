/** What GET /api/admin/budget returns (issue #177). Money is in dollars with cents as decimals. */

export type BudgetRow = {
  quarter: string;
  unrestrictedBudget: number;
  tasOnlyBudget: number;
  ulasOnlyBudget: number;
};

/** One recruitment's side of the budget; null in the summary when the quarter has none. */
export type BudgetSide = {
  recruitmentId: number;
  totalHiringTarget: number;
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
  totalExpenses: number;
  totalFunds: number;
  bottomLine: number;
};

/** What GET /api/admin/budget/quarters returns: a quarter with at least one recruitment. */
export type BudgetQuarter = {
  quarter: string;
  hasTa: boolean;
  hasUla: boolean;
};
