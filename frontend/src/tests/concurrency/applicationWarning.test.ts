import { describe, expect, test } from "vitest";
import {
  ADMIN_SENTENCE,
  APPLICANT_SENTENCE,
  RISK_SENTENCE,
  closingSentence,
  readPresence,
  warningMessage,
  type OtherClient,
} from "main/concurrency";

/** Issue #302: an admin and an applicant with the same application open. */

const CLOSE_AND_RETRY =
  "We recommend that you close this window and try again in a few minutes.";

const jane: OtherClient = {
  label: "jane@ucsb.edu (Jane Doe)",
  samePerson: false,
  admin: true,
};
const bob: OtherClient = {
  label: "bob@ucsb.edu (Bob Roe)",
  samePerson: false,
  admin: true,
};
const cy: OtherClient = {
  label: "cy@ucsb.edu",
  samePerson: false,
  admin: true,
};
const di: OtherClient = {
  label: "di@ucsb.edu (Di Poe)",
  samePerson: false,
  admin: true,
};
const student: OtherClient = {
  label: "chris@ucsb.edu (Chris Student)",
  samePerson: false,
};
const me: OtherClient = { label: "me@ucsb.edu (Me)", samePerson: true };

describe("an applicant is told that an admin has the application open", () => {
  test("one admin, named, with the request naming their email", () => {
    expect(warningMessage([jane], "application", "applicant")).toBe(
      "Admin jane@ucsb.edu (Jane Doe) has this application open for editing. " +
        `${CLOSE_AND_RETRY} If this message persists, please reach out to jane@ucsb.edu`,
    );
  });

  test("an admin with no name is named by the email alone, and asked for by it", () => {
    expect(warningMessage([cy], "application", "applicant")).toBe(
      "Admin cy@ucsb.edu has this application open for editing. " +
        `${CLOSE_AND_RETRY} If this message persists, please reach out to cy@ucsb.edu`,
    );
  });

  test("several admins are named the shared way, with 'have', and the first one is asked for", () => {
    expect(warningMessage([jane, bob], "application", "applicant")).toBe(
      "Admin jane@ucsb.edu (Jane Doe) and bob@ucsb.edu (Bob Roe) have this application open for editing. " +
        `${CLOSE_AND_RETRY} If this message persists, please reach out to jane@ucsb.edu`,
    );
    expect(warningMessage([jane, bob, cy], "application", "applicant")).toBe(
      "Admin jane@ucsb.edu (Jane Doe), bob@ucsb.edu (Bob Roe) and cy@ucsb.edu have this application open for editing. " +
        `${CLOSE_AND_RETRY} If this message persists, please reach out to jane@ucsb.edu`,
    );
  });

  test("beyond the third admin the rest are counted", () => {
    expect(
      warningMessage([jane, bob, cy, di], "application", "applicant"),
    ).toBe(
      "Admin jane@ucsb.edu (Jane Doe), bob@ucsb.edu (Bob Roe), cy@ucsb.edu and 1 other have this application open for editing. " +
        `${CLOSE_AND_RETRY} If this message persists, please reach out to jane@ucsb.edu`,
    );
  });

  test("the applicant's own other tabs are not named when an admin is there", () => {
    const message = warningMessage([me, jane], "application", "applicant");
    expect(message).toContain("Admin jane@ucsb.edu (Jane Doe) has this");
    expect(message).not.toContain("You");
    expect(message).not.toContain("me@ucsb.edu");
  });

  test("it is the same for the tab that arrived later", () => {
    expect(warningMessage([jane], "application", "applicant", true)).toBe(
      warningMessage([jane], "application", "applicant", false),
    );
  });

  test("an admin who is the same person as the applicant is just their own tab", () => {
    expect(
      warningMessage(
        [{ ...jane, samePerson: true }],
        "application",
        "applicant",
      ),
    ).toBe(
      `You are also editing this application in another tab or window. ${RISK_SENTENCE}`,
    );
  });

  test("with no admin, the applicant gets the usual warning", () => {
    expect(warningMessage([me], "application", "applicant")).toBe(
      `You are also editing this application in another tab or window. ${RISK_SENTENCE}`,
    );
  });

  test("the audience that is not the applicant's is not told this", () => {
    expect(warningMessage([jane], "application")).toBe(
      `jane@ucsb.edu (Jane Doe) is also editing this application. ${ADMIN_SENTENCE}`,
    );
  });
});

describe("an admin is told that the applicant has the application open", () => {
  test("the applicant is named and the admin is told to wait or ask", () => {
    expect(
      warningMessage([student], "application", "applicationAdmin", true),
    ).toBe(
      "chris@ucsb.edu (Chris Student) already has this application open for editing. " +
        "We recommend that you wait a few minutes or ask them to close it.",
    );
    expect(APPLICANT_SENTENCE).toBe(
      "We recommend that you wait a few minutes or ask them to close it.",
    );
  });

  test("the tab that was open first says 'also editing'", () => {
    expect(warningMessage([student], "application", "applicationAdmin")).toBe(
      `chris@ucsb.edu (Chris Student) is also editing this application. ${APPLICANT_SENTENCE}`,
    );
  });

  test("another admin as well gets the admin sentence too", () => {
    expect(
      warningMessage([student, jane], "application", "applicationAdmin", true),
    ).toBe(
      "chris@ucsb.edu (Chris Student) and jane@ucsb.edu (Jane Doe) already have this application open for editing. " +
        `${APPLICANT_SENTENCE} ${ADMIN_SENTENCE}`,
    );
  });

  test("only other admins: the admin sentence alone", () => {
    expect(
      warningMessage([jane], "application", "applicationAdmin", true),
    ).toBe(
      `jane@ucsb.edu (Jane Doe) already has this application open for editing. ${ADMIN_SENTENCE}`,
    );
  });

  test("only the admin's own tabs: as on any admin page", () => {
    expect(warningMessage([me], "application", "applicationAdmin", true)).toBe(
      `You already have this application open for editing in another tab or window. ${ADMIN_SENTENCE}`,
    );
  });

  test("the admin's own tab and the applicant", () => {
    expect(closingSentence([me, student], "applicationAdmin")).toBe(
      APPLICANT_SENTENCE,
    );
  });

  test("the plain admin audience is unchanged by whether people are admins", () => {
    expect(closingSentence([student], "admin")).toBe(ADMIN_SENTENCE);
    expect(closingSentence([jane], "admin")).toBe(ADMIN_SENTENCE);
  });
});

describe("the admin flag on the wire", () => {
  test("is read as true only when it is true", () => {
    const presence = readPresence({
      others: [
        { label: "a", samePerson: false, admin: true },
        { label: "b", samePerson: false, admin: false },
        { label: "c", samePerson: true },
        { label: "d", samePerson: false, admin: "yes" },
      ],
    });
    expect(presence.others).toEqual([
      { label: "a", samePerson: false, admin: true },
      { label: "b", samePerson: false },
      { label: "c", samePerson: true },
      { label: "d", samePerson: false },
    ]);
  });
});
