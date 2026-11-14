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
import { Fragment, type JSX } from "react";
import {
  Alert,
  Box,
  Button,
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
  Typography,
} from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import type { Issue, SalesforceChanges } from "@features/sales/cado2/quotes/api/quoteTypes";
import { changeLabel, groupChanges, shown } from "@features/sales/cado2/quotes/salesforce/salesforceChanges";

/**
 * How Salesforce differs from the draft (D173), and one refresh that takes
 * it all: from a submit stopped by the changes, or the wizard's "Refresh
 * from Salesforce". The list is the confirmation: nothing changes until the
 * AM refreshes. Problems (e.g. a price no longer in the price book) are fixed
 * first.
 *
 *   Salesforce has changed since this quote was prepared
 *   Detail                 In this quote   →   In Salesforce now
 *   Account
 *   Sales region           NA                  EU  (Changes the regional approvers)
 *                                       [Cancel] [Refresh from Salesforce]
 */
export default function SalesforceChangesDialog({
  open,
  data,
  loadError,
  stoppedSubmit,
  refreshing,
  refreshError,
  refreshProblems,
  onRefresh,
  onClose,
}: {
  readonly open: boolean;
  /** Null while loading. */
  readonly data: SalesforceChanges | null;
  readonly loadError?: unknown;
  /** Opened by a submit that was stopped. */
  readonly stoppedSubmit: boolean;
  readonly refreshing: boolean;
  readonly refreshError?: unknown;
  /** What stopped the refresh, from the server. */
  readonly refreshProblems?: readonly Issue[];
  readonly onRefresh: () => void;
  readonly onClose: () => void;
}): JSX.Element {
  const problems = [...(data?.problems ?? []), ...(refreshProblems ?? [])];
  const changes = data?.changes ?? [];
  const nothing = data !== null && changes.length === 0 && problems.length === 0;
  return (
    <Dialog open={open} onClose={() => !refreshing && onClose()} maxWidth="md" fullWidth aria-labelledby="sf-changes-title">
      <DialogTitle id="sf-changes-title">
        {nothing ? "Everything matches Salesforce" : "Salesforce has changed since this quote was prepared"}
      </DialogTitle>
      <DialogContent>
        {loadError ? (
          <ErrorNotice error={loadError}>Couldn&apos;t compare the quote with Salesforce.</ErrorNotice>
        ) : data === null ? (
          <Skeleton variant="rounded" height={160} aria-label="Comparing with Salesforce" />
        ) : nothing ? (
          <Alert severity="success">
            The account, opportunity, contacts and products on this quote are the same as in Salesforce. Nothing to refresh.
          </Alert>
        ) : (
          <Stack spacing={2}>
            {stoppedSubmit ? (
              <Alert severity="warning">
                <b>Not submitted.</b> These details differ from Salesforce. Review them, then refresh to use Salesforce&apos;s
                values.
              </Alert>
            ) : null}
            {problems.length > 0 ? (
              <Alert severity="error">
                Salesforce makes these impossible to take as they are. Fix them in the quote first, then refresh:
                <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
                  {problems.map((p) => (
                    <li key={`${p.field}|${p.message}`}>{p.message}</li>
                  ))}
                </Box>
              </Alert>
            ) : null}
            {changes.length > 0 ? (
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small" aria-label="Salesforce changes">
                  <TableHead>
                    <TableRow>
                      <TableCell>Detail</TableCell>
                      <TableCell>In this quote</TableCell>
                      <TableCell aria-hidden />
                      <TableCell>In Salesforce now</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {groupChanges(changes).map((g) => (
                      <Fragment key={g.label}>
                        <TableRow>
                          <TableCell colSpan={4} sx={{ bgcolor: "action.hover", fontWeight: 600, color: "text.secondary" }}>
                            {g.label}
                          </TableCell>
                        </TableRow>
                        {g.changes.map((c) => (
                          <TableRow key={`${c.group}|${c.subject}|${c.field}`}>
                            <TableCell>{changeLabel(c)}</TableCell>
                            <TableCell sx={{ color: "text.secondary", textDecoration: "line-through" }}>{shown(c.before)}</TableCell>
                            <TableCell aria-hidden sx={{ color: "text.secondary" }}>
                              →
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {shown(c.after)}
                              </Typography>
                              {c.effect ? (
                                <Typography variant="caption" color="text.secondary">
                                  {c.effect}
                                </Typography>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        ))}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            ) : null}
            <Typography variant="body2" color="text.secondary">
              Refreshing saves the draft with all of Salesforce&apos;s values. It isn&apos;t submitted: you check the totals and
              approvals, then submit again.
            </Typography>
            {refreshError ? <ErrorNotice error={refreshError}>Couldn&apos;t refresh the quote.</ErrorNotice> : null}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {nothing ? (
          <Button variant="contained" onClick={onClose}>
            Close
          </Button>
        ) : (
          <>
            <Button onClick={onClose} disabled={refreshing}>
              Cancel
            </Button>
            <Button variant="contained" onClick={onRefresh} disabled={refreshing || data === null || problems.length > 0 || changes.length === 0}>
              {refreshing ? "Refreshing…" : "Refresh from Salesforce"}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
