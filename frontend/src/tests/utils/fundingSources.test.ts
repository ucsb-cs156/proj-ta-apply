import { describe, expect, test } from "vitest";
import {
  ABBREVIATION_MAX,
  FUNDING_SOURCES_ALL_URL,
  FUNDING_SOURCES_CREATE_PATH,
  FUNDING_SOURCES_DELETE_URL,
  FUNDING_SOURCES_EDIT_PATH,
  FUNDING_SOURCES_LABEL,
  FUNDING_SOURCES_NOTE,
  FUNDING_SOURCES_PATH,
  FUNDING_SOURCES_POST_URL,
  FUNDING_SOURCES_PUT_URL,
  compareFundingSources,
  findFundingSource,
  fundingSourceCreatedToast,
  fundingSourceEditPath,
  fundingSourceUpdatedToast,
  sortFundingSources,
} from "main/utils/fundingSources";
import { fundingSourcesFixtures } from "fixtures/fundingSourcesFixtures";

describe("fundingSources constants (issue #512)", () => {
  test("the endpoints and pages hang off the admin's fundingSources paths", () => {
    expect(FUNDING_SOURCES_LABEL).toBe("Funding Sources");
    expect(FUNDING_SOURCES_ALL_URL).toBe("/api/admin/fundingSources/all");
    expect(FUNDING_SOURCES_POST_URL).toBe("/api/admin/fundingSources/post");
    expect(FUNDING_SOURCES_PUT_URL).toBe("/api/admin/fundingSources/put");
    expect(FUNDING_SOURCES_DELETE_URL).toBe("/api/admin/fundingSources/delete");
    expect(FUNDING_SOURCES_PATH).toBe("/admin/fundingSources");
    expect(FUNDING_SOURCES_CREATE_PATH).toBe("/admin/fundingSources/create");
    expect(FUNDING_SOURCES_EDIT_PATH).toBe(
      "/admin/fundingSources/edit/:abbreviation",
    );
  });

  test("the abbreviation limit matches the column, varchar(10)", () => {
    expect(ABBREVIATION_MAX).toBe(10);
  });

  test("the note explains the abbreviation and that it cannot change", () => {
    expect(FUNDING_SOURCES_NOTE).toBe(
      "The abbreviation is what the Funding dropdown on Soft Offer Results and its CSV show; the explanation says what it means. An abbreviation cannot be changed once created: to change one, delete it and create another.",
    );
  });

  test("the edit path encodes the abbreviation", () => {
    expect(fundingSourceEditPath("sub0")).toBe(
      "/admin/fundingSources/edit/sub0",
    );
    expect(fundingSourceEditPath("A/B C")).toBe(
      "/admin/fundingSources/edit/A%2FB%20C",
    );
  });

  test("the toasts name the abbreviation", () => {
    expect(fundingSourceCreatedToast("sub0")).toBe(
      "New funding source created - abbreviation: sub0",
    );
    expect(fundingSourceUpdatedToast("sub0")).toBe(
      "Funding source updated - abbreviation: sub0",
    );
  });

  test("sortFundingSources orders by abbreviation, case-sensitively, without changing its input", () => {
    const input = [...fundingSourcesFixtures.threeSourcesUnsorted];
    expect(sortFundingSources(input)).toEqual(
      fundingSourcesFixtures.threeSources,
    );
    expect(input).toEqual(fundingSourcesFixtures.threeSourcesUnsorted);
    // Equal keys keep their order; upper case sorts before lower case, as the key compares.
    const a = { abbreviation: "sub0", explanation: "lower" };
    const b = { abbreviation: "SUB0", explanation: "upper" };
    const c = { abbreviation: "SUB0", explanation: "upper again" };
    expect(sortFundingSources([a, b, c])).toEqual([b, c, a]);
    expect(sortFundingSources([c, b])).toEqual([c, b]);
  });

  test("compareFundingSources is -1, 0 or 1 by code-point order of the abbreviation", () => {
    const sub0 = { abbreviation: "sub0", explanation: "x" };
    const ulaGift = { abbreviation: "ula-gift", explanation: "y" };
    const sub0Again = { abbreviation: "sub0", explanation: "z" };
    expect(compareFundingSources(sub0, ulaGift)).toBe(-1);
    expect(compareFundingSources(ulaGift, sub0)).toBe(1);
    expect(compareFundingSources(sub0, sub0Again)).toBe(0);
  });

  test("sortFundingSources treats a list that is not here yet as empty", () => {
    expect(sortFundingSources(undefined)).toEqual([]);
    expect(sortFundingSources([])).toEqual([]);
  });

  test("findFundingSource picks the source with that abbreviation, case-sensitively", () => {
    expect(
      findFundingSource(fundingSourcesFixtures.threeSources, "sub0"),
    ).toEqual(fundingSourcesFixtures.oneSource);
    expect(
      findFundingSource(fundingSourcesFixtures.threeSources, "SUB0"),
    ).toBeUndefined();
    expect(
      findFundingSource(fundingSourcesFixtures.threeSources, "startup"),
    ).toBeUndefined();
    expect(
      findFundingSource(fundingSourcesFixtures.threeSources, undefined),
    ).toBeUndefined();
    expect(findFundingSource(undefined, "sub0")).toBeUndefined();
    expect(findFundingSource(undefined, undefined)).toBeUndefined();
    expect(findFundingSource([], "sub0")).toBeUndefined();
  });
});
