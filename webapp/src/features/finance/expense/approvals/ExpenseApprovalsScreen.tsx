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

import { useMemo, useState } from "react";
import { Alert, Box, Skeleton, Stack, Tab, Tabs, Typography } from "@wso2/oxygen-ui";
import {
  ClipboardClockIcon,
  PackageCheckIcon,
  SquareXIcon,
  type LucideIcon,
} from "@wso2/oxygen-ui-icons-react";
import { isExpenseBackendConfigured } from "@config/apiConfig";
import { FINANCE_EYEBROW } from "@constants/financeApps";
import FinanceShell from "../../components/FinanceShell";
import { describeError } from "../../util/financeError";
import { useExpenseAppData, useExpenseEmployees } from "../useExpense";
import type { ApproverView } from "../expenseTypes";
import { ExpenseApprovalFilters } from "./ExpenseApprovalFilters";
import { ExpenseApprovalReview } from "./ExpenseApprovalReview";
import { ExpenseApprovalTable } from "./ExpenseApprovalTable";
import {
  EMPTY_APPROVAL_FILTERS,
  approvalTabs,
  makeNameResolver,
  toApprovalSearchPayload,
  type ApprovalClaim,
  type ApprovalFilters,
  type ApprovalTabKey,
} from "./expenseApprovalTypes";
import { useApprovalQueue } from "./useExpenseApprovals";

// ClaimTabLabels (`utils/types.ts`) — the source's own tab names and the icons
// it puts beside them, so an approver moving between the two apps reads the
// same three words in the same order.
const TAB_LABEL: Record<ApprovalTabKey, string> = {
  pending: "Pending Claims",
  approved: "Approved Claims",
  rejected: "Rejected Claims",
};

const TAB_ICON: Record<ApprovalTabKey, LucideIcon> = {
  pending: ClipboardClockIcon,
  approved: PackageCheckIcon,
  rejected: SquareXIcon,
};

/**
 * Expense Claims → Lead Approvals / Finance Approvals — `Approvals.tsx`.
 *
 * It sits beside New Claim and Claim History under **Expense Claims**, where
 * the source app's own sidebar keeps approving: next to filing, in the app the
 * claims belong to. One screen parameterised by stage, reached from two
 * entries, exactly as `routes.tsx:15-21` mounts it.
 */
export default function ExpenseApprovalsScreen({ stage }: { stage: ApproverView }) {
  return (
    <FinanceShell
      eyebrow={FINANCE_EYEBROW.expense}
      // CustomCardHeader's own two titles.
      title={stage === "LEAD" ? "Lead Approvals" : "Finance Approvals"}
      subtitle={
        stage === "LEAD"
          ? "Expense claims from the people you lead, and the ones you have already decided."
          : "Expense claims that passed their lead, and the ones finance has already decided."
      }
      configured={isExpenseBackendConfigured()}
      configKey="ONE_WSO2_EXPENSE_CLAIMS_BACKEND_URL"
    >
      <ApprovalsStage stage={stage} />
    </FinanceShell>
  );
}

function ApprovalsStage({ stage }: { stage: ApproverView }) {
  const appData = useExpenseAppData();
  const holdsStage = Boolean(
    stage === "LEAD" ? appData.data?.enableLeadView : appData.data?.enableFinanceView,
  );

  if (appData.isLoading) {
    return <Skeleton variant="rectangular" height={320} sx={{ borderRadius: 1.5 }} />;
  }
  if (appData.isError) {
    return <Alert severity="error">Couldn&apos;t load your approver profile. {describeError(appData.error)}</Alert>;
  }
  // The menu entry is gated on this same flag, but a hidden entry is not access
  // control: the URL can be typed, pasted, or bookmarked from when the person
  // did hold the role. Checked only once app-data has answered, so an approver
  // is never turned away while the flags are still loading.
  if (!holdsStage) {
    return (
      <Alert severity="info">
        {stage === "LEAD" ? "Lead" : "Finance"} approvals aren&apos;t available for your role.
      </Alert>
    );
  }

  // Keyed on the stage so the two entries never share a tab or a filter set —
  // the source gives each its own `key` for the same reason.
  return <ApprovalsQueue key={stage} stage={stage} viewerEmail={appData.data?.userInfo.workEmail} />;
}

