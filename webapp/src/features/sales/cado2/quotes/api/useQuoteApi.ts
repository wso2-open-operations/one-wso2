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

import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { authedGet } from "@api/http";
import { cado2Pdf, cado2Send } from "@features/sales/cado2/api/cado2Http";
import { problemOf } from "./errors";
import { httpRetry } from "@api/errors";
import { cado2ServiceUrls } from "@config/apiConfig";
import { useCado2Basis } from "@features/sales/cado2/api/cado2Basis";
import { DEFAULT_SORT, type QuoteSort } from "@features/sales/cado2/quotes/list/quoteListModel";
import type {
  Account,
  LegalConfig,
  ActiveLegalEntity,
  Contact,
  DeleteDraftResult,
  DocumentsView,
  DocumentView,
  DraftInput,
  DraftResponse,
  Issue,
  Opportunity,
  OpportunityLines,
  OpportunityState,
  OpportunityQuote,
  PricebookOption,
  SyncPreview,
  PricingFormula,
  PricingPreview,
  Product,
  AuditEvent,
  QuoteList,
  QuoteScope,
  QuoteSettings,
  QuoteView,
  RefreshFromSalesforceResponse,
  SalesforceChanges,
} from "./quoteTypes";

/** Account search needs at least this many characters (backend rule). */
export const MIN_ACCOUNT_SEARCH = 3;

// Lookups change rarely during a session; five minutes avoids re-fetching
// every time the rep moves between steps.
const LOOKUP_STALE_MS = 5 * 60 * 1000;

/**
 * How fresh a query must be:
 * - "lookup": reference data; cached for five minutes, and (the app default)
 *   not re-fetched when a page opens.
 * - "live": quote data; re-fetched every time a page opens. A quote changes
 *   as soon as it is saved, submitted or recalled on another screen, and the
 *   app-wide `refetchOnMount: false` would otherwise keep showing the copy
 *   from before (found 2026-09-25: a submitted quote still showed as Draft).
 */
type Freshness = "lookup" | "live";

function useAuthedQuery<T>(
  parts: readonly unknown[],
  url: string | null,
  freshness: Freshness = "lookup",
): UseQueryResult<T, Error> {
  const { getToken, ready, key } = useCado2Basis();
  return useQuery<T, Error>({
    queryKey: key(...parts),
    queryFn: async () => authedGet<T>(url as string, await getToken()),
    enabled: ready && url !== null,
    // Set only for live data: an explicit `refetchOnMount: undefined` would
    // override the app default rather than fall back to it.
    ...(freshness === "live" ? { staleTime: 0, refetchOnMount: "always" as const } : { staleTime: LOOKUP_STALE_MS }),
    retry: httpRetry,
  });
}

/** Accounts whose name contains `term` (off below 3 characters). */
export function useAccountSearch(term: string) {
  const t = term.trim();
  return useAuthedQuery<Account[]>(["accounts", t], t.length >= MIN_ACCOUNT_SEARCH ? cado2ServiceUrls.accounts(t) : null);
}

/** Open opportunities to quote (the default), or closed-won ones for a renewal to renew. */
export function useAccountOpportunities(accountId: string | null, status: "open" | "won" = "open") {
  return useAuthedQuery<Opportunity[]>(
    ["account-opportunities", accountId, status],
    accountId ? cado2ServiceUrls.accountOpportunities(accountId, status) : null,
  );
}

/** The contacts on the opportunity in Salesforce (D124; was the account's, D22). */
export function useOpportunityContacts(opportunityId: string | null) {
  return useAuthedQuery<Contact[]>(
    ["opportunity-contacts", opportunityId],
    opportunityId ? cado2ServiceUrls.opportunityContacts(opportunityId) : null,
  );
}

/** Whether the opportunity is still open in Salesforce (D164), read fresh while `enabled`. */
export function useOpportunityState(opportunityId: string | null, enabled: boolean) {
  return useAuthedQuery<OpportunityState>(
    ["opportunity-state", opportunityId],
    enabled && opportunityId ? cado2ServiceUrls.opportunityState(opportunityId) : null,
    "live",
  );
}

