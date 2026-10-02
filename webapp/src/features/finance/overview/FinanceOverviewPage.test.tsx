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

// The gate is this screen's only input, so it is the whole fixture. All
// three dashboards are stubbed to a marker each: what matters here is WHICH
// of them is reachable and WHEN, not what any of them draws.
const gate = {
  canSee: (id: string): boolean => id === "",
  isResolving: false,
  ccHasOwnCard: false,
  opdFinance: false,
  opdErrored: false,
  expenseFinance: false,
};

vi.mock("../api/useFinanceGate", () => ({ useFinanceGate: () => gate }));
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

const { default: FinanceOverviewPage } = await import("./FinanceOverviewPage");

/** A reader the gate has fully answered for, with the access given. */
function settled(access: Partial<typeof gate>) {
  Object.assign(gate, {
    isResolving: false,
    ccHasOwnCard: false,
    opdFinance: false,
    opdErrored: false,
    expenseFinance: false,
    ...access,
  });
  gate.canSee = (id) =>
    id === "finance-overview" && (gate.ccHasOwnCard || gate.opdFinance || gate.expenseFinance);
}

beforeEach(() => {
  settled({});
});

const aDashboard = () =>
  screen.queryByTestId("cc-dashboard") ??
  screen.queryByTestId("opd-dashboard") ??
  screen.queryByTestId("expense-dashboard");

// The reason this screen exists in the shape it does: it is the content pane
// for a rail row that is itself hidden until the gate settles. Anything drawn
// here before that answer arrives is something the reader watches appear and
// then be taken away again.
describe("while the backends are still answering", () => {
  it("draws nothing at all — no dashboard, no refusal, no switcher", () => {
    settled({ ccHasOwnCard: true });
    gate.isResolving = true;

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
    gate.isResolving = true;
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
  it("opens the CC dashboard, and offers only it, for a card owner", () => {
    settled({ ccHasOwnCard: true });
    render(<FinanceOverviewPage />);

    expect(screen.getByTestId("cc-dashboard")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveTextContent("Credit Card");
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

  it("offers both to a reader holding both", () => {
    settled({ ccHasOwnCard: true, opdFinance: true });
    render(<FinanceOverviewPage />);

    expect(screen.getByTestId("cc-dashboard")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  // A failed lookup is not a role. `foldIdentityError` reports every finance
  // query as `isError` whenever identity itself fails to resolve, so opening
  // this screen on an error opened it for readers holding nothing at all —
  // and closed it again when identity recovered, which is the blinking.
  it("stays shut for a reader whose OPD lookup merely failed", () => {
    settled({ opdErrored: true });
    render(<FinanceOverviewPage />);

    expect(aDashboard()).not.toBeInTheDocument();
    expect(screen.getByText(/isn't available for your role/)).toBeInTheDocument();
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
    expect(options).toEqual(["Credit Card", "OPD Claims", "Expense Claims"]);
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
