/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

// Two privileges, one array, one backend. The MIS ARR service answers for both
// dashboards — arr-backend service.bal:55-69 pushes 987 and 789 into the same
// `int[] privileges` — so there is one call here, not two, and holding one
// number says nothing about the other.
//
//   987  ARR Build / QRR / MRR / ARR Analysis   (Config.js:56)
//   789  Flash Dashboard                        (Config.js:57)
//
// Both numbers are already spoken for elsewhere in THIS app and mean something
// different there: 987 is people-app's "every authenticated user" (appMenu.ts
// PRIVILEGE.EMPLOYEE) and leave-app's EMPLOYEE, and 789 is leave-app's
// PEOPLE_OPS_TEAM (leaveTypes.ts:58-63). That is why this gate reads its own
// /user-info and never the shared capabilities — see CONTEXT.md.

const state = {
  privileges: [] as number[],
  isPending: false,
  isError: false,
  configured: true,
};

vi.mock("@config/apiConfig", () => ({ isMisArrConfigured: () => state.configured }));

vi.mock("./useMisUserInfo", () => ({
  useMisUserInfo: () => ({
    data: { privileges: state.privileges },
    isPending: state.isPending,
    isError: state.isError,
    error: state.isError ? new Error("Gateway timed out.") : null,
    refetch: () => {},
  }),
}));

const { useMisGate } = await import("./useMisGate");
const { MIS_ITEM_IDS } = await import("@constants/misApps");

const gate = () => renderHook(() => useMisGate()).result.current;

const ARR = 987;
const FLASH = 789;

beforeEach(() => {
  state.privileges = [];
  state.isPending = false;
  state.isError = false;
  state.configured = true;
});

describe("the ARR privilege", () => {
  it("opens the three Build screens and ARR Analysis", () => {
    state.privileges = [ARR];
    expect(gate().canSee("mis-arr-build")).toBe(true);
    expect(gate().canSee("mis-qrr-build")).toBe(true);
    expect(gate().canSee("mis-mrr-build")).toBe(true);
    expect(gate().canSee("mis-analysis")).toBe(true);
  });

  // Test checklist §10.10. The two privileges are independent — the backend
  // pushes each on its own condition, so holding one is the common case, not
  // an edge case.
  it("does not open the Flash Dashboard", () => {
    state.privileges = [ARR];
    expect(gate().canSee("mis-flash")).toBe(false);
  });
});

describe("the Flash privilege", () => {
  it("opens the Flash Dashboard", () => {
    state.privileges = [FLASH];
    expect(gate().canSee("mis-flash")).toBe(true);
  });

  // Test checklist §10.11.
  it("does not open the Build screens", () => {
    state.privileges = [FLASH];
    expect(gate().canSee("mis-arr-build")).toBe(false);
    expect(gate().canSee("mis-qrr-build")).toBe(false);
    expect(gate().canSee("mis-mrr-build")).toBe(false);
    expect(gate().canSee("mis-analysis")).toBe(false);
  });

  it("is held alongside the ARR one by someone who has both", () => {
    state.privileges = [ARR, FLASH];
    expect(gate().canSee("mis-arr-build")).toBe(true);
    expect(gate().canSee("mis-flash")).toBe(true);
  });
});

// Test checklist §10.12. Signing in is not a MIS privilege — which is exactly
// what 987 means everywhere else in this app, and why this case is the one
// most likely to regress.
describe("someone holding neither privilege", () => {
  it("sees no MIS screen at all", () => {
    state.privileges = [];
    for (const id of ["mis-arr-build", "mis-qrr-build", "mis-mrr-build", "mis-analysis", "mis-flash"]) {
      expect(gate().canSee(id), `${id} is visible without a MIS privilege`).toBe(false);
    }
  });

  it("is not let in by One WSO2's own privilege numbers", () => {
    // 993 LEAD, 991 SERVICE_DESK, 999 ADMIN — being a people-app admin says
    // nothing about company revenue reporting.
    state.privileges = [993, 991, 999];
    expect(gate().canSee("mis-arr-build")).toBe(false);
    expect(gate().canSee("mis-flash")).toBe(false);
  });
});

