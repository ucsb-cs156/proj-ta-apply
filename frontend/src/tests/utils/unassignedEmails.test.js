import {
  COPY_UNASSIGNED_LABEL,
  COPY_UNASSIGNED_TOOLTIP,
  EVERY_ASSIGNED_TOOLTIP,
  unassignedEmails,
} from "main/utils/unassignedEmails";
import assignmentsFixtures from "fixtures/assignmentsFixtures";

const row = (email, tentativeAssignment) => ({
  applicationId: 1,
  identity: { firstName: "A", lastName: "B", email },
  tentativeAssignment,
  rankings: {},
  preferences: {},
});

describe("unassignedEmails tests (issue #497)", () => {
  test("the words", () => {
    expect(COPY_UNASSIGNED_LABEL).toBe(
      "Copy emails of applicants with no assignment",
    );
    expect(COPY_UNASSIGNED_TOOLTIP).toBe(
      "Copies the email of every applicant whose Tentative Assignment is blank, each once, in the table's order. Cancelled applications are not included.",
    );
    expect(EVERY_ASSIGNED_TOOLTIP).toBe("Every applicant has an assignment.");
  });

  test("only the rows with no tentative assignment, in table order, each email once, no blanks", () => {
    expect(
      unassignedEmails([
        row("c@ucsb.edu", null),
        row("a@ucsb.edu", 10),
        row("b@ucsb.edu", null),
        row("c@ucsb.edu", null),
        row("", null),
        row(undefined, null),
        row("d@ucsb.edu", 0),
      ]),
    ).toEqual(["c@ucsb.edu", "b@ucsb.edu"]);
  });

  test("the fixtures: one unassigned applicant on the TA page, none when all are placed", () => {
    expect(unassignedEmails(assignmentsFixtures.taPage.rows)).toEqual([
      "blank@ucsb.edu",
    ]);
    expect(
      unassignedEmails(
        assignmentsFixtures.taPage.rows.map((r) => ({
          ...r,
          tentativeAssignment: 10,
        })),
      ),
    ).toEqual([]);
    expect(unassignedEmails([])).toEqual([]);
  });
});
