/**
 * What GET /api/admin/recruitments/{id}/steps will return (issue #231), for the live Recruitment
 * Steps diagram (issue #230): one recruitment at each stage of the flow. Recruitment 1 is the W26
 * TA recruitment; the ULA fixture is recruitment 2, also W26.
 */

const courses = (id) => `/admin/recruitments/${id}/courses`;

/**
 * The lines under the boxes (issue #249): the counts and links the backend adds to each step. A
 * recruitment has four courses; it has twelve applications and three drafts once step 2 is done.
 */
const withUnderBoxLines = (id, steps, qyy = "W26") => {
  const applications = steps.find((s) => s.number === 2).done
    ? "12 applications"
    : "0 applications";
  const drafts = steps.find((s) => s.number === 2).done
    ? "3 draft applications"
    : "0 draft applications";
  const seeDrafts = [
    {
      text: "(see draft applications)",
      href: `/admin/recruitments/${id}/draft-applications`,
    },
  ];
  const seeApplications = [
    {
      text: "(see applications)",
      href: `/admin/recruitments/${id}/applications`,
    },
  ];
  const seeCourses = (text) => [{ text, href: courses(id) }];
  // Issue #317: step 8 names the admin page where assignments are made, step 9 the read-only page.
  const makeAssignments = [
    { text: "Make Assignments", href: `/admin/recruitments/${id}/assignments` },
  ];
  const viewAssignments = [
    { text: "View Assignments", href: `/recruitments/${id}/assignments` },
  ];
  const underBox = {
    1: { detail: "4 courses", links: seeCourses("(see courses)") },
    2: { detail: drafts, links: seeDrafts },
    4: { detail: applications, links: seeApplications },
    // Issue #358: the allocations are on the Combined Allocation page, the assignments on the
    // assignments page.
    5: {
      links: [{ text: "(see allocations)", href: `/admin/allocations/${qyy}` }],
    },
    6: { links: seeCourses("(see rankings)") },
    7: { links: seeCourses("(see rankings)") },
    8: { links: makeAssignments },
    9: { links: viewAssignments },
  };
  return steps.map((step) => ({ ...step, ...underBox[step.number] }));
};

/** The nine steps of a recruitment that has only just been created. */
const freshSteps = (id, qyy) =>
  withUnderBoxLines(id, [
    { number: 1, done: true, label: "Created: 2026-01-03" },
    {
      number: 2,
      done: false,
      label: "Tentative: 2026-01-05",
      action: "openApplications",
    },
    {
      number: 3,
      done: false,
      label: "Hiring Target: 1",
      titleLinks: [
        { text: "Budget", href: `/admin/budget/${qyy}` },
        { text: "Allocations", href: `/admin/allocations/${qyy}` },
      ],
    },
    {
      number: 4,
      done: false,
      label: "Prim. Consid: 2026-01-20",
      action: "closeApplications",
    },
    {
      number: 5,
      done: false,
      label: "Not released yet",
      action: "allocationVisibility",
    },
    { number: 6, done: false, label: "Not opened yet", action: "openReviews" },
    {
      number: 7,
      done: false,
      label: "Not closed yet",
      action: "closeReviews",
    },
    {
      number: 8,
      done: false,
      label: "Still to assign: 1",
      href: `/admin/recruitments/${id}/assignments`,
    },
    {
      number: 9,
      done: false,
      label: "Not released yet",
      action: "publishAssignments",
      blockedReason: "Close Faculty Ranking before releasing hiring decisions.",
    },
  ]);

/** The fresh steps with some of them replaced. */
const withSteps = (base, replacements) => ({
  ...base,
  steps: withUnderBoxLines(
    base.recruitmentId,
    base.steps.map(
      (step) => replacements.find((r) => r.number === step.number) ?? step,
    ),
  ),
});

const fresh = { recruitmentId: 1, type: "TA", steps: freshSteps(1, "W26") };

const applicationsOpen = withSteps(fresh, [
  {
    number: 2,
    done: true,
    label: "Opened: 2026-01-07",
    action: "closeApplications",
  },
]);

const applicationsClosed = withSteps(applicationsOpen, [
  {
    number: 4,
    done: true,
    label: "Closed: 2026-02-01",
    action: "openApplications",
  },
]);

/** The admin has set a target of 8 and allocated all eight slots. */
const allocated = withSteps(applicationsClosed, [
  {
    number: 3,
    done: true,
    label: "Hiring Target: 8",
    titleLinks: [
      { text: "Budget", href: "/admin/budget/W26" },
      { text: "Allocations", href: "/admin/allocations/W26" },
    ],
  },
  {
    number: 8,
    done: false,
    label: "Still to assign: 8",
    href: "/admin/recruitments/1/assignments",
  },
]);

const released = withSteps(allocated, [
  {
    number: 5,
    done: true,
    label: "Released: 2026-02-03",
    action: "allocationVisibility",
  },
]);

/** Reviews are open with a deadline, so step 7 shows the deadline rather than "Not closed yet". */
const rankingsOpen = withSteps(released, [
  {
    number: 6,
    done: true,
    label: "Opened: 2026-02-05",
    action: "closeReviews",
  },
  {
    number: 7,
    done: false,
    label: "Deadline: 2026-02-15",
    action: "closeReviews",
  },
]);

const rankingsClosed = withSteps(rankingsOpen, [
  {
    number: 7,
    done: true,
    label: "Closed: 2026-02-16",
    action: "openReviews",
  },
]);

/** Six of the eight slots have a tentative assignment. */
const rankingsClosedNobodyAssigned = withSteps(rankingsClosed, [
  {
    number: 9,
    done: false,
    label: "Not released yet",
    action: "publishAssignments",
    blockedReason:
      "Assign candidates to slots before releasing hiring decisions.",
  },
]);

const assigning = withSteps(rankingsClosedNobodyAssigned, [
  {
    number: 8,
    done: false,
    label: "Still to assign: 2",
    href: "/admin/recruitments/1/assignments",
  },
  {
    number: 9,
    done: false,
    label: "Not released yet",
    action: "publishAssignments",
  },
]);

/** Everything is done; step 9 now links to the published Assignments page. */
const published = withSteps(assigning, [
  {
    number: 8,
    done: true,
    label: "Assignment complete",
    href: "/admin/recruitments/1/assignments",
  },
  {
    number: 9,
    done: true,
    label: "Released: 2026-02-20",
    href: "/recruitments/1/assignments",
  },
]);

/** Released, then applications or faculty ranking were reopened (issue #237). */
const publishedTentative = withSteps(published, [
  {
    number: 9,
    done: true,
    label: "Released: 2026-02-20",
    href: "/recruitments/1/assignments",
    tentative: true,
  },
]);

const ulaFresh = { recruitmentId: 2, type: "ULA", steps: freshSteps(2, "W26") };

const recruitmentStepsFixtures = {
  fresh,
  applicationsOpen,
  applicationsClosed,
  allocated,
  released,
  rankingsOpen,
  rankingsClosed,
  rankingsClosedNobodyAssigned,
  assigning,
  published,
  publishedTentative,
  ulaFresh,
};

export default recruitmentStepsFixtures;
