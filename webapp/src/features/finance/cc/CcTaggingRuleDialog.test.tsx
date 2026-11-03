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

import { HttpError } from "@api/http";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CcCreditCard, CcTaggingRule } from "./ccTypes";

const rule = (over: Partial<CcTaggingRule> = {}): CcTaggingRule => ({
  id: 1,
  creditCardId: 10,
  ccNumber: "123456",
  employeeEmail: "jane@wso2.com",
  supplier: "Uber",
  account: null,
  amountMin: null,
  amountMax: null,
  expenseCategoryLabel: "Office",
  expenseTypeLabel: "Taxi",
  comment: "Client visit",
  subRegion: null,
  productUnit: "IAM",
  businessUnit: "Products",
  source: "manual",
  active: true,
  outdated: false,
  ...over,
});

const card = (over: Partial<CcCreditCard> = {}): CcCreditCard => ({
  id: 10,
  ccNumber: "123456",
  bankCode: "amex",
  label: "Travel",
  employeeEmail: "jane@wso2.com",
  leadEmail: "lead@wso2.com",
  status: "Active",
  countNew: 0,
  countPendingLead: 0,
  countPendingFinance: 0,
  ...over,
});

const state = {
  cards: [card(), card({ id: 9, ccNumber: "999999", label: "Old", status: "Inactive" })],
  cardsLoading: false,
  menusLoading: false,
  /** Whether the cards, or the expense options, failed and are being asked for again. */
  cardsRetrying: false,
  menusRetrying: false,
};

const query = <T,>(data: T) => ({
  data: state.menusLoading ? undefined : data,
  isLoading: state.menusLoading,
  isError: state.menusRetrying,
  isFetching: state.menusRetrying,
  error: state.menusRetrying ? new Error("Gateway timeout") : null,
  refetch: vi.fn(),
});

const sent = { create: [] as unknown[], update: [] as unknown[] };
const server = { fail: null as Error | null, pending: false };

vi.mock("./useCc", () => ({
  useCcOwnCards: () => ({
    cards: state.cardsLoading ? [] : state.cards,
    isLoading: state.cardsLoading,
    isError: state.cardsRetrying,
    isFetching: state.cardsRetrying,
    error: state.cardsRetrying ? new Error("Gateway timeout") : null,
    retry: vi.fn(),
  }),
  useCcMenus: () => ({
    expenseTypes: query({
      categories: ["Office", "Marketing", "Travel"],
      types: { Office: ["Taxi", "Meals"], Marketing: ["Events"], Travel: ["Air"] },
    }),
    subRegions: query({ subRegions: ["APAC", "EMEA"] }),
    units: query({ productUnits: ["IAM", "IAM", "Choreo"], businessUnits: ["Products", "Services", "Cloud"] }),
    jobNumbers: query({ jobNumbers: [] }),
  }),
}));

// The mutations keep their error in React state, as the real ones do, so a failure shows only once a save has failed.
vi.mock("./useCcMutations", async () => {
  const { useState } = await vi.importActual<typeof import("react")>("react");
  const hook = (log: unknown[]) => () => {
    const [error, setError] = useState<Error | null>(null);
    return {
      mutate: (vars: unknown, opts?: { onSuccess?: (r: unknown) => void }) => {
        log.push(vars);
        if (server.fail) {
          setError(server.fail);
          return;
        }
        setError(null);
        opts?.onSuccess?.(null);
      },
      isPending: server.pending,
      isError: Boolean(error),
      error,
    };
  };
  return { useCcCreateTaggingRule: hook(sent.create), useCcUpdateTaggingRule: hook(sent.update) };
});

const { NotificationsProvider } = await import("@context/notifications/NotificationsContext");
const { CcTaggingRuleDialog } = await import("./CcTaggingRuleDialog");

const onClose = vi.fn();
const open = (r: CcTaggingRule | null) =>
  render(
    <NotificationsProvider>
      <CcTaggingRuleDialog rule={r} onClose={onClose} />
    </NotificationsProvider>,
  );

const saveButton = () => screen.getByRole("button", { name: /^(Add|Save)$/ });
const save = () => userEvent.click(saveButton());
const field = (name: string) => screen.getByRole("textbox", { name });
// A required field's name ends in its "*" marker.
const select = (name: string) => screen.getByRole("combobox", { name: new RegExp(`^${name}\\b`) });
const STALE = "No longer offered. Pick a current value.";

