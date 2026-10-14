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


import { useMemo, useRef, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { CheckIcon } from "@wso2/oxygen-ui-icons-react";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { describeError } from "../util/financeError";
import { money, todayIso, daysAgoIso, toIso } from "../util/financeFormat";
import { RECEIPT_ACCEPT, EXPENSE_RECEIPT_MAX_BYTES, maxSizeLabel } from "../util/financeReceipts";
import { useExchangeRates, useExpenseTypes } from "./useExpense";
import type { ExpenseAppData, ExpenseTransactionPayload } from "./expenseTypes";
import { formatJobOption, formatJobOptionParts, jobSearchText, NO_JOB_OPTION, type JobOption } from "./expenseJobOption";

export const COMMENT_MAX = 100;
export const NO_JOB = NO_JOB_OPTION.jobNumber;

/**
 * A line as the form holds it: the wire payload plus the figures the form
 * derives for display (the backend recomputes them on submit).
 */
export interface DraftLine extends ExpenseTransactionPayload {
  reimbursementAmount: number;
  reimbursementCurrency: string;
  expenseType: string;
}

// One expense line, added or corrected. Shared by the New Claim screen and the
// resubmission of a rejected claim, the way the source shares ExpenseForm
// between NewClaim and ClaimDetails.
export function AddExpenseDialog({
  appData,
  editing,
  restrictionFrom,
  uploading,
  onUpload,
  onClose,
  onAdd,
}: {
  appData: ExpenseAppData;
  /** The line being corrected, if any — otherwise a new one is being added. */
  editing: DraftLine | undefined;
  /**
   * Date the past-date limit counts back from. ExpenseForm.tsx:137-139 measures
   * a resubmission from the claim's own createdDate, so correcting an old claim
   * does not fail a rule its lines already satisfied when first filed. Defaults
   * to today for a new claim.
   */
  restrictionFrom?: string;
  uploading: boolean;
  onUpload: (file: File) => Promise<string>;
  onClose: () => void;
  onAdd: (line: DraftLine) => void;
}) {
  const { showError } = useNotifications();
  const reimbursementCurrency = appData.currencyCode;
  // ExpenseForm.tsx:133-143 compares the bill date against a TIMESTAMP
  // (`now - N days`) with `isAfter`, while the date itself is midnight — so
  // midnight of N days ago is never after it, and the oldest date the source
  // accepts is N-1 days ago. "Within the last N days" counting today as the
  // first. An inclusive min at N days ago allowed one day more.
  const restrictionDays = appData.pastDateRestrictionDays;
  const minDate = useMemo(() => {
    if (restrictionDays == null) return undefined;
    const from = restrictionFrom ? new Date(restrictionFrom) : new Date();
    if (Number.isNaN(from.getTime())) return daysAgoIso(restrictionDays - 1);
    from.setDate(from.getDate() - (restrictionDays - 1));
    // `setDate` moved a LOCAL field, so the date has to be read back from local
    // fields too. `toISOString()` is UTC and names the day before between
    // midnight UTC and local midnight, which loosened the bound by a day — and
    // disagreed with the `daysAgoIso` fallback two lines up.
    return toIso(from);
  }, [restrictionDays, restrictionFrom]);

  // Seeded from the line being edited, so the dialog opens on its values.
  // ExpenseForm.tsx:81-97 does the same via initialFormData.
  const [date, setDate] = useState(editing?.date.substring(0, 10) ?? todayIso());
  const [currency, setCurrency] = useState(editing?.currency ?? reimbursementCurrency);
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [jobNumber, setJobNumber] = useState(editing?.travelJobNumber ?? NO_JOB);
  const [expenseTypeId, setExpenseTypeId] = useState<number | "">(editing?.expenseTypeId ?? "");
  const [comment, setComment] = useState(editing?.comment ?? "");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(editing?.receiptUrl ?? null);
  const [fileName, setFileName] = useState(editing?.receiptUrl ?? "");
  const fileInput = useRef<HTMLInputElement>(null);

  // The picker's `min`/`max` steer, but the field is typeable and neither
  // attribute takes part in `valid` — so both ends are checked here. The source
  // sets maxDate={new Date()} (CustomDatePicker.tsx:73): a bill cannot be dated
  // in the future.
  const today = todayIso();
  const dateWithinLimit =
    date.length > 0 && date <= today && (minDate == null || date >= minDate);

  const rates = useExchangeRates(reimbursementCurrency, date);
  const expenseTypes = useExpenseTypes(jobNumber === NO_JOB ? undefined : jobNumber);
  const expenseTypeOptions = useMemo(
    () => [...(expenseTypes.data ?? [])].sort((a, b) => a.type.localeCompare(b.type)),
    [expenseTypes.data],
  );

  // "N/A (non-travel)" first, then every job this employee travelled on —
  // the Job Number field's full option list, shared between its display
  // label and its search.
  const jobOptions = useMemo<JobOption[]>(() => [NO_JOB_OPTION, ...appData.travels], [appData.travels]);
  const selectedJob = jobOptions.find((t) => t.jobNumber === jobNumber) ?? null;

  // Conversion rate for the chosen currency: 1 when it's already the
  // reimbursement currency; null when a foreign currency has no rate in the
  // fetched list (missing, or the list is stale/loading after a date change).
  // null must NOT collapse to 1 — that would let the user submit the raw
  // foreign amount as if it were already converted.
  const rate = useMemo<number | null>(() => {
    if (currency === reimbursementCurrency) return 1;
    const found = (rates.data ?? []).find((r) => r.currencyCode === currency);
    return found ? found.exchangeRate : null;
  }, [currency, reimbursementCurrency, rates.data]);

  const currencyOptions = useMemo(() => {
    const set = new Set<string>([reimbursementCurrency, ...(rates.data ?? []).map((r) => r.currencyCode)]);
    return Array.from(set);
  }, [reimbursementCurrency, rates.data]);

  const amountNum = Number(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0;
  const rateReady = rate != null;
  const reimbursementAmount = amountValid && rateReady ? Math.round(amountNum * rate * 100) / 100 : 0;
  const selectedType = (expenseTypes.data ?? []).find((t) => t.id === expenseTypeId);
  const valid =
    dateWithinLimit &&
    amountValid &&
    rateReady &&
    expenseTypeId !== "" &&
    comment.trim().length > 0 &&
    comment.length <= COMMENT_MAX &&
    Boolean(receiptUrl);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > EXPENSE_RECEIPT_MAX_BYTES) {
      showError(`Receipt must be ${maxSizeLabel(EXPENSE_RECEIPT_MAX_BYTES)} or smaller.`);
      return;
    }
    try {
      const name = await onUpload(file);
      setReceiptUrl(name);
      setFileName(file.name);
    } catch (err) {
      showError(describeError(err));
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>{editing ? "Edit expense" : "Add an expense"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {/* Bill date gets a fixed column wide enough for its value, the
              native picker icon, and the open calendar popover without
              clipping — 220px — so it stays fully visible while Job number
              still gets the rest of the row. */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "220px 1fr" }, gap: 1.5 }}>
          <Box>
            <FieldLabel>Bill date</FieldLabel>
            <TextField
              type="date"
              size="small"
              fullWidth
              value={date}
              onChange={(e) => setDate(e.target.value)}
              error={!dateWithinLimit}
              helperText={
                dateWithinLimit
                  ? undefined
                  : date > today
                    ? "Bill date cannot be in the future"
                    : `Date within last ${restrictionDays} days required`
              }
              // aria-label on the input: the caption above is a plain
              // Typography, so without it the field has no accessible name.
              inputProps={{ min: minDate, max: today, "aria-label": "Bill date" }}
            />
          </Box>
          <Box>
            <FieldLabel>Job number</FieldLabel>
            <Autocomplete
              size="small"
              fullWidth
              disableClearable
              options={jobOptions}
              value={selectedJob ?? undefined}
              getOptionLabel={formatJobOption}
              isOptionEqualToValue={(a, b) => a.jobNumber === b.jobNumber}
              // Matches on job number, customer, or country — not just
              // whatever MUI's default label-prefix match would catch — so
              // typing a country finds every job run out of it.
              filterOptions={(options, { inputValue }) => {
                const q = inputValue.trim().toLowerCase();
                return q.length === 0 ? options : options.filter((o) => jobSearchText(o).includes(q));
              }}
              onChange={(_e, v) => {
                setJobNumber(v ? v.jobNumber : NO_JOB);
                setExpenseTypeId(""); // type list depends on the job number
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Select…"
                  // The caption above is a plain Typography, so without this
                  // the field has no accessible name at all.
                  slotProps={{ htmlInput: { ...params.inputProps, "aria-label": "Job number" } }}
                />
              )}
              // Given the field's own full-width row (not squeezed into a
              // half column next to Bill date), a normal-size label fits one
              // line for virtually every job/country combination; noWrap plus
              // the title attribute is only a fallback for the rare outlier.
              renderOption={(props, option) => {
                const { main, country } = formatJobOptionParts(option);
                return (
                  <Box component="li" {...props} key={option.jobNumber} sx={{ minWidth: 0 }}>
                    <Typography noWrap title={formatJobOption(option)} sx={{ fontSize: "inherit" }}>
                      {main}
                      {country && (
                        <Box component="span" sx={{ color: "text.secondary", fontSize: 12 }}>
                          {" "}
                          ({country})
                        </Box>
                      )}
                    </Typography>
                  </Box>
                );
              }}
            />
          </Box>
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" }, gap: 1.5, alignItems: "end" }}>
            <Box>
              <FieldLabel>Currency</FieldLabel>
              <FormControl size="small" fullWidth>
                <Select value={currency} onChange={(e) => setCurrency(String(e.target.value))} disabled={rates.isLoading}>
                  {currencyOptions.map((c) => (
                    <MenuItem key={c} value={c}>
                      {c}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box>
              <FieldLabel>Amount</FieldLabel>
              <TextField
                type="number"
                size="small"
                fullWidth
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                inputProps={{ min: 0, step: "0.01" }}
              />
            </Box>
            <Box>
              <FieldLabel>Reimbursement (est.)</FieldLabel>
              <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, px: 1.25, py: 0.9 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                  {rateReady ? money(reimbursementAmount, reimbursementCurrency) : "—"}
                </Typography>
              </Box>
              {!rateReady && (
                <Typography sx={{ fontSize: 11, color: "warning.main", mt: 0.5 }}>
                  {rates.isLoading
                    ? "Fetching exchange rate…"
                    : `No exchange rate available for ${currency} on ${date}.`}
                </Typography>
              )}
            </Box>
          </Box>

          <Box>
            <FieldLabel>Expense type</FieldLabel>
            <Autocomplete
              // The job number resetting this field externally (see below)
              // only clears its VALUE — MUI keeps typed search text as
              // separate internal state, which survives that reset while
              // the dropdown happens to be open, leaving stale text next to
              // an empty "No options" list. Remounting on job number is the
              // reliable fix: a fresh instance has no leftover typed text.
              key={jobNumber}
              size="small"
              fullWidth
              disableClearable
              options={expenseTypeOptions}
              value={selectedType}
              // The source (ExpenseForm.tsx:307) shows a spinner during the
              // refetch a new job number triggers, but never locks the field
              // over it — only `loading`, never `disabled`, here too.
              loading={expenseTypes.isLoading}
              getOptionLabel={(t) => t.type}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              onChange={(_e, v) => setExpenseTypeId(v ? v.id : "")}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Select a type…"
                  // The caption above is a plain Typography, so without this
                  // the field — required, per `valid` above — has no
                  // accessible name at all.
                  slotProps={{ htmlInput: { ...params.inputProps, "aria-label": "Expense type" } }}
                />
              )}
            />
          </Box>

          <Box>
            <FieldLabel>Description</FieldLabel>
            <TextField
              size="small"
              fullWidth
              multiline
              minRows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, COMMENT_MAX))}
              placeholder="What was this expense for?"
              helperText={`${comment.length}/${COMMENT_MAX}`}
            />
          </Box>

          <Box>
            <FieldLabel>Receipt</FieldLabel>
            <input ref={fileInput} type="file" accept={RECEIPT_ACCEPT} onChange={handleFile} style={{ display: "none" }} />
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
                sx={{ textTransform: "none", fontWeight: 600 }}
              >
                {uploading ? "Uploading…" : receiptUrl ? "Replace file" : "Upload receipt"}
              </Button>
              <Typography sx={{ fontSize: 12, color: receiptUrl ? "success.main" : "text.disabled" }} noWrap>
                {receiptUrl && (
                  <CheckIcon size={13} style={{ color: "var(--oxygen-palette-success-main)", flexShrink: 0 }} />
                )}
                {receiptUrl ? fileName : `JPG, PNG or PDF · max ${maxSizeLabel(EXPENSE_RECEIPT_MAX_BYTES)}`}
              </Typography>
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button size="small" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="small"
          variant="contained"
          disabled={!valid}
          onClick={() =>
            onAdd({
              date,
              amount: amountNum,
              currency,
              expenseTypeId: Number(expenseTypeId),
              comment: comment.trim(),
              receiptUrl,
              travelJobNumber: jobNumber === NO_JOB ? null : jobNumber,
              reimbursementAmount,
              reimbursementCurrency,
              expenseType: selectedType?.type ?? "Expense",
            })
          }
        >
          {editing ? "Save expense" : "Add expense"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      sx={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: "text.disabled", fontWeight: 600, mb: 0.75 }}
    >
      {children}
    </Typography>
  );
}
