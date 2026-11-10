import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { beforeEach, describe, expect, test } from "vitest";

import { useBudgetSaves } from "main/components/Budget/useBudgetSaves";
import budgetFixtures from "fixtures/budgetFixtures";

const axiosMock = new AxiosMockAdapter(axios);

const atCounts = (version, conversionVersion) => ({
  ...budgetFixtures.bothTypes,
  budget: { ...budgetFixtures.bothTypes.budget, version, conversionVersion },
});

const budgetPuts = () =>
  axiosMock.history.put.filter((r) => r.url === "/api/admin/budget");

/**
 * The hook on its own, for what no page can do through its boxes: two boxes being edited at once,
 * one guarded by each count. (A page has only one box with focus at a time.)
 */
describe("useBudgetSaves (issue #426)", () => {
  beforeEach(() => {
    axiosMock.reset();
    axiosMock.resetHistory();
  });

  test("this tab's save of a budget line moves on only the boxes guarded by the lines' version, never the factor's", async () => {
    axiosMock.onPut("/api/admin/budget").reply(200, atCounts(2, 1));
    const client = new QueryClient();
    const { result } = renderHook(
      () => useBudgetSaves("20264", atCounts(1, 1), {}, 1),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
      },
    );

    act(() => {
      result.current.startEditing("conversionTAtoULA");
      result.current.startEditing("tasOnlyBudget");
      result.current.save("tasOnlyBudget", "5");
    });
    await waitFor(() => expect(budgetPuts()).toHaveLength(1));
    act(() => {
      result.current.save("conversionTAtoULA", "2");
    });

    await waitFor(() => expect(budgetPuts()).toHaveLength(2));
    expect(budgetPuts().map((r) => r.params)).toEqual([
      { quarter: "20264", tasOnlyBudget: "5", version: 1 },
      // The factor's box started from count 1, and nothing has moved that count since.
      { quarter: "20264", conversionTAtoULA: "2", conversionVersion: 1 },
    ]);
  });

  const wrapperWith = (client) =>
    function Wrapper({ children }) {
      return (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
    };

  test("a box that began before another tab's change keeps its count when a later box's own save moves on", async () => {
    axiosMock.onPut("/api/admin/budget").reply(200, atCounts(3, 1));
    const { result, rerender } = renderHook(
      ({ summary, readAt }) => useBudgetSaves("20264", summary, {}, readAt),
      {
        wrapper: wrapperWith(new QueryClient()),
        initialProps: { summary: atCounts(1, 1), readAt: 1 },
      },
    );
    act(() => {
      result.current.startEditing("unrestrictedBudget");
    });
    // A refresh: another tab saved a line, so the version is 2 now.
    rerender({ summary: atCounts(2, 1), readAt: 2 });
    act(() => {
      result.current.startEditing("tasOnlyBudget");
      result.current.save("tasOnlyBudget", "5");
    });
    await waitFor(() => expect(budgetPuts()).toHaveLength(1));
    act(() => {
      result.current.save("unrestrictedBudget", "7");
    });

    await waitFor(() => expect(budgetPuts()).toHaveLength(2));
    expect(budgetPuts().map((r) => r.params.version)).toEqual([2, 1]);
  });

  test("a box not being edited saves with the count the last save came back with, before any re-read", async () => {
    axiosMock.onPut("/api/admin/budget").reply(200, atCounts(2, 1));
    const { result } = renderHook(
      () => useBudgetSaves("20264", atCounts(1, 1), {}, 1),
      { wrapper: wrapperWith(new QueryClient()) },
    );

    act(() => {
      result.current.save("tasOnlyBudget", "5");
      result.current.save("tasOnlyBudget", "6");
    });

    await waitFor(() => expect(budgetPuts()).toHaveLength(2));
    expect(budgetPuts().map((r) => r.params.version)).toEqual([1, 2]);
  });
});
