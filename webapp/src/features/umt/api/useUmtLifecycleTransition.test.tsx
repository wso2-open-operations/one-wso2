// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy at
// http://www.apache.org/licenses/LICENSE-2.0

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));

const authedPut = vi.fn(() => Promise.resolve());
vi.mock("@api/http", async () => {
  const actual = await vi.importActual<typeof import("@api/http")>("@api/http");
  return { ...actual, authedPut: (...args: unknown[]) => authedPut(...(args as [])) };
});

const { useUmtLifecycleTransition } = await import("./useUmtLifecycleTransition");
const { umtServiceUrls } = await import("@config/apiConfig");

function renderTransition(id: string) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidateQueries = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useUmtLifecycleTransition(id), { wrapper });
  return { result, invalidateQueries };
}

beforeEach(() => {
  authedPut.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useUmtLifecycleTransition", () => {
  it("PUTs the next lifecycle state to the update endpoint", async () => {
    const { result } = renderTransition("42");

    await act(async () => {
      await result.current.mutateAsync("Released");
    });

    expect(authedPut).toHaveBeenCalledWith(umtServiceUrls.update("42"), "token", {
      lifecycleState: "Released",
    });
  });

  it("invalidates update, list, lifecycle-history, pull-request-analysis, and product-analysis queries on success", async () => {
    const { result, invalidateQueries } = renderTransition("42");

    await act(async () => {
      await result.current.mutateAsync("Released");
    });

    const invalidatedKeys = invalidateQueries.mock.calls.map((call) => call[0]?.queryKey?.[0]);
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([
        "umt-update",
        "umt-updates",
        "umt-update-lifecycle-history",
        "umt-update-pull-request-analysis",
        "umt-update-product-analysis",
      ]),
    );
  });
});
