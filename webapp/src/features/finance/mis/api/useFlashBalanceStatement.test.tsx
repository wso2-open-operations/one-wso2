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

// `GET /balance-statement` — the whole P&L in one read.
//
// What is pinned here is the request (the repeated `subRegions` parameter, and
// the URL being the cache key) and the two ways a response can fail to be a
// statement: a failure, and a 200 that is not the body it claims to be.

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
  misFlashServiceUrls: { balanceStatement: "https://flash.example/balance-statement" },
}));

/** Keyed by the whole URL, so a test can answer one request differently from another. */
const answers = new Map<string, unknown>();
const authedGet = vi.fn(async (url: string) => {
  const answer = answers.get(url);
  if (answer instanceof Error) throw answer;
  return answer ?? {};
});
vi.mock("@api/http", async () => {
  const actual = await vi.importActual<typeof import("@api/http")>("@api/http");
  return { ...actual, authedGet: (url: string) => authedGet(url) };
});

const { balanceStatementUrl, useFlashBalanceStatement } = await import(
  "./useFlashBalanceStatement"
);

const RANGE: MisFlashRange = { startDate: "2025-09-01", endDate: "2026-09-01" };
const STATEMENT = { revenue: [{ id: "1", title: "Recurring", wso2: 100 }] };

const newClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });

function renderStatement(
  range: MisFlashRange = RANGE,
  subRegions: readonly string[] = [],
  client = newClient(),
) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useFlashBalanceStatement(range, subRegions), { wrapper });
}

beforeEach(() => {
  answers.clear();
  authedGet.mockClear();
  identity.value = { status: "ready", sub: "user-under-test" };
});

describe("the address of a P&L", () => {
  it("carries the range it is asking about", () => {
    expect(balanceStatementUrl(RANGE, [])).toBe(
      "https://flash.example/balance-statement?startDate=2025-09-01&endDate=2026-09-01",
    );
  });

  // The Ballerina resource declares `string[]?`, which is read from REPEATED
  // parameters. Joined with commas it would be one sub-region with a comma in
  // its name, and the answer would be an empty P&L rather than an error.
  it("repeats the sub-region parameter rather than joining the names", () => {
    expect(balanceStatementUrl(RANGE, ["EU : EU 1", "EU : EU 2"])).toBe(
      "https://flash.example/balance-statement?startDate=2025-09-01&endDate=2026-09-01" +
        "&subRegions=EU%20%3A%20EU%201&subRegions=EU%20%3A%20EU%202",
    );
  });

  // Every sub-region name has a space in it, and the source's `encodeURI` sends
  // `%20` where `URLSearchParams` would send `+`. Whether a gateway reads `+`
  // back as a space is not something this port has exercised, and if it does
  // not the P&L comes back empty rather than erroring.
  it("encodes a space as %20, the way the source does, and never as +", () => {
    expect(balanceStatementUrl(RANGE, ["NA - CENTRAL", "- None -"])).not.toContain("+");
    expect(balanceStatementUrl(RANGE, ["NO POD"])).toContain("subRegions=NO%20POD");
  });

  it("says nothing about sub-regions when none were chosen", () => {
    expect(balanceStatementUrl(RANGE, [])).not.toContain("subRegions");
  });
});

describe("reading the statement", () => {
  it("hands back what the backend sent", async () => {
    answers.set(balanceStatementUrl(RANGE, []), STATEMENT);
    const { result } = renderStatement();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.statement).toEqual(STATEMENT);
  });

  it("is loading before it has answered, and holds an empty statement", () => {
    const { result } = renderStatement();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.statement).toEqual({});
  });

  // The URL is the cache key, so a different range is a different question.
  it("asks again when the range moves", async () => {
    const client = newClient();
    answers.set(balanceStatementUrl(RANGE, []), STATEMENT);
    const later: MisFlashRange = { startDate: "2025-10-01", endDate: "2026-10-01" };
    answers.set(balanceStatementUrl(later, []), { revenue: [] });

    const { result } = renderStatement(RANGE, [], client);
    await waitFor(() => expect(result.current.statement).toEqual(STATEMENT));
    const second = renderStatement(later, [], client);
    await waitFor(() => expect(second.result.current.statement).toEqual({ revenue: [] }));
    expect(authedGet).toHaveBeenCalledTimes(2);
  });

  it("asks again when the sub-regions change", async () => {
    const client = newClient();
    answers.set(balanceStatementUrl(RANGE, []), STATEMENT);
    answers.set(balanceStatementUrl(RANGE, ["EU : EU 1"]), { revenue: [] });

    const { result } = renderStatement(RANGE, [], client);
    await waitFor(() => expect(result.current.statement).toEqual(STATEMENT));
    const narrowed = renderStatement(RANGE, ["EU : EU 1"], client);
    await waitFor(() => expect(narrowed.result.current.statement).toEqual({ revenue: [] }));
  });
});

describe("a response that is not a statement", () => {
  // A gateway error page arrives as a 200 whose body is a string. Reading
  // `.revenue` off one would draw fourteen empty sections and call it an
  // answer.
  it("reports nothing rather than a statement made of a string", async () => {
    answers.set(balanceStatementUrl(RANGE, []), "<html>Gateway Timeout</html>");
    const { result } = renderStatement();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.statement).toEqual({});
  });

  it("reports nothing rather than a statement made of a list", async () => {
    answers.set(balanceStatementUrl(RANGE, []), [1, 2, 3]);
    const { result } = renderStatement();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.statement).toEqual({});
  });
});

describe("when the read fails", () => {
  it("surfaces the backend's own message", async () => {
    answers.set(
      balanceStatementUrl(RANGE, []),
      new HttpError("https://flash.example", 403, '{"message":"Flash backend is down"}'),
    );
    const { result } = renderStatement();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.errorMessage).toBe("Flash backend is down");
  });

  // Without the identity fold the query stays disabled — neither erroring nor
  // fetching — and the P&L paints its headings with every line missing, which
  // reads as a company that traded nothing.
  it("reports an identity failure as an error, not as an empty P&L", async () => {
    identity.value = { status: "error", message: "Could not establish who you are." };
    const { result } = renderStatement();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.errorMessage).toBe("Could not establish who you are.");
    result.current.retry();
    expect(retryIdentity).toHaveBeenCalled();
  });
});
