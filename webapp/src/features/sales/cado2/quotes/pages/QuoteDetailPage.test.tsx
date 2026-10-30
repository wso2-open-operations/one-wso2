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

import Cado2ToastProvider from "@features/sales/cado2/components/toast/Cado2ToastProvider";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import type { DraftResponse, QuoteView } from "@features/sales/cado2/quotes/api/quoteTypes";
import type { ApprovalStep, ApprovalWorkflow } from "@features/sales/cado2/approvals/api/approvalTypes";
import { ready, submitted } from "@features/sales/cado2/quotes/testing/fixtures";
import QuoteDetailPage from "./QuoteDetailPage";

/** Opens the header's "⋯ More actions" menu, where every action but the main one is (2026-10-12). */
async function openMenu(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole("button", { name: "More actions" }));
}
const menuItems = () => screen.getAllByRole("menuitem").map((m) => m.textContent);

const query = (data: unknown) => ({ data, error: null, isPending: false, isFetching: false, refetch: vi.fn() });
const quote = query(undefined as unknown);
const versions = new Map<number, DraftResponse>();
const history = query([] as unknown);
/** Versions whose load fails, for the error cases. */
const failingVersions = new Set<number>();
const mutation = () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, error: null as Error | null });
const recall = mutation();
const revise = mutation();
const clone = mutation();
const close = mutation();
const del = mutation();

const decide = mutation();
const workflow = { data: null as ApprovalWorkflow | null, isPending: false, error: null, refetch: vi.fn() };
// The drawing needs a real browser (layout, ResizeObserver); its text companion stands in.
vi.mock("@features/sales/cado2/approvals/components/LazyApprovalDiagram", async () => ({
  default: (await import("@features/sales/cado2/approvals/components/ApprovalReasons")).default,
}));
vi.mock("@features/sales/cado2/approvals/api/useApprovalApi", () => ({
  useApprovalWorkflow: () => workflow,
  useStoredApprovalPreview: () => ({ data: undefined, isPending: false, isFetching: false, error: null }),
  useDecideStep: () => decide,
  useApproveOnBehalf: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, error: null }),
}));

const me = { data: { sub: "s", email: "approver@wso2.com", roles: [] as string[], approverRoles: ["DEAL_DESK"] as string[] } };
vi.mock("@features/sales/cado2/api/useCado2Me", async (actual) => ({
  ...(await actual<typeof import("@features/sales/cado2/api/useCado2Me")>()),
  useCado2Me: () => me,
}));

const documents = query(undefined as unknown);
const issue = { ...mutation(), mutateAsync: vi.fn() };
const attach = { ...mutation(), mutateAsync: vi.fn() };
const files = { preview: vi.fn(), download: vi.fn() };
const setPrimary = { mutate: vi.fn(), reset: vi.fn(), isPending: false, error: null };
const opportunityQuotes = { data: [] as unknown[], error: null, isPending: false, isFetching: false, refetch: vi.fn() };
// No supporting documents in the library (DGD-10); tested on their own.
vi.mock("@features/sales/cado2/quotes/api/useSupportingDocuments", async (actual) => ({
  ...(await actual<typeof import("@features/sales/cado2/quotes/api/useSupportingDocuments")>()),
  useSupportingDocumentLibrary: () => ({ data: [], isPending: false, error: null }),
  useQuoteSupportingDocuments: () => ({ data: undefined, isPending: false, error: null }),
  useSetQuoteSupportingDocuments: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, error: null }),
  useHasSupportingDocuments: () => false,
}));
vi.mock("@features/sales/cado2/quotes/api/useQuoteApi", () => ({
  useQuote: () => quote,
  useQuoteVersion: (_id: number, n: number) =>
    failingVersions.has(n) ? { ...query(undefined), error: new Error("down") } : query(versions.get(n)),
  useAuditEvents: () => history,
  useRecallVersion: () => recall,
  useReviseQuote: () => revise,
  useCloneQuote: () => clone,
  useCloseQuote: () => close,
  useSetPrimary: () => setPrimary,
  useOpportunityQuotes: () => opportunityQuotes,
  useDeleteDraft: () => del,
  useDocuments: (_q: number, _v: number, enabled: boolean) => (enabled ? documents : query(undefined)),
  useIssueOrderForm: () => issue,
  useAttachOrderForm: () => attach,
  useDocumentFiles: () => files,
}));

/** The submitted quote with every product mapped: no category chosen by the AM. */
const allMapped: DraftResponse = {
  ...submitted,
  version: { ...submitted.version, lines: submitted.version.lines.map((l) => ({ ...l, categorySource: "MAPPED" as const })) },
};

const recalledV1: DraftResponse = {
  ...submitted,
  quote: { ...submitted.quote, status: "RECALLED", actions: ["REVISE", "CLOSE"] },
  version: { ...submitted.version, status: "RECALLED" },
};

function show(q: QuoteView, ...vs: DraftResponse[]) {
  showFrom(undefined, q, ...vs);
}

/** Opens the quote page as if from another page, e.g. My Approvals. */
function showFrom(from: string | undefined, q: QuoteView, ...vs: DraftResponse[]) {
  showAt(`/sales/cado2/quotes/5/quote${from === "approvals" ? "?from=approvals" : ""}`, q, ...vs);
}

function showAt(url: string, q: QuoteView, ...vs: DraftResponse[]) {
  Object.assign(quote, { data: q });
  versions.clear();
  for (const v of vs) versions.set(v.version.versionNumber, v);
  render(
    <Cado2ToastProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="sales/cado2/quotes/:quoteId/:tab" element={<QuoteDetailPage />} />
          <Route path="sales/cado2/quotes/:quoteId/versions/:version/edit" element={<p>wizard</p>} />
          <Route path="sales/cado2/quotes" element={<p>My Quotes page</p>} />
        </Routes>
      </MemoryRouter>
    </Cado2ToastProvider>,
  );
}

