const auditTrailFixtures = {
  /** Three changes: a plain field, a join-table row added (no old value), a field blanked. */
  threeRows: [
    {
      id: 3,
      editedAt: "2026-04-02T16:20:00",
      ulaApplicationId: null,
      taApplicationId: 7,
      fieldName: "major",
      oldValue: "Computer Science",
      newValue: "Computer Engineering",
    },
    {
      id: 2,
      editedAt: "2026-04-01T09:30:00",
      ulaApplicationId: 9,
      taApplicationId: null,
      fieldName: "priorCoursework",
      oldValue: null,
      newValue:
        '{"id":21,"ucsbCourse":true,"otherSchool":null,"courseNumber":"CMPSC 16","courseTitle":"Problem Solving I","term":"F25","grade":"A"}',
    },
    {
      id: 1,
      editedAt: "2026-03-30T08:00:00",
      ulaApplicationId: 9,
      taApplicationId: null,
      fieldName: "comments",
      oldValue: "Happy to help with either lecture, whichever needs it most.",
      newValue: null,
    },
  ],
};

/** What /api/admin/audittrail/all returns for the first page of those three. */
auditTrailFixtures.firstPage = {
  content: auditTrailFixtures.threeRows,
  number: 0,
  size: 10,
  totalElements: 3,
  totalPages: 1,
};

export default auditTrailFixtures;
