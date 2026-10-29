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

function renderCard(
  recruitments = recruitmentsFixtures.threeRecruitments,
  type = undefined,
) {
  axiosMock.onGet("/api/admin/recruitments/all").reply(200, recruitments);
  const queryClient = new QueryClient();
  const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LegacyApplicationsUploadCard testIdPrefix="Card" type={type} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return invalidateQueriesSpy;
}
const ulaUploadUrl = "/api/admin/applications/legacy-ula/upload";

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
    expect(screen.getByText("Legacy CSV export")).toBeInTheDocument();
    // Nothing has been imported, so no added-topics modal.
    expect(screen.queryByTestId("Card-added-topics-modal")).toBeNull();
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
      addedTopics: [],
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
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ["/api/admin/settings/ta-topics/all"],
    });
    // Nothing was added to the topics list, so no modal.
    expect(screen.queryByTestId("Card-added-topics-modal")).toBeNull();
  });

  test("topics the import added to the TA topics list are shown in a modal until dismissed", async () => {
    axiosMock.onPost(uploadUrl).reply(200, {
      inserted: 3,
      alreadyPresent: 0,
      skipped: 0,
      problems: [],
      addedTopics: ["Python", "Unix/Linux"],
    });
    renderCard();
    const select = await screen.findByTestId("Card-quarter");
    await waitFor(() => expect(select.options.length).toBe(3));
    await userEvent.selectOptions(select, "20261");
    await userEvent.upload(screen.getByTestId("Card-file"), csv());
    await userEvent.click(screen.getByTestId("Card-button"));

    const modal = await screen.findByTestId("Card-added-topics-modal");
    expect(modal).toHaveTextContent("Topics added to the TA topics list");
    expect(modal).toHaveTextContent(
      "The imported applications rated these topics, which were not on the TA topics list, so the import added them.",
    );
    const items = [
      ...screen.getByTestId("Card-added-topics").querySelectorAll("li"),
    ];
    expect(items.map((li) => li.textContent)).toEqual(["Python", "Unix/Linux"]);

    await userEvent.click(screen.getByTestId("Card-added-topics-dismiss"));
    await waitFor(() =>
      expect(screen.queryByTestId("Card-added-topics-modal")).toBeNull(),
    );
  });

  test("the added-topics modal also closes from its corner button", async () => {
    axiosMock.onPost(uploadUrl).reply(200, {
      inserted: 1,
      alreadyPresent: 0,
      skipped: 0,
      problems: [],
      addedTopics: ["Rust"],
    });
    renderCard();
    const select = await screen.findByTestId("Card-quarter");
    await waitFor(() => expect(select.options.length).toBe(3));
    await userEvent.selectOptions(select, "20261");
    await userEvent.upload(screen.getByTestId("Card-file"), csv());
    await userEvent.click(screen.getByTestId("Card-button"));

    const modal = await screen.findByTestId("Card-added-topics-modal");
    await userEvent.click(modal.querySelector(".btn-close"));
    await waitFor(() =>
      expect(screen.queryByTestId("Card-added-topics-modal")).toBeNull(),
    );
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

  // ---- the ULA form's responses (issue #70) ----

  describe("in ULA mode", () => {
    test("is worded for the ULA form, links to its help section and offers the ULA quarters", async () => {
      renderCard(recruitmentsFixtures.threeRecruitments, "ULA");

      expect(
        screen.getByRole("heading", { name: "Import ULA Form Responses" }),
      ).toBeInTheDocument();
      expect(screen.getByTestId("Card-about")).toHaveTextContent(
        "Upload the ULA application Google Form's response sheet, downloaded as CSV, into one quarter's ULA recruitment.",
      );
      expect(screen.getByTestId("Card-about")).toHaveTextContent(
        "Familiarity topics and activities not yet on the ULA lists are added to them.",
      );
      expect(screen.getByTestId("Card-help-link")).toHaveAttribute(
        "href",
        "/help/csv#legacy-ula-applications",
      );
      const select = await screen.findByTestId("Card-quarter");
      await waitFor(() => expect(select.options.length).toBe(2));
      expect(screen.getByText("Form responses CSV")).toBeInTheDocument();
      expect([...select.options].map((o) => o.textContent)).toEqual([
        "Choose the ULA recruitment's quarter",
        "W26",
      ]);
    });

    test("with no ULA recruitment there is nothing to import into", async () => {
      renderCard([recruitmentsFixtures.threeRecruitments[0]], "ULA");

      expect(await screen.findByTestId("Card-none")).toHaveTextContent(
        "There are no ULA recruitments yet. Create one for the quarter under Admin > Recruitments first.",
      );
    });

    test("posts to the ULA endpoint, refreshes both ULA lists, and lists added topics and interests", async () => {
      axiosMock.onPost(ulaUploadUrl).reply(200, {
        inserted: 82,
        alreadyPresent: 0,
        skipped: 0,
        problems: [],
        addedTopics: ["Jupyter Notebooks", "React"],
        addedInterests: ["Exploring teaching as a career option"],
      });
      const invalidateQueriesSpy = renderCard(
        recruitmentsFixtures.threeRecruitments,
        "ULA",
      );
      const select = await screen.findByTestId("Card-quarter");
      await waitFor(() => expect(select.options.length).toBe(2));
      await userEvent.selectOptions(select, "20261");
      await userEvent.upload(screen.getByTestId("Card-file"), csv());
      await userEvent.click(screen.getByTestId("Card-button"));

      await waitFor(() => expect(axiosMock.history.post.length).toBe(1));
      expect(axiosMock.history.post[0].url).toBe(ulaUploadUrl);
      expect(axiosMock.history.post[0].params).toEqual({ quarter: "20261" });
      await waitFor(() =>
        expect(mockToast).toHaveBeenCalledWith(
          "Import complete: 82 applications added, 0 already present, 0 rows skipped",
        ),
      );
      for (const key of [
        "/api/admin/applications/all",
        "/api/admin/settings/ula-topics/all",
        "/api/admin/settings/ula-interests/all",
      ]) {
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: [key] });
      }
      const modal = await screen.findByTestId("Card-added-topics-modal");
      expect(modal).toHaveTextContent("Added to the ULA lists");
      expect(modal).toHaveTextContent(
        "which were not on the ULA topics or interests lists, so the import added them",
      );
      expect(
        screen.getByRole("heading", { name: "Topics" }),
      ).toBeInTheDocument();
      expect(
        [...screen.getByTestId("Card-added-topics").querySelectorAll("li")].map(
          (li) => li.textContent,
        ),
      ).toEqual(["Jupyter Notebooks", "React"]);
      expect(
        screen.getByRole("heading", { name: "Interests" }),
      ).toBeInTheDocument();
      expect(
        [
          ...screen.getByTestId("Card-added-interests").querySelectorAll("li"),
        ].map((li) => li.textContent),
      ).toEqual(["Exploring teaching as a career option"]);
      await userEvent.click(screen.getByTestId("Card-added-topics-dismiss"));
      await waitFor(() =>
        expect(screen.queryByTestId("Card-added-topics-modal")).toBeNull(),
      );
    });

    test("interests alone open the modal, and a result without the field adds none", async () => {
      axiosMock.onPost(ulaUploadUrl).reply(200, {
        inserted: 1,
        alreadyPresent: 0,
        skipped: 0,
        problems: [],
        addedTopics: [],
        addedInterests: ["Grading"],
      });
      renderCard(recruitmentsFixtures.threeRecruitments, "ULA");
      const select = await screen.findByTestId("Card-quarter");
      await waitFor(() => expect(select.options.length).toBe(2));
      await userEvent.selectOptions(select, "20261");
      await userEvent.upload(screen.getByTestId("Card-file"), csv());
      await userEvent.click(screen.getByTestId("Card-button"));

      const modal = await screen.findByTestId("Card-added-topics-modal");
      expect(screen.queryByTestId("Card-added-topics")).toBeNull();
      expect(screen.getByTestId("Card-added-interests")).toHaveTextContent(
        "Grading",
      );
      await userEvent.click(modal.querySelector(".btn-close"));
      await waitFor(() =>
        expect(screen.queryByTestId("Card-added-topics-modal")).toBeNull(),
      );

      // A TA-shaped result (no addedInterests) adds no interests.
      axiosMock.onPost(ulaUploadUrl).reply(200, {
        inserted: 1,
        alreadyPresent: 0,
        skipped: 0,
        problems: [],
        addedTopics: ["Rust"],
      });
      await userEvent.upload(screen.getByTestId("Card-file"), csv());
      await userEvent.click(screen.getByTestId("Card-button"));
      await screen.findByTestId("Card-added-topics-modal");
      expect(screen.queryByTestId("Card-added-interests")).toBeNull();
      expect(screen.getByTestId("Card-added-topics")).toHaveTextContent("Rust");
    });
  });

  test("in TA mode the modal has no Topics heading and never an interests list", async () => {
    axiosMock.onPost(uploadUrl).reply(200, {
      inserted: 1,
      alreadyPresent: 0,
      skipped: 0,
      problems: [],
      addedTopics: ["Rust"],
      addedInterests: [],
    });
    renderCard();
    const select = await screen.findByTestId("Card-quarter");
    await waitFor(() => expect(select.options.length).toBe(3));
    await userEvent.selectOptions(select, "20261");
    await userEvent.upload(screen.getByTestId("Card-file"), csv());
    await userEvent.click(screen.getByTestId("Card-button"));

    await screen.findByTestId("Card-added-topics-modal");
    expect(screen.queryByRole("heading", { name: "Topics" })).toBeNull();
    expect(screen.queryByTestId("Card-added-interests")).toBeNull();
  });
});
