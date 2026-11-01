import { describe, expect, test } from "vitest";
import {
  TARGET_HEADINGS,
  TARGET_IDS,
  targetsColumns,
} from "main/utils/courseTargets";

describe("courseTargets", () => {
  test("the four headings and their test ids, in order", () => {
    expect(TARGET_HEADINGS).toEqual([
      "Hiring Target",
      "Ranking Target",
      "Candidates Ranked",
      "Rankings Still Needed",
    ]);
    expect(TARGET_IDS).toEqual([
      "hiring-target",
      "ranking-target",
      "candidates-ranked",
      "rankings-still-needed",
    ]);
  });

  test("targetsColumns lays the figures under the headings with the prefixed test ids", () => {
    expect(
      targetsColumns(
        {
          recruitmentCourseId: 2,
          allocation: 2,
          candidateCount: 7,
          rankingTarget: 4,
          rankedCount: 1,
          stillNeeded: 3,
        },
        "P",
      ),
    ).toEqual([
      {
        label: "Hiring Target",
        value: "2",
        text: "2",
        testId: "P-hiring-target",
      },
      {
        label: "Ranking Target",
        value: "4",
        text: "4",
        testId: "P-ranking-target",
      },
      {
        label: "Candidates Ranked",
        value: "1",
        text: "1",
        testId: "P-candidates-ranked",
      },
      {
        label: "Rankings Still Needed",
        value: "3",
        text: "3",
        testId: "P-rankings-still-needed",
      },
    ]);
  });

  test("zeros are kept as text, not dropped", () => {
    const columns = targetsColumns(
      {
        recruitmentCourseId: 1,
        allocation: 0,
        candidateCount: 0,
        rankingTarget: 0,
        rankedCount: 0,
        stillNeeded: 0,
      },
      "Z",
    );
    expect(columns.map((c) => c.value)).toEqual(["0", "0", "0", "0"]);
    expect(columns.map((c) => c.text)).toEqual(["0", "0", "0", "0"]);
  });
});
