import {
  candidateColumnChoices,
  candidateColumnsStorageKey,
} from "main/utils/candidateColumns";

describe("candidateColumns", () => {
  test("the storage key is per recruitment and type", () => {
    expect(candidateColumnsStorageKey("7", "TA")).toBe(
      "candidateRanking.hiddenColumns.7.TA",
    );
    expect(candidateColumnsStorageKey(8, "ULA")).toBe(
      "candidateRanking.hiddenColumns.8.ULA",
    );
  });

  test("the choices leave out the rank and the names, keeping order and labels", () => {
    expect(
      candidateColumnChoices([
        { key: "rank", label: "Ranking" },
        { key: "preference", label: "Course Preference" },
        { key: "firstName", label: "First Name" },
        { key: "lastName", label: "Last Name" },
        { key: "email", label: "Email" },
      ]),
    ).toEqual([
      { id: "preference", label: "Course Preference" },
      { id: "email", label: "Email" },
    ]);
  });
});
