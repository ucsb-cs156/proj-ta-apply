import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import {
  RELEASE_SOFT_OFFERS_LABEL,
  SOFT_OFFERS_URL,
  canReleaseSoftOffers,
  hiringDecisionsTentative,
  softOffersReleased,
} from "main/utils/softOffers";

describe("softOffers utilities (issue #485)", () => {
  const ula = recruitmentsFixtures.publishedUla;

  test("the label and the endpoint", () => {
    expect(RELEASE_SOFT_OFFERS_LABEL).toBe("Release Soft Offers");
    expect(SOFT_OFFERS_URL).toBe("/api/admin/recruitments/softOffers");
  });

  test("softOffersReleased: a release moment on file, null or absent", () => {
    expect(softOffersReleased(ula)).toBe(false);
    expect(softOffersReleased({})).toBe(false);
    expect(softOffersReleased(recruitmentsFixtures.releasedUla)).toBe(true);
  });

  test("canReleaseSoftOffers: ULA, hiring decisions released, soft offers not yet", () => {
    expect(canReleaseSoftOffers(ula)).toBe(true);
    expect(canReleaseSoftOffers({ ...ula, type: "TA" })).toBe(false);
    expect(canReleaseSoftOffers({ ...ula, assignmentsPublished: false })).toBe(
      false,
    );
    expect(
      canReleaseSoftOffers({ ...ula, assignmentsPublished: undefined }),
    ).toBe(false);
    expect(canReleaseSoftOffers(recruitmentsFixtures.releasedUla)).toBe(false);
  });

  test("hiringDecisionsTentative: applications or faculty ranking open again", () => {
    expect(hiringDecisionsTentative(ula)).toBe(false);
    expect(
      hiringDecisionsTentative({ ...ula, applicationStatus: "OPEN" }),
    ).toBe(true);
    expect(hiringDecisionsTentative({ ...ula, reviewStatus: "Open" })).toBe(
      true,
    );
    expect(
      hiringDecisionsTentative({ ...ula, reviewStatus: "NotStarted" }),
    ).toBe(false);
  });
});
