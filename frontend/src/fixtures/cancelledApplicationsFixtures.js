// GET /api/admin/assignments/cancelled and GET …/courses/{id}/cancelled (issue #199): applicants
// who withdrew, with their reason.
const cancelledApplicationsFixtures = {
  two: [
    {
      applicationId: 41,
      firstName: "Grace",
      lastName: "Hopper",
      email: "grace@ucsb.edu",
      cancellationReason: "Took a position in another department",
    },
    {
      applicationId: 42,
      firstName: "Alan",
      lastName: "Turing",
      email: "alan@ucsb.edu",
      cancellationReason: null,
    },
  ],
  none: [],
};

export default cancelledApplicationsFixtures;
