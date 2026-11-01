import { describe, expect, test } from "vitest";
import {
  DEVELOPER_MODE_KEY,
  DEVELOPER_MODE_OFF,
} from "main/utils/developerMode";

describe("developerMode utilities", () => {
  test("the shared query key is the endpoint", () => {
    expect(DEVELOPER_MODE_KEY).toBe("/api/developerMode");
  });

  test("until the backend answers, the switch counts as unavailable and off", () => {
    expect(DEVELOPER_MODE_OFF).toEqual({ available: false, on: false });
  });
});