/**
 * The previous opportunities' product lines as they are in Salesforce now
 * (D159), one query per opportunity, in the order given: read fresh while
 * `enabled`.
 */
export function usePreviousOpportunityLines(opportunityIds: readonly string[], enabled: boolean) {
  const { getToken, ready, key } = useCado2Basis();
  return useQueries({
    queries: opportunityIds.map((id) => ({
      queryKey: key("opportunity-lines", id),
      queryFn: async () => authedGet<OpportunityLines>(cado2ServiceUrls.opportunityLines(id), await getToken()),
      enabled: ready && enabled,
      staleTime: 0,
      refetchOnMount: "always" as const,
      retry: httpRetry,
    })),
  });
}

/** How many products one page of the Add-line list loads. */
export const PRODUCT_PAGE = 50;

/** The legal texts quotes use: standard terms and notices. */
export function useLegalConfig() {
  const { getToken, ready, key } = useCado2Basis();
  return useQuery<LegalConfig, Error>({
    queryKey: key("legal-config"),
    queryFn: async () => authedGet<LegalConfig>(cado2ServiceUrls.legalConfig, await getToken()),
    enabled: ready,
    staleTime: LOOKUP_STALE_MS,
    retry: httpRetry,
  });
}

/** Legal writes the non-standard terms (and may override the special terms, D139) during their approval. */
export function useWriteLegalTerms(quoteId: number, versionNumber: number) {
  const { getToken, key } = useCado2Basis();
  const queryClient = useQueryClient();
  return useMutation<DraftResponse, Error, { onPremTerms?: string; saasTerms?: string; specialTerms?: string }>({
    mutationFn: async (body) =>
      cado2Send<DraftResponse>("PUT", cado2ServiceUrls.legalTerms(quoteId, versionNumber), await getToken(), body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key() }),
  });
}

/** Deal Desk writes the special terms during its approval (D128); blank clears them. */
export function useWriteSpecialTerms(quoteId: number, versionNumber: number) {
  const { getToken, key } = useCado2Basis();
  const queryClient = useQueryClient();
  return useMutation<DraftResponse, Error, { specialTerms: string }>({
    mutationFn: async (body) =>
      cado2Send<DraftResponse>("PUT", cado2ServiceUrls.specialTerms(quoteId, versionNumber), await getToken(), body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key() }),
  });
}

/**
 * Particular products of the quote's price book, each with that book's price
 * only: the support plans' (D155). Idle until there are ids.
 */
export function useProductsByIds(ids: readonly string[], currency: string, pricebookId: string) {
  const { getToken, ready, key } = useCado2Basis();
  return useQuery<Product[], Error>({
    queryKey: key("products-by-ids", [...ids].sort().join(","), currency, pricebookId),
    queryFn: async () => authedGet<Product[]>(cado2ServiceUrls.productsByIds(currency, pricebookId, ids), await getToken()),
    enabled: ready && ids.length > 0 && Boolean(currency && pricebookId),
    staleTime: LOOKUP_STALE_MS,
    retry: httpRetry,
  });
}

/**
 * The products of the quote's price book (the opportunity's), by name,
 * a page at a time, each with that book's price only. A page shorter
 * than PRODUCT_PAGE is the last one.
 */
export function useProducts(currency: string, term: string, pricebookId: string) {
  const t = term.trim();
  const { getToken, ready, key } = useCado2Basis();
  return useInfiniteQuery<Product[], Error, Product[], readonly unknown[], number>({
    queryKey: key("products", currency, t, pricebookId),
    queryFn: async ({ pageParam }) =>
      authedGet<Product[]>(
        cado2ServiceUrls.products(currency, t, { pricebookId, limit: PRODUCT_PAGE, offset: pageParam }),
        await getToken(),
      ),
    initialPageParam: 0,
    // The backend pages up to offset 2000 (Salesforce's cap).
    getNextPageParam: (last, pages) =>
      last.length < PRODUCT_PAGE || pages.length * PRODUCT_PAGE > 2000 ? undefined : pages.length * PRODUCT_PAGE,
    select: (data) => data.pages.flat(),
    enabled: ready && currency !== "" && pricebookId !== "",
    staleTime: LOOKUP_STALE_MS,
    retry: httpRetry,
  });
}

