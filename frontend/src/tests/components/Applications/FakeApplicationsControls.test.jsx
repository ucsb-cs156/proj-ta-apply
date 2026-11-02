import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import FakeApplicationsControls from "main/components/Applications/FakeApplicationsControls";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const axiosMock = new AxiosMockAdapter(axios);
const url = "/api/admin/developer/fakeApplications";

function renderControls(courseCount = 5) {
  const queryClient = new QueryClient();
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <FakeApplicationsControls
          recruitmentId="7"
          courseCount={courseCount}
          testIdPrefix="Fake"
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return invalidate;
}

describe("FakeApplicationsControls tests", () => {
  beforeEach(() => {
    mockToast.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
  });

  test("offers a create and a delete button", () => {
    renderControls();
    expect(screen.getByTestId("Fake-create")).toHaveTextContent(
      "Create Fake Applications",
    );
    expect(screen.getByTestId("Fake-delete")).toHaveTextContent(
      "Delete Fake Applications",
    );
  });

  test("the create form proposes two per course, the least allowed, and states the range", async () => {
    renderControls(5);
    await userEvent.click(screen.getByTestId("Fake-create"));

    expect(screen.getByTestId("Fake-count")).toHaveValue(10);
    expect(screen.getByTestId("Fake-count")).toHaveAttribute("min", "10");
    expect(screen.getByTestId("Fake-count")).toHaveAttribute("max", "50");
    expect(screen.getByTestId("Fake-count-help")).toHaveTextContent(
      "Between 10 and 50: 2 to 10 for each of this recruitment's 5 courses.",
    );
    expect(screen.getByTestId("Fake-coverage-all")).toBeChecked();
    expect(screen.getByTestId("Fake-coverage-sparse")).not.toBeChecked();
  });

  test("the help says course in the singular for one course", async () => {
    renderControls(1);
    await userEvent.click(screen.getByTestId("Fake-create"));
    expect(screen.getByTestId("Fake-count-help")).toHaveTextContent(
      "Between 2 and 10: 2 to 10 for each of this recruitment's 1 course.",
    );
  });

  test("Create is disabled until the count is a whole number in range", async () => {
    renderControls(5);
    await userEvent.click(screen.getByTestId("Fake-create"));
    const count = screen.getByTestId("Fake-count");
    const create = screen.getByTestId("Fake-create-confirm");

    expect(create).toBeEnabled();
    for (const bad of ["9", "51", "", "20.5"]) {
      await userEvent.clear(count);
      if (bad !== "") await userEvent.type(count, bad);
      expect(create).toBeDisabled();
    }
    for (const good of ["10", "50", "33"]) {
      await userEvent.clear(count);
      await userEvent.type(count, good);
      expect(create).toBeEnabled();
    }
  });

  test("creating sends the count and coverage, then says a job is running", async () => {
    axiosMock.onPost(url).reply(200, { id: 3 });
    const invalidate = renderControls(5);
    await userEvent.click(screen.getByTestId("Fake-create"));
    await userEvent.clear(screen.getByTestId("Fake-count"));
    await userEvent.type(screen.getByTestId("Fake-count"), "20");
    await userEvent.click(screen.getByTestId("Fake-coverage-sparse"));
    await userEvent.click(screen.getByTestId("Fake-create-confirm"));

    await screen.findByText("Fake applications are being entered");
    expect(axiosMock.history.post).toHaveLength(1);
    expect(axiosMock.history.post[0].params).toEqual({
      recruitmentId: "7",
      count: 20,
      coverage: "SPARSE",
    });
    expect(screen.getByTestId("Fake-jobs-link")).toHaveAttribute(
      "href",
      "/admin/jobs",
    );
    await waitFor(() =>
      expect(screen.queryByTestId("Fake-count")).not.toBeInTheDocument(),
    );

    await userEvent.click(screen.getByTestId("Fake-launched-close"));
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["/api/admin/applications/all"],
      }),
    );
  });

  test("cancelling the create form sends nothing", async () => {
    renderControls();
    await userEvent.click(screen.getByTestId("Fake-create"));
    await userEvent.click(screen.getByTestId("Fake-create-cancel"));

    await waitFor(() =>
      expect(screen.queryByTestId("Fake-count")).not.toBeInTheDocument(),
    );
    expect(axiosMock.history.post).toHaveLength(0);
  });

  test("a recruitment with no courses cannot be given applicants", async () => {
    renderControls(0);
    await userEvent.click(screen.getByTestId("Fake-create"));

    expect(screen.getByTestId("Fake-no-courses")).toBeInTheDocument();
    expect(screen.queryByTestId("Fake-count")).not.toBeInTheDocument();
    expect(screen.getByTestId("Fake-create-confirm")).toBeDisabled();
  });

  test("a refused create toasts the backend's reason and keeps the form open", async () => {
    axiosMock
      .onPost(url)
      .reply(400, { type: "IllegalArgumentException", message: "Too many" });
    renderControls(5);
    await userEvent.click(screen.getByTestId("Fake-create"));
    await userEvent.click(screen.getByTestId("Fake-create-confirm"));

    await waitFor(() => expect(mockToast).toHaveBeenCalledWith("Too many"));
    expect(screen.getByTestId("Fake-count")).toBeInTheDocument();
  });

  test("deleting asks first, then reports how many were deleted", async () => {
    axiosMock.onDelete(url).reply(200, { deleted: 12 });
    const invalidate = renderControls();
    await userEvent.click(screen.getByTestId("Fake-delete"));
    expect(axiosMock.history.delete).toHaveLength(0);
    await userEvent.click(screen.getByTestId("Fake-delete-confirm"));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith("Deleted 12 fake applications."),
    );
    expect(axiosMock.history.delete[0].params).toEqual({ recruitmentId: "7" });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["/api/admin/applications/all"],
    });
  });

  test("one deleted application is singular", async () => {
    axiosMock.onDelete(url).reply(200, { deleted: 1 });
    renderControls();
    await userEvent.click(screen.getByTestId("Fake-delete"));
    await userEvent.click(screen.getByTestId("Fake-delete-confirm"));
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith("Deleted 1 fake application."),
    );
  });

  test("keeping them closes the confirmation without deleting", async () => {
    renderControls();
    await userEvent.click(screen.getByTestId("Fake-delete"));
    await userEvent.click(screen.getByTestId("Fake-delete-cancel"));

    await waitFor(() =>
      expect(
        screen.queryByTestId("Fake-delete-confirm"),
      ).not.toBeInTheDocument(),
    );
    expect(axiosMock.history.delete).toHaveLength(0);
  });

  test("a refused delete toasts the backend's reason", async () => {
    axiosMock
      .onDelete(url)
      .reply(404, { type: "EntityNotFoundException", message: "Not on" });
    renderControls();
    await userEvent.click(screen.getByTestId("Fake-delete"));
    await userEvent.click(screen.getByTestId("Fake-delete-confirm"));

    await waitFor(() => expect(mockToast).toHaveBeenCalledWith("Not on"));
  });

  test("no form or confirmation is showing until a button is pressed", () => {
    renderControls();
    for (const name of ["create-modal", "launched-modal", "delete-modal"]) {
      expect(screen.queryByTestId(`Fake-${name}`)).not.toBeInTheDocument();
    }
  });

  test("each form and confirmation is a modal of its own", async () => {
    axiosMock.onPost(url).reply(200, { id: 3 });
    renderControls();

    await userEvent.click(screen.getByTestId("Fake-create"));
    expect(screen.getByTestId("Fake-create-modal")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("Fake-create-confirm"));
    expect(
      await screen.findByTestId("Fake-launched-modal"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("Fake-launched-modal")).toHaveTextContent(
      "Fake applications are being entered; see the Jobs page for details. Refresh the page a few times, and they should all appear.",
    );
    await userEvent.click(screen.getByTestId("Fake-launched-close"));
    await waitFor(() =>
      expect(
        screen.queryByTestId("Fake-launched-modal"),
      ).not.toBeInTheDocument(),
    );

    await userEvent.click(screen.getByTestId("Fake-delete"));
    expect(screen.getByTestId("Fake-delete-modal")).toBeInTheDocument();
  });

  test("the x in the corner closes the create form and the delete confirmation", async () => {
    renderControls();

    await userEvent.click(screen.getByTestId("Fake-create"));
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() =>
      expect(screen.queryByTestId("Fake-count")).not.toBeInTheDocument(),
    );

    await userEvent.click(screen.getByTestId("Fake-delete"));
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() =>
      expect(
        screen.queryByTestId("Fake-delete-confirm"),
      ).not.toBeInTheDocument(),
    );
  });

  test("the x in the corner closes the job notice too", async () => {
    axiosMock.onPost(url).reply(200, { id: 3 });
    const invalidate = renderControls();
    await userEvent.click(screen.getByTestId("Fake-create"));
    await userEvent.click(screen.getByTestId("Fake-create-confirm"));
    await screen.findByTestId("Fake-launched-modal");

    await userEvent.click(
      within(screen.getByTestId("Fake-launched-modal")).getAllByRole("button", {
        name: "Close",
      })[0],
    );

    await waitFor(() =>
      expect(
        screen.queryByTestId("Fake-launched-modal"),
      ).not.toBeInTheDocument(),
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["/api/admin/applications/all"],
    });
  });

  test("reopening the form starts again from the proposal", async () => {
    renderControls(5);
    await userEvent.click(screen.getByTestId("Fake-create"));
    await userEvent.clear(screen.getByTestId("Fake-count"));
    await userEvent.type(screen.getByTestId("Fake-count"), "44");
    await userEvent.click(screen.getByTestId("Fake-coverage-sparse"));
    await userEvent.click(screen.getByTestId("Fake-create-cancel"));
    await waitFor(() =>
      expect(screen.queryByTestId("Fake-count")).not.toBeInTheDocument(),
    );

    await userEvent.click(screen.getByTestId("Fake-create"));

    expect(screen.getByTestId("Fake-count")).toHaveValue(10);
    expect(screen.getByTestId("Fake-coverage-all")).toBeChecked();
    expect(screen.getByTestId("Fake-coverage-sparse")).not.toBeChecked();
  });

  test("a count out of range is marked invalid and one in range is not", async () => {
    renderControls(5);
    await userEvent.click(screen.getByTestId("Fake-create"));
    const count = screen.getByTestId("Fake-count");

    expect(count).not.toHaveClass("is-invalid");
    await userEvent.clear(count);
    await userEvent.type(count, "9");
    expect(count).toHaveClass("is-invalid");
  });

  test("the confirmation goes away once the delete has gone through", async () => {
    axiosMock.onDelete(url).reply(200, { deleted: 2 });
    renderControls();
    await userEvent.click(screen.getByTestId("Fake-delete"));
    await userEvent.click(screen.getByTestId("Fake-delete-confirm"));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith("Deleted 2 fake applications."),
    );
    await waitFor(() =>
      expect(
        screen.queryByTestId("Fake-delete-confirm"),
      ).not.toBeInTheDocument(),
    );
  });

  test("the two coverage choices are radio buttons worded as the design has them", async () => {
    axiosMock.onPost(url).reply(200, { id: 3 });
    renderControls(5);
    await userEvent.click(screen.getByTestId("Fake-create"));

    expect(
      screen.getByLabelText(
        "Cover all courses with a reasonable number of applicants",
      ),
    ).toBe(screen.getByTestId("Fake-coverage-all"));
    expect(
      screen.getByLabelText("Leave some courses with few or no applicants"),
    ).toBe(screen.getByTestId("Fake-coverage-sparse"));
    expect(screen.getByTestId("Fake-coverage-all")).toHaveAttribute(
      "type",
      "radio",
    );

    // Choosing sparse and then all again sends all.
    expect(screen.getByTestId("Fake-coverage-sparse")).not.toBeChecked();
    await userEvent.click(screen.getByTestId("Fake-coverage-sparse"));
    expect(screen.getByTestId("Fake-coverage-sparse")).toBeChecked();
    expect(screen.getByTestId("Fake-coverage-all")).not.toBeChecked();
    await userEvent.click(screen.getByTestId("Fake-coverage-all"));
    expect(screen.getByTestId("Fake-coverage-sparse")).not.toBeChecked();
    await userEvent.click(screen.getByTestId("Fake-create-confirm"));

    await waitFor(() => expect(axiosMock.history.post).toHaveLength(1));
    expect(axiosMock.history.post[0].params).toEqual({
      recruitmentId: "7",
      count: 10,
      coverage: "ALL",
    });
  });
});
