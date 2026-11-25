import {
  ALWAYS_SHOWN_COLUMN_IDS,
  COMMENTS_COLUMN_ID,
  COMMENTS_DEFAULT_WIDTH,
  COMMENTS_MAX_SHARE,
  COMMENTS_MIN_WIDTH,
  OPT_IN_COLUMN_IDS,
  RESULTS_COLUMN_IDS,
  SOFT_OFFER_COLUMNS_STORAGE_KEY,
  STAMP_COLUMN_ID,
  STATUS_COLUMN_ID,
  UNASSIGNED_COLUMN_IDS,
  columnChoices,
  commentsMaxWidth,
} from "main/utils/softOfferResultsColumns";
import softOfferResultsFixtures from "fixtures/softOfferResultsFixtures";

describe("softOfferResultsColumns tests (issue #494)", () => {
  test("the ids match the backend's headings one for one, in order", () => {
    expect(RESULTS_COLUMN_IDS).toEqual([
      "firstName",
      "lastName",
      "email",
      "permNumber",
      "previousServiceAsUla",
      "graduationDate",
      "otherCampusJob",
      "employeeId",
      "course",
      "instructor",
      "instructorEmail",
      "firstTimeUla",
      "status",
      "respondedAt",
      "comments",
    ]);
    expect(RESULTS_COLUMN_IDS).toHaveLength(
      softOfferResultsFixtures.three.headers.length,
    );
    expect(UNASSIGNED_COLUMN_IDS).toEqual([
      "firstName",
      "lastName",
      "email",
      "courseAnswered",
      "status",
      "respondedAt",
      "comments",
    ]);
    expect(UNASSIGNED_COLUMN_IDS).toHaveLength(
      softOfferResultsFixtures.three.unassignedHeaders.length,
    );
    expect(RESULTS_COLUMN_IDS[12]).toBe(STATUS_COLUMN_ID);
    expect(RESULTS_COLUMN_IDS[13]).toBe(STAMP_COLUMN_ID);
    expect(RESULTS_COLUMN_IDS[14]).toBe(COMMENTS_COLUMN_ID);
    // Issue #500: the five columns for the financial office staff start hidden.
    expect(OPT_IN_COLUMN_IDS).toEqual([
      "permNumber",
      "previousServiceAsUla",
      "graduationDate",
      "otherCampusJob",
      "employeeId",
    ]);
    expect(RESULTS_COLUMN_IDS.slice(3, 8)).toEqual(OPT_IN_COLUMN_IDS);
    expect(ALWAYS_SHOWN_COLUMN_IDS).toEqual(["firstName", "lastName"]);
    expect(SOFT_OFFER_COLUMNS_STORAGE_KEY).toBe(
      "softOfferResults.hiddenColumns",
    );
  });

  test("Comments starts at 300px and may be dragged between 200px and 80% of the window", () => {
    expect(COMMENTS_DEFAULT_WIDTH).toBe(300);
    expect(COMMENTS_MIN_WIDTH).toBe(200);
    expect(COMMENTS_MAX_SHARE).toBe(0.8);
    expect(commentsMaxWidth(1000)).toBe(800);
    expect(commentsMaxWidth(1001)).toBe(800);
    expect(commentsMaxWidth(1024)).toBe(819);
    // A window too narrow for the minimum still allows the minimum.
    expect(commentsMaxWidth(100)).toBe(200);
    expect(commentsMaxWidth(250)).toBe(200);
    expect(commentsMaxWidth(251)).toBe(200);
    expect(commentsMaxWidth(252)).toBe(201);
  });

  test("columnChoices: every column but the first and last name, labelled by the headings", () => {
    expect(
      columnChoices(RESULTS_COLUMN_IDS, softOfferResultsFixtures.three.headers),
    ).toEqual([
      { id: "email", label: "Email" },
      { id: "permNumber", label: "Perm number" },
      { id: "previousServiceAsUla", label: "Prev LA Qtrs" },
      { id: "graduationDate", label: "Expected grad date" },
      { id: "otherCampusJob", label: "Other Campus Job?" },
      { id: "employeeId", label: "Employee ID number" },
      { id: "course", label: "Course assignment" },
      { id: "instructor", label: "Course instructor" },
      { id: "instructorEmail", label: "Course instructor email" },
      { id: "firstTimeUla", label: "First time ULA" },
      { id: "status", label: "Offer Status" },
      { id: "respondedAt", label: "Offer Response Date/Time" },
      { id: "comments", label: "Comments" },
    ]);
    expect(
      columnChoices(
        UNASSIGNED_COLUMN_IDS,
        softOfferResultsFixtures.three.unassignedHeaders,
      ).map((choice) => choice.id),
    ).toEqual(["email", "courseAnswered", "status", "respondedAt", "comments"]);
  });

  test("columnChoices: a missing heading is labelled by the id", () => {
    expect(
      columnChoices(["firstName", "lastName", "x", "y"], ["F", "L", "X"]),
    ).toEqual([
      { id: "x", label: "X" },
      { id: "y", label: "y" },
    ]);
  });
});
