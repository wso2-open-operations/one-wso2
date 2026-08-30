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
// Differences from the source, both because the portal owns the page chrome:
// the title/subtitle block is gone (ProcurementShell renders it), and paths run
// through procurementRoutes rather than being literals.

import type { ReactNode } from "react";
import { Link } from "react-router";
import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
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
import StatusBadge from "@features/procurement/components/StatusBadge";
import { procurementRoutes } from "@features/procurement/constants/routes";
import { prPriority, prPriorityColor, prReference } from "@features/procurement/util/prDisplay";
import type { PurchaseRequest, PurchasingMe } from "@features/procurement/api/purchasingTypes";

export default function PurchaseRequestsList({
  data,
  isLoading,
  isError,
  me,
  emptyMessage = "No purchase requests yet",
  toolbar,
  filtersActive = false,
}: {
  data: PurchaseRequest[] | undefined;
  isLoading: boolean;
  isError: boolean;
  me: PurchasingMe | undefined;
  emptyMessage?: string;
  toolbar?: ReactNode;
  /** Empty because filters exclude everything, not because none exist. */
  filtersActive?: boolean;
}) {
  return (
    <Box>
      {toolbar}

      {isLoading && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <CircularProgress size={18} />
          <Typography variant="body2" color="text.secondary">
            Loading…
          </Typography>
        </Box>
      )}
      {isError && (
        <Typography variant="body2" color="error.main">
          Failed to load requests.
        </Typography>
      )}

      {data && data.length === 0 && (
        <Card variant="outlined" sx={{ borderStyle: "dashed" }}>
          <CardContent sx={{ py: 6, textAlign: "center" }}>
            {filtersActive ? (
              <>
                <Typography variant="subtitle2">No requests match these filters</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Try clearing or widening the filters above.
                </Typography>
              </>
            ) : (
              <>
                <Typography variant="subtitle2">{emptyMessage}</Typography>
                {/* No "create one" button yet: raising a request is the
                    requisition form, which lands in Phase 2. Saying where to go
                    beats a button that goes nowhere. */}
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  New requests are raised in the purchasing app for now.
                </Typography>
              </>
            )}
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
                    <MuiLink
                      component={Link}
                      to={procurementRoutes.request(pr.id)}
                      sx={{ fontWeight: 600 }}
                    >
                      {prReference(pr)}
                    </MuiLink>
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
