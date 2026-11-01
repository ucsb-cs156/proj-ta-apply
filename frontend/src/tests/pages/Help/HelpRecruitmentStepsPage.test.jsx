import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

import HelpRecruitmentStepsPage from "main/pages/Help/HelpRecruitmentStepsPage";
import ProtectedPage from "main/pages/Auth/ProtectedPage";
import { useCurrentUser } from "main/utils/currentUser";
import { STEP_EXPLANATIONS } from "main/utils/recruitmentStepsHelp";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const axiosMock = new AxiosMockAdapter(axios);

// The same gate App.tsx puts on /help/recruitment-steps.
function Gated() {
  const currentUser = useCurrentUser();
  return (
    <ProtectedPage
      component={<HelpRecruitmentStepsPage />}
      enforceRole={["ROLE_ADMIN", "ROLE_INSTRUCTOR"]}
      currentUser={currentUser}
    />
  );
}

const renderGated = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <Gated />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const signedInAs = (apiUser) => {
  axiosMock.onGet("/api/currentUser").reply(200, apiUser);
  return renderGated();
};

const title = (n) =>
  screen.getByTestId(`HelpRecruitmentStepsPage-diagram-step-${n}-title`)
    .textContent;

describe("HelpRecruitmentStepsPage tests", () => {
  beforeEach(() => {
    axiosMock.reset();
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
    // The footer asks whether developer mode is on.
    axiosMock
      .onGet("/api/developerMode")
      .reply(200, { available: false, on: false });
  });

  test("an admin sees the page", async () => {
    signedInAs(apiCurrentUserFixtures.adminUser);
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Recruitment Steps",
      }),
    ).toBeInTheDocument();
  });

  test("an instructor sees the page", async () => {
    signedInAs(apiCurrentUserFixtures.instructorUser);
    expect(
      await screen.findByTestId("HelpRecruitmentStepsPage"),
    ).toBeInTheDocument();
  });

  test("a plain user is turned away", async () => {
    signedInAs(apiCurrentUserFixtures.userOnly);
    expect(
      await screen.findByText("You do not have access to this page."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("HelpRecruitmentStepsPage")).toBeNull();
  });

  test("someone not signed in is asked to sign in", async () => {
    axiosMock.onGet("/api/currentUser").reply(403);
    renderGated();
    expect(
      await screen.findByText("Please sign in before accessing this page."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("HelpRecruitmentStepsPage")).toBeNull();
  });

  test("shows the TA diagram first, with TA in steps 1, 2 and 4, and the ULA one on request", async () => {
    signedInAs(apiCurrentUserFixtures.adminUser);
    await screen.findByTestId("HelpRecruitmentStepsPage");

    expect(
      screen.getByTestId("HelpRecruitmentStepsPage-type-TA"),
    ).toBeChecked();
    expect(
      screen.getByTestId("HelpRecruitmentStepsPage-type-ULA"),
    ).not.toBeChecked();
    expect(title(1)).toBe("1. Create TA Recruitment");
    expect(title(2)).toBe("2. Open TA Applications");
    expect(title(3)).toBe("3. Budget / Allocations");
    expect(title(4)).toBe("4. Close TA Applications");
    expect(title(9)).toBe("9. Release Hiring Decisions");
    expect(
      screen
        .getByTestId("HelpRecruitmentStepsPage-diagram-step-1-title")
        .closest("svg"),
    ).toHaveAttribute("data-mode", "static");

    await userEvent.click(
      screen.getByTestId("HelpRecruitmentStepsPage-type-ULA"),
    );
    expect(
      screen.getByTestId("HelpRecruitmentStepsPage-type-ULA"),
    ).toBeChecked();
    expect(
      screen.getByTestId("HelpRecruitmentStepsPage-type-TA"),
    ).not.toBeChecked();
    expect(title(1)).toBe("1. Create ULA Recruitment");
    expect(title(2)).toBe("2. Open ULA Applications");
    expect(title(4)).toBe("4. Close ULA Applications");
    expect(
      screen.getByTestId("HelpRecruitmentStepsPage-step-2"),
    ).toHaveTextContent("Open ULA Applications.");

    await userEvent.click(
      screen.getByTestId("HelpRecruitmentStepsPage-type-TA"),
    );
    expect(title(1)).toBe("1. Create TA Recruitment");
  });

  test("explains solid and dashed arrows, the step 5 footnote and the faculty feedback window", async () => {
    signedInAs(apiCurrentUserFixtures.adminUser);
    await screen.findByTestId("HelpRecruitmentStepsPage");

    const hardSoft = screen.getByTestId("HelpRecruitmentStepsPage-hard-soft");
    expect(hardSoft).toHaveTextContent(
      "A solid arrow is a hard prerequisite: the step it points to cannot sensibly happen until the step it leaves has. A dashed arrow is a soft prerequisite: the preferred order, which is not enforced.",
    );
    expect(hardSoft).toHaveTextContent(
      "Closing applications and closing faculty ranking, for example, are both hard prerequisites of releasing the hiring decisions.",
    );
    expect(
      screen.getByTestId("HelpRecruitmentStepsPage-footnote"),
    ).toHaveTextContent(
      "* Allocation visibility has three settings: admins only (the default), each faculty member sees the allocations for the courses they teach, or all faculty see all allocations. Step 5 means moving off “admins only”; which of the other two to choose is up to the admin.",
    );
    expect(
      screen.getByTestId("HelpRecruitmentStepsPage-feedback"),
    ).toHaveTextContent(
      "If a faculty member wants to ask for more TAs, fewer ULAs, or fewer TAs and more ULAs for their course, the time to say so is after step 5, once they can see the target, and before or during step 6, while the admin can still change the allocations.",
    );
    expect(
      screen.getByTestId("HelpRecruitmentStepsPage-live"),
    ).toHaveTextContent(
      "Each recruitment card on an admin's home page shows this same diagram for that recruitment, with a check on each step that is done.",
    );
  });

  test("lists the nine steps in order, each with its sentence", async () => {
    signedInAs(apiCurrentUserFixtures.adminUser);
    await screen.findByTestId("HelpRecruitmentStepsPage");

    const items = within(
      screen.getByTestId("HelpRecruitmentStepsPage-steps"),
    ).getAllByRole("listitem");
    expect(items).toHaveLength(9);
    expect(STEP_EXPLANATIONS.map((s) => s.number)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    const titles = [
      "Create TA Recruitment",
      "Open TA Applications",
      "Budget / Allocations",
      "Close TA Applications",
      "Release Allocations to Faculty",
      "Open Faculty Ranking",
      "Close Faculty Ranking",
      "Assign Candidates to Slots",
      "Release Hiring Decisions",
    ];
    items.forEach((item, i) => {
      expect(item).toHaveTextContent(
        `${titles[i]}. ${STEP_EXPLANATIONS[i].text}`,
      );
      expect(item).toHaveAttribute(
        "data-testid",
        `HelpRecruitmentStepsPage-step-${i + 1}`,
      );
    });
    // The footnote asterisk belongs to the diagram, not to the list.
    expect(items[4].textContent).not.toContain("*");
  });

  test("each step says what it is, in words", async () => {
    signedInAs(apiCurrentUserFixtures.instructorUser);
    await screen.findByTestId("HelpRecruitmentStepsPage");

    expect(STEP_EXPLANATIONS.map((s) => s.text)).toEqual([
      "From the Recruitments section of your home page, create a recruitment for a quarter and a type; its course list is filled in from the quarter's schedule.",
      "Applicants can submit applications, and edit them until the primary consideration date.",
      "Set the hiring target and give each course its share on the Courses page, checking the money on the Budget for Quarter page.",
      "Applicants can no longer submit or edit; every application is kept, and the recruitment can be opened again.",
      "Choose who sees the allocations: admins only, each faculty member for their own courses, or all faculty for all courses.",
      "Faculty see the candidates for their courses and enter rankings, until the deadline you give.",
      "Faculty can no longer change their rankings; what they ranked is kept.",
      "Use the faculty rankings to tentatively assign candidates to the courses' slots.",
      "Publish the assignments to admins and faculty, and download the CSV for the financial office.",
    ]);
    // An instructor's list has no More link and no trailing space.
    expect(
      screen.getByTestId("HelpRecruitmentStepsPage-step-9").textContent,
    ).toBe(
      "Release Hiring Decisions. Publish the assignments to admins and faculty, and download the CSV for the financial office.",
    );
    // An instructor reads For Admins as plain text and For Instructors as a link.
    expect(
      screen.getByTestId("HelpRecruitmentStepsPage-live").textContent,
    ).toBe(
      "Each recruitment card on an admin's home page shows this same diagram for that recruitment, with a check on each step that is done. More about the whole cycle is in For Admins and For Instructors.",
    );
  });

  test("an admin gets a More link on each step into Help → For Admins", async () => {
    signedInAs(apiCurrentUserFixtures.adminUser);
    await screen.findByTestId("HelpRecruitmentStepsPage");

    expect(STEP_EXPLANATIONS.map((s) => s.adminHref)).toEqual([
      "/help/admins#recruitments",
      "/help/admins#open-close-applications",
      "/help/admins#budget",
      "/help/admins#open-close-applications",
      "/help/admins#allocation-visibility",
      "/help/admins#faculty-reviews",
      "/help/admins#faculty-reviews",
      "/help/admins#assignments",
      "/help/admins#publish-assignments",
    ]);
    STEP_EXPLANATIONS.forEach((step) => {
      const link = screen.getByTestId(
        `HelpRecruitmentStepsPage-step-${step.number}-link`,
      );
      expect(link).toHaveAttribute("href", step.adminHref);
      expect(link).toHaveTextContent("More");
    });
    // The link follows the sentence after one space.
    expect(
      screen.getByTestId("HelpRecruitmentStepsPage-step-9").textContent,
    ).toBe(
      "Release Hiring Decisions. Publish the assignments to admins and faculty, and download the CSV for the financial office. More",
    );
    const live = screen.getByTestId("HelpRecruitmentStepsPage-live");
    expect(live.textContent).toBe(
      "Each recruitment card on an admin's home page shows this same diagram for that recruitment, with a check on each step that is done. More about the whole cycle is in For Admins and For Instructors.",
    );
    expect(
      within(live).getByRole("link", { name: "For Admins" }),
    ).toHaveAttribute("href", "/help/admins#flow");
    // Not an instructor, so no link to the instructors' page.
    expect(
      within(live).queryByRole("link", { name: "For Instructors" }),
    ).toBeNull();
  });

  test("an instructor gets the same steps without admin-only links", async () => {
    signedInAs(apiCurrentUserFixtures.instructorUser);
    await screen.findByTestId("HelpRecruitmentStepsPage");

    expect(
      within(
        screen.getByTestId("HelpRecruitmentStepsPage-steps"),
      ).queryAllByRole("link"),
    ).toHaveLength(0);
    const live = screen.getByTestId("HelpRecruitmentStepsPage-live");
    expect(within(live).queryByRole("link", { name: "For Admins" })).toBeNull();
    expect(
      within(live).getByRole("link", { name: "For Instructors" }),
    ).toHaveAttribute("href", "/help/instructors");
  });

  test("someone who is both gets both links", async () => {
    signedInAs(apiCurrentUserFixtures.adminAndInstructorUser);
    await screen.findByTestId("HelpRecruitmentStepsPage");

    const live = screen.getByTestId("HelpRecruitmentStepsPage-live");
    expect(
      within(live).getByRole("link", { name: "For Admins" }),
    ).toBeVisible();
    expect(
      within(live).getByRole("link", { name: "For Instructors" }),
    ).toBeVisible();
  });
});
