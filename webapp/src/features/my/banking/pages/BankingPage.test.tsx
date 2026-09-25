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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Bank, BankAccount, BankingAppConfig } from "../../api/types";

// BankingPage uses the real bankingRules.ts (deliberately not mocked — the
// gating decisions are part of what this page test covers), which pulls in
// @hooks/useAsgardeoGroups -> @asgardeo/react. That package fails to
// resolve under this sandbox's Node/pnpm setup (unrelated to this file's
// logic) — same workaround as bankingRules.test.ts and the existing
// useUmtGate.test.tsx.
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));

const { default: BankingPage } = await import("./BankingPage");

// Hooks mocked at the module boundary, same approach as MyTeamPage.test.tsx
// — no QueryClientProvider needed since nothing here touches react-query
// directly, only these hook modules.

const useMeProfileMock = vi.fn();
vi.mock("../../api/useMeProfile", () => ({
  useMeProfile: () => useMeProfileMock(),
}));

const useBankAccountsMock = vi.fn();
vi.mock("../../api/useBankAccounts", () => ({
  isBankingBackendConfigured: () => true,
  useBankAccounts: () => useBankAccountsMock(),
}));

const useBankingConfigMock = vi.fn();
vi.mock("../../api/useBankingConfig", () => ({
  useBankingConfig: () => useBankingConfigMock(),
}));

const useBankingGateMock = vi.fn();
vi.mock("../../api/useBankingGate", () => ({
  useBankingGate: () => useBankingGateMock(),
}));

const useBanksMock = vi.fn();
vi.mock("../../api/useBanks", () => ({
  useBanks: (enabled: boolean) => useBanksMock(enabled),
}));

const mutateAsyncMock = vi.fn();
vi.mock("../../api/useCreateBankAccountRequest", () => ({
  useCreateBankAccountRequest: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
}));

function profile(workLocation = "Colombo") {
  return {
    data: { employee: { workEmail: "person@wso2.com", workLocation } },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  };
}

function account(overrides: Partial<BankAccount>): BankAccount {
  return {
    accountId: 1,
    employeeEmail: "person@wso2.com",
    accountName: "P Person",
    accountNumber: "1234567890",
    accountStatus: "ACTIVE",
    accountType: "SALARY",
    bankCode: "12",
    bankSwiftCode: "BOCCLKLX",
    bankName: "BOC",
    bankLocation: "Colombo",
    branchCode: "001",
    branchName: "Head Office",
    beneficiaryAddress: "123 Main St",
    bankAddress: "456 Bank Rd",
    paymentMethod: null,
    effectiveFrom: "2026-01-01",
    createdOn: "2026-01-01",
    ...overrides,
  };
}

function accounts(list: BankAccount[]) {
  return {
    data: { bankAccounts: list, count: list.length },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  };
}

function config(overrides: Partial<BankingAppConfig> = {}) {
  return {
    data: {
      salaryThreshold: 28,
      consultancyThreshold: 28,
      reimbursementsAllowedCountries: ["Colombo"],
      consultancyRestrictedRoles: [],
      ...overrides,
    },
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  };
}

function gate(overrides: Partial<ReturnType<typeof defaultGate>> = {}) {
  return { ...defaultGate(), ...overrides };
}
function defaultGate() {
  return {
    isConsultancyRestricted: false,
    isResolving: false,
    isError: false,
    errorMessage: undefined as string | undefined,
    retry: vi.fn(),
  };
}

function bank(overrides: Partial<Bank> = {}): Bank {
  return {
    bankCode: "12",
    bankLocation: "Colombo",
    bankName: "BOC",
    swiftCode: "BOCCLKLX",
    ...overrides,
  };
}

function banks(list: Bank[]) {
  return {
    data: { banks: list, count: list.length },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  };
}

beforeEach(() => {
  useMeProfileMock.mockReturnValue(profile());
  useBankAccountsMock.mockReturnValue(accounts([]));
  useBankingConfigMock.mockReturnValue(config());
  useBankingGateMock.mockReturnValue(gate());
  useBanksMock.mockReturnValue(banks([bank(), bank({ bankName: "HNB", swiftCode: "HBLILKLX", bankCode: "7" })]));
  mutateAsyncMock.mockReset();
  mutateAsyncMock.mockResolvedValue({ applicationID: 42 });
});