function ApprovalsQueue({ stage, viewerEmail }: { stage: ApproverView; viewerEmail: string | undefined }) {
  const tabs = approvalTabs(stage);
  const [tabKey, setTabKey] = useState<ApprovalTabKey>("pending");
  const [filters, setFilters] = useState<ApprovalFilters>(EMPTY_APPROVAL_FILTERS);
  const [selected, setSelected] = useState<ApprovalClaim | null>(null);
  const [decidedId, setDecidedId] = useState<string | null>(null);

  const employees = useExpenseEmployees();
  const nameFor = useMemo(() => makeNameResolver(employees.data), [employees.data]);
  const employeeEmails = useMemo(() => (employees.data ?? []).map((e) => e.workEmail), [employees.data]);

  const payload = useMemo(
    () => toApprovalSearchPayload(stage, tabKey, filters, viewerEmail),
    [stage, tabKey, filters, viewerEmail],
  );
  // A lead's queue is scoped by their own address, so it waits for app-data;
  // finance's is not scoped at all and can run as soon as the screen mounts.
  const claims = useApprovalQueue(payload, stage === "FINANCE" || Boolean(viewerEmail));

  const isPendingTab = tabKey === "pending";

  if (selected) {
    return (
      <ExpenseApprovalReview
        claim={selected}
        stage={stage}
        pending={isPendingTab}
        nameFor={nameFor}
        viewerEmail={viewerEmail}
        onBack={() => setSelected(null)}
        onDecided={setDecidedId}
      />
    );
  }

  return (
    <Box>
      {/* Tabs left, filters right, on one line — `CustomCardHeader` puts the
          filters opposite the title, and this screen's title lives in the
          shell above. */}
      <Stack
        direction="row"
        alignItems="flex-end"
        justifyContent="space-between"
        spacing={2}
        sx={{ flexWrap: "wrap", rowGap: 1 }}
      >
        <Tabs
          value={tabKey}
          onChange={(_e, v) => {
            // Approvals.tsx:35 — a new tab starts from a clean filter set.
            setFilters(EMPTY_APPROVAL_FILTERS);
            // And from no decided claim. The claim just approved reappears on
            // the Approved tab under the same id, so a `decidedId` left behind
            // would fade that row to nothing — invisible, but with its button
            // still in the tab order.
            setDecidedId(null);
            setTabKey(v as ApprovalTabKey);
          }}
          sx={{
            minHeight: 36,
            "& .MuiTab-root": {
              minHeight: 36,
              textTransform: "none",
              fontSize: 13,
              fontWeight: 600,
              gap: 0.75,
            },
          }}
        >
          {tabs.map((t) => {
            const Icon = TAB_ICON[t.key as ApprovalTabKey];
            return (
              <Tab
                key={t.key}
                value={t.key}
                icon={<Icon size={16} />}
                iconPosition="start"
                // ClaimTabLabels — the source names them "… Claims", not the
                // bare adjective.
                label={TAB_LABEL[t.key as ApprovalTabKey]}
              />
            );
          })}
        </Tabs>

        <ExpenseApprovalFilters
          filters={filters}
          onChange={setFilters}
          // The Pending tab hides the range control and drops `limit` with it,
          // so a queue is never silently cut off at a hundred claims.
          showRange={!isPendingTab}
          employeeEmails={employeeEmails}
        />
      </Stack>

      {/* `isLoading`, never `isPending`: a query disabled while app-data is in
          flight stays pending forever, and a screen keyed on that spins for
          anyone it is disabled for. */}
      {claims.isLoading ? (
        <Stack spacing={1}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rectangular" height={48} sx={{ borderRadius: 1 }} />
          ))}
        </Stack>
      ) : claims.isError ? (
        <Alert severity="error">Couldn&apos;t load claims. {describeError(claims.error)}</Alert>
      ) : (claims.data?.length ?? 0) === 0 ? (
        <Typography sx={{ fontSize: 13, color: "text.secondary", py: 3 }}>
          {/* ClaimTable.tsx:250-268 — an empty pending queue is good news and
              says so; an empty decided tab is just empty. */}
          {isPendingTab ? "All caught up! No claims to approve" : "No claims found"}
        </Typography>
      ) : (
        <ExpenseApprovalTable
          claims={claims.data!}
          nameFor={nameFor}
          actionLabel={isPendingTab ? "Review" : "View"}
          onOpen={setSelected}
          decidedId={decidedId}
        />
      )}
    </Box>
  );
}
