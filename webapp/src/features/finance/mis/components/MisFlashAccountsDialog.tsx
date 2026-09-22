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
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { Pencil, XIcon } from "@wso2/oxygen-ui-icons-react";
import { HttpError, humanizeHttpError } from "@api/http";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useNotifications } from "@context/notifications/NotificationsContext";
import {
  useFlashAccounts,
  useWriteFlashForecast,
  type FlashAccountsState,
} from "../api/useFlashAccounts";
import {
  flashAmount,
  type FlashAccountBook,
  type FlashAccountsQuery,
  type FlashFinancialAccount,
} from "../api/misFlashTypes";
import { flashMonthLabel, monthFromInput, monthInputValue } from "../util/misFlashPeriods";
import { flashForecastMonth } from "../util/misFlashForecastMonth";
import { MIS_VALUE_TYPES, amountUnitCaption, formatMisValue } from "../util/misMoney";
import { MIS_SCALES } from "../util/misViewVocabulary";

// The Account View: the GL accounts behind one Flash figure, and the form that
// writes a Forecast against one of them — MIS's one write besides comments.
// Ticket 16.
//
// Ported from `flashConsole/tableView.js/AccountViewTable.js` (the list) and
// `UpdateCommentDialog.js` (the form), reached as the source reaches them: a
// figure in a business unit's monthly view opens this, and on the month the
// server takes Forecasts for, each account in it has an Edit button. The
// figure itself is never edited, because it is a SUM — the backend writes one
// account's Forecast, by the account's id.
//
// ---- what is on screen is only ever what the server last said -------------
//
// Spec §10.16. The list is a read; the form holds its own draft; a save sends
// the PATCH and, once the server has taken it, the list is read again. So the
// value in the list never passes through the form on its way there, and a
// refusal leaves the list exactly as it was — the refused value exists in the
// form's input and nowhere else, and is gone when the form is.
//
// The form stays OPEN on a refusal, with what was typed still in it, which is
// the one departure from the source's shape worth naming: the source shuts its
// form on submit and reports the outcome in a snackbar, so a refused value
// simply vanishes. Here the reader sees what was refused and can correct it.
//
// ---- and the cutoff is not guessed at ---------------------------------------
//
// Spec §8.1. Edit is offered on the month the server takes Forecasts for
// (`flashForecastMonth`), on every day of it; after the 15th the server refuses
// and the form says so. The only date read here is the MONTH, when the view
// opens — never the day.

export interface MisFlashAccountsDialogProps {
  /**
   * The figure that was opened. Always one: the view is mounted while it is
   * open and unmounted to shut it, so every opening reads afresh.
   */
  query: FlashAccountsQuery;
  /** The unit as its column is headed — not `BU_LIST`'s name for it. */
  unitLabel: string;
  onClose: () => void;
}

