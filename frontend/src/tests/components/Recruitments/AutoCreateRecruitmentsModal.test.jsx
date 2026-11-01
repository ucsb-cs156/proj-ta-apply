import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import AutoCreateRecruitmentsModal from "main/components/Recruitments/AutoCreateRecruitmentsModal";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const axiosMock = new AxiosMockAdapter(axios);

// Saturday 2026-10-31, in Fall quarter: the next non-summer quarter is W27.
const today = new Date(2026, 9, 31);

const recruitment = (quarter, type) => ({ id: 1, quarter, type });

function renderModal(recruitments = [], onHide = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  render(
    <QueryClientProvider client={queryClient}>
      <AutoCreateRecruitmentsModal
        recruitments={recruitments}
        onHide={onHide}
        today={today}
        testIdPrefix="Auto"
      />
    </QueryClientProvider>,
  );
  return { onHide, invalidate };
}

const posts = () =>
  axiosMock.history.post.filter(
    (r) => r.url === "/api/admin/recruitments/post",
  );

describe("AutoCreateRecruitmentsModal tests", () => {
  beforeEach(() => {
    mockToast.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock.onPost("/api/admin/recruitments/post").reply(200, { id: 9 });
  });

  test("proposes the next non-summer quarter and plans both recruitments when neither exists", () => {
    renderModal();

    expect(screen.getByText("Auto Create Recruitments")).toBeInTheDocument();
    expect(screen.getByTestId("Auto-quarter")).toHaveValue("20271");
    expect(screen.getByTestId("Auto-quarter").style.width).toBe("8em");
    expect(screen.getByLabelText("Quarter")).toBe(
      screen.getByTestId("Auto-quarter"),
    );
    expect(
      [...screen.getByTestId("Auto-quarter").querySelectorAll("option")].map(
        (o) => o.textContent,
      ),
    ).toEqual(["F26", "W27", "S27", "M27", "F27", "W28"]);
    expect(screen.getByTestId("Auto-ta")).toHaveTextContent(
      "A TA recruitment for W27 will be created.",
    );
    expect(screen.getByTestId("Auto-ula")).toHaveTextContent(
      "A ULA recruitment for W27 will be created.",
    );
    expect(screen.getByTestId("Auto-dates")).toHaveTextContent(
      "Tentative opening date: 2026-11-07. Primary consideration date: 2026-11-14.",
    );
    // The primary consideration date starts a new line.
    const dates = screen.getByTestId("Auto-dates");
    expect(dates.querySelectorAll("br")).toHaveLength(1);
    expect(dates.querySelector("br").previousSibling.textContent).toBe(". ");
    expect(dates.querySelector("br").nextSibling.textContent).toBe(
      "Primary consideration date: ",
    );
    expect(screen.queryByTestId("Auto-nothing")).not.toBeInTheDocument();
    // The whole plan is one block: both lines and the dates.
    expect(screen.getByTestId("Auto-plan")).toContainElement(
      screen.getByTestId("Auto-ta"),
    );
    expect(screen.getByTestId("Auto-plan")).toContainElement(
      screen.getByTestId("Auto-dates"),
    );
    expect(screen.getByTestId("Auto-create")).toHaveTextContent(
      "Create Recruitments",
    );
    expect(screen.getByTestId("Auto-create")).toHaveClass("btn-success");
    expect(screen.getByTestId("Auto-cancel")).toHaveTextContent("Cancel");
    expect(posts()).toHaveLength(0);
  });

  test("a TA recruitment that exists is skipped and only the ULA one is created", async () => {
    const { onHide, invalidate } = renderModal([recruitment("20271", "TA")]);

    expect(screen.getByTestId("Auto-ta")).toHaveTextContent(
      "A TA recruitment for W27 already exists; it will not be created.",
    );
    expect(screen.getByTestId("Auto-ula")).toHaveTextContent(
      "A ULA recruitment for W27 will be created.",
    );
    await userEvent.click(screen.getByTestId("Auto-create"));

    await waitFor(() => expect(onHide).toHaveBeenCalled());
    expect(posts()).toHaveLength(1);
    expect(posts()[0].params).toEqual({
      quarter: "20271",
      type: "ULA",
      tentativeOpeningDate: "2026-11-07",
      primaryConsiderationDate: "2026-11-14",
    });
    expect(mockToast).toHaveBeenCalledWith(
      "Recruitments created for W27. Their course lists are being filled; watch the Developer > Jobs page.",
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["/api/admin/recruitments/all"],
    });
  });

  test("a ULA recruitment that exists is skipped and only the TA one is created", async () => {
    const { onHide } = renderModal([recruitment("20271", "ULA")]);

    expect(screen.getByTestId("Auto-ta")).toHaveTextContent(
      "A TA recruitment for W27 will be created.",
    );
    expect(screen.getByTestId("Auto-ula")).toHaveTextContent(
      "A ULA recruitment for W27 already exists; it will not be created.",
    );
    await userEvent.click(screen.getByTestId("Auto-create"));

    await waitFor(() => expect(onHide).toHaveBeenCalled());
    expect(posts().map((r) => r.params.type)).toEqual(["TA"]);
  });

  test("when neither exists, both are created, the TA one first", async () => {
    const { onHide } = renderModal();
    await userEvent.click(screen.getByTestId("Auto-create"));

    await waitFor(() => expect(onHide).toHaveBeenCalled());
    expect(posts().map((r) => [r.params.type, r.params.quarter])).toEqual([
      ["TA", "20271"],
      ["ULA", "20271"],
    ]);
    expect(posts()[0].method).toBe("post");
  });

  test("when both exist there is nothing to create and only Cancel is offered", async () => {
    const { onHide } = renderModal([
      recruitment("20271", "TA"),
      recruitment("20271", "ULA"),
    ]);

    expect(screen.getByTestId("Auto-nothing")).toHaveTextContent(
      "A TA and a ULA recruitment for W27 already exist, so there is nothing to create.",
    );
    expect(screen.queryByTestId("Auto-create")).not.toBeInTheDocument();
    expect(screen.queryByTestId("Auto-dates")).not.toBeInTheDocument();
    expect(screen.queryByTestId("Auto-ta")).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId("Auto-cancel"));
    expect(onHide).toHaveBeenCalledTimes(1);
    expect(posts()).toHaveLength(0);
  });

  test("choosing another quarter recomputes the plan", async () => {
    renderModal([recruitment("20272", "TA"), recruitment("20272", "ULA")]);
    expect(screen.queryByTestId("Auto-nothing")).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByTestId("Auto-quarter"), "20272");

    expect(screen.getByTestId("Auto-nothing")).toHaveTextContent("S27");
    await userEvent.selectOptions(screen.getByTestId("Auto-quarter"), "20274");
    expect(screen.getByTestId("Auto-ta")).toHaveTextContent(
      "A TA recruitment for F27 will be created.",
    );
    await userEvent.click(screen.getByTestId("Auto-create"));
    await waitFor(() => expect(posts()).toHaveLength(2));
    expect(posts().map((r) => r.params.quarter)).toEqual(["20274", "20274"]);
  });

  test("Cancel and the close control send nothing", async () => {
    const { onHide } = renderModal();
    await userEvent.click(screen.getByTestId("Auto-cancel"));
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onHide).toHaveBeenCalledTimes(2);
    expect(posts()).toHaveLength(0);
  });

  test("a failure is toasted, the modal stays open, and what was created is re-read", async () => {
    axiosMock
      .onPost("/api/admin/recruitments/post")
      .reply((config) =>
        config.params.type === "ULA"
          ? [400, { message: "Recruitment already exists" }]
          : [200, { id: 9 }],
      );
    const { onHide, invalidate } = renderModal();
    await userEvent.click(screen.getByTestId("Auto-create"));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Could not create the recruitments: Recruitment already exists",
      ),
    );
    expect(onHide).not.toHaveBeenCalled();
    // The TA recruitment went through before the ULA one failed.
    expect(posts().map((r) => r.params.type)).toEqual(["TA", "ULA"]);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["/api/admin/recruitments/all"],
    });
    expect(screen.getByTestId("Auto-create")).not.toBeDisabled();
  });

  test("the Create button is disabled while the requests are in flight", async () => {
    let release;
    axiosMock
      .onPost("/api/admin/recruitments/post")
      .reply(
        () => new Promise((resolve) => (release = () => resolve([200, {}]))),
      );
    renderModal([recruitment("20271", "TA")]);
    await userEvent.click(screen.getByTestId("Auto-create"));

    await waitFor(() =>
      expect(screen.getByTestId("Auto-create")).toBeDisabled(),
    );
    release();
    await waitFor(() => expect(mockToast).toHaveBeenCalled());
  });

  test("the modal and test ids have defaults and the date defaults to now", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AutoCreateRecruitmentsModal recruitments={[]} onHide={() => {}} />
      </QueryClientProvider>,
    );
    expect(
      screen.getByTestId("AutoCreateRecruitmentsModal-modal"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("AutoCreateRecruitmentsModal-quarter").value,
    ).toMatch(/^\d{4}[124]$/);
  });
});
