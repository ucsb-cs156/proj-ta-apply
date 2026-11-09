/**
 * What /api/instructor/feedback and /api/instructor/feedback/costs return (issue #425), for the
 * W26 quarter of instructorRecruitmentsFixtures: course 2 is CMPSC 156 (0100), in both recruitments.
 */
const instructorFeedbackFixtures = {
  /** Feedback on CMPSC 156 (0100) with both counts filled in and a comment. */
  filledIn: {
    id: 1,
    quarter: "20261",
    email: "pconrad@ucsb.edu",
    recruitmentCourseId: 2,
    allocReasonable: false,
    differentTACount: true,
    differentULACount: true,
    otherConcerns: true,
    numTAsPreferred: 3,
    numULAsPreferred: 2,
    comments:
      "Lab sections fill up quickly; one more TA would let us open a fourth lab.",
    lastUpdated: "2026-11-08T14:05:30",
  },
  /** The two figures of the W26 budget: $12,000.00 per TA and 100 hours at $20.00 per ULA. */
  costs: {
    quarter: "20261",
    estimatedCostPerTA: 12000,
    estimatedCostPerULA: 2000,
  },
  /** A budget whose ULA figures have not been entered yet. */
  costsNotSet: {
    quarter: "20261",
    estimatedCostPerTA: 12000,
    estimatedCostPerULA: null,
  },
};

export default instructorFeedbackFixtures;
