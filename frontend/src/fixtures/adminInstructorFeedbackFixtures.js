/**
 * What /api/admin/instructorFeedback returns (issue #427): a quarter's instructor feedback with
 * each course's current TA and ULA allocations joined in, by course id, section and email.
 */
const LONG_COMMENT =
  "We have four lab sections this quarter and the labs fill up within the first week. " +
  "Last year two TAs could not cover office hours for 180 students, and the waitlist for " +
  "help in the final two weeks was over an hour long. A third TA, or two more ULAs if a TA " +
  "is not possible, would let us open a fourth lab and keep the office hours queue reasonable. " +
  "I am happy to discuss on email or in person whichever is easier for the committee.";

const adminInstructorFeedbackFixtures = {
  /** W26: one course in both recruitments, one TA-only, one ULA-only and a long comment. */
  severalRecords: [
    {
      // In both recruitments, asking for more of each.
      id: 1,
      quarter: "20261",
      courseId: "CMPSC   156",
      section: "0100",
      title: "ADV APP PROGRAM",
      email: "pconrad@ucsb.edu",
      instructorName: "CONRAD P",
      allocReasonable: false,
      differentTACount: true,
      differentULACount: true,
      otherConcerns: false,
      taAllocation: 3,
      ulaAllocation: 4,
      numTAsPreferred: 5,
      numULAsPreferred: 2,
      comments: "One more TA would let us open a fourth lab.",
      lastUpdated: "2026-01-12T14:05:30",
    },
    {
      // TA only (no ULA row for this course): ULA Allocation reads N/A. The instructor unchecked
      // "different number of ULAs" after typing 6; the server leaves that count out.
      id: 2,
      quarter: "20261",
      courseId: "CMPSC     8",
      section: "0100",
      title: "INTRO TO COMP SCI",
      email: "mirza@ucsb.edu",
      instructorName: "MIRZA D",
      allocReasonable: true,
      differentTACount: false,
      differentULACount: false,
      otherConcerns: false,
      taAllocation: 2,
      ulaAllocation: null,
      numTAsPreferred: null,
      numULAsPreferred: null,
      comments: null,
      lastUpdated: "2026-01-10T09:00:00",
    },
    {
      // ULA only: TA Allocation reads N/A. The instructor is not in the instructor list.
      id: 3,
      quarter: "20261",
      courseId: "CMPSC    16",
      section: "0100",
      title: "PROBLEM SOLVING I",
      email: "newprof@ucsb.edu",
      instructorName: null,
      allocReasonable: false,
      differentTACount: false,
      differentULACount: true,
      otherConcerns: true,
      taAllocation: null,
      ulaAllocation: 6,
      numTAsPreferred: null,
      numULAsPreferred: 8,
      comments: "Two more ULAs, please.\nThe course grew by 60 students.",
      lastUpdated: "2026-01-11T16:45:10",
    },
    {
      // A long comment, wrapped within the Comments column.
      id: 4,
      quarter: "20261",
      courseId: "CMPSC   130A",
      section: "0100",
      title: "DATA STRUCT ALGOR",
      email: "suri@ucsb.edu",
      instructorName: "SURI S",
      allocReasonable: false,
      differentTACount: true,
      differentULACount: false,
      otherConcerns: true,
      taAllocation: 2,
      ulaAllocation: 0,
      numTAsPreferred: 3,
      numULAsPreferred: null,
      comments: LONG_COMMENT,
      lastUpdated: "2026-01-13T08:15:00",
    },
  ],
};

export default adminInstructorFeedbackFixtures;
