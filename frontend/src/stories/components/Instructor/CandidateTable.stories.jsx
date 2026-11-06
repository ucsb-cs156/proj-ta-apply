import CandidateTable from "main/components/Instructor/CandidateTable";
import candidatesFixtures from "fixtures/candidatesFixtures";
import { http, HttpResponse } from "msw";

export default {
  title: "components/Instructor/CandidateTable",
  component: CandidateTable,
  args: {
    candidates: candidatesFixtures,
    type: "TA",
    editable: true,
    apiUrl: "/api/instructor/recruitments/1/courses/2/candidates",
    applicationUrl: "/recruitments/1/courses/2/applications",
    columnsStorageKey: "candidateRanking.hiddenColumns.storybook.TA",
  },
  parameters: {
    msw: {
      handlers: [
        http.put(
          "/api/instructor/recruitments/1/courses/2/candidates/:id/rank",
          async ({ request }) =>
            HttpResponse.json({ ...(await request.json()), version: 4 }),
        ),
      ],
    },
  },
};

export const TA = {};
export const ULA = { args: { type: "ULA" } };
export const ReadOnly = { args: { editable: false } };
export const Empty = { args: { candidates: [] } };
// The yellow highlight and the warning under the tied rows appear two seconds after a tie is
// made (issue #311), so Chromatic waits for them.
export const Tied = {
  parameters: { chromatic: { delay: 2500 } },
  args: {
    candidates: candidatesFixtures.map((candidate) => ({
      ...candidate,
      rank: 1,
    })),
  },
};

/** Issue #311: two groups of tied rankings, each with its own warning under its last row. */
export const TwoTiedGroups = {
  parameters: { chromatic: { delay: 2500 } },
  args: {
    candidates: candidatesFixtures.map((candidate, i) => ({
      ...candidate,
      rank: i < 2 ? 1 : i < 4 ? 2 : null,
    })),
  },
};

/** Issue #292: a first quarter applicant has no GPAs yet, so the cells say so. */
export const FirstQuarterCandidate = {
  args: {
    type: "ULA",
    candidates: candidatesFixtures.map((candidate, i) =>
      i === 0
        ? { ...candidate, firstQuarter: true, gpaMajor: null, gpaOverall: null }
        : candidate,
    ),
  },
};

/** Issue #312: some columns hidden, as the instructor's browser remembers them. */
export const SomeColumnsHidden = {
  args: { columnsStorageKey: "candidateRanking.hiddenColumns.storybook.some" },
  decorators: [
    (Story) => {
      localStorage.setItem(
        "candidateRanking.hiddenColumns.storybook.some",
        JSON.stringify(["email", "major"]),
      );
      return <Story />;
    },
  ],
};

/** Issue #312: with columns hidden the tied warning still spans the table. */
export const TiedWithColumnsHidden = {
  parameters: { chromatic: { delay: 2500 } },
  args: {
    columnsStorageKey: "candidateRanking.hiddenColumns.storybook.tied",
    candidates: candidatesFixtures.map((candidate) => ({
      ...candidate,
      rank: 1,
    })),
  },
  decorators: [
    (Story) => {
      localStorage.setItem(
        "candidateRanking.hiddenColumns.storybook.tied",
        JSON.stringify(["email", "major", "classLevel"]),
      );
      return <Story />;
    },
  ],
};
