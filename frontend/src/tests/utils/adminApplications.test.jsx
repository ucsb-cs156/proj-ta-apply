import {
  adminApplicationEditPath,
  adminApplicationPath,
  applicationsListPath,
  receivedText,
  submittedText,
} from "main/utils/adminApplications";
import applicationsFixtures from "fixtures/applicationsFixtures";

describe("adminApplications utils", () => {
  test("submittedText shows the time in Pacific time, or nothing when unstamped", () => {
    expect(submittedText("2026-01-12T14:05:00")).toBe("1/12/2026, 2:05:00 PM");
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

  test("receivedText counts fake developer-mode applications apart too", () => {
    const fake = { ...applicationsFixtures.oneTestApplication, id: 98 };
    fake.origin = "DEVELOPER_MODE";
    expect(receivedText([fake])).toBe(
      "0 Applications Received (plus 1 fake application)",
    );
    expect(
      receivedText([
        applicationsFixtures.oneTaApplication,
        applicationsFixtures.oneTestApplication,
        fake,
        { ...fake, id: 99 },
      ]),
    ).toBe(
      "1 Application Received (plus 1 test application and 2 fake applications)",
    );
  });

  test("the application view and edit paths take a number or a string id", () => {
    expect(adminApplicationPath(5)).toBe("/admin/applications/5");
    expect(adminApplicationPath("5")).toBe("/admin/applications/5");
    expect(adminApplicationEditPath(5)).toBe("/admin/applications/5/edit");
    expect(adminApplicationEditPath("5")).toBe("/admin/applications/5/edit");
  });

  test("applicationsListPath points at the recruitment's applications page", () => {
    expect(applicationsListPath(7)).toBe("/admin/recruitments/7/applications");
    expect(applicationsListPath("7")).toBe(
      "/admin/recruitments/7/applications",
    );
  });
});
