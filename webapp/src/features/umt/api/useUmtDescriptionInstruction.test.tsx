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
  return { ...actual, authedPut: (...args: unknown[]) => authedPut(...(args as [])) };
});

// `@config/apiConfig` reads `window.config` once at module-load time (jsdom
// has no such global), so this must be set before the dynamic imports below
// trigger that module's first evaluation.
(window as unknown as { config: Record<string, string> }).config = {
  ONE_WSO2_UMT_BACKEND_URL: "https://umt.example.com",
};

const { useUmtSaveDescriptionInstruction } = await import("./useUmtDescriptionInstruction");
const { umtServiceUrls } = await import("@config/apiConfig");

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  authedPut.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useUmtSaveDescriptionInstruction", () => {
  it("PUTs the product details then the behavior-change fields, and invalidates umt-update", async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidateQueries = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useUmtSaveDescriptionInstruction("42"), { wrapper: wrapper(client) });

    const products = [{ productId: 1, description: "Does a thing", instruction: "Do the thing" }];
    const behaviorChange = { isBehaviorChanged: true, isBehaviorChangeApproved: true };

    await act(async () => {
      await result.current.mutateAsync({ products, behaviorChange });
    });

    expect(authedPut).toHaveBeenNthCalledWith(1, umtServiceUrls.updateProductsDetails("42"), "token", products);
    expect(authedPut).toHaveBeenNthCalledWith(2, umtServiceUrls.update("42"), "token", behaviorChange);

    const invalidatedKeys = invalidateQueries.mock.calls.map((call) => call[0]?.queryKey?.[0]);
    expect(invalidatedKeys).toEqual(expect.arrayContaining(["umt-update"]));
  });

  it("sends only the product-details PUT when behaviorChange is null (hotfix path)", async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useUmtSaveDescriptionInstruction("42"), { wrapper: wrapper(client) });

    const products = [{ productId: 1, description: "Hotfix description", instruction: "Hotfix instruction" }];

    await act(async () => {
      await result.current.mutateAsync({ products, behaviorChange: null });
    });

    expect(authedPut).toHaveBeenCalledTimes(1);
    expect(authedPut).toHaveBeenNthCalledWith(1, umtServiceUrls.updateProductsDetails("42"), "token", products);
  });
});
