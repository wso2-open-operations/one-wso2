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

import { useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Menu,
  MenuItem,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@wso2/oxygen-ui";
import { DownloadIcon } from "@wso2/oxygen-ui-icons-react";
import { isExpenseBackendConfigured } from "@config/apiConfig";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { FINANCE_EYEBROW } from "@constants/financeApps";
import FinanceShell from "../../components/FinanceShell";
import { money } from "../../util/financeFormat";
import { useExpenseAppData } from "../useExpense";
import { useExpenseClaimsReport, useExpenseDashboardTypes, useExpenseSubsidiaries } from "./useExpenseDashboard";
import { ExpenseDashboardPanel, ExpenseStatTile } from "./ExpenseDashboardParts";
import { ExpenseDashboardFilters, type ExpenseDashboardDraftFilters } from "./ExpenseDashboardFilters";
import { ExpenseEntityBreakdownTable } from "./ExpenseEntityBreakdownTable";
import { ExpenseMonthlyBreakdownTable } from "./ExpenseMonthlyBreakdownTable";
import { ExpenseEmployeeBreakdownTable } from "./ExpenseEmployeeBreakdownTable";
import { downloadExpenseReportCsv } from "./exportExpenseReportCsv";
import {
  ALL_CATEGORIES,
  ALL_ENTITIES,
  ALL_REGIONS,
  ALL_STATUSES,
  getEntityCodeForLabel,
  getEntityLabel,
  getPeriodRange,
} from "./expenseDashboardUtils";
import type { ExpenseDashboardPeriod } from "../expenseTypes";
import { EXPENSE_FILTERABLE_STATUSES } from "../expenseTypes";

const BREAKDOWN_TABS = ["Business Entity", "Monthly", "Employee"] as const;
type BreakdownTab = (typeof BREAKDOWN_TABS)[number];

const DEFAULT_CUSTOM_RANGE = getPeriodRange("All Time");
const DEFAULT_FILTERS: ExpenseDashboardDraftFilters = {
  entity: ALL_ENTITIES,
  region: ALL_REGIONS,
  category: ALL_CATEGORIES,
  status: ALL_STATUSES,
  startDate: DEFAULT_CUSTOM_RANGE.startDate ?? "",
  endDate: DEFAULT_CUSTOM_RANGE.endDate,
};

/**
 * Finance → Overview → Expense Claims. `Dashboard.tsx` in the source app,
 * ported screen-for-screen: same filters, same three summary tiles, same
 * status breakdown, same three breakdown tables behind the same tabs, same
 * CSV export — MUI redrawn as Oxygen UI, the source's own bespoke `FilterBox`
 * dropped in favour of the `Autocomplete` filter bar every other finance
 * screen already uses.
 *
 * Gated on `enableFinanceView`, the one flag this screen needed: the
 * backend's `GET /claims-report` is itself gated on `allowedAdminRoles`
 * (service.bal), the SAME check that produces `enableFinanceView` on
 * `/app-data` — so there is no separate permission to invent, only the one
 * the rest of this feature already reads.
 */
export default function ExpenseDashboardScreen({ headerActions }: { headerActions?: ReactNode } = {}) {
  return (
    <FinanceShell
      eyebrow={FINANCE_EYEBROW.expense}
      title="Expense Claims Dashboard"
      subtitle="Claim volume and value across the company, filterable by period, entity, region, category and status."
      configured={isExpenseBackendConfigured()}
      configKey="ONE_WSO2_EXPENSE_CLAIMS_BACKEND_URL"
      actions={headerActions}
      fill
    >
      <DashboardBody />
    </FinanceShell>
  );
}

function DashboardBody() {
  const appData = useExpenseAppData();
  const subsidiaries = useExpenseSubsidiaries();
  const expenseTypes = useExpenseDashboardTypes();

  const [period, setPeriod] = useState<ExpenseDashboardPeriod>("All Time");
  // `draft` is what the filter bar shows; `applied` is what the current
  // report was fetched with. Keeping them apart is what lets the bar require
  // an explicit Apply instead of firing a request on every dropdown change.
  const [draft, setDraft] = useState<ExpenseDashboardDraftFilters>(DEFAULT_FILTERS);
  const [applied, setApplied] = useState<ExpenseDashboardDraftFilters>(DEFAULT_FILTERS);
  const [activeTab, setActiveTab] = useState<BreakdownTab>("Business Entity");
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null);

  // Resolved to primitives so the report query is not keyed on the
  // subsidiary/expense-type arrays, which load asynchronously and would
  // otherwise re-trigger the report request each time one of them resolves.
  const businessEntity = useMemo(
    () =>
      applied.entity === ALL_ENTITIES ? undefined : getEntityCodeForLabel(applied.entity, subsidiaries.data ?? []),
    [applied.entity, subsidiaries.data],
  );
  const expenseTypeId = useMemo(
    () =>
      applied.category === ALL_CATEGORIES
        ? undefined
        : expenseTypes.data?.find((t) => t.type === applied.category)?.id,
    [applied.category, expenseTypes.data],
  );
  const { startDate, endDate } = getPeriodRange(period, { startDate: applied.startDate, endDate: applied.endDate });

  const report = useExpenseClaimsReport({
    startDate,
    endDate,
    businessEntity,
    expenseTypeId,
    status: applied.status === ALL_STATUSES ? undefined : applied.status,
    salesRegion: applied.region === ALL_REGIONS ? undefined : applied.region,
  });

  const isDirty = (Object.keys(draft) as (keyof ExpenseDashboardDraftFilters)[]).some(
    (key) => draft[key] !== applied[key],
  );
  const hasActiveFilters =
    (Object.keys(applied) as (keyof ExpenseDashboardDraftFilters)[]).some(
      (key) => applied[key] !== DEFAULT_FILTERS[key],
    ) ||
    isDirty ||
    period !== "All Time";
  const isCustomPeriod = period === "Custom";
  const isRangeInvalid =
    isCustomPeriod && (!draft.startDate || !draft.endDate || draft.startDate > draft.endDate);

  const handleClearAll = () => {
    setDraft(DEFAULT_FILTERS);
    setApplied(DEFAULT_FILTERS);
    setPeriod("All Time");
  };

  if (appData.isLoading) {
    return (
      <Stack spacing={2}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} variant="rounded" height={80} />
        ))}
      </Stack>
    );
  }

  // `!isLoading && !isError`, not `isSuccess`: a query disabled because its
  // backend is not configured in this environment sits at `isPending: true`
  // forever with `isSuccess` permanently false — gating on `isSuccess` alone
  // would fall through this refusal and leave a blank screen with nothing
  // saying why. `isError` is excluded for the usual reason: a failed lookup
  // is not the same answer as "no role", and refusing a finance approver
  // because a request merely failed is worse than the retry below.
  if (!appData.isLoading && !appData.isError && !appData.data?.enableFinanceView) {
    return (
      <Alert severity="info">
        The expense claims dashboard is limited to the finance team who review these claims.
      </Alert>
    );
  }

  if (appData.isError) {
    return (
      <ErrorNotice error={appData.error} onRetry={() => void appData.refetch()} retrying={appData.isFetching}>
        Couldn&apos;t load the expense claims dashboard.
      </ErrorNotice>
    );
  }

  const currency = report.data?.reportingCurrency ?? appData.data?.currencyCode ?? "USD";
  const categoryOptions = (expenseTypes.data ?? []).map((t) => t.type);
  const entityOptions = (subsidiaries.data ?? []).map((s) => getEntityLabel(s, subsidiaries.data ?? []));
  const regionOptions = report.data?.availableSalesRegions ?? [];

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <ExpenseDashboardFilters
        period={period}
        onPeriodChange={setPeriod}
        draft={draft}
        onDraftChange={setDraft}
        isDirty={isDirty}
        isRangeInvalid={isRangeInvalid}
        hasActiveFilters={hasActiveFilters}
        entityOptions={entityOptions}
        regionOptions={regionOptions}
        categoryOptions={categoryOptions}
        statusOptions={EXPENSE_FILTERABLE_STATUSES}
        onApply={() => setApplied(draft)}
        onClear={handleClearAll}
      />

      {report.isFetching && <LinearProgress sx={{ mb: 2 }} />}

      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {report.isError && (
          <ErrorNotice error={report.error} onRetry={() => void report.refetch()} retrying={report.isFetching}>
            Couldn&apos;t load the dashboard.
          </ErrorNotice>
        )}

        {!report.isError && report.data && report.data.current.claimCount === 0 && (
          <Typography sx={{ fontSize: 14, color: "text.secondary", py: 2.5 }}>
            No claims match the selected filters for {period.toLowerCase()}. Try a different business
            entity, period, or clear a filter.
          </Typography>
        )}

        {!report.isError && report.data && report.data.current.claimCount > 0 && (
          <Stack spacing={3}>
            {/* Three across on a wide screen, two on a tablet, stacked on a
                phone — the same breakpoints `OpdDashboardScreen` draws its
                own stat row with. */}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" },
                gap: 2,
              }}
            >
              <ExpenseStatTile
                label="Claim Count"
                value={report.data.current.claimCount.toLocaleString("en-US")}
                changePercentage={report.data.claimCountChangePercentage}
              />
              <ExpenseStatTile
                label="Total Value"
                value={money(report.data.current.totalValue, currency)}
                changePercentage={report.data.totalValueChangePercentage}
              />
              <ExpenseStatTile
                label="Average Claim Value"
                value={money(report.data.current.averageClaimValue, currency)}
                changePercentage={report.data.averageClaimValueChangePercentage}
              />
            </Box>

            <ExpenseDashboardPanel title="Claims by Status">
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" },
                  gap: 2,
                }}
              >
                {report.data.statusBreakdown.map((item) => (
                  <ExpenseStatTile
                    key={item.status}
                    label={item.status}
                    value={item.count.toLocaleString("en-US")}
                    caption={`Avg ${item.averageDaysPending} days`}
                  />
                ))}
              </Box>
            </ExpenseDashboardPanel>

            <Box sx={{ pr: 1 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5}>
                <Tabs value={activeTab} onChange={(_e, v) => setActiveTab(v as BreakdownTab)}>
                  {BREAKDOWN_TABS.map((tab) => (
                    <Tab key={tab} label={tab} value={tab} sx={{ textTransform: "none" }} />
                  ))}
                </Tabs>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<DownloadIcon size={16} />}
                  onClick={(e) => setExportAnchor(e.currentTarget)}
                  sx={{ textTransform: "none" }}
                >
                  Export
                </Button>
                <Menu
                  anchorEl={exportAnchor}
                  open={Boolean(exportAnchor)}
                  onClose={() => setExportAnchor(null)}
                  anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                  transformOrigin={{ vertical: "top", horizontal: "right" }}
                >
                  <MenuItem
                    onClick={() => {
                      downloadExpenseReportCsv(report.data!, period);
                      setExportAnchor(null);
                    }}
                  >
                    Download as CSV
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      setExportAnchor(null);
                      window.print();
                    }}
                  >
                    Print
                  </MenuItem>
                </Menu>
              </Stack>

              <Typography sx={{ fontSize: 13, color: "text.secondary", py: 1.5 }}>
                {period}
                {activeTab === "Business Entity" && `, ${applied.entity === ALL_ENTITIES ? "all entities" : applied.entity}`}
                {` · all amounts in ${currency}`}
              </Typography>

              <Box sx={{ overflowX: "auto" }}>
                {activeTab === "Business Entity" && (
                  <ExpenseEntityBreakdownTable items={report.data.entityBreakdown} currency={currency} />
                )}
                {activeTab === "Monthly" && (
                  <ExpenseMonthlyBreakdownTable
                    expenseTypeColumns={report.data.expenseTypeColumns}
                    items={report.data.monthlyBreakdown}
                    currency={currency}
                  />
                )}
                {activeTab === "Employee" && (
                  <ExpenseEmployeeBreakdownTable items={report.data.employeeBreakdown} currency={currency} />
                )}
              </Box>
            </Box>
          </Stack>
        )}
      </Box>
    </Box>
  );
}
