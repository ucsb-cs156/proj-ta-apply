import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";

import { useRememberedOpen } from "main/utils/useRememberedOpen";

describe("useRememberedOpen", () => {
  beforeEach(() => localStorage.clear());

  test("with nothing remembered it starts as the default says, and stores nothing until toggled", () => {
    const open = renderHook(() => useRememberedOpen("k.open", true));
    expect(open.result.current[0]).toBe(true);
    const closed = renderHook(() => useRememberedOpen("k.closed", false));
    expect(closed.result.current[0]).toBe(false);
    expect(localStorage.length).toBe(0);
  });

  test("toggling flips the state and remembers it as open or closed", () => {
    const { result } = renderHook(() => useRememberedOpen("k", true));

    act(() => result.current[1]());
    expect(result.current[0]).toBe(false);
    expect(localStorage.getItem("k")).toBe("closed");

    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
    expect(localStorage.getItem("k")).toBe("open");
  });

  test("what was remembered wins over the default", () => {
    localStorage.setItem("k", "closed");
    expect(
      renderHook(() => useRememberedOpen("k", true)).result.current[0],
    ).toBe(false);

    localStorage.setItem("k", "open");
    expect(
      renderHook(() => useRememberedOpen("k", false)).result.current[0],
    ).toBe(true);
  });

  test("anything else remembered under the key counts as closed", () => {
    localStorage.setItem("k", "true");
    expect(
      renderHook(() => useRememberedOpen("k", true)).result.current[0],
    ).toBe(false);
  });

  test("each key is remembered on its own", () => {
    const { result } = renderHook(() => useRememberedOpen("one", false));
    act(() => result.current[1]());
    expect(localStorage.getItem("one")).toBe("open");
    expect(localStorage.getItem("two")).toBeNull();
    expect(
      renderHook(() => useRememberedOpen("two", false)).result.current[0],
    ).toBe(false);
  });
});
