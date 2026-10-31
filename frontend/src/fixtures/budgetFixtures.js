/** What /api/admin/budget and /api/admin/budget/quarters return (issue #177). */
const budgetFixtures = {
  quarters: [
    { quarter: "20264", hasTa: true, hasUla: true },
    { quarter: "20262", hasTa: false, hasUla: true },
    { quarter: "20261", hasTa: true, hasUla: false },
  ],

  /** F26: both recruitments, costs entered, a shortfall of $3,995.25 covered by the funds. */
  bothTypes: {
    quarter: "20264",
    budget: {
      quarter: "20264",
      unrestrictedBudget: 100000.0,
      tasOnlyBudget: 20000.25,
      ulasOnlyBudget: 5000.0,
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
      avgCostPerPosition: 2500.5,
      totalAllocation: 7,
      totalEnrollmentEstimate: 400,
      allocationDifference: -3,
      studentsPerPosition: 40.0,
      anticipatedCost: 25005.0,
    },
    totalExpenses: 121005.0,
    totalFunds: 125000.25,
    bottomLine: 3995.25,
  },

  /** S26: ULA recruitment only, nothing entered yet. */
  ulaOnly: {
    quarter: "20262",
    budget: {
      quarter: "20262",
      unrestrictedBudget: 0,
      tasOnlyBudget: 0,
      ulasOnlyBudget: 0,
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
    totalExpenses: 0,
    totalFunds: 0,
    bottomLine: 0,
  },

  /** W26: TA recruitment only, over budget. */
  taOnlyOverBudget: {
    quarter: "20261",
    budget: {
      quarter: "20261",
      unrestrictedBudget: 50000.0,
      tasOnlyBudget: 0,
      ulasOnlyBudget: 0,
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
    totalExpenses: 66000.0,
    totalFunds: 50000.0,
    bottomLine: -16000.0,
  },
};

export default budgetFixtures;
