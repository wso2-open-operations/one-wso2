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
import userEvent from "@testing-library/user-event";

// `apiConfig.ts`'s `ccBackendUrl` is read once at module load from
// `window.config`, which jsdom doesn't provide — the Default tab's own
// `FinanceShell` reads `isCcBackendConfigured()` directly now (unlike
// before, when `CcDashboardPage` — mocked below — was the only thing that
// ever touched it), so this has to be set before `FinanceOverviewPage`
// itself is imported.
window.config = { ONE_WSO2_CC_EXPENSES_BACKEND_URL: "http://test-cc-backend" } as typeof window.config;

// Per-backend fixture: EACH of cc/opd/expense has its own resolved/role/error
// state, and `useFinanceGate` is mocked to answer only from whichever subset
// `needs` names — same contract the real hook has. This is what lets a test
// tell "the full gate (all three)" apart from "the section gate (one)",
// which is the exact distinction FinanceOverviewPage now depends on: the
// page waits on the full gate to decide ACCESS, but on the section gate
// alone to decide what to DRAW.
type Backend = "cc" | "opd" | "expense";
const backend = {
  cc: { resolved: true, role: false, errored: false },
  opd: { resolved: true, role: false, errored: false },
  expense: { resolved: true, role: false, errored: false },
};
const retryCc = vi.fn();
const retryOpd = vi.fn();
const retryExpense = vi.fn();

function resetBackends() {
  backend.cc = { resolved: true, role: false, errored: false };
  backend.opd = { resolved: true, role: false, errored: false };
  backend.expense = { resolved: true, role: false, errored: false };
  retryCc.mockClear();
  retryOpd.mockClear();
  retryExpense.mockClear();
}

vi.mock("../api/useFinanceGate", () => ({
  // `_enabled` mirrors the real hook's signature; this fixture never needs it.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  useFinanceGate: (_enabled = true, needs: Backend[] = ["cc", "opd", "expense"]) => ({
    isResolving: needs.some((app) => !backend[app].resolved),
    // Gated on `resolved`, same as the real hook: `ccHasOwnCard` etc. come off
    // `.data`, which reads as its empty/undefined default (never the eventual
    // role) until the query actually answers.
    ccHasOwnCard: needs.includes("cc") && backend.cc.resolved && backend.cc.role,
    opdFinance: needs.includes("opd") && backend.opd.resolved && backend.opd.role,
    expenseFinance: needs.includes("expense") && backend.expense.resolved && backend.expense.role,
    ccErrored: needs.includes("cc") && backend.cc.errored,
    opdErrored: needs.includes("opd") && backend.opd.errored,
    expenseErrored: needs.includes("expense") && backend.expense.errored,
    retryCc,
    retryOpd,
    retryExpense,
    canSee: (id: string) =>
      id === "finance-overview" &&
      ((needs.includes("cc") && backend.cc.resolved && backend.cc.role) ||
        (needs.includes("opd") && backend.opd.resolved && backend.opd.role) ||
        (needs.includes("expense") && backend.expense.resolved && backend.expense.role)),
  }),
}));
vi.mock("../cc/pages/CcDashboardPage", () => ({
  default: ({ headerActions }: { headerActions?: React.ReactNode }) => (
    <div data-testid="cc-dashboard">{headerActions}</div>
  ),
}));
vi.mock("../opd/dashboard/OpdDashboardScreen", () => ({
  default: ({ headerActions }: { headerActions?: React.ReactNode }) => (
    <div data-testid="opd-dashboard">{headerActions}</div>
  ),
}));
vi.mock("../expense/dashboard/ExpenseDashboardScreen", () => ({
  default: ({ headerActions }: { headerActions?: React.ReactNode }) => (
    <div data-testid="expense-dashboard">{headerActions}</div>
  ),
}));
vi.mock("./OverviewDefaultSummary", () => ({
  default: () => <div data-testid="overview-default" />,
}));

const { default: FinanceOverviewPage } = await import("./FinanceOverviewPage");

interface Access {
  ccHasOwnCard?: boolean;
  opdFinance?: boolean;
  expenseFinance?: boolean;
  opdErrored?: boolean;
  ccErrored?: boolean;
}