export default function MisFlashAccountsDialog({
  query,
  unitLabel,
  onClose,
}: MisFlashAccountsDialogProps) {
  const state = useFlashAccounts(query);
  const [editing, setEditing] = useState<FlashFinancialAccount | null>(null);
  // Read when the view OPENS, as the source reads it on every render
  // (`AccountViewTable.js:53-55`) — so a Flash left open across the turn of the
  // server's month offers the new month the next time a figure is opened.
  const [forecastMonth] = useState(() => flashForecastMonth());

  // The source's own test (`getHideEdit`), on the server's month — and on the
  // month alone. The day is the server's to judge.
  const editable = query.month === monthInputValue(forecastMonth);
  const figure = figureName(query);
  const month = monthFromInput(query.month);
  // The source's title — "<category> of <unit> for <month>" — with the month
  // written as the column above it is headed. Spec §7.
  const title = `Account View — ${figure} of ${unitLabel} for ${
    month ? flashMonthLabel(month) : query.month
  }`;

  return (
    <>
      <Dialog open onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontSize: 17, fontWeight: 700, pr: 6 }}>
          {title}
          <IconButton
            aria-label="Close"
            onClick={onClose}
            sx={{ position: "absolute", right: 12, top: 12, color: "text.secondary" }}
          >
            <XIcon size={18} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {/* Units, whatever the reader's Scale. The form below takes units,
              and a list in thousands beside it invites a forecast a thousand
              times off — the one MIS grid that ignores Scale (CONTEXT.md). */}
          <Typography
            variant="caption"
            color="text.secondary"
            component="p"
            sx={{ textAlign: "right", mb: 1 }}
          >
            {amountUnitCaption(MIS_SCALES.UNITS)}
          </Typography>
          <AccountsBody
            label={`Accounts behind ${figure} for ${unitLabel}`}
            state={state}
            editable={editable}
            onEdit={setEditing}
          />
        </DialogContent>
      </Dialog>
      {editing && (
        <ForecastForm account={editing} book={query.book} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

/** "Recurring Revenue", or "Recurring Revenue COS › Infra/IT" for a sub-category. */
function figureName(query: FlashAccountsQuery): string {
  return query.accountSubCategory
    ? `${query.accountCategory} › ${query.accountSubCategory}`
    : query.accountCategory;
}

/** Units, two places — ticket 05's formatter, with Scale left at its default on purpose. */
const formatUnits = (value: unknown) =>
  formatMisValue(flashAmount(value), MIS_VALUE_TYPES.CURRENCY);

function AccountsBody({
  label,
  state,
  editable,
  onEdit,
}: {
  label: string;
  state: FlashAccountsState;
  editable: boolean;
  onEdit: (account: FlashFinancialAccount) => void;
}) {
  if (state.isLoading) {
    return (
      <Box sx={{ height: 240, display: "grid", placeItems: "center" }}>
        <CircularProgress size={28} />
      </Box>
    );
  }
  if (state.isError) {
    return (
      <ErrorNotice onRetry={state.retry} sx={{ my: 2 }}>
        Couldn&apos;t load the accounts behind this figure. {state.errorMessage}
      </ErrorNotice>
    );
  }
  if (!state.accounts.length) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
        No accounts behind this figure.
      </Typography>
    );
  }

  // A plain table: a dozen flat rows with nothing to pin, window, sort or
  // export, so neither `BuildTable` nor the DataGrid has anything to add. The
  // source's ID column — a database key — is not carried over (spec §7).
  return (
    <Table size="small" aria-label={label}>
      <TableHead>
        <TableRow>
          <TableCell>Account Name</TableCell>
          <TableCell align="right">Amount</TableCell>
          <TableCell align="right">Updated Amount</TableCell>
          <TableCell>Comment</TableCell>
          {editable && <TableCell padding="checkbox">Edit</TableCell>}
        </TableRow>
      </TableHead>
      <TableBody>
        {state.accounts.map((account, index) => (
          <TableRow key={account.id ?? `row-${index}`}>
            <TableCell component="th" scope="row">
              {account.accountName ?? ""}
            </TableCell>
            <TableCell align="right">{formatUnits(account.amount)}</TableCell>
            {/* Blank until someone writes one. The source prints `$0.00` here
                (`Number(null)`), which reads as a forecast of nought. */}
            <TableCell align="right">{formatUnits(account.budgetedValue)}</TableCell>
            <TableCell>{account.comment ?? ""}</TableCell>
            {editable && (
              <TableCell padding="checkbox">
                {/* An account without an id cannot be written: the PATCH names
                    nothing else. */}
                {account.id != null && (
                  <IconButton
                    size="small"
                    aria-label={`Edit ${account.accountName ?? ""}`}
                    onClick={() => onEdit(account)}
                  >
                    <Pencil size={14} />
                  </IconButton>
                )}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * What a refusal says.
 *
 * The flash backend turns every failure of its OWN into a bare 500
 * (`service.bal:139-143`, `:154-158`) — the entity service's cutoff message
 * included — so a 500 is the one status that may be the cutoff, and the reader
 * is told exactly that much. A body that does not bind is a 400 and a bad
 * token a 401, both before the service runs.
 * The source's message names "the 15th" and states it as the cause; the day is
 * the server's to say, and the server has not said.
 *
 * Anything else — the gateway, a dead session, a network that never reached
 * the backend — is not a cutoff, and saying it might be would send the reader
 * to the wrong explanation.
 */
function refusalOf(error: unknown): string {
  if (error instanceof HttpError && error.status === 500) {
    return (
      "Not saved — the Flash backend refused the change (HTTP 500). It refuses every " +
      "edit after the monthly cutoff, and doesn't say which refusal this was."
    );
  }
  return `Not saved — ${humanizeHttpError(error)}`;
}

function ForecastForm({
  account,
  book,
  onClose,
}: {
  account: FlashFinancialAccount;
  book: FlashAccountBook;
  onClose: () => void;
}) {
  const update = useWriteFlashForecast();
  const { showSuccess } = useNotifications();
  // Both pre-filled with what is saved. The source pre-fills them too, but
  // seeds its Update button from a field the record does not have
  // (`mis_updated_value`), so a reader who changes only the comment must
  // retype the value to send it. Spec §7.
  const [value, setValue] = useState(
    account.budgetedValue == null ? "" : String(account.budgetedValue),
  );
  const [comment, setComment] = useState(account.comment ?? "");
  const [refusal, setRefusal] = useState<string | null>(null);

  // `ForecastValueInput.value` is a required decimal, so an empty field is
  // not a value that can be sent — a forecast can be changed and never cleared.
  const parsed = value.trim() === "" ? Number.NaN : Number(value);
  const canSave = Number.isFinite(parsed) && account.id != null && !update.isPending;

  const save = () => {
    if (!canSave) return;
    setRefusal(null);
    update.mutate(
      { book, input: { id: account.id!, value: parsed, comment } },
      {
        onSuccess: () => {
          showSuccess("Account updated.");
          onClose();
        },
        onError: (error) => setRefusal(refusalOf(error)),
      },
    );
  };

  return (
    <Dialog open onClose={update.isPending ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>
        Update: {account.accountName ?? ""}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <TextField
            label="Value"
            type="number"
            size="small"
            autoFocus
            required
            value={value}
            onChange={(event) => setValue(event.target.value)}
            disabled={update.isPending}
          />
          <TextField
            label="Comment"
            size="small"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            disabled={update.isPending}
          />
          {refusal && (
            <Alert severity="error" sx={{ fontSize: 12.5 }}>
              {refusal}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button size="small" onClick={onClose} disabled={update.isPending}>
          Cancel
        </Button>
        <Button size="small" variant="contained" onClick={save} disabled={!canSave}>
          {update.isPending ? "Saving…" : "Update"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
