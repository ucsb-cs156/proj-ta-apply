import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import AutoAssignModal from "main/components/Assignments/AutoAssignModal";
import assignmentsFixtures from "fixtures/assignmentsFixtures";
import autoAssignFixtures from "fixtures/autoAssignFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const axiosMock = new AxiosMockAdapter(axios);

/** Recruitment 7 with its ranking deadline long past, and not published. */
const settled = {
  ...recruitmentsFixtures.threeRecruitments[0],
  id: 7,
  facultyRankingDeadline: "2000-01-01",
  assignmentsPublished: false,
};

function renderModal(props = {}) {
  const callbacks = {
    onUpdated: vi.fn(),
    onError: vi.fn(),
    onHide: vi.fn(),
  };
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <AutoAssignModal
        recruitmentId="7"
        page={assignmentsFixtures.taPage}
        recruitment={settled}
        headers={{ "X-Client-Id": "tab-1" }}
        testIdPrefix="Auto"
        {...callbacks}
        {...props}
      />
    </QueryClientProvider>,
  );
  return callbacks;
}

const runs = () =>
  axiosMock.history.post.filter((r) => r.url === "/api/admin/assignments/auto");
const undos = () =>
  axiosMock.history.post.filter(
    (r) => r.url === "/api/admin/assignments/auto/undo",
  );

