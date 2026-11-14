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
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { HttpError } from "@api/http";
import { draft, ready, submitted } from "@features/sales/cado2/quotes/testing/fixtures";
import { scrollMainToTop } from "@features/sales/cado2/utils/scroll";
import QuoteWizardPage from "./QuoteWizardPage";

const idle = () => ({ data: [] as unknown, error: null, isPending: false, isFetching: false, isError: false, refetch: vi.fn() });
const version = { ...idle(), data: undefined as unknown, isPending: true };
const pricing = { ...idle(), data: undefined as unknown };
const mutation = () => ({ mutateAsync: vi.fn(), reset: vi.fn(), isPending: false, isSuccess: false, error: null as unknown });
const save = mutation();
const submit = mutation();
const sync = mutation();
// What a sync would change (D138); set per test.
const syncPreview = { ...idle(), data: undefined as unknown };
const deleteDraft = { mutate: vi.fn(), reset: vi.fn(), isPending: false, error: null };
// D173: refreshing from Salesforce, and the differences read from the menu.
const refresh = mutation();
const sfChanges = { ...idle(), data: undefined as unknown };

// Mocked so the wizard is tested without Asgardeo, the network or window.config.
// The drawing needs a real browser (layout, ResizeObserver); its text companion stands in.
vi.mock("@features/sales/cado2/approvals/components/LazyApprovalDiagram", async () => ({
  default: (await import("@features/sales/cado2/approvals/components/ApprovalReasons")).default,
}));
// No supporting documents in the library (DGD-10); tested on their own.
vi.mock("@features/sales/cado2/quotes/api/useSupportingDocuments", async (actual) => ({
  ...(await actual<typeof import("@features/sales/cado2/quotes/api/useSupportingDocuments")>()),
  useSupportingDocumentLibrary: () => ({ data: [], isPending: false, error: null }),
  useQuoteSupportingDocuments: () => ({ data: undefined, isPending: false, error: null }),
  useSetQuoteSupportingDocuments: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, error: null }),
  useHasSupportingDocuments: () => false,
}));
vi.mock("@features/sales/cado2/quotes/api/useQuoteApi", () => {
  return {
    MIN_ACCOUNT_SEARCH: 3,
    useAccountSearch: () => idle(),
    useOpportunityQuotes: () => idle(),
    useAccountOpportunities: () => idle(),
    useOpportunityContacts: () => idle(),
    usePreviousOpportunityLines: () => [],
    useOpportunityState: () => idle(),
    useProducts: () => idle(),
    usePricebooks: () => ({
      ...idle(),
      data: [
        { id: "01sASIA0000000001A", name: "Asia Price Book (Current)", current: true },
        { id: "01sUSD00000000001A", name: "USD Price Book (Current)", current: true },
        { id: "01sUSD20250000001A", name: "USD Price Book (2025)", current: false },
      ],
    }),
    useCurrencies: () => ({ ...idle(), data: ["USD", "GBP"] }),
    useActiveLegalEntities: () => ({ ...idle(), data: [{ id: 1, code: "WSO2_LLC", name: "WSO2, LLC.", country: "USA" }] }),
    // The legal texts: the partner role names its agreement.
    useLegalConfig: () => ({
      ...idle(),
      data: {
        texts: { TERMS_ONPREM_DIRECT: "Direct terms.", TERMS_ONPREM_PARTNER: "Partner terms.", TERMS_SAAS_DIRECT: "SaaS.", TERMS_SAAS_PARTNER: "SaaS (partner)." },
        notices: [],
      },
    }),
    useQuoteSettings: () => ({ ...idle(), data: { validityDays: 30 } }),
    useProductsByIds: () => ({ ...idle(), data: [] }),
    usePricingFormulas: () => ({ ...idle(), data: [] }),
    usePricingPreview: () => pricing,
    useQuoteVersion: () => version,
    useSaveDraft: () => save,
    useSubmitVersion: () => submit,
    useSyncToSalesforce: () => sync,
    useSyncPreview: () => syncPreview,
    useDeleteDraft: () => deleteDraft,
    useRefreshFromSalesforce: () => refresh,
    useSalesforceChanges: () => sfChanges,
  };
});

const approvals = { data: undefined as unknown, isFetching: false, error: null };
vi.mock("@features/sales/cado2/utils/scroll", () => ({ scrollMainToTop: vi.fn() }));
vi.mock("@features/sales/cado2/approvals/api/useApprovalApi", () => ({ useApprovalPreview: () => approvals }));

function renderWizard() {
  return render(
    <Cado2ToastProvider>
      <MemoryRouter initialEntries={["/sales/quickquote/quotes/5/versions/1/edit"]}>
        <Routes>
          <Route path="sales/quickquote/quotes/:quoteId/versions/:version/edit" element={<QuoteWizardPage />} />
        </Routes>
      </MemoryRouter>
    </Cado2ToastProvider>,
  );
}

