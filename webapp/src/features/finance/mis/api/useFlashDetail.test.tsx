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

// `POST /customer-summary` and `POST /account-summary` — one business unit's
// P&L, month by month.
//
// Both are READS that take a body, so spec §6's rule applies and is what this
// file mostly exists to pin: the body is the cache key. The URL cannot be —
// it is identical for every business unit, so keying on it would serve
// Integration's figures under Choreo's heading and nothing would say so.

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
  misFlashServiceUrls: {
    customerSummary: "https://flash.example/customer-summary",
    accountSummary: "https://flash.example/account-summary",
  },
}));

/** Keyed by url and business unit, so each call can be answered on its own. */
const answers = new Map<string, unknown>();
const authedPost = vi.fn(async (url: string, _token: string, body: unknown) => {
  const { businessUnit } = body as { businessUnit: string };
  const answer = answers.get(`${url}|${businessUnit}`);
  if (answer instanceof Error) throw answer;
  return answer ?? {};
});
const bodies: unknown[] = [];
vi.mock("@api/http", async () => {
  const actual = await vi.importActual<typeof import("@api/http")>("@api/http");
  return {
    ...actual,
    authedPost: (url: string, token: string, body: unknown) => {
      bodies.push(body);
      return authedPost(url, token, body);
    },
  };
});

const { useFlashDetail } = await import("./useFlashDetail");
const { flashDetailBody } = await import("./flashDetailQueries");

const CUSTOMER_URL = "https://flash.example/customer-summary";
const ACCOUNT_URL = "https://flash.example/account-summary";
const RANGES: MisFlashRange[] = [
  { startDate: "2025-09-01", endDate: "2025-10-01" },
  { startDate: "2025-10-01", endDate: "2025-11-01" },
];
const REQUEST = { businessUnit: "IAM", ranges: RANGES, subRegions: [] as string[] };
const SALES = { arr: [{ id: "1", title: "Opening ARR", summary: [] }] };
const ACCOUNTS = { revenue: [{ id: "1", title: "Recurring", summary: [] }] };

const newClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });

function renderDetail(request = REQUEST as typeof REQUEST | null, client = newClient()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(({ req }: { req: typeof REQUEST | null }) => useFlashDetail(req), {
    wrapper,
    initialProps: { req: request },
  });
}

beforeEach(() => {
  answers.clear();
  bodies.length = 0;
  authedPost.mockClear();
  identity.value = { status: "ready", sub: "user-under-test" };
});

describe("the body both calls take", () => {
  it("names the business unit and every month asked for", () => {
    expect(flashDetailBody(REQUEST)).toEqual({
      businessUnit: "IAM",
      isSubLevel: true,
      dateRange: [
        { startDate: "2025-09-01", endDate: "2025-10-01" },
        { startDate: "2025-10-01", endDate: "2025-11-01" },
      ],
      subRegions: [],
    });
  });

  // Spec §7. The source reaches this body only from its separate sub-level
  // dialog; ticket 15 folds that dialog into the P&L's own collapsible rows, so
  // this is the one monthly view and it asks the richer question. The flag is
  // purely additive at the backend.
  it("always asks for the sub-levels", () => {
    expect(flashDetailBody({ ...REQUEST, businessUnit: "All" }).isSubLevel).toBe(true);
  });

  it("carries the chosen sub-regions", () => {
    expect(flashDetailBody({ ...REQUEST, subRegions: ["EU : EU 1"] }).subRegions).toEqual([
      "EU : EU 1",
    ]);
  });
});

describe("reading one business unit", () => {
  it("makes both calls with the same body", async () => {
    answers.set(`${CUSTOMER_URL}|IAM`, SALES);
    answers.set(`${ACCOUNT_URL}|IAM`, ACCOUNTS);
    const { result } = renderDetail();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.sales).toEqual(SALES);
    expect(result.current.accounts).toEqual(ACCOUNTS);
    expect(bodies[0]).toEqual(bodies[1]);
  });

  it("asks nothing at all while the dialog is shut", () => {
    const { result } = renderDetail(null);
    expect(authedPost).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.sales).toEqual({});
  });

  // §6's rule, and the failure it prevents: the URL is the same for every
  // business unit, so a URL-keyed cache would answer Choreo with IAM's figures.
  it("keys on the body, so another business unit is another question", async () => {
    const client = newClient();
    answers.set(`${CUSTOMER_URL}|IAM`, SALES);
    answers.set(`${CUSTOMER_URL}|Choreo`, { arr: [{ id: "9", title: "Choreo ARR", summary: [] }] });

    const view = renderDetail(REQUEST, client);
    await waitFor(() => expect(view.result.current.sales).toEqual(SALES));
    view.rerender({ req: { ...REQUEST, businessUnit: "Choreo" } });
    await waitFor(() =>
      expect(view.result.current.sales).toEqual({
        arr: [{ id: "9", title: "Choreo ARR", summary: [] }],
      }),
    );
  });

  it("serves a unit already read without asking again", async () => {
    const client = newClient();
    answers.set(`${CUSTOMER_URL}|IAM`, SALES);
    answers.set(`${ACCOUNT_URL}|IAM`, ACCOUNTS);
    const first = renderDetail(REQUEST, client);
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    const calls = authedPost.mock.calls.length;

    const reopened = renderDetail(REQUEST, client);
    await waitFor(() => expect(reopened.result.current.sales).toEqual(SALES));
    expect(authedPost).toHaveBeenCalledTimes(calls);
  });

  it("holds nothing rather than a record made of a list", async () => {
    answers.set(`${CUSTOMER_URL}|IAM`, [1, 2]);
    answers.set(`${ACCOUNT_URL}|IAM`, ACCOUNTS);
    const { result } = renderDetail();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.sales).toEqual({});
  });
});

describe("when one of the two fails", () => {
  // A detail view missing its financial accounts is still a detail view with an
  // ARR in it, so one failure must not blank the other.
  it("keeps the half that answered, and does not call the view an error", async () => {
    answers.set(`${CUSTOMER_URL}|IAM`, SALES);
    answers.set(`${ACCOUNT_URL}|IAM`, new HttpError("https://flash.example", 403, ""));
    const { result } = renderDetail();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.sales).toEqual(SALES);
    expect(result.current.accounts).toEqual({});
    expect(result.current.isError).toBe(false);
    // But it says the view is PARTIAL, which is what withholds its Export: a
    // file with its financial accounts blank reads as a unit that earned nothing.
    expect(result.current.isPartial).toBe(true);
  });

  it("is an error only when neither answered", async () => {
    const failure = new HttpError("https://flash.example", 403, '{"message":"No."}');
    answers.set(`${CUSTOMER_URL}|IAM`, failure);
    answers.set(`${ACCOUNT_URL}|IAM`, failure);
    const { result } = renderDetail();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.errorMessage).toBe("No.");
    expect(result.current.isPartial).toBe(false);
  });

  // Without the identity fold both queries stay disabled — neither erroring nor
  // fetching — and the dialog opens on fourteen headings and no figures, which
  // reads as a business unit that earned nothing.
  it("reports an identity failure as an error, not as an empty view", async () => {
    identity.value = { status: "error", message: "Could not establish who you are." };
    const { result } = renderDetail();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.errorMessage).toBe("Could not establish who you are.");
    result.current.retry();
    expect(retryIdentity).toHaveBeenCalled();
  });
});
