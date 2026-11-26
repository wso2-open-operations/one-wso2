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

import { useState } from "react";
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { ActionRequiredItem } from "../api/amplifyTypes";
import { ACTION_REQUIRED_PAGE_SIZE, useActionRequired, useAmplifyMe } from "../api/useAmplifyData";
import { useClearActionRequired } from "../api/useAmplifyMutations";
import { actionRequiredReason } from "../util/actionRequired";
import { activityText } from "../util/activity";
import { SELF_CORRECTION_MESSAGE, describeAmplifyError } from "../util/amplifyError";
import { num, shortDate } from "../util/dashboardFormat";
import { signedPoints } from "../util/points";
import { SoftPill } from "./AmplifyTone";

/** The line under the Action required title. */
export const ACTION_REQUIRED_HELP =
  "These points wait for you before they become Coins. Clear a row to let it convert without another check, " +
  "or find the person below to reverse it.";

/** The toast after Clear. */
export const CLEARED_MESSAGE = "Cleared. These points convert to Coins at the next conversion.";

function personOf(e: ActionRequiredItem): string {
  return e.employeeName?.trim() || e.employeeEmail?.trim() || e.employeeId;
}

/**
 * Points & corrections' Action required list (GET /po/points/action-required): rows the pre-coin check couldn't
 * verify on LinkedIn, or that a PO held back, oldest first, each with why and a Clear button (POST
 * /po/points/{reference}/settlement `{status: HELD}`). The caller's own rows have no Clear (another PO clears them).
 * Nothing shows while the list loads or when it is empty.
 */
export default function ActionRequiredPanel() {
  const [page, setPage] = useState(0);
  const list = useActionRequired(page);
  const clear = useClearActionRequired();
  const me = useAmplifyMe();
  const { showError, showSuccess } = useNotifications();
  const [clearing, setClearing] = useState<string | null>(null);

  if (list.isPending) return null;
  if (list.isError) {
    return (
      <ErrorNotice error={list.error} onRetry={() => void list.refetch()} retrying={list.isFetching} sx={{ mb: 3 }}>
        Couldn&apos;t load the points waiting for action.
      </ErrorNotice>
    );
  }
  const { items, total } = list.data;
  if (total === 0 && page === 0) return null;
  const myId = me.data?.employee.employeeId;

  const clearRow = async (e: ActionRequiredItem) => {
    setClearing(e.reference);
    try {
      await clear.mutateAsync({ reference: e.reference, employeeId: e.employeeId });
      showSuccess(CLEARED_MESSAGE);
    } catch (err) {
      showError(describeAmplifyError(err, { SELF_REVIEW: SELF_CORRECTION_MESSAGE }));
    } finally {
      setClearing(null);
    }
  };

  return (
    <Box
      component="section"
      aria-label="Action required"
      sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, mb: 3, overflow: "hidden" }}
    >
      <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography component="h2" sx={{ fontWeight: 700, fontSize: 18 }}>
            Action required
          </Typography>
          <SoftPill>{num(total)}</SoftPill>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {ACTION_REQUIRED_HELP}
        </Typography>
      </Box>
      <Box sx={{ overflowX: "auto" }}>
        <Table aria-label="Points waiting for action">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Person</TableCell>
              <TableCell>Activity</TableCell>
              <TableCell>Post</TableCell>
              <TableCell align="right">Points</TableCell>
              <TableCell>Reason</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((e) => {
              const what = activityText(e, { forPerson: true });
              const who = personOf(e);
              return (
                <TableRow key={e.reference}>
                  <TableCell sx={{ whiteSpace: "nowrap", color: "text.secondary" }}>{shortDate(e.createdAt)}</TableCell>
                  <TableCell sx={{ overflowWrap: "anywhere" }}>{who}</TableCell>
                  <TableCell>{what}</TableCell>
                  <TableCell sx={{ overflowWrap: "anywhere" }}>{e.campaignTitle?.trim() || "—"}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap", fontWeight: 700 }}>
                    {signedPoints(e.points)}
                  </TableCell>
                  <TableCell sx={{ color: "warning.dark", fontWeight: 600 }}>{actionRequiredReason(e)}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    {e.employeeId !== myId && (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => void clearRow(e)}
                        disabled={clearing !== null}
                        aria-label={`Clear ${what} for ${who} on ${shortDate(e.createdAt)}`}
                      >
                        {clearing === e.reference ? "Clearing…" : "Clear"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>
      {total > ACTION_REQUIRED_PAGE_SIZE && (
        <TablePagination
          component="div"
          count={total}
          page={page}
          rowsPerPage={ACTION_REQUIRED_PAGE_SIZE}
          rowsPerPageOptions={[ACTION_REQUIRED_PAGE_SIZE]}
          onPageChange={(_, p) => setPage(p)}
        />
      )}
    </Box>
  );
}