/** The wizard, with a stand-in quote page that shows the URL it landed on. */
function renderAt() {
  return render(
    <Cado2ToastProvider>
      <MemoryRouter initialEntries={["/sales/quickquote/quotes/5/versions/1/edit"]}>
        <Routes>
          <Route path="sales/quickquote/quotes/:quoteId/versions/:version/edit" element={<QuoteWizardPage />} />
          <Route path="sales/quickquote/quotes/:quoteId/:tab" element={<LandedOn />} />
        </Routes>
      </MemoryRouter>
    </Cado2ToastProvider>,
  );
}

function LandedOn() {
  const at = useLocation();
  return <p>{`quote page ${at.pathname}${at.search}`}</p>;
}

beforeEach(() => {
  sessionStorage.clear();
  approvals.data = undefined;
  Object.assign(pricing, { data: undefined, isFetching: false });
  Object.assign(version, { data: draft, isPending: false, error: null, refetch: vi.fn() });
  Object.assign(save, mutation());
  Object.assign(submit, mutation());
  Object.assign(sync, mutation());
  Object.assign(syncPreview, { data: undefined, isPending: false, error: null });
});

describe("QuoteWizardPage — drafts", () => {
  it("loads a saved draft with its open issues", () => {
    renderWizard();

    // Edit mode (2026-10-13): marked "Editing", the quote page's identity, a way back.
    expect(screen.getByText("Editing")).toBeInTheDocument();
    expect(screen.getByText("Draft · Version 1")).toBeInTheDocument(); // a draft: no number yet
    expect(screen.getByRole("heading", { level: 1, name: "Acme Corp" })).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to quote/ })).toHaveAttribute("href", "/sales/quickquote/quotes/5/quote");
    const summary = within(screen.getByRole("complementary", { name: "Quote summary" }));
    expect(summary.getByText("Acme Corp")).toBeInTheDocument();
    expect(summary.getByText("Acme APIM renewal")).toBeInTheDocument();
    expect(screen.queryByText("Unsaved changes")).toBeNull();
    // The draft has no contact, legal entity or products: it opens at Overview, the rest locked.
    const steps = within(screen.getByRole("navigation", { name: "Quote steps" }));
    expect(steps.getByRole("button", { name: "Overview" })).toHaveAttribute("aria-current", "step");
    expect(steps.getByRole("button", { name: "Products & Pricing" })).toBeDisabled();
    expect(steps.getByRole("button", { name: "Review" })).toBeDisabled();
    expect(screen.getByRole("heading", { level: 2, name: "Overview" })).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 5")).toBeInTheDocument();
    expect(screen.queryByText(/to fix/)).toBeNull(); // the steps enforce what is required; no issue list
  });

  it("saves against the version it loaded (optimistic lock)", async () => {
    save.mutateAsync.mockResolvedValue(draft);
    renderWizard();

    await userEvent.setup().click(screen.getByRole("button", { name: "Save draft" }));

    expect(save.mutateAsync).toHaveBeenCalledTimes(1);
    const [vars] = save.mutateAsync.mock.calls[0];
    expect(vars).toMatchObject({ quoteId: 5, version: 1 });
    expect(vars.input).toMatchObject({
      sfAccountId: "001000000000001",
      sfOpportunityId: "006000000000001",
      expectedUpdatedAt: "2026-09-25T10:00:00.123Z",
      currencyIsoCode: "USD",
    });
  });

  it("offers to reload when the draft changed elsewhere (409)", async () => {
    save.mutateAsync.mockRejectedValue(new HttpError("u", 409, '{"message":"changed"}'));
    renderWizard();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Save draft" }));

    expect(await screen.findByText("This draft changed elsewhere")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reload latest" }));
    expect(version.refetch).toHaveBeenCalled();
  });

  it("shows the fields the backend rejected (422)", async () => {
    const body = { message: "invalid", issues: [{ field: "upliftPercent", message: "Use 0 to 100" }] };
    save.mutateAsync.mockRejectedValue(new HttpError("u", 422, JSON.stringify(body)));
    renderWizard();

    await userEvent.setup().click(screen.getByRole("button", { name: "Save draft" }));

    expect(await screen.findByText(/The draft wasn't saved/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Overview: Use 0 to 100" })).toBeInTheDocument();
  });
});

describe("QuoteWizardPage — review and submit", () => {
  async function openReview() {
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Review" }));
    return user;
  }

  it("is filled in order: Next unlocks only when the step is complete", () => {
    renderWizard();

    const next = screen.getByRole("button", { name: "Next: Products & Pricing →" });
    expect(next).toBeDisabled();
    expect(screen.getByText("To continue: Choose the WSO2 legal entity")).toBeInTheDocument();
    expect(within(screen.getByRole("navigation", { name: "Quote steps" })).getByRole("button", { name: "Review" })).toBeDisabled();
  });

  it("applies the server's pricing rules before Next, e.g. a minimum quantity", async () => {
    Object.assign(version, { data: ready });
    Object.assign(pricing, {
      data: { kind: "problems", issues: [{ field: "lines[0].quantity", message: "The minimum quantity for WSO2 Gateway is 50" }] },
    });
    renderWizard();

    // The pricing problem makes Products & Pricing the furthest reachable step.
    expect(
      await screen.findByText("To continue: The minimum quantity for WSO2 Gateway is 50", undefined, { timeout: 2000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Products & Pricing" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next: Commercials →" })).toBeDisabled();
    expect(within(screen.getByRole("navigation", { name: "Quote steps" })).getByRole("button", { name: "Commercials" })).toBeDisabled();
  });

  it("reopens a saved draft at its first incomplete step", () => {
    const noBilling = { ...ready, version: { ...ready.version, contacts: ready.version.contacts.filter((c) => c.role !== "BILLING") } };
    Object.assign(version, { data: noBilling });
    renderWizard();

    const steps = within(screen.getByRole("navigation", { name: "Quote steps" }));
    expect(steps.getByRole("button", { name: "Commercials" })).toHaveAttribute("aria-current", "step");
    expect(steps.getByRole("button", { name: "Overview" })).toHaveTextContent("Done");
    expect(steps.getByRole("button", { name: "Review" })).toBeDisabled();
    expect(screen.getByText("To continue: Choose the billing contact")).toBeInTheDocument();
  });

  it("previews the approvals in a dialog before Review, and not on Review", async () => {
    const noBilling = { ...ready, version: { ...ready.version, contacts: ready.version.contacts.filter((c) => c.role !== "BILLING") } };
    Object.assign(version, { data: noBilling });
    approvals.data = {
      steps: [
        {
          stepId: null, role: "DEAL_DESK", roleLabel: "Deal Desk", branches: [], dependsOn: [], status: null, requestedAt: null,
          actedAt: null, actedByEmail: null, comment: null, canAct: false, cantActReason: null,
          triggers: [{ rule: "DEAL_DESK_REVIEW", branch: "ROOT", lineNumber: 0, reason: "Deal Desk reviews every quote" }],
        },
      ],
      blockers: [], pending: [], notes: [], invalid: [],
    };
    renderWizard();
    const user = userEvent.setup();
    const summary = within(screen.getByRole("complementary", { name: "Quote summary" }));
    await user.click(summary.getByRole("button", { name: "Preview approvals" }));
    const dialog = within(screen.getByRole("dialog", { name: "Who approves if you submit now" }));
    expect(dialog.getByRole("listitem", { name: "Deal Desk" })).toHaveTextContent("Deal Desk reviews every quote");
    await user.click(dialog.getByRole("button", { name: "Close" }));
    expect(await screen.findByRole("button", { name: "Preview approvals" })).toBeInTheDocument();
  });

  it("moves on with Next once a step is complete, and back freely", async () => {
    Object.assign(version, { data: ready });
    renderWizard();
    const user = userEvent.setup();
    // A complete draft opens on Review; go back to the start, then forward again.
    await user.click(screen.getByRole("button", { name: "Overview" }));
    const scrolls = vi.mocked(scrollMainToTop).mock.calls.length;
    await user.click(screen.getByRole("button", { name: "Next: Products & Pricing →" }));
    expect(screen.getByRole("heading", { level: 2, name: "Products & Pricing" })).toBeInTheDocument();
    // A new step starts at the top, not where the last one was scrolled to.
    expect(vi.mocked(scrollMainToTop).mock.calls.length).toBe(scrolls + 1);
    await user.click(screen.getByRole("button", { name: "← Back" }));
    expect(screen.getByRole("heading", { level: 2, name: "Overview" })).toBeInTheDocument();
    // Nothing changed, so nothing was saved.
    expect(save.mutateAsync).not.toHaveBeenCalled();
  });

  it("shows the opportunity's price book locked, and adds products only from it", async () => {
    const book = { id: "01sUSD00000000001A", name: "USD Price Book (Current)" };
    Object.assign(version, { data: { ...ready, version: { ...ready.version, defaultPricebook: book } } });
    renderWizard();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Products & Pricing" }));

    const field = screen.getByRole("textbox", { name: "Price book" });
    expect(field).toHaveValue("USD Price Book (Current)");
    expect(field).toHaveAttribute("readonly");
    expect(screen.queryByRole("listbox", { name: "Price books" })).toBeNull(); // nothing to choose
    expect(screen.queryByText("Different price book")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Add product to Year 1" })[0]).toBeEnabled();
  });

  // 2026-10-09: one price book (the opportunity's), named; not "the USD price books".
  it("names the one price book products come from", async () => {
    const book = { id: "01sUSD00000000001A", name: "USD Price Book (Current)" };
    Object.assign(version, { data: { ...ready, version: { ...ready.version, defaultPricebook: book, lines: [] } } });
    renderWizard();
    await userEvent.setup().click(screen.getByRole("button", { name: "Products & Pricing" }));
    expect(
      screen.getByText("No products yet. Add them from USD Price Book (Current)."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/price books/)).toBeNull();
  });

  it("can't add products without a price book from the opportunity", async () => {
    Object.assign(version, { data: { ...ready, version: { ...ready.version, defaultPricebook: null } } });
    renderWizard();
    await userEvent.setup().click(screen.getByRole("button", { name: "Products & Pricing" }));
    expect(screen.getByRole("textbox", { name: "Price book" })).toHaveValue("—");
    expect(screen.getAllByRole("button", { name: "Add product to Year 1" })[0]).toBeDisabled();
  });

  it("reviews the stored numbers in one view, as an order form with the deal figures", async () => {
    Object.assign(version, { data: ready });
    const step = (role: string, roleLabel: string, reason: string) => ({
      stepId: null, role, roleLabel, branches: role === "DEAL_DESK" ? [] : ["DISCOUNT"], dependsOn: [],
      triggers: [{ rule: "X", branch: "DISCOUNT", lineNumber: 1, reason }], status: null, requestedAt: null, actedAt: null,
      actedByEmail: null, comment: null, canAct: false, cantActReason: null,
    });
    approvals.data = {
      steps: [step("DEAL_DESK", "Deal Desk", "Deal Desk reviews every quote"), step("REGIONAL_DIRECTOR", "Regional Director", "10% discount")],
      blockers: [], pending: [], notes: [], invalid: [],
    };
    renderWizard();
    await openReview();
    // The summary stays beside it, with the account and opportunity (C1, 2026-10-14).
    expect(screen.getByRole("complementary", { name: "Quote summary" })).toBeInTheDocument();

    const products = screen.getByRole("table", { name: "Products" });
    expect(within(products).getByText("WSO2 Gateway")).toBeInTheDocument();
    // The line, the subscription subtotal and the Year 1 total; the total order value closes the card (D97).
    expect(within(products).getAllByText("6,480.00")).toHaveLength(3);
    expect(screen.getByRole("region", { name: "Order totals" })).toHaveTextContent("6,480.00");
    expect(within(products).getByText("10%")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Deal Figures" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Internal view" })).toBeNull();
    expect(within(screen.getByRole("region", { name: "Deal" })).getByText("WSO2, LLC.")).toBeInTheDocument();
    // The live approval chain, inline above the sheet; no preview button on Review.
    expect(screen.queryByRole("button", { name: "Preview approvals" })).toBeNull();
    const chain = within(screen.getByRole("region", { name: "Who Approves If You Submit Now" }));
    expect(chain.getByText("Who Approves If You Submit Now")).toBeInTheDocument();
    expect(chain.getByRole("listitem", { name: "Regional Director" })).toHaveTextContent("10% discount");
  });

  it("confirms with the expiry date, submits what was reviewed, and lands on the quote page", async () => {
    Object.assign(version, { data: ready });
    submit.mutateAsync.mockResolvedValue(submitted);
    renderAt();
    const user = await openReview();

    await user.click(screen.getByRole("button", { name: "Submit version 1" }));
    const dialog = await screen.findByRole("dialog", { name: "Submit version 1?" });
    // The expiry starts when the order form is issued, not at submission.
    expect(within(dialog).getByText(/its 30-day expiry starts then/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/saved first/)).toBeNull();

    await user.click(within(dialog).getByRole("button", { name: "Submit" }));

    expect(save.mutateAsync).not.toHaveBeenCalled();
    expect(submit.mutateAsync).toHaveBeenCalledWith({ quoteId: 5, version: 1, expectedUpdatedAt: "2026-09-25T10:00:00.123Z" });
    expect(await screen.findByText("quote page /sales/quickquote/quotes/5/quote")).toBeInTheDocument();
    expect(await screen.findByRole("status")).toHaveTextContent("Version 1 submitted for approval");
  });

  it("saves the changes when moving to another step, then submits the saved copy", async () => {
    Object.assign(version, { data: ready });
    const resaved = { ...ready, version: { ...ready.version, poNumber: "PO-9", updatedAt: "2026-09-25T11:00:00.000Z" } };
    // Like the real hook, a save writes the version cache.
    save.mutateAsync.mockImplementation(async () => (version.data = resaved));
    submit.mutateAsync.mockResolvedValue(submitted);
    renderWizard();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Commercials" }));
    await user.type(screen.getByLabelText("PO number (optional)"), "PO-9");
    await user.click(screen.getByRole("button", { name: "Review" }));

    expect(save.mutateAsync).toHaveBeenCalledTimes(1);
    expect(save.mutateAsync.mock.calls[0][0].input).toMatchObject({ poNumber: "PO-9" });
    // Moving between steps saves without a toast; only Save draft says so (2026-10-13).
    expect(await screen.findByRole("heading", { level: 2, name: "Review" })).toBeInTheDocument();
    expect(screen.queryByText("Draft saved")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Submit version 1" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByText("Your unsaved changes will be saved first.")).toBeNull();
    await user.click(within(dialog).getByRole("button", { name: "Submit" }));

    expect(save.mutateAsync).toHaveBeenCalledTimes(1);
    expect(submit.mutateAsync).toHaveBeenCalledWith({ quoteId: 5, version: 1, expectedUpdatedAt: "2026-09-25T11:00:00.000Z" });
  });

  it("saves on Back too, and stays on the step when the save fails", async () => {
    Object.assign(version, { data: ready });
    save.mutateAsync.mockRejectedValue(new Error("network down"));
    renderWizard();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Commercials" }));
    await user.type(screen.getByLabelText("PO number (optional)"), "PO-9");
    await user.click(screen.getByRole("button", { name: "← Back" }));

    expect(save.mutateAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { level: 2, name: "Commercials" })).toBeInTheDocument();
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("lists what blocked the submission (422)", async () => {
    Object.assign(version, { data: ready });
    const body = { message: "not ready", issues: [{ field: "lines[0].quantity", message: "The minimum quantity for WSO2 Gateway is 50" }] };
    submit.mutateAsync.mockRejectedValue(new HttpError("u", 422, JSON.stringify(body)));
    renderWizard();
    const user = await openReview();

    await user.click(screen.getByRole("button", { name: "Submit version 1" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Submit" }));

    expect(await screen.findByText(/The version wasn't submitted/)).toBeInTheDocument();
    // findBy: the page is aria-hidden until the dialog's closing transition ends.
    expect(await screen.findByRole("button", { name: /Products & Pricing: The minimum quantity/ })).toBeInTheDocument();
  });

  // D173: Salesforce changed since the draft took its details.
  it("stops a submit when Salesforce changed, lists the changes, and refreshes after confirming", async () => {
    Object.assign(version, { data: ready });
    const region = { group: "ACCOUNT", subject: "", field: "Sales region", before: "NA", after: "EU", effect: "Changes the regional approvers" };
    const body = { code: "SALESFORCE_CHANGED", message: "changed", salesforceChanges: { changes: [region], problems: [] } };
    submit.mutateAsync.mockRejectedValue(new HttpError("u", 409, JSON.stringify(body)));
    refresh.mutateAsync.mockResolvedValue({ ...(ready as object), changes: [region] });
    renderWizard();
    const user = await openReview();

    await user.click(screen.getByRole("button", { name: "Submit version 1" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Submit" }));

    const dialog = within(await screen.findByRole("dialog", { name: "Salesforce has changed since this quote was prepared" }));
    expect(dialog.getByText(/Not submitted\./)).toBeInTheDocument();
    expect(dialog.getByText("Sales region")).toBeInTheDocument();
    expect(dialog.getByText("Changes the regional approvers")).toBeInTheDocument();
    expect(refresh.mutateAsync).not.toHaveBeenCalled();

    await user.click(dialog.getByRole("button", { name: "Refresh from Salesforce" }));
    expect(refresh.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ expectedUpdatedAt: expect.any(String) }));
    expect(await screen.findByText(/Refreshed from Salesforce · 1 change taken/)).toBeInTheDocument();
    expect(screen.getByText("Sales region: NA → EU")).toBeInTheDocument();
  });

  it("refreshes from the Actions menu, and says when everything matches", async () => {
    Object.assign(version, { data: ready });
    Object.assign(sfChanges, { data: { changes: [], problems: [] } });
    renderWizard();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: /Refresh from Salesforce/ }));

    const dialog = within(await screen.findByRole("dialog", { name: "Everything matches Salesforce" }));
    expect(dialog.getByText(/Nothing to refresh/)).toBeInTheDocument();
    expect(dialog.queryByRole("button", { name: "Refresh from Salesforce" })).toBeNull();
    Object.assign(sfChanges, { data: undefined });
  });

  // The wizard only edits (2026-10-13): anything else is viewed on the quote page.
  it("sends a submitted version to the quote page", () => {
    Object.assign(version, { data: submitted });
    renderAt();

    expect(screen.getByText("quote page /sales/quickquote/quotes/5/quote")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save draft" })).toBeNull();
  });

  it("sends an older version to the quote page, on that version", () => {
    const older = { ...submitted.version, versionNumber: 1 };
    Object.assign(version, {
      data: {
        ...submitted,
        version: older,
        quote: { ...submitted.quote, versions: [...submitted.quote.versions, { ...submitted.quote.versions[0], versionNumber: 2 }] },
      },
    });
    renderAt();

    expect(screen.getByText("quote page /sales/quickquote/quotes/5/quote?version=1")).toBeInTheDocument();
  });
});

describe("QuoteWizardPage — new quote", () => {
  it("shows one status label and asks for the account first", () => {
    Object.assign(version, { data: undefined, isPending: false });
    render(
      <MemoryRouter initialEntries={["/sales/quickquote/quotes/new"]}>
        <Routes>
          <Route path="sales/quickquote/quotes/new" element={<QuoteWizardPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "New Quote" })).toBeInTheDocument();
    expect(screen.getByText("Editing")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Quotes/ })).toHaveAttribute("href", "/sales/quickquote/quotes");
    expect(screen.queryByText(/Start by choosing/)).toBeNull(); // no hint in the title
    expect(screen.getByText("Choose the Salesforce account this quote is for.")).toBeInTheDocument();
    expect(screen.getByText("Not saved yet")).toBeInTheDocument();
    expect(screen.queryByText("Unsaved changes")).toBeNull();
    expect(screen.getByRole("combobox", { name: /Account/ })).toBeInTheDocument();
    // Only the account search at first: everything else waits for the account and the deal.
    expect(screen.queryByRole("radiogroup", { name: "Opportunity" })).toBeNull();
    for (const section of ["Renewal", "WSO2 Legal Entity", "Start date"]) {
      expect(screen.queryByRole("region", { name: section })).toBeNull();
    }
  });
});

// "It worked" is a toast that goes away (2026-10-13).
describe("QuoteWizardPage — toasts", () => {
  it("says Draft saved after Save draft", async () => {
    save.mutateAsync.mockResolvedValue(draft);
    renderWizard();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Draft saved");
  });
});

describe("QuoteWizardPage — delete a draft", () => {
  it("offers Delete draft on a saved draft, and asks first", async () => {
    Object.assign(version, { data: draft, isPending: false });
    renderWizard();
    const user = userEvent.setup();
    // One main button; the rest under "⋯", Delete draft last (2026-10-13).
    expect(screen.getByRole("button", { name: "Save draft" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.getAllByRole("menuitem").map((m) => m.textContent)).toEqual(["Refresh from Salesforce", "Delete draft"]);
    await user.click(screen.getByRole("menuitem", { name: "Delete draft" }));
    expect(screen.getByRole("dialog", { name: "Delete this draft quote?" })).toBeInTheDocument();
  });

  it("has no Delete draft before the first save, or on a submitted version", () => {
    Object.assign(version, { data: undefined, isPending: false });
    render(
      <MemoryRouter initialEntries={["/sales/quickquote/quotes/new"]}>
        <Routes>
          <Route path="sales/quickquote/quotes/new" element={<QuoteWizardPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByRole("button", { name: "Delete draft" })).toBeNull();
  });
});

describe("QuoteWizardPage — lifecycle", () => {
  it("sends a recalled version to the quote page", () => {
    Object.assign(version, { data: { ...submitted, version: { ...submitted.version, status: "RECALLED" } } });
    renderAt();

    expect(screen.getByText("quote page /sales/quickquote/quotes/5/quote")).toBeInTheDocument();
  });

  it("says where a revised draft was copied from", () => {
    Object.assign(version, { data: { ...ready, version: { ...ready.version, versionNumber: 2, copiedFromVersion: 1 } } });
    renderWizard();

    expect(screen.getByText(/Copied from version 1/)).toBeInTheDocument();
  });

  // D108: a fresh clone opens at Overview, saying where it came from.
  it("opens a clone at Overview, saying where it came from", () => {
    Object.assign(version, { data: ready });
    render(
      <Cado2ToastProvider>
        <MemoryRouter initialEntries={[{ pathname: "/sales/quickquote/quotes/5/versions/1/edit", state: { clonedFrom: "Q-26-00003 v2" } }]}>
          <Routes>
            <Route path="sales/quickquote/quotes/:quoteId/versions/:version/edit" element={<QuoteWizardPage />} />
          </Routes>
        </MemoryRouter>
      </Cado2ToastProvider>,
    );

    expect(screen.getByText(/Cloned from Q-26-00003 v2, with its prices/)).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 5")).toBeInTheDocument();
  });

  it("returns to the quote page from Back to quote", async () => {
    renderAt();
    await userEvent.setup().click(screen.getByRole("link", { name: /Back to quote/ }));
    expect(await screen.findByText(/^quote page/)).toBeInTheDocument();
  });
});

// Unsaved changes are never kept aside to offer back (removed 2026-10-12):
// moving between steps saves the draft, and Back to quote asks first.
describe("QuoteWizardPage — unsaved changes when leaving", () => {
  it("keeps nothing aside when the wizard is left with unsaved edits, and offers nothing back", async () => {
    Object.assign(version, { data: ready });
    const view = renderWizard();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Commercials/ }));
    await user.type(await screen.findByLabelText(/PO number/), "PO-77");

    act(() => void window.dispatchEvent(new Event("pagehide")));
    view.unmount();
    expect(sessionStorage.length).toBe(0);

    renderWizard();
    expect(screen.queryByText(/You left this draft with unsaved changes/)).toBeNull();
  });

  it("asks before Back to quote throws unsaved edits away", async () => {
    Object.assign(version, { data: ready });
    renderAt();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Commercials/ }));
    await user.type(await screen.findByLabelText(/PO number/), "PO-79");

    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    await user.click(screen.getByRole("link", { name: /Back to quote/ }));
    expect(confirm).toHaveBeenCalledWith("You have unsaved changes. Leave without saving?");
    expect(screen.queryByText(/^quote page/)).toBeNull();

    confirm.mockReturnValueOnce(true);
    await user.click(screen.getByRole("link", { name: /Back to quote/ }));
    expect(await screen.findByText(/^quote page/)).toBeInTheDocument();
    confirm.mockRestore();
  });
});

