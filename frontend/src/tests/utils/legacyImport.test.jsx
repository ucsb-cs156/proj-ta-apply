import {
  LEGACY_CSV_HELP_PATH,
  LEGACY_IMPORT_URL,
  importSummary,
  taQuarterOptions,
} from "main/utils/legacyImport";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

describe("legacyImport utilities", () => {
  test("the endpoint and help anchor", () => {
    expect(LEGACY_IMPORT_URL).toBe("/api/admin/applications/legacy/upload");
    expect(LEGACY_CSV_HELP_PATH).toBe("/help/csv#legacy-ta-applications");
  });

  test("taQuarterOptions lists only TA recruitments, newest quarter first, as QYY", () => {
    expect(taQuarterOptions(recruitmentsFixtures.threeRecruitments)).toEqual([
      { quarter: "20262", label: "S26" },
      { quarter: "20261", label: "W26" },
    ]);
    expect(taQuarterOptions([])).toEqual([]);
    // Sorted by quarter, whatever order the recruitments arrive in.
    const [s26, , w26] = recruitmentsFixtures.threeRecruitments;
    expect(
      taQuarterOptions([w26, { ...w26, id: 9, quarter: "20264" }, s26]),
    ).toEqual([
      { quarter: "20264", label: "F26" },
      { quarter: "20262", label: "S26" },
      { quarter: "20261", label: "W26" },
    ]);
    expect(
      taQuarterOptions([
        { ...recruitmentsFixtures.threeRecruitments[1], quarter: "20264" },
      ]),
    ).toEqual([]);
    // The input is not reordered in place.
    expect(recruitmentsFixtures.threeRecruitments[0].id).toBe(3);
  });

  test("importSummary counts, pluralizes and lists the skipped rows", () => {
    expect(
      importSummary({
        inserted: 2,
        alreadyPresent: 1,
        skipped: 1,
        problems: ["row 4: no usable email address"],
        addedTopics: [],
      }),
    ).toBe(
      "Import complete: 2 applications added, 1 already present, 1 row skipped (row 4: no usable email address)",
    );
    expect(
      importSummary({
        inserted: 1,
        alreadyPresent: 0,
        skipped: 2,
        problems: ["a", "b"],
      }),
    ).toBe(
      "Import complete: 1 application added, 0 already present, 2 rows skipped (a; b)",
    );
    expect(
      importSummary({
        inserted: 0,
        alreadyPresent: 86,
        skipped: 0,
        problems: [],
      }),
    ).toBe(
      "Import complete: 0 applications added, 86 already present, 0 rows skipped",
    );
  });
});
