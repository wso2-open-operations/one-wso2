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

import type { VisibilityAnswer } from "@components/side-rail/visibilityFold";
import {
  isCcBackendConfigured,
  isExpenseBackendConfigured,
  isFinanceMasterDataBackendConfigured,
  isOpdBackendConfigured,
} from "@config/apiConfig";
import { FINANCE_APPS } from "@constants/financeApps";
import {
  masterDataHasAccess,
  useMasterDataUserInfo,
  type MasterDataUserInfo,
} from "../masterdata/useMasterDataAccess";
import { useCcUserInfo } from "../cc/useCc";
import { ccHasAccess } from "../cc/ccTypes";
import { useOpdUserInfo } from "../opd/useOpd";
import { OPD_ROLE, opdHasRole } from "../opd/opdTypes";
import { useExpenseAppData } from "../expense/useExpense";

// Items that declare `requires` in the registry but aren't explicitly mapped
// below must fail CLOSED — otherwise a renamed or newly-added restricted item
// would silently become visible to everyone. Per-user items (no `requires`)
// stay open.
const RESTRICTED_IDS = new Set(
  FINANCE_APPS.flatMap((app) => app.items)
    .filter((it) => it.requires && it.requires.length > 0)
    .map((it) => it.id),
);

/**
 * Whether Master Data is open to this reader.
 *
 * Takes the master-data backend's own `/user-info` rather than the portal's
 * capability set. It used to be `caps.has("admin")` — people-app privilege
 * 999 — which was the only signal available while this backend's `/user-info`
 * returned nothing but an email and an avatar. That made it wrong in both
 * directions: 999 is the portal's GENERIC administrator privilege, so a
 * portal admin saw all four rail rows and was then refused by the backend
 * (which gates on the `app-finance-masterdata-admin` group), while the finance
 * staff who hold that group saw no rows at all. See
 * `masterdata/useMasterDataAccess.ts` for the whole account.
 *
 * Still a plain function over already-fetched data, and still exported, for
 * the reason it always was: `MasterDataRoute` asks this ONE question and must
 * not mount the cc/opd/expense queries to get an answer — a slow or erroring
 * one of those held the page on a blank screen for a reader who was always
 * going to be let in. The route reaches it through `useMasterDataAccess`,
 * which wraps the same `masterDataHasAccess` this case calls, so the rail and
 * the route cannot drift apart.
 */
export function canSeeMasterData(user: MasterDataUserInfo | undefined): boolean {
  return masterDataHasAccess(user);
}

// Role-gates the Finance menu items (surfaced under Me) against each app's
// OWN backend roles — not the coarse One WSO2 capabilities derived from
// people-app. The rail uses this so a menu item is only shown to someone
// who can actually use its page (e.g. cc "Approve Submissions" needs a
// cc-expenses lead/finance role, exactly like the page enforces).
//
// Only the restricted items are listed; anything not named here is a
// per-user view (New / Pending / History) and stays visible to everyone.
// `enabled` lets the caller avoid firing the finance /user-info calls when
// the Me perspective isn't active (e.g. while on People Ops).
export interface FinanceGate {
  canSee: (itemId: string) => boolean;
  isResolving: boolean;
  /**
   * The raw signals behind the `finance-overview` case, exposed so a caller
   * with a choice to make — which dashboard FinanceOverviewPage should
   * default to — can use the SAME resolved access `canSee` already computed,
   * rather than re-deriving it from the backends itself. `opdErrored` in
   * particular is what lets that default actually land on the OPD tab (with
   * its own retry) when that's the reason Overview is visible at all —
   * without it, `finance-overview`'s "a failed lookup counts as a yes"
   * reasoning below would be true only in the rail, and a no-card reader
   * would land on the tab that has nothing to show instead of the one
   * that's erroring and can be retried.
   */
  ccHasOwnCard: boolean;
  opdFinance: boolean;
  opdErrored: boolean;
  expenseFinance: boolean;
}

/**
 * Every finance item's visibility, each decided by the backend that owns it.
 *
 * The portal's coarse capability set used to be passed in here, for the one
 * item that had no backend role of its own — master data. That backend now
 * answers for itself (`useMasterDataUserInfo`), so there is no finance item
 * left that people-app privileges decide, and the parameter is gone rather
 * than kept unused: a `caps` argument still in the signature is an invitation
 * to gate the next finance item on a portal-wide privilege too, which is the
 * mistake this change exists to undo.
 */
