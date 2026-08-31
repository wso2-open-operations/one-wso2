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

// The shared purchase-request table, used by My requests now and by the
// procurement queue when that lands. Ported from the standalone app's
// components/PurchaseRequestsList.tsx.
//
// Differences from the source: the title/subtitle block is gone (ProcurementShell
// renders it, because the portal owns the page chrome), and the reference column
// goes through PrReferenceLink — the detail view isn't ported yet, so it links
// out to the standalone app rather than to a route that doesn't exist.
//
// The source's `toolbar` / `filtersActive` props are NOT carried over. Nothing in
// Phase 1 filters anything, so they were an unreachable prop and an unreachable
// empty state; the procurement queue can reintroduce the filter UI it actually
// needs when it lands, rather than inheriting a guess at it.

import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import PrReferenceLink from "@features/procurement/components/PrReferenceLink";
import StatusBadge from "@features/procurement/components/StatusBadge";
import { prPriority, prPriorityColor } from "@features/procurement/util/prDisplay";
import type { PurchaseRequest, PurchasingMe } from "@features/procurement/api/purchasingTypes";

export default function PurchaseRequestsList({
  data,
  isLoading,
  isError,
  error,
  onRetry,
  me,
  emptyMessage = "No purchase requests yet",
}: {
  data: PurchaseRequest[] | undefined;
  isLoading: boolean;
  isError: boolean;
  /** The caught error, so ErrorNotice can name the cause. Never rendered raw. */
  error?: unknown;
  /** Omit only where retrying cannot help — every current caller passes one. */
  onRetry?: () => void;
  me: PurchasingMe | undefined;
  emptyMessage?: string;
}) {
  return (
    <Box>
      {isLoading && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <CircularProgress size={18} />
          <Typography variant="body2" color="text.secondary">
            Loading…
          </Typography>
        </Box>
      )}
      {/* A retry, not a dead sentence: this is a 5-second-polled list, so the
          commonest cause is a transient gateway failure and the fix is to ask
          again. Same notice the rest of the app uses. */}
      {isError && (
        <ErrorNotice error={error} onRetry={onRetry}>
          Couldn&apos;t load your requests.
        </ErrorNotice>
      )}

      {data && data.length === 0 && (
        <Card variant="outlined" sx={{ borderStyle: "dashed" }}>
          <CardContent sx={{ py: 6, textAlign: "center" }}>
            <Typography variant="subtitle2">{emptyMessage}</Typography>
            {/* No "create one" button yet: raising a request is the requisition
                form, which lands in Phase 2. Saying where to go beats a button
                that goes nowhere. */}
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              New requests are raised in the purchasing app for now.
            </Typography>
          </CardContent>
        </Card>
      )}

      {data && data.length > 0 && (
        // Wide tables scroll inside their own container so the page body never
        // scrolls horizontally.
        <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Ref</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Assignee</TableCell>
                <TableCell>Approvals</TableCell>
                <TableCell>Created</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((pr) => (
                <TableRow key={pr.id} hover>
                  <TableCell>
                    <PrReferenceLink pr={pr} />
                  </TableCell>
                  <TableCell>{pr.title || <Dash />}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={prPriorityColor(prPriority(pr))}
                      label={prPriority(pr)}
                    />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={pr.status} />
                  </TableCell>
                  <TableCell>
                    {me && pr.assignee_id === me.id ? (
                      <Chip size="small" variant="outlined" color="primary" label="Assigned to you" />
                    ) : pr.assignee ? (
                      <Typography variant="body2" color="text.secondary">
                        {pr.assignee.name || pr.assignee.email}
                      </Typography>
                    ) : pr.team_lead_status === "approved" ? (
                      <Chip size="small" variant="outlined" color="warning" label="Unassigned" />
                    ) : (
                      <Dash />
                    )}
                  </TableCell>
                  <TableCell>
                    {pr.my_approval_status === "pending" ? (
                      <Chip size="small" variant="outlined" color="warning" label="Awaiting you" />
                    ) : pr.approvals_total > 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        {pr.approvals_approved}/{pr.approvals_total} approved
                      </Typography>
                    ) : (
                      <Dash />
                    )}
                  </TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>
                    {new Date(pr.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

/** An em dash for an absent value, at the same weight everywhere. */
function Dash() {
  return (
    <Typography component="span" color="text.disabled">
      —
    </Typography>
  );
}
