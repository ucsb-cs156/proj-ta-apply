const recruitmentsFixtures = {
  threeRecruitments: [
    {
      id: 3,
      quarter: "20262",
      type: "TA",
      applicationStatus: "CLOSED",
      tentativeOpeningDate: "2026-03-30",
      primaryConsiderationDate: "2026-04-15",
      actualOpeningDate: null,
      actualClosingDate: null,
    },
    {
      id: 2,
      quarter: "20261",
      type: "ULA",
      applicationStatus: "OPEN",
      tentativeOpeningDate: "2026-01-05",
      primaryConsiderationDate: "2026-01-20",
      actualOpeningDate: "2026-01-07",
      actualClosingDate: null,
    },
    {
      // Opened, closed, and re-opened: the original opening date is preserved.
      id: 1,
      quarter: "20261",
      type: "TA",
      applicationStatus: "CLOSED",
      tentativeOpeningDate: "2026-01-05",
      primaryConsiderationDate: "2026-01-20",
      actualOpeningDate: "2026-01-06",
      actualClosingDate: "2026-02-01",
    },
  ],
};

export default recruitmentsFixtures;
