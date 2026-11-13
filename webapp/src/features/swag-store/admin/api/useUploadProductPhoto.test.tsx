// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const fetchWithReauth = vi.hoisted(() => vi.fn());

vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: "admin" }, retry: () => {} }),
  foldIdentityError: (query: unknown) => query,
}));
vi.mock("@api/http", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@api/http")>()),
  fetchWithReauth,
}));

import { HttpError } from "@api/http";
import { swagStoreServiceUrls } from "@config/apiConfig";
import { useUploadProductPhoto } from "./useAdminMutations";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const file = new File(["png"], "hoodie.png", { type: "image/png" });

describe("useUploadProductPhoto", () => {
  it("sends the view and the file as a multipart form, letting the browser set the boundary", async () => {
    const stored = { view: "back", path: "products/p-1/back-3f9a2c1d.png", url: "https://acc/x?sig=y" };
    fetchWithReauth.mockResolvedValueOnce(new Response(JSON.stringify(stored), { status: 201 }));
    const { result } = renderHook(() => useUploadProductPhoto("p-1"), { wrapper });

    result.current.mutate({ view: "back", file });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(stored);
    const [url, init, token] = fetchWithReauth.mock.calls[0];
    expect(url).toBe(swagStoreServiceUrls.admin.productImages("p-1"));
    expect(token).toBe("token");
    expect(init.method).toBe("POST");
    expect(init.headers?.["Content-Type"]).toBeUndefined();
    const form = init.body as FormData;
    expect(form.get("view")).toBe("back");
    expect((form.get("file") as File).name).toBe("hoodie.png");
  });

  it("fails with the backend's answer, so messageFor can word it", async () => {
    const body = JSON.stringify({ message: "Photos must be JPEG, PNG or WebP.", errorCode: "unsupported_image" });
    fetchWithReauth.mockResolvedValueOnce(new Response(body, { status: 415 }));
    const { result } = renderHook(() => useUploadProductPhoto("p-1"), { wrapper });

    result.current.mutate({ view: "front", file });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(HttpError);
    expect((result.current.error as HttpError).status).toBe(415);
    expect((result.current.error as HttpError).responseBody).toBe(body);
  });
});
