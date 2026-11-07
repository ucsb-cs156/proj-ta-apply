/** What /api/admin/budget and /api/admin/budget/quarters return (issue #177). */
const budgetFixtures = {
  quarters: [
    { quarter: "20264", hasTa: true, hasUla: true },
    { quarter: "20262", hasTa: false, hasUla: true },
    { quarter: "20261", hasTa: true, hasUla: false },
  ],

  /**
   * F26: both recruitments, every figure entered. The cost per ULA is the budget's rate times its
   * hours, 29.38 × 110 = 3,231.80 (issue #388); the funds, with the other funds for ASEs, cover
   * the expenses with $28,882.25 to spare.
   */
  bothTypes: {
    quarter: "20264",
    budget: {
      quarter: "20264",
      conversionTAtoULA: 3,
      unrestrictedBudget: 100000.0,
      tasOnlyBudget: 20000.25,
      ulasOnlyBudget: 5000.0,
      taCostPerQuarter: 12000.0,
      ulaRateDollarsPerHour: 29.38,
      estimatedHoursPerULAPerQuarter: 110.0,
      giftFundsForASEs: 32200.0,
      version: 3,
      conversionVersion: 1,
    },
    ta: {
      recruitmentId: 5,
      totalHiringTarget: 8,
      avgCostPerPosition: 12000.0,
      totalAllocation: 9,
      totalEnrollmentEstimate: 400,
      allocationDifference: 1,
      studentsPerPosition: 50.0,
      anticipatedCost: 96000.0,
    },
    ula: {
      recruitmentId: 6,
      totalHiringTarget: 10,
      avgCostPerPosition: 3231.8,
      totalAllocation: 7,
      totalEnrollmentEstimate: 400,
      allocationDifference: -3,
      studentsPerPosition: 40.0,
      anticipatedCost: 32318.0,
    },
    estimatedCostPerULAPerQuarter: 3231.8,
    totalExpenses: 128318.0,
    totalFunds: 157200.25,
    bottomLine: 28882.25,
  },

  /** S26: ULA recruitment only, nothing entered yet. */
  ulaOnly: {
    quarter: "20262",
    budget: {
      quarter: "20262",
      conversionTAtoULA: 3,
      unrestrictedBudget: 0,
      tasOnlyBudget: 0,
      ulasOnlyBudget: 0,
      taCostPerQuarter: null,
      ulaRateDollarsPerHour: null,
      estimatedHoursPerULAPerQuarter: null,
      giftFundsForASEs: null,
      version: 3,
      conversionVersion: 1,
    },
    ta: null,
    ula: {
      recruitmentId: 3,
      totalHiringTarget: 4,
      avgCostPerPosition: null,
      totalAllocation: 4,
      totalEnrollmentEstimate: 0,
      allocationDifference: 0,
      studentsPerPosition: null,
      anticipatedCost: 0,
    },
    estimatedCostPerULAPerQuarter: null,
    totalExpenses: 0,
    totalFunds: 0,
    bottomLine: 0,
  },

  /** W26: TA recruitment only, over budget; the ULA rate entered but not the hours yet. */
  taOnlyOverBudget: {
    quarter: "20261",
    budget: {
      quarter: "20261",
      conversionTAtoULA: 3,
      unrestrictedBudget: 50000.0,
      tasOnlyBudget: 0,
      ulasOnlyBudget: 0,
      taCostPerQuarter: 11000.0,
      ulaRateDollarsPerHour: 29.38,
      estimatedHoursPerULAPerQuarter: null,
      giftFundsForASEs: 0,
      version: 3,
      conversionVersion: 1,
    },
    ta: {
      recruitmentId: 1,
      totalHiringTarget: 6,
      avgCostPerPosition: 11000.0,
      totalAllocation: 6,
      totalEnrollmentEstimate: 150,
      allocationDifference: 0,
      studentsPerPosition: 25.0,
      anticipatedCost: 66000.0,
    },
    ula: null,
    estimatedCostPerULAPerQuarter: null,
    totalExpenses: 66000.0,
    totalFunds: 50000.0,
    bottomLine: -16000.0,
  },
};

export default budgetFixtures;
