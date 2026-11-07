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

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Cado2Me } from "../api/useCado2Me";

// NothingHere comes from PerspectiveLanding, whose visibility hook pulls
// @asgardeo/browser into the module graph; stubbed as SalesShell.test.tsx does.
vi.mock("@components/side-rail/usePerspectiveVisibility", () => ({
  usePerspectiveVisibility: () => ({
    resolveVisible: () => true,
    isResolving: false,
    visibleLeaves: [],
    isError: false,
    retry: () => {},
  }),
}));

const state = {
  configured: true,
  me: { data: undefined as Cado2Me | undefined, isPending: false, isLoading: false, isError: false, error: null as unknown },
};
const refetch = vi.fn();
vi.mock("@config/apiConfig", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@config/apiConfig")>()),
  isCado2BackendConfigured: () => state.configured,
}));
vi.mock("../api/useCado2Me", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/useCado2Me")>()),
  useCado2Me: () => ({ ...state.me, refetch }),
}));

// The screens themselves have their own tests; here they only need to say where they are.
vi.mock("../quotes/pages/MyQuotesPage", () => ({ default: () => <h1>My Quotes</h1> }));
vi.mock("../approvals/pages/MyApprovalsPage", () => ({ default: () => <h1>My Approvals</h1> }));
vi.mock("../admin/approval-matrix/pages/ApprovalMatrixPage", () => ({ default: () => <h1>Approval matrix page</h1> }));
vi.mock("../quotes/pages/QuoteDetailPage", async () => {
  const { useParams } = await import("react-router");
  return {
    default: function QuoteTab() {
      return <h1>Quote tab {useParams().tab}</h1>;
    },
  };
});

import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, useLocation } from "react-router";
import { cado2Routes } from "../routes";

const me = (roles: Cado2Me["roles"], approverRoles: string[] = []): Cado2Me => ({
  sub: "u1",
  email: "rep@wso2.com",
  roles,
  approverRoles,
});

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function open(at: string) {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <Where />
      <Routes>{cado2Routes}</Routes>
    </MemoryRouter>,
  );
}

const where = () => screen.getByTestId("where").textContent;

beforeEach(() => {
  state.configured = true;
  state.me = { data: me(["SALES"]), isPending: false, isLoading: false, isError: false, error: null };
  refetch.mockClear();
});

describe("the CadO2 access ladder", () => {
  it("names the key to set when the backend isn't configured", () => {
    state.configured = false;
    open("/sales/cado2/quotes");
    expect(screen.getByText(/isn.t connected yet/)).toBeInTheDocument();
    expect(screen.getByText("ONE_WSO2_CADO2_BACKEND_URL")).toBeInTheDocument();
  });

  it("holds the page, and redirects nothing, while access is being checked", () => {
    state.me = { ...state.me, data: undefined, isPending: true };
    open("/sales/cado2/admin/approval-matrix");
    expect(screen.getByText("Checking your QuickQuote access…")).toBeInTheDocument();
    expect(where()).toBe("/sales/cado2/admin/approval-matrix");
  });

  it("offers Retry when the check itself failed, rather than claiming no access", () => {
    state.me = { ...state.me, data: undefined, isError: true, error: new Error("timeout") };
    open("/sales/cado2/quotes");
    expect(screen.getByText(/Couldn't check your QuickQuote access\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByText("Nothing here for you yet")).toBeNull();
  });

  it("shows the shared no-access card to someone with no CadO2 role", () => {
    state.me.data = me([]);
    open("/sales/cado2/quotes");
    expect(screen.getByText("Nothing here for you yet")).toBeInTheDocument();
  });

  it("renders the page once allowed", () => {
    open("/sales/cado2/quotes");
    expect(screen.getByText("My Quotes")).toBeInTheDocument();
  });
});

describe("CadO2 routing", () => {
  it("lands a rep on My Quotes", () => {
    open("/sales/cado2");
    expect(where()).toBe("/sales/cado2/quotes");
  });

  it("lands an approver who doesn't quote on My Approvals", () => {
    state.me.data = me([], ["LEGAL"]);
    open("/sales/cado2");
    expect(where()).toBe("/sales/cado2/approvals");
  });

  it("lands an admin-only person on Admin", () => {
    state.me.data = me(["ADMIN"]);
    open("/sales/cado2");
    expect(where()).toBe("/sales/cado2/admin/approval-matrix");
  });

  it("refuses My Quotes to an admin-only person: ADMIN is the admin panel only", () => {
    state.me.data = me(["ADMIN"]);
    open("/sales/cado2/quotes");
    expect(where()).toBe("/sales/cado2/admin/approval-matrix");
  });

  it("refuses Admin to a rep at its URL, not just in the rail", () => {
    open("/sales/cado2/admin/approval-matrix");
    expect(where()).toBe("/sales/cado2/quotes");
  });

  it("refuses My Quotes to an approver who doesn't quote", () => {
    state.me.data = me([], ["CFO"]);
    open("/sales/cado2/quotes/new");
    expect(where()).toBe("/sales/cado2/approvals");
  });

  it("opens Admin on its first section, inside the section list", () => {
    state.me.data = me(["ADMIN"]);
    open("/sales/cado2/admin");
    expect(where()).toBe("/sales/cado2/admin/approval-matrix");
    expect(screen.getByText("Approval matrix page")).toBeInTheDocument();
  });

  it("sends an unknown Admin section to the first one", () => {
    state.me.data = me(["ADMIN"]);
    open("/sales/cado2/admin/regions");
    expect(where()).toBe("/sales/cado2/admin/approval-matrix");
  });

  it("opens a quote on its Quote tab, and each tab has its own address", async () => {
    open("/sales/cado2/quotes/42");
    expect(where()).toBe("/sales/cado2/quotes/42/quote");
    open("/sales/cado2/quotes/42/history");
    expect(await screen.findByText("Quote tab history")).toBeInTheDocument();
  });

  it("sends an unknown CadO2 address to the landing", () => {
    open("/sales/cado2/nowhere");
    expect(where()).toBe("/sales/cado2/quotes");
  });
});
