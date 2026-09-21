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

// The filter bar's menus, fetched once and shared by every control.

vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
const retryIdentity = vi.fn();
const identity = {
  value: { status: "ready", sub: "user-under-test" } as
    | { status: "ready"; sub: string }
    | { status: "error"; message: string }
    | { status: "resolving" },
};
// Only the hook is stubbed. `foldIdentityError` stays real: it is the thing
// under test on the identity-failure case below, and a mock of it would leave
// that test asserting against itself.
vi.mock("@hooks/useAsgardeoSub", async () => {
  const actual = await vi.importActual<typeof import("@hooks/useAsgardeoSub")>(
    "@hooks/useAsgardeoSub",
  );
  return { ...actual, useAsgardeoSub: () => ({ state: identity.value, retry: retryIdentity }) };
});
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@config/apiConfig", () => ({
  isMisArrConfigured: () => true,
  misArrServiceUrls: { appConfigs: "https://mis.example/app-configs" },
}));

const answer = { value: undefined as unknown };
const authedGet = vi.fn(async () => {
  if (answer.value instanceof Error) throw answer.value;
  return answer.value;
});
vi.mock("@api/http", async () => {
  const actual = await vi.importActual<typeof import("@api/http")>("@api/http");
  return { ...actual, authedGet: () => authedGet() };
});

const { useMisAppConfigs } = await import("./useMisAppConfigs");

const newClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });

function renderConfigs(client = newClient()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { ...renderHook(() => useMisAppConfigs(), { wrapper }), client };
}

beforeEach(() => {
  authedGet.mockClear();
  retryIdentity.mockClear();
  identity.value = { status: "ready", sub: "user-under-test" };
  answer.value = {
    salesRegions: ["EMEA", "APAC"],
    shippingCountries: ["Sri Lanka"],
    industries: ["Utilities"],
    accountOwners: [{ name: "Ada Ames", email: "ada@wso2.com" }],
    businessUnits: ["IAM_BU", "APIM_BU"],
  };
});

describe("once the call answers", () => {
  it("hands each control its menu, sorted", async () => {
    const { result } = renderConfigs();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.options.salesRegions).toEqual(["APAC", "EMEA"]);
    expect(result.current.options.businessUnits).toEqual(["APIM_BU", "IAM_BU"]);
    expect(result.current.options.accountOwners).toEqual(["Ada Ames"]);
  });

  it("asks once however many controls read it", async () => {
    const client = newClient();
    const first = renderConfigs(client);
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    const second = renderConfigs(client);
    await waitFor(() => expect(second.result.current.isLoading).toBe(false));
    expect(authedGet).toHaveBeenCalledTimes(1);
  });
});

describe("before the call answers", () => {
  it("offers empty menus rather than undefined, so a control still renders", () => {
    const { result } = renderConfigs();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.options.salesRegions).toEqual([]);
    expect(result.current.options.countries).toEqual([]);
  });
});

describe("when the call fails", () => {
  // The menus are the only casualty: every OTHER control on the bar — Type,
  // View, Years Back, YTD, Channel, Scale — has its options written down in
  // this app, so a bar whose lists came back empty is still a usable bar.
  it("says so, offers a retry, and still leaves the bar usable", async () => {
    // A 4xx, which `httpRetry` refuses to retry — so the failure is the
    // hook's answer rather than a race with a backoff.
    answer.value = new HttpError("https://mis.example", 403, "");
    const { result } = renderConfigs();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.errorMessage).not.toBe("");
    expect(result.current.options).toEqual(
      expect.objectContaining({ salesRegions: [], countries: [], accountOwners: [] }),
    );
    expect(typeof result.current.retry).toBe("function");
  });

  it("reports an identity failure as its own, with the identity retry", async () => {
    identity.value = { status: "error", message: "Could not read your session." };
    const { result } = renderConfigs();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.errorMessage).toBe("Could not read your session.");
    result.current.retry();
    expect(retryIdentity).toHaveBeenCalled();
  });
});

describe("a 200 that is not the shape it should be", () => {
  it("is treated as no lists rather than trusted into the menus", async () => {
    answer.value = "<html>gateway</html>";
    const { result } = renderConfigs();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.options.salesRegions).toEqual([]);
  });
});

// ---- the ARR Analysis feature flag ----------------------------------------
//
// `productsUsageEnabled` decides whether ARR Analysis exists at all — the rail
// entry, and whether its route redirects. It rides in on this response rather
// than getting a call of its own, so it is read here.
//
// The cases that matter are the three non-true ones, and they are NOT the same
// answer: the flag being FALSE is a fact about the app, while the call still
// being in flight or having failed is an absence of one. `analysisEnabled` is
// therefore false in all three, and callers separate them by `isLoading` and
// `isError` — which is what lets the route hold rather than redirect on a cold
// load, and say so rather than redirect on a failure.
describe("the ARR Analysis flag", () => {
  it("is on when the backend says so", async () => {
    answer.value = { productsUsageEnabled: true };
    const { result } = renderConfigs();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.analysisEnabled).toBe(true);
  });

  it("is off when the backend says so", async () => {
    answer.value = { productsUsageEnabled: false };
    const { result } = renderConfigs();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.analysisEnabled).toBe(false);
  });

  // A backend that has not grown the field yet, and a 200 carrying a gateway
  // error page, both land here. Neither is a licence to open the screen.
  it("is off when the field is missing, or the body is not a body", async () => {
    answer.value = { salesRegions: ["EMEA"] };
    const missing = renderConfigs();
    await waitFor(() => expect(missing.result.current.isLoading).toBe(false));
    expect(missing.result.current.analysisEnabled).toBe(false);

    answer.value = "<html>gateway</html>";
    const gateway = renderConfigs(newClient());
    await waitFor(() => expect(gateway.result.current.isLoading).toBe(false));
    expect(gateway.result.current.analysisEnabled).toBe(false);
  });

  // Truthiness is not the test. The backend declares a `boolean`, so a string
  // arriving here means the body is not what it claims to be.
  it("is off for a value that is not the boolean the backend declares", async () => {
    answer.value = { productsUsageEnabled: "true" };
    const { result } = renderConfigs();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.analysisEnabled).toBe(false);
  });

  it("is off, but distinguishably so, while the call is still in flight", () => {
    const { result } = renderConfigs();
    expect(result.current.analysisEnabled).toBe(false);
    expect(result.current.isLoading).toBe(true);
  });

  it("is off, but distinguishably so, when the call failed", async () => {
    answer.value = new HttpError("https://mis.example", 403, "");
    const { result } = renderConfigs();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.analysisEnabled).toBe(false);
  });
});
