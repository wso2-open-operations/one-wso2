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

vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: "user-under-test" }, retry: () => {} }),
}));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));

const authedGet = vi.fn(() => Promise.resolve([]));
const authedPut = vi.fn(() => Promise.resolve(null));
vi.mock("@api/http", async () => {
  const actual = await vi.importActual<typeof import("@api/http")>("@api/http");
  return {
    ...actual,
    authedGet: (...args: unknown[]) => authedGet(...(args as [])),
    authedPut: (...args: unknown[]) => authedPut(...(args as [])),
  };
});

// `@config/apiConfig` reads `window.config` once at module-load time (jsdom
// has no such global), so this must be set before the dynamic imports below
// trigger that module's first evaluation.
(window as unknown as { config: Record<string, string> }).config = {
  ONE_WSO2_UMT_BACKEND_URL: "https://umt.example.com",
};

const { useUmtStagingTestResults, useUmtSaveTestingResults } = await import("./useUmtTesting");
const { umtServiceUrls } = await import("@config/apiConfig");

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  authedGet.mockClear();
  authedPut.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useUmtStagingTestResults", () => {
  it("is enabled for each testing-family lifecycleState and disabled otherwise", () => {
    const enabledStates = [
      "TestingEnvironmentRequested",
      "TestingEnvironmentCreated",
      "TestingEnvironmentFailed",
      "StagingRequested",
      "Staging",
    ];
    for (const state of enabledStates) {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      renderHook(() => useUmtStagingTestResults("42", state), { wrapper: wrapper(client) });
      const query = client.getQueryCache().find({ queryKey: ["umt-update-staging-test-results", "user-under-test", "42"] });
      const options = query!.options as unknown as { enabled: boolean };
      expect(options.enabled).toBe(true);
    }

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderHook(() => useUmtStagingTestResults("42", "Released"), { wrapper: wrapper(client) });
    const disabledQuery = client
      .getQueryCache()
      .find({ queryKey: ["umt-update-staging-test-results", "user-under-test", "42"] });
    const disabledOptions = disabledQuery!.options as unknown as { enabled: boolean };
    expect(disabledOptions.enabled).toBe(false);
  });

  it("polls while in a transient state and stops once Staging or Failed is reached", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderHook(() => useUmtStagingTestResults("42", "TestingEnvironmentRequested"), { wrapper: wrapper(client) });
    const query = client.getQueryCache().find({ queryKey: ["umt-update-staging-test-results", "user-under-test", "42"] });
    const options = query!.options as unknown as { refetchInterval: (q: unknown) => number | false };
    expect(options.refetchInterval({})).toBe(3000);

    const stoppedClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderHook(() => useUmtStagingTestResults("42", "Staging"), { wrapper: wrapper(stoppedClient) });
    const stoppedQuery = stoppedClient
      .getQueryCache()
      .find({ queryKey: ["umt-update-staging-test-results", "user-under-test", "42"] });
    const stoppedOptions = stoppedQuery!.options as unknown as { refetchInterval: (q: unknown) => number | false };
    expect(stoppedOptions.refetchInterval({})).toBe(false);
  });

  it("fetches from the correct endpoint", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderHook(() => useUmtStagingTestResults("42", "Staging"), { wrapper: wrapper(client) });
    await act(async () => {
      await client.refetchQueries({ queryKey: ["umt-update-staging-test-results", "user-under-test", "42"] });
    });
    expect(authedGet).toHaveBeenCalledWith(umtServiceUrls.updateIntegrationTestStaging("42"), "token");
  });

  it("also invalidates umt-update while in a state that's still actively polling", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateQueries = vi.spyOn(client, "invalidateQueries");
    renderHook(() => useUmtStagingTestResults("42", "TestingEnvironmentRequested"), { wrapper: wrapper(client) });
    await act(async () => {
      await client.refetchQueries({ queryKey: ["umt-update-staging-test-results", "user-under-test", "42"] });
    });
    const invalidatedKeys = invalidateQueries.mock.calls.map((call) => call[0]?.queryKey?.[0]);
    expect(invalidatedKeys).toEqual(expect.arrayContaining(["umt-update"]));
  });

  it("does not invalidate umt-update once Staging is reached and polling has stopped", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateQueries = vi.spyOn(client, "invalidateQueries");
    renderHook(() => useUmtStagingTestResults("42", "Staging"), { wrapper: wrapper(client) });
    await act(async () => {
      await client.refetchQueries({ queryKey: ["umt-update-staging-test-results", "user-under-test", "42"] });
    });
    const invalidatedKeys = invalidateQueries.mock.calls.map((call) => call[0]?.queryKey?.[0]);
    expect(invalidatedKeys).not.toEqual(expect.arrayContaining(["umt-update"]));
  });
});

describe("useUmtSaveTestingResults", () => {
  it("PUTs one call per row and invalidates staging-results + umt-update", async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidateQueries = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useUmtSaveTestingResults("42"), { wrapper: wrapper(client) });

    const rows = [
      { productId: 1, productName: "IS", baseVersion: "7.0.0", manualTestResult: "success", manualTestComment: "", channel: "full" as const },
      { productId: 2, productName: "APIM", baseVersion: "4.2.0", manualTestResult: "failure", manualTestComment: "Broke", channel: "full" as const },
    ];

    await act(async () => {
      await result.current.mutateAsync(rows);
    });

    expect(authedPut).toHaveBeenCalledTimes(2);
    expect(authedPut).toHaveBeenCalledWith(umtServiceUrls.updateIntegrationTestStaging("42"), "token", rows[0]);
    expect(authedPut).toHaveBeenCalledWith(umtServiceUrls.updateIntegrationTestStaging("42"), "token", rows[1]);

    const invalidatedKeys = invalidateQueries.mock.calls.map((call) => call[0]?.queryKey?.[0]);
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining(["umt-update-staging-test-results", "umt-update"]),
    );
  });
});
