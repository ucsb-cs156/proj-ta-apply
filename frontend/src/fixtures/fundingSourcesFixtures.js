/** Funding sources (issue #512), as GET /api/admin/fundingSources/all returns them. */
const fundingSourcesFixtures = {
  oneSource: {
    abbreviation: "sub0",
    explanation: "Temporary Sub Zero",
  },
  /** Already in the backend's order, by abbreviation. */
  threeSources: [
    {
      abbreviation: "ds-gift",
      explanation: "Data Science Gift",
    },
    {
      abbreviation: "sub0",
      explanation: "Temporary Sub Zero",
    },
    {
      abbreviation: "ula-gift",
      explanation: "Gift funding for ULAs",
    },
  ],
  /** The same three, out of order, for the pages that sort. */
  threeSourcesUnsorted: [
    {
      abbreviation: "ula-gift",
      explanation: "Gift funding for ULAs",
    },
    {
      abbreviation: "ds-gift",
      explanation: "Data Science Gift",
    },
    {
      abbreviation: "sub0",
      explanation: "Temporary Sub Zero",
    },
  ],
};

export { fundingSourcesFixtures };