/** The price books with prices in the currency, for the quote's price book. */
export function usePricebooks(currency: string) {
  return useAuthedQuery<PricebookOption[]>(["pricebooks", currency], currency ? cado2ServiceUrls.pricebooks(currency) : null);
}

/** The quote currencies: those Salesforce's price books price in (D143). Read when enabled. */
export function useCurrencies(enabled = true) {
  return useAuthedQuery<string[]>(["currencies"], enabled ? cado2ServiceUrls.currencies : null);
}

/** The quote rules shown ahead of time, e.g. the validity period. */
export function useQuoteSettings() {
  return useAuthedQuery<QuoteSettings>(["quote-settings"], cado2ServiceUrls.quoteSettings);
}

export function useActiveLegalEntities() {
  return useAuthedQuery<ActiveLegalEntity[]>(["legal-entities", "active"], cado2ServiceUrls.legalEntities(true));
}

/**
 * Every product's pricing formula (D81), by product Id: a formula product's
 * line is priced by it, with no discount. Key: "pricing-formulas", which an
 * Admin's save invalidates.
 */
export function usePricingFormulas(): UseQueryResult<PricingFormula[], Error> {
  return useAuthedQuery<PricingFormula[]>(["pricing-formulas"], cado2ServiceUrls.pricingFormulas);
}

/** Rows on a page of the Quotes list (D148). */
export const QUOTE_PAGE = 50;
/** Accounts on a page of the tree, each with all its quotes (D148). */
export const ACCOUNT_PAGE = 20;

export interface QuoteListQuery {
  readonly search?: string;
  readonly sort?: QuoteSort;
  /** Page accounts, each with all its quotes, instead of quotes (the tree). */
  readonly byAccount?: boolean;
  /** From 0. */
  readonly page?: number;
  readonly limit?: number;
}

/**
 * A page of the Quotes list (D70): the caller's quotes or everyone's,
 * searched, sorted and paged by the backend (D148): by quote, or by account
 * for the tree, so an account never splits across pages. The previous page
 * stays on screen while the next loads.
 */
export function useQuoteList(scope: QuoteScope = "mine", query: QuoteListQuery = {}) {
  const { getToken, ready, key } = useCado2Basis();
  const byAccount = query.byAccount ?? false;
  const limit = query.limit ?? (byAccount ? ACCOUNT_PAGE : QUOTE_PAGE);
  const sort = query.sort ?? DEFAULT_SORT;
  const url = cado2ServiceUrls.quoteList({
    scope,
    q: query.search?.trim() ?? "",
    sort: sort.key,
    order: sort.dir,
    byAccount,
    limit,
    offset: (query.page ?? 0) * limit,
  });
  return useQuery<QuoteList, Error>({
    queryKey: key("quotes", "list", url),
    queryFn: async () => authedGet<QuoteList>(url, await getToken()),
    enabled: ready,
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchOnMount: "always",
    retry: httpRetry,
  });
}

/** A quote with its version list and the caller's actions. */
export function useQuote(quoteId: number | null) {
  return useAuthedQuery<QuoteView>(["quotes", "one", quoteId], quoteId ? cado2ServiceUrls.quote(quoteId) : null, "live");
}

/**
 * The quotes on an opportunity, oldest first, with which is primary (D68).
 * Under the "quotes" key, so any quote change refreshes it.
 */
export function useOpportunityQuotes(opportunityId: string | null) {
  return useAuthedQuery<OpportunityQuote[]>(
    ["quotes", "opportunity", opportunityId],
    opportunityId ? cado2ServiceUrls.opportunityQuotes(opportunityId) : null,
    "live",
  );
}

