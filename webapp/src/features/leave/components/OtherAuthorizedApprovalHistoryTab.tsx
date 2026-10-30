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

import {
  Alert,
  Card,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import type { LeaveStatus } from "../api/leaveTypes";
import { useLeaves } from "../api/useLeaveData";
import { isoDay } from "../util/leaveDates";
import { describeError } from "../util/leaveError";
import { OTHER_AUTHORIZED_APPROVE as COPY } from "../util/leaveCopy";
import { StatusChip } from "./LeaveChips";
import { HeadCell } from "./SabbaticalTable";

// The lead's decided Other Authorized requests. Approved and rejected only;
// a rejected row shows the reason the lead gave.
export default function OtherAuthorizedApprovalHistoryTab() {
  const history = useLeaves({
    subordinatesLeaves: true,
    leaveCategory: ["other_authorized"],
    statuses: ["APPROVED", "REJECTED"],
    orderBy: "DESC",
  });

  if (history.isLoading) {
    return <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1.5 }} />;
  }
  if (history.isError) {
    return <Alert severity="error">{describeError(history.error)}</Alert>;
  }
  const rows = history.data?.leaves ?? [];
  if (rows.length === 0) {
    return (
      <Typography sx={{ fontSize: 13, color: "text.secondary", py: 3 }}>
        {COPY.historyEmpty}
      </Typography>
    );
  }

  const cell = { fontSize: 12.5, fontVariantNumeric: "tabular-nums" } as const;
  return (
    <Card variant="outlined" sx={{ overflowX: "auto" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <HeadCell>{COPY.columns.employee}</HeadCell>
            <HeadCell>{COPY.columns.startDate}</HeadCell>
            <HeadCell>{COPY.columns.endDate}</HeadCell>
            <HeadCell>{COPY.columns.dayCount}</HeadCell>
            <HeadCell>{COPY.columns.status}</HeadCell>
            <HeadCell>{COPY.columns.reason}</HeadCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((lv) => (
            <TableRow key={lv.id} hover>
              <TableCell sx={{ fontSize: 12.5 }}>{lv.email}</TableCell>
              <TableCell sx={cell}>{isoDay(lv.startDate)}</TableCell>
              <TableCell sx={cell}>{isoDay(lv.endDate)}</TableCell>
              <TableCell sx={cell}>{lv.numberOfDays ?? "—"}</TableCell>
              <TableCell>
                <StatusChip status={(lv.status as LeaveStatus | null) ?? null} unknownWhenMissing />
              </TableCell>
              <TableCell sx={{ fontSize: 12.5, maxWidth: 320 }}>{lv.rejectionReason || "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
