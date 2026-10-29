import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import LegacyApplicationsUploadCard from "main/components/Applications/LegacyApplicationsUploadCard";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const axiosMock = new AxiosMockAdapter(axios);
const uploadUrl = "/api/admin/applications/legacy/upload";

function renderCard(recruitments = recruitmentsFixtures.threeRecruitments) {
  axiosMock.onGet("/api/admin/recruitments/all").reply(200, recruitments);
  const queryClient = new QueryClient();
  const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LegacyApplicationsUploadCard testIdPrefix="Card" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return invalidateQueriesSpy;
}

const csv = () =>
  new File(
    ["email,first_name,last_name\nada@ucsb.edu,Ada,Lovelace\n"],
    "legacy.csv",
    {
      type: "text/csv",
    },
  );

describe("LegacyApplicationsUploadCard tests", () => {
  beforeEach(() => {
    mockToast.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
  });

  test("explains itself, links to the help page and offers the TA quarters, newest first", async () => {
    renderCard();

    expect(screen.getByTestId("Card")).toHaveClass("card");
    expect(
      screen.getByRole("heading", { name: "Import Legacy TA Applications" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("Card-about")).toHaveTextContent(
      "Each row becomes an application as if the student had entered it",
    );
    expect(screen.getByTestId("Card-about")).toHaveTextContent(
      "Rows for students who already have an application in that recruitment are skipped, so re-uploading is safe.",
    );
    expect(screen.getByTestId("Card-help-link")).toHaveAttribute(
      "href",
      "/help/csv#legacy-ta-applications",
    );
    const select = await screen.findByTestId("Card-quarter");
    await waitFor(() => expect(select.options.length).toBe(3));
    expect([...select.options].map((o) => o.textContent)).toEqual([
      "Choose the TA recruitment's quarter",
      "S26",
      "W26",
    ]);
    expect([...select.options].map((o) => o.value)).toEqual([
      "",
      "20262",
      "20261",
    ]);
    expect(screen.queryByTestId("Card-none")).toBeNull();
  });

  test("with no TA recruitment there is nothing to import into", async () => {
    renderCard([recruitmentsFixtures.threeRecruitments[1]]);

    expect(await screen.findByTestId("Card-none")).toHaveTextContent(
      "There are no TA recruitments yet. Create one for the quarter under Admin > Recruitments first.",
    );
    expect(screen.queryByTestId("Card-quarter")).toBeNull();
    expect(screen.queryByTestId("Card-button")).toBeNull();
  });

  test("Import is disabled until both a quarter and a file are chosen", async () => {
    renderCard();
    const select = await screen.findByTestId("Card-quarter");
    await waitFor(() => expect(select.options.length).toBe(3));
    const button = screen.getByTestId("Card-button");
    expect(button).toBeDisabled();

    // A file alone is not enough: no quarter is chosen yet.
    await userEvent.upload(screen.getByTestId("Card-file"), csv());
    expect(button).toBeDisabled();
    await userEvent.selectOptions(select, "20261");
    expect(button).toBeEnabled();
    await userEvent.selectOptions(select, "");
    expect(button).toBeDisabled();
  });

  test("importing posts the file and quarter, reports the result, clears the file and refreshes the lists", async () => {
    axiosMock.onPost(uploadUrl).reply(200, {
      inserted: 2,
      alreadyPresent: 1,
      skipped: 1,
      problems: ["row 4: no usable email address"],
    });
    const invalidateQueriesSpy = renderCard();
    const select = await screen.findByTestId("Card-quarter");
    await waitFor(() => expect(select.options.length).toBe(3));
    const file = csv();

    await userEvent.selectOptions(select, "20261");
    await userEvent.upload(screen.getByTestId("Card-file"), file);
    await userEvent.click(screen.getByTestId("Card-button"));

    await waitFor(() => expect(axiosMock.history.post.length).toBe(1));
    const request = axiosMock.history.post[0];
    expect(request.url).toBe(uploadUrl);
    expect(request.params).toEqual({ quarter: "20261" });
    expect(request.headers["Content-Type"]).toBe("multipart/form-data");
    expect(request.data).toBeInstanceOf(FormData);
    expect(request.data.get("file")).toBe(file);

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Import complete: 2 applications added, 1 already present, 1 row skipped (row 4: no usable email address)",
      ),
    );
    expect(screen.getByTestId("Card-button")).toBeDisabled();
    expect(screen.getByTestId("Card-file").value).toBe("");
    // The quarter stays chosen, for the next file.
    expect(select.value).toBe("20261");
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ["/api/admin/applications/all"],
    });
  });

  test("a refused import keeps the chosen file", async () => {
    axiosMock.onPost(uploadUrl).reply(400, {
      message:
        "There is no TA recruitment for W26; create it under Admin > Recruitments first",
    });
    renderCard();
    const select = await screen.findByTestId("Card-quarter");
    await waitFor(() => expect(select.options.length).toBe(3));

    await userEvent.selectOptions(select, "20261");
    await userEvent.upload(screen.getByTestId("Card-file"), csv());
    await userEvent.click(screen.getByTestId("Card-button"));

    await waitFor(() => expect(axiosMock.history.post.length).toBe(1));
    await waitFor(() => expect(mockToast).toHaveBeenCalled());
    expect(mockToast).not.toHaveBeenCalledWith(
      expect.stringContaining("Import complete"),
    );
    expect(screen.getByTestId("Card-button")).toBeEnabled();
  });
});
