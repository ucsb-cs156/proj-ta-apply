import { describe, expect, test } from "vitest";
import { carryOverTo } from "main/utils/prefillCarryOver";
import type { Application } from "main/components/Applications/ApplicationTable";

const earlier = {
  firstName: "Ula",
  firstChoiceCourse: "CMPSC   8",
  secondChoiceCourse: "CMPSC  16",
  availableForLecturesFirstChoice: true,
  availableForDiscussionFirstChoice: true,
  availabilityCommentsFirstChoice: "mwf",
  availableForLecturesSecondChoice: true,
  availableForDiscussionSecondChoice: true,
  availabilityCommentsSecondChoice: "tr",
  courseInterests: {
    "CMPSC  24": "ENTHUSIASTIC",
    "CMPSC 130A": "WOULD_CONSIDER",
  },
  topicProficiencies: { Python: 5, Java: 3 },
  interests: { Teaching: 5, Grading: 2 },
} as unknown as Application;

describe("carryOverTo (issue #307)", () => {
  test("keeps only the answers for what the recruitment also has", () => {
    const kept = carryOverTo(
      earlier,
      ["CMPSC   8", "CMPSC  24"],
      ["Python"],
      ["Teaching"],
    );
    expect(kept.firstName).toBe("Ula");
    expect(kept.firstChoiceCourse).toBe("CMPSC   8");
    expect(kept.availableForLecturesFirstChoice).toBe(true);
    expect(kept.availableForDiscussionFirstChoice).toBe(true);
    expect(kept.availabilityCommentsFirstChoice).toBe("mwf");
    expect(kept.courseInterests).toEqual({ "CMPSC  24": "ENTHUSIASTIC" });
    expect(kept.topicProficiencies).toEqual({ Python: 5 });
    expect(kept.interests).toEqual({ Teaching: 5 });
  });

  test("a choice that is not offered is cleared with its availability", () => {
    const kept = carryOverTo(earlier, ["CMPSC   8"], [], []);
    expect(kept.secondChoiceCourse).toBeNull();
    expect(kept.availableForLecturesSecondChoice).toBe(false);
    expect(kept.availableForDiscussionSecondChoice).toBe(false);
    expect(kept.availabilityCommentsSecondChoice).toBeNull();
    const none = carryOverTo(earlier, [], [], []);
    expect(none.firstChoiceCourse).toBeNull();
    expect(none.availableForLecturesFirstChoice).toBe(false);
    expect(none.availableForDiscussionFirstChoice).toBe(false);
    expect(none.availabilityCommentsFirstChoice).toBeNull();
    expect(none.courseInterests).toEqual({});
  });

  test("a second choice survives without the first, and nulls are tolerated", () => {
    const kept = carryOverTo(earlier, ["CMPSC  16"], [], []);
    expect(kept.firstChoiceCourse).toBeNull();
    expect(kept.secondChoiceCourse).toBe("CMPSC  16");
    expect(kept.availabilityCommentsSecondChoice).toBe("tr");
    const bare = carryOverTo(
      {
        ...earlier,
        firstChoiceCourse: null,
        secondChoiceCourse: null,
        courseInterests: null,
        topicProficiencies: null,
        interests: null,
      } as unknown as Application,
      ["CMPSC   8"],
      ["Python"],
      ["Teaching"],
    );
    expect(bare.firstChoiceCourse).toBeNull();
    expect(bare.topicProficiencies).toEqual({});
    expect(bare.interests).toEqual({});
  });
});
