import { describe, expect, test } from "vitest";
import {
  CLOSE_APPLICATIONS_TOOLTIP,
  CLOSE_REVIEWS_TOOLTIP,
  FACULTY_REVIEWS_HELP,
  MORE_ABOUT_TEXT,
  OPEN_APPLICATIONS_TOOLTIP,
  OPEN_CLOSE_APPLICATIONS_HELP,
  OPEN_REVIEWS_CONFIRMATION,
  OPEN_REVIEWS_TOOLTIP,
  statusConfirmation,
} from "main/utils/recruitmentActions";

describe("recruitmentActions", () => {
  test("the tooltips", () => {
    expect(OPEN_APPLICATIONS_TOOLTIP).toBe(
      "Let applicants submit and edit applications for this recruitment",
    );
    expect(CLOSE_APPLICATIONS_TOOLTIP).toBe(
      "Stop accepting applications for this recruitment",
    );
    expect(OPEN_REVIEWS_TOOLTIP).toBe(
      "Let faculty see and rank the candidates for their courses, with a ranking deadline",
    );
    expect(CLOSE_REVIEWS_TOOLTIP).toBe(
      "Stop faculty from changing their rankings; the dates on file are kept",
    );
    expect(MORE_ABOUT_TEXT).toBe("More about this action");
  });

  test("the help links point at the sections of Help → For Admins", () => {
    expect(OPEN_CLOSE_APPLICATIONS_HELP).toBe(
      "/help/admins#open-close-applications",
    );
    expect(FACULTY_REVIEWS_HELP).toBe("/help/admins#faculty-reviews");
  });

  test("statusConfirmation for a closed recruitment is about opening", () => {
    expect(statusConfirmation(false)).toEqual({
      title: "Open Applications",
      explanation:
        "Applicants will be able to submit applications for this recruitment, and to edit them until the primary consideration date. The first opening stamps the actual opening date, which is kept even if the recruitment is closed and reopened.",
      helpLink: "/help/admins#open-close-applications",
      yes: "Yes, Open Applications Now",
      no: "No, don't open applications now",
    });
  });

  test("statusConfirmation for an open recruitment is about closing", () => {
    expect(statusConfirmation(true)).toEqual({
      title: "Close Applications",
      explanation:
        "Applicants will no longer be able to submit or edit applications for this recruitment. The actual closing date is stamped with today's date. Every application already on file is kept, and the recruitment can be opened again later.",
      helpLink: "/help/admins#open-close-applications",
      yes: "Yes, Close Applications Now",
      no: "No, don't close applications now",
    });
  });

  test("the faculty reviews confirmation", () => {
    expect(OPEN_REVIEWS_CONFIRMATION).toEqual({
      title: "Open Faculty Reviews",
      explanation:
        "Faculty will be able to see the candidates for their courses and enter rankings until the deadline you give here. The first opening stamps the faculty review opening date, which is kept if reviews are reopened; the deadline can be changed later. The change is recorded in the recruitment's change history.",
      helpLink: "/help/admins#faculty-reviews",
      yes: "Yes, Open Faculty Reviews Now",
      no: "No, don't open faculty reviews now",
    });
  });
});
