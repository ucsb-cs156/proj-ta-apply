import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import softOfferFixtures from "fixtures/softOfferFixtures";
import {
  RELEASE_SOFT_OFFERS_LABEL,
  SOFT_OFFERS_MINE_URL,
  SOFT_OFFERS_RESPOND_URL,
  SOFT_OFFERS_URL,
  SOFT_OFFER_DECISIONS,
  canReleaseSoftOffers,
  deadlineSentence,
  decisionLabel,
  decisionSentence,
  hiringDecisionsTentative,
  offerFor,
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

  // ---- the applicant's side (issue #486) ----

  test("the applicant endpoints and the two choices in order", () => {
    expect(SOFT_OFFERS_MINE_URL).toBe("/api/softOffers/mine");
    expect(SOFT_OFFERS_RESPOND_URL).toBe("/api/softOffers/respond");
    expect(SOFT_OFFER_DECISIONS).toEqual([
      {
        decision: "PROCEED",
        label: "Please proceed with a formal offer; I am likely to accept.",
      },
      { decision: "DECLINE", label: "I would like to decline this offer." },
    ]);
    expect(decisionLabel("PROCEED")).toBe(
      "Please proceed with a formal offer; I am likely to accept.",
    );
    expect(decisionLabel("DECLINE")).toBe(
      "I would like to decline this offer.",
    );
  });

  test("decisionSentence: one sentence per choice, both saying whom to contact", () => {
    expect(decisionSentence("PROCEED")).toBe(
      "You have indicated that you would like to proceed to a formal offer. If you change your mind after submitting this form, please contact the ULA program directors, or the CS Department Student Affairs Manager.",
    );
    expect(decisionSentence("DECLINE")).toBe(
      "You have indicated that you would like to decline this offer. If you change your mind after submitting this form, please contact the ULA program directors, or the CS Department Student Affairs Manager.",
    );
  });

  test("deadlineSentence shows the deadline in Pacific time", () => {
    expect(deadlineSentence("2026-02-25T17:00:00")).toBe(
      "Please choose an option below by 2/25/2026, 5:00:00 PM. If you do not respond by that deadline, we may need to offer this position to another candidate.",
    );
  });

  test("offerFor finds the offer of a recruitment's card", () => {
    const offers = [softOfferFixtures.pending];
    expect(offerFor(offers, 2)).toBe(softOfferFixtures.pending);
    expect(offerFor(offers, 1)).toBeUndefined();
    expect(offerFor([], 2)).toBeUndefined();
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
