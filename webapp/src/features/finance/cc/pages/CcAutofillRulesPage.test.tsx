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

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = {
  privileges: ["employee", "cc_owner"] as string[],
  loading: false,
  fails: false,
  fetching: false,
  refetches: 0,
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

vi.mock("../CcTaggingRules", () => ({ CcTaggingRules: () => <p>The rules list</p> }));

const { default: CcAutofillRulesPage } = await import("./CcAutofillRulesPage");

beforeEach(() => {
  state.privileges = ["employee", "cc_owner"];
  state.loading = false;
  state.fails = false;
  state.fetching = false;
  state.refetches = 0;
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
});
