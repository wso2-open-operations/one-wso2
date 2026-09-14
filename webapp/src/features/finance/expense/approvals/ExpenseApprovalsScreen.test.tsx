/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ExpenseClaimSearchPayload } from "../expenseTypes";
import type { ApprovalClaim } from "./expenseApprovalTypes";

vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));

function claim(over: Partial<ApprovalClaim> = {}): ApprovalClaim {
  return {
    id: "EXP-001",
    createdDate: "2026-09-09 07:30:00.0",
    totalAmount: 1200,
    currencyCode: "LKR",
    employeeEmail: "employee@wso2.com",
    submittedBy: "employee@wso2.com",
    leadEmails: ["approver@wso2.com"],
    statusDetails: {
      status: "PENDING_LEAD",
      leadApprovedDate: null,
      leadRejectedReason: null,
      leadRejectedDate: null,
      financeApproverEmail: null,
      financeApprovedDate: null,
      financeRejectedDate: null,
    },
    transactions: [
      {
        amount: 1200,
        currency: "LKR",
        currencyConversionRate: 1,
        reimbursementAmount: 1200,
        reimbursementCurrency: "LKR",
        expenseTypeId: 3,
        expenseType: "Taxi",
        date: "2026-09-08",
        comment: "Airport transfer",
        receiptUrl: "EC-FILE-employee-2026908-abc.png",
        travelJobNumber: null,
      },
    ],
    ...over,
  };
}

/** Every payload that reached the search hook, in order. */
const payloads: ExpenseClaimSearchPayload[] = [];
/** Which stages this approver holds — independent flags, so all three cases. */
const flags = { lead: true, finance: true };
const configured = { value: true };
const state = { claims: [claim()] as ApprovalClaim[] };

vi.mock("../useExpense", () => ({
  useExpenseAppData: () => ({
    data: {
      userInfo: { workEmail: "approver@wso2.com", firstName: "A", lastName: "B" },
      get enableLeadView() {
        return flags.lead;
      },
      get enableFinanceView() {
        return flags.finance;
      },
      currencyCode: "LKR",
      countryCode: "LK",
      travels: [],
      draft: null,
      pastDateRestrictionDays: 30,
    },
    isLoading: false,
    isError: false,
    isSuccess: true,
  }),
  useExpenseClaims: (payload: ExpenseClaimSearchPayload) => {
    payloads.push(payload);
    return { data: state.claims, isLoading: false, isError: false, isSuccess: true };
  },
  useExpenseEmployees: () => ({
    data: [
      { workEmail: "employee@wso2.com", firstName: "Ada", lastName: "Lovelace", employeeThumbnail: null },
      { workEmail: "approver@wso2.com", firstName: "Alan", lastName: "Turing", employeeThumbnail: null },
    ],
    isLoading: false,
    isError: false,
  }),
}));

const statusMutate = vi.fn();
vi.mock("../useExpenseMutations", () => ({
  useExpenseClaimStatus: () => ({ mutate: statusMutate, isPending: false }),
}));

// The printout pre-fetches every receipt; `pending` holds the fetch open so the
// "waits for its receipts" case can be observed.
const receipts = { pending: false };
vi.mock("../../util/financeReceipts", async () => {
  const actual = await vi.importActual<typeof import("../../util/financeReceipts")>(
    "../../util/financeReceipts",
  );
  return {
    ...actual,
    fetchReceiptObjectUrl: vi.fn(
      () =>
        new Promise((resolve) => {
          if (!receipts.pending) resolve({ url: "blob:receipt", type: "image/png" });
        }),
    ),
  };
});

vi.mock("@config/apiConfig", async () => {
  const actual = await vi.importActual<typeof import("@config/apiConfig")>("@config/apiConfig");
  return { ...actual, isExpenseBackendConfigured: () => configured.value };
});

const { default: ExpenseApprovalsScreen } = await import("./ExpenseApprovalsScreen");
const { NotificationsProvider } = await import("@context/notifications/NotificationsContext");

