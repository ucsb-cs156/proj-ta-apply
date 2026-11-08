// GET /api/admin/applications/draftConflicts (issue #417): students with both a draft and a
// finalized application to the recruitment, which is not supposed to happen.
const draftConflictsFixtures = {
  one: [
    {
      email: "someone@ucsb.edu",
      draftApplicationId: 13,
      applicationId: 17,
    },
  ],
  two: [
    {
      email: "ada@ucsb.edu",
      draftApplicationId: 13,
      applicationId: 17,
    },
    {
      email: "bob@ucsb.edu",
      draftApplicationId: 14,
      applicationId: 21,
    },
  ],
  none: [],
};

export default draftConflictsFixtures;
