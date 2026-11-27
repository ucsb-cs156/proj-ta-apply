import {
  ALWAYS_SHOWN_COLUMN_IDS,
  COMMENTS_COLUMN_ID,
  COMMENTS_DEFAULT_WIDTH,
  COMMENTS_MAX_SHARE,
  COMMENTS_MIN_WIDTH,
  FUNDING_COLUMN,
  HIRING_COLUMNS,
  OPT_IN_COLUMN_IDS,
  RESULTS_COLUMN_IDS,
  RESULTS_TEXT_COLUMN_IDS,
  SOFT_OFFER_COLUMNS_STORAGE_KEY,
  STAFF_COLUMNS,
  STAMP_COLUMN_ID,
  STATUS_COLUMN_ID,
  UNASSIGNED_COLUMN_IDS,
  columnChoices,
  commentsMaxWidth,
  compareHiring,
  hiringColumn,
  layoutColumns,
} from "main/utils/softOfferResultsColumns";
import softOfferResultsFixtures from "fixtures/softOfferResultsFixtures";

const { three } = softOfferResultsFixtures;
const TEXT_IDS = [
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
];
const STAFF_IDS = [
  "formalOfferSent",
  "formalOfferAccepted",
  "newHireForm",
  "flsaConflictFound",
  "flsaConflictResolved",
  "inUcpath",
  "i9Complete",
  "staffComments",
];