beforeEach(() => {
  payloads.length = 0;
  statusMutate.mockClear();
  flags.lead = true;
  flags.finance = true;
  configured.value = true;
  receipts.pending = false;
  state.claims = [claim()];
});

/** Each stage is its own route and its own entry, as in the source app. */
function show(stage: "LEAD" | "FINANCE" = "LEAD") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NotificationsProvider>
        <ExpenseApprovalsScreen stage={stage} />
      </NotificationsProvider>
    </QueryClientProvider>,
  );
}

const lastPayload = () => payloads[payloads.length - 1];
// ClaimTabLabels — the source's own tab names.
const openTab = async (label: string) =>
  fireEvent.click(await screen.findByRole("tab", { name: new RegExp(label) }));

describe("what each stage and tab asks the backend for", () => {
  // tableSlice.ts:45-54. `leadEmail` scopes a lead to the claims routed to
  // them; finance is unscoped, which only the backend's admin role lets pass.
  it("scopes a lead's queue to their own address", async () => {
    show("LEAD");
    await screen.findByText("EXP-001");
    expect(lastPayload().leadEmail).toBe("approver@wso2.com");
    expect(lastPayload().status).toEqual(["PENDING_LEAD"]);
  });

  it("leaves a finance queue unscoped", async () => {
    show("FINANCE");
    await screen.findByText("EXP-001");
    expect(lastPayload().leadEmail).toBeUndefined();
    expect(lastPayload().email).toBeUndefined();
    expect(lastPayload().status).toEqual(["PENDING_FINANCE"]);
  });

  // Approvals.tsx:44 — the pending queue hides the claim-range control, and
  // that same flag is what drops `limit`. A queue is never truncated at 100.
  it("sends no limit on the pending queue", async () => {
    show();
    await screen.findByText("EXP-001");
    expect(lastPayload().limit).toBeUndefined();
  });

  it("asks for the latest 100 once a tab is decided", async () => {
    show();
    await openTab("Approved Claims");
    await waitFor(() => expect(lastPayload().limit).toBe(100));
  });

  // The lead's Approved tab means "claims I approved", not "claims that are
  // approved" — hence a claim finance later rejected is still in it.
  it("spans everything a lead passed on, under their Approved tab", async () => {
    show("LEAD");
    await openTab("Approved Claims");
    await waitFor(() =>
      expect(lastPayload().status).toEqual(["PENDING_FINANCE", "APPROVED", "FINANCE_REJECTED"]),
    );
  });

  it("gives finance only the terminal status under Approved", async () => {
    show("FINANCE");
    await openTab("Approved Claims");
    await waitFor(() => expect(lastPayload().status).toEqual(["APPROVED"]));
  });

  it("asks for each stage's own rejections", async () => {
    show("LEAD");
    await openTab("Rejected Claims");
    await waitFor(() => expect(lastPayload().status).toEqual(["LEAD_REJECTED"]));
  });
});

