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

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = {
  privileges: ["employee", "cc_owner"] as string[],
  loading: false,
  fails: false,
  fetching: false,
  refetches: 0,
  rules: [{ id: 7 }] as unknown[] | undefined,
};

vi.mock("../useCc", () => ({
  useCcUserInfo: () => ({
    data: state.loading || state.fails ? undefined : { workEmail: "jane@wso2.com", privileges: state.privileges },
    isLoading: state.loading,
    isError: state.fails,
    isFetching: state.fetching,
    error: state.fails ? new Error("Gateway timeout") : null,
    refetch: () => {
      state.refetches += 1;
    },
  }),
  useCcTaggingRules: () => ({ data: state.rules }),
}));

vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: "sub-jane" }, retry: () => {} }),
}));

vi.mock("@config/apiConfig", async (original) => ({
  ...(await original<typeof import("@config/apiConfig")>()),
  ccBillsInbox: "card-invoices@wso2.com",
}));

// The real shell adds the eyebrow and the not-configured gate, which this page doesn't decide.
vi.mock("../../components/FinanceShell", () => ({
  default: ({ title, children }: { title: string; children: ReactNode }) => (
    <>
      <h1>{title}</h1>
      {children}
    </>
  ),
}));

const listed = { id: 7, supplier: "Uber" };

// The list and dialogs have their own tests; these stand-ins show which the page opens, and for what.
vi.mock("../CcTaggingRules", () => ({
  CcTaggingRules: (p: {
    onAdd: () => void;
    onEdit: (r: unknown) => void;
    onDelete: (r: unknown) => void;
    onHowItWorks: () => void;
  }) => (
    <>
      <p>The rules list</p>
      <button type="button" onClick={p.onHowItWorks}>
        List guide
      </button>
      <button type="button" onClick={p.onAdd}>
        Add
      </button>
      <button type="button" onClick={() => p.onEdit(listed)}>
        Edit Uber
      </button>
      <button type="button" onClick={() => p.onDelete(listed)}>
        Delete Uber
      </button>
    </>
  ),
}));
vi.mock("../CcTaggingRuleDialog", () => ({
  CcTaggingRuleDialog: (p: { rule: { supplier: string } | null; onClose: () => void }) => (
    <div role="dialog" aria-label={p.rule ? `Edit ${p.rule.supplier}` : "Add"}>
      <button type="button" onClick={p.onClose}>
        Done
      </button>
    </div>
  ),
}));
vi.mock("../CcTaggingRuleDeleteDialog", () => ({
  CcTaggingRuleDeleteDialog: (p: { rule: { supplier: string }; onClose: () => void }) => (
    <div role="dialog" aria-label={`Delete ${p.rule.supplier}`}>
      <button type="button" onClick={p.onClose}>
        Done
      </button>
    </div>
  ),
}));

const { default: CcAutofillRulesPage } = await import("./CcAutofillRulesPage");

beforeEach(() => {
  state.privileges = ["employee", "cc_owner"];
  state.loading = false;
  state.fails = false;
  state.fetching = false;
  state.refetches = 0;
  state.rules = [{ id: 7 }];
  localStorage.clear();
});

describe("CcAutofillRulesPage", () => {
  it("is titled Autofill Rules", () => {
    render(<CcAutofillRulesPage />);
    expect(screen.getByRole("heading", { name: "Autofill Rules" })).toBeInTheDocument();
  });

  it("decides nothing while access is being checked", () => {
    state.loading = true;
    render(<CcAutofillRulesPage />);
    expect(screen.queryByText("The rules list")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("Autofill rules are for card holders.")).not.toBeInTheDocument();
  });

  it("shows Retry, not a denial, when /user-info fails", async () => {
    state.fails = true;
    render(<CcAutofillRulesPage />);

    expect(screen.queryByText("Autofill rules are for card holders.")).not.toBeInTheDocument();
    expect(screen.queryByText("The rules list")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(state.refetches).toBe(1);
  });

  it("explains the page to someone without a card", () => {
    state.privileges = ["employee", "finance"];
    render(<CcAutofillRulesPage />);
    expect(screen.getByText("Autofill rules are for card holders.")).toBeInTheDocument();
    expect(screen.queryByText("The rules list")).not.toBeInTheDocument();
  });

  it("shows a card holder their rules", () => {
    render(<CcAutofillRulesPage />);
    expect(screen.getByText("The rules list")).toBeInTheDocument();
    expect(screen.queryByText("Autofill rules are for card holders.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });

  it("introduces autofill above the rules, and explains it from the list", async () => {
    render(<CcAutofillRulesPage />);
    expect(screen.getByText(/Autofill attaches your bills/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "List guide" }));
    const guide = screen.getByRole("dialog", { name: "How autofill works" });
    expect(within(guide).getByText("card-invoices+jane@wso2.com")).toBeInTheDocument();

    await userEvent.click(within(guide).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("brings the guide card back while there are no rules, even once dismissed", async () => {
    const { unmount } = render(<CcAutofillRulesPage />);
    await userEvent.click(screen.getByRole("button", { name: "Got it" }));
    unmount();

    state.rules = [];
    render(<CcAutofillRulesPage />);
    expect(screen.getByText(/Autofill attaches your bills/)).toBeInTheDocument();
  });

  // Rules that are still loading, or failed to load, may be there: a dismissed card stays away, and keeps Got it.
  it("counts rules that haven't loaded as there", async () => {
    state.rules = undefined;
    const { unmount } = render(<CcAutofillRulesPage />);
    await userEvent.click(screen.getByRole("button", { name: "Got it" }));
    unmount();

    render(<CcAutofillRulesPage />);
    expect(screen.queryByText(/Autofill attaches your bills/)).not.toBeInTheDocument();
  });

  it("remembers Got it under the user's ID, not their email", async () => {
    render(<CcAutofillRulesPage />);
    await userEvent.click(screen.getByRole("button", { name: "Got it" }));

    expect(localStorage.getItem("one-wso2.cc-autofill-guide.v1.sub-jane")).toBe("true");
    expect(Object.keys(localStorage).some((k) => k.includes("jane@wso2.com"))).toBe(false);
  });

  it("introduces autofill only to card holders", () => {
    state.privileges = ["employee", "finance"];
    render(<CcAutofillRulesPage />);
    expect(screen.queryByText(/Autofill attaches your bills/)).not.toBeInTheDocument();
  });

  it("opens the add dialog from Add Rule", async () => {
    render(<CcAutofillRulesPage />);
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("dialog", { name: "Add" })).toBeInTheDocument();
  });

  it("opens the rule dialog for the rule to edit", async () => {
    render(<CcAutofillRulesPage />);
    await userEvent.click(screen.getByRole("button", { name: "Edit Uber" }));
    expect(screen.getByRole("dialog", { name: "Edit Uber" })).toBeInTheDocument();
  });

  it("asks before deleting a rule", async () => {
    render(<CcAutofillRulesPage />);
    await userEvent.click(screen.getByRole("button", { name: "Delete Uber" }));
    expect(screen.getByRole("dialog", { name: "Delete Uber" })).toBeInTheDocument();
  });

  it("closes a dialog once it's done", async () => {
    render(<CcAutofillRulesPage />);
    await userEvent.click(screen.getByRole("button", { name: "Edit Uber" }));
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