export function useFinanceGate(enabled = true): FinanceGate {
  const cc = useCcUserInfo(enabled);
  const opd = useOpdUserInfo(enabled);
  const expense = useExpenseAppData(enabled);
  const masterData = useMasterDataUserInfo(enabled);

  const ccLeadOrFinance = ccHasAccess(cc.data, "lead") || ccHasAccess(cc.data, "finance");
  const ccFinance = ccHasAccess(cc.data, "finance");
  // Whether there is a card to report on at all — granted from the backend's
  // own CC-owner list (service.bal's `ACCESS_LEVEL_CC_OWNER`), not just
  // "employee". A lead/finance role also earns the tab: they read the
  // dashboard for their team or the company, not for a card of their own.
  const ccHasOwnCard = ccHasAccess(cc.data, "cc_owner") || ccLeadOrFinance;
  const opdFinance = opdHasRole(opd.data, OPD_ROLE.FINANCE_APPROVER);
  const opdErrored = opd.isError;
  const expenseLead = Boolean(expense.data?.enableLeadView);
  const expenseFinance = Boolean(expense.data?.enableFinanceView);

  const canSee = (itemId: string): boolean => {
    switch (itemId) {
      // Claim approval, in the Finance perspective — just its two tabs now,
      // Needs You and Decided, both spanning every claim type. CC does not
      // feed into this — its own approving lives entirely under Credit Card
      // Expenses, not here — so only the OPD and Expense flags decide whether
      // this entry appears at all.
      case "claim-approval":
        return opdFinance || expenseLead || expenseFinance;
      // Credit Card Expenses' three submitter-facing items — Pending
      // Submissions, Pending Approvals, History — are each the reader's OWN
      // transactions. Nothing to categorise, track or look back on without a
      // card, so a lead/finance role earns them in too (reading a team's or
      // the company's), same `ccHasOwnCard` as Overview's Credit Card tab.
      case "cc-new":
      case "cc-pending":
      case "cc-history":
        return ccHasOwnCard;
      case "cc-approve":
        return ccLeadOrFinance;
      case "cc-settings":
        return ccFinance;
      // Finance → Overview. One rail entry for all three dashboards now —
      // see FinanceOverviewPage. Hidden entirely when NONE of the three would
      // have anything to show: no card of the reader's own (or team/company
      // view via a CC lead/finance role), no OPD finance-approver role, and
      // no expense finance role. A reader with only one of the three still
      // opens straight onto that tab's content; there is no per-tab hiding
      // inside the page.
      //
      // A FAILED lookup is not a yes. This used to read `|| opdErrored`, on
      // the reasoning that a bad minute from OPD's backend should not hide a
      // screen an approver is entitled to. The cost of that was the bug this
      // entry was reported for: `foldIdentityError` reports EVERY one of
      // these queries as `isError` whenever identity itself fails to resolve
      // (a token-refresh hiccup is enough), so `opdErrored` went true for
      // readers who hold no OPD role at all — the row appeared for them — and
      // went false again the moment identity recovered, so it appeared and
      // vanished and appeared again. An entry that shows itself to the wrong
      // people whenever a request fails is worse than one that stays hidden
      // until a backend can actually answer for it: a role is the only thing
      // that opens this now.
      case "finance-overview":
        return ccHasOwnCard || opdFinance || expenseFinance;
      // The four master-data tables. Finance reference data that the other
      // apps read and only finance writes, so all four answer the same way —
      // listed individually rather than as a prefix match so that a new tab
      // has to be named here before it appears, the same fail-closed rule
      // the default case enforces.
      //
      // Gated on this backend's OWN answer, like every other case here — not
      // on the portal's `admin` privilege, which is what it used to read and
      // which no finance role maps onto. `canSeeMasterData`'s comment has the
      // full reasoning.
      case "master-data-subsidiaries":
      case "master-data-departments":
      case "master-data-expense-types":
      case "master-data-credit-cards":
        return canSeeMasterData(masterData.data);
      default:
        // Per-user views (New / Pending / History) are open; any other item
        // that declares `requires` but reaches here fails closed rather than
        // leaking, so the menu can't drift ahead of the explicit mapping.
        return !RESTRICTED_IDS.has(itemId);
    }
  };

  // `isResolving` is the one answer here that can go BACKWARDS, and it is the
  // one every caller renders nothing on: `FinanceOverviewPage` returns null,
  // `ClaimApprovalPage` drops its tabs and its <Outlet />. So an answer that
  // un-settles is not a slower answer — it is a screen blanking and coming
  // back, which is the flickering.
  //
  // Monotonic by construction rather than by a latch. `isLoading` is the
  // wrong question: it is `isPending && isFetching`, so it reads FALSE in the
  // gap between a failed attempt and its retry, and TRUE again when the retry
  // fires — settled, unsettled, settled, with nothing about this reader
  // having changed. A latch over the top of that only froze whichever answer
  // happened to land first, which could be the half-loaded one.
  //
  // `hasAnswered` asks the question that actually has a stable answer: has
  // this backend finished having its say, FOR THE IDENTITY IT WAS ASKED
  // ABOUT? `isSuccess` and `isError` are terminal in React Query — a refetch
  // of an errored query keeps `status: "error"` until it succeeds — so
  // neither ever goes back to false for a given query, and a backend this
  // environment has no URL for is counted as answered because it is never
  // going to be asked.
  //
  // That makes `isResolving` monotonic per identity, not for the life of the
  // mount outright: `userSub` is part of every query key here, so an identity
  // retry (a decode failure moving `useAsgardeoSub` from "error" back to
  // "loading") or a different account signing in in the same tab both point
  // these queries at a key that has never answered, and `isResolving` goes
  // back to true — correctly, since that identity genuinely has not. What it
  // cannot do is flicker for a reason that has nothing to do with the
  // reader, which is the bug this replaced.
  const hasAnswered = (q: { isSuccess: boolean; isError: boolean }, configured: boolean) =>
    !configured || q.isSuccess || q.isError;

  const isResolving =
    enabled &&
    !(
      hasAnswered(cc, isCcBackendConfigured()) &&
      hasAnswered(opd, isOpdBackendConfigured()) &&
      hasAnswered(expense, isExpenseBackendConfigured()) &&
      // Counted here too, now that a master-data row waits on a real request
      // rather than on an identity field the rail already had. Left out, the
      // rail would call the four rows resolved while this query was still in
      // flight and render them hidden, then show them when it landed — the
      // appearing-and-vanishing row this hook's comments above are about.
      hasAnswered(masterData, isFinanceMasterDataBackendConfigured())
    );

  return { canSee, isResolving, ccHasOwnCard, opdFinance, opdErrored, expenseFinance };
}

/** Rail and landing facts. Dashboard-tab fields stay on FinanceGate. */
export function financeVisibility(gate: FinanceGate): VisibilityAnswer {
  return {
    canSee: (id) => gate.canSee(id),
    resolving: gate.isResolving,
    retry: () => undefined,
  };
}