/** A reader every backend has fully answered for, with the access given. */
function settled(access: Access) {
  backend.cc = { resolved: true, role: access.ccHasOwnCard ?? false, errored: access.ccErrored ?? false };
  backend.opd = { resolved: true, role: access.opdFinance ?? false, errored: access.opdErrored ?? false };
  backend.expense = { resolved: true, role: access.expenseFinance ?? false, errored: false };
}

/** A reader no backend has answered for yet — `access` is what each would say once it does. */
function resolving(access: Access = {}) {
  backend.cc = { resolved: false, role: access.ccHasOwnCard ?? false, errored: false };
  backend.opd = { resolved: false, role: access.opdFinance ?? false, errored: false };
  backend.expense = { resolved: false, role: access.expenseFinance ?? false, errored: false };
}

beforeEach(() => {
  resetBackends();
});

const aDashboard = () =>
  screen.queryByTestId("overview-default") ??
  screen.queryByTestId("cc-dashboard") ??
  screen.queryByTestId("opd-dashboard") ??
  screen.queryByTestId("expense-dashboard");

// The reason this screen exists in the shape it does: it is the content pane
// for a rail row that is itself hidden until the gate settles. Anything drawn
// here before that answer arrives is something the reader watches appear and
// then be taken away again.
describe("while the backends are still answering", () => {
  it("draws nothing at all — no dashboard, no refusal, no switcher", () => {
    resolving({ ccHasOwnCard: true });

    const { container } = render(<FinanceOverviewPage />);

    expect(container).toBeEmptyDOMElement();
    expect(aDashboard()).not.toBeInTheDocument();
    expect(screen.queryByText(/isn't available for your role/)).not.toBeInTheDocument();
  });
});

// THE regression this screen was reported for. A reader with no card and no
// OPD role must never see a dashboard — not for one render on the way to the
// refusal, which is what "it blinks and comes back" was.
describe("a reader with neither a card nor an OPD role", () => {
  it("never sees a dashboard, from the first render to the last", () => {
    resolving();
    const { container, rerender } = render(<FinanceOverviewPage />);

    // Resolving: nothing.
    expect(aDashboard()).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();

    // Settled, and the answer is no.
    settled({});
    rerender(<FinanceOverviewPage />);

    expect(aDashboard()).not.toBeInTheDocument();
    expect(screen.getByText(/isn't available for your role/)).toBeInTheDocument();
  });

  // Hiding the rail row is not access control — the route is still reachable
  // by a bookmark or a typed URL.
  it("is refused outright rather than shown an empty switcher", () => {
    settled({});
    render(<FinanceOverviewPage />);

    expect(screen.getByText(/isn't available for your role/)).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});

// A reader holding one side is not offered the other: picking it would only
// land them on that dashboard's own denial notice.
describe("what the switcher offers", () => {
  it("opens the Default summary, and offers only Credit Card alongside it, for a card owner", () => {
    settled({ ccHasOwnCard: true });
    render(<FinanceOverviewPage />);

    expect(screen.getByTestId("overview-default")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveTextContent("Default");
    expect(screen.queryByTestId("opd-dashboard")).not.toBeInTheDocument();
  });

  // Lands straight on the dashboard they can actually use, rather than the
  // "cc" default they would have nothing to see on.
  it("opens the OPD dashboard for an OPD-only approver", () => {
    settled({ opdFinance: true });
    render(<FinanceOverviewPage />);

    expect(screen.getByTestId("opd-dashboard")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveTextContent("OPD Claims");
    expect(screen.queryByTestId("cc-dashboard")).not.toBeInTheDocument();
  });

  // OPD ranks above CC in the default priority (reviewed: "Default to OPD,
  // then Expense, then CC"), so a reader holding both lands on OPD, not CC.
  it("offers both to a reader holding both, defaulting to OPD", () => {
    settled({ ccHasOwnCard: true, opdFinance: true });
    render(<FinanceOverviewPage />);

    expect(screen.getByTestId("opd-dashboard")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  // A failed lookup is not a role — `canSee`'s OR still reads only the role
  // flags, never the error flags, so a reader with no role ANYWHERE still
  // correctly has no access regardless of which backend errored. What
  // changed is only the SENTENCE: once access is refused, naming which
  // backend failed (and offering its retry) beats one generic "not for you"
  // — reviewed as "handle a failed lookup for any of the three backends,
  // not just CC".
  it("shows the OPD failure with a retry for a reader holding no role anywhere", () => {
    settled({ opdErrored: true });
    render(<FinanceOverviewPage />);

    expect(aDashboard()).not.toBeInTheDocument();
    expect(screen.getByText(/Couldn.t check your OPD Claims access/)).toBeInTheDocument();
    expect(screen.queryByText(/isn't available for your role/)).not.toBeInTheDocument();
  });

  // The flip side: a real approver still gets in while OPD is having a bad
  // minute, and lands on the tab with the retry rather than the empty one.
  it("still opens the OPD tab for a real approver whose lookup failed", () => {
    settled({ opdFinance: true, opdErrored: true });
    render(<FinanceOverviewPage />);

    expect(screen.getByTestId("opd-dashboard")).toBeInTheDocument();
  });

  // Lands straight on Expense Claims for a reader who holds only that role —
  // same reasoning as the OPD-only case above, extended to the third tab.
  it("opens the Expense Claims dashboard for an expense-finance-only reader", () => {
    settled({ expenseFinance: true });
    render(<FinanceOverviewPage />);

    expect(screen.getByTestId("expense-dashboard")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveTextContent("Expense Claims");
    expect(screen.queryByTestId("cc-dashboard")).not.toBeInTheDocument();
    expect(screen.queryByTestId("opd-dashboard")).not.toBeInTheDocument();
  });

  it("offers all three to a reader holding every role", async () => {
    settled({ ccHasOwnCard: true, opdFinance: true, expenseFinance: true });
    render(<FinanceOverviewPage />);

    // MUI's Select renders its options into a closed popper — not in the DOM
    // at all until opened — so the combobox has to be opened first.
    await userEvent.click(screen.getByRole("combobox"));
    const options = (await screen.findAllByRole("option")).map((o) => o.textContent);
    expect(options).toEqual(["Default", "OPD Claims", "Expense Claims", "Credit Card"]);
  });

  // Picking Expense Claims would only ever land on its own denial notice for
  // a reader who does not hold the role — the dropdown must not offer it.
  it("does not offer Expense Claims to a reader without the role", async () => {
    settled({ ccHasOwnCard: true });
    render(<FinanceOverviewPage />);

    await userEvent.click(screen.getByRole("combobox"));
    await screen.findAllByRole("option");
    expect(screen.queryByText("Expense Claims")).not.toBeInTheDocument();
  });
});

// THE fix this page was reviewed for: a slow backend outside the active tab
// must not hold up the tab that IS active. `resolving()` below leaves CC
// unresolved throughout — if the page still waited on the full three-backend
// gate to draw anything, these would see nothing, the same way the
// "while the backends are still answering" tests above do on purpose.
describe("a slow backend outside the selected tab", () => {
  it("still draws the OPD dashboard while CC alone remains unresolved", () => {
    backend.cc = { resolved: false, role: false, errored: false };
    backend.opd = { resolved: true, role: true, errored: false };
    backend.expense = { resolved: true, role: false, errored: false };

    render(<FinanceOverviewPage />);

    expect(screen.getByTestId("opd-dashboard")).toBeInTheDocument();
  });

  it("still draws the Expense dashboard while CC alone remains unresolved", () => {
    backend.cc = { resolved: false, role: false, errored: false };
    backend.opd = { resolved: true, role: false, errored: false };
    backend.expense = { resolved: true, role: true, errored: false };

    render(<FinanceOverviewPage />);

    expect(screen.getByTestId("expense-dashboard")).toBeInTheDocument();
  });

  // The converse of the above: picking CC specifically still waits on CC's
  // own answer, same as any tab waits on its own backend. Access is already
  // known here (CC's eventual role is already true in this fixture), so this
  // is the section gate's own wait, not the earlier access-level one — still
  // nothing drawn, for the same reason a placeholder would be the one thing
  // left to blink on the way to the dashboard underneath.
  it("does not draw the CC dashboard while CC itself is still unresolved", () => {
    backend.cc = { resolved: false, role: true, errored: false };
    backend.opd = { resolved: true, role: false, errored: false };
    backend.expense = { resolved: true, role: false, errored: false };

    const { container } = render(<FinanceOverviewPage />);

    expect(aDashboard()).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});

// Distinct from "not for your role": a reader refused because CC's OWN
// lookup failed outright is told that, and given a way back, rather than the
// same sentence a genuinely roleless reader gets.
describe("a reader shut out by a failed CC lookup, not a missing role", () => {
  it("shows the CC failure with a retry instead of the generic refusal", () => {
    settled({ ccErrored: true });
    render(<FinanceOverviewPage />);

    expect(screen.getByText(/Couldn.t check your Credit Card access/)).toBeInTheDocument();
    expect(screen.queryByText(/isn't available for your role/)).not.toBeInTheDocument();
  });

  it("retries CC when that button is pressed", async () => {
    settled({ ccErrored: true });
    render(<FinanceOverviewPage />);

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retryCc).toHaveBeenCalledTimes(1);
  });

  // A role elsewhere still gets the ordinary generic refusal, not the CC
  // error banner — CC failing is only the reason to say so when CC was the
  // reader's only possible way in.
  // Reviewed: a failed backend must not go silent just because the reader
  // has access through another one — CC's failure is still worth knowing
  // about even though OPD is what actually got them in. Non-blocking: the
  // banner and the dashboard both render, rather than the banner replacing
  // the page the way it does when NOTHING else grants access.
  it("still names a failed backend even when another role already grants access", () => {
    settled({ ccErrored: true, opdFinance: true });
    render(<FinanceOverviewPage />);

    expect(screen.getByText(/Couldn.t check your Credit Card access/)).toBeInTheDocument();
    expect(screen.getByTestId("opd-dashboard")).toBeInTheDocument();
  });

  // `foldIdentityError` marks every finance query errored together on an
  // identity hiccup — naming only the first one found would retry CC alone
  // and leave OPD and Expense still erroring once the reader's eye reached
  // them.
  it("names every errored backend at once, and retries all of them together", async () => {
    settled({ ccErrored: true, opdErrored: true });
    render(<FinanceOverviewPage />);

    expect(
      screen.getByText(/Couldn.t check your Credit Card and OPD Claims access/),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retryCc).toHaveBeenCalledTimes(1);
    expect(retryOpd).toHaveBeenCalledTimes(1);
    expect(retryExpense).not.toHaveBeenCalled();
  });
});

// Reviewed into this exact order: "Default to OPD, then Expense, then Default".
describe("default priority: OPD, then Expense, then Default", () => {
  it("defaults to OPD for a reader holding all three roles", () => {
    settled({ ccHasOwnCard: true, opdFinance: true, expenseFinance: true });
    render(<FinanceOverviewPage />);

    expect(screen.getByTestId("opd-dashboard")).toBeInTheDocument();
  });

  it("defaults to Expense, not CC, for a reader holding Expense and CC but not OPD", () => {
    settled({ ccHasOwnCard: true, expenseFinance: true });
    render(<FinanceOverviewPage />);

    expect(screen.getByTestId("expense-dashboard")).toBeInTheDocument();
  });

  it("does not default to Expense while OPD has not answered, even if Expense already has", () => {
    backend.opd = { resolved: false, role: false, errored: false };
    backend.expense = { resolved: true, role: true, errored: false };
    backend.cc = { resolved: true, role: false, errored: false };

    const { container } = render(<FinanceOverviewPage />);

    // Access is already knowable (Expense granted it), but WHICH tab is
    // correct is not — OPD, ranked above Expense, could still say yes.
    expect(aDashboard()).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("falls to Default only once both OPD and Expense have answered no", () => {
    backend.opd = { resolved: true, role: false, errored: false };
    backend.expense = { resolved: true, role: false, errored: false };
    backend.cc = { resolved: true, role: true, errored: false };

    render(<FinanceOverviewPage />);

    expect(screen.getByTestId("overview-default")).toBeInTheDocument();
  });
});

// Reviewed: "Overview ... should never switch on its own" — the default,
// once shown, is not swapped for a later-arriving or later-changing answer.
describe("locking the first dashboard shown", () => {
  it("keeps showing Default after it locks in, even once OPD resolves true afterward", () => {
    // OPD and Expense both answer no first — Default is the only option, and
    // it locks in as soon as it's reached.
    settled({ ccHasOwnCard: true });
    const { rerender } = render(<FinanceOverviewPage />);
    expect(screen.getByTestId("overview-default")).toBeInTheDocument();

    // OPD's answer changes afterward (a background refetch granting a role
    // that was not there a moment ago) — without the lock this would swap
    // the screen to OPD mid-session.
    backend.opd.role = true;
    rerender(<FinanceOverviewPage />);

    expect(screen.getByTestId("overview-default")).toBeInTheDocument();
    expect(screen.queryByTestId("opd-dashboard")).not.toBeInTheDocument();
  });

  // THE bug reviewed as "after a successful retry, Overview shows the wrong
  // dashboard". Different from the test above in one crucial way: there, OPD
  // cleanly resolved "no role" before Default locked in, so the lock was
  // correct to hold. Here, OPD ERRORED — an uncertain "no", not a definitive
  // one — so Default is shown (it is still the best answer available) but
  // must NOT lock, precisely so a successful retry can still promote OPD
  // above it.
  it("switches to OPD once a retry resolves OPD's earlier error, because the Default tab was never locked", () => {
    settled({ ccHasOwnCard: true, opdErrored: true });
    const { rerender } = render(<FinanceOverviewPage />);
    expect(screen.getByTestId("overview-default")).toBeInTheDocument();

    // The reader presses Retry (or a background refetch succeeds): OPD now
    // resolves with a real role instead of an error.
    backend.opd = { resolved: true, role: true, errored: false };
    rerender(<FinanceOverviewPage />);

    expect(screen.getByTestId("opd-dashboard")).toBeInTheDocument();
    expect(screen.queryByTestId("overview-default")).not.toBeInTheDocument();
  });

  // The flip side of the same fix: if the retry does NOT change the
  // answer (OPD resolves cleanly to "no role" this time, rather than
  // another error), Default is still correct, and now gets to lock in.
  it("keeps showing Default if a retry resolves OPD's error into a clean 'no role' rather than a yes", () => {
    settled({ ccHasOwnCard: true, opdErrored: true });
    const { rerender } = render(<FinanceOverviewPage />);
    expect(screen.getByTestId("overview-default")).toBeInTheDocument();

    backend.opd = { resolved: true, role: false, errored: false };
    rerender(<FinanceOverviewPage />);
    expect(screen.getByTestId("overview-default")).toBeInTheDocument();

    // Now locked — confirms the retry outcome didn't just coincidentally
    // match, but actually latched the way the first test in this block does.
    backend.opd.role = true;
    rerender(<FinanceOverviewPage />);
    expect(screen.getByTestId("overview-default")).toBeInTheDocument();
  });

  it("keeps showing OPD after it locks in, even once a background refetch changes CC's own answer", () => {
    settled({ opdFinance: true });
    const { rerender } = render(<FinanceOverviewPage />);
    expect(screen.getByTestId("opd-dashboard")).toBeInTheDocument();

    backend.cc.role = true; // irrelevant to the lock, but also lower priority regardless
    rerender(<FinanceOverviewPage />);

    expect(screen.getByTestId("opd-dashboard")).toBeInTheDocument();
  });

  it("an explicit pick overrides the computed default and is itself permanent", async () => {
    settled({ ccHasOwnCard: true, opdFinance: true, expenseFinance: true });
    const { rerender } = render(<FinanceOverviewPage />);
    // Default lands on OPD (top priority).
    expect(screen.getByTestId("opd-dashboard")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByText("Credit Card"));
    expect(screen.getByTestId("cc-dashboard")).toBeInTheDocument();

    // A later-changing answer must not override the explicit pick either.
    // The mocked hook reads `backend` fresh only on render, so the mutation
    // needs a rerender to actually reach the component — without this the
    // assertion below checks the exact same DOM the one above already did.
    backend.expense.role = false;
    rerender(<FinanceOverviewPage />);
    expect(screen.getByTestId("cc-dashboard")).toBeInTheDocument();
  });
});
