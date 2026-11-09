import { describe, expect, test } from "vitest";
import applicationsFixtures from "fixtures/applicationsFixtures";
import draftApplicationsFixtures from "fixtures/draftApplicationsFixtures";
import {
  ALL_APPLICATION_COLUMNS,
  APPLICATIONS_TABLE_KEY,
  DEFAULTS_MARKER,
  applicationColumnChoices,
  applicationColumns,
  cancelledText,
  courseInterestsText,
  defaultHiddenColumns,
  levelsText,
  show,
} from "main/utils/applicationColumns";
import { submittedText } from "main/utils/adminApplications";
import type { Application } from "main/components/Applications/ApplicationTable";

const ta = applicationsFixtures.oneTaApplication as unknown as Application;

describe("applicationColumns", () => {
  test("the table key and the marker", () => {
    expect(APPLICATIONS_TABLE_KEY).toBe("recruitmentApplications");
    expect(DEFAULTS_MARKER).toBe("_defaultsApplied");
  });

  test("show is blank for null and undefined, otherwise the text", () => {
    expect(show(null)).toBe("");
    expect(show(undefined)).toBe("");
    expect(show("")).toBe("");
    expect(show(0)).toBe("0");
    expect(show("x")).toBe("x");
  });

  test("courseInterestsText lists the marked courses in course order, blank when none", () => {
    expect(
      courseInterestsText({
        "CMPSC    16": "WOULD_CONSIDER",
        "CMPSC     8": "ENTHUSIASTIC",
      }),
    ).toBe("CMPSC     8 Enthusiastic; CMPSC    16 Would Consider");
    expect(courseInterestsText({ "CMPSC     8": "BOGUS" })).toBe(
      "CMPSC     8 ",
    );
    expect(courseInterestsText({})).toBe("");
    expect(courseInterestsText(null)).toBe("");
    expect(courseInterestsText(undefined)).toBe("");
  });

  test("levelsText lists the rated names in name order, blank when none", () => {
    expect(levelsText({ React: 3, Java: 5 })).toBe("Java 5; React 3");
    expect(levelsText({})).toBe("");
    expect(levelsText(null)).toBe("");
    expect(levelsText(undefined)).toBe("");
  });

  test("cancelledText is the time and reason for a cancelled application, blank otherwise", () => {
    expect(cancelledText(ta)).toBe("");
    expect(
      cancelledText({
        ...ta,
        status: "CANCELLED",
        cancelledAt: "2026-02-03T04:05:00",
        cancellationReason: "Found other employment",
      }),
    ).toBe(`${submittedText("2026-02-03T04:05:00")}: Found other employment`);
    expect(
      cancelledText({
        ...ta,
        status: "CANCELLED",
        cancelledAt: null,
        cancellationReason: null,
      }),
    ).toBe(": ");
  });

  test("every column has a distinct id and a label, and only the fixed ones are missing", () => {
    const ids = ALL_APPLICATION_COLUMNS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain("id");
    expect(ids).not.toContain("name");
    expect(ids).not.toContain("view");
    expect(ids).not.toContain("edit");
    ALL_APPLICATION_COLUMNS.forEach((c) => {
      expect(c.label.length).toBeGreaterThan(0);
      if (c.stacked) {
        expect(c.stacked.join(" ")).toBe(c.label);
      }
    });
  });

  test("applicationColumns keeps the shared columns and the type's own, in table order", () => {
    const taIds = applicationColumns("TA").map((c) => c.id);
    const ulaIds = applicationColumns("ULA").map((c) => c.id);
    expect(taIds.slice(0, 5)).toEqual([
      "submittedAt",
      "email",
      "major",
      "classLevel",
      "graduationDate",
    ]);
    expect(ulaIds.slice(0, 4)).toEqual([
      "submittedAt",
      "email",
      "major",
      "graduationDate",
    ]);
    expect(taIds).toHaveLength(22);
    expect(ulaIds).toHaveLength(38);
    expect(taIds).toContain("residencyStatus");
    expect(taIds).not.toContain("availabilityCommentsSecondChoice");
    expect(taIds).not.toContain("permNumber");
    expect(taIds).not.toContain("interests");
    expect(ulaIds).toContain("permNumber");
    expect(ulaIds).toContain("interests");
    expect(ulaIds).not.toContain("classLevel");
    expect(ulaIds).toContain("availableForLecturesFirstChoice");
    expect(taIds[taIds.length - 1]).toBe("noticeVersionId");
  });

  // Issue #421: every column of each type's table, in order, checked against the questions the
  // form asks of that type and the answers the backend keeps for it. A column tagged with the
  // wrong type fails here by name.
  const SHARED_BEFORE = ["submittedAt", "email", "major"];
  const SHARED_ANSWERS = [
    "graduationDate",
    "status",
    "gpaMajor",
    "gpaOverall",
    "yearInProgram",
  ];
  const SHARED_AFTER = [
    "courseInterests",
    "topicProficiencies",
    "prevExperience",
    "comments",
    "postApplicationComments",
    "adminComments",
    "cancelled",
    "noticeVersionId",
  ];
  const CHOICES = ["firstChoiceCourse", "secondChoiceCourse"];
  const AVAILABILITY = [
    "availableForLecturesFirstChoice",
    "availableForDiscussionFirstChoice",
    "availabilityCommentsFirstChoice",
    "availableForLecturesSecondChoice",
    "availableForDiscussionSecondChoice",
    "availabilityCommentsSecondChoice",
  ];
  const TA_COLUMN_IDS = [
    ...SHARED_BEFORE,
    "classLevel",
    ...SHARED_ANSWERS,
    "residencyStatus",
    "languageExam",
    "languageExamDatePassed",
    ...CHOICES,
    ...SHARED_AFTER,
  ];
  const ULA_COLUMN_IDS = [
    ...SHARED_BEFORE,
    ...SHARED_ANSWERS,
    "permNumber",
    "previousServiceAsUla",
    "videoLink",
    "changingMajor",
    "bsMsStudent",
    "studentStatusNextQuarter",
    "wantsTaEligibility",
    "otherCampusJob",
    "priorUcsbEmployment",
    "employeeId",
    "i9Appointment",
    "trainingCommitment",
    "trainingCommitmentExplanation",
    ...CHOICES,
    ...AVAILABILITY,
    "courseInterests",
    "topicProficiencies",
    "interests",
    ...SHARED_AFTER.slice(2),
  ];

  test.each([
    ["TA", TA_COLUMN_IDS],
    ["ULA", ULA_COLUMN_IDS],
  ] as const)(
    "a %s table has exactly the columns for the questions its form asks (issue #421)",
    (type, expected) => {
      expect(applicationColumns(type).map((c) => c.id)).toEqual(expected);
      expect(applicationColumns(type, true).map((c) => c.id)).toEqual(expected);
      expect(applicationColumnChoices(type).map((c) => c.id)).toEqual(expected);
    },
  );

  test("the availability columns are on the ULA table and its menu, not the TA one (issue #421)", () => {
    const taLabels = applicationColumnChoices("TA").map((c) => c.label);
    const ulaLabels = applicationColumnChoices("ULA").map((c) => c.label);
    const availabilityLabels = [
      "Lecture (1st)",
      "Discussion (1st)",
      "Availability (1st)",
      "Lecture (2nd)",
      "Discussion (2nd)",
      "Availability (2nd)",
    ];
    availabilityLabels.forEach((label) => {
      expect(taLabels).not.toContain(label);
      expect(ulaLabels).toContain(label);
    });
    // Like every answer added to a table, they start hidden on a new ULA recruitment.
    AVAILABILITY.forEach((id) =>
      expect(defaultHiddenColumns("ULA")).toContain(id),
    );
    AVAILABILITY.forEach((id) =>
      expect(defaultHiddenColumns("TA")).not.toContain(id),
    );
  });

  test("applicationColumnChoices is the id and label of each column", () => {
    const choices = applicationColumnChoices("TA");
    expect(choices).toHaveLength(22);
    expect(choices[0]).toEqual({ id: "submittedAt", label: "Submitted" });
    expect(choices.find((c) => c.id === "classLevel")).toEqual({
      id: "classLevel",
      label: "Level",
    });
    expect(Object.keys(choices[0])).toEqual(["id", "label"]);
  });

  test("the columns the table always had start shown; the new ones and the marker start hidden", () => {
    const taHidden = defaultHiddenColumns("TA");
    expect(taHidden).not.toContain("submittedAt");
    expect(taHidden).not.toContain("email");
    expect(taHidden).not.toContain("major");
    expect(taHidden).not.toContain("classLevel");
    // New on the TA table, so hidden at first.
    expect(taHidden).toContain("graduationDate");
    expect(taHidden).toContain("status");
    expect(taHidden).toContain("residencyStatus");
    expect(taHidden).not.toContain("permNumber");
    expect(taHidden[taHidden.length - 1]).toBe(DEFAULTS_MARKER);
    expect(taHidden).toHaveLength(22 - 4 + 1);

    const ulaHidden = defaultHiddenColumns("ULA");
    expect(ulaHidden).not.toContain("graduationDate");
    expect(ulaHidden).toContain("permNumber");
    expect(ulaHidden).not.toContain("classLevel");
    expect(ulaHidden[ulaHidden.length - 1]).toBe(DEFAULTS_MARKER);
    expect(ulaHidden).toHaveLength(38 - 4 + 1);
  });

  test("exactly the long-labelled narrow columns are stacked", () => {
    expect(
      ALL_APPLICATION_COLUMNS.filter((c) => c.stacked).map((c) => c.id),
    ).toEqual([
      "graduationDate",
      "gpaMajor",
      "gpaOverall",
      "yearInProgram",
      "residencyStatus",
      "languageExam",
      "languageExamDatePassed",
      "previousServiceAsUla",
      "changingMajor",
      "bsMsStudent",
      "studentStatusNextQuarter",
      "wantsTaEligibility",
      "otherCampusJob",
      "priorUcsbEmployment",
      "i9Appointment",
      "trainingCommitment",
      "firstChoiceCourse",
      "secondChoiceCourse",
      "availableForLecturesFirstChoice",
      "availableForDiscussionFirstChoice",
      "availableForLecturesSecondChoice",
      "availableForDiscussionSecondChoice",
      "noticeVersionId",
    ]);
  });

  test("exactly the free-text columns take their natural width; the rest shrink", () => {
    expect(
      ALL_APPLICATION_COLUMNS.filter((c) => !c.shrink).map((c) => c.id),
    ).toEqual([
      "trainingCommitmentExplanation",
      "availabilityCommentsFirstChoice",
      "availabilityCommentsSecondChoice",
      "courseInterests",
      "topicProficiencies",
      "interests",
      "prevExperience",
      "comments",
      "postApplicationComments",
      "adminComments",
      "cancelled",
    ]);
  });

  test("exactly the TA-only and ULA-only answers are limited to their type", () => {
    expect(
      ALL_APPLICATION_COLUMNS.filter((c) => c.types?.includes("TA")).map(
        (c) => c.id,
      ),
    ).toEqual([
      "classLevel",
      "residencyStatus",
      "languageExam",
      "languageExamDatePassed",
    ]);
    expect(
      ALL_APPLICATION_COLUMNS.filter((c) => c.types?.includes("ULA")).map(
        (c) => c.id,
      ),
    ).toEqual([
      "permNumber",
      "previousServiceAsUla",
      "videoLink",
      "changingMajor",
      "bsMsStudent",
      "studentStatusNextQuarter",
      "wantsTaEligibility",
      "otherCampusJob",
      "priorUcsbEmployment",
      "employeeId",
      "i9Appointment",
      "trainingCommitment",
      "trainingCommitmentExplanation",
      "availableForLecturesFirstChoice",
      "availableForDiscussionFirstChoice",
      "availabilityCommentsFirstChoice",
      "availableForLecturesSecondChoice",
      "availableForDiscussionSecondChoice",
      "availabilityCommentsSecondChoice",
      "interests",
    ]);
    ALL_APPLICATION_COLUMNS.forEach((c) => {
      if (c.types) expect(c.types).toHaveLength(1);
    });
  });

  test("every column shows a non-blank value for a fully answered application", () => {
    const full = {
      ...applicationsFixtures.oneUlaApplication,
      ...applicationsFixtures.oneTaApplication,
      status: "CANCELLED",
      cancelledAt: "2026-02-03T04:05:00",
      cancellationReason: "Found other employment",
      postApplicationComments: "Later note",
      adminComments: "Admin note",
      availabilityCommentsSecondChoice: "Mornings only",
      permNumber: "A1B2C3D",
      videoLink: "https://example.org/v",
      previousServiceAsUla: 2,
      changingMajor: false,
      bsMsStudent: true,
      studentStatusNextQuarter: "UNDERGRADUATE",
      wantsTaEligibility: true,
      otherCampusJob: "NOT_SURE",
      priorUcsbEmployment: false,
      employeeId: "1234567",
      i9Appointment: true,
      trainingCommitment: "AGREE",
      trainingCommitmentExplanation: "Because",
      interests: { Tutoring: 5 },
    } as unknown as Application;
    ALL_APPLICATION_COLUMNS.forEach((c) => {
      const value = c.value(full);
      expect(typeof value, c.id).toBe("string");
      expect(value, c.id).not.toBe("");
    });
    expect(
      ALL_APPLICATION_COLUMNS.find((c) => c.id === "trainingCommitment")?.value(
        full,
      ),
    ).toBe("I AGREE to this commitment.");
    expect(
      ALL_APPLICATION_COLUMNS.find(
        (c) => c.id === "studentStatusNextQuarter",
      )?.value(full),
    ).toBe("Undergraduate");
    expect(
      ALL_APPLICATION_COLUMNS.find(
        (c) => c.id === "priorUcsbEmployment",
      )?.value(full),
    ).toBe("No");
  });

  test("unknown or missing codes read as blank", () => {
    const value = (id: string, patch: object) =>
      ALL_APPLICATION_COLUMNS.find((c) => c.id === id)?.value({
        ...ta,
        ...patch,
      } as Application);
    expect(value("residencyStatus", { residencyStatus: "BOGUS" })).toBe("");
    expect(value("residencyStatus", { residencyStatus: null })).toBe("");
    expect(value("residencyStatus", {})).toBe("F1 Student Visa");
    expect(value("languageExam", { languageExam: "BOGUS" })).toBe("");
    expect(value("languageExam", { languageExam: null })).toBe("");
    expect(value("languageExam", {})).toBe("passed (F1 or J1 visa)");
    expect(value("classLevel", { classLevel: "BS" })).toBe("");
    expect(value("classLevel", {})).toBe("PhD");
    expect(value("otherCampusJob", { otherCampusJob: "BOGUS" })).toBe("");
    expect(value("changingMajor", { changingMajor: null })).toBe("");
  });
});

