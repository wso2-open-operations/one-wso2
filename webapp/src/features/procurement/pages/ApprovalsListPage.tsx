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

// Approvals — purchase requests awaiting the caller's decision.
//
// Ported from the standalone app's pages/ApprovalsListPage.tsx. Open to everyone:
// whether you approve anything is a property of the requests, not of your roles
// (a budget owner or named approver holds no distinguishing role), so the list is
// simply empty for people who approve nothing.

import { useState } from "react";
import { Link } from "react-router";
import {
  Box,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  Link as MuiLink,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import ProcurementShell from "@features/procurement/components/ProcurementShell";
import StatusBadge from "@features/procurement/components/StatusBadge";
import { useApprovalRequests } from "@features/procurement/api/usePurchaseRequests";
import { procurementRoutes } from "@features/procurement/constants/routes";
import { prReference } from "@features/procurement/util/prDisplay";
import type { ApprovalStatus } from "@features/procurement/api/purchasingTypes";

/** The caller's own decision on a request awaiting them. */
function MyApprovalBadge({ state }: { state?: ApprovalStatus | null }) {
  if (state === "pending") {
    return <Chip size="small" variant="outlined" color="warning" label="Awaiting you" />;
  }
  if (state === "approved") {
    return <Chip size="small" variant="outlined" color="success" label="Approved" />;
  }
  if (state === "rejected") {
    return <Chip size="small" variant="outlined" color="error" label="Rejected" />;
  }
  return (
    <Typography component="span" color="text.disabled">
      —
    </Typography>
  );
}

export default function ApprovalsListPage() {
  const { data, isPending, isError } = useApprovalRequests();
  // Two independent filters. Pending is on by default; "Reviewed" covers the
  // acted-on rows — recommendation cards cannot be rejected, so a rejected row
  // is always a named-approval decision.
  const [showPending, setShowPending] = useState(true);
  const [showReviewed, setShowReviewed] = useState(false);

  const rows = (data ?? []).filter((pr) =>
    pr.my_approval_state === "pending" ? showPending : showReviewed,
  );

  return (
    <ProcurementShell
      title="Approvals"
      subtitle="Purchase requests awaiting your decision as a team lead, or as a budget, legal, security or compliance approver."
    >
      <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap" }}>
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={showPending}
              onChange={(e) => setShowPending(e.target.checked)}
            />
          }
          label="Pending"
        />
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={showReviewed}
              onChange={(e) => setShowReviewed(e.target.checked)}
            />
          }
          label="Reviewed"
        />
      </Box>

      {isPending && <CircularProgress size={24} />}
      {isError && (
        <Typography variant="body2" color="error.main">
          Failed to load approvals.
        </Typography>
      )}

      {data && rows.length === 0 && (
        <Paper variant="outlined" sx={{ p: 6, textAlign: "center", borderStyle: "dashed" }}>
          <Typography variant="subtitle2">Nothing to show</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {data.length === 0
              ? "No purchase requests are awaiting your approval."
              : "No requests match the selected filters."}
          </Typography>
        </Paper>
      )}

      {rows.length > 0 && (
        <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Ref</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Requester</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Your decision</TableCell>
                <TableCell>Created</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((pr) => (
                <TableRow key={pr.id} hover>
                  <TableCell>
                    <MuiLink
                      component={Link}
                      to={procurementRoutes.request(pr.id)}
                      sx={{ fontWeight: 500 }}
                    >
                      {prReference(pr)}
                    </MuiLink>
                  </TableCell>
                  <TableCell>
                    {pr.title || (
                      <Typography component="span" color="text.disabled">
                        —
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>
                    {pr.requester?.name || pr.requester?.email || "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={pr.status} />
                  </TableCell>
                  <TableCell>
                    <MyApprovalBadge state={pr.my_approval_state} />
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
    </ProcurementShell>
  );
}
