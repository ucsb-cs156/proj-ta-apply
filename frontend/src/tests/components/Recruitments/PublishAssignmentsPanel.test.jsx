import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import PublishAssignmentsPanel from "main/components/Recruitments/PublishAssignmentsPanel";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const axiosMock = new AxiosMockAdapter(axios);

// W26 TA (id 1), unpublished; W26 ULA (id 2).
const taRecruitment = recruitmentsFixtures.threeRecruitments[2];
const ulaRecruitment = recruitmentsFixtures.threeRecruitments[1];

function renderPanel(recruitment = taRecruitment, prefix = "Panel") {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <PublishAssignmentsPanel
          recruitment={recruitment}
          testIdPrefix={prefix}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const puts = () =>
  axiosMock.history.put.filter(
    (r) => r.url === "/api/admin/recruitments/assignmentsPublished",
  );

describe("PublishAssignmentsPanel tests", () => {
  beforeEach(() => {
    mockToast.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock
      .onPut("/api/admin/recruitments/assignmentsPublished")
      .reply(200, { ...taRecruitment, assignmentsPublished: true });
  });

  test("unpublished: a button, no modal, and the default test id", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <PublishAssignmentsPanel recruitment={taRecruitment} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByTestId("PublishAssignmentsPanel")).toHaveClass("mt-4");
    const button = screen.getByTestId("PublishAssignmentsPanel-button");
    expect(button).toHaveTextContent("Publish Assignments");
    expect(button).toHaveClass("btn-outline-dark");
    expect(
      screen.queryByTestId("PublishAssignmentsPanel-modal"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("PublishAssignmentsPanel-published"),
    ).not.toBeInTheDocument();
  });

  test("a missing flag counts as unpublished", () => {
    const { assignmentsPublished: _omitted, ...legacy } = taRecruitment;
    renderPanel(legacy);
    expect(screen.getByTestId("Panel-button")).toBeInTheDocument();
  });

  test("the button opens the modal with the design's text for the type", async () => {
    renderPanel(ulaRecruitment);

    await userEvent.click(screen.getByTestId("Panel-button"));

    const modal = await screen.findByTestId("Panel-modal");
    expect(within(modal).getByText("Publish Assignments")).toHaveClass(
      "modal-title",
    );
    const paragraphs = [...modal.querySelectorAll(".modal-body p")].map(
      (p) => p.textContent,
    );
    expect(paragraphs).toEqual([
      "Proceeding will create a new page that shows the table of Assignments, with all courses, and information about the ULAs hired, and make this available to admins and faculty. It will also unlock the ability to download a CSV file of assignments to pass off to the financial office to start hiring paperwork.",
      "It is still possible to update assignments after this point, but it's best to wait on this step until most assignments are finalized.",
      "Proceed?",
    ]);
    expect(modal.querySelectorAll(".modal-body p")[2]).toHaveClass("mb-0");
    expect(modal.querySelectorAll(".modal-body p")[0]).not.toHaveClass("mb-0");
    expect(screen.getByTestId("Panel-confirm")).toHaveTextContent("Yes");
    expect(screen.getByTestId("Panel-confirm")).toHaveClass("btn-primary");
    expect(screen.getByTestId("Panel-cancel")).toHaveTextContent("No");
    expect(screen.getByTestId("Panel-cancel")).toHaveClass("btn-secondary");
    expect(document.querySelector(".modal-dialog")).toHaveClass(
      "modal-dialog-centered",
    );
  });

  test("Yes publishes, toasts and closes the modal", async () => {
    renderPanel();
    await userEvent.click(screen.getByTestId("Panel-button"));
    await screen.findByTestId("Panel-modal");

    await userEvent.click(screen.getByTestId("Panel-confirm"));

    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0].params).toEqual({ id: 1, published: true });
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith("Assignments published."),
    );
    await waitFor(() =>
      expect(screen.queryByTestId("Panel-modal")).not.toBeInTheDocument(),
    );
  });

  test("No closes the modal and publishes nothing", async () => {
    renderPanel();
    await userEvent.click(screen.getByTestId("Panel-button"));
    await screen.findByTestId("Panel-modal");

    await userEvent.click(screen.getByTestId("Panel-cancel"));

    await waitFor(() =>
      expect(screen.queryByTestId("Panel-modal")).not.toBeInTheDocument(),
    );
    expect(puts()).toHaveLength(0);
    expect(mockToast).not.toHaveBeenCalled();
  });

  test("the close button in the header closes the modal too", async () => {
    renderPanel();
    await userEvent.click(screen.getByTestId("Panel-button"));
    const modal = await screen.findByTestId("Panel-modal");

    await userEvent.click(within(modal).getByLabelText("Close"));

    await waitFor(() =>
      expect(screen.queryByTestId("Panel-modal")).not.toBeInTheDocument(),
    );
    expect(puts()).toHaveLength(0);
  });

  test("a refused publish shows the backend's message in the modal, which stays open, with no toast", async () => {
    axiosMock.onPut("/api/admin/recruitments/assignmentsPublished").reply(400, {
      message: "Assign candidates to slots before releasing hiring decisions.",
    });
    renderPanel();
    await userEvent.click(screen.getByTestId("Panel-button"));
    await screen.findByTestId("Panel-modal");
    expect(screen.queryByTestId("Panel-refusal")).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId("Panel-confirm"));

    const refusal = await screen.findByTestId("Panel-refusal");
    expect(refusal).toHaveTextContent(
      "Assign candidates to slots before releasing hiring decisions.",
    );
    expect(refusal).toHaveClass("alert-danger");
    expect(mockToast).not.toHaveBeenCalled();
    expect(screen.getByTestId("Panel-modal")).toBeInTheDocument();
    expect(screen.getByTestId("Panel-confirm")).not.toBeDisabled();
  });

  test("trying again clears the message while it runs, and a success closes the modal", async () => {
    let release;
    axiosMock.reset();
    axiosMock
      .onPut("/api/admin/recruitments/assignmentsPublished")
      .replyOnce(400, {
        message:
          "Assign candidates to slots before releasing hiring decisions.",
      })
      .onPut("/api/admin/recruitments/assignmentsPublished")
      .reply(
        () =>
          new Promise((resolve) => {
            release = () =>
              resolve([200, { ...taRecruitment, assignmentsPublished: true }]);
          }),
      );
    renderPanel();
    await userEvent.click(screen.getByTestId("Panel-button"));
    await userEvent.click(await screen.findByTestId("Panel-confirm"));
    await screen.findByTestId("Panel-refusal");

    await userEvent.click(screen.getByTestId("Panel-confirm"));

    // The second request is still running: the old message is already gone.
    await waitFor(() => expect(puts()).toHaveLength(2));
    expect(screen.queryByTestId("Panel-refusal")).not.toBeInTheDocument();
    release();
    await waitFor(() =>
      expect(screen.queryByTestId("Panel-modal")).not.toBeInTheDocument(),
    );
    expect(mockToast).toHaveBeenCalledWith("Assignments published.");
  });

  test("a message from an earlier try is not there when the modal is opened again", async () => {
    axiosMock.onPut("/api/admin/recruitments/assignmentsPublished").reply(400, {
      message: "Assign candidates to slots before releasing hiring decisions.",
    });
    renderPanel();
    await userEvent.click(screen.getByTestId("Panel-button"));
    await userEvent.click(await screen.findByTestId("Panel-confirm"));
    await screen.findByTestId("Panel-refusal");
    await userEvent.click(screen.getByTestId("Panel-cancel"));
    await waitFor(() =>
      expect(screen.queryByTestId("Panel-modal")).not.toBeInTheDocument(),
    );

    await userEvent.click(screen.getByTestId("Panel-button"));

    await screen.findByTestId("Panel-modal");
    expect(screen.queryByTestId("Panel-refusal")).not.toBeInTheDocument();
  });

  test("ranking still open: the reason is shown up front, Yes is disabled and nothing is sent", async () => {
    const open = { ...taRecruitment, reviewStatus: "Open" };
    renderPanel(open);
    await userEvent.click(screen.getByTestId("Panel-button"));
    await screen.findByTestId("Panel-modal");

    expect(screen.getByTestId("Panel-refusal")).toHaveTextContent(
      "Close Faculty Ranking before releasing hiring decisions.",
    );
    expect(screen.getByTestId("Panel-confirm")).toBeDisabled();
    await userEvent.click(screen.getByTestId("Panel-confirm"));
    expect(puts()).toHaveLength(0);
  });

  test("ranking never started is also named first", async () => {
    renderPanel({ ...taRecruitment, reviewStatus: "NotStarted" });
    await userEvent.click(screen.getByTestId("Panel-button"));
    expect(await screen.findByTestId("Panel-refusal")).toHaveTextContent(
      "Close Faculty Ranking before releasing hiring decisions.",
    );
  });

  test("applications still open: that reason is shown up front and Yes is disabled", async () => {
    renderPanel({
      ...taRecruitment,
      reviewStatus: "Closed",
      applicationStatus: "OPEN",
    });
    await userEvent.click(screen.getByTestId("Panel-button"));
    await screen.findByTestId("Panel-modal");

    expect(screen.getByTestId("Panel-refusal")).toHaveTextContent(
      "Close Applications before releasing hiring decisions.",
    );
    expect(screen.getByTestId("Panel-confirm")).toBeDisabled();
  });

  test("ranking and applications both closed: no message and Yes is enabled", async () => {
    renderPanel({
      ...taRecruitment,
      reviewStatus: "Closed",
      applicationStatus: "CLOSED",
    });
    await userEvent.click(screen.getByTestId("Panel-button"));
    await screen.findByTestId("Panel-modal");

    expect(screen.queryByTestId("Panel-refusal")).not.toBeInTheDocument();
    expect(screen.getByTestId("Panel-confirm")).not.toBeDisabled();
  });

  test("published: the line and link instead of the button", () => {
    renderPanel({ ...taRecruitment, assignmentsPublished: true });

    const line = screen.getByTestId("Panel-published");
    expect(line).toHaveTextContent(
      "Assignments are published. Open the assignments page.",
    );
    expect(line).toHaveClass("mt-4");
    expect(
      within(line).getByRole("link", { name: "Open the assignments page" }),
    ).toHaveAttribute("href", "/recruitments/1/assignments");
    expect(screen.queryByTestId("Panel-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("Panel")).not.toBeInTheDocument();
  });
});