beforeEach(() => {
  state.cardsRetrying = false;
  state.menusRetrying = false;
  state.cards = [card(), card({ id: 9, ccNumber: "999999", label: "Old", status: "Inactive" })];
  state.cardsLoading = false;
  state.menusLoading = false;
  sent.create.length = 0;
  sent.update.length = 0;
  server.fail = null;
  server.pending = false;
  vi.clearAllMocks();
});

describe("adding a rule", () => {
  it("adds a rule with what was entered, on the only active card", async () => {
    open(null);
    await userEvent.type(field("Supplier"), " Uber ");
    await userEvent.type(field("Max Amount ($)"), "50");
    await save();

    expect(sent.create).toEqual([
      {
        ccNumber: "123456",
        supplier: "Uber",
        account: null,
        amountMin: null,
        amountMax: 50,
        expenseCategoryLabel: null,
        expenseTypeLabel: null,
        comment: null,
        subRegion: null,
        productUnit: null,
        businessUnit: null,
        active: true,
      },
    ]);
    expect(onClose).toHaveBeenCalled();
    expect(await screen.findByText("Rule added")).toBeInTheDocument();
  });

  it("offers active cards only", () => {
    open(null);
    fireEvent.mouseDown(select("Card"));

    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(within(options[0]).getByText("Travel")).toBeInTheDocument();
  });

  // Numbers line up down the list when they're set apart in a fixed-width face.
  it("lists each card's number apart from its name, in a fixed-width face", () => {
    open(null);
    fireEvent.mouseDown(select("Card"));

    const number = within(screen.getByRole("option")).getByText("123456");
    expect(getComputedStyle(number).fontFamily).toBe("monospace");
    expect(number).not.toHaveTextContent("Travel");
  });

  // Counted among the active cards only, as Pending Submissions counts them, so a card has one name in both.
  it("names a card without a label by its place among the holder's active cards", () => {
    state.cards = [
      card({ id: 1, ccNumber: "111111", label: null, status: "Inactive" }),
      card({ id: 2, ccNumber: "222222", label: null }),
    ];
    open(null);
    expect(select("Card")).toHaveTextContent("Card 1 (222222)");

    fireEvent.mouseDown(select("Card"));
    expect(within(screen.getByRole("option")).getByText("Card 1")).toBeInTheDocument();
  });

  it("names a rule's inactive card without a label as inactive", () => {
    state.cards = [card({ id: 1, ccNumber: "111111", label: null, status: "Inactive" }), card({ id: 2 })];
    open(rule({ creditCardId: 1, ccNumber: "111111" }));
    expect(select("Card")).toHaveTextContent("Inactive card (111111)");
  });

  it("disables Add until the required fields are filled", async () => {
    open(null);
    expect(saveButton()).toBeDisabled();

    await userEvent.type(field("Supplier"), "Uber");
    expect(saveButton()).toBeEnabled();
  });

  it("shows a field's error once it is edited, and disables Add meanwhile", async () => {
    open(null);
    await userEvent.type(field("Supplier"), "Uber");
    expect(screen.queryByText("Enter at most 1,000,000.")).not.toBeInTheDocument();

    await userEvent.type(field("Min Amount ($)"), "1000001");

    expect(screen.getByText("Enter at most 1,000,000.")).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it("takes only digits and a point with up to 2 decimals in an amount", async () => {
    open(null);
    await userEvent.type(field("Min Amount ($)"), "1a2,-.345");
    expect(field("Min Amount ($)")).toHaveValue("12.34");
  });

  it("shows an amount to 2 decimal places once it's left, and keeps the decimals editable", async () => {
    open(null);
    await userEvent.type(field("Max Amount ($)"), "50");
    await userEvent.tab();
    expect(field("Max Amount ($)")).toHaveValue("50.00");

    await userEvent.type(field("Max Amount ($)"), "{backspace}{backspace}75");
    expect(field("Max Amount ($)")).toHaveValue("50.75");
  });

  it("shows a stored amount to 2 decimal places", () => {
    open(rule({ amountMin: 10.5 }));
    expect(field("Min Amount ($)")).toHaveValue("10.50");
  });

  it("tells a screen reader what's wrong with a field", async () => {
    open(null);
    await userEvent.type(field("Supplier"), "U");
    await userEvent.clear(field("Supplier"));
    expect(field("Supplier")).toHaveAccessibleDescription("Enter the supplier.");
  });

  // A new rule is meant to apply, so there is nothing to switch.
  it("doesn't offer Active when adding", () => {
    open(null);
    expect(screen.queryByLabelText("Active")).not.toBeInTheDocument();
  });

  it("explains what the supplier and account match", () => {
    open(null);
    expect(screen.getByText("Matches bills containing this supplier name.")).toBeInTheDocument();
    expect(screen.getByText("Leave empty for bills without an account.")).toBeInTheDocument();
  });
});

describe("editing a rule", () => {
  it("keeps the rule's inactive card listed", () => {
    open(rule({ creditCardId: 9, ccNumber: "999999" }));
    expect(select("Card")).toHaveTextContent("Old (999999)");
  });

  // A body of exactly {active} is how an outdated rule is switched off: the backend checks nothing else.
  it("sends only {active} when only Active changed", async () => {
    open(rule());
    await userEvent.click(screen.getByLabelText("Active"));
    await save();

    expect(sent.update).toEqual([{ id: 1, patch: { active: false } }]);
    expect(await screen.findByText("Rule updated")).toBeInTheDocument();
  });

  it("disables Save until something changes", async () => {
    open(rule());
    expect(saveButton()).toBeDisabled();

    await userEvent.type(field("Comment"), "!");
    expect(saveButton()).toBeEnabled();
  });

  // A comment can be longer through the API than the form allows.
  it("shows a stored value's error straight away", () => {
    open(rule({ comment: "c".repeat(31) }));
    expect(screen.getByText("Use at most 30 characters.")).toBeInTheDocument();
  });

  it("shows the stored card number when the card isn't listed", () => {
    open(rule({ creditCardId: 99, ccNumber: "777777" }));
    expect(select("Card")).toHaveTextContent("777777");
  });

  it("shows the stored card number while the cards load", () => {
    state.cardsLoading = true;
    open(rule());
    expect(select("Card")).toHaveTextContent("123456");
  });

  it("locks card, supplier and account on system rules", () => {
    open(rule({ source: "auto" }));

    expect(select("Card")).toHaveAttribute("aria-disabled", "true");
    expect(field("Supplier")).toBeDisabled();
    expect(field("Account")).toBeDisabled();
    expect(screen.queryByText("Matches bills containing this supplier name.")).not.toBeInTheDocument();
    expect(screen.queryByText("Leave empty for bills without an account.")).not.toBeInTheDocument();
  });

  it("clears the type, sub region and units when the category changes", async () => {
    open(rule());
    await userEvent.clear(select("Expense Category"));
    await userEvent.type(select("Expense Category"), "Marke");
    await userEvent.click(screen.getByRole("option", { name: "Marketing" }));

    expect(select("Expense Type")).toHaveValue("");
    expect(select("Product Unit")).toHaveTextContent("Select…");
    expect(field("Business Unit")).toHaveValue("");
    expect(select("Sub Region")).toHaveTextContent("Select…");
  });

  it("shows the Travel Job Number note instead of the unit fields", () => {
    open(rule({ expenseCategoryLabel: "Travel", expenseTypeLabel: "Air", productUnit: null, businessUnit: null }));

    const note = "The Travel Job Number can't be set in a rule, as it differs every time.";
    expect(screen.getByText(note)).toBeInTheDocument();
    // A quiet note, not an alert box.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Product Unit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Sub Region" })).not.toBeInTheDocument();
  });

  // A Travel rule takes no units, so stored ones are neither checked nor kept.
  it("clears hidden values on save rather than being blocked by them", async () => {
    const travel = { expenseCategoryLabel: "Travel", expenseTypeLabel: "Air" };
    open(rule({ ...travel, productUnit: "Legacy", businessUnit: "Gone" }));
    expect(screen.queryByText(/Some values are no longer offered/)).not.toBeInTheDocument();

    await userEvent.type(field("Comment"), "!");
    await save();

    expect(sent.update).toEqual([
      { id: 1, patch: { comment: "Client visit!", productUnit: null, businessUnit: null } },
    ]);
  });

  it("disables saving while the request runs", async () => {
    server.pending = true;
    open(rule());
    await userEvent.type(field("Comment"), "!");
    expect(saveButton()).toBeDisabled();
  });
});

describe("errors from the server", () => {
  it("shows the 409 overlap message inside the dialog", async () => {
    const message = "A tagging rule with the same card, supplier and account has an overlapping amount range.";
    server.fail = new HttpError("https://cc.test/tagging-rules/1", 409, JSON.stringify({ message }));
    open(rule());
    await userEvent.type(field("Max Amount ($)"), "100");
    await save();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "A rule with the same card, supplier and account has an overlapping amount range.",
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows any other error's message inside the dialog", async () => {
    server.fail = new HttpError("https://cc.test/tagging-rules", 400, JSON.stringify({ message: "Bad supplier." }));
    open(null);
    await userEvent.type(field("Supplier"), "Uber");
    await save();

    expect(screen.getByRole("alert")).toHaveTextContent("Bad supplier.");
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("a rule with values no longer offered", () => {
  const outdated = { outdated: true };

  it.each([
    ["category", { expenseCategoryLabel: "Gone", expenseTypeLabel: "Old" }, () => select("Expense Category"), "Gone"],
    ["type", { expenseTypeLabel: "Bus" }, () => select("Expense Type"), "Bus"],
    [
      "sub region",
      { expenseCategoryLabel: "Marketing", expenseTypeLabel: "Events", subRegion: "LATAM" },
      () => select("Sub Region"),
      "LATAM",
    ],
    ["unit pair", { productUnit: "Legacy", businessUnit: "Retired" }, () => select("Product Unit"), "Legacy"],
  ] as const)("shows an outdated %s as stored and marks it", (_, values, control, stored) => {
    open(rule({ ...outdated, ...values }));

    const shown = control();
    expect(shown.tagName === "INPUT" ? (shown as HTMLInputElement).value : shown.textContent).toBe(stored);
    expect(screen.getAllByText(STALE).length).toBeGreaterThan(0);
    // Each field says so itself; a banner on top would only repeat it.
    expect(screen.queryByText(/Some values are no longer offered/)).not.toBeInTheDocument();
  });

  it("tags an outdated sub region in its list, as the other selects do", () => {
    open(rule({ outdated: true, expenseCategoryLabel: "Marketing", expenseTypeLabel: "Events", subRegion: "LATAM" }));
    fireEvent.mouseDown(select("Sub Region"));

    const option = screen.getByRole("option", { name: /LATAM/ });
    expect(within(option).getByText("No longer offered")).toBeInTheDocument();
  });

  it.each([
    ["sub region", { expenseCategoryLabel: "Marketing", expenseTypeLabel: "Events", subRegion: "LATAM" }, "Sub Region"],
    ["unit pair", { productUnit: "Legacy", businessUnit: "Retired" }, "Product Unit"],
  ] as const)("lets an outdated %s be cleared, which it needn't have", async (_, values, name) => {
    open(rule({ ...outdated, ...values }));
    fireEvent.mouseDown(select(name));
    fireEvent.click(screen.getByRole("option", { name: "None" }));
    await save();

    const cleared = name === "Sub Region" ? { subRegion: null } : { productUnit: null, businessUnit: null };
    expect(sent.update).toEqual([{ id: 1, patch: cleared }]);
  });

  it("shows the stored product unit while the units load", () => {
    state.menusLoading = true;
    open(rule());
    expect(screen.getByRole("textbox", { name: "Product Unit" })).toHaveValue("IAM");
  });

  it("blocks saving until the menus load", async () => {
    state.menusLoading = true;
    open(rule({ ...outdated }));

    await userEvent.type(field("Comment"), "!");

    expect(saveButton()).toBeDisabled();
  });

  it("shows the business unit of an outdated pair as stored", () => {
    open(rule({ ...outdated, productUnit: "Legacy", businessUnit: "Retired" }));
    expect(field("Business Unit")).toHaveValue("Retired");
  });

  it("disables saving until outdated values are changed", async () => {
    open(rule({ ...outdated, subRegion: null, expenseTypeLabel: "Bus" }));
    await userEvent.type(field("Comment"), "!");

    expect(saveButton()).toBeDisabled();
  });

  it("still allows switching the rule off", async () => {
    open(rule({ ...outdated, expenseTypeLabel: "Bus" }));
    await userEvent.click(screen.getByLabelText("Active"));
    await save();

    expect(sent.update).toEqual([{ id: 1, patch: { active: false } }]);
  });

  it("saves once the outdated value is replaced", async () => {
    open(rule({ ...outdated, expenseTypeLabel: "Bus" }));
    await userEvent.clear(select("Expense Type"));
    await userEvent.type(select("Expense Type"), "Mea");
    await userEvent.click(screen.getByRole("option", { name: "Meals" }));
    await save();

    expect(sent.update).toEqual([{ id: 1, patch: { expenseTypeLabel: "Meals" } }]);
  });
});

describe("when something the dialog needs fails to load", () => {
  it.each([
    ["cards", "cardsRetrying", "Couldn't load your cards."],
    ["expense options", "menusRetrying", "Couldn't load the expense options."],
  ] as const)("disables Retry on the %s while it runs", (_, flag, message) => {
    state[flag] = true;
    open(rule());

    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("button", { name: /retry/i })).toBeDisabled();
  });
});
