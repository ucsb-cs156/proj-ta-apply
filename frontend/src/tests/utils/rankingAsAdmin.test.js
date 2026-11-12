import { rankingAsAdminText } from "main/utils/rankingAsAdmin";

describe("rankingAsAdminText (issue #439)", () => {
  test("while reviews are open it says the instructor can change the ranking too", () => {
    expect(rankingAsAdminText("Open")).toBe(
      "You can enter and change the rankings for this course because you are an admin. What you save here is the course's faculty ranking, the same one its instructor sees. Faculty reviews are open, so the instructor can change it too.",
    );
  });

  test("once reviews are closed it says the instructor no longer can", () => {
    expect(rankingAsAdminText("Closed")).toBe(
      "You can enter and change the rankings for this course because you are an admin. What you save here is the course's faculty ranking, the same one its instructor sees. Faculty reviews are closed, so the instructor can no longer change it.",
    );
  });
});
