import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import softOfferFixtures from "fixtures/softOfferFixtures";
import softOfferResultsFixtures from "fixtures/softOfferResultsFixtures";
import {
  COPY_EMAILS_LABEL,
  DECLINED_STATUS,
  EMAIL_BUCKETS,
  PROCEED_STATUS,
  RELEASE_SOFT_OFFERS_LABEL,
  softOfferEmailBuckets,
  SOFT_OFFER_RESULTS_LABEL,
  SOFT_OFFER_RESULTS_URL,
  countsSentence,
  deadlineAsLocal,
  formatStamp,
  isStaleStatus,
  softOfferResultsCsvFileName,
  softOfferResultsCsvUrl,
  softOfferResultsPath,
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

  // ---- the admin's results (issue #487) ----

  test("the results page's label, path, endpoint and CSV", () => {
    expect(SOFT_OFFER_RESULTS_LABEL).toBe("Soft Offer Results");
    expect(SOFT_OFFER_RESULTS_URL).toBe("/api/admin/softOffers");
    expect(softOfferResultsPath(5)).toBe("/admin/recruitments/5/softOffers");
    expect(softOfferResultsCsvUrl("5")).toBe(
      "/api/admin/softOffers/csv?recruitmentId=5",
    );
    expect(softOfferResultsCsvFileName(5)).toBe("soft-offers-5.csv");
  });

  test("isStaleStatus: an answer for another lecture", () => {
    expect(isStaleStatus("Proceed (for CMPSC 8)")).toBe(true);
    expect(isStaleStatus("Declined (for lecture 99)")).toBe(true);
    expect(isStaleStatus("Proceed")).toBe(false);
    expect(isStaleStatus("")).toBe(false);
  });

  test("formatStamp: Pacific form, keeping the late mark, empty stays empty", () => {
    expect(formatStamp("2025-10-22T08:00")).toBe("10/22/2025, 8:00:00 AM");
    expect(formatStamp("2025-10-26T09:00 (late)")).toBe(
      "10/26/2025, 9:00:00 AM (late)",
    );
    expect(formatStamp("")).toBe("");
  });

  test("deadlineAsLocal: the stored deadline without its seconds, or empty", () => {
    expect(deadlineAsLocal("2025-10-25T17:00:00")).toBe("2025-10-25T17:00");
    expect(deadlineAsLocal("2025-10-25T17:00")).toBe("2025-10-25T17:00");
    expect(deadlineAsLocal(null)).toBe("");
    expect(deadlineAsLocal(undefined)).toBe("");
  });

  test("countsSentence: singular and plural", () => {
    expect(
      countsSentence({ assigned: 3, proceed: 1, declined: 0, none: 2 }),
    ).toBe("3 assigned ULAs: 1 proceed, 0 declined, 2 no response yet.");
    expect(
      countsSentence({ assigned: 1, proceed: 0, declined: 1, none: 0 }),
    ).toBe("1 assigned ULA: 0 proceed, 1 declined, 0 no response yet.");
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

  // ---- issue #511: the Copy Soft Offer Emails buttons ----

  test("the copy line's label, status words and four buttons", () => {
    expect(COPY_EMAILS_LABEL).toBe("Copy Soft Offer Emails:");
    expect(PROCEED_STATUS).toBe("Proceed");
    expect(DECLINED_STATUS).toBe("Declined");
    expect(EMAIL_BUCKETS).toEqual([
      { id: "all", label: "All" },
      { id: "proceed", label: 'Responded "Proceed"' },
      { id: "declined", label: 'Responded "Declined"' },
      { id: "none", label: "No Response" },
    ]);
  });

  test("softOfferEmailBuckets splits the rows as the counts do, in table order", () => {
    const { rows } = softOfferResultsFixtures.three;
    const declinedRow = [
      ...rows[2].slice(0, 12),
      "Declined",
      "2025-10-23T10:30",
      "",
    ];
    declinedRow[2] = "linus@ucsb.edu";
    expect(softOfferEmailBuckets([...rows, declinedRow])).toEqual({
      all: [
        "grace@ucsb.edu",
        "ada@ucsb.edu",
        "alan@ucsb.edu",
        "linus@ucsb.edu",
      ],
      proceed: ["ada@ucsb.edu"],
      declined: ["linus@ucsb.edu"],
      // A stale answer ("Proceed (for CMPSC 8)") and a blank one are both no response.
      none: ["grace@ucsb.edu", "alan@ucsb.edu"],
    });
    expect(softOfferEmailBuckets([])).toEqual({
      all: [],
      proceed: [],
      declined: [],
      none: [],
    });
  });
});
