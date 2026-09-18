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

import { FINANCE_APPS } from "@constants/financeApps";
import { useCcUserInfo } from "../cc/useCc";
import { ccHasAccess } from "../cc/ccTypes";
import { useOpdUserInfo } from "../opd/useOpd";
import { OPD_ROLE, opdHasRole } from "../opd/opdTypes";
import { useExpenseAppData } from "../expense/useExpense";
import { isPreviewEnabled } from "@config/previewFeatures";

// Items that declare `requires` in the registry but aren't explicitly mapped
// below must fail CLOSED — otherwise a renamed or newly-added restricted item
// would silently become visible to everyone. Per-user items (no `requires`)
// stay open.
const RESTRICTED_IDS = new Set(
  FINANCE_APPS.flatMap((app) => app.items)
    .filter((it) => it.requires && it.requires.length > 0)
    .map((it) => it.id),
);

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
}

export function useFinanceGate(enabled = true): FinanceGate {
  const cc = useCcUserInfo(enabled);
  const opd = useOpdUserInfo(enabled);
  const expense = useExpenseAppData(enabled);

  const ccLeadOrFinance = ccHasAccess(cc.data, "lead") || ccHasAccess(cc.data, "finance");
  const ccFinance = ccHasAccess(cc.data, "finance");
  // Approving OPD claims is the backend's role 555 or nobody — there is no
  // lead stage. A lookup that FAILED is not the same answer as one that came
  // back without the role, so it counts as a yes: the screen behind the entry
  // carries its own error notice and a retry, which is a better place to find
  // out than a menu entry that quietly is not there.
  const opdFinance = opdHasRole(opd.data, OPD_ROLE.FINANCE_APPROVER);
  const expenseLead = Boolean(expense.data?.enableLeadView);
  const expenseFinance = Boolean(expense.data?.enableFinanceView);

  const canSee = (itemId: string): boolean => {
    switch (itemId) {
      // Behind a preview flag until the Finance and Me new-claim entry points
      // are reconciled. Answered here as well as by removing the registry
      // entry, because the Finance overview builds its tiles by hand and asks
      // the gate by id — a registry-only change would leave that tile offering
      // a route that no longer exists.
      case "expense-new":
        return isPreviewEnabled("expenseSubmitter");
      // Approving expense claims, beside filing them. One entry per stage, each
      // on its own flag — `appDataSlice.ts:104-109` decides which of the source
      // app's two sidebar entries exist the same way. Both cases are required,
      // not optional: each item declares `requires`, so an unmapped id falls
      // through to the default and fails closed for everyone.
      case "expense-lead-approvals":
        return expenseLead;
      case "expense-finance-approvals":
        return expenseFinance;
      // Answered here as well as by dropping the registry entry, because the
      // Finance overview builds its tiles by hand and asks the gate by id — a
      // registry-only change would leave a tile offering a route that is not
      // registered.
      case "claim-approval-opd":
        if (!isPreviewEnabled("claimApproval")) return false;
        // Coerced: `canSee` is typed boolean, and `isError` is only a boolean
        // when the query hook actually ran — a caller that stubs the hook, or a
        // shape that changes upstream, would otherwise leak undefined through a
        // permission check and read as false everywhere it is used.
        return opdFinance || Boolean(opd.isError);
      case "cc-approve":
        return ccLeadOrFinance;
      case "cc-settings":
        return ccFinance;
      default:
        // Per-user views (New / Pending / History) are open; any other item
        // that declares `requires` but reaches here fails closed rather than
        // leaking, so the menu can't drift ahead of the explicit mapping.
        return !RESTRICTED_IDS.has(itemId);
    }
  };

  const isResolving = enabled && (cc.isLoading || opd.isLoading || expense.isLoading);
  return { canSee, isResolving };
}
