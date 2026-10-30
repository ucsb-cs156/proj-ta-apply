/** Rows of the recruitment audit trail (issue #139): changes to a recruitment itself. */
const recruitmentAuditTrailFixtures = {
  /** Creation, then opening: the status change and the stamped date. Newest first, as served. */
  threeRows: [
    {
      id: 3,
      changedAt: "2026-01-06T09:30:00",
      recruitmentId: 1,
      whatChanged: "actualOpeningDate",
      oldValue: null,
      newValue: "2026-01-06",
    },
    {
      id: 2,
      changedAt: "2026-01-06T09:30:00",
      recruitmentId: 1,
      whatChanged: "applicationStatus",
      oldValue: "CLOSED",
      newValue: "OPEN",
    },
    {
      id: 1,
      changedAt: "2026-01-05T14:00:00",
      recruitmentId: 1,
      whatChanged: "created",
      oldValue: null,
      newValue: null,
    },
  ],
};

/** The three rows as the one and only page. */
recruitmentAuditTrailFixtures.onePage = {
  content: recruitmentAuditTrailFixtures.threeRows,
  number: 0,
  size: 10,
  totalElements: 3,
  totalPages: 1,
};

/** The first of two pages of two rows each, for a recruitment with three changes. */
recruitmentAuditTrailFixtures.firstOfTwoPages = {
  content: recruitmentAuditTrailFixtures.threeRows.slice(0, 2),
  number: 0,
  size: 2,
  totalElements: 3,
  totalPages: 2,
};

/** The second of those two pages. */
recruitmentAuditTrailFixtures.secondOfTwoPages = {
  content: recruitmentAuditTrailFixtures.threeRows.slice(2),
  number: 1,
  size: 2,
  totalElements: 3,
  totalPages: 2,
};

/** No changes at all. */
recruitmentAuditTrailFixtures.emptyPage = {
  content: [],
  number: 0,
  size: 10,
  totalElements: 0,
  totalPages: 0,
};

export default recruitmentAuditTrailFixtures;
