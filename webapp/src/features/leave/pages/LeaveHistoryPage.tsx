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

import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { describeError } from "../util/leaveError";
import { useAccessToken } from "@hooks/useAccessToken";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { StatusChip } from "../components/LeaveChips";
import {
  GENERAL_LEAVE_TYPES,
  LEAVE_TYPE_ICON,
  LEAVE_TYPE_ICON_FALLBACK,
  LEAVE_TYPE_LABEL,
  STATUS_COLOR,
  STATUS_LABEL,
  UNCOUNTED_LEAVE_TYPES,
  type DatabaseLeave,
  type LeaveStatus,
  type LeaveType,
} from "../api/leaveTypes";
import { useLeaveUserInfo, useLeaves } from "../api/useLeaveData";
import { useCancelLeave } from "../api/useLeaveMutations";
import {
  dayNumber,
  endOfYearIso,
  formatNice,
  monthAbbr,
  parseIso,
  startOfYearIso,
} from "../util/leaveDates";
import {
  COUNTED_STATUSES,
  HISTORY_STATUSES,
  canCancelLeave,
  canDownloadSickNote,
} from "../util/franceLeave";
import { downloadSickNote } from "../util/sickNoteDownload";
import {
  CANCEL_CONFIRMATION,
  HISTORY_CARD_COPY,
  SnackMessage,
  noLeaveHistoryFor,
} from "../util/leaveCopy";

// The same wording and the same chip the lead report uses for its own day
// total (LeaveReportsPage.tsx:306-311), so the two screens agree.
const dayCount = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

const CHIP_SX = { height: 22, fontSize: 11, fontWeight: 600 } as const;

// The two tabs of My History (route.ts:112-127). Both are the same screen with
// a different category filter, which is how the source shares one LeaveHistory
// component between GeneralLeaveHistory and SabbaticalLeaveHistory.
export default function GeneralHistoryTab() {
  return <HistoryBody leaveCategory={GENERAL_LEAVE_TYPES} groupBy="type" />;
}

/**
 * Which dimension the chips above the cards group by, per tab.
 *
 * Whichever one is not constant. General leave varies mostly by leave type, so
 * it groups by type (Other Authorized can also be pending or rejected, but
 * the chips there show counted days only). Sabbaticals are all one type and are created pending
 * (sabbatical_leave.bal:158) until a lead acts on them, so there status is what
 * varies and a single "Sabbatical 30 days" chip would hide the part still
 * waiting on someone.
 */
type HistoryGrouping = "type" | "status";

const SABBATICAL_CATEGORY: LeaveType[] = ["sabbatical"];

// The counted statuses first, then the two that end a request without leave.
const STATUS_ORDER: LeaveStatus[] = ["APPROVED", "PENDING", "REJECTED", "CANCELLED"];

export function SabbaticalHistoryTab() {
  return <HistoryBody leaveCategory={SABBATICAL_CATEGORY} groupBy="status" />;
}

