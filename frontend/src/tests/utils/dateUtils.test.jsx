import { formatTime } from "main/utils/dateUtils";

describe("dateUtils tests", () => {
  describe("formatTime", () => {
    test("formats an instant as Pacific time", () => {
      expect(formatTime("2023-01-01T12:30:45.000Z")).toBe(
        "1/1/2023, 4:30:45 AM",
      );
    });

    test("shows a zone-less stamp, which is already Pacific, as it reads", () => {
      expect(formatTime("2023-01-01T10:05:00")).toBe("1/1/2023, 10:05:00 AM");
    });

    test("returns empty string for null timestamp", () => {
      expect(formatTime(null)).toBe("");
    });

    test("returns empty string for undefined timestamp", () => {
      expect(formatTime(undefined)).toBe("");
    });

    test("returns empty string for empty string timestamp", () => {
      expect(formatTime("")).toBe("");
    });
  });
});
