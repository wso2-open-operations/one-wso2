// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy at
// http://www.apache.org/licenses/LICENSE-2.0

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAsgardeoSub", async () => {
  const actual = await vi.importActual<typeof import("@hooks/useAsgardeoSub")>("@hooks/useAsgardeoSub");
  return {
    ...actual,
    useAsgardeoSub: () => ({ state: { status: "ready", sub: "user-under-test" }, retry: () => {} }),
  };
});
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));

const authedGet = vi.fn(() => Promise.resolve([]));
const authedPost = vi.fn(() => Promise.resolve(null));
const authedPut = vi.fn(() => Promise.resolve(null));
vi.mock("@api/http", async () => {
  const actual = await vi.importActual<typeof import("@api/http")>("@api/http");
  return {
    ...actual,
    authedGet: (...args: unknown[]) => authedGet(...(args as [])),
    authedPost: (...args: unknown[]) => authedPost(...(args as [])),
    authedPut: (...args: unknown[]) => authedPut(...(args as [])),
  };
});

// `@config/apiConfig` reads `window.config` once at module-load time (jsdom
// has no such global), so this must be set before the dynamic imports below
// trigger that module's first evaluation.
(window as unknown as { config: Record<string, string> }).config = {
  ONE_WSO2_UMT_BACKEND_URL: "https://umt.example.com",
};

const { useUmtBaseProducts, useUmtCreateProduct, useUmtDeprecateProduct } = await import("./useUmtProducts");
const { umtServiceUrls } = await import("@config/apiConfig");

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  authedGet.mockClear();
  authedPost.mockClear();
  authedPut.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useUmtBaseProducts", () => {
  it("fetches the base product catalog", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useUmtBaseProducts(), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(authedGet).toHaveBeenCalledWith(umtServiceUrls.baseProducts, "token");
  });

  it("fetches the catalog again when the page opens again, even with a cached copy", async () => {
    // The app turns automatic refetching off; this override must win over it.
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnMount: false } } });
    const first = renderHook(() => useUmtBaseProducts(), { wrapper: wrapper(client) });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    first.unmount();

    renderHook(() => useUmtBaseProducts(), { wrapper: wrapper(client) });

    await waitFor(() => expect(authedGet).toHaveBeenCalledTimes(2));
  });
});

describe("useUmtCreateProduct", () => {
  it("POSTs the create request and leaves the base product catalog alone", async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidateQueries = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useUmtCreateProduct(), { wrapper: wrapper(client) });

    const request = {
      name: "wso2am",
      version: "4.0.0.0.full",
      leadMail: "lead@wso2.com",
      edMail: "ed@wso2.com",
      platform: "APIM",
      FTPHost: "ftp.wso2.com",
      FTPPort: "21",
      FTPUsername: "ftpuser",
      FTPPassword: "secret",
      FTPPath: "/updates",
    };

    await act(async () => {
      await result.current.mutateAsync(request);
    });

    expect(authedPost).toHaveBeenCalledWith(umtServiceUrls.createBaseProduct, "token", request);
    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});

describe("useUmtDeprecateProduct", () => {
  it("PUTs the deprecate request and invalidates the base product catalog", async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidateQueries = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useUmtDeprecateProduct(), { wrapper: wrapper(client) });

    await act(async () => {
      await result.current.mutateAsync({ name: "wso2am", version: "4.0.0.0.full" });
    });

    expect(authedPut).toHaveBeenCalledWith(umtServiceUrls.deprecateBaseProduct, "token", {
      name: "wso2am",
      version: "4.0.0.0.full",
    });
    const invalidatedKeys = invalidateQueries.mock.calls.map((call) => call[0]?.queryKey?.[0]);
    expect(invalidatedKeys).toEqual(expect.arrayContaining(["umt-base-products"]));
  });
});
