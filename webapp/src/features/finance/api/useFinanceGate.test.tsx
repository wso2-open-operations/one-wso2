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
import type { Capability } from "@constants/appMenu";

// Three backends, three vocabularies, none of them the people-app roles the
// rail normally reads. These are the rules the standalone apps enforce, so they
// are asserted against what those apps actually do:
//
//   OPD      userSlice.ts:38-40   role 555 approves, 444 is submit-only
//   Expense  appDataSlice.ts:99-103   two independent booleans
//   CC       privilege names on /user-info

const roles = {
  /** OPD `userRoles`. 444 = submitter, 555 = finance approver. */
  opd: [] as number[],
  expenseLead: false,
  expenseFinance: false,
  cc: [] as string[],
  /** Nothing has answered yet. */
  loading: false,
  /**
   * The gap between a failed attempt and its retry: React Query reports
   * `isLoading: false` there (it is `isPending && isFetching`, and nothing is
   * in flight) while the query has still produced no answer. Reading
   * `isLoading` treated this as settled; `isSuccess || isError` does not.
   */
  betweenRetries: false,
  /** The OPD lookup came back a failure rather than a role. */
  opdErrored: false,
};

// `isSuccess`/`isError` are what the gate reads to decide whether a backend
// has finished having its say. Neither ever goes back to false in React Query
// — a refetch of an errored query keeps `status: "error"` until it succeeds —
// so this fixture does not let them either.
const answered = () => ({
  isLoading: roles.loading && !roles.betweenRetries,
  isError: false,
  isSuccess: !roles.loading && !roles.betweenRetries,
});

vi.mock("../cc/useCc", () => ({
  useCcUserInfo: () => ({ data: { privileges: roles.cc }, ...answered() }),
}));
vi.mock("../opd/useOpd", () => ({
  useOpdUserInfo: () => ({
    data: { userRoles: roles.opd },
    isLoading: answered().isLoading,
    isError: roles.opdErrored,
    isSuccess: answered().isSuccess && !roles.opdErrored,
  }),
}));
vi.mock("../expense/useExpense", () => ({
  useExpenseAppData: () => ({
    data: { enableLeadView: roles.expenseLead, enableFinanceView: roles.expenseFinance },
    ...answered(),
  }),
}));

// Every backend has a URL in this suite unless a test says otherwise; the
// gate treats an unconfigured one as having already answered.
vi.mock("@config/apiConfig", () => ({
  isCcBackendConfigured: () => true,
  isOpdBackendConfigured: () => true,
  isExpenseBackendConfigured: () => true,
}));

const { useFinanceGate, canSeeMasterData } = await import("./useFinanceGate");
const { FINANCE_ITEM_IDS } = await import("@constants/financeApps");

const gate = () => renderHook(() => useFinanceGate()).result.current;

beforeEach(() => {
  roles.opd = [];
  roles.expenseLead = false;
  roles.expenseFinance = false;
  roles.cc = [];
  roles.loading = false;
  roles.betweenRetries = false;
  roles.opdErrored = false;
});

// The entry appears when ANY claim is approvable. Requiring all three would
// hide the screen from almost everyone: holding every role on three separate
// backends is the rare case, not the common one.
describe("the Claim approval entry", () => {
  it("is offered to someone who only approves OPD", () => {
    roles.opd = [555];
    expect(gate().canSee("claim-approval")).toBe(true);
  });

  it("is offered to someone who only leads expense claims", () => {
    roles.expenseLead = true;
    expect(gate().canSee("claim-approval")).toBe(true);
  });

  it("is offered to someone who only signs off expense claims", () => {
    roles.expenseFinance = true;
    expect(gate().canSee("claim-approval")).toBe(true);
  });

  // CC approving does not live here at all — it is decided entirely under
  // Credit Card Expenses — so holding only a CC role does not open this entry.
  it("is withheld from someone who only approves credit card submissions", () => {
    roles.cc = ["lead"];
    expect(gate().canSee("claim-approval")).toBe(false);
  });

  it("is withheld from someone who approves no claims", () => {
    roles.opd = [444]; // can submit, cannot approve
    expect(gate().canSee("claim-approval")).toBe(false);
  });
});

