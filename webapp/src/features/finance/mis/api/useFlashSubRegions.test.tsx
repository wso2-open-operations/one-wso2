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

import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HttpError } from "@api/http";
import type { MisFlashRange } from "../util/misFlashPeriods";

// `GET /sub-regions` — what the Sub Region filter is made of.
//
// The thing worth pinning is that the DATE RANGE is in the key. This is not a
// reference list: the endpoint answers with the sub-regions present in the data
// over those dates, so the menu narrows as the range moves.

vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
const retryIdentity = vi.fn();
const identity = {
  value: { status: "ready", sub: "user-under-test" } as
    | { status: "ready"; sub: string }
    | { status: "error"; message: string }
    | { status: "resolving" },
};
vi.mock("@hooks/useAsgardeoSub", async () => {
  const actual = await vi.importActual<typeof import("@hooks/useAsgardeoSub")>(
    "@hooks/useAsgardeoSub",
  );
  return { ...actual, useAsgardeoSub: () => ({ state: identity.value, retry: retryIdentity }) };
});
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@config/apiConfig", () => ({
  isMisFlashConfigured: () => true,
  misFlashServiceUrls: { subRegions: "https://flash.example/sub-regions" },
}));

const answers = new Map<string, unknown>();
const authedGet = vi.fn(async (url: string) => {
  const answer = answers.get(url);
  if (answer instanceof Error) throw answer;
  return answer ?? [];
});
vi.mock("@api/http", async () => {
  const actual = await vi.importActual<typeof import("@api/http")>("@api/http");
  return { ...actual, authedGet: (url: string) => authedGet(url) };
});

const { useFlashSubRegions } = await import("./useFlashSubRegions");

const RANGE: MisFlashRange = { startDate: "2025-09-01", endDate: "2026-09-01" };
const EARLIER: MisFlashRange = { startDate: "2020-09-01", endDate: "2021-09-01" };
const urlFor = (range: MisFlashRange) =>
  `https://flash.example/sub-regions?startDate=${range.startDate}&endDate=${range.endDate}`;

const newClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });

function renderSubRegions(range: MisFlashRange = RANGE, client = newClient()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useFlashSubRegions(range), { wrapper });
}

beforeEach(() => {
  answers.clear();
  authedGet.mockClear();
  identity.value = { status: "ready", sub: "user-under-test" };
});

describe("the menu behind the range", () => {
  it("asks about the range it was given", async () => {
    answers.set(urlFor(RANGE), ["EU : EU 1"]);
    const { result } = renderSubRegions();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(authedGet).toHaveBeenCalledWith(urlFor(RANGE));
  });

  it("offers the regions those sub-regions roll up into", async () => {
    answers.set(urlFor(RANGE), ["EU : EU 1", "EU : EU 2", "NA - WEST"]);
    const { result } = renderSubRegions();
    await waitFor(() => expect(result.current.groups).toHaveLength(2));
    expect(result.current.groups.map((group) => group.region)).toEqual(["EU", "NA"]);
  });

  // The menu narrows with the range, which is what makes this a range-keyed
  // read rather than a reference list fetched once.
  it("asks again when the range moves", async () => {
    const client = newClient();
    answers.set(urlFor(RANGE), ["EU : EU 1", "NA - WEST"]);
    answers.set(urlFor(EARLIER), ["EU : EU 1"]);

    const { result } = renderSubRegions(RANGE, client);
    await waitFor(() => expect(result.current.groups).toHaveLength(2));
    const older = renderSubRegions(EARLIER, client);
    await waitFor(() => expect(older.result.current.groups).toHaveLength(1));
    expect(authedGet).toHaveBeenCalledTimes(2);
  });

  it("offers nothing while it is still asking", () => {
    const { result } = renderSubRegions();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.groups).toEqual([]);
  });

  // A 200 carrying an object rather than a list — a gateway page, a service
  // that has moved on. An empty menu is the honest answer.
  it("offers nothing for an answer that is not a list", async () => {
    answers.set(urlFor(RANGE), { subRegions: ["EU"] });
    const { result } = renderSubRegions();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.groups).toEqual([]);
  });
});

describe("when the read fails", () => {
  it("says so, and keeps the menu empty rather than guessing", async () => {
    answers.set(urlFor(RANGE), new HttpError("https://flash.example", 403, ""));
    const { result } = renderSubRegions();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.groups).toEqual([]);
    expect(result.current.errorMessage).not.toBe("");
  });

  it("reports an identity failure as an error rather than as an empty menu", async () => {
    identity.value = { status: "error", message: "Could not establish who you are." };
    const { result } = renderSubRegions();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.errorMessage).toBe("Could not establish who you are.");
    result.current.retry();
    expect(retryIdentity).toHaveBeenCalled();
  });
});
