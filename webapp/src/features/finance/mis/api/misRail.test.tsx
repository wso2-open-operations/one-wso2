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
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { HouseIcon } from "@wso2/oxygen-ui-icons-react";
import { PERSPECTIVES } from "@constants/perspectives";

// The MIS rail entries are behind the `mis` preview flag (previewFeatures.ts),
// and the registry is read once, at import — so the flag has to be on before it
// is. Its OFF half is pinned in perspectives.test.ts.
vi.hoisted(() => {
  window.config = {
    ...(window.config ?? {}),
    ONE_WSO2_PREVIEW_FEATURES: { mis: true },
  } as Window["config"];
});

// The half of §10.10 / §10.11 / §10.12 that says "in the rail".
//
// The gate suite proves the decision and the routing suite proves the screens
// honour it, but BETWEEN them sits a line of dispatch in SideRail —
// `if (MIS_ITEM_IDS.has(s.id)) return misGate.canSee(s.id)` — that neither
// touches. Delete that line and every other MIS test still passes, while the
// rail silently falls through to `sectionAllowed(requires, caps)`, where
// `requires: ["admin"]` means a people-app admin. So this renders the REAL rail
// with the REAL gate and mocks only the HTTP answer underneath.

const privileges = { value: [] as number[] };
// `productsUsageEnabled` from GET /app-configs — whether ARR Analysis exists.
// On by default, so the cases below are about privileges; its own case turns
// it off.
const analysisEnabled = { value: true };

vi.mock("@config/apiConfig", async () => {
  const actual = await vi.importActual<typeof import("@config/apiConfig")>("@config/apiConfig");
  return { ...actual, isMisArrConfigured: () => true };
});

// Both mocked at the QUERY hook, not at useMisGate: the gate itself is what is
// under test here, along with the rail's dispatch to it.
vi.mock("@features/finance/mis/api/useMisAppConfigs", () => ({
  useMisAppConfigs: () => ({ analysisEnabled: analysisEnabled.value }),
}));
vi.mock("@features/finance/mis/api/useMisUserInfo", () => ({
  useMisUserInfo: () => ({
    data: { privileges: privileges.value },
    isPending: false,
    isError: false,
    error: null,
    refetch: () => {},
  }),
}));

const financePerspective = PERSPECTIVES.find((p) => p.key === "finance")!;
vi.mock("@context/perspective/PerspectiveContext", () => ({
  useActivePerspective: () => ({
    key: "finance",
    label: "Finance",
    // SideRail renders `<active.icon />` for the overview row, so a stand-in
    // without one crashes the component rather than failing an assertion.
    icon: HouseIcon,
    path: "/finance",
    access: true,
    sections: financePerspective.sections,
  }),
}));

// The other perspectives' gates still get called — SideRail asks for every gate
// on every render — so they need answers that do not reach a real useQuery.
const other = { canSee: () => false, isResolving: false };
vi.mock("@api/useUserInfo", () => ({
  useUserInfo: () => ({ data: { privileges: [] }, isLoading: false, isError: false }),
}));
vi.mock("@features/finance/api/useFinanceGate", () => ({ useFinanceGate: () => other }));
vi.mock("@features/leave/api/useLeaveGate", () => ({ useLeaveGate: () => other }));
vi.mock("@features/marketing-ops/api/useMarketingOpsGate", () => ({
  useMarketingOpsGate: () => ({ ...other, isAuthorized: false, isAdmin: false }),
}));
// The gates upstream's usePerspectiveVisibility asks as well. Mocked for this
// file's own reason — an unmocked gate reaches its real useQuery and fails the
// file for want of a QueryClient — and closed, so nothing but MIS is offered.
const noFailure = { isError: false, retry: () => {} };
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

const { default: SideRail } = await import("@components/side-rail/SideRail");

// A rail group renders its children only while it is OPEN, and a group opens
// itself when it holds the current route. So each case starts on the screen its
// user would actually be on — landing on /finance would leave the MIS group
// shut and every assertion below vacuously true.
function showRail(initial = "/finance/mis/arr-build") {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <SideRail collapsed={false} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  privileges.value = [];
  analysisEnabled.value = true;
});

describe("the Finance rail", () => {
  // §10.10
  it("offers the ARR screens to someone holding the ARR privilege, and no Flash Dashboard", () => {
    privileges.value = [987];
    showRail();
    expect(screen.getByText("ARR Build")).toBeInTheDocument();
    expect(screen.queryByText("Flash Dashboard")).not.toBeInTheDocument();
  });

  // ADR 0005: the Flash Dashboard stays in the MIS app, so its privilege has
  // nothing to open here — not a Flash row, and not an empty MIS group either.
  it("offers no MIS entry at all to someone holding only the Flash privilege", () => {
    privileges.value = [789];
    showRail();
    expect(screen.queryByText("Flash Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("ARR Build")).not.toBeInTheDocument();
    expect(screen.queryByText("MIS")).not.toBeInTheDocument();
  });

  // §10.12. The case the 987 collision makes dangerous: this person IS
  // privilege 987 as far as One WSO2 is concerned, because every authenticated
  // user is. Only the MIS backend's own answer says otherwise.
  it("offers no MIS entry at all to someone holding neither", () => {
    privileges.value = [];
    showRail();
    expect(screen.queryByText("ARR Build")).not.toBeInTheDocument();
    expect(screen.queryByText("MIS")).not.toBeInTheDocument();
  });

  // A rail row that navigates nowhere is worse than no row. SideRail renders
  // every VISIBLE child of a group whether or not it carries a path, and a
  // pathless one falls through onSelect to scrollToSection() — a no-op away
  // from the overview page. So the registry must not list a screen before its
  // route exists.
  it("offers no row that goes nowhere", () => {
    privileges.value = [987];
    showRail();
    // Every registered screen is routed now, so the rule this test guards has
    // nothing left to hold back — what it asserts instead is that all four
    // rows are live. A screen added to the registry without a route would show
    // up here as a fifth row that navigates nowhere.
    for (const live of ["ARR Build", "QRR Build", "MRR Build", "ARR Analysis"]) {
      expect(screen.getByText(live), `${live} is routed but not in the rail`).toBeInTheDocument();
    }
  });

  // The flag half of ticket 13: off means the entry is ABSENT, not disabled.
  // This is the assertion that would catch the flag being dropped from the
  // gate — the routing suite's redirect could pass while the rail still
  // advertised a screen that bounces on click.
  it("drops the ARR Analysis row when the backend flag is off, and keeps the rest", () => {
    privileges.value = [987];
    analysisEnabled.value = false;
    showRail();
    expect(screen.queryByText("ARR Analysis")).not.toBeInTheDocument();
    for (const live of ["ARR Build", "QRR Build", "MRR Build"]) {
      expect(screen.getByText(live), `${live} was dropped by the ARR Analysis flag`).toBeInTheDocument();
    }
  });

  // The flag is not a second way in. It says the screen exists; the privilege
  // says who may read it.
  it("does not let the flag alone put ARR Analysis in front of a reader without ARR", () => {
    privileges.value = [789];
    showRail();
    expect(screen.queryByText("ARR Analysis")).not.toBeInTheDocument();
  });
});