// The entries that stayed under Me keep the rules they had.
describe("what stayed behind", () => {
  it("leaves the per-user views open", () => {
    expect(gate().canSee("claims")).toBe(true);
  });

  // The approval ids are gone from the registry — Lead/Finance Approvals were
  // retired once Claim Approval's own Expense tab covered the same queues —
  // so their cases were dead code answering a question nothing asks. They
  // fall through to the open default now, which is safe precisely because no
  // rail entry names them — asserted so that a future entry reusing the name
  // cannot quietly go open. cc-approve is NOT one of these: it is a live item
  // again, restored under Credit Card Expenses.
  it("no longer carries the retired approval ids", () => {
    for (const retired of [
      "opd-approvals",
      "expense-lead",
      "expense-finance",
      "expense-lead-approvals",
      "expense-finance-approvals",
      "expense-new",
      "expense-history",
    ]) {
      expect(FINANCE_ITEM_IDS.has(retired), `${retired} is still a rail item`).toBe(false);
    }
  });

  // Claim approval is not an item of any single app, so it is named into the
  // set by hand — without that the rail would fall back to people-app
  // capabilities, which cannot express "expense finance approver".
  it("routes the claim-approval entry through this gate", () => {
    expect(FINANCE_ITEM_IDS.has("claim-approval")).toBe(true);
  });
});

// Approve Submissions — the only place a CC submission is decided on, now
// that it no longer has a tab in Claim Approval.
describe("the cc-approve item", () => {
  it("opens on either privilege alone", () => {
    roles.cc = ["lead"];
    expect(gate().canSee("cc-approve")).toBe(true);
    roles.cc = ["finance"];
    expect(gate().canSee("cc-approve")).toBe(true);
  });

  it("is not opened by the OPD or expense roles", () => {
    roles.opd = [555];
    roles.expenseLead = true;
    roles.expenseFinance = true;
    expect(gate().canSee("cc-approve")).toBe(false);
  });
});

// The Overview group shipped out of preview, and is one rail entry now
// rather than two — a single `finance-overview` id fronting both dashboards,
// tab-switched inside FinanceOverviewPage. Hidden entirely when neither tab
// would have anything to show: no card of the reader's own (or a CC
// lead/finance role, reading for a team or the company) and no OPD
// finance-approver role.
describe("the Finance Overview entry", () => {
  it("is hidden with no card and no OPD role", () => {
    expect(gate().canSee("finance-overview")).toBe(false);
  });

  it("opens for a card owner", () => {
    roles.cc = ["cc_owner"];
    expect(gate().canSee("finance-overview")).toBe(true);
  });

  it("opens for a CC lead or finance role, even with no card of their own", () => {
    roles.cc = ["lead"];
    expect(gate().canSee("finance-overview")).toBe(true);
  });

  it("opens for the OPD finance-approver role alone", () => {
    roles.opd = [555];
    expect(gate().canSee("finance-overview")).toBe(true);
  });

  it("opens for the expense finance role alone", () => {
    roles.expenseFinance = true;
    expect(gate().canSee("finance-overview")).toBe(true);
  });

  // The expense LEAD flag is not this role — it opens Claim Approval, but
  // the Expense Claims dashboard is gated on the finance role specifically
  // (the same `enableFinanceView`/`allowedAdminRoles` check its own backend
  // enforces on GET /claims-report), so a lead holding nothing else does not
  // get an Overview entry they would only find empty.
  it("is not opened by the expense lead role alone", () => {
    roles.expenseLead = true;
    expect(gate().canSee("finance-overview")).toBe(false);
  });

  // THE regression this entry was reported for. `foldIdentityError` reports
  // EVERY one of these queries as `isError` whenever identity itself fails to
  // resolve — a token-refresh hiccup is enough — so an entry that opened on a
  // failed lookup opened for readers holding no role at all, and closed again
  // the moment identity recovered: the row appearing, vanishing, appearing.
  // A role is the only thing that opens this.
  it("stays hidden when the OPD lookup fails and the reader holds no role", () => {
    roles.opdErrored = true;
    expect(gate().canSee("finance-overview")).toBe(false);
  });

  it("is not opened by a failed lookup even alongside a submit-only OPD role", () => {
    roles.opd = [444];
    roles.opdErrored = true;
    expect(gate().canSee("finance-overview")).toBe(false);
  });

  // The flip side, so the fix above cannot be read as "errors hide things":
  // a real role still opens it while its backend is having a bad minute.
  it("still opens for a real approver whose lookup happened to fail", () => {
    roles.opd = [555];
    roles.opdErrored = true;
    expect(gate().canSee("finance-overview")).toBe(true);
  });
});

