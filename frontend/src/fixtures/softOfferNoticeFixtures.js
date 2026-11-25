// The Soft Offer Notices (issue #484): versions as /api/admin/softOfferNotices/all returns them.
const softOfferNoticeFixtures = {
  v1: {
    id: 1,
    content:
      "# Congratulations\n\nYou have been recommended for a ULA position for ${quarter}.",
    createdAt: "2026-03-01T09:00:00",
  },
  v2: {
    id: 2,
    content:
      "# Congratulations\n\nYou have been recommended for a ULA position for ${quarter}.\n\n- Training is required of first-time ULAs\n- Hours are 10 per week",
    createdAt: "2026-03-02T10:30:00",
  },
};

/** Newest first, as the history endpoint returns them. */
softOfferNoticeFixtures.history = [
  softOfferNoticeFixtures.v2,
  softOfferNoticeFixtures.v1,
];

export default softOfferNoticeFixtures;
