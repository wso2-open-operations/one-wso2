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

// A bare React Query result, with every flag this component actually reads
// set explicitly — so a test states the exact state it means, rather than
// `isLoading: false` quietly standing in for three different shapes. Same
// fixture shape `OpdDashboardScreen.test.tsx` uses, for the same reason: the
// refusal here is gated the same way, after the same review finding.
function queryState(over: {
  isLoading?: boolean;
  isPending?: boolean;
  isFetching?: boolean;
  isError?: boolean;
  isSuccess?: boolean;
  data?: unknown;
  error?: unknown;
}) {
  return {
    isLoading: false,
    isPending: false,
    isFetching: false,
    isError: false,
    isSuccess: false,
    data: undefined,
    error: null,
    refetch: vi.fn(),
    ...over,
  };
}

const configured = { value: true };
const appDataState = { current: queryState({}) };
const reportState = { current: queryState({}) };

vi.mock("@config/apiConfig", () => ({
  isExpenseBackendConfigured: () => configured.value,
}));
vi.mock("../useExpense", () => ({
  useExpenseAppData: () => appDataState.current,
}));
vi.mock("./useExpenseDashboard", () => ({
  isExpenseBackendConfigured: () => configured.value,
  useExpenseSubsidiaries: () => queryState({ isSuccess: true, data: [] }),
  useExpenseDashboardTypes: () => queryState({ isSuccess: true, data: [] }),
  useExpenseClaimsReport: () => reportState.current,
}));

const { default: ExpenseDashboardScreen } = await import("./ExpenseDashboardScreen");

const FINANCE_APP_DATA = { enableFinanceView: true, enableLeadView: false, currencyCode: "USD" };

const emptyReport = {
  reportingCurrency: "USD",
  current: { claimCount: 0, totalValue: 0, averageClaimValue: 0 },
  prior: { claimCount: 0, totalValue: 0, averageClaimValue: 0 },
  statusBreakdown: [],
  entityBreakdown: [],
  expenseTypeColumns: [],
  monthlyBreakdown: [],
  employeeBreakdown: [],
  availableSalesRegions: [],
};

const populatedReport = {
  ...emptyReport,
  current: { claimCount: 10, totalValue: 1000, averageClaimValue: 100 },
  claimCountChangePercentage: 25,
  totalValueChangePercentage: 25,
  averageClaimValueChangePercentage: 0,
  statusBreakdown: [{ status: "APPROVED", count: 10, averageDaysPending: 2 }],
};

beforeEach(() => {
  configured.value = true;
  appDataState.current = queryState({ isSuccess: true, data: FINANCE_APP_DATA });
  reportState.current = queryState({ isSuccess: true, data: populatedReport });
});

const refusal = () => screen.queryByText(/limited to the finance team/);
const notConnected = () => screen.queryByText(/isn't connected yet/);
const aStat = () => screen.queryByText(/claim count/i);

// THE regression this screen's sibling was reported for, pinned here too: a
// query disabled rather than loading sits at `isPending: true, isFetching:
// false, isLoading: false, isSuccess: false, isError: false` for good.
// Gating the refusal on `isSuccess` reads that shape as "might still
// answer" and falls through silently to a blank page.
describe("an app-data query that is disabled rather than loading", () => {
  it("shows the refusal, not a blank screen", () => {
    appDataState.current = queryState({ isPending: true, isFetching: false, isLoading: false });

    render(<ExpenseDashboardScreen />);

    expect(refusal()).toBeInTheDocument();
    expect(aStat()).not.toBeInTheDocument();
  });
});

describe("while actually loading", () => {
  it("shows the skeleton, never the refusal or the dashboard", () => {
    appDataState.current = queryState({ isPending: true, isFetching: true, isLoading: true });

    render(<ExpenseDashboardScreen />);

    expect(refusal()).not.toBeInTheDocument();
    expect(aStat()).not.toBeInTheDocument();
  });
});

describe("a failed app-data lookup", () => {
  it("offers a retry rather than refusing outright", () => {
    appDataState.current = queryState({ isError: true, error: new Error("network") });

    render(<ExpenseDashboardScreen />);

    expect(refusal()).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});

// The backend's own gate (`allowedAdminRoles`, service.bal) is what decides
// this, and `enableFinanceView` on /app-data is the SAME check — so a reader
// without it sees the refusal regardless of what the report itself holds.
describe("a reader without the finance role", () => {
  it("is refused, even though the report query already has data", () => {
    appDataState.current = queryState({
      isSuccess: true,
      data: { enableFinanceView: false, enableLeadView: true, currencyCode: "USD" },
    });

    render(<ExpenseDashboardScreen />);

    expect(refusal()).toBeInTheDocument();
    expect(aStat()).not.toBeInTheDocument();
  });
});

// No OPD-style standalone backend-unconfigured case here specifically: this
// screen reuses `isExpenseBackendConfigured`, already proven (by the OPD
// sibling test) to intercept before `DashboardBody` ever mounts via
// `FinanceShell`'s own `configured` gate.
describe("no expense-claims backend configured in this environment", () => {
  it("shows FinanceShell's notice, never the refusal and never a blank screen", () => {
    configured.value = false;

    render(<ExpenseDashboardScreen />);

    expect(notConnected()).toBeInTheDocument();
    expect(refusal()).not.toBeInTheDocument();
    expect(aStat()).not.toBeInTheDocument();
  });
});

describe("a finance approver with everything loaded", () => {
  it("sees the dashboard, not the refusal", () => {
    render(<ExpenseDashboardScreen />);

    expect(refusal()).not.toBeInTheDocument();
    expect(aStat()).toBeInTheDocument();
    expect(screen.getByText("$1,000.00")).toBeInTheDocument();
  });

  // Not "no data" — a real answer that happens to be zero rows, worded as
  // its own sentence rather than left to look identical to a page that has
  // not loaded yet.
  it("says so plainly when nothing matches the filters", () => {
    reportState.current = queryState({ isSuccess: true, data: emptyReport });

    render(<ExpenseDashboardScreen />);

    expect(screen.getByText(/no claims match the selected filters/i)).toBeInTheDocument();
    expect(aStat()).not.toBeInTheDocument();
  });

  it("offers a retry when the report itself fails to load", () => {
    reportState.current = queryState({ isError: true, error: new Error("report down") });

    render(<ExpenseDashboardScreen />);

    expect(screen.getByText(/couldn't load the dashboard/i)).toBeInTheDocument();
  });
});
