/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { useState } from "react";
import type { DatabaseLeave } from "../api/leaveTypes";
import {
  Alert,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { useQueryClient } from "@tanstack/react-query";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useLeaves } from "../api/useLeaveData";
import { useApproveLeave } from "../api/useLeaveMutations";
import { waitingFor } from "../util/franceLeave";
import { isoDay } from "../util/leaveDates";
import { describeError } from "../util/leaveError";
import { OTHER_AUTHORIZED_APPROVE as COPY, SnackMessage } from "../util/leaveCopy";
import RejectReasonDialog from "./RejectReasonDialog";
import { HeadCell } from "./SabbaticalTable";

// Pending Other Authorized requests from the lead's own reports. Approving
// sends no reason; rejecting needs one, which the backend emails to the
// applicant.
export default function OtherAuthorizedApproveTab() {
  // The request being decided and how. Kept open until the call succeeds, so a
  // refused decision leaves the lead's typed reason where it was.
  const [target, setTarget] = useState<{ leave: DatabaseLeave; approving: boolean } | null>(null);
  const approve = useApproveLeave();
  const qc = useQueryClient();
  const { showSuccess, showError } = useNotifications();

  const pending = useLeaves({
    subordinatesLeaves: true,
    leaveCategory: ["other_authorized"],
    statuses: ["PENDING"],
    orderBy: "DESC",
  });

  if (pending.isLoading) {
    return <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1.5 }} />;
  }
  if (pending.isError) {
    return <Alert severity="error">{describeError(pending.error)}</Alert>;
  }

  const rows = pending.data?.leaves ?? [];

  const decide = (id: number, action: "approve" | "reject", reason?: string) => {
    approve.mutate(reason ? { id, action, reason } : { id, action }, {
      onSuccess: () => {
        showSuccess(
          action === "approve"
            ? SnackMessage.success.approveLeaveMessage
            : SnackMessage.success.rejectLeaveMessage,
        );
        setTarget(null);
      },
      onError: (err) => {
        showError(describeError(err));
        // The request may have been decided elsewhere, so the list on screen
        // is stale. A success is refetched by the mutation itself.
        void qc.invalidateQueries({ queryKey: ["leaves"] });
      },
    });
  };

  // A decision that was refused keeps `target` so the typed reason survives.
  // But once a refetch no longer lists that request (decided elsewhere, or the
  // list went empty), the target is stale: drop it, so a dialog for the old
  // request cannot come back when new rows arrive.
  if (target && !rows.some((r) => r.id === target.leave.id)) {
    setTarget(null);
  }

  if (rows.length === 0) {
    return (
      <Typography sx={{ fontSize: 13, color: "text.secondary", py: 3 }}>{COPY.empty}</Typography>
    );
  }

  const today = new Date();
  const cell = { fontSize: 12.5, fontVariantNumeric: "tabular-nums" } as const;

  return (
    <>
      <Card variant="outlined" sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <HeadCell>{COPY.columns.employee}</HeadCell>
              <HeadCell>{COPY.columns.startDate}</HeadCell>
              <HeadCell>{COPY.columns.endDate}</HeadCell>
              <HeadCell>{COPY.columns.dayCount}</HeadCell>
              <HeadCell>{COPY.columns.comment}</HeadCell>
              <HeadCell>{COPY.columns.waiting}</HeadCell>
              <HeadCell align="right">{COPY.columns.decision}</HeadCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((lv) => (
              <TableRow key={lv.id} hover>
                <TableCell sx={{ fontSize: 12.5 }}>{lv.email}</TableCell>
                <TableCell sx={cell}>{isoDay(lv.startDate)}</TableCell>
                <TableCell sx={cell}>{isoDay(lv.endDate)}</TableCell>
                <TableCell sx={cell}>{lv.numberOfDays ?? "—"}</TableCell>
                <TableCell sx={{ fontSize: 12.5, maxWidth: 240 }}>
                  {lv.submitComment ? (
                    <Tooltip title={lv.submitComment}>
                      <Typography noWrap sx={{ fontSize: 12.5 }}>
                        {lv.submitComment}
                      </Typography>
                    </Tooltip>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell sx={cell}>{waitingFor(lv.createdDate, today) || "—"}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={0.75} justifyContent="flex-end">
                    <Button
                      size="small"
                      variant="contained"
                      disabled={approve.isPending}
                      onClick={() => setTarget({ leave: lv, approving: true })}
                    >
                      {COPY.approve}
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      disabled={approve.isPending}
                      onClick={() => setTarget({ leave: lv, approving: false })}
                    >
                      {COPY.reject}
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {target && !target.approving && (
        <RejectReasonDialog
          open
          busy={approve.isPending}
          onCancel={() => setTarget(null)}
          onConfirm={(reason) => decide(target.leave.id, "reject", reason)}
        />
      )}
      {target?.approving && (
        <Dialog open onClose={approve.isPending ? undefined : () => setTarget(null)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>{COPY.approveDialog.title}</DialogTitle>
          <DialogContent dividers>
            <Typography sx={{ fontSize: 13.5 }}>
              {COPY.approveDialog.body(
                target.leave.email,
                `${isoDay(target.leave.startDate)} – ${isoDay(target.leave.endDate)}`,
              )}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button size="small" onClick={() => setTarget(null)} disabled={approve.isPending}>
              {COPY.approveDialog.cancel}
            </Button>
            <Button
              size="small"
              variant="contained"
              disabled={approve.isPending}
              onClick={() => decide(target.leave.id, "approve")}
            >
              {approve.isPending ? COPY.working : COPY.approveDialog.confirm}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}
