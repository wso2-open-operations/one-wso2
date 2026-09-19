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

const authedPost = vi.fn((): Promise<unknown> => Promise.resolve([{ id: 101 }]));
vi.mock("@api/http", async () => {
  const actual = await vi.importActual<typeof import("@api/http")>("@api/http");
  return { ...actual, authedPost: (...args: unknown[]) => authedPost(...(args as [])) };
});

const { useUmtCheckDuplicateUpdatesByCaseId, useUmtCreateUpdate } = await import("./useUmtCreateUpdate");
const { umtServiceUrls } = await import("@config/apiConfig");
const { EMPTY_UMT_UPDATE_FILTERS } = await import("./umtUpdates");

function renderWithClient<T>(useHook: () => T) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidateQueries = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(useHook, { wrapper });
  return { result, invalidateQueries };
}

const SAMPLE_REQUEST = {
  caseId: "CS12345",
  internalGitIssue: "https://github.com/wso2/internal-issues/issues/1",
  securityInternalGitIssue: "N/A",
  publicGitIssue: "https://github.com/wso2/public-issues/issues/2",
  bestCaseEstimate: "2026-01-01T00:00:00.000Z",
  mostLikelyEstimate: "2026-01-08T00:00:00.000Z",
  worstCaseEstimate: "2026-01-15T00:00:00.000Z",
  issueType: "Bug",
  lifecycle: "UpdateLifecycle",
  productId: 11,
  hotfixRequired: false,
};

beforeEach(() => {
  authedPost.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useUmtCreateUpdate", () => {
  it("POSTs the create-update request to the create endpoint", async () => {
    const { result } = renderWithClient(useUmtCreateUpdate);

    await act(async () => {
      await result.current.mutateAsync(SAMPLE_REQUEST);
    });

    expect(authedPost).toHaveBeenCalledWith(umtServiceUrls.createUpdate, "token", SAMPLE_REQUEST);
  });

  it("invalidates the updates list and dashboard stats on success", async () => {
    const { result, invalidateQueries } = renderWithClient(useUmtCreateUpdate);

    await act(async () => {
      await result.current.mutateAsync(SAMPLE_REQUEST);
    });

    const invalidatedKeys = invalidateQueries.mock.calls.map((call) => call[0]?.queryKey?.[0]);
    expect(invalidatedKeys).toEqual(expect.arrayContaining(["umt-updates", "umt-dashboard-stats"]));
  });
});

describe("useUmtCheckDuplicateUpdatesByCaseId", () => {
  it("POSTs a page-0 search filtered by serviceNowCaseId, with every other filter empty", async () => {
    authedPost.mockResolvedValueOnce({ updates: [], totalPages: 0, pageSize: 100 });
    const { result } = renderWithClient(useUmtCheckDuplicateUpdatesByCaseId);

    await act(async () => {
      await result.current.mutateAsync("CS12345");
    });

    expect(authedPost).toHaveBeenCalledWith(umtServiceUrls.updatesSearch, "token", {
      page: 0,
      pageSize: 100,
      filters: { ...EMPTY_UMT_UPDATE_FILTERS, serviceNowCaseId: "CS12345" },
    });
  });
});
