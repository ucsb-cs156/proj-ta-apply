/**
 * What GET /api/admin/recruitments/{id}/steps will return (issue #231), for the live Recruitment
 * Steps diagram (issue #230): one recruitment at each stage of the flow. Recruitment 1 is the W26
 * TA recruitment; the ULA fixture is recruitment 2, also W26.
 */

const courses = (id) => `/admin/recruitments/${id}/courses`;

/** The nine steps of a recruitment that has only just been created. */
const freshSteps = (id, qyy) => [
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
    label: "Prim. Consid: 2026-01-20",
    action: "closeApplications",
  },
  {
    number: 4,
    done: false,
    label: "Hiring Target: 1",
    titleLinks: [
      { text: "Budget", href: `/admin/budget/${qyy}` },
      { text: "Allocations", href: courses(id) },
    ],
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
    secondaryLink: { text: "(see rankings)", href: courses(id) },
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
    secondaryLink: { text: "(see assignments)", href: courses(id) },
  },
];

/** The fresh steps with some of them replaced. */
const withSteps = (base, replacements) => ({
  ...base,
  steps: base.steps.map(
    (step) => replacements.find((r) => r.number === step.number) ?? step,
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
    number: 3,
    done: true,
    label: "Closed: 2026-02-01",
    action: "openApplications",
  },
]);

/** The admin has set a target of 8 and allocated all eight slots. */
const allocated = withSteps(applicationsClosed, [
  {
    number: 4,
    done: true,
    label: "Hiring Target: 8",
    titleLinks: [
      { text: "Budget", href: "/admin/budget/W26" },
      { text: "Allocations", href: courses(1) },
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
    secondaryLink: { text: "(see rankings)", href: courses(1) },
  },
]);

const rankingsClosed = withSteps(rankingsOpen, [
  {
    number: 7,
    done: true,
    label: "Closed: 2026-02-16",
    action: "openReviews",
    secondaryLink: { text: "(see rankings)", href: courses(1) },
  },
]);

/** Six of the eight slots have a tentative assignment. */
const assigning = withSteps(rankingsClosed, [
  {
    number: 8,
    done: false,
    label: "Still to assign: 2",
    href: "/admin/recruitments/1/assignments",
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
    secondaryLink: { text: "(see assignments)", href: courses(1) },
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
  assigning,
  published,
  ulaFresh,
};

export default recruitmentStepsFixtures;
