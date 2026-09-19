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
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));

const authedGet = vi.fn(() => Promise.resolve({ valid: true }));
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

const { useUmtValidateSecurityAdvisory, useUmtSaveSecurityAdvisories } = await import(
  "./useUmtSecurityAdvisory"
);
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

describe("useUmtValidateSecurityAdvisory", () => {
  it("is disabled when the caller's format check (enabled) is false", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderHook(() => useUmtValidateSecurityAdvisory("WSO2-2024-1234", false), { wrapper: wrapper(client) });
    const query = client.getQueryCache().find({ queryKey: ["umt-validate-security-advisory", "WSO2-2024-1234"] });
    const options = query!.options as unknown as { enabled: boolean };
    expect(options.enabled).toBe(false);
  });

  it("is disabled for a blank advisory id even when enabled is true", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderHook(() => useUmtValidateSecurityAdvisory("", true), { wrapper: wrapper(client) });
    const query = client.getQueryCache().find({ queryKey: ["umt-validate-security-advisory", ""] });
    const options = query!.options as unknown as { enabled: boolean };
    expect(options.enabled).toBe(false);
  });

  it("is enabled and fetches from the correct endpoint for a format-valid, non-blank id", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderHook(() => useUmtValidateSecurityAdvisory("WSO2-2024-1234", true), { wrapper: wrapper(client) });
    const query = client
      .getQueryCache()
      .find({ queryKey: ["umt-validate-security-advisory", "WSO2-2024-1234"] });
    const options = query!.options as unknown as { enabled: boolean };
    expect(options.enabled).toBe(true);

    await act(async () => {
      await client.refetchQueries({ queryKey: ["umt-validate-security-advisory", "WSO2-2024-1234"] });
    });
    expect(authedGet).toHaveBeenCalledWith(
      umtServiceUrls.validateSecurityAdvisory("WSO2-2024-1234"),
      "token",
    );
  });
});

describe("useUmtSaveSecurityAdvisories", () => {
  it("PUTs the full advisory list to the generic update endpoint and invalidates umt-update", async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidateQueries = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useUmtSaveSecurityAdvisories("42"), { wrapper: wrapper(client) });

    const advisories = [
      { securityAdvisoryName: "WSO2-2024-1234", userConsentFlag: false },
      { securityAdvisoryName: "WSO2-2024-5678", userConsentFlag: true },
    ];

    await act(async () => {
      await result.current.mutateAsync(advisories);
    });

    expect(authedPut).toHaveBeenCalledTimes(1);
    expect(authedPut).toHaveBeenCalledWith(umtServiceUrls.update("42"), "token", {
      securityAdvisories: advisories,
    });

    const invalidatedKeys = invalidateQueries.mock.calls.map((call) => call[0]?.queryKey?.[0]);
    expect(invalidatedKeys).toEqual(expect.arrayContaining(["umt-update"]));
  });
});