describe("the GPA columns for a first quarter applicant (issue #292)", () => {
  const column = (id: string) =>
    ALL_APPLICATION_COLUMNS.find((c) => c.id === id)!;

  test("say First quarter instead of a blank", () => {
    const first = {
      ...ta,
      firstQuarter: true,
      gpaMajor: null,
      gpaOverall: null,
    };

    expect(column("gpaMajor").value(first)).toBe("First quarter");
    expect(column("gpaOverall").value(first)).toBe("First quarter");
  });

  test("show the numbers for everyone else", () => {
    const other = {
      ...ta,
      firstQuarter: false,
      gpaMajor: 3.9,
      gpaOverall: 3.8,
    };

    expect(column("gpaMajor").value(other)).toBe("3.9");
    expect(column("gpaOverall").value(other)).toBe("3.8");
  });
});

describe("the columns of a table of drafts (issue #296)", () => {
  test("are the same columns, with the same ids and order, as for submitted applications", () => {
    for (const type of ["TA", "ULA"] as const) {
      expect(applicationColumns(type, true).map((c) => c.id)).toEqual(
        applicationColumns(type).map((c) => c.id),
      );
      expect(applicationColumnChoices(type, true).map((c) => c.id)).toEqual(
        applicationColumnChoices(type).map((c) => c.id),
      );
    }
  });

  test("differ only in Submitted, which becomes Last saved", () => {
    const submitted = applicationColumns("TA");
    const drafts = applicationColumns("TA", true);

    expect(
      drafts.filter((c, i) => c.label !== submitted[i].label).map((c) => c.id),
    ).toEqual(["submittedAt"]);
    expect(drafts.find((c) => c.id === "submittedAt")!.label).toBe(
      "Last saved",
    );
    expect(
      applicationColumnChoices("ULA", true).find((c) => c.id === "submittedAt")!
        .label,
    ).toBe("Last saved");
    expect(
      applicationColumnChoices("ULA").find((c) => c.id === "submittedAt")!
        .label,
    ).toBe("Submitted");
    expect(applicationColumns("TA")[0].label).toBe("Submitted");
  });

  test("Last saved shows when the draft was saved, in Pacific time", () => {
    const column = applicationColumns("TA", true)[0];

    expect(
      column.value(draftApplicationsFixtures.adminSavedTaDraft as never),
    ).toBe("1/12/2026, 8:15:00 AM");
    expect(
      column.value({
        ...draftApplicationsFixtures.adminSavedTaDraft,
        updatedAt: null,
      } as never),
    ).toBe("");
  });

  test("the answers read the same from a draft, and an unanswered one is blank", () => {
    const draft =
      draftApplicationsFixtures.adminSavedTaDraft as never as object;
    const value = (id: string, row: object = draft) =>
      ALL_APPLICATION_COLUMNS.find((c) => c.id === id)!.value(row as never);

    expect(value("major")).toBe("Statistics");
    expect(value("gpaMajor")).toBe("First quarter");
    expect(value("classLevel")).toBe("MS");
    expect(value("status")).toBe("");
    expect(value("cancelled")).toBe("");
    expect(value("postApplicationComments")).toBe("");
    expect(value("adminComments")).toBe("");
    expect(
      value("adminComments", { ...draft, adminComments: "Call her" }),
    ).toBe("Call her");
    expect(value("submittedAt")).toBe("");
  });
});