// Fills the bank-lookup step, then the account-details step (SALARY/
// REIMBURSEMENT field set unless `consultancy` is set), landing on Review.
async function completeUpToReview(
  user: ReturnType<typeof userEvent.setup>,
  { consultancy = false }: { consultancy?: boolean } = {},
) {
  await user.click(screen.getByRole("combobox", { name: "Bank" }));
  await user.click(await screen.findByRole("option", { name: "BOC (BOCCLKLX)" }));
  await user.click(screen.getByRole("button", { name: "Next" }));

  await user.type(screen.getByLabelText("Account Holder's Name"), "P Person");
  await user.type(screen.getByLabelText("Account Holder's Address"), "No 23, Galle Road, Colombo");
  await user.type(screen.getByLabelText("Account No"), "1234567890");
  await user.type(screen.getByLabelText("Bank Address"), "1 Bank Street, Colombo, Sri Lanka");
  if (!consultancy) {
    await user.type(screen.getByLabelText("Branch Name"), "Head Office");
    await user.type(screen.getByLabelText("Branch Code"), "001");
  }
  await user.click(screen.getByRole("button", { name: "Next" }));
}

describe("Edit/Add popup", () => {
  it("opens a dialog scoped to the clicked panel's Account Type", async () => {
    render(<BankingPage />);
    const user = userEvent.setup();

    const reimbursementCard = screen.getByText("Reimbursement").closest(".MuiCard-root") as HTMLElement;
    await user.click(within(reimbursementCard).getByRole("button", { name: "Add" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Reimbursement");
    // The Salary panel's own Add/Edit action is untouched — queried with
    // `hidden: true` since the open Dialog correctly marks the rest of the
    // page aria-hidden while it's up, which getByRole excludes by default.
    expect(
      within(screen.getByText("Salary").closest(".MuiCard-root") as HTMLElement).getByRole("button", {
        name: "Add",
        hidden: true,
      }),
    ).toBeEnabled();
  });

  it("can be cancelled from the bank-lookup step without submitting", async () => {
    render(<BankingPage />);
    const user = userEvent.setup();
    await user.click(within(screen.getByText("Salary").closest(".MuiCard-root") as HTMLElement).getByRole(
      "button",
      { name: "Add" },
    ));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it("blocks advancing from the bank-lookup step until a bank is selected", async () => {
    render(<BankingPage />);
    const user = userEvent.setup();
    await user.click(within(screen.getByText("Salary").closest(".MuiCard-root") as HTMLElement).getByRole(
      "button",
      { name: "Add" },
    ));

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Select a bank to continue")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveTextContent("Bank");
    expect(screen.queryByLabelText("Account Holder's Name")).not.toBeInTheDocument();
  });

  it("shows a retryable error state if the bank list fails to load", async () => {
    useBanksMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("network down"),
      refetch: vi.fn(),
    });
    render(<BankingPage />);
    const user = userEvent.setup();
    await user.click(within(screen.getByText("Salary").closest(".MuiCard-root") as HTMLElement).getByRole(
      "button",
      { name: "Add" },
    ));

    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows Consultancy's own field set on the details step (no branch fields)", async () => {
    useBankingGateMock.mockReturnValue(gate());
    render(<BankingPage />);
    const user = userEvent.setup();
    await user.click(within(screen.getByText("Consultancy").closest(".MuiCard-root") as HTMLElement).getByRole(
      "button",
      { name: "Add" },
    ));
    await user.click(screen.getByRole("combobox", { name: "Bank" }));
    await user.click(await screen.findByRole("option", { name: "BOC (BOCCLKLX)" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByLabelText("Account Holder's Name")).toBeInTheDocument();
    expect(screen.queryByLabelText("Branch Name")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Branch Code")).not.toBeInTheDocument();
  });

  it("blocks advancing from the details step until required fields are filled", async () => {
    render(<BankingPage />);
    const user = userEvent.setup();
    await user.click(within(screen.getByText("Salary").closest(".MuiCard-root") as HTMLElement).getByRole(
      "button",
      { name: "Add" },
    ));
    await user.click(screen.getByRole("combobox", { name: "Bank" }));
    await user.click(await screen.findByRole("option", { name: "BOC (BOCCLKLX)" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Account Holder's Name is required")).toBeInTheDocument();
    // Still on the details step, not advanced to Review.
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
  });

  it("can go back from the details step to the bank-lookup step", async () => {
    render(<BankingPage />);
    const user = userEvent.setup();
    await user.click(within(screen.getByText("Salary").closest(".MuiCard-root") as HTMLElement).getByRole(
      "button",
      { name: "Add" },
    ));
    await user.click(screen.getByRole("combobox", { name: "Bank" }));
    await user.click(await screen.findByRole("option", { name: "BOC (BOCCLKLX)" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.getByRole("combobox", { name: "Bank" })).toBeInTheDocument();
  });

  it("shows a review of the entered values before submitting", async () => {
    render(<BankingPage />);
    const user = userEvent.setup();
    await user.click(within(screen.getByText("Salary").closest(".MuiCard-root") as HTMLElement).getByRole(
      "button",
      { name: "Add" },
    ));
    await completeUpToReview(user);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("P Person");
    expect(dialog).toHaveTextContent("1234567890");
    expect(dialog).toHaveTextContent("BOC");
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
  });

  it("submits the expected payload, shows success, and closes the dialog", async () => {
    render(<BankingPage />);
    const user = userEvent.setup();
    await user.click(within(screen.getByText("Salary").closest(".MuiCard-root") as HTMLElement).getByRole(
      "button",
      { name: "Add" },
    ));
    await completeUpToReview(user);
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(mutateAsyncMock).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeEmail: "person@wso2.com",
        accountType: "SALARY",
        accountName: "P Person",
        accountNumber: "1234567890",
        bankName: "BOC",
        bankSwiftCode: "BOCCLKLX",
        bankCode: "12",
        bankLocation: "Colombo",
        beneficiaryAddress: "No 23, Galle Road, Colombo",
        bankAddress: "1 Bank Street, Colombo, Sri Lanka",
        branchName: "Head Office",
        branchCode: "001",
      }),
    );
    expect(await screen.findByText(/request/i)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a specific error and stays open when the backend rejects the submission", async () => {
    mutateAsyncMock.mockReset();
    mutateAsyncMock.mockRejectedValue(new Error("Changes allowed only until the 5th of each month."));
    render(<BankingPage />);
    const user = userEvent.setup();
    await user.click(within(screen.getByText("Salary").closest(".MuiCard-root") as HTMLElement).getByRole(
      "button",
      { name: "Add" },
    ));
    await completeUpToReview(user);
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(
      await screen.findByText("Changes allowed only until the 5th of each month."),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("starts blank again if reopened after being cancelled", async () => {
    render(<BankingPage />);
    const user = userEvent.setup();
    const openSalaryDialog = () =>
      user.click(
        within(screen.getByText("Salary").closest(".MuiCard-root") as HTMLElement).getByRole("button", {
          name: "Add",
        }),
      );

    await openSalaryDialog();
    await user.click(screen.getByRole("combobox", { name: "Bank" }));
    await user.click(await screen.findByRole("option", { name: "BOC (BOCCLKLX)" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.type(screen.getByLabelText("Account Holder's Name"), "Stale Value");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await openSalaryDialog();
    expect(screen.getByRole("combobox", { name: "Bank" })).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Stale Value")).not.toBeInTheDocument();
  });
});

describe("panel field rendering", () => {
  it("renders each Account Type's own fields, and an empty state for one not set up", () => {
    useBankAccountsMock.mockReturnValue(
      accounts([
        account({ accountType: "SALARY", bankName: "BOC", accountNumber: "1111" }),
        account({
          accountType: "REIMBURSEMENT",
          accountId: 2,
          bankName: "HNB",
          accountNumber: "2222",
        }),
        // No CONSULTANCY account — that panel should show the empty state.
      ]),
    );

    render(<BankingPage />);

    // Salary: bank-detail fields present.
    expect(screen.getByText("Salary").closest(".MuiCard-root")).toHaveTextContent("BOC");
    expect(screen.getByText("Salary").closest(".MuiCard-root")).toHaveTextContent("Bank Location");

    // Reimbursement: its own fields, same shape as Salary here.
    expect(screen.getByText("Reimbursement").closest(".MuiCard-root")).toHaveTextContent("HNB");

    // Consultancy: no account yet -> empty state, and the action reads "Add".
    const consultancyCard = screen.getByText("Consultancy").closest(".MuiCard-root") as HTMLElement;
    expect(consultancyCard).toHaveTextContent("Not set up yet.");
    expect(within(consultancyCard).getByRole("button", { name: "Add" })).toBeInTheDocument();

    // Salary/Reimbursement already have an account -> "Edit", not "Add".
    expect(
      within(screen.getByText("Salary").closest(".MuiCard-root") as HTMLElement).getByRole("button", {
        name: "Edit",
      }),
    ).toBeInTheDocument();
  });

  it("shows Consultancy's own field set (Payment Method), not the bank-location block", () => {
    useBankAccountsMock.mockReturnValue(
      accounts([account({ accountType: "CONSULTANCY", paymentMethod: "Wire transfer" })]),
    );

    render(<BankingPage />);

    const consultancyCard = screen.getByText("Consultancy").closest(".MuiCard-root") as HTMLElement;
    expect(consultancyCard).toHaveTextContent("Payment Method");
    expect(consultancyCard).toHaveTextContent("Wire transfer");
    expect(consultancyCard).not.toHaveTextContent("Bank Location");
  });
});

describe("Threshold gating", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("disables a panel's Edit action once its own Threshold day has passed, and states why", () => {
    vi.setSystemTime(new Date(2026, 8, 10)); // 10 Sep 2026
    useBankingConfigMock.mockReturnValue(config({ salaryThreshold: 5, consultancyThreshold: 28 }));
    useBankAccountsMock.mockReturnValue(accounts([account({ accountType: "SALARY" })]));

    render(<BankingPage />);

    const salaryCard = screen.getByText("Salary").closest(".MuiCard-root") as HTMLElement;
    expect(within(salaryCard).getByRole("button", { name: "Edit" })).toBeDisabled();
    expect(salaryCard).toHaveTextContent("Changes allowed only until the 5th of each month.");

    // Consultancy's own threshold (28) hasn't passed — independent of Salary's.
    const consultancyCard = screen.getByText("Consultancy").closest(".MuiCard-root") as HTMLElement;
    expect(within(consultancyCard).getByRole("button", { name: "Add" })).toBeEnabled();
  });
});

describe("Consultancy Restriction", () => {
  it("does not render the Consultancy panel for a restricted-group caller", () => {
    useBankingGateMock.mockReturnValue(gate({ isConsultancyRestricted: true }));

    render(<BankingPage />);

    expect(screen.queryByText("Consultancy")).not.toBeInTheDocument();
    // The other two panels are unaffected.
    expect(screen.getByText("Salary")).toBeInTheDocument();
    expect(screen.getByText("Reimbursement")).toBeInTheDocument();
  });
});

describe("Reimbursement Eligibility", () => {
  it("disables the Reimbursement panel's Edit action for an ineligible work location", () => {
    useMeProfileMock.mockReturnValue(profile("Nowhereville"));
    useBankingConfigMock.mockReturnValue(config({ reimbursementsAllowedCountries: ["Colombo"] }));

    render(<BankingPage />);

    const reimbursementCard = screen.getByText("Reimbursement").closest(".MuiCard-root") as HTMLElement;
    expect(within(reimbursementCard).getByRole("button", { name: "Add" })).toBeDisabled();
    expect(reimbursementCard).toHaveTextContent("Not available for your work location.");

    // Salary is unaffected by Reimbursement's own gate.
    const salaryCard = screen.getByText("Salary").closest(".MuiCard-root") as HTMLElement;
    expect(within(salaryCard).getByRole("button", { name: "Add" })).toBeEnabled();
  });

  it("leaves it enabled for an eligible work location", () => {
    useMeProfileMock.mockReturnValue(profile("Colombo"));
    useBankingConfigMock.mockReturnValue(config({ reimbursementsAllowedCountries: ["Colombo"] }));

    render(<BankingPage />);

    const reimbursementCard = screen.getByText("Reimbursement").closest(".MuiCard-root") as HTMLElement;
    expect(within(reimbursementCard).getByRole("button", { name: "Add" })).toBeEnabled();
  });
});
