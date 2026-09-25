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
import { HouseIcon } from "@wso2/oxygen-ui-icons-react";
import { PERSPECTIVES } from "@constants/perspectives";

// The `mis` preview flag holds MIS back AS A WHOLE (previewFeatures.ts), and
// that has to include its backend. config.js.example allows the ARR URL to be
// set with the flag off, and on stage that is not hypothetical: /user-info
// answers 500 after about 40s (docs/ported-apps/mis.md §11.1). A gate still
// asking would hold every Finance landing on a screen nobody can see, then tell
// claim approvers "Couldn't work out what you can open in Finance".
//
// So this file leaves the flag OFF, which is the default (nothing here sets
// ONE_WSO2_PREVIEW_FEATURES), and asks the hook the rail and the landing both
// read. Its twin with the flag on is misRail.test.tsx.

vi.mock("@config/apiConfig", async () => {
  const actual = await vi.importActual<typeof import("@config/apiConfig")>("@config/apiConfig");
  return { ...actual, isMisArrConfigured: () => true };
});

// Mocked at the QUERY hook, as misRail.test.tsx does, and made to behave the way
// a real useQuery does on each side of `enabled`: disabled, it is pending for
// good and never errors; enabled, it has gone to the backend and met stage.
type Backend = "in-flight" | "failed";
const backend = { value: "failed" as Backend };
const asked = { userInfo: false, appConfigs: false };

vi.mock("@features/finance/mis/api/useMisUserInfo", () => ({
  useMisUserInfo: (enabled = true) => {
    if (!enabled) {
      return { data: undefined, isPending: true, isError: false, error: null, refetch: () => {} };
    }
    asked.userInfo = true;
    const failed = backend.value === "failed";
    return {
      data: undefined,
      isPending: !failed,
      isError: failed,
      error: failed ? new Error("Unable to retrieve employee information") : null,
      refetch: () => {},
    };
  },
}));
vi.mock("@features/finance/mis/api/useMisAppConfigs", () => ({
  useMisAppConfigs: (enabled = true) => {
    if (enabled) asked.appConfigs = true;
    return { analysisEnabled: false };
  },
}));

const financePerspective = PERSPECTIVES.find((p) => p.key === "finance")!;
vi.mock("@context/perspective/PerspectiveContext", () => ({
  useActivePerspective: () => ({
    key: "finance",
    label: "Finance",
    icon: HouseIcon,
    path: "/finance",
    access: true,
    sections: financePerspective.sections,
  }),
}));

// Every other gate answers settled and closed, so the only thing that could
// hold the aggregate is MIS.
const other = { canSee: () => false, isResolving: false };
const noFailure = { isError: false, retry: () => {} };
vi.mock("@api/useUserInfo", () => ({
  useUserInfo: () => ({ data: { privileges: [] }, isLoading: false, isError: false }),
}));
vi.mock("@features/finance/api/useFinanceGate", () => ({ useFinanceGate: () => other }));
vi.mock("@features/leave/api/useLeaveGate", () => ({ useLeaveGate: () => other }));
vi.mock("@features/marketing-ops/api/useMarketingOpsGate", () => ({
  useMarketingOpsGate: () => ({ ...other, ...noFailure, isAuthorized: false, isAdmin: false }),
}));
vi.mock("@features/due-diligence/api/useDueDiligenceGate", () => ({
  useDueDiligenceGate: () => ({ ...other, ...noFailure }),
}));
vi.mock("@features/security/api/useSecurityGate", () => ({ useSecurityGate: () => other }));
vi.mock("@features/subscriptions/api/useSubscriptionGate", () => ({
  useSubscriptionGate: () => ({ ...other, ...noFailure, isAdmin: false }),
}));
vi.mock("@features/par/api/useParData", () => ({
  useParCanSeeLeadPortal: () => ({ canSee: false, isLoading: false }),
}));
vi.mock("@features/par/api/useParIsAdmin", () => ({
  useParIsAdmin: () => ({ isAdmin: false, isLoading: false }),
}));

const { usePerspectiveVisibility } = await import("@components/side-rail/usePerspectiveVisibility");

beforeEach(() => {
  backend.value = "failed";
  asked.userInfo = false;
  asked.appConfigs = false;
});

describe("Finance, with the mis preview flag off and the ARR URL set", () => {
  it("asks the MIS backend nothing", () => {
    renderHook(() => usePerspectiveVisibility());
    expect(asked.userInfo, "GET /user-info went out").toBe(false);
    expect(asked.appConfigs, "GET /app-configs went out").toBe(false);
  });

  it("is not held up while MIS's /user-info is in flight", () => {
    backend.value = "in-flight";
    const { result } = renderHook(() => usePerspectiveVisibility());
    expect(result.current.isResolving).toBe(false);
  });

  it("does not report MIS's failure as Finance's", () => {
    backend.value = "failed";
    const { result } = renderHook(() => usePerspectiveVisibility());
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeUndefined();
  });
});
