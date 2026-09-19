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

const { useUmtCompleteUpdate } = await import("./useUmtVerifying");
const { umtServiceUrls } = await import("@config/apiConfig");

function renderCompleteUpdate(id: string) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidateQueries = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useUmtCompleteUpdate(id), { wrapper });
  return { result, invalidateQueries };
}

beforeEach(() => {
  authedPut.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useUmtCompleteUpdate", () => {
  it("PUTs lifecycleState Completed with the public pull requests and reason", async () => {
    const { result } = renderCompleteUpdate("42");

    await act(async () => {
      await result.current.mutateAsync({
        publicPullRequests: ["https://github.com/wso2/carbon-kernel/pull/123"],
        reason: "",
      });
    });

    expect(authedPut).toHaveBeenCalledWith(umtServiceUrls.update("42"), "token", {
      lifecycleState: "Completed",
      publicPullRequests: ["https://github.com/wso2/carbon-kernel/pull/123"],
      reason: "",
    });
  });

  it("invalidates update, list, and lifecycle-history queries on success", async () => {
    const { result, invalidateQueries } = renderCompleteUpdate("42");

    await act(async () => {
      await result.current.mutateAsync({ publicPullRequests: [], reason: "Reason given." });
    });

    const invalidatedKeys = invalidateQueries.mock.calls.map((call) => call[0]?.queryKey?.[0]);
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining(["umt-update", "umt-updates", "umt-update-lifecycle-history"]),
    );
  });
});
