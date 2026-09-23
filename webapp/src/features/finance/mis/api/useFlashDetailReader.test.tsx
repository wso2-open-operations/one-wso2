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
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HttpError } from "@api/http";
import type { MisFlashRange } from "../util/misFlashPeriods";

// The Full Report's read: every business unit's monthly detail, asked for at
// the moment the reader clicks, rather than by an open dialog.
//
// What is pinned is what the backend sees and what the file can rely on — the
// bodies asked, how many at once, the order the answers come back in, that a
// unit the dialog already read is not asked twice, and that one failure fails
// the report rather than leaving a sheet out.

vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAsgardeoSub", async () => {
  const actual = await vi.importActual<typeof import("@hooks/useAsgardeoSub")>(
    "@hooks/useAsgardeoSub",
  );
  return {
    ...actual,
    useAsgardeoSub: () => ({ state: { status: "ready", sub: "user-under-test" }, retry: () => {} }),
  };
});
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@config/apiConfig", () => ({
  isMisFlashConfigured: () => true,
  misFlashServiceUrls: {
    customerSummary: "https://flash.example/customer-summary",
    accountSummary: "https://flash.example/account-summary",
  },
}));

/** Each POST, as it was made. */
const posts: { url: string; body: { businessUnit: string; subRegions: string[] } }[] = [];
/** How a POST is answered. Replaced per test. */
let answer: (url: string, businessUnit: string) => Promise<unknown> = async (url, unit) => ({
  arr: [{ id: "1", title: `${unit} from ${url}`, summary: [] }],
});
vi.mock("@api/http", async () => {
  const actual = await vi.importActual<typeof import("@api/http")>("@api/http");
  return {
    ...actual,
    authedPost: (url: string, _token: string, body: (typeof posts)[number]["body"]) => {
      posts.push({ url, body });
      return answer(url, body.businessUnit);
    },
  };
});

const { useFlashDetail } = await import("./useFlashDetail");
const { useFlashDetailReader } = await import("./useFlashDetailReader");

const RANGES: MisFlashRange[] = [{ startDate: "2025-09-30", endDate: "2025-10-31" }];
const UNITS = ["Integration-Software", "IAM", "APIM-Software", "Choreo", "Corporate", "All"];
const requestFor = (businessUnit: string, subRegions: string[] = []) => ({
  businessUnit,
  ranges: RANGES,
  subRegions,
});

function renderReader(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useFlashDetailReader(), { wrapper });
}

beforeEach(() => {
  posts.length = 0;
  answer = async (url, unit) => ({ arr: [{ id: "1", title: `${unit} from ${url}`, summary: [] }] });
});

describe("reading every business unit for a Full Report", () => {
  it("asks both endpoints for each unit, with the body its dialog would send", async () => {
    const { result } = renderReader();
    await act(() => result.current(UNITS.map((unit) => requestFor(unit, ["EU : EU 1"]))));

    expect(posts).toHaveLength(12);
    for (const unit of UNITS) {
      const mine = posts.filter((post) => post.body.businessUnit === unit);
      expect(mine.map((post) => post.url).sort()).toEqual([
        "https://flash.example/account-summary",
        "https://flash.example/customer-summary",
      ]);
      // The Full Report narrows EVERY unit — the source's `fetchMonthlySummary`
      // sends `subRegion` for all six, unlike its dialogs. Spec §8.
      expect(mine[0].body).toMatchObject({ isSubLevel: true, subRegions: ["EU : EU 1"] });
    }
  });

  it("answers in the order it was asked, whichever read lands first", async () => {
    // The source collects answers in the order they RESOLVE, so its sheets can
    // come out in a different order from one export to the next. IAM is made
    // slow here, and still comes back second.
    answer = async (_url, unit) => {
      if (unit === "IAM") await new Promise((resolve) => setTimeout(resolve, 20));
      return { arr: [{ id: "1", title: unit, summary: [] }] };
    };
    const { result } = renderReader();
    const answers = await act(() => result.current(UNITS.map((unit) => requestFor(unit))));
    expect(answers.map((unitAnswer) => unitAnswer.sales.arr?.[0].title)).toEqual(UNITS);
  });

  it("reads three units at a time, as the source does, not all twelve reads at once", async () => {
    // A backend last deployed from a 407-day-old commit, asked for a year of
    // six units' P&L. The source's CONCURRENCY_LIMIT is three units.
    let inFlight = 0;
    let most = 0;
    answer = async () => {
      inFlight += 1;
      most = Math.max(most, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return {};
    };
    const { result } = renderReader();
    await act(() => result.current(UNITS.map((unit) => requestFor(unit))));
    // Three units, two reads each.
    expect(most).toBe(6);
  });

  it("does not ask again for a unit its dialog has already read", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    // The dialog for IAM, open and answered.
    const dialog = renderHook(() => useFlashDetail(requestFor("IAM")), { wrapper });
    await waitFor(() => expect(dialog.result.current.isLoading).toBe(false));
    expect(posts).toHaveLength(2);

    const { result } = renderHook(() => useFlashDetailReader(), { wrapper });
    const [iam] = await act(() => result.current([requestFor("IAM")]));
    // Served from the dialog's cache: same body, same key.
    expect(posts).toHaveLength(2);
    expect(iam.sales.arr?.[0].title).toBe("IAM from https://flash.example/customer-summary");
  });

  it("fails the whole report when any unit's read fails", async () => {
    // Rather than write a workbook with a unit's sheet missing or half empty —
    // a file read as complete. The source's never settles at all: its reads
    // are wrapped in promises nothing rejects, so one failure leaves the Full
    // Report waiting for good under a full-screen "Preparing download" (spec §7).
    answer = async (url, unit) => {
      if (unit === "Choreo" && url.endsWith("account-summary")) {
        // Retried once, as every Flash read is (`httpRetry`), then given up.
        throw new HttpError(url, 504, "Gateway timed out.");
      }
      return {};
    };
    const { result } = renderReader();
    await expect(
      act(() => result.current(UNITS.map((unit) => requestFor(unit)))),
    ).rejects.toBeInstanceOf(HttpError);
  });
});
