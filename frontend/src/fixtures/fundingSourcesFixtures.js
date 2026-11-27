/** Funding sources (issue #512), as GET /api/admin/fundingSources/all returns them. */
const fundingSourcesFixtures = {
  oneSource: {
    abbreviation: "NSF",
    explanation: "National Science Foundation",
  },
  /** Already in the backend's order, by abbreviation. */
  threeSources: [
    {
      abbreviation: "DEPT",
      explanation: "Department funds",
    },
    {
      abbreviation: "NSF",
      explanation: "National Science Foundation",
    },
    {
      abbreviation: "TA",
      explanation: "TA budget, reallocated to ULAs",
    },
  ],
  /** The same three, out of order, for the pages that sort. */
  threeSourcesUnsorted: [
    {
      abbreviation: "TA",
      explanation: "TA budget, reallocated to ULAs",
    },
    {
      abbreviation: "DEPT",
      explanation: "Department funds",
    },
    {
      abbreviation: "NSF",
      explanation: "National Science Foundation",
    },
  ],
};

export { fundingSourcesFixtures };