describe("AutoAssignModal tests (issue #481)", () => {
  beforeEach(() => {
    mockToast.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock
      .onPost("/api/admin/assignments/auto")
      .reply(200, autoAssignFixtures.twoMade);
    axiosMock
      .onPost("/api/admin/assignments/auto/undo")
      .reply(200, autoAssignFixtures.undone);
  });

  // ---- the confirmation ----

  test("opens on the confirmation, explaining the rule, with no warnings when all is settled", () => {
    renderModal();

    expect(screen.getByTestId("Auto-modal")).toBeInTheDocument();
    expect(
      screen.getByText("Automatically Assign No-Conflict Slots", {
        selector: ".modal-title",
      }),
    ).toBeInTheDocument();
    // A TA page (issue #488): the explanation carries the PhD rule.
    expect(screen.getByTestId("Auto-explanation")).toHaveTextContent(
      "Fills every place where there is one clear choice. A lecture that still has places to fill gets its highest-ranked unassigned candidate when that candidate is enthusiastic about the course (1st Choice, 2nd Choice or Enthusiastic) and no other lecture that still has places to fill has ranked them at all. This repeats until no more such assignments can be made. Applicants marked Not Hired take no part. Only PhD students whose major is Computer Science are ever assigned automatically; a lecture whose top remaining candidate is an MS student or in another major is left for you, and listed with the reason. Nothing already assigned is changed, and the run can be undone afterwards.",
    );
    expect(screen.queryByTestId("Auto-warnings")).toBeNull();
    expect(screen.getByTestId("Auto-run")).toHaveTextContent("Assign");
    expect(screen.getByTestId("Auto-run")).toBeEnabled();
    expect(screen.getByTestId("Auto-cancel")).toHaveTextContent("Cancel");
  });

  test("the explanation of a ULA page leaves out the PhD rule, which is TA only (issue #488)", () => {
    renderModal({ page: assignmentsFixtures.ulaPage });

    const explanation = screen.getByTestId("Auto-explanation");
    expect(explanation).toHaveTextContent(
      "Applicants marked Not Hired take no part. Nothing already assigned is changed",
    );
    expect(explanation).not.toHaveTextContent("PhD");
  });

  test("a TA run left to a person for class level or major lists both reasons (issue #488)", async () => {
    axiosMock
      .onPost("/api/admin/assignments/auto")
      .reply(200, autoAssignFixtures.manualOnly);
    renderModal();

    await userEvent.click(screen.getByTestId("Auto-run"));

    expect(await screen.findByTestId("Auto-none")).toBeInTheDocument();
    const skipped = within(screen.getByTestId("Auto-skipped")).getAllByRole(
      "listitem",
    );
    expect(skipped.map((item) => item.textContent)).toEqual([
      "8: its top remaining candidate, Grace Hopper (ranked 1), is an MS student, so is assigned by hand only.",
      "16: its top remaining candidate, Alan Turing (ranked 1), is not a Computer Science major, so is assigned by hand only.",
    ]);
  });

  test("warns when no ranking deadline is set", () => {
    renderModal({
      recruitment: { ...settled, facultyRankingDeadline: null },
    });
    const warnings = screen.getByTestId("Auto-warnings");
    expect(within(warnings).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByTestId("Auto-warning-deadline")).toHaveTextContent(
      "No faculty ranking deadline is set, so rankings may still be arriving.",
    );
    expect(screen.getByTestId("Auto-warning-deadline")).toHaveClass(
      "text-danger",
    );
  });

  test("warns when the ranking deadline is still to come, naming it", () => {
    renderModal({
      recruitment: { ...settled, facultyRankingDeadline: "2099-12-31" },
    });
    expect(screen.getByTestId("Auto-warning-deadline")).toHaveTextContent(
      "The faculty ranking deadline (2099-12-31) has not passed, so rankings may still be arriving.",
    );
  });

  test("warns when assignments are published", () => {
    renderModal({ recruitment: { ...settled, assignmentsPublished: true } });
    expect(screen.getByTestId("Auto-warning-published")).toHaveTextContent(
      "Assignments are published: faculty will see these changes at once.",
    );
    expect(screen.queryByTestId("Auto-warning-deadline")).toBeNull();
  });

  test("no recruitment-based warnings while the recruitment is not known", () => {
    renderModal({ recruitment: undefined });
    expect(screen.queryByTestId("Auto-warnings")).toBeNull();
  });

  test("warns about a lecture, or lectures, still needing assignments with no rankings", () => {
    const page = assignmentsFixtures.taPage;
    const one = {
      ...page,
      courses: [...page.courses, { ...page.courses[0], id: 50 }],
    };
    const { unmount } = render(
      <QueryClientProvider client={new QueryClient()}>
        <AutoAssignModal
          recruitmentId="7"
          page={one}
          recruitment={settled}
          headers={{}}
          onUpdated={vi.fn()}
          onError={vi.fn()}
          onHide={vi.fn()}
          testIdPrefix="Auto"
        />
      </QueryClientProvider>,
    );
    // Two lectures with the course number 8 now: both are named with their section.
    expect(screen.getByTestId("Auto-warning-unranked")).toHaveTextContent(
      "This lecture still needs assignments but has no rankings yet, so a run cannot fill it and could hand its instructor's favourite to another lecture: 8 (0100).",
    );
    unmount();

    const two = {
      ...page,
      courses: [
        ...page.courses,
        { ...page.courses[0], id: 50, courseId: "CMPSC   130A" },
        { ...page.courses[0], id: 60, courseId: "CMPSC   190DD", left: 3 },
      ],
    };
    renderModal({ page: two });
    expect(screen.getByTestId("Auto-warning-unranked")).toHaveTextContent(
      "These lectures still need assignments but have no rankings yet, so a run cannot fill them and could hand their instructor's favourite to another lecture: 130A, 190DD.",
    );
  });

  test("the warnings are listed deadline, published, unranked", () => {
    renderModal({
      recruitment: {
        ...settled,
        facultyRankingDeadline: null,
        assignmentsPublished: true,
      },
      page: {
        ...assignmentsFixtures.taPage,
        courses: [
          ...assignmentsFixtures.taPage.courses,
          { ...assignmentsFixtures.taPage.courses[0], id: 50 },
        ],
      },
    });
    const items = within(screen.getByTestId("Auto-warnings")).getAllByRole(
      "listitem",
    );
    expect(items.map((item) => item.getAttribute("data-testid"))).toEqual([
      "Auto-warning-deadline",
      "Auto-warning-published",
      "Auto-warning-unranked",
    ]);
  });

  test("Cancel and the close button hide it without running anything", async () => {
    const { onHide } = renderModal();
    await userEvent.click(screen.getByTestId("Auto-cancel"));
    expect(onHide).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onHide).toHaveBeenCalledTimes(2);
    expect(runs()).toHaveLength(0);
  });

  // ---- the run ----

  test("Assign posts the run with the page's version and the client id, shows the page it answers with, then what it did", async () => {
    const { onUpdated, onHide } = renderModal();

    await userEvent.click(screen.getByTestId("Auto-run"));

    await waitFor(() => expect(runs()).toHaveLength(1));
    expect(runs()[0].params).toEqual({ recruitmentId: "7", version: 3 });
    expect(runs()[0].headers["X-Client-Id"]).toBe("tab-1");
    expect(await screen.findByTestId("Auto-result-modal")).toBeInTheDocument();
    expect(onUpdated).toHaveBeenCalledWith(assignmentsFixtures.taPageAfterMove);
    expect(onHide).not.toHaveBeenCalled();
    expect(
      screen.getByText("Automatic assignment finished", {
        selector: ".modal-title",
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("Auto-made-count")).toHaveTextContent(
      "2 assignments made:",
    );
    const made = within(screen.getByTestId("Auto-made")).getAllByRole(
      "listitem",
    );
    expect(made).toHaveLength(2);
    expect(made[0]).toBe(screen.getByTestId("Auto-made-0"));
    expect(screen.getByTestId("Auto-made-0")).toHaveTextContent(
      "Ada Lovelace to 8, ranked 1 (pass 1)",
    );
    expect(screen.getByTestId("Auto-made-1")).toHaveTextContent(
      "blank@ucsb.edu to 24, ranked 2 (pass 2)",
    );
    expect(screen.getByTestId("Auto-skipped-intro")).toHaveTextContent(
      "Lectures still to fill, and why nothing was assigned to them (these are the judgement calls):",
    );
    expect(screen.getByTestId("Auto-skipped-0")).toHaveTextContent(
      "16: its top remaining candidate, Alan Turing (ranked 1), is also ranked by 8 and 24.",
    );
    expect(screen.queryByTestId("Auto-none")).toBeNull();
    expect(screen.queryByTestId("Auto-all-filled")).toBeNull();
    expect(screen.getByTestId("Auto-undo")).toHaveTextContent("Undo this run");
    expect(screen.getByTestId("Auto-close")).toHaveTextContent("Close");
  });

  test("the Assign button is disabled while the run is pending", async () => {
    let release;
    axiosMock.onPost("/api/admin/assignments/auto").reply(
      () =>
        new Promise((resolve) => {
          release = () => resolve([200, autoAssignFixtures.twoMade]);
        }),
    );
    renderModal();
    await userEvent.click(screen.getByTestId("Auto-run"));
    await waitFor(() => expect(screen.getByTestId("Auto-run")).toBeDisabled());
    release();
    expect(await screen.findByTestId("Auto-result-modal")).toBeInTheDocument();
  });

  test("a run that made nothing says so, and offers no undo", async () => {
    axiosMock
      .onPost("/api/admin/assignments/auto")
      .reply(200, autoAssignFixtures.nothingMade);
    renderModal();

    await userEvent.click(screen.getByTestId("Auto-run"));

    expect(await screen.findByTestId("Auto-none")).toHaveTextContent(
      "No no-conflict slots found: nothing was assigned.",
    );
    expect(screen.queryByTestId("Auto-made-count")).toBeNull();
    expect(screen.queryByTestId("Auto-made")).toBeNull();
    expect(screen.queryByTestId("Auto-undo")).toBeNull();
    const skipped = within(screen.getByTestId("Auto-skipped")).getAllByRole(
      "listitem",
    );
    expect(skipped.map((item) => item.textContent)).toEqual([
      "8: its top remaining candidate, Grace Hopper (ranked 2), is not enthusiastic about it.",
      "16: two or more remaining candidates share its top rank (1).",
      "24: no rankings yet.",
      "lecture 99: every candidate it ranked is already assigned.",
    ]);
  });

  test("one assignment and nothing left to fill: singular count and the all-filled line", async () => {
    axiosMock
      .onPost("/api/admin/assignments/auto")
      .reply(200, autoAssignFixtures.oneMadeAllFilled);
    renderModal();

    await userEvent.click(screen.getByTestId("Auto-run"));

    expect(await screen.findByTestId("Auto-made-count")).toHaveTextContent(
      "1 assignment made:",
    );
    expect(screen.getByTestId("Auto-all-filled")).toHaveTextContent(
      "No lecture has places left to fill.",
    );
    expect(screen.queryByTestId("Auto-skipped-intro")).toBeNull();
    expect(screen.queryByTestId("Auto-skipped")).toBeNull();
  });

  test("a failed run is handed to the page and the modal closes", async () => {
    axiosMock.onPost("/api/admin/assignments/auto").reply(409, {
      message: "Changed.",
      assignments: assignmentsFixtures.taPageAfterMove,
    });
    const { onError, onHide, onUpdated } = renderModal();

    await userEvent.click(screen.getByTestId("Auto-run"));

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0][0].response.status).toBe(409);
    expect(onHide).toHaveBeenCalledTimes(1);
    expect(onUpdated).not.toHaveBeenCalled();
    expect(screen.queryByTestId("Auto-result-modal")).toBeNull();
  });

  // ---- undo ----

  test("Undo this run posts back what was made, with the version of the page as it now stands, and reports", async () => {
    const { onUpdated, onHide } = renderModal();
    await userEvent.click(screen.getByTestId("Auto-run"));
    await screen.findByTestId("Auto-result-modal");

    await userEvent.click(screen.getByTestId("Auto-undo"));

    await waitFor(() => expect(undos()).toHaveLength(1));
    // The page prop is still the fixture (the parent is not re-rendering here), so its version.
    expect(undos()[0].params).toEqual({ recruitmentId: "7", version: 3 });
    expect(undos()[0].headers["X-Client-Id"]).toBe("tab-1");
    expect(JSON.parse(undos()[0].data)).toEqual(
      autoAssignFixtures.twoMade.made,
    );
    await waitFor(() => expect(onHide).toHaveBeenCalledTimes(1));
    expect(onUpdated).toHaveBeenLastCalledWith(assignmentsFixtures.taPage);
    expect(mockToast).toHaveBeenCalledWith("Undid 2 automatic assignments.");
  });

  test("undoing one assignment is reported in the singular, and the button is disabled meanwhile", async () => {
    let release;
    axiosMock.onPost("/api/admin/assignments/auto/undo").reply(
      () =>
        new Promise((resolve) => {
          release = () =>
            resolve([
              200,
              { assignments: assignmentsFixtures.taPage, cleared: 1 },
            ]);
        }),
    );
    renderModal();
    await userEvent.click(screen.getByTestId("Auto-run"));
    await userEvent.click(await screen.findByTestId("Auto-undo"));
    await waitFor(() => expect(screen.getByTestId("Auto-undo")).toBeDisabled());
    release();
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith("Undid 1 automatic assignment."),
    );
  });

  test("a failed undo is handed to the page and the modal closes", async () => {
    axiosMock.onPost("/api/admin/assignments/auto/undo").reply(500, {
      message: "Boom",
    });
    const { onError, onHide } = renderModal();
    await userEvent.click(screen.getByTestId("Auto-run"));
    await userEvent.click(await screen.findByTestId("Auto-undo"));

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0][0].response.status).toBe(500);
    expect(onHide).toHaveBeenCalledTimes(1);
    expect(mockToast).not.toHaveBeenCalled();
  });

  test("Close on the results hides the modal", async () => {
    const { onHide } = renderModal();
    await userEvent.click(screen.getByTestId("Auto-run"));
    await userEvent.click(await screen.findByTestId("Auto-close"));
    expect(onHide).toHaveBeenCalledTimes(1);
    expect(undos()).toHaveLength(0);
  });
});
