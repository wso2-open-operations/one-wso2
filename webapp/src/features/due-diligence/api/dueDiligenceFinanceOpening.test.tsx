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
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { WalletIcon } from "@wso2/oxygen-ui-icons-react";
import { HttpError } from "@api/http";
import { PERSPECTIVES } from "@constants/perspectives";
import { DUE_DILIGENCE_BASE_PATH } from "@features/due-diligence/paths";

// Opening Finance asks Due Diligence /user-info along with every other finance
// gate. The deployed interceptor answers 403 before the resource can return
// the empty role list. That refusal must settle as "no rows", so someone who
// can open nothing in Finance sees the same empty card as Marketing Ops and
// Security. A 403 reported as a failed read is what puts the error banner
// on that screen.
//
// The Due Diligence gate and its /user-info hook run for real. Every other
// gate that can stop this landing is mocked closed, including MIS, whose
// failed read would otherwise show the same banner. The only way off this
// landing is a Due Diligence role, and the only way onto the error banner
// is a real failure of this read.

const authedGet = vi.fn();
vi.mock("@api/http", async () => {
  const actual = await vi.importActual<typeof import("@api/http")>("@api/http");
  return { ...actual, authedGet: (...args: unknown[]) => authedGet(...args) };
});
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@hooks/useAsgardeoSub", async () => {
  const actual = await vi.importActual<typeof import("@hooks/useAsgardeoSub")>("@hooks/useAsgardeoSub");
  return {
    ...actual,
    useAsgardeoSub: () => ({ state: { status: "ready", sub: "uid-1" }, retry: vi.fn() }),
  };
});
vi.mock("@config/apiConfig", async () => {
  const actual = await vi.importActual<typeof import("@config/apiConfig")>("@config/apiConfig");
  return { ...actual, isDueDiligenceBackendConfigured: () => true };
});

const financePerspective = PERSPECTIVES.find((p) => p.key === "finance")!;
vi.mock("@context/perspective/PerspectiveContext", () => ({
  useActivePerspective: () => ({
    key: "finance",
    label: "Finance",
    icon: WalletIcon,
    path: "/finance",
    access: true,
    sections: financePerspective.sections,
  }),
}));

vi.mock("@api/useUserInfo", () => ({
  useUserInfo: () => ({ data: { privileges: [] }, isLoading: false, isError: false }),
}));

const other = { canSee: () => false, isResolving: false, itemAnswered: () => true };
const noFailure = { isError: false, retry: () => {} };
vi.mock("@features/finance/mis/api/useMisGate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/finance/mis/api/useMisGate")>()),
  useMisGate: () => ({ ...other, ...noFailure, errorMessage: undefined }),
}));
vi.mock("@features/my/api/useBankingAdminAccess", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/my/api/useBankingAdminAccess")>()),
  useBankingAdminAccess: () => ({ canSee: false, isResolving: false, isError: false, retry: () => {} }),
}));
vi.mock("@features/finance/api/useFinanceGate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/finance/api/useFinanceGate")>()),
  useFinanceGate: () => other,
}));
vi.mock("@features/leave/api/useLeaveGate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/leave/api/useLeaveGate")>()),
  useLeaveGate: () => other,
}));
vi.mock("@features/marketing-ops/api/useMarketingOpsGate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/marketing-ops/api/useMarketingOpsGate")>()),
  useMarketingOpsGate: () => ({ ...other, ...noFailure, isAuthorized: false, isAdmin: false }),
}));
vi.mock("@features/security/api/useSecurityGate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/security/api/useSecurityGate")>()),
  useSecurityGate: () => other,
}));
vi.mock("@features/sales/api/useSalesGate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/sales/api/useSalesGate")>()),
  useSalesRailGate: () => ({ ...other, ...noFailure, errorMessage: undefined }),
}));
vi.mock("@features/my/api/useMeProfile", () => ({
  useMeProfile: () => ({ data: undefined, isLoading: false }),
}));
vi.mock("@features/subscriptions/api/useSubscriptionGate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/subscriptions/api/useSubscriptionGate")>()),
  useSubscriptionGate: () => ({ ...other, ...noFailure, isAdmin: false }),
}));
vi.mock("@features/par/api/useParData", () => ({
  useParCanSeeLeadPortal: () => ({ canSee: false, isLoading: false }),
  useParEmployeeItemVisible: () => ({ canSee: false, isLoading: false }),
}));
vi.mock("@features/par/api/useParIsAdmin", () => ({
  useParIsAdmin: () => ({ isAdmin: false, isLoading: false }),
}));
vi.mock("@features/promotion/api/usePromotionRoles", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/promotion/api/usePromotionRoles")>()),
  usePromotionPrivileges: () => ({
    isLead: false,
    isFunctionalLead: false,
    isHrAdmin: false,
    isPromotionBoardMember: false,
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("@features/infra/api/useInfraGate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/infra/api/useInfraGate")>()),
  useInfraGate: () => ({ ...other, ...noFailure, isAuthorized: false, isAdmin: false }),
}));
vi.mock("@features/umt/api/useUmtGate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/umt/api/useUmtGate")>()),
  useUmtGate: () => ({ ...other, ...noFailure, isAuthorized: false, isAdmin: false }),
}));

vi.mock("@asgardeo/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@asgardeo/react")>()),
  useAsgardeo: () => ({
    isSignedIn: true,
    getDecodedIdToken: async () => ({ sub: "uid-1" }),
  }),
}));

function withQueries() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const { default: PerspectiveLanding } = await import("@components/perspective-landing/PerspectiveLanding");

function Address() {
  return <div data-testid="address">{useLocation().pathname}</div>;
}

function openFinance() {
  return render(
    <MemoryRouter initialEntries={["/finance"]}>
      <Address />
      <Routes>
        <Route path="/finance" element={<PerspectiveLanding />} />
        <Route path="*" element={<div>somewhere else</div>} />
      </Routes>
    </MemoryRouter>,
    { wrapper: withQueries() },
  );
}

const address = () => screen.getByTestId("address").textContent;

beforeEach(() => {
  authedGet.mockReset();
});

describe("Finance when Due Diligence is the only read still in play", () => {
  it("shows the empty card when user-info is refused", async () => {
    authedGet.mockRejectedValue(new HttpError("https://dd.example/user-info", 403, ""));
    openFinance();

    expect(await screen.findByRole("heading", { name: "Nothing here for you yet" })).toBeInTheDocument();
    expect(screen.queryByText(/Couldn't work out what you can open/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Home" })).toBeInTheDocument();
    expect(address()).toBe("/finance");
  });

  it("opens Partners when user-info returns a Due Diligence role", async () => {
    authedGet.mockResolvedValue({ roles: ["financeRole"] });
    openFinance();

    await waitFor(() => expect(address()).toBe(`${DUE_DILIGENCE_BASE_PATH}/partners`));
    expect(screen.queryByRole("heading", { name: "Nothing here for you yet" })).not.toBeInTheDocument();
  });

  it("keeps the error banner when user-info fails outright", async () => {
    authedGet.mockRejectedValue(new HttpError("https://dd.example/user-info", 500, ""));
    openFinance();

    // httpRetry waits out its one retry before the read is a failure, and the
    // landing stays on "Opening Finance" until that retry is done.
    expect(
      await screen.findByText(/Couldn't work out what you can open in Finance/, undefined, {
        timeout: 4000,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Nothing here for you yet" })).not.toBeInTheDocument();
  });
});
