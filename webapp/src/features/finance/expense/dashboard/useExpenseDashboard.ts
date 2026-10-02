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

import { useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { expenseServiceUrls, isExpenseBackendConfigured } from "@config/apiConfig";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { financeRetry } from "../../util/financeError";
import type {
  ExpenseClaimsReport,
  ExpenseClaimsReportFilter,
  ExpenseSubsidiarySummary,
  ExpenseTypeData,
} from "../expenseTypes";

export { isExpenseBackendConfigured };

/**
 * The dashboard's own reference lists + its one report. A separate module
 * from `useExpense.ts` for the same reason `useOpdDashboard.ts` is separate
 * from `useOpd.ts`: that file is shared by every expense-claims screen, and
 * these three endpoints are finance-dashboard-only.
 */

// GET /subsidiaries — every legal entity the dashboard's Business Entity
// filter and CSV export read a label from. Reference data, so a long
// staleTime: it does not move between two glances at the dashboard.
export function useExpenseSubsidiaries(enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const configured = isExpenseBackendConfigured();
  const query = useQuery<ExpenseSubsidiarySummary[]>({
    queryKey: ["expense-dashboard-subsidiaries", userSub],
    enabled: enabled && isSignedIn && configured && Boolean(userSub),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<ExpenseSubsidiarySummary[]>(expenseServiceUrls.subsidiaries, accessToken);
    },
    staleTime: 30 * 60 * 1000,
    retry: financeRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

// GET /expense-types — the PLAIN, unscoped catalogue for the dashboard's
// Expense Category filter. Not the same call `useExpenseTypes` (useExpense.ts)
// makes for the claim form, which is scoped by travel job number — this one
// answers "every category that exists", which is what filtering a company-wide
// report needs.
export function useExpenseDashboardTypes(enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const configured = isExpenseBackendConfigured();
  const query = useQuery<ExpenseTypeData[]>({
    queryKey: ["expense-dashboard-expense-types", userSub],
    enabled: enabled && isSignedIn && configured && Boolean(userSub),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<ExpenseTypeData[]>(expenseServiceUrls.dashboardExpenseTypes, accessToken);
    },
    staleTime: 30 * 60 * 1000,
    retry: financeRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/** `undefined`/`null` params are left off the query string entirely, rather
 *  than sent as the literal text "undefined" — `authedGet` takes a finished
 *  URL, not a params object, so this is built by hand. */
function reportQueryString(filter: ExpenseClaimsReportFilter): string {
  const params = new URLSearchParams();
  params.set("endDate", filter.endDate);
  if (filter.startDate) params.set("startDate", filter.startDate);
  if (filter.status) params.set("status", filter.status);
  if (filter.businessEntity) params.set("businessEntity", filter.businessEntity);
  if (filter.expenseTypeId !== undefined) params.set("expenseTypeId", String(filter.expenseTypeId));
  if (filter.salesRegion) params.set("salesRegion", filter.salesRegion);
  return params.toString();
}

// GET /claims-report — the whole dashboard in one request: the org-wide,
// period-scoped, filtered totals, the status/entity/monthly/employee
// breakdowns, and the sales-region list the filter bar itself offers.
//
// Backend-gated on `allowedAdminRoles` — the SAME check `/app-data` already
// answers as `enableFinanceView` (service.bal:75), so this screen's own
// visibility (useFinanceGate's `finance-overview` case) is already the
// correct gate; nothing new to check here.
export function useExpenseClaimsReport(filter: ExpenseClaimsReportFilter, enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const configured = isExpenseBackendConfigured();
  const query = useQuery<ExpenseClaimsReport>({
    queryKey: ["expense-claims-report", userSub, filter],
    enabled: enabled && isSignedIn && configured && Boolean(userSub),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<ExpenseClaimsReport>(
        `${expenseServiceUrls.claimsReport}?${reportQueryString(filter)}`,
        accessToken,
      );
    },
    // Short — this is a live operational report, not slow-moving reference
    // data, and finance expects Apply to reflect a just-submitted claim.
    staleTime: 60 * 1000,
    retry: financeRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}