describe("softOfferResultsColumns tests (issue #494)", () => {
  test("the text ids match the backend's headings one for one, in order", () => {
    expect(RESULTS_TEXT_COLUMN_IDS).toEqual(TEXT_IDS);
    expect(RESULTS_TEXT_COLUMN_IDS).toHaveLength(three.headers.length);
    expect(UNASSIGNED_COLUMN_IDS).toEqual([
      "firstName",
      "lastName",
      "email",
      "courseAnswered",
      "status",
      "respondedAt",
      "comments",
    ]);
    expect(UNASSIGNED_COLUMN_IDS).toHaveLength(three.unassignedHeaders.length);
    expect(RESULTS_TEXT_COLUMN_IDS[12]).toBe(STATUS_COLUMN_ID);
    expect(RESULTS_TEXT_COLUMN_IDS[13]).toBe(STAMP_COLUMN_ID);
    expect(RESULTS_TEXT_COLUMN_IDS[14]).toBe(COMMENTS_COLUMN_ID);
    // Issue #500: the five columns for the financial office staff start hidden.
    expect(OPT_IN_COLUMN_IDS).toEqual([
      "permNumber",
      "previousServiceAsUla",
      "graduationDate",
      "otherCampusJob",
      "employeeId",
    ]);
    expect(RESULTS_TEXT_COLUMN_IDS.slice(3, 8)).toEqual(OPT_IN_COLUMN_IDS);
    expect(ALWAYS_SHOWN_COLUMN_IDS).toEqual(["firstName", "lastName"]);
    expect(SOFT_OFFER_COLUMNS_STORAGE_KEY).toBe(
      "softOfferResults.hiddenColumns",
    );
  });

  test("the main table's columns: the text columns with Funding after Course assignment and the staff columns after Comments (issues #509, #512)", () => {
    expect(RESULTS_COLUMN_IDS).toEqual([
      ...TEXT_IDS.slice(0, 9),
      "funding",
      ...TEXT_IDS.slice(9),
      ...STAFF_IDS,
    ]);
    expect(RESULTS_COLUMN_IDS).toHaveLength(24);
    expect(RESULTS_COLUMN_IDS[8]).toBe("course");
    expect(RESULTS_COLUMN_IDS[9]).toBe(FUNDING_COLUMN.id);
    expect(RESULTS_COLUMN_IDS[15]).toBe(COMMENTS_COLUMN_ID);
    expect(RESULTS_COLUMN_IDS.slice(16)).toEqual(
      STAFF_COLUMNS.map((column) => column.id),
    );
  });

  test("the hiring columns: headings as the CSV's base names, kinds, fields and the record keys they read", () => {
    expect(HIRING_COLUMNS).toEqual([FUNDING_COLUMN, ...STAFF_COLUMNS]);
    expect(FUNDING_COLUMN).toEqual({
      id: "funding",
      heading: "Funding",
      kind: "funding",
      field: "FUNDING_SOURCE",
      valueKey: "fundingSource",
    });
    expect(STAFF_COLUMNS).toEqual([
      {
        id: "formalOfferSent",
        heading: "Formal Offer Sent",
        kind: "checkbox",
        field: "FORMAL_OFFER_SENT",
        stampKey: "formalOfferSentAt",
      },
      {
        id: "formalOfferAccepted",
        heading: "Formal Offer Accepted",
        kind: "checkbox",
        field: "FORMAL_OFFER_ACCEPTED",
        stampKey: "formalOfferAcceptedAt",
      },
      {
        id: "newHireForm",
        heading: "New Hire form done (or not needed)",
        kind: "select",
        field: "NEW_HIRE_FORM",
        valueKey: "newHireForm",
        stampKey: "newHireFormAt",
      },
      {
        id: "flsaConflictFound",
        heading: "Other Campus Job FLSA conflict found",
        kind: "checkbox",
        field: "FLSA_CONFLICT_FOUND",
        stampKey: "flsaConflictFoundAt",
      },
      {
        id: "flsaConflictResolved",
        heading: "Other Campus Job FLSA conflict resolved",
        kind: "checkbox",
        field: "FLSA_CONFLICT_RESOLVED",
        stampKey: "flsaConflictResolvedAt",
      },
      {
        id: "inUcpath",
        heading: "In UCPath",
        kind: "checkbox",
        field: "IN_UCPATH",
        stampKey: "inUcpathAt",
      },
      {
        id: "i9Complete",
        heading: "I-9 Complete",
        kind: "checkbox",
        field: "I9_COMPLETE",
        stampKey: "i9CompleteAt",
      },
      {
        id: "staffComments",
        heading: "Staff Comments",
        kind: "text",
        field: "STAFF_COMMENTS",
        valueKey: "staffComments",
      },
    ]);
    expect(hiringColumn("funding")).toBe(FUNDING_COLUMN);
    expect(hiringColumn("inUcpath")).toBe(STAFF_COLUMNS[5]);
    expect(hiringColumn("comments")).toBeUndefined();
    expect(hiringColumn("firstName")).toBeUndefined();
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

  test("layoutColumns: a text column reads the row's cell at its place among the text columns, under the backend's heading; a hiring column is itself", () => {
    const layout = layoutColumns(RESULTS_COLUMN_IDS, three.headers);

    expect(layout).toHaveLength(24);
    expect(layout[0]).toEqual({
      id: "firstName",
      heading: "First name",
      textIndex: 0,
      hiring: null,
    });
    expect(layout[8]).toEqual({
      id: "course",
      heading: "Course assignment",
      textIndex: 8,
      hiring: null,
    });
    expect(layout[9]).toEqual({
      id: "funding",
      heading: "Funding",
      textIndex: null,
      hiring: FUNDING_COLUMN,
    });
    // The text columns after Funding keep counting from where they were.
    expect(layout[10]).toEqual({
      id: "instructor",
      heading: "Course instructor",
      textIndex: 9,
      hiring: null,
    });
    expect(layout[15]).toEqual({
      id: "comments",
      heading: "Comments",
      textIndex: 14,
      hiring: null,
    });
    expect(layout[16]).toEqual({
      id: "formalOfferSent",
      heading: "Formal Offer Sent",
      textIndex: null,
      hiring: STAFF_COLUMNS[0],
    });
    expect(layout[23]).toEqual({
      id: "staffComments",
      heading: "Staff Comments",
      textIndex: null,
      hiring: STAFF_COLUMNS[7],
    });
    expect(
      layoutColumns(UNASSIGNED_COLUMN_IDS, three.unassignedHeaders).map(
        (column) => [column.heading, column.textIndex],
      ),
    ).toEqual(three.unassignedHeaders.map((heading, i) => [heading, i]));
  });

  test("layoutColumns: a missing heading is labelled by the id", () => {
    expect(layoutColumns(["firstName", "x", "funding"], ["F"])).toEqual([
      { id: "firstName", heading: "F", textIndex: 0, hiring: null },
      { id: "x", heading: "x", textIndex: 1, hiring: null },
      {
        id: "funding",
        heading: "Funding",
        textIndex: null,
        hiring: FUNDING_COLUMN,
      },
    ]);
  });

  test("columnChoices: every column but the first and last name, labelled by the headings", () => {
    expect(columnChoices(RESULTS_COLUMN_IDS, three.headers)).toEqual([
      { id: "email", label: "Email" },
      { id: "permNumber", label: "Perm number" },
      { id: "previousServiceAsUla", label: "Prev LA Qtrs" },
      { id: "graduationDate", label: "Expected grad date" },
      { id: "otherCampusJob", label: "Other Campus Job?" },
      { id: "employeeId", label: "Employee ID number" },
      { id: "course", label: "Course assignment" },
      { id: "funding", label: "Funding" },
      { id: "instructor", label: "Course instructor" },
      { id: "instructorEmail", label: "Course instructor email" },
      { id: "firstTimeUla", label: "First time ULA" },
      { id: "status", label: "Offer Status" },
      { id: "respondedAt", label: "Offer Response Date/Time" },
      { id: "comments", label: "Comments" },
      { id: "formalOfferSent", label: "Formal Offer Sent" },
      { id: "formalOfferAccepted", label: "Formal Offer Accepted" },
      { id: "newHireForm", label: "New Hire form done (or not needed)" },
      {
        id: "flsaConflictFound",
        label: "Other Campus Job FLSA conflict found",
      },
      {
        id: "flsaConflictResolved",
        label: "Other Campus Job FLSA conflict resolved",
      },
      { id: "inUcpath", label: "In UCPath" },
      { id: "i9Complete", label: "I-9 Complete" },
      { id: "staffComments", label: "Staff Comments" },
    ]);
    expect(
      columnChoices(UNASSIGNED_COLUMN_IDS, three.unassignedHeaders).map(
        (choice) => choice.id,
      ),
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

  // ---- issue #509: sorting the hiring columns ----

  const ada = three.hiring[12];
  const alan = three.hiring[13];
  const [formalOfferSent, formalOfferAccepted, newHireForm] = STAFF_COLUMNS;
  const staffComments = STAFF_COLUMNS[7];

  test("compareHiring, a checkbox: no record and no stamp are blank and come first; stamps order by time", () => {
    // Alan was sent his offer on 10/21, Ada on 10/27; Grace has no record.
    expect(compareHiring(formalOfferSent, null, ada)).toBe(-1);
    expect(compareHiring(formalOfferSent, ada, null)).toBe(1);
    expect(compareHiring(formalOfferSent, alan, ada)).toBe(-1);
    expect(compareHiring(formalOfferSent, ada, alan)).toBe(1);
    expect(compareHiring(formalOfferSent, ada, ada)).toBe(0);
    expect(compareHiring(formalOfferSent, null, null)).toBe(0);
    // A record without the stamp is as blank as no record.
    expect(compareHiring(formalOfferAccepted, alan, null)).toBe(0);
    expect(compareHiring(formalOfferAccepted, alan, ada)).toBe(-1);
    expect(compareHiring(formalOfferAccepted, ada, alan)).toBe(1);
  });

  test("compareHiring, New Hire form: blank, then Done, then Not needed; the same value by stamp", () => {
    expect(compareHiring(newHireForm, null, ada)).toBe(-1);
    expect(compareHiring(newHireForm, ada, null)).toBe(1);
    // Ada: Done on 10/29; Alan: Not needed on 10/30. The value decides, not the stamp.
    expect(compareHiring(newHireForm, ada, alan)).toBe(-1);
    expect(compareHiring(newHireForm, alan, ada)).toBe(1);
    const earlierDone = {
      ...alan,
      newHireForm: "DONE",
      newHireFormAt: "2025-10-22T09:00:00",
    };
    expect(compareHiring(newHireForm, earlierDone, ada)).toBe(-1);
    expect(compareHiring(newHireForm, ada, earlierDone)).toBe(1);
    expect(compareHiring(newHireForm, ada, { ...ada })).toBe(0);
    expect(compareHiring(newHireForm, null, null)).toBe(0);
    // Blank comes before Done even when neither has a stamp: the value alone decides.
    const unstampedDone = { ...ada, newHireFormAt: null };
    expect(compareHiring(newHireForm, null, unstampedDone)).toBe(-1);
    expect(compareHiring(newHireForm, unstampedDone, null)).toBe(1);
    expect(
      compareHiring(newHireForm, { ...alan, newHireForm: null }, unstampedDone),
    ).toBe(-1);
    // Not needed with no stamp still comes after Done.
    expect(
      compareHiring(newHireForm, ada, { ...alan, newHireFormAt: null }),
    ).toBe(-1);
  });

  test("compareHiring, Staff Comments and Funding: as text, blank first", () => {
    expect(compareHiring(staffComments, null, ada)).toBe(-1);
    expect(compareHiring(staffComments, ada, alan)).toBe(1);
    expect(compareHiring(staffComments, alan, null)).toBe(0);
    expect(
      compareHiring(staffComments, ada, { ...ada, staffComments: "Zzz" }),
    ).toBe(-1);
    expect(compareHiring(FUNDING_COLUMN, ada, alan)).toBe(1);
    expect(compareHiring(FUNDING_COLUMN, alan, ada)).toBe(-1);
    expect(
      compareHiring(FUNDING_COLUMN, ada, { ...ada, fundingSource: "ds-gift" }),
    ).toBe(1);
    expect(compareHiring(FUNDING_COLUMN, ada, { ...ada })).toBe(0);
  });
});
