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

const authedPut = vi.fn(() => Promise.resolve(null));
vi.mock("@api/http", async () => {
  const actual = await vi.importActual<typeof import("@api/http")>("@api/http");
  return {
    ...actual,
    authedPut: (...args: unknown[]) => authedPut(...(args as [])),
  };
});

const { useUmtUpdateFieldMutation } = await import("./useUmtUpdateFieldMutation");
const { umtServiceUrls } = await import("@config/apiConfig");

function renderMutation() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidateQueries = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useUmtUpdateFieldMutation("101"), { wrapper });
  return { result, invalidateQueries };
}

function invalidatedKeys(invalidateQueries: ReturnType<typeof vi.spyOn>) {
  return invalidateQueries.mock.calls.map(
    (call: unknown[]) => (call[0] as { queryKey?: unknown[] })?.queryKey?.[0],
  );
}

beforeEach(() => {
  authedPut.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useUmtUpdateFieldMutation", () => {
  it("sends the reason with an ETA change", async () => {
    const { result } = renderMutation();

    await act(async () => {
      await result.current.mutateAsync({ field: "worstCaseEstimate", value: "2026-10-01", reason: "Blocked on a fix" });
    });

    expect(authedPut).toHaveBeenCalledWith(umtServiceUrls.updateWorstCaseEstimate("101"), "token", {
      worstCaseEstimate: "2026-10-01",
      reason: "Blocked on a fix",
    });
  });

  it("sends only the changed field for other edits", async () => {
    const { result } = renderMutation();

    await act(async () => {
      await result.current.mutateAsync({ field: "assignedTo", value: "someone" });
    });

    expect(authedPut).toHaveBeenCalledWith(umtServiceUrls.update("101"), "token", { assignedTo: "someone" });
  });

  it("invalidates the ETA log after an ETA change", async () => {
    const { result, invalidateQueries } = renderMutation();

    await act(async () => {
      await result.current.mutateAsync({ field: "worstCaseEstimate", value: "2026-10-01" });
    });

    expect(invalidatedKeys(invalidateQueries)).toEqual(
      expect.arrayContaining(["umt-update", "umt-updates", "umt-update-worst-case-estimate-log"]),
    );
  });

  it("leaves the ETA log alone when another field changes", async () => {
    const { result, invalidateQueries } = renderMutation();

    await act(async () => {
      await result.current.mutateAsync({ field: "assignedTo", value: "someone" });
    });

    expect(invalidatedKeys(invalidateQueries)).not.toContain("umt-update-worst-case-estimate-log");
  });
});