beforeEach(() => {
  Object.assign(setPrimary, mutation());
  opportunityQuotes.data = [];
  Object.assign(decide, mutation());
  workflow.data = null;
  me.data.approverRoles = ["DEAL_DESK"];
  me.data.roles = [];
  Object.assign(clone, mutation());
  Object.assign(recall, mutation());
  Object.assign(revise, mutation());
  Object.assign(close, mutation());
  Object.assign(del, mutation());
  Object.assign(history, query([]));
  failingVersions.clear();
  Object.assign(opportunityQuotes, { error: null });
  Object.assign(documents, { error: null });
  Object.assign(attach, { ...mutation(), mutateAsync: vi.fn() });
});

// D68: primary is a setting of the quote, changed in any status.
describe("QuoteDetailPage — primary quote", () => {
  const oq = (quoteId: number, isPrimary: boolean, quoteNumber: string) => ({
    quoteId, quoteNumber, ownerEmail: "nimesha@wso2.com", isPrimary, status: "APPROVED", versionNumber: 1,
    currencyIsoCode: "USD", tcv: "1000.00", createdAt: "2026-10-02T08:00:00Z", updatedAt: "2026-10-02T08:00:00Z",
  });

  it("makes a quote in approval primary, releasing the current one, after asking", async () => {
    const user = userEvent.setup();
    opportunityQuotes.data = [oq(3, true, "Q-26-00031"), oq(submitted.quote.id, false, "Q-26-00005")];
    show(submitted.quote, submitted);

    const panel = screen.getByRole("region", { name: "This Opportunity's Quotes" });
    expect(within(panel).getByRole("link", { name: "Q-26-00031" })).toHaveAttribute("href", "/sales/cado2/quotes/3/quote");
    // The current quote: a shaded row, not a link, "This quote" under its number (2026-10-14).
    const rows = within(panel).getAllByRole("listitem");
    expect(rows[1]).toHaveAttribute("aria-current", "true");
    expect(within(rows[1]).queryByRole("link")).toBeNull();
    expect(rows[1]).toHaveTextContent(/Q-26-00005This quote · /);
    expect(rows[0]).not.toHaveAttribute("aria-current");

    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Make primary" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Q-26-00031 (nimesha@wso2.com) is the primary quote for this opportunity. Making this quote primary releases it.");
    await user.click(within(dialog).getByRole("button", { name: "Make primary" }));
    expect(setPrimary.mutate).toHaveBeenCalledWith({ quoteId: submitted.quote.id, primary: true }, expect.anything());
  });

  it("marks the primary quote and lets it be released", async () => {
    const user = userEvent.setup();
    show({ ...submitted.quote, isPrimary: true }, submitted);

    expect(screen.getByText("Primary")).toBeInTheDocument();
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Remove primary" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Remove primary" }));
    expect(setPrimary.mutate).toHaveBeenCalledWith({ quoteId: submitted.quote.id, primary: false }, expect.anything());
  });
});