// The body is shared by the general history page and the Sabbatical tab, the
// way the source shares one LeaveHistory component between GeneralLeaveHistory
// and SabbaticalLeaveHistory — same year selector, same cards, same 30-day
// cancel rule, only the category filter differs.
export function HistoryBody({
  leaveCategory,
  groupBy,
}: {
  leaveCategory: LeaveType[];
  groupBy: HistoryGrouping;
}) {
  const userInfo = useLeaveUserInfo();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [target, setTarget] = useState<DatabaseLeave | null>(null);

  const workEmail = userInfo.data?.workEmail ?? undefined;
  const leaves = useLeaves(
    {
      email: workEmail,
      startDate: startOfYearIso(year),
      endDate: endOfYearIso(year),
      statuses: HISTORY_STATUSES,
      orderBy: "DESC",
      leaveCategory,
    },
    Boolean(workEmail),
  );

  // Days per leave type across the cards below, plus their sum.
  //
  // The calendar-year window these sum over is the entitlement window too, for
  // every location and type but one: `getLeavePeriodBounds` (utils.bal:363-379)
  // returns Jan 1 - Dec 31 for everything except France's Congés Payés, which
  // runs June 1 of the previous year to May 31. So for a French employee this
  // chip and the Congés Payés balance on Apply count different spans; for
  // everyone else the year selector lines them up exactly.
  //
  // Still a sum of the cards below rather than a balance: the balance applies
  // the server's own `policyAdjustedLeave`, which these do not model.
  //
  // Pending rows are possible on both tabs: sabbaticals and Other Authorized
  // are created pending until a lead decides, while the other general types are
  // created already approved by the backend. Pending days count toward the
  // totals; rejected and cancelled days never do.
  //
  // Ordered by `leaveCategory` rather than by arrival, so the chips keep the
  // same order from one year to the next instead of following whatever order
  // the server returned.
  const summary = useMemo(() => {
    const days = new Map<string, number>();
    for (const lv of leaves.data?.leaves ?? []) {
      // By type, rejected and cancelled leave is not leave taken, so it adds to
      // no chip. By status it gets its own chip, and the total below skips it.
      if (groupBy === "type" && !COUNTED_STATUSES.includes(lv.status ?? "PENDING")) continue;
      // A row with no status counts as pending, the same assumption StatusChip
      // makes on the card itself (LeaveChips.tsx:45-48).
      const key = groupBy === "status" ? (lv.status ?? "PENDING") : (lv.leaveType ?? "");
      days.set(key, (days.get(key) ?? 0) + (lv.numberOfDays ?? 0));
    }
    const order: string[] = groupBy === "status" ? STATUS_ORDER : leaveCategory;
    const rank = new Map(order.map((k, i) => [k, i]));
    const groups = [...days.entries()]
      .map(([key, total]) => ({
        key,
        total,
        ...(groupBy === "status"
          ? {
              // Same words and same colours as the status chip on each card, so
              // the summary and the cards cannot describe a row differently.
              label: Object.hasOwn(STATUS_LABEL, key)
                ? STATUS_LABEL[key as LeaveStatus]
                : key,
              color: Object.hasOwn(STATUS_COLOR, key)
                ? STATUS_COLOR[key as LeaveStatus]
                : ("default" as const),
            }
          : {
              // The card's own fallback: a type the app does not know is shown
              // under the server's name rather than dropped.
              label: Object.hasOwn(LEAVE_TYPE_LABEL, key)
                ? LEAVE_TYPE_LABEL[key as LeaveType]
                : key || "Leave",
              color: undefined,
            }),
      }))
      .sort((a, b) => (rank.get(a.key) ?? Infinity) - (rank.get(b.key) ?? Infinity));
    // Lieu is shown but not summed. Grouping by status cannot produce an
    // uncounted type key, so that filter is a no-op on the Sabbatical tab.
    const uncounted = new Set<string>(UNCOUNTED_LEAVE_TYPES);
    return {
      groups,
      total: groups.reduce(
        (sum, g) =>
          uncounted.has(g.key) || (groupBy === "status" && !COUNTED_STATUSES.includes(g.key as LeaveStatus))
            ? sum
            : sum + g.total,
        0,
      ),
      excluded: groups.filter((g) => uncounted.has(g.key)).map((g) => g.label),
    };
  }, [leaves.data, leaveCategory, groupBy]);

  const years = useMemo(() => {
    const startYear = parseIso(userInfo.data?.employmentStartDate)?.getFullYear() ?? currentYear;
    const out: number[] = [];
    for (let y = currentYear; y >= startYear; y--) out.push(y);
    return out.length ? out : [currentYear];
  }, [userInfo.data?.employmentStartDate, currentYear]);

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1.5, mb: 2 }}>
        <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>Year</Typography>
        <FormControl size="small">
          <Select value={year} onChange={(e) => setYear(Number(e.target.value))} sx={{ minWidth: 110 }}>
            {years.map((y) => (
              <MenuItem key={y} value={y}>
                {y}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {summary.groups.length > 0 && (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, ml: { sm: "auto" } }}>
            {summary.groups.map((g) => (
              <Chip key={g.key} label={`${g.label} ${dayCount(g.total)}`} color={g.color} size="small" variant="outlined" sx={CHIP_SX} />
            ))}
            {/* Only worth showing once there is more than one group to add up:
                with a single type the total repeats the chip beside it. */}
            {summary.groups.length > 1 && (
              // Says so when it is not simply the chips beside it added up.
              <Tooltip
                title={
                  summary.excluded.length > 0
                    ? `${summary.excluded.join(" and ")} not counted toward the total`
                    : ""
                }
              >
                <Chip label={`Total: ${dayCount(summary.total)}`} size="small" color="primary" variant="outlined" sx={CHIP_SX} />
              </Tooltip>
            )}
          </Box>
        )}
      </Box>

      {userInfo.isLoading || leaves.isLoading ? (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" }, gap: 1.5 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rectangular" height={96} sx={{ borderRadius: 1.5 }} />
          ))}
        </Box>
      ) : leaves.isError ? (
        <Alert severity="error">Couldn't load your leave. {describeError(leaves.error)}</Alert>
      ) : (leaves.data?.leaves.length ?? 0) === 0 ? (
        <Typography sx={{ fontSize: 13, color: "text.secondary", py: 3 }}>
          {noLeaveHistoryFor(year)}
        </Typography>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" }, gap: 1.5 }}>
          {leaves.data!.leaves.map((lv) => (
            <LeaveCard key={lv.id} leave={lv} onCancel={() => setTarget(lv)} />
          ))}
        </Box>
      )}

      <CancelDialog leave={target} onClose={() => setTarget(null)} />
    </Box>
  );
}

