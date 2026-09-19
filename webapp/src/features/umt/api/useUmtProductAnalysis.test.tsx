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

const { useUmtSaveProductAnalysis, UmtPartialProductAnalysisSaveError } = await import("./useUmtProductAnalysis");
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

const products = [{ productId: 1, product: { id: 1, name: "IS", version: "7.0.0" } }];
const previousProducts = [{ productId: 1, product: { id: 1, name: "IS", version: "6.6.0" } }];
const analysis = {
  updateNo: "42",
  compatibleProducts: [],
  applicableProducts: [{ productId: 1, productName: "IS", baseVersion: "7.0.0", identifiedFiles: [] }],
  ignoredFilePathsDuringPartialProductAnalysis: [],
  ignoredPartiallyApplicableProducts: [],
  partiallyApplicableProductIgnoredReason: {
    isRemoveOnly: false,
    isTomcatUpgrade: false,
    isJreUpgrade: false,
    isBundleInfoChange: false,
  },
};

describe("useUmtSaveProductAnalysis", () => {
  it("PUTs the product list then the product-analysis result, and invalidates both", async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidateQueries = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useUmtSaveProductAnalysis("42"), { wrapper: wrapper(client) });

    await act(async () => {
      await result.current.mutateAsync({ products, analysis, previousProducts });
    });

    expect(authedPut).toHaveBeenCalledTimes(2);
    expect(authedPut).toHaveBeenNthCalledWith(1, umtServiceUrls.updateProducts("42"), "token", products);
    expect(authedPut).toHaveBeenNthCalledWith(2, umtServiceUrls.updateProductAnalysis("42"), "token", analysis);

    const invalidatedKeys = invalidateQueries.mock.calls.map((call) => call[0]?.queryKey?.[0]);
    expect(invalidatedKeys).toEqual(expect.arrayContaining(["umt-update", "umt-update-product-analysis"]));
  });

  it("reverts the product list back to previousProducts when the analysis PUT fails, and reports the revert succeeded", async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidateQueries = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useUmtSaveProductAnalysis("42"), { wrapper: wrapper(client) });

    authedPut
      .mockResolvedValueOnce(null) // PUT .../products (the replace)
      .mockRejectedValueOnce(new Error("analysis save failed")) // PUT .../productAnalysis
      .mockResolvedValueOnce(null); // PUT .../products (the revert)

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ products, analysis, previousProducts });
      } catch (error) {
        caught = error;
      }
    });

    expect(caught).toBeInstanceOf(UmtPartialProductAnalysisSaveError);
    expect((caught as InstanceType<typeof UmtPartialProductAnalysisSaveError>).productsRestored).toBe(true);

    expect(authedPut).toHaveBeenCalledTimes(3);
    expect(authedPut).toHaveBeenNthCalledWith(1, umtServiceUrls.updateProducts("42"), "token", products);
    expect(authedPut).toHaveBeenNthCalledWith(2, umtServiceUrls.updateProductAnalysis("42"), "token", analysis);
    expect(authedPut).toHaveBeenNthCalledWith(3, umtServiceUrls.updateProducts("42"), "token", previousProducts);

    // Even a partial failure still refreshes the cache to reflect whichever
    // state the backend actually ended up in.
    const invalidatedKeys = invalidateQueries.mock.calls.map((call) => call[0]?.queryKey?.[0]);
    expect(invalidatedKeys).toEqual(expect.arrayContaining(["umt-update", "umt-update-product-analysis"]));
  });

  it("reports the revert itself failing, so the caller knows the replace is still in effect", async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useUmtSaveProductAnalysis("42"), { wrapper: wrapper(client) });

    authedPut
      .mockResolvedValueOnce(null) // PUT .../products (the replace)
      .mockRejectedValueOnce(new Error("analysis save failed")) // PUT .../productAnalysis
      .mockRejectedValueOnce(new Error("revert also failed")); // PUT .../products (the revert attempt)

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ products, analysis, previousProducts });
      } catch (error) {
        caught = error;
      }
    });

    expect(caught).toBeInstanceOf(UmtPartialProductAnalysisSaveError);
    expect((caught as InstanceType<typeof UmtPartialProductAnalysisSaveError>).productsRestored).toBe(false);
  });
});
