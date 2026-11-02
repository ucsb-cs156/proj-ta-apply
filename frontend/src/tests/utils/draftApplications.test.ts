import { describe, expect, test } from "vitest";
import {
  DRAFT_WARNING,
  draftFor,
  draftWasSaved,
  type DraftApplication,
} from "main/utils/draftApplications";
import draftApplicationsFixtures from "fixtures/draftApplicationsFixtures";

const empty = draftApplicationsFixtures.emptyUlaDraft as DraftApplication;
const saved = draftApplicationsFixtures.savedUlaDraft as DraftApplication;

describe("draftApplications", () => {
  test("the warning says an incomplete application is not considered", () => {
    expect(DRAFT_WARNING).toBe(
      "Your application is not yet complete; incomplete applications are not considered.",
    );
  });

  test("draftFor finds the draft for a recruitment, or nothing", () => {
    const other = { ...saved, id: 30, recruitmentId: 9 };
    expect(draftFor([empty, other], 9)).toBe(other);
    expect(draftFor([empty, other], 2)).toBe(empty);
    expect(draftFor([empty, other], 3)).toBeUndefined();
    expect(draftFor([], 2)).toBeUndefined();
  });

  test("a draft has been saved once the form has given it a first name, even an empty one", () => {
    expect(draftWasSaved(empty)).toBe(false);
    expect(draftWasSaved({ ...empty, firstName: undefined })).toBe(false);
    expect(draftWasSaved(saved)).toBe(true);
    expect(draftWasSaved({ ...saved, firstName: "" })).toBe(true);
  });
});
