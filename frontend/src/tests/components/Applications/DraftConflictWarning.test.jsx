import { render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

import DraftConflictWarning, {
  DRAFT_CONFLICTS_URL,
} from "main/components/Applications/DraftConflictWarning";
import draftConflictsFixtures from "fixtures/draftConflictsFixtures";

const axiosMock = new AxiosMockAdapter(axios);

let queryClient;

/** What the page has stored as the check's answer. */
const storedAnswer = () => queryClient.getQueryData([DRAFT_CONFLICTS_URL, "7"]);

function renderWarning(props) {
  queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DraftConflictWarning recruitmentId="7" {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("DraftConflictWarning tests", () => {
  beforeEach(() => {
    axiosMock.reset();
    axiosMock.resetHistory();
  });

  test("the endpoint is the admin's draft conflicts check", () => {
    expect(DRAFT_CONFLICTS_URL).toBe("/api/admin/applications/draftConflicts");
  });

  test("lists each student with both a draft and an application, with links to both", async () => {
    axiosMock
      .onGet(DRAFT_CONFLICTS_URL, { params: { recruitmentId: "7" } })
      .reply(200, draftConflictsFixtures.two);

    renderWarning();

    const warning = await screen.findByTestId("DraftConflictWarning");
    expect(warning).toHaveClass("alert-danger");
    expect(
      within(warning).getByRole("heading", { level: 2, name: "WARNING" }),
    ).toBeInTheDocument();
    expect(warning).toHaveTextContent(
      "The following students have both a draft application and a regular application. This is not supposed to be possible, and represents a bug in the application.",
    );

    const table = screen.getByTestId("DraftConflictWarning-table");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((th) => th.textContent),
    ).toEqual(["email", "draft application", "finalized application"]);

    const rows = screen.getAllByTestId("DraftConflictWarning-row");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("ada@ucsb.edu");
    expect(within(rows[0]).getByRole("link", { name: "13" })).toHaveAttribute(
      "href",
      "/admin/draft-applications/13",
    );
    expect(within(rows[0]).getByRole("link", { name: "17" })).toHaveAttribute(
      "href",
      "/admin/applications/17",
    );
    expect(rows[1]).toHaveTextContent("bob@ucsb.edu");
    expect(within(rows[1]).getByRole("link", { name: "14" })).toHaveAttribute(
      "href",
      "/admin/draft-applications/14",
    );
    expect(within(rows[1]).getByRole("link", { name: "21" })).toHaveAttribute(
      "href",
      "/admin/applications/21",
    );
    expect(axiosMock.history.get[0].params).toEqual({ recruitmentId: "7" });
  });

  test("the test ids follow the prefix given", async () => {
    axiosMock.onGet(DRAFT_CONFLICTS_URL).reply(200, draftConflictsFixtures.one);

    renderWarning({ testIdPrefix: "SomePage-conflicts" });

    expect(await screen.findByTestId("SomePage-conflicts")).toBeInTheDocument();
    expect(screen.getByTestId("SomePage-conflicts-table")).toBeInTheDocument();
    expect(screen.getAllByTestId("SomePage-conflicts-row")).toHaveLength(1);
    expect(screen.getByTestId("SomePage-conflicts-draft-link")).toHaveAttribute(
      "href",
      "/admin/draft-applications/13",
    );
    expect(
      screen.getByTestId("SomePage-conflicts-application-link"),
    ).toHaveAttribute("href", "/admin/applications/17");
  });

  test("nothing is shown when no one has both", async () => {
    axiosMock
      .onGet(DRAFT_CONFLICTS_URL)
      .reply(200, draftConflictsFixtures.none);

    const { container } = renderWarning();

    await waitFor(() => expect(axiosMock.history.get).toHaveLength(1));
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("WARNING")).not.toBeInTheDocument();
  });

  test("an answer that is not a list is taken as no one", async () => {
    axiosMock.onGet(DRAFT_CONFLICTS_URL).reply(200, { email: "x@ucsb.edu" });

    const { container } = renderWarning();

    await waitFor(() =>
      expect(storedAnswer()).toEqual({ email: "x@ucsb.edu" }),
    );
    expect(container).toBeEmptyDOMElement();
  });
});
