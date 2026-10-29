import {
  applicationsListPath,
  receivedText,
  submittedText,
} from "main/utils/adminApplications";
import applicationsFixtures from "fixtures/applicationsFixtures";

describe("adminApplications utils", () => {
  test("submittedText shows the time in the local locale, or nothing when unstamped", () => {
    expect(submittedText("2026-01-12T14:05:00")).toBe(
      new Date("2026-01-12T14:05:00").toLocaleString(),
    );
    expect(submittedText("2026-01-12T14:05:00")).not.toBe("");
    expect(submittedText(null)).toBe("");
  });

  test("receivedText counts real applications, singular and plural", () => {
    expect(receivedText([])).toBe("0 Applications Received");
    expect(receivedText([applicationsFixtures.oneTaApplication])).toBe(
      "1 Application Received",
    );
    expect(receivedText(applicationsFixtures.twoApplications)).toBe(
      "2 Applications Received",
    );
  });

  test("receivedText counts test applications apart", () => {
    expect(
      receivedText(applicationsFixtures.threeApplicationsIncludingATest),
    ).toBe("2 Applications Received (plus 1 test application)");
    expect(
      receivedText([
        applicationsFixtures.oneTestApplication,
        { ...applicationsFixtures.oneTestApplication, id: 99 },
      ]),
    ).toBe("0 Applications Received (plus 2 test applications)");
  });

  test("applicationsListPath points at the recruitment's applications page", () => {
    expect(applicationsListPath(7)).toBe("/admin/recruitments/7/applications");
    expect(applicationsListPath("7")).toBe(
      "/admin/recruitments/7/applications",
    );
  });
});
