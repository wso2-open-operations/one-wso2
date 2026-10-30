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

import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { useAccessToken } from "@hooks/useAccessToken";
import { useNotifications } from "@context/notifications/NotificationsContext";
import LeaveDateField from "./LeaveDateField";
import { HeadCell } from "./SabbaticalTable";
import { StatusChip } from "./LeaveChips";
import { useSickNotes } from "../api/useLeaveData";
import { useLeaveGate } from "../api/useLeaveGate";
import { downloadSickNote } from "../util/sickNoteDownload";
import { REPORT_VALIDATION_MESSAGE, SICK_NOTES_REPORT } from "../util/leaveCopy";
import { describeError } from "../util/leaveError";
import { isoDay, toIso } from "../util/leaveDates";

const COPY = SICK_NOTES_REPORT;

function currentMonth(): { from: string; to: string } {
  const now = new Date();
  return {
    from: toIso(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: toIso(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

// Reports -> Sick notes. France sick leaves that carry a note, for People Ops
// holding the sick-note role. The backend answers 403 to anyone else, so the
// query only runs when the gate allows it.
//
// Nothing here keeps note bytes: Download hands the file straight to the
// browser (util/sickNoteDownload) and this component never sees the content.
export default function SickNotesReportTab() {
  const { canReadSickNotes } = useLeaveGate();
  const getAccessToken = useAccessToken();
  const { showError } = useNotifications();

  const [month] = useState(currentMonth);
  const [fromDate, setFromDate] = useState(month.from);
  const [toDate, setToDate] = useState(month.to);
  const [email, setEmail] = useState("");

  // A date field reports "" for an incomplete or out-of-range date.
  const rangeError = !fromDate || !toDate
    ? REPORT_VALIDATION_MESSAGE.datesRequired
    : toDate < fromDate
      ? REPORT_VALIDATION_MESSAGE.endBeforeStart
      : null;

  const notes = useSickNotes(fromDate, toDate, canReadSickNotes && !rangeError);

  const rows = useMemo(() => {
    const q = email.trim().toLowerCase();
    const all = notes.data ?? [];
    return q ? all.filter((n) => n.email.toLowerCase().includes(q)) : all;
  }, [notes.data, email]);

  // Leave ids whose download is under way. A second click while one runs would
  // fetch the note twice and write a second audit row.
  const [downloading, setDownloading] = useState<ReadonlySet<number>>(new Set());

  const download = async (leaveId: number) => {
    if (downloading.has(leaveId)) return;
    setDownloading((s) => new Set(s).add(leaveId));
    try {
      await downloadSickNote(leaveId, await getAccessToken());
    } catch (e) {
      showError(describeError(e));
    } finally {
      setDownloading((s) => {
        const next = new Set(s);
        next.delete(leaveId);
        return next;
      });
    }
  };

  return (
    <Box>
      <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 2fr" },
            gap: 1.5,
            alignItems: "start",
          }}
        >
          <LeaveDateField label="From" value={fromDate} onChange={setFromDate} />
          <LeaveDateField label="To" value={toDate} min={fromDate} onChange={setToDate} />
          <Box>
            <Typography sx={{ fontSize: 11, color: "text.secondary", mb: 0.375 }}>
              {COPY.employeeFilter}
            </Typography>
            <TextField
              size="small"
              fullWidth
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={COPY.employeeFilterPlaceholder}
              inputProps={{ "aria-label": COPY.employeeFilter }}
            />
          </Box>
        </Box>
        {rangeError && (
          <Typography sx={{ fontSize: 12.5, color: "error.main", mt: 1 }}>{rangeError}</Typography>
        )}
      </Card>

      {rangeError ? null : notes.isError ? (
        <Alert severity="error">{describeError(notes.error)}</Alert>
      ) : notes.isLoading ? (
        <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1.5 }} />
      ) : rows.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: "text.secondary", py: 3 }}>{COPY.empty}</Typography>
      ) : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <HeadCell>{COPY.columns.employee}</HeadCell>
                <HeadCell>{COPY.columns.dates}</HeadCell>
                <HeadCell>{COPY.columns.days}</HeadCell>
                <HeadCell>{COPY.columns.status}</HeadCell>
                <HeadCell>{COPY.columns.uploaded}</HeadCell>
                <HeadCell>{COPY.columns.note}</HeadCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((n) => (
                <TableRow key={n.leaveId} hover>
                  <TableCell sx={{ fontSize: 12.5 }}>{n.email}</TableCell>
                  <TableCell sx={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>
                    {isoDay(n.startDate)} – {isoDay(n.endDate)}
                  </TableCell>
                  <TableCell sx={{ fontSize: 12.5 }}>{n.numberOfDays}</TableCell>
                  <TableCell>
                    <StatusChip status={n.status} unknownWhenMissing />
                  </TableCell>
                  <TableCell sx={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>
                    {isoDay(n.uploadedAt)}
                  </TableCell>
                  <TableCell>
                    {n.deletedAt ? (
                      <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>
                        {COPY.deletedOn(isoDay(n.deletedAt))}
                      </Typography>
                    ) : (
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={downloading.has(n.leaveId)}
                        aria-label={COPY.downloadFor(n.email, isoDay(n.startDate), isoDay(n.endDate))}
                        onClick={() => void download(n.leaveId)}
                      >
                        {COPY.download}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </Box>
  );
}