/**
 * Makes a quote its opportunity's primary quote, releasing the current one, or
 * releases it (D68). A setting of the quote: any status, approvals untouched.
 */
export function useSetPrimary() {
  const { getToken, key } = useCado2Basis();
  const queryClient = useQueryClient();
  return useMutation<QuoteView, Error, { quoteId: number; primary: boolean }>({
    mutationFn: async ({ quoteId, primary }) =>
      cado2Send<QuoteView>("POST", cado2ServiceUrls.quotePrimary(quoteId), await getToken(), { primary }),
    onSuccess: (q) => {
      void queryClient.invalidateQueries({ queryKey: key("quotes") });
      void queryClient.invalidateQueries({ queryKey: key("quote-version", q.id) });
    },
  });
}

/** A quote's history, oldest first. */
export function useAuditEvents(quoteId: number | null) {
  return useAuthedQuery<AuditEvent[]>(["quotes", "history", quoteId], quoteId ? cado2ServiceUrls.quoteAuditEvents(quoteId) : null, "live");
}

export function useQuoteVersion(quoteId: number | null, version: number | null) {
  return useAuthedQuery<DraftResponse>(
    ["quote-version", quoteId, version],
    quoteId && version ? cado2ServiceUrls.quoteVersion(quoteId, version) : null,
    "live",
  );
}

/** Outcome of a live preview: priced, or the problems that stop pricing. */
export type PreviewResult =
  { kind: "priced"; preview: PricingPreview } | { kind: "problems"; issues: readonly Issue[] };

/**
 * Live pricing for the summary panel. `body` is null until there is enough
 * to price (term, currency, billing, at least one line). Keeps the previous
 * result while a new one loads so the numbers don't flicker.
 */
export function usePricingPreview(body: unknown | null) {
  const { getToken, ready, key } = useCado2Basis();
  return useQuery<PreviewResult, Error>({
    queryKey: key("pricing-preview", body),
    queryFn: async () => {
      try {
        const preview = await cado2Send<PricingPreview>("POST", cado2ServiceUrls.pricingPreview, await getToken(), body);
        return { kind: "priced", preview };
      } catch (err) {
        const problem = problemOf(err);
        if (problem) return { kind: "problems", issues: problem.issues };
        throw err;
      }
    },
    enabled: ready && body !== null,
    placeholderData: keepPreviousData,
    retry: httpRetry,
  });
}

/** Creates the quote (first save) or saves the draft. */
export function useSaveDraft() {
  const { getToken, key } = useCado2Basis();
  const queryClient = useQueryClient();
  return useMutation<DraftResponse, Error, { quoteId: number | null; version: number | null; input: DraftInput }>({
    mutationFn: async ({ quoteId, version, input }) =>
      quoteId && version
        ? cado2Send<DraftResponse>("PUT", cado2ServiceUrls.quoteVersion(quoteId, version), await getToken(), input)
        : cado2Send<DraftResponse>("POST", cado2ServiceUrls.quotes, await getToken(), input),
    onSuccess: (res) => {
      queryClient.setQueryData(key("quote-version", res.quote.id, res.version.versionNumber), res);
      void queryClient.invalidateQueries({ queryKey: key("quotes") });
    },
  });
}

/**
 * The lifecycle actions. Each answers with the affected version, which
 * is cached; the quote, the lists and the history are refetched.
 */
function useLifecycleAction<V>(send: (vars: V, token: string) => Promise<DraftResponse>) {
  const { getToken, key } = useCado2Basis();
  const queryClient = useQueryClient();
  return useMutation<DraftResponse, Error, V>({
    mutationFn: async (vars) => send(vars, await getToken()),
    onSuccess: (res) => {
      queryClient.setQueryData(key("quote-version", res.quote.id, res.version.versionNumber), res);
      void queryClient.invalidateQueries({ queryKey: key("quotes") });
      void queryClient.invalidateQueries({ queryKey: key("quote-version", res.quote.id) });
    },
  });
}

