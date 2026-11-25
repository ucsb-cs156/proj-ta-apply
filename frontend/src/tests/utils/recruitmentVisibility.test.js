import {
  HIDDEN_BADGE,
  HIDDEN_URL,
  HIDE_TOOLTIP,
  hiddenToast,
  isHidden,
} from "main/utils/recruitmentVisibility";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

describe("recruitmentVisibility tests (issue #496)", () => {
  test("the words and the endpoint", () => {
    expect(HIDE_TOOLTIP).toBe(
      "This button will show/hide the recruitment from students and instructors.",
    );
    expect(HIDDEN_BADGE).toBe("Hidden");
    expect(HIDDEN_URL).toBe("/api/admin/recruitments/hidden");
    expect(hiddenToast(true)).toBe(
      "Recruitment hidden from students and instructors.",
    );
    expect(hiddenToast(false)).toBe(
      "Recruitment shown to students and instructors.",
    );
  });

  test("isHidden: only an explicit true; older data without the field is shown", () => {
    expect(isHidden(recruitmentsFixtures.hiddenTa)).toBe(true);
    expect(isHidden(recruitmentsFixtures.threeRecruitments[2])).toBe(false);
    expect(isHidden({ ...recruitmentsFixtures.hiddenTa, hidden: false })).toBe(
      false,
    );
    expect(
      isHidden({ ...recruitmentsFixtures.hiddenTa, hidden: undefined }),
    ).toBe(false);
  });
});