function LeaveCard({ leave, onCancel }: { leave: DatabaseLeave; onCancel: () => void }) {
  const t = (leave.leaveType as LeaveType | null) ?? null;
  const typeLabel = t && t in LEAVE_TYPE_LABEL ? LEAVE_TYPE_LABEL[t] : (leave.leaveType ?? "Leave");
  const TypeIcon = t && t in LEAVE_TYPE_ICON ? LEAVE_TYPE_ICON[t] : LEAVE_TYPE_ICON_FALLBACK;
  const cancellable = canCancelLeave(leave.status, leave.startDate, new Date());
  // Rejected and cancelled leave has no Cancel button at all; the 30-day
  // tooltip only explains a disabled button on a leave that could be cancelled.
  const cancelOffered = leave.status === "APPROVED" || leave.status === "PENDING";
  const { showError } = useNotifications();
  const getAccessToken = useAccessToken();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadSickNote(leave.id, await getAccessToken());
    } catch (err) {
      showError(describeError(err));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card variant="outlined" sx={{ p: 1.75, display: "flex", gap: 1.5, alignItems: "flex-start" }}>
      {/* Mini calendar */}
      <Box
        sx={{
          width: 44,
          flexShrink: 0,
          textAlign: "center",
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
          overflow: "hidden",
        }}
      >
        <Box sx={{ bgcolor: "primary.main", color: "primary.contrastText", fontSize: 9, fontWeight: 700, py: 0.25, letterSpacing: "0.04em" }}>
          {monthAbbr(leave.startDate)}
        </Box>
        <Box sx={{ fontSize: 18, fontWeight: 700, py: 0.25, fontVariantNumeric: "tabular-nums" }}>
          {dayNumber(leave.startDate)}
        </Box>
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.25 }}>
          <TypeIcon size={14} style={{ flexShrink: 0 }} />
          <Typography sx={{ fontSize: 13.5, fontWeight: 600, flex: 1, minWidth: 0 }} noWrap>
            {typeLabel}
          </Typography>
          <StatusChip status={leave.status} />
        </Stack>
        <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
          {formatNice(leave.startDate)} → {formatNice(leave.endDate)}
        </Typography>
        <Typography sx={{ fontSize: 11.5, color: "text.disabled", fontVariantNumeric: "tabular-nums" }}>
          {leave.numberOfDays ?? "—"} day{leave.numberOfDays === 1 ? "" : "s"}
        </Typography>
        {leave.status === "REJECTED" && leave.rejectionReason && (
          <Typography sx={{ fontSize: 12, color: "error.main", mt: 0.5, overflowWrap: "anywhere" }}>
            {HISTORY_CARD_COPY.rejectionReason(leave.rejectionReason)}
          </Typography>
        )}
        {leave.leaveType === "sick" && canDownloadSickNote(leave) && (
          <Button size="small" onClick={handleDownload} disabled={downloading} sx={{ mt: 0.5, px: 0, minWidth: 0 }}>
            {HISTORY_CARD_COPY.downloadSickNote}
          </Button>
        )}
        {leave.leaveType === "sick" && leave.sickNoteDeletedOn && (
          <Typography sx={{ fontSize: 11.5, color: "text.disabled", mt: 0.5 }}>
            {HISTORY_CARD_COPY.sickNoteDeleted(formatNice(leave.sickNoteDeletedOn))}
          </Typography>
        )}
      </Box>

      {cancelOffered && (
        <Tooltip title={cancellable ? "Cancel this leave" : HISTORY_CARD_COPY.cancelPastWindow}>
          <span>
            <IconButton
              size="small"
              aria-label="Cancel leave"
              disabled={!cancellable}
              onClick={onCancel}
              sx={{
                width: 26,
                height: 26,
                border: 1,
                borderColor: "divider",
                borderRadius: 0.75,
                color: "text.secondary",
                "&:hover": { color: "error.main", borderColor: "error.main" },
              }}
            >
              <TrashIcon />
            </IconButton>
          </span>
        </Tooltip>
      )}
    </Card>
  );
}

