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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("@config/apiConfig", () => ({
  isacApiUrl: (path: string) => `https://isac.example/v1.0/api/v1${path}`,
}));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token-1" }));

const fetchWithReauth = vi.hoisted(() => vi.fn());
vi.mock("@api/http", () => ({ fetchWithReauth }));

import { useApiClient } from "./client";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  fetchWithReauth.mockReset();
});

describe("useApiClient", () => {
  it("GETs a path under /api/v1 with its query, skipping empty parameters, signed with the access token", async () => {
    fetchWithReauth.mockResolvedValue(json({ items: [] }));
    const { result } = renderHook(() => useApiClient());
    await result.current.get("/companies", { page: 2, search: undefined, region: null, state: "CA" });
    expect(fetchWithReauth).toHaveBeenCalledWith(
      "https://isac.example/v1.0/api/v1/companies?page=2&state=CA",
      { method: "GET" },
      "token-1",
    );
  });

  it("sends a JSON body with its content type", async () => {
    fetchWithReauth.mockResolvedValue(json({ ok: true }));
    const { result } = renderHook(() => useApiClient());
    await result.current.request("post", "/follows", { company_id: 7 });
    expect(fetchWithReauth).toHaveBeenCalledWith(
      "https://isac.example/v1.0/api/v1/follows",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"company_id":7}' },
      "token-1",
    );
  });

  it("leaves the content type of an upload to the browser", async () => {
    fetchWithReauth.mockResolvedValue(json({ ok: true }));
    const { result } = renderHook(() => useApiClient());
    const form = new FormData();
    await result.current.upload("/uploads/csv", form);
    expect(fetchWithReauth).toHaveBeenCalledWith(
      "https://isac.example/v1.0/api/v1/uploads/csv",
      { method: "POST", body: form },
      "token-1",
    );
  });

  it("throws the server's own message on a failed request", async () => {
    fetchWithReauth.mockResolvedValue(json({ detail: "Admin role required" }, 403));
    const { result } = renderHook(() => useApiClient());
    await expect(result.current.get("/admin/counts")).rejects.toThrow("Admin role required");
  });

  it("returns a download with its file name and export metadata", async () => {
    fetchWithReauth.mockResolvedValue(
      new Response("a,b", {
        headers: {
          "Content-Disposition": 'attachment; filename="leads.csv"',
          "X-Total-Count": "1200",
          "X-Export-Truncated": "true",
        },
      }),
    );
    const { result } = renderHook(() => useApiClient());
    const file = await result.current.download("/leads/export");
    expect(file).toMatchObject({ filename: "leads.csv", total: 1200, truncated: true });
  });
});