// CustomCardHeader's two titles, one per entry — the source has no switch
// between them, it has two sidebar entries and two routes.
describe("the two entries", () => {
  it("names itself Lead Approvals", async () => {
    show("LEAD");
    expect(await screen.findByText("Lead Approvals")).toBeInTheDocument();
  });

  it("names itself Finance Approvals", async () => {
    show("FINANCE");
    expect(await screen.findByText("Finance Approvals")).toBeInTheDocument();
  });

  it("turns away a lead who opens the finance URL", async () => {
    flags.finance = false;
    show("FINANCE");
    expect(await screen.findByText(/Finance approvals aren't available/)).toBeInTheDocument();
  });

  // The mirror of it. Each entry is hidden from somebody without its flag, but a
  // hidden entry is not access control — the URL can be typed or bookmarked from
  // when the role was held, so the screen refuses on its own account.
  it("turns away somebody who is finance but not a lead", async () => {
    flags.lead = false;
    show("LEAD");
    expect(await screen.findByText(/Lead approvals aren't available/)).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Pending Claims/ })).not.toBeInTheDocument();
  });
});

describe("the queue", () => {
  // ClaimTable.tsx#getButtonLabel — the label follows the tab, never the status.
  it("offers a pending claim a review", async () => {
    show();
    expect(await screen.findByRole("button", { name: "Review" })).toBeInTheDocument();
  });

  it("offers a decided claim a read", async () => {
    show();
    await openTab("Rejected Claims");
    expect(await screen.findByRole("button", { name: "View" })).toBeInTheDocument();
  });

  // ClaimTable.tsx:103,106 — lead/finance swap Status for User.
  it("names the employee and drops the status column", async () => {
    show();
    await screen.findByText("EXP-001");
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "User" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Status" })).not.toBeInTheDocument();
  });

  it("says the queue is clear rather than empty", async () => {
    state.claims = [];
    show();
    expect(await screen.findByText("All caught up! No claims to approve")).toBeInTheDocument();
  });

  it("says a decided tab is merely empty", async () => {
    state.claims = [];
    show();
    await openTab("Rejected Claims");
    expect(await screen.findByText("No claims found")).toBeInTheDocument();
  });
});

describe("filters", () => {
  it("reaches the query only on Apply", async () => {
    show();
    await screen.findByText("EXP-001");
    fireEvent.mouseDown(screen.getByLabelText("Filters"));
    fireEvent.change(await screen.findByLabelText("Filter by claim ID"), { target: { value: "EXP-999" } });
    expect(lastPayload().ids).toBeUndefined();

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(lastPayload().ids).toEqual(["EXP-999"]));
  });

  it("drops the edit on Cancel", async () => {
    show();
    await screen.findByText("EXP-001");
    fireEvent.mouseDown(screen.getByLabelText("Filters"));
    fireEvent.change(await screen.findByLabelText("Filter by claim ID"), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByLabelText("Filter by claim ID")).not.toBeInTheDocument());
    expect(lastPayload().ids).toBeUndefined();
  });

  // The range control belongs to the decided tabs; on pending it is not there
  // to be used, which is the same flag that drops `limit`.
  it("offers no claim range on the pending queue", async () => {
    show();
    await screen.findByText("EXP-001");
    expect(screen.queryByLabelText("Claim Range")).not.toBeInTheDocument();
    await openTab("Approved Claims");
    expect(await screen.findByLabelText("Claim Range")).toBeInTheDocument();
  });
});

describe("deciding on a claim", () => {
  async function review(stage: "LEAD" | "FINANCE" = "LEAD") {
    show(stage);
    fireEvent.click(await screen.findByRole("button", { name: "Review" }));
    return screen.findByText("EXPENSE ITEM 1");
  }

  // claimDetailsSlice.ts:36-50 — a lead approving moves the claim on to
  // finance rather than finishing it.
  it("sends a lead's approval on to finance", async () => {
    await review();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(statusMutate).toHaveBeenCalled());
    expect(statusMutate.mock.calls[0][0]).toMatchObject({
      claimId: "EXP-001",
      body: { status: "PENDING_FINANCE" },
    });
  });

  it("finishes a claim when finance approves", async () => {
    state.claims = [claim({ statusDetails: { ...claim().statusDetails, status: "PENDING_FINANCE" } })];
    await review("FINANCE");
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(statusMutate).toHaveBeenCalled());
    expect(statusMutate.mock.calls[0][0].body.status).toBe("APPROVED");
  });

  // ClaimDetails.tsx:408 — only a lead is asked why. The backend records
  // `leadRejectedReason` and has no finance equivalent, so a reason collected
  // at the finance stage could be neither stored nor shown.
  it("asks a lead why, and sends the reason", async () => {
    await review();
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Reject" });
    expect(confirm).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText("Rejection reason"), {
      target: { value: "Receipt unreadable" },
    });
    fireEvent.click(confirm);

    await waitFor(() => expect(statusMutate).toHaveBeenCalled());
    expect(statusMutate.mock.calls[0][0].body).toEqual({
      status: "LEAD_REJECTED",
      reason: "Receipt unreadable",
    });
  });

  it("asks finance for no reason at all", async () => {
    state.claims = [claim({ statusDetails: { ...claim().statusDetails, status: "PENDING_FINANCE" } })];
    await review("FINANCE");
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByLabelText("Rejection reason")).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Reject" }));
    await waitFor(() => expect(statusMutate).toHaveBeenCalled());
    expect(statusMutate.mock.calls[0][0].body).toEqual({ status: "FINANCE_REJECTED", reason: undefined });
  });

  // The decided row is faded out while the refetch lands. The claim comes back
  // on the Approved tab under the same id, so the fade has to be forgotten when
  // the tab changes — otherwise that row renders invisible with its button
  // still focusable.
  it("does not carry the fade onto the tab the claim reappears in", async () => {
    await review();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(statusMutate).toHaveBeenCalled());
    // The mutation is mocked, so drive the success path the component would
    // have taken and come back to the queue.
    statusMutate.mock.calls[0][1].onSuccess();

    await openTab("Approved Claims");
    const row = (await screen.findByText("EXP-001")).closest("tr")!;
    expect(getComputedStyle(row).opacity).not.toBe("0");
  });

  it("offers no decision on a claim that already has one", async () => {
    show();
    await openTab("Rejected Claims");
    fireEvent.click(await screen.findByRole("button", { name: "View" }));
    await screen.findByText("EXPENSE ITEM 1");
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
    // The status chip takes their place and opens the trail instead.
    expect(screen.getByRole("button", { name: /Claim activity/ })).toBeInTheDocument();
  });
});

