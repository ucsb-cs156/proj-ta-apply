import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import NameListCard from "main/components/AppSettings/NameListCard";
import appSettingsFixtures from "fixtures/appSettingsFixtures";
import * as useBackendModule from "main/utils/useBackend";

const useBackendSpy = vi.spyOn(useBackendModule, "useBackend");

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const axiosMock = new AxiosMockAdapter(axios);

const getEndpoint = "/api/admin/settings/ta-majors/all";
const postEndpoint = "/api/admin/settings/ta-majors/post";
const putEndpoint = "/api/admin/settings/ta-majors";
const deleteEndpoint = "/api/admin/settings/ta-majors/delete";

function renderCard() {
  const queryClient = new QueryClient();
  const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
  render(
    <QueryClientProvider client={queryClient}>
      <NameListCard
        title="Majors List for TAs"
        itemLabel="major"
        listKey="ta-majors"
        testIdPrefix="Card"
      />
    </QueryClientProvider>,
  );
  return invalidateQueriesSpy;
}

/** Each write must refresh the list it changed, and nothing else. */
const expectListRefreshed = (invalidateQueriesSpy) =>
  waitFor(() =>
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: [getEndpoint],
    }),
  );

describe("NameListCard tests", () => {
  beforeEach(() => {
    mockToast.mockClear();
    useBackendSpy.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock.onGet(getEndpoint).reply(200, appSettingsFixtures.threeMajors);
  });

  test("shows the title and lists the names from its own endpoint", async () => {
    renderCard();

    expect(screen.getByText("Majors List for TAs")).toBeInTheDocument();
    expect(
      await screen.findByTestId("Card-table-cell-row-0-col-name"),
    ).toHaveTextContent("Computer Engineering");
    expect(
      screen.getByTestId("Card-table-cell-row-2-col-name"),
    ).toHaveTextContent("Statistics and Data Science");
    expect(axiosMock.history.get[0].url).toBe(getEndpoint);
    expect(screen.queryByTestId("Card-empty")).toBeNull();
    expect(useBackendSpy).toHaveBeenCalledWith(
      [getEndpoint],
      { method: "GET", url: getEndpoint },
      [],
    );
    // Rows are addressable, and the name column takes the slack so the buttons hug the right.
    expect(screen.getByTestId("Card-table")).toBeInTheDocument();
    expect(screen.getByTestId("Card-table-row-0")).toBeInTheDocument();
    const nameCell = screen.getByTestId("Card-table-cell-row-0-col-name");
    expect(nameCell).toHaveStyle({ width: "100%" });
    expect(nameCell.nextSibling).toHaveStyle({
      width: "1%",
      whiteSpace: "nowrap",
    });
  });

  test("uses NameListCard as the default test id prefix", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <NameListCard
          title="Majors List for TAs"
          itemLabel="major"
          listKey="ta-majors"
        />
      </QueryClientProvider>,
    );
    expect(
      await screen.findByTestId("NameListCard-table-cell-row-0-col-name"),
    ).toBeInTheDocument();
  });

  test("an empty list says so instead of showing an empty table", async () => {
    axiosMock.onGet(getEndpoint).reply(200, []);
    renderCard();

    expect(await screen.findByTestId("Card-empty")).toHaveTextContent(
      "No majors yet. Add the first one below.",
    );
    expect(screen.queryByTestId("Card-table")).toBeNull();
    // Adding is still possible.
    expect(screen.getByTestId("Card-add-input")).toHaveAttribute(
      "placeholder",
      "New major",
    );
    expect(screen.getByTestId("Card-add-input")).toHaveAttribute(
      "aria-label",
      "New major",
    );
  });

  test("tolerates a non-array response", async () => {
    axiosMock.onGet(getEndpoint).reply(200, { nope: true });
    renderCard();

    expect(await screen.findByTestId("Card-empty")).toBeInTheDocument();
  });

  // ---- add ----

  test("the Add button is disabled until something is typed", async () => {
    renderCard();
    await screen.findByTestId("Card-table-cell-row-0-col-name");

    expect(screen.getByTestId("Card-add-button")).toBeDisabled();
    await userEvent.type(screen.getByTestId("Card-add-input"), "   ");
    expect(screen.getByTestId("Card-add-button")).toBeDisabled();
    await userEvent.type(screen.getByTestId("Card-add-input"), "Math");
    expect(screen.getByTestId("Card-add-button")).toBeEnabled();
  });

  test("adding posts the trimmed name and clears the box", async () => {
    axiosMock.onPost(postEndpoint).reply(200, { name: "Mathematics" });
    const invalidateQueriesSpy = renderCard();
    await screen.findByTestId("Card-table-cell-row-0-col-name");

    await userEvent.type(
      screen.getByTestId("Card-add-input"),
      "  Mathematics ",
    );
    await userEvent.click(screen.getByTestId("Card-add-button"));

    await waitFor(() => expect(axiosMock.history.post.length).toBe(1));
    expect(axiosMock.history.post[0].url).toBe(postEndpoint);
    expect(axiosMock.history.post[0].params).toEqual({ name: "Mathematics" });
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith("Mathematics added"),
    );
    expect(screen.getByTestId("Card-add-input")).toHaveValue("");
    await expectListRefreshed(invalidateQueriesSpy);
  });

  test("submitting the form with Enter also adds", async () => {
    axiosMock.onPost(postEndpoint).reply(200, { name: "Mathematics" });
    renderCard();
    await screen.findByTestId("Card-table-cell-row-0-col-name");

    await userEvent.type(
      screen.getByTestId("Card-add-input"),
      "Mathematics{enter}",
    );

    await waitFor(() => expect(axiosMock.history.post.length).toBe(1));
  });

  /** The button is disabled when blank, but Enter bypasses it, so the handler checks too. */
  test("Enter on an empty box sends nothing", async () => {
    renderCard();
    await screen.findByTestId("Card-table-cell-row-0-col-name");

    await userEvent.type(screen.getByTestId("Card-add-input"), "   {enter}");

    // Give any stray request a chance to appear before asserting there was none.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(axiosMock.history.post.length).toBe(0);
    expect(mockToast).not.toHaveBeenCalled();
  });

  test("a refused add leaves the typed name in place", async () => {
    axiosMock
      .onPost(postEndpoint)
      .reply(400, { message: "Mathematics is already in the list" });
    renderCard();
    await screen.findByTestId("Card-table-cell-row-0-col-name");

    await userEvent.type(screen.getByTestId("Card-add-input"), "Mathematics");
    await userEvent.click(screen.getByTestId("Card-add-button"));

    await waitFor(() => expect(axiosMock.history.post.length).toBe(1));
    await waitFor(() => expect(mockToast).toHaveBeenCalled());
    expect(mockToast).not.toHaveBeenCalledWith("Mathematics added");
    expect(screen.getByTestId("Card-add-input")).toHaveValue("Mathematics");
  });

  // ---- rename ----

  test("Edit turns the row into an input holding the current name", async () => {
    renderCard();
    await screen.findByTestId("Card-table-cell-row-0-col-name");

    await userEvent.click(screen.getByTestId("Card-row-1-edit-button"));

    const input = screen.getByTestId("Card-row-1-edit-input");
    expect(input).toHaveValue("Computer Science");
    expect(input).toHaveAttribute(
      "aria-label",
      "New name for Computer Science",
    );
    expect(screen.getByTestId("Card-row-1-save-button")).toBeInTheDocument();
    expect(screen.getByTestId("Card-row-1-cancel-button")).toBeInTheDocument();
    // Only that row is in edit mode.
    expect(screen.queryByTestId("Card-row-0-edit-input")).toBeNull();
    expect(screen.getByTestId("Card-row-0-edit-button")).toBeInTheDocument();
    expect(screen.queryByTestId("Card-row-1-edit-button")).toBeNull();
    expect(screen.queryByTestId("Card-row-1-delete-button")).toBeNull();
  });

  test("Save puts the old and trimmed new name", async () => {
    axiosMock.onPut(putEndpoint).reply(200, { name: "CS" });
    const invalidateQueriesSpy = renderCard();
    await screen.findByTestId("Card-table-cell-row-0-col-name");

    await userEvent.click(screen.getByTestId("Card-row-1-edit-button"));
    const input = screen.getByTestId("Card-row-1-edit-input");
    await userEvent.clear(input);
    await userEvent.type(input, " CS ");
    await userEvent.click(screen.getByTestId("Card-row-1-save-button"));

    await waitFor(() => expect(axiosMock.history.put.length).toBe(1));
    expect(axiosMock.history.put[0].url).toBe(putEndpoint);
    expect(axiosMock.history.put[0].params).toEqual({
      name: "Computer Science",
      newName: "CS",
    });
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith("Renamed to CS"),
    );
    // Back out of edit mode.
    await waitFor(() =>
      expect(screen.queryByTestId("Card-row-1-edit-input")).toBeNull(),
    );
    await expectListRefreshed(invalidateQueriesSpy);
  });

  test("Save is disabled while the new name is blank", async () => {
    renderCard();
    await screen.findByTestId("Card-table-cell-row-0-col-name");

    await userEvent.click(screen.getByTestId("Card-row-1-edit-button"));
    await userEvent.clear(screen.getByTestId("Card-row-1-edit-input"));
    expect(screen.getByTestId("Card-row-1-save-button")).toBeDisabled();
    await userEvent.type(screen.getByTestId("Card-row-1-edit-input"), "  ");
    expect(screen.getByTestId("Card-row-1-save-button")).toBeDisabled();
  });

  test("Cancel leaves the row unchanged and sends nothing", async () => {
    renderCard();
    await screen.findByTestId("Card-table-cell-row-0-col-name");

    await userEvent.click(screen.getByTestId("Card-row-1-edit-button"));
    await userEvent.type(screen.getByTestId("Card-row-1-edit-input"), "X");
    await userEvent.click(screen.getByTestId("Card-row-1-cancel-button"));

    expect(screen.queryByTestId("Card-row-1-edit-input")).toBeNull();
    expect(
      screen.getByTestId("Card-table-cell-row-1-col-name"),
    ).toHaveTextContent("Computer Science");
    expect(axiosMock.history.put.length).toBe(0);
  });

  test("a refused rename stays in edit mode", async () => {
    axiosMock
      .onPut(putEndpoint)
      .reply(400, { message: "Statistics is already in the list" });
    renderCard();
    await screen.findByTestId("Card-table-cell-row-0-col-name");

    await userEvent.click(screen.getByTestId("Card-row-1-edit-button"));
    await userEvent.click(screen.getByTestId("Card-row-1-save-button"));

    await waitFor(() => expect(axiosMock.history.put.length).toBe(1));
    await waitFor(() => expect(mockToast).toHaveBeenCalled());
    expect(screen.getByTestId("Card-row-1-edit-input")).toBeInTheDocument();
  });

  // ---- delete ----

  test("Delete removes by name and shows the backend's message", async () => {
    axiosMock.onDelete(deleteEndpoint).reply(200, {
      message: "Statistics and Data Science removed from ta-majors",
    });
    const invalidateQueriesSpy = renderCard();
    await screen.findByTestId("Card-table-cell-row-0-col-name");

    await userEvent.click(screen.getByTestId("Card-row-2-delete-button"));

    await waitFor(() => expect(axiosMock.history.delete.length).toBe(1));
    expect(axiosMock.history.delete[0].url).toBe(deleteEndpoint);
    expect(axiosMock.history.delete[0].params).toEqual({
      name: "Statistics and Data Science",
    });
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Statistics and Data Science removed from ta-majors",
      ),
    );
    await expectListRefreshed(invalidateQueriesSpy);
  });
});