export function useRecallVersion() {
  return useLifecycleAction<{ quoteId: number; version: number; reason: string }>(({ quoteId, version, reason }, token) =>
    cado2Send<DraftResponse>("POST", cado2ServiceUrls.quoteRecall(quoteId, version), token, reason.trim() ? { reason } : {}),
  );
}

export function useReviseQuote() {
  return useLifecycleAction<{ quoteId: number }>(({ quoteId }, token) =>
    cado2Send<DraftResponse>("POST", cado2ServiceUrls.quoteRevise(quoteId), token, {}),
  );
}

/** Clones a version into a new quote on the same opportunity (D108). */
export function useCloneQuote() {
  return useLifecycleAction<{ quoteId: number; version: number }>(({ quoteId, version }, token) =>
    cado2Send<DraftResponse>("POST", cado2ServiceUrls.quoteClone(quoteId, version), token, {}),
  );
}

/**
 * Deletes the latest version while it is a draft. With no other
 * version the quote goes too; otherwise the previous version is cached as the latest.
 */
export function useDeleteDraft() {
  const { getToken, key } = useCado2Basis();
  const queryClient = useQueryClient();
  return useMutation<DeleteDraftResult, Error, { quoteId: number; version: number; expectedUpdatedAt: string }>({
    mutationFn: async ({ quoteId, version, expectedUpdatedAt }) =>
      cado2Send<DeleteDraftResult>("DELETE", cado2ServiceUrls.quoteVersion(quoteId, version), await getToken(), { expectedUpdatedAt }),
    onSuccess: (res, { quoteId, version }) => {
      queryClient.removeQueries({ queryKey: key("quote-version", quoteId, version) });
      if (res.latest) {
        queryClient.setQueryData(key("quote-version", quoteId, res.latest.version.versionNumber), res.latest);
      } else {
        queryClient.removeQueries({ queryKey: key("quotes", "one", quoteId) });
        queryClient.removeQueries({ queryKey: key("quotes", "history", quoteId) });
      }
      void queryClient.invalidateQueries({ queryKey: key("quotes") });
    },
  });
}

export function useCloseQuote() {
  return useLifecycleAction<{ quoteId: number; reason: string }>(({ quoteId, reason }, token) =>
    cado2Send<DraftResponse>("POST", cado2ServiceUrls.quoteClose(quoteId), token, { reason }),
  );
}

/** Submits a draft version, freezing it. */
export function useSubmitVersion() {
  const { getToken, key } = useCado2Basis();
  const queryClient = useQueryClient();
  return useMutation<DraftResponse, Error, { quoteId: number; version: number; expectedUpdatedAt: string }>({
    mutationFn: async ({ quoteId, version, expectedUpdatedAt }) =>
      cado2Send<DraftResponse>("POST", cado2ServiceUrls.quoteSubmit(quoteId, version), await getToken(), { expectedUpdatedAt }),
    onSuccess: (res) => {
      queryClient.setQueryData(key("quote-version", res.quote.id, res.version.versionNumber), res);
      void queryClient.invalidateQueries({ queryKey: key("quotes") });
    },
  });
}

/** What syncing a saved draft would change on its opportunity (D138); read live, when enabled. */
export function useSyncPreview(quoteId: number | null, version: number | null, enabled: boolean) {
  return useAuthedQuery<SyncPreview>(
    ["sync-preview", quoteId, version],
    enabled && quoteId !== null && version !== null ? cado2ServiceUrls.quoteSyncPreview(quoteId, version) : null,
    "live",
  );
}

/** How Salesforce differs from a saved draft (D173); read live, when enabled. */
export function useSalesforceChanges(quoteId: number | null, version: number | null, enabled: boolean) {
  return useAuthedQuery<SalesforceChanges>(
    ["salesforce-changes", quoteId, version],
    enabled && quoteId !== null && version !== null ? cado2ServiceUrls.quoteSalesforceChanges(quoteId, version) : null,
    "live",
  );
}