describe("QuoteDetailPage — lifecycle", () => {
  it("goes back to My Approvals when opened from there, else to Quotes", () => {
    showFrom("approvals", submitted.quote, submitted);
    expect(screen.getByRole("link", { name: /My Approvals/ })).toHaveAttribute("href", "/sales/cado2/approvals");
    cleanup();
    show(submitted.quote, submitted);
    expect(screen.getByRole("link", { name: /Quotes/ })).toHaveAttribute("href", "/sales/cado2/quotes");
  });

  it("goes back to the Quote Report, with its filters, when opened from there", () => {
    const back = "/sales/cado2/insights/report?q=north&status=SUBMITTED";
    showAt(`/sales/cado2/quotes/5/quote?${new URLSearchParams({ from: "insights", back })}`, submitted.quote, submitted);
    expect(screen.getByRole("link", { name: /Quote Report/ })).toHaveAttribute("href", back);
    cleanup();
    // Only an Insights address is accepted as the way back.
    showAt(`/sales/cado2/quotes/5/quote?${new URLSearchParams({ from: "insights", back: "https://evil.example" })}`, submitted.quote, submitted);
    expect(screen.getByRole("link", { name: /Quotes/ })).toHaveAttribute("href", "/sales/cado2/quotes");
  });

  it("offers Recall in the menu on a submitted quote, with no main button", async () => {
    show(submitted.quote, submitted);
    const user = userEvent.setup();

    // The account is the title; the quote number sits on the line above it.
    expect(screen.getByRole("heading", { level: 1, name: /^Acme Corp/ })).toBeInTheDocument();
    expect(screen.getByText("Q-26-00005 · Version 1")).toBeInTheDocument();
    expect(screen.queryByText("Acme APIM renewal · Acme Corp")).toBeNull(); // nothing under the title
    // In approval the AM waits: no main button, the rest under "⋯".
    expect(screen.queryByRole("button", { name: "Revise" })).toBeNull();
    expect(screen.queryByRole("link", { name: /Edit draft/ })).toBeNull();
    await openMenu(user);
    expect(menuItems()).toEqual(["Recall", "Make primary"]); // no Close or Delete draft here

    await user.click(screen.getByRole("menuitem", { name: "Recall" }));
    const dialog = screen.getByRole("dialog", { name: "Recall version 1?" });
    await user.type(within(dialog).getByLabelText(/Why are you recalling it/), "Customer wants 30 gateways");
    await user.click(within(dialog).getByRole("button", { name: "Recall" }));

    expect(recall.mutate).toHaveBeenCalledWith({ quoteId: 5, version: 1, reason: "Customer wants 30 gateways" }, expect.anything());
    act(() => recall.mutate.mock.calls[0][1].onSuccess());
    expect(await screen.findByRole("status")).toHaveTextContent("Version 1 recalled");
  });

  it("revises a recalled version and opens the new draft", async () => {
    revise.mutate.mockImplementation((_vars, opts) => opts.onSuccess({ ...ready, version: { ...ready.version, versionNumber: 2 } }));
    show(recalledV1.quote, recalledV1);
    const user = userEvent.setup();

    expect(screen.getByText("Recalled")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Revise" }));
    const dialog = within(screen.getByRole("dialog", { name: "Revise to version 2?" }));
    await user.click(dialog.getByRole("button", { name: "Revise" }));

    expect(revise.mutate).toHaveBeenCalledWith({ quoteId: 5 }, expect.anything());
    expect(await screen.findByText("wizard")).toBeInTheDocument();
  });

  // D108: any AM clones the version shown into a new quote on the same opportunity.
  it("clones the version into a new draft quote", async () => {
    me.data.roles = ["SALES"];
    clone.mutate.mockImplementation((_vars, opts) => opts.onSuccess({ ...ready, quote: { ...ready.quote, id: 9 } }));
    show(submitted.quote, submitted);
    const user = userEvent.setup();

    await openMenu(user);
    expect(menuItems()).toEqual(["Recall", "Make primary", "Clone quote"]);
    await user.click(screen.getByRole("menuitem", { name: "Clone quote" }));
    const dialog = within(screen.getByRole("dialog", { name: "Clone Q-26-00005 v1?" }));
    expect(dialog.getByText(/same account and opportunity/)).toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "Clone" }));

    expect(clone.mutate).toHaveBeenCalledWith({ quoteId: 5, version: 1 }, expect.anything());
    expect(await screen.findByText("wizard")).toBeInTheDocument();
  });

  it("offers no Clone without the AM role", async () => {
    show(submitted.quote, submitted);
    await openMenu(userEvent.setup());
    expect(menuItems()).not.toContain("Clone quote");
  });

  it("needs a reason to close, and warns that it is permanent", async () => {
    show(recalledV1.quote, recalledV1);
    const user = userEvent.setup();

    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Close quote" }));
    const dialog = screen.getByRole("dialog", { name: "Close Q-26-00005?" });
    expect(within(dialog).getByText(/This is permanent/)).toBeInTheDocument();
    const confirm = within(dialog).getByRole("button", { name: "Close quote" });
    expect(confirm).toBeDisabled();

    await user.type(within(dialog).getByLabelText(/Why is the quote closing/), "Customer chose a competitor");
    await user.click(confirm);

    expect(close.mutate).toHaveBeenCalledWith({ quoteId: 5, reason: "Customer chose a competitor" }, expect.anything());
  });

  it("deletes a quote's only draft, and with it the quote", async () => {
    show(ready.quote, ready);
    const user = userEvent.setup();
    // Never submitted, so it has no number: it is named by customer and deal.
    expect(screen.getByRole("heading", { level: 1, name: /^Acme Corp/ })).toBeInTheDocument();
    expect(screen.getByText("Draft · Version 1")).toBeInTheDocument();
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Delete draft" }));
    const dialog = screen.getByRole("dialog", { name: "Delete this draft quote?" });
    expect(within(dialog).getByText(/only has a draft, so Acme Corp · Acme APIM renewal is removed completely\. This can't be undone/)).toBeInTheDocument();

    del.mutate.mockImplementation((_vars, opts) => opts.onSuccess({ quoteDeleted: true, latest: null }));
    await user.click(within(dialog).getByRole("button", { name: "Delete quote" }));
    expect(del.mutate).toHaveBeenCalledWith({ quoteId: 5, version: 1, expectedUpdatedAt: ready.version.updatedAt }, expect.anything());
    expect(await screen.findByText("My Quotes page")).toBeInTheDocument();
  });

  it("deletes a later draft, and the version before it is the latest again", async () => {
    const v2: DraftResponse = { ...ready, version: { ...ready.version, versionNumber: 2 } };
    const q: QuoteView = {
      ...ready.quote,
      versions: [
        { versionNumber: 1, status: "RECALLED", tcv: "0.00", submittedAt: null, updatedAt: "2026-09-25T09:00:00Z" },
        { versionNumber: 2, status: "DRAFT", tcv: "0.00", submittedAt: null, updatedAt: v2.version.updatedAt },
      ],
    };
    show(q, recalledV1, v2);
    const user = userEvent.setup();
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Delete draft" }));
    const dialog = screen.getByRole("dialog", { name: "Delete draft v2?" });
    expect(within(dialog).getByText(/Version 1 \(Recalled\) becomes the latest again\. This can't be undone/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Delete draft" }));
    expect(del.mutate).toHaveBeenCalledWith({ quoteId: 5, version: 2, expectedUpdatedAt: v2.version.updatedAt }, expect.anything());
    act(() => del.mutate.mock.calls[0][1].onSuccess({ quoteDeleted: false }));
    expect(await screen.findByRole("status")).toHaveTextContent("Draft v2 deleted");
  });

  it("gives a draft one main button, Edit draft, and puts the destructive actions last in the menu", async () => {
    show(ready.quote, ready);
    const user = userEvent.setup();
    expect(screen.getByRole("link", { name: "Edit draft" })).toHaveAttribute("href", "/sales/cado2/quotes/5/versions/1/edit");
    // The status is with the title, not among the actions.
    expect(within(screen.getByLabelText("About this quote")).queryByRole("button", { name: "Close quote" })).toBeNull();
    await openMenu(user);
    expect(menuItems()).toEqual(["Make primary", "Delete draft", "Close quote"]);
    expect(screen.getByRole("separator")).toBeInTheDocument(); // between everyday and destructive
  });

  it("gives an Admin (no actions) a read-only page with the whole quote", () => {
    show({ ...submitted.quote, actions: [], canEdit: false }, submitted);
    expect(screen.queryByRole("button", { name: "More actions" })).toBeNull(); // nothing to offer
    // The customer is in the page's header band, and not repeated in the deal.
    const header = screen.getByLabelText("About this quote");
    expect(within(header).getByRole("heading", { level: 1, name: /^Acme Corp/ })).toBeInTheDocument();
    expect(header).toHaveTextContent("Acme APIM renewal");
    expect(screen.queryByRole("region", { name: "Customer" })).toBeNull();
    expect(screen.getByRole("table", { name: "Products" })).toBeInTheDocument();
  });

  it("lets an approver decide their step, with a comment to send it back", async () => {
    const user = userEvent.setup();
    const step = (role: ApprovalStep["role"], roleLabel: string, over: Partial<ApprovalStep> = {}): ApprovalStep => ({
      stepId: role === "DEAL_DESK" ? 11 : 12, role, roleLabel, branches: role === "DEAL_DESK" ? [] : ["DISCOUNT"],
      dependsOn: role === "DEAL_DESK" ? [] : ["DEAL_DESK"], status: "WAITING", requestedAt: null, actedAt: null,
      actedByEmail: null, comment: null, canAct: false, cantActReason: null,
      triggers: [{ rule: "DISCOUNT", branch: "DISCOUNT", lineNumber: 1, reason: "Line 1: 10% discount is above the Account Manager's 5% limit" }],
      ...over,
    });
    workflow.data = {
      status: "IN_PROGRESS", createdAt: "2026-10-01T09:00:00Z", completedAt: null,
      steps: [
        // Waiting 26 h on a 24 h SLA.
        step("DEAL_DESK", "Deal Desk", { status: "PENDING", canAct: true, requestedAt: new Date(Date.now() - 26 * 3_600_000).toISOString(),
          dueAt: new Date(Date.now() - 2 * 3_600_000).toISOString(), slaState: "BREACHED" }),
        step("REGIONAL_DIRECTOR", "Regional Director"),
      ],
    };
    show({ ...submitted.quote, actions: [] }, submitted);

    // Approvals live on their tab only, not in the side panel (2026-10-13).
    expect(screen.queryByRole("region", { name: "Approval summary" })).toBeNull();

    await user.click(await screen.findByRole("tab", { name: "Approvals" }));
    const chain = screen.getByRole("list", { name: "Approval chain" });
    expect(within(chain).getByRole("listitem", { name: "Deal Desk" })).toHaveTextContent("Your turn");
    expect(within(chain).getByRole("listitem", { name: "Deal Desk" })).toHaveTextContent("Overdue by 2 h"); // its deadline
    expect(within(chain).getByRole("listitem", { name: "Regional Director" })).toHaveTextContent("above the Account Manager's 5% limit");

    // From another tab, the header's "Your approval" goes back to the Quote tab's panel.
    await user.click(screen.getByRole("button", { name: "Your approval" }));
    const panel = await screen.findByRole("region", { name: "Your approval as Deal Desk" });
    await user.click(within(panel).getByRole("button", { name: "Return" }));
    const dialog = screen.getByRole("dialog");
    const send = within(dialog).getByRole("button", { name: "Return" });
    expect(send).toBeDisabled();
    await user.type(within(dialog).getByRole("textbox"), "Use the FY26 price book");
    await user.click(send);
    expect(decide.mutate).toHaveBeenCalledWith(
      { quoteId: 5, version: 1, stepId: 11, outcome: "return", comment: "Use the FY26 price book" },
      expect.anything(),
    );
  });

  const reasonStep = (role: ApprovalStep["role"], stepId: number, over: Partial<ApprovalStep> = {}): ApprovalStep => ({
    stepId, role, roleLabel: role === "DEAL_DESK" ? "Deal Desk" : role, branches: ["DISCOUNT"], dependsOn: [], triggers: [],
    status: "WAITING", requestedAt: null, actedAt: null, actedByEmail: null, comment: null, canAct: false, cantActReason: null, ...over,
  });
  const because = (reason: string) => [{ rule: "DISCOUNT", branch: "DISCOUNT" as const, lineNumber: 2, reason }];

  it("tells an approver why their role is asked, and confirms each decision in place", async () => {
    const user = userEvent.setup();
    me.data.approverRoles = ["CRO", "CFO", "CEO"];
    workflow.data = {
      status: "IN_PROGRESS", createdAt: "2026-10-06T09:00:00Z", completedAt: null,
      steps: [
        reasonStep("CRO", 2, { status: "PENDING", canAct: true, triggers: because("Line 2 · WSO2 API Control Plane (APIM): 35% discount is above the Area GM's 30% limit") }),
        reasonStep("CFO", 3, { triggers: because("Line 2 · WSO2 API Control Plane (APIM): 35% discount is above the CRO's 32% limit") }),
      ],
    };
    show({ ...submitted.quote, actions: [] }, submitted);

    const panel = screen.getByRole("region", { name: "Your approval as CRO" });
    // Each reason as a row: the line and product, its group, the discount and the limit it passes.
    const reason = within(within(panel).getByRole("list", { name: "Why CRO approves" })).getByRole("listitem");
    expect(reason).toHaveTextContent("Line 2 · WSO2 API Control Plane");
    expect(within(reason).getByText("APIM")).toBeInTheDocument();
    expect(within(reason).getByText(/^35% discount/)).toBeInTheDocument();
    expect(reason).toHaveTextContent("Above the Area GM's 30% limit");
    expect(panel).not.toHaveTextContent("CRO's 32% limit"); // the CFO's reason is for the CFO
    expect(screen.getByRole("button", { name: "Return" })).toBeInTheDocument(); // short labels
    expect(screen.queryByRole("button", { name: "Reject" })).toBeNull(); // merged into Return (2026-10-12)

    await user.click(screen.getByRole("button", { name: "Approve" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Approve" }));
    const [vars, opts] = decide.mutate.mock.calls[0] as [unknown, { onSuccess: (wf: ApprovalWorkflow) => void }];
    expect(vars).toMatchObject({ quoteId: 5, version: 1, stepId: 2, outcome: "approve" });

    // Saved: CFO is the viewer's turn now; the note confirms CRO above the CFO panel.
    const after: ApprovalWorkflow = { ...workflow.data, steps: [reasonStep("CRO", 2, { status: "APPROVED" }),
      reasonStep("CFO", 3, { status: "PENDING", canAct: true, triggers: because("Line 2 · WSO2 API Control Plane (APIM): 35% discount is above the CRO's 32% limit") })] };
    workflow.data = after;
    act(() => opts.onSuccess(after));
    expect(await screen.findByRole("status")).toHaveTextContent("Approved as CRO.");
    expect(screen.getByRole("region", { name: "Your approval as CFO" })).toHaveTextContent("Above the CRO's 32% limit");
  });

  it("gives Deal Desk a summary of what's non-standard, each point once with the approvals it needs", () => {
    const line = "Line 2 · WSO2 API Control Plane (APIM): 45% discount";
    workflow.data = {
      status: "IN_PROGRESS", createdAt: "2026-10-06T09:00:00Z", completedAt: null,
      steps: [reasonStep("DEAL_DESK", 11, { status: "PENDING", canAct: true }),
        reasonStep("CRO", 12, { triggers: because(`${line} is above the Area GM's 30% limit`) }),
        reasonStep("CFO", 13, { triggers: because(`${line} is above the CRO's 40% limit`) })],
    };
    show({ ...submitted.quote, actions: [] }, allMapped);
    const panel = screen.getByRole("region", { name: "Your approval as Deal Desk" });
    // The decision is its own full-width section above the deal; the account stays the page title.
    expect(within(screen.getByRole("region", { name: "Your approval" })).getByRole("region", { name: "Your approval as Deal Desk" })).toBe(panel);
    expect(within(screen.getByRole("region", { name: "The deal" })).queryByRole("region", { name: /Your approval/ })).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: /^Acme Corp/ })).toBeInTheDocument();
    expect(panel).not.toHaveTextContent("After you"); // who approves is in the Approvals tab
    const points = within(within(panel).getByRole("list", { name: "What's non-standard" })).getAllByRole("listitem");
    expect(points).toHaveLength(1);
    expect(points[0]).toHaveTextContent("Line 2 · WSO2 API Control Plane");
    expect(points[0]).toHaveTextContent("45% discount");
    expect(points[0]).toHaveTextContent("Above the Area GM's 30% limit · needs CRO and CFO");
  });

  it("tells Deal Desk when nothing is non-standard", () => {
    workflow.data = {
      status: "IN_PROGRESS", createdAt: "2026-10-06T09:00:00Z", completedAt: null,
      steps: [reasonStep("DEAL_DESK", 11, { status: "PENDING", canAct: true })],
    };
    show({ ...submitted.quote, actions: [] }, allMapped);
    expect(screen.getByRole("region", { name: "Your approval as Deal Desk" })).toHaveTextContent(
      "Standard quote: your approval is the only one needed.",
    );
  });

  it("doesn't tell Deal Desk nothing follows when later approvals have no points to show", () => {
    workflow.data = {
      status: "IN_PROGRESS", createdAt: "2026-10-06T09:00:00Z", completedAt: null,
      steps: [reasonStep("DEAL_DESK", 11, { status: "PENDING", canAct: true }), reasonStep("CFO", 12)],
    };
    show({ ...submitted.quote, actions: [] }, allMapped);
    const panel = screen.getByRole("region", { name: "Your approval as Deal Desk" });
    expect(panel).toHaveTextContent("Further approvals follow, with no specific points recorded.");
    expect(panel).not.toHaveTextContent("your approval is the only one needed");
  });

  // The decision note is a toast now (2026-10-13), so it no longer belongs to a quote.

  it("shows an approver's first three reasons, and the rest on request", async () => {
    const user = userEvent.setup();
    me.data.approverRoles = ["LEGAL"];
    const triggers = [1, 2, 3, 4, 5].map((n) => ({ rule: "REQUIRED_REVIEW", branch: "DISCOUNT" as const, lineNumber: n,
      reason: `Line ${n} · WSO2 Identity Server (IAM): Legal reviews every IAM line` }));
    workflow.data = {
      status: "IN_PROGRESS", createdAt: "2026-10-06T09:00:00Z", completedAt: null,
      steps: [reasonStep("LEGAL", 1, { status: "PENDING", canAct: true, roleLabel: "Legal", triggers })],
    };
    show({ ...submitted.quote, actions: [] }, submitted);
    const list = () => screen.getByRole("list", { name: "Why Legal approves" });
    expect(within(list()).getAllByRole("listitem")).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "Show 2 more" }));
    expect(within(list()).getAllByRole("listitem")).toHaveLength(5);
  });

  it("keeps the header short with two open steps: each role decides in its own card", async () => {
    const user = userEvent.setup();
    me.data.approverRoles = ["LEGAL", "REGIONAL_DIRECTOR"];
    workflow.data = {
      status: "IN_PROGRESS", createdAt: "2026-10-06T09:00:00Z", completedAt: null,
      steps: [reasonStep("LEGAL", 1, { status: "PENDING", canAct: true, roleLabel: "Legal" }),
        reasonStep("REGIONAL_DIRECTOR", 2, { status: "PENDING", canAct: true, roleLabel: "Regional Director" })],
    };
    show({ ...submitted.quote, actions: [] }, submitted);

    // On the Quote tab the cards are beside the deal, so no jump button; from another tab it leads back.
    expect(screen.queryByRole("button", { name: "Your approvals (2)" })).toBeNull();
    await user.click(screen.getByRole("tab", { name: "Versions (1)" }));
    await user.click(screen.getByRole("button", { name: "Your approvals (2)" }));
    expect(screen.queryByRole("button", { name: /as Legal|as Regional Director/ })).toBeNull();
    // One short set of buttons per role, inside its card.
    const rd = screen.getByRole("region", { name: "Your approval as Regional Director" });
    await user.click(within(rd).getByRole("button", { name: "Return" }));
    expect(within(screen.getByRole("dialog")).getByRole("heading")).toHaveTextContent("Return as Regional Director?");
    await user.type(within(screen.getByRole("dialog")).getByRole("textbox"), "Too deep");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Return" }));
    expect(decide.mutate).toHaveBeenCalledWith(expect.objectContaining({ stepId: 2, outcome: "return" }), expect.anything());
  });

  it("shows a rep-chosen category on its line and in Deal Desk's summary, nowhere else", async () => {
    const user = userEvent.setup();
    const [first, ...rest] = submitted.version.lines;
    const mixed: DraftResponse = {
      ...submitted,
      version: {
        ...submitted.version,
        lines: [{ ...first, categorySource: "REP" }, ...rest.map((l) => ({ ...l, categorySource: "MAPPED" as const }))],
      },
    };
    workflow.data = {
      status: "IN_PROGRESS", createdAt: "2026-10-01T09:00:00Z", completedAt: null,
      steps: [{
        stepId: 11, role: "DEAL_DESK", roleLabel: "Deal Desk", branches: [], dependsOn: [], status: "PENDING",
        requestedAt: null, actedAt: null, actedByEmail: null, comment: null, canAct: true, cantActReason: null, triggers: [],
      }],
    };
    show({ ...submitted.quote, actions: [] }, mixed);

    // No tag on the line (D93); only a point in Deal Desk's summary.
    expect(screen.queryByText("Category chosen by AM")).toBeNull();
    const points = within(screen.getByRole("region", { name: "Your approval as Deal Desk" })).getByRole("list", { name: "What's non-standard" });
    expect(points).toHaveTextContent(`Line ${first.lineNumber} · ${first.productName}`);
    expect(points).toHaveTextContent("Category chosen by the AM");
    // Nowhere else: no warning box, and nothing in the approval dialog.
    expect(screen.queryByRole("region", { name: "Categories chosen by the AM" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(screen.getByRole("dialog")).not.toHaveTextContent(/category/i);
  });

  it("shows no category notice when every product is mapped", () => {
    const allMapped: DraftResponse = {
      ...submitted,
      version: { ...submitted.version, lines: submitted.version.lines.map((l) => ({ ...l, categorySource: "MAPPED" as const })) },
    };
    show(submitted.quote, allMapped);
    expect(screen.queryByRole("region", { name: "Categories chosen by the AM" })).toBeNull();
    expect(screen.queryByText("Category chosen by AM")).toBeNull();
  });

  it("explains a closed quote", () => {
    const closed: DraftResponse = {
      ...ready,
      quote: { ...ready.quote, status: "CLOSED", actions: [] },
      version: { ...ready.version, status: "CLOSED", closedReason: "Customer chose a competitor", closedByEmail: "rep@wso2.com", closedAt: "2026-10-05T09:00:00Z" },
    };
    show(closed.quote, closed);
    expect(screen.getAllByText("Closed").length).toBeGreaterThan(0);
    const lifecycle = screen.getByRole("list", { name: "Lifecycle" });
    expect(within(lifecycle).getByText("Quote closed")).toBeInTheDocument();
    expect(within(lifecycle).getByText("“Customer chose a competitor”")).toBeInTheDocument();
    expect(within(lifecycle).getByText(/5 Oct 2026 · rep@wso2.com/)).toBeInTheDocument();
  });
});

describe("QuoteDetailPage — versions and history", () => {
  const v2: DraftResponse = {
    ...ready,
    quote: {
      ...recalledV1.quote,
      status: "DRAFT",
      actions: ["CLOSE"],
      versions: [
        { versionNumber: 1, status: "RECALLED", tcv: "6480.00", submittedAt: "2026-10-01T09:30:00Z", updatedAt: "2026-10-02T09:30:00Z" },
        { versionNumber: 2, status: "DRAFT", tcv: "9720.00", submittedAt: null, updatedAt: "2026-10-03T09:30:00Z" },
      ],
    },
    version: { ...ready.version, versionNumber: 2, copiedFromVersion: 1, lines: [{ ...ready.version.lines[0], quantity: 30 }] },
  };

  it("lists the versions and compares the last two, changes only", async () => {
    show(v2.quote, recalledV1, v2);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Versions (2)" }));

    const table = screen.getByRole("table", { name: "Versions" });
    // The draft opens in edit mode; any other version is viewed here (2026-10-13).
    expect(within(table).getByRole("link", { name: "Edit draft" })).toHaveAttribute("href", "/sales/cado2/quotes/5/versions/2/edit");
    expect(within(table).getByRole("link", { name: "View" })).toHaveAttribute("href", "/sales/cado2/quotes/5/quote?version=1");

    const diff = screen.getByRole("table", { name: "Comparison" });
    expect(within(diff).getByText("WSO2 Gateway · Quantity")).toBeInTheDocument();
    expect(within(diff).queryByText("Currency")).toBeNull();

    await user.click(screen.getByRole("button", { name: "All fields" }));
    expect(within(screen.getByRole("table", { name: "Comparison" })).getByText("Currency")).toBeInTheDocument();
  });

  // View mode (2026-10-13): an older version is shown here, read-only, with no actions.
  it("shows an older version with a way back to the latest, and no actions", () => {
    showAt("/sales/cado2/quotes/5/quote?version=1", v2.quote, recalledV1, v2);

    expect(screen.getByText("Q-26-00005 · Version 1")).toBeInTheDocument();
    expect(screen.getByText("Recalled")).toBeInTheDocument();
    expect(screen.getByText(/You're viewing version 1\. The latest is version 2\. Clone copies this version; other actions apply to the latest\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View latest version" })).toHaveAttribute("href", "/sales/cado2/quotes/5/quote");
    expect(screen.queryByRole("button", { name: "More actions" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Edit draft" })).toBeNull();
  });

  it("ignores a version that doesn't exist and shows the latest", () => {
    showAt("/sales/cado2/quotes/5/quote?version=9", v2.quote, recalledV1, v2);

    expect(screen.getByRole("link", { name: "Edit draft" })).toBeInTheDocument();
    expect(screen.queryByText(/You're viewing version/)).toBeNull();
  });

  it("says so when there is no history yet", async () => {
    Object.assign(history, query([]));
    show(recalledV1.quote, recalledV1);
    await userEvent.setup().click(screen.getByRole("tab", { name: "History (0)" }));
    expect(screen.getByText("No history yet")).toBeInTheDocument();
  });

  it("shows the history newest first, with grouped saves and reasons", async () => {
    const e = (id: number, eventType: string, extra = {}) => ({
      id, eventType, versionNumber: 1, actorEmail: "rep@wso2.com", occurredAt: `2026-10-0${id}T09:00:00Z`,
      fromStatus: null, toStatus: null, comment: null, metadata: null, ...extra,
    });
    Object.assign(history, query([
      e(1, "QUOTE_CREATED"), e(2, "DRAFT_SAVED"), e(3, "DRAFT_SAVED"),
      e(4, "VERSION_RECALLED", { comment: "Customer wants 30 gateways" }),
    ]));
    show(recalledV1.quote, recalledV1);
    await userEvent.setup().click(screen.getByRole("tab", { name: "History (4)" }));

    const items = within(screen.getByRole("list", { name: "History" })).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Version 1 recalled");
    expect(items[0]).toHaveTextContent("“Customer wants 30 gateways”");
    expect(items[1]).toHaveTextContent("Version 1 draft saved ×2");
  });
});

describe("QuoteDetailPage — order form", () => {
  const approved: DraftResponse = {
    ...submitted,
    quote: { ...submitted.quote, status: "APPROVED", actions: ["CLOSE"] },
    version: { ...submitted.version, status: "APPROVED" },
  };
  const quoteOf = (r: DraftResponse): QuoteView => ({ ...r.quote, versions: [{ versionNumber: 1, status: r.version.status, tcv: "6480.00", submittedAt: null, updatedAt: r.version.updatedAt }] }) as unknown as QuoteView;
  const panel = () => within(screen.getByRole("region", { name: "Order Form" }));

  it("previews, then issues once, confirming the dates it will set", async () => {
    Object.assign(documents, { data: { canPreview: true, canIssue: true, issueDate: "2026-10-12", expiryDate: "2026-11-11", documents: [] } });
    issue.mutateAsync.mockResolvedValue({});
    show(quoteOf(approved), approved);
    const user = userEvent.setup();

    expect(panel().getByText(/ready to issue/)).toBeInTheDocument();
    expect(panel().getByRole("button", { name: "Preview PDF" })).toBeInTheDocument();
    await user.click(panel().getByRole("button", { name: "Issue order form" }));
    const dialog = within(screen.getByRole("dialog", { name: "Issue the order form?" }));
    expect(dialog.getByText("12 Oct 2026")).toBeInTheDocument();
    expect(dialog.getByText("11 Nov 2026")).toBeInTheDocument();
    // D122: issuing ends the chance to recall; the way out is close and clone.
    expect(dialog.getByText(/no going back/)).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Open the preview" })).toBeInTheDocument();
    expect(dialog.getByText(/close this quote and clone it/)).toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "Issue order form" }));
    expect(issue.mutateAsync).toHaveBeenCalledWith({ quoteId: approved.quote.id, version: 1 });
  });

  // D122: an approved quote can be recalled until its order form is issued.
  it("recalls an approved quote that isn't issued yet, saying only changed approvals are asked again", async () => {
    Object.assign(documents, { data: { canPreview: true, canIssue: true, issueDate: "2026-10-12", expiryDate: "2026-11-11", documents: [] } });
    const recallable = { ...approved, quote: { ...approved.quote, actions: ["RECALL", "CLOSE"] } } as DraftResponse;
    show(quoteOf(recallable), recallable);
    const user = userEvent.setup();
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Recall" }));
    const dialog = within(screen.getByRole("dialog", { name: "Recall version 1?" }));
    expect(dialog.getByText(/is approved, but its order form isn.t issued yet/)).toBeInTheDocument();
    expect(dialog.getByText(/Only the approvals your change affects are asked again/)).toBeInTheDocument();
  });

  it("offers the issued file for download", () => {
    Object.assign(documents, {
      data: {
        canPreview: false, canIssue: false, issueDate: "2026-10-13", expiryDate: "2026-11-12",
        documents: [{ id: 9, documentNumber: 1, documentType: "ORDER_FORM", layout: "DIRECT", status: "ACTIVE", fileName: "Q-26-00005-v1-d1.pdf",
          sizeBytes: 70000, sha256: "a".repeat(64), issueDate: "2026-10-12", expiryDate: "2026-11-11", generatedAt: "2026-10-12T09:00:00Z", generatedByEmail: "rep@wso2.com" }],
      },
    });
    show(quoteOf(approved), approved);
    expect(panel().getByText("Issued 12 Oct 2026")).toBeInTheDocument();
    expect(panel().getByRole("button", { name: "Download PDF" })).toBeInTheDocument();
    expect(panel().queryByRole("button", { name: "Issue order form" })).toBeNull();
  });

  // D111: the primary quote's order form on its Salesforce opportunity.
  const issued = (extra: object) => ({
    data: {
      canPreview: false, canIssue: false, issueDate: "2026-10-13", expiryDate: "2026-11-12",
      documents: [{ id: 9, documentNumber: 1, documentType: "ORDER_FORM", layout: "DIRECT", status: "ACTIVE", fileName: "Q-26-00005-v1-d1.pdf",
        sizeBytes: 70000, sha256: "a".repeat(64), issueDate: "2026-10-12", expiryDate: "2026-11-11", generatedAt: "2026-10-12T09:00:00Z",
        generatedByEmail: "rep@wso2.com", salesforceStatus: "", salesforceAt: null, canAttach: false, ...extra }],
    },
  });

  it("says the order form is attached to Salesforce, or was replaced there", () => {
    Object.assign(documents, issued({ salesforceStatus: "ATTACHED", salesforceAt: "2026-10-12T09:01:00Z" }));
    show(quoteOf(approved), approved);
    expect(panel().getByText(/^Attached to Salesforce · /)).toBeInTheDocument();
  });

  it("says when another quote's order form replaced it in Salesforce", () => {
    Object.assign(documents, issued({ salesforceStatus: "REMOVED", salesforceAt: "2026-10-14T09:01:00Z" }));
    show(quoteOf(approved), approved);
    expect(panel().getByText(/another quote's order form replaced it/)).toBeInTheDocument();
  });

  it("retries a failed attach", async () => {
    Object.assign(documents, issued({ salesforceStatus: "NOT_ATTACHED", canAttach: true }));
    attach.mutateAsync.mockResolvedValue({});
    show(quoteOf(approved), approved);

    expect(panel().getByText("Not attached to Salesforce")).toBeInTheDocument();
    await userEvent.setup().click(panel().getByRole("button", { name: "Retry" }));
    expect(attach.mutateAsync).toHaveBeenCalledWith({ quoteId: approved.quote.id, documentId: 9 });
    expect(await screen.findByRole("status")).toHaveTextContent("Order form attached to Salesforce");
  });

  it("says nothing about Salesforce for a secondary quote", () => {
    Object.assign(documents, issued({}));
    show(quoteOf(approved), approved);
    expect(panel().queryByText(/Salesforce/)).toBeNull();
  });

  it("says a failed issue in the shared error notice, with what failed", async () => {
    Object.assign(documents, { data: { canPreview: true, canIssue: true, issueDate: "2026-10-12", expiryDate: "2026-11-11", documents: [] } });
    issue.mutateAsync.mockRejectedValue(new Error("down"));
    show(quoteOf(approved), approved);
    const user = userEvent.setup();

    await user.click(panel().getByRole("button", { name: "Issue order form" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Issue order form" }));
    // findBy on screen: the page is aria-hidden until the dialog's closing transition ends.
    expect(await screen.findByText(/Couldn't issue the order form\./)).toBeInTheDocument();
  });

  it("shows no order form before approval", () => {
    show(quoteOf(submitted), submitted);
    expect(screen.queryByRole("region", { name: "Order Form" })).toBeNull();
  });
});

// A failed load is an error on screen, never a wrong answer or a missing card (2026-10-13).
describe("QuoteDetailPage — load errors say so", () => {
  const v2: DraftResponse = { ...ready, version: { ...ready.version, versionNumber: 2 } };
  const twoVersions: QuoteView = {
    ...ready.quote,
    versions: [
      { versionNumber: 1, status: "RECALLED", tcv: "0.00", submittedAt: null, updatedAt: "2026-10-02T09:30:00Z" },
      { versionNumber: 2, status: "DRAFT", tcv: "0.00", submittedAt: null, updatedAt: "2026-10-03T09:30:00Z" },
    ],
  };

  it("says Compare couldn't load, not 'No differences.'", async () => {
    failingVersions.add(1);
    show(twoVersions, submitted, v2);
    await userEvent.setup().click(screen.getByRole("tab", { name: "Versions (2)" }));
    expect(screen.getByText(/^Couldn't load the versions to compare\./)).toBeInTheDocument();
    expect(screen.queryByText("No differences.")).toBeNull();
  });

  it("says when this opportunity's quotes or the history couldn't load", () => {
    Object.assign(opportunityQuotes, { error: new Error("down") });
    Object.assign(history, { ...query(undefined), error: new Error("down") });
    show(submitted.quote, submitted);
    expect(screen.getByText(/^Couldn't load this opportunity's quotes\./)).toBeInTheDocument();
    expect(screen.getByText(/this timeline may be incomplete/)).toBeInTheDocument();
  });

  it("says when an approved quote's order form couldn't load", () => {
    const approved: DraftResponse = {
      ...submitted,
      quote: { ...submitted.quote, status: "APPROVED", actions: ["CLOSE"] },
      version: { ...submitted.version, status: "APPROVED" },
    };
    Object.assign(documents, { data: undefined, error: new Error("down") });
    show({ ...approved.quote, versions: [{ versionNumber: 1, status: "APPROVED", tcv: "6480.00", submittedAt: null, updatedAt: approved.version.updatedAt }] } as unknown as QuoteView, approved);
    expect(screen.getByText(/^Couldn't load the order form\./)).toBeInTheDocument();
  });
});
