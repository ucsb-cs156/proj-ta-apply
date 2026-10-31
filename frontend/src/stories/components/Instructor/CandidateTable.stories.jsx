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
  },
  parameters: {
    msw: {
      handlers: [
        http.put(
          "/api/instructor/recruitments/1/courses/2/candidates/:id/rank",
          async ({ request }) => HttpResponse.json(await request.json()),
        ),
      ],
    },
  },
};

export const TA = {};
export const ULA = { args: { type: "ULA" } };
export const ReadOnly = { args: { editable: false } };
export const Empty = { args: { candidates: [] } };
export const Tied = {
  args: {
    candidates: candidatesFixtures.map((candidate) => ({
      ...candidate,
      rank: 1,
    })),
  },
};