// Test checklist §10.13. The sibling gates fail closed via a RESTRICTED_IDS set
// derived from `requires`, which leaves their unrestricted items open by
// default. MIS has no unrestricted items — there is no MIS screen a signed-in
// stranger may see — so the default here is closed outright, which is both
// simpler and stricter. An id the gate has no opinion about is not a bug to be
// discovered in production.
describe("an id this gate has no mapping for", () => {
  it("is hidden even from someone holding both privileges", () => {
    state.privileges = [ARR, FLASH];
    expect(gate().canSee("mis-something-added-later")).toBe(false);
  });

  // The other half of failing closed: a screen added to the registry but not
  // to the switch above is SAFE, but it is also invisible to everyone, which
  // is a bug nobody reports because the screen simply never appears. The
  // registry suite asserts that every item routes to this gate; this asserts
  // the gate actually has an answer for each of them.
  it("is not something any registered MIS screen quietly became", () => {
    state.privileges = [ARR, FLASH];
    for (const id of MIS_ITEM_IDS) {
      expect(gate().canSee(id), `${id} is in the registry but unmapped in useMisGate`).toBe(true);
    }
  });
});

// The distinction useMarketingOpsGate documents at length, and the reason this
// gate cannot just return a boolean: "you are not in the group" and "the call
// failed" both leave us without privileges, and they mean opposite things to
// the person reading the screen. Telling someone they lack access when the
// gateway timed out sends them to an admin to fix a permission they already
// hold.
describe("a failed authorization check", () => {
  it("reports an error rather than a denial", () => {
    state.isError = true;
    expect(gate().isError).toBe(true);
    expect(gate().isAuthorized).toBe(false);
    expect(gate().errorMessage).toBe("Gateway timed out.");
  });

  it("is distinguishable from an honest denial", () => {
    state.privileges = [];
    expect(gate().isAuthorized).toBe(false);
    expect(gate().isError).toBe(false);
    expect(gate().errorMessage).toBeUndefined();
  });

  it("still hides every screen, whichever it is", () => {
    state.isError = true;
    expect(gate().canSee("mis-arr-build")).toBe(false);
    expect(gate().canSee("mis-flash")).toBe(false);
  });
});

describe("holding any MIS privilege at all", () => {
  it("counts as authorized, whichever one it is", () => {
    state.privileges = [ARR];
    expect(gate().isAuthorized).toBe(true);
    state.privileges = [FLASH];
    expect(gate().isAuthorized).toBe(true);
  });
});

// A gate that is switched off must never report itself mid-flight: the rail
// asks every perspective for a gate, and a disabled one claiming to be
// resolving would hold up a screen that is not even MIS.
describe("while the check is in flight", () => {
  it("says so, so callers can hold off rather than flash a denial", () => {
    state.isPending = true;
    expect(gate().isResolving).toBe(true);
  });

  it("reports nothing while the gate is switched off", () => {
    state.isPending = true;
    const off = renderHook(() => useMisGate(false)).result.current;
    expect(off.isResolving).toBe(false);
  });

  // With no ARR URL configured the query is disabled, and a disabled query is
  // `isPending` forever — so a gate reading that alone would resolve forever.
  // `usePerspectiveVisibility` waits on every gate before the Finance landing
  // forwards anyone anywhere, so that would strand the whole perspective in
  // every environment where MIS is not configured, which today is most of
  // them. useDueDiligenceGate states the same rule for the same reason.
  it("is not resolving when there is no ARR backend to ask", () => {
    state.configured = false;
    state.isPending = true;
    expect(gate().isResolving).toBe(false);
    expect(gate().canSee("mis-arr-build")).toBe(false);
  });
});
