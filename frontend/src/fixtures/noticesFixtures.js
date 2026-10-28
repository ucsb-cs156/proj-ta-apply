const noticesFixtures = {
  taV1: {
    id: 1,
    type: "TA",
    content:
      "# TA Terms\n\nBe available for the **whole** quarter. ~~Readers exempt.~~",
    createdAt: "2026-01-02T03:04:05",
  },
  taV2: {
    id: 2,
    type: "TA",
    content:
      "# TA Terms\n\nBe available for the **whole** quarter.\n\n- Attend training\n- Hold office hours",
    createdAt: "2026-02-03T04:05:06",
  },
  ulaV1: {
    id: 3,
    type: "ULA",
    content: "# ULA Terms\n\nULAs may not grade exams.",
    createdAt: "2026-01-05T10:00:00",
  },
};

/** Newest first, as /api/admin/notices/all returns them. */
noticesFixtures.taHistory = [noticesFixtures.taV2, noticesFixtures.taV1];

export default noticesFixtures;