describe("printing", () => {
  async function reviewAs(stage: "lead" | "finance") {
    if (stage === "finance") {
      state.claims = [claim({ statusDetails: { ...claim().statusDetails, status: "PENDING_FINANCE" } })];
    }
    show(stage === "lead" ? "LEAD" : "FINANCE");
    fireEvent.click(await screen.findByRole("button", { name: "Review" }));
    return screen.findByText("EXPENSE ITEM 1");
  }

  // ClaimDetails.tsx:291 — the lead view has no print button.
  it("is offered to finance", async () => {
    await reviewAs("finance");
    expect(await screen.findByRole("button", { name: "Print claim" })).toBeEnabled();
  });

  // The stylesheet clears the page with `body > * { display: none }`, and an
  // ancestor's `display: none` cannot be undone by a rule on a descendant — so
  // a printout rendered inside the app root prints blank. It has to be a child
  // of body in its own right.
  it("renders the printout as a direct child of body", async () => {
    await reviewAs("finance");
    const printout = await waitFor(() => {
      const el = document.getElementById("expense-claim-printout");
      expect(el).not.toBeNull();
      return el!;
    });
    expect(printout.parentElement).toBe(document.body);
  });

  it("is withheld from a lead", async () => {
    await reviewAs("lead");
    expect(screen.queryByRole("button", { name: "Print claim" })).not.toBeInTheDocument();
  });

  // The source gates the button on every receipt having arrived, so a report
  // can never be produced with one missing.
  it("waits for the receipts", async () => {
    receipts.pending = true;
    await reviewAs("finance");
    expect(screen.getByRole("button", { name: "Print claim" })).toBeDisabled();
  });
});

describe("when the screen cannot be used", () => {
  it("says the backend is not connected rather than showing an empty queue", async () => {
    configured.value = false;
    show();
    expect(await screen.findByText(/isn't connected yet/)).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Pending Claims/ })).not.toBeInTheDocument();
  });

  // The menu entry is gated on the same flags, but a hidden entry is not access
  // control — the URL can be typed or bookmarked from when the role was held.
  it("turns away somebody who approves nothing", async () => {
    flags.lead = false;
    flags.finance = false;
    show("LEAD");
    expect(await screen.findByText(/aren't available for your role/)).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Pending Claims/ })).not.toBeInTheDocument();
  });
});