function CancelDialog({ leave, onClose }: { leave: DatabaseLeave | null; onClose: () => void }) {
  const cancel = useCancelLeave();
  const { showSuccess, showError } = useNotifications();
  // The same name the row shows. The source builds "${Capitalised} Leave" here,
  // which renders "Conges_payes Leave"; we keep the row's label instead.
  const cancelType = leave?.leaveType as LeaveType | undefined;
  const cancelLeaveLabel =
    cancelType && cancelType in LEAVE_TYPE_LABEL ? LEAVE_TYPE_LABEL[cancelType] : "leave";

  const handleConfirm = () => {
    if (!leave) return;
    cancel.mutate(leave.id, {
      onSuccess: () => {
        showSuccess(SnackMessage.success.cancelLeaveMessage);
        onClose();
      },
      onError: (err) => showError(describeError(err)),
    });
  };

  return (
    <Dialog open={!!leave} onClose={cancel.isPending ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>{CANCEL_CONFIRMATION.title}</DialogTitle>
      <DialogContent dividers>
        {/* The source names the leave and its dates and says the action is
            final — LeaveCard.tsx:50-57. It makes no claim about who gets
            told, so neither do we. */}
        <Typography sx={{ fontSize: 13.5 }}>
          {CANCEL_CONFIRMATION.body({
            leaveLabel: cancelLeaveLabel,
            startDate: formatNice(leave?.startDate),
            endDate: formatNice(leave?.endDate),
          })}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button size="small" onClick={onClose} disabled={cancel.isPending}>
          {CANCEL_CONFIRMATION.dismiss}
        </Button>
        <Button size="small" color="error" variant="contained" onClick={handleConfirm} disabled={cancel.isPending}>
          {cancel.isPending ? "Cancelling…" : CANCEL_CONFIRMATION.confirm}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function TrashIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2" />
    </svg>
  );
}