// Pending Submissions, Pending Approvals and History are each the reader's
// OWN transactions — nothing there without a card, so all three are hidden
// alike, and a lead/finance role (reading a team's or the company's) earns
// them the same way it earns Overview's Credit Card tab.
describe("Credit Card Expenses' submitter-facing items", () => {
  it("hides all three with no card and no CC role", () => {
    expect(gate().canSee("cc-new")).toBe(false);
    expect(gate().canSee("cc-pending")).toBe(false);
    expect(gate().canSee("cc-history")).toBe(false);
  });

  it("opens all three for a card owner", () => {
    roles.cc = ["cc_owner"];
    expect(gate().canSee("cc-new")).toBe(true);
    expect(gate().canSee("cc-pending")).toBe(true);
    expect(gate().canSee("cc-history")).toBe(true);
  });

  it("opens all three for a CC lead, even with no card of their own", () => {
    roles.cc = ["lead"];
    expect(gate().canSee("cc-new")).toBe(true);
    expect(gate().canSee("cc-pending")).toBe(true);
    expect(gate().canSee("cc-history")).toBe(true);
  });
});

// Master Data is gated on TWO things that answer two different questions, and
// both have to say yes: the preview flag ("does this environment have the
// feature yet") and `admin` ("may this reader use it"). Neither alone is
// enough, which is the whole point — turning the flag on in an environment
// must not hand finance's reference tables to every employee in it, and
// holding `admin` must not surface a feature the environment has not enabled.
describe("the Master Data tables", () => {
  const admin = new Set<Capability>(["employee", "admin"]);
  const employee = new Set<Capability>(["employee"]);

  it("opens for an admin", () => {
    expect(canSeeMasterData(admin)).toBe(true);
  });

  // `admin` is the whole rule now that the "finance-master-data" preview flag
  // has been removed — so this is the only thing standing between finance's
  // reference tables and everyone else.
  it("stays shut for a non-admin", () => {
    expect(canSeeMasterData(employee)).toBe(false);
  });

  // Capabilities read as undefined until the identity query answers, and a
  // restricted entry must fail closed while it does.
  it("stays shut while capabilities are still unknown", () => {
    expect(canSeeMasterData(undefined)).toBe(false);
  });

  // The four tabs answer as one — listed individually in the switch so a new
  // table has to be named there before it appears, rather than matching a
  // prefix and going open by accident.
  it("answers the same for all four tables", () => {
    for (const id of [
      "master-data-subsidiaries",
      "master-data-departments",
      "master-data-expense-types",
      "master-data-credit-cards",
    ]) {
      expect(renderHook(() => useFinanceGate(true, employee)).result.current.canSee(id)).toBe(false);
      expect(renderHook(() => useFinanceGate(true, admin)).result.current.canSee(id)).toBe(true);
    }
  });
});

// `isResolving` is what every caller renders NOTHING on — FinanceOverviewPage
// returns null, ClaimApprovalPage drops its tabs and its <Outlet />, the rail
// hides the row. So it going back to true after a real answer is not a slower
// answer: it is a screen that was there blanking and coming back, which is
// what the Finance section flickering was.
//
// It is monotonic by construction rather than by a latch: it reads
// `isSuccess || isError`, which React Query never walks back, instead of
// `isLoading`, which drops to false between a failed attempt and its retry.
describe("settling, and staying settled", () => {
  function settling(enabled = true) {
    const { result, rerender } = renderHook(({ on }) => useFinanceGate(on), {
      initialProps: { on: enabled },
    });
    return { result, rerender };
  }

  it("reports resolving until the backends have answered", () => {
    roles.loading = true;
    expect(settling().result.current.isResolving).toBe(true);
  });

  it("stops resolving once they have", () => {
    roles.loading = true;
    const { result, rerender } = settling();
    expect(result.current.isResolving).toBe(true);

    roles.loading = false;
    rerender({ on: true });
    expect(result.current.isResolving).toBe(false);
  });

  // THE regression. `isLoading` is false in the gap between a failed attempt
  // and its retry, so reading it called this settled — and the screens keyed
  // off it drew their answer from half-loaded data, then redrew it when the
  // retry landed. Nothing about the reader changed in between.
  it("keeps resolving through the gap between an attempt and its retry", () => {
    roles.loading = true;
    roles.betweenRetries = true;
    expect(settling().result.current.isResolving).toBe(true);
  });

  // A gate switched off has answered nothing. The rail's is off on every
  // perspective but Me and Finance, and counting that as settled would have
  // it report "no access" the moment someone switched to Finance.
  it("does not count a switched-off gate as having answered", () => {
    roles.loading = true;
    const { result, rerender } = settling(false);
    expect(result.current.isResolving).toBe(false);

    rerender({ on: true });
    expect(result.current.isResolving).toBe(true);
  });
});
