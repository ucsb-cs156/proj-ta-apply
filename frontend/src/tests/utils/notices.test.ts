import { describe, test, expect } from "vitest";
import {
  AGREEMENT_LABEL,
  describeVersion,
  type NoticeVersion,
} from "main/utils/notices";
import noticesFixtures from "fixtures/noticesFixtures";

const taV1 = noticesFixtures.taV1 as NoticeVersion;

describe("notices utils", () => {
  test("the agreement wording is exactly what the issue asks for", () => {
    expect(AGREEMENT_LABEL).toBe(
      "I have read and understood the text above, and I agree to the terms and conditions it specifies",
    );
  });

  test("a version is described by its id and local save time", () => {
    const expected = `Version 1, saved ${new Date("2026-01-02T03:04:05").toLocaleString()}`;
    expect(describeVersion(taV1)).toBe(expected);
  });
});