/** "Refresh from Salesforce" (D173): saves the draft with Salesforce's values. */
export function useRefreshFromSalesforce() {
  const { getToken, key } = useCado2Basis();
  const queryClient = useQueryClient();
  return useMutation<RefreshFromSalesforceResponse, Error, { quoteId: number; version: number; expectedUpdatedAt: string }>({
    mutationFn: async ({ quoteId, version, expectedUpdatedAt }) =>
      cado2Send<RefreshFromSalesforceResponse>("POST", cado2ServiceUrls.quoteRefreshFromSalesforce(quoteId, version), await getToken(), {
        expectedUpdatedAt,
      }),
    onSuccess: (res) => {
      queryClient.setQueryData(key("quote-version", res.quote.id, res.version.versionNumber), res);
      void queryClient.invalidateQueries({ queryKey: key("quotes") });
      void queryClient.invalidateQueries({ queryKey: key("salesforce-changes") });
    },
  });
}

/** "Sync to Salesforce" (D77): writes a saved draft of the primary quote to its opportunity. */
export function useSyncToSalesforce() {
  const { getToken, key } = useCado2Basis();
  const queryClient = useQueryClient();
  return useMutation<DraftResponse, Error, { quoteId: number; version: number; expectedUpdatedAt: string }>({
    mutationFn: async ({ quoteId, version, expectedUpdatedAt }) =>
      cado2Send<DraftResponse>("POST", cado2ServiceUrls.quoteSync(quoteId, version), await getToken(), { expectedUpdatedAt }),
    onSuccess: (res) => {
      queryClient.setQueryData(key("quote-version", res.quote.id, res.version.versionNumber), res);
      void queryClient.invalidateQueries({ queryKey: key("quotes") });
    },
  });
}

// ---------------------------------------------------------------------------
// Order form documents
// ---------------------------------------------------------------------------

/** A version's documents and whether the order form can be previewed or issued. */
export function useDocuments(quoteId: number | null, version: number | null, enabled: boolean) {
  return useAuthedQuery<DocumentsView>(
    ["quotes", "documents", quoteId, version],
    enabled && quoteId && version ? cado2ServiceUrls.quoteDocuments(quoteId, version) : null,
    "live",
  );
}

/** Issues the order form: the PDF is produced and stored, and the expiry starts. */
export function useIssueOrderForm() {
  const { getToken, key } = useCado2Basis();
  const queryClient = useQueryClient();
  return useMutation<DocumentView, Error, { quoteId: number; version: number }>({
    mutationFn: async ({ quoteId, version }) =>
      cado2Send<DocumentView>("POST", cado2ServiceUrls.quoteDocuments(quoteId, version), await getToken(), {}),
    onSuccess: (_, { quoteId, version }) => {
      void queryClient.invalidateQueries({ queryKey: key("quotes") });
      void queryClient.invalidateQueries({ queryKey: key("quote-version", quoteId, version) });
    },
  });
}

/** Retries attaching the primary quote's order form to its Salesforce opportunity (D111). */
export function useAttachOrderForm() {
  const { getToken, key } = useCado2Basis();
  const queryClient = useQueryClient();
  return useMutation<DocumentView, Error, { quoteId: number; documentId: number }>({
    mutationFn: async ({ quoteId, documentId }) =>
      cado2Send<DocumentView>("POST", cado2ServiceUrls.quoteDocumentAttach(quoteId, documentId), await getToken(), {}),
    onSuccess: (_, { quoteId }) => {
      void queryClient.invalidateQueries({ queryKey: key("quotes", "documents", quoteId) });
      void queryClient.invalidateQueries({ queryKey: key("quotes", "history", quoteId) });
    },
  });
}

/** Fetches the preview PDF (never stored) and issued PDFs, as Blobs. */
export function useDocumentFiles() {
  const { getToken } = useCado2Basis();
  return {
    preview: async (quoteId: number, version: number) =>
      cado2Pdf("POST", cado2ServiceUrls.quoteOrderFormPreview(quoteId, version), await getToken()),
    download: async (quoteId: number, documentId: number) =>
      cado2Pdf("GET", cado2ServiceUrls.quoteDocumentFile(quoteId, documentId), await getToken()),
  };
}
