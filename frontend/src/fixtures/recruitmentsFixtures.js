const recruitmentsFixtures = {
  threeRecruitments: [
    {
      id: 3,
      quarter: "20262",
      type: "TA",
      applicationStatus: "CLOSED",
      reviewStatus: "NotStarted",
      tentativeOpeningDate: "2026-03-30",
      primaryConsiderationDate: "2026-04-15",
      actualOpeningDate: null,
      actualClosingDate: null,
      facultyReviewOpeningDate: null,
      facultyRankingDeadline: null,
      courseDataLastUpdated: null,
      totalHiringTarget: 1,
      allocationVisibility: "ADMINS_ONLY",
      assignmentsPublished: false,
    },
    {
      id: 2,
      quarter: "20261",
      type: "ULA",
      applicationStatus: "OPEN",
      reviewStatus: "Open",
      tentativeOpeningDate: "2026-01-05",
      primaryConsiderationDate: "2026-01-20",
      actualOpeningDate: "2026-01-07",
      actualClosingDate: null,
      facultyReviewOpeningDate: "2026-01-08",
      facultyRankingDeadline: "2026-02-15",
      courseDataLastUpdated: null,
      totalHiringTarget: 6,
      allocationVisibility: "ADMINS_ONLY",
      assignmentsPublished: false,
    },
    {
      // Opened, closed, and re-opened: the original opening date is preserved.
      id: 1,
      quarter: "20261",
      type: "TA",
      applicationStatus: "CLOSED",
      reviewStatus: "Closed",
      tentativeOpeningDate: "2026-01-05",
      primaryConsiderationDate: "2026-01-20",
      actualOpeningDate: "2026-01-06",
      actualClosingDate: "2026-02-01",
      facultyReviewOpeningDate: "2026-01-10",
      facultyRankingDeadline: "2026-02-01",
      courseDataLastUpdated: null,
      totalHiringTarget: 10,
      allocationVisibility: "ADMINS_ONLY",
      assignmentsPublished: false,
    },
  ],
};

/**
 * Issue #485: a ULA recruitment (F25) whose hiring decisions are released and whose soft offers
 * are not: the card offers Release Soft Offers.
 */
recruitmentsFixtures.publishedUla = {
  ...recruitmentsFixtures.threeRecruitments[1],
  id: 5,
  quarter: "20254",
  applicationStatus: "CLOSED",
  reviewStatus: "Closed",
  tentativeOpeningDate: "2025-09-01",
  primaryConsiderationDate: "2025-09-20",
  actualOpeningDate: "2025-09-01",
  actualClosingDate: "2025-10-01",
  facultyReviewOpeningDate: "2025-10-02",
  facultyRankingDeadline: "2025-10-15",
  assignmentsPublished: true,
  softOffersReleasedAt: null,
  softOfferDeadline: null,
};

/** The same recruitment once its soft offers are released. */
recruitmentsFixtures.releasedUla = {
  ...recruitmentsFixtures.publishedUla,
  softOffersReleasedAt: "2025-10-20T09:30:00",
  softOfferDeadline: "2025-10-25T17:00:00",
};

/** The W26 TA recruitment (id 1) once the admin has hidden it from students and instructors (issue #496). */
recruitmentsFixtures.hiddenTa = {
  ...recruitmentsFixtures.threeRecruitments[2],
  hidden: true,
};

export default recruitmentsFixtures;