// D77: the primary quote's "Sync to Salesforce" on Products & Pricing.
// D141: the justification is written on Review, just above Submit; required
// with a discount (D58), optional otherwise.
describe("QuoteWizardPage — justification", () => {
  it("is asked for on Review, and holds Submit while a discounted quote has none", async () => {
    Object.assign(version, { data: { ...ready, version: { ...ready.version, justification: null } } });
    const user = userEvent.setup();
    renderWizard();
    await user.click(screen.getByRole("button", { name: "Review" }));
    const field = screen.getByRole("textbox", { name: /^Justification/ });
    expect(field).toBeRequired();
    // Written here, so the sheet above doesn't show a second, read-only copy.
    expect(screen.queryByText("None given")).toBeNull();
    expect(screen.getByText(/Required: a line has a discount/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit version 1" })).toBeDisabled();
    expect(screen.getByText("Write the justification first")).toBeInTheDocument();

    await user.type(field, "Competitive deal");
    expect(screen.getByRole("button", { name: "Submit version 1" })).toBeEnabled();
  });
});

describe("QuoteWizardPage — Salesforce sync", () => {
  const primary = { ...ready, quote: { ...ready.quote, isPrimary: true, canSync: true, syncSwitchOn: true, sfSyncedAt: null } };
  // What a sync would change (D138): the subscription end, one product changed, one removed.
  const changes = {
    opportunityName: "Acme renewal",
    currency: "USD",
    opportunity: [{ field: "subsEndDate", before: "2027-10-31", after: "2028-10-31", changed: true }],
    products: [
      { productName: "API Manager", change: "CHANGED", fields: [{ field: "salesPrice", before: "25000.00", after: "30000.00", changed: true }] },
      { productName: "Identity Server", change: "REMOVED", fields: [] },
      { productName: "Micro Integrator", change: "UNCHANGED", fields: [] },
    ],
    changes: 3,
  };

  async function openTermAndProducts() {
    const user = userEvent.setup();
    renderWizard();
    await user.click(screen.getByRole("button", { name: "Products & Pricing" }));
    return user;
  }

  // D137: a button of its own beside Save draft, with when it was last synced.
  it("shows what changes in Salesforce, then syncs the saved primary draft", async () => {
    Object.assign(version, { data: primary });
    syncPreview.data = changes;
    sync.mutateAsync.mockResolvedValue({
      ...primary,
      quote: { ...primary.quote, sfSyncedAt: "2026-10-13T10:42:00Z", sfSyncedByEmail: "rep@wso2.com", sfSyncedVersion: 1 },
    });
    const user = await openTermAndProducts();
    expect(screen.getByText("Not synced yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sync to Salesforce" })).toHaveTextContent("Sync to SF");
    await user.click(screen.getByRole("button", { name: "Sync to Salesforce" }));

    const dialog = within(screen.getByRole("dialog", { name: "Sync to Salesforce?" }));
    expect(dialog.getByText("Subscription end")).toBeInTheDocument();
    expect(dialog.getByText("31 Oct 2027")).toBeInTheDocument();
    expect(dialog.getByText("31 Oct 2028")).toBeInTheDocument();
    expect(dialog.getByText("API Manager")).toBeInTheDocument();
    expect(dialog.getByText("USD 25,000.00")).toBeInTheDocument();
    expect(dialog.getByText("Not on the quote")).toBeInTheDocument();
    expect(dialog.queryByText("Micro Integrator")).toBeNull();
    await user.click(dialog.getByRole("button", { name: "1 product with no change" }));
    expect(dialog.getByText("Micro Integrator")).toBeInTheDocument();
    expect(sync.mutateAsync).not.toHaveBeenCalled();
    await user.click(dialog.getByRole("button", { name: "Sync 3 changes" }));

    expect(save.mutateAsync).not.toHaveBeenCalled(); // nothing changed: nothing to save first
    expect(sync.mutateAsync).toHaveBeenCalledWith({ quoteId: primary.quote.id, version: 1, expectedUpdatedAt: primary.version.updatedAt });
    expect(await screen.findByRole("status")).toHaveTextContent("Synced to Salesforce"); // a toast
  });

  // 2026-11-08: a preview refused with a reason shows the reason, not "couldn't read".
  it("says what to fix when Salesforce can't be synced yet", async () => {
    Object.assign(version, { data: primary });
    Object.assign(syncPreview, {
      error: new HttpError(
        "/quotes/5/versions/1/sync/preview",
        422,
        JSON.stringify({ message: "This version can't be submitted yet", issues: [{ field: "lines", message: "Add products before syncing to Salesforce" }] }),
      ),
    });
    const user = await openTermAndProducts();
    await user.click(screen.getByRole("button", { name: "Sync to Salesforce" }));

    const dialog = within(screen.getByRole("dialog", { name: "Sync to Salesforce?" }));
    expect(dialog.getByText("Add products before syncing to Salesforce.")).toBeInTheDocument();
    expect(dialog.queryByText(/Couldn't read/)).toBeNull();
    expect(dialog.getByRole("button", { name: "Sync" })).toBeDisabled();
  });

  it("syncs nothing when the AM cancels, or when nothing would change", async () => {
    Object.assign(version, { data: primary });
    syncPreview.data = changes;
    const user = await openTermAndProducts();
    await user.click(screen.getByRole("button", { name: "Sync to Salesforce" }));
    await user.click(within(screen.getByRole("dialog", { name: "Sync to Salesforce?" })).getByRole("button", { name: "Cancel" }));
    expect(sync.mutateAsync).not.toHaveBeenCalled();

    syncPreview.data = { ...changes, opportunity: [], products: [], changes: 0 };
    await user.click(await screen.findByRole("button", { name: "Sync to Salesforce" }));
    const dialog = within(screen.getByRole("dialog", { name: "Sync to Salesforce?" }));
    expect(dialog.getByText(/Salesforce already matches this quote/)).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Sync" })).toBeDisabled();
  });

  it("is greyed on a quote that isn't primary, saying why; absent with the sync off", async () => {
    Object.assign(version, { data: { ...ready, quote: { ...ready.quote, syncSwitchOn: true, canSync: false } } });
    await openTermAndProducts();
    expect(screen.getByRole("button", { name: "Sync to Salesforce" })).toBeDisabled();
    expect(screen.getByText("Only the primary quote syncs. Mark it primary on Overview.")).toBeInTheDocument();
  });

  // 2026-11-08: nothing to sync on Overview; greyed until the quote has products.
  it("isn't on Overview, and waits for products, saying so", async () => {
    Object.assign(version, { data: { ...primary, version: { ...primary.version, lines: [] } } });
    const user = userEvent.setup();
    renderWizard();
    await user.click(screen.getByRole("button", { name: "Overview" }));
    expect(screen.queryByRole("button", { name: "Sync to Salesforce" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Products & Pricing" }));
    expect(screen.getByRole("button", { name: "Sync to Salesforce" })).toBeDisabled();
    expect(screen.getByText("Add products first")).toBeInTheDocument();
  });

  it("isn't offered when the sync is switched off", async () => {
    Object.assign(version, { data: ready });
    await openTermAndProducts();
    expect(screen.queryByRole("button", { name: "Sync to Salesforce" })).toBeNull();
  });

  it("says why when Salesforce refuses, and that nothing changed there", async () => {
    Object.assign(version, { data: primary });
    syncPreview.data = changes;
    const body = {
      message: "Salesforce refused the sync, so nothing was changed there",
      issues: [{ field: "salesforce", message: "Closed Won opportunities can't be edited" }],
    };
    sync.mutateAsync.mockRejectedValue(new HttpError("u", 422, JSON.stringify(body)));
    const user = await openTermAndProducts();

    await user.click(screen.getByRole("button", { name: "Sync to Salesforce" }));
    await user.click(within(screen.getByRole("dialog", { name: "Sync to Salesforce?" })).getByRole("button", { name: "Sync 3 changes" }));

    expect(await screen.findByText(/Salesforce refused the sync, so nothing changed there:/)).toBeInTheDocument();
    expect(screen.getAllByText(/Closed Won opportunities can't be edited/).length).toBeGreaterThan(0);
  });

  // D138: the submit dialog of a primary quote says it syncs, with the changes folded.
  it("says in the submit dialog that submitting updates Salesforce", async () => {
    Object.assign(version, { data: primary });
    syncPreview.data = changes;
    const user = userEvent.setup();
    renderWizard();
    await user.click(screen.getByRole("button", { name: "Review" }));
    await user.click(screen.getByRole("button", { name: "Submit version 1" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Submit version 1?" }));
    expect(dialog.getByText(/Submitting also updates the Salesforce opportunity: 3 changes/)).toBeInTheDocument();
    expect(dialog.queryByText("Identity Server")).toBeNull();
    await user.click(dialog.getByRole("button", { name: "See changes" }));
    expect(dialog.getByText("Identity Server")).toBeInTheDocument();
  });
});
