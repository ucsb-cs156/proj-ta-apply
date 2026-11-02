import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import FakeRankingsModal from "main/components/Recruitments/FakeRankingsModal";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const axiosMock = new AxiosMockAdapter(axios);

function renderModal(onHide = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <FakeRankingsModal
          recruitmentId={7}
          onHide={onHide}
          testIdPrefix="Fake"
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onHide, invalidate };
}

const posts = () =>
  axiosMock.history.post.filter(
    (r) => r.url === "/api/admin/developer/fakeRankings",
  );

describe("FakeRankingsModal tests", () => {
  beforeEach(() => {
    mockToast.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock
      .onPost("/api/admin/developer/fakeRankings")
      .reply(200, { id: 3, status: "running" });
  });

  test("opens with every course chosen and the not-interested box unticked", () => {
    renderModal();

    expect(
      screen.getByText("Create Fake Rankings", { selector: ".modal-title" }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Every course that has no rankings yet"),
    ).toBeChecked();
    expect(
      screen.getByLabelText(
        "Some of the courses (a random part; the rest stay unranked)",
      ),
    ).not.toBeChecked();
    const box = screen.getByLabelText(
      "Also rank one or two applicants who did not express interest in the course",
    );
    expect(box).not.toBeChecked();
    expect(box).toBe(screen.getByTestId("Fake-not-interested"));
    expect(box).toHaveAttribute("id", "Fake-not-interested");
    expect(screen.getByTestId("Fake-scope")).toContainElement(
      screen.getByTestId("Fake-scope-ALL"),
    );
    for (const value of ["ALL", "SOME"]) {
      const radio = screen.getByTestId(`Fake-scope-${value}`);
      expect(radio).toHaveAttribute("name", "Fake-scope");
      expect(radio).toHaveAttribute("id", `Fake-scope-${value}`);
    }
    expect(screen.getByTestId("Fake-modal")).toBeInTheDocument();
  });

  test("Create sends the defaults, then says where to follow the job", async () => {
    const { invalidate } = renderModal();

    await userEvent.click(screen.getByTestId("Fake-create"));

    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0].params).toEqual({
      recruitmentId: 7,
      scope: "ALL",
      includeNotInterested: false,
    });
    expect(
      await screen.findByTestId("Fake-launched-modal"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("Fake-modal")).not.toBeInTheDocument();
    expect(
      screen.getByText("Fake rankings are being entered", {
        selector: ".modal-title",
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("Fake-jobs-link")).toHaveAttribute(
      "href",
      "/admin/jobs",
    );
    expect(screen.getByTestId("Fake-jobs-link")).toHaveTextContent("Jobs page");
    expect(
      screen.getByTestId("Fake-jobs-link").parentElement.textContent,
    ).toBe(
      "The fake rankings are being entered by a background job. See the Jobs page to follow it. The ranking counts update once it has finished.",
    );
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["/api/instructor/recruitments/admin-course-rankings"],
      }),
    );
  });

  test("the choices are sent as chosen", async () => {
    renderModal();

    await userEvent.click(screen.getByTestId("Fake-scope-SOME"));
    await userEvent.click(screen.getByTestId("Fake-not-interested"));
    expect(screen.getByTestId("Fake-scope-SOME")).toBeChecked();
    expect(screen.getByTestId("Fake-scope-ALL")).not.toBeChecked();
    expect(screen.getByTestId("Fake-not-interested")).toBeChecked();
    await userEvent.click(screen.getByTestId("Fake-create"));

    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0].params).toEqual({
      recruitmentId: 7,
      scope: "SOME",
      includeNotInterested: true,
    });
  });

  test("a failure is reported and the form stays open", async () => {
    axiosMock.onPost("/api/admin/developer/fakeRankings").reply(400, {
      type: "IllegalArgumentException",
      message: "Faculty ranking is not open for this recruitment",
    });
    renderModal();

    await userEvent.click(screen.getByTestId("Fake-create"));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Faculty ranking is not open for this recruitment",
      ),
    );
    expect(screen.getByTestId("Fake-modal")).toBeInTheDocument();
    expect(screen.queryByTestId("Fake-launched-modal")).not.toBeInTheDocument();
    expect(screen.getByTestId("Fake-create")).toBeEnabled();
  });

  test("Create is disabled while the request is in flight", async () => {
    axiosMock
      .onPost("/api/admin/developer/fakeRankings")
      .reply(() => new Promise(() => {}));
    renderModal();

    await userEvent.click(screen.getByTestId("Fake-create"));

    await waitFor(() =>
      expect(screen.getByTestId("Fake-create")).toBeDisabled(),
    );
  });

  test("Cancel and Close hide the modal", async () => {
    const first = renderModal();
    await userEvent.click(screen.getByTestId("Fake-cancel"));
    expect(first.onHide).toHaveBeenCalledTimes(1);
  });

  test("Close on the launched notice hides the modal", async () => {
    const { onHide } = renderModal();
    await userEvent.click(screen.getByTestId("Fake-create"));

    await userEvent.click(await screen.findByTestId("Fake-launched-close"));

    expect(onHide).toHaveBeenCalledTimes(1);
  });
});
