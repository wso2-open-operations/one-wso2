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
import { describeError } from "../../util/financeError";
import { money, todayIso, daysAgoIso, toIso } from "../../util/financeFormat";
import { RECEIPT_ACCEPT, EXPENSE_RECEIPT_MAX_BYTES, maxSizeLabel } from "../../util/financeReceipts";
import { useExchangeRates } from "../useExpense";
import type { ExpenseAppData } from "../expenseTypes";
import { formatJobOption, formatJobOptionParts, jobSearchText, NO_JOB_OPTION, type JobOption } from "../expenseJobOption";
import { useSubmitterExpenseTypes } from "./useExpenseSubmitter";
import type { SubmitterDraftLine, SubmitterTravel } from "./expenseSubmitterTypes";

const RECEIPT_TYPES = new Set(RECEIPT_ACCEPT.split(","));

export const COMMENT_MAX = 100;
export const NO_JOB = NO_JOB_OPTION.jobNumber;

// One expense line on a claim being filed from the Finance side. Unlike the
// Me-side form's dialog, the job numbers and expense types it offers belong to
// whoever the claim is FOR, which is why it takes them as inputs rather than
// reading the signed-in person's `appData.travels`.
export function SubmitterLineDialog({
  appData,
  travels,
  travelsLoading,
  onBehalfOfEmail,
  onBehalfOfName,
  editing,
  restrictionFrom,
  uploading,
  onUpload,
  onClose,
  onAdd,
}: {
  appData: ExpenseAppData;
  /** The claim owner's job numbers — theirs, not necessarily the caller's. */
  travels: SubmitterTravel[];
  /** True while an on-behalf-of travels fetch is still in flight. */
  travelsLoading: boolean;
  /** Null when the caller is filing for themselves. */
  onBehalfOfEmail: string | null;
  /** That employee's display name, resolved by the caller. */
  onBehalfOfName: string | null;
  /** The line being corrected, if any — otherwise a new one is being added. */
  editing: SubmitterDraftLine | undefined;
  /**
   * Date the past-date limit counts back from. Defaults to today for a new
   * claim; the history screen passes the claim's own `createdDate` so that
   * correcting an old claim does not fail a rule its lines already satisfied
   * when they were first filed (ExpenseForm.tsx:137-139).
   */
  restrictionFrom?: string;
  uploading: boolean;
  onUpload: (file: File) => Promise<string>;
  onClose: () => void;
  onAdd: (line: SubmitterDraftLine) => void;
}) {
  const { showError } = useNotifications();
  const reimbursementCurrency = appData.currencyCode;

  // The bill date floor. `setDate` moves a LOCAL field, so the date has to be
  // read back from local fields too — `toISOString()` is UTC and names the day
  // before between midnight UTC and local midnight, loosening the bound by a
  // day and disagreeing with the `daysAgoIso` fallback.
  const restrictionDays = appData.pastDateRestrictionDays;
  const minDate = useMemo(() => {
    if (restrictionDays == null) return undefined;
    const from = restrictionFrom ? new Date(restrictionFrom.replace(" ", "T")) : new Date();
    if (Number.isNaN(from.getTime())) return daysAgoIso(restrictionDays - 1);
    from.setDate(from.getDate() - (restrictionDays - 1));
    return toIso(from);
  }, [restrictionDays, restrictionFrom]);

  // Seeded from the line being edited, so the dialog opens on its values.
  const [date, setDate] = useState(editing?.date.substring(0, 10) ?? todayIso());
  const [currency, setCurrency] = useState(editing?.currency ?? reimbursementCurrency);
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [jobNumber, setJobNumber] = useState(editing?.travelJobNumber ?? NO_JOB);
  const [expenseTypeId, setExpenseTypeId] = useState<number | "">(editing?.expenseTypeId ?? "");
  const [comment, setComment] = useState(editing?.comment ?? "");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(editing?.receiptUrl ?? null);
  const [fileName, setFileName] = useState(editing?.receiptUrl ?? "");
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // The picker's `min`/`max` steer, but the field is typeable and neither
  // attribute takes part in `valid` — so both ends are checked here. A bill
  // cannot be dated in the future.
  const today = todayIso();
  const dateWithinLimit = date.length > 0 && date <= today && (minDate == null || date >= minDate);

  const rates = useExchangeRates(reimbursementCurrency, date);
  const expenseTypes = useSubmitterExpenseTypes(
    jobNumber === NO_JOB ? undefined : jobNumber,
    onBehalfOfEmail,
  );
  const expenseTypeOptions = useMemo(
    () => [...(expenseTypes.data ?? [])].sort((a, b) => a.type.localeCompare(b.type)),
    [expenseTypes.data],
  );

  // "N/A (non-travel)" first, then every job the claim owner travelled on —
  // the Job Number field's full option list, shared between its display
  // label and its search.
  const jobOptions = useMemo<JobOption[]>(() => [NO_JOB_OPTION, ...travels], [travels]);
  const selectedJob = jobOptions.find((t) => t.jobNumber === jobNumber) ?? null;

  // Conversion rate for the chosen currency: 1 when it's already the
  // reimbursement currency; null when a foreign currency has no rate in the
  // fetched list. null must NOT collapse to 1 — that would let the raw foreign
  // amount through as if it were already converted.
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

  const acceptFile = async (file: File) => {
    if (!RECEIPT_TYPES.has(file.type)) {
      showError("Invalid file type. Please upload a JPG, PNG or PDF file.");
      return;
    }
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

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await acceptFile(file);
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>
        {editing ? "Edit expense" : "Add an expense"}
        {onBehalfOfName && (
          <Typography component="span" sx={{ fontSize: 13, fontWeight: 500, color: "text.secondary", ml: 0.75 }}>
            (for {onBehalfOfName})
          </Typography>
        )}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {/* Bill date gets a fixed column wide enough for its value, the
              native picker icon, and the open calendar popover without
              clipping — 220px — so it stays fully visible while Job number
              still gets the rest of the row. */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "220px 1fr" }, gap: 1.5 }}>
            <Box>
              <SubmitterFieldLabel>Bill date</SubmitterFieldLabel>
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
              <SubmitterFieldLabel>Job number</SubmitterFieldLabel>
              <Autocomplete
                size="small"
                fullWidth
                options={jobOptions}
                value={selectedJob ?? undefined}
                disabled={travelsLoading}
                disableClearable
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
                    slotProps={{ htmlInput: { ...params.inputProps, "aria-label": "Job number" } }}
                  />
                )}
                // Bill date's column is capped at 150px, so this one gets
                // most of the row's width even though they sit side by side;
                // noWrap plus the title attribute is only a fallback for the
                // rare job/country combination still too long for that.
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
              <SubmitterFieldLabel>Currency</SubmitterFieldLabel>
              <FormControl size="small" fullWidth>
                <Select
                  value={currency}
                  onChange={(e) => setCurrency(String(e.target.value))}
                  disabled={rates.isLoading}
                  inputProps={{ "aria-label": "Currency" }}
                >
                  {currencyOptions.map((c) => (
                    <MenuItem key={c} value={c}>
                      {c}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box>
              <SubmitterFieldLabel>Amount</SubmitterFieldLabel>
              <TextField
                type="number"
                size="small"
                fullWidth
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                inputProps={{ min: 0, step: "0.01", "aria-label": "Amount" }}
              />
            </Box>
            <Box>
              <SubmitterFieldLabel>Reimbursement (est.)</SubmitterFieldLabel>
              <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, px: 1.25, py: 0.9 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                  {rateReady ? money(reimbursementAmount, reimbursementCurrency) : "—"}
                </Typography>
                {rateReady && currency !== reimbursementCurrency && (
                  <Typography sx={{ fontSize: 10.5, color: "text.secondary" }}>
                    (1 {currency} = {rate} {reimbursementCurrency})
                  </Typography>
                )}
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
            <SubmitterFieldLabel>Expense type</SubmitterFieldLabel>
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
                  slotProps={{ htmlInput: { ...params.inputProps, "aria-label": "Expense type" } }}
                />
              )}
            />
          </Box>

          <Box>
            <SubmitterFieldLabel>Description</SubmitterFieldLabel>
            <TextField
              size="small"
              fullWidth
              multiline
              minRows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, COMMENT_MAX))}
              placeholder="What was this expense for?"
              helperText={`${comment.length}/${COMMENT_MAX}`}
              inputProps={{ "aria-label": "Description" }}
            />
          </Box>

          <Box>
            <SubmitterFieldLabel>Receipt</SubmitterFieldLabel>
            <input ref={fileInput} type="file" accept={RECEIPT_ACCEPT} onChange={handleFile} style={{ display: "none" }} />
            <Box
              onDragOver={(e: React.DragEvent) => {
                if (uploading) return;
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e: React.DragEvent) => {
                e.preventDefault();
                setDragging(false);
                if (uploading) return;
                const files = Array.from(e.dataTransfer.files);
                // A multi-file drop is refused outright rather than silently
                // taking the first one.
                if (files.length > 1) {
                  showError("Unable to upload more than one file at a time.");
                  return;
                }
                if (files[0]) void acceptFile(files[0]);
              }}
              onClick={() => !uploading && fileInput.current?.click()}
              // A receipt is required for the line to be valid, so this control
              // cannot be pointer-only — without keyboard access there is no way
              // to complete the form at all. It stays focusable while uploading
              // rather than dropping out of the tab order mid-upload.
              role="button"
              tabIndex={0}
              aria-disabled={uploading}
              aria-label={
                receiptUrl
                  ? `Receipt ${fileName}. Activate to replace it.`
                  : "Add a receipt. JPG, PNG or PDF."
              }
              onKeyDown={(e: React.KeyboardEvent) => {
                if (uploading) return;
                if (e.key === "Enter" || e.key === " ") {
                  // Space would otherwise scroll the dialog behind the control.
                  e.preventDefault();
                  fileInput.current?.click();
                }
              }}
              sx={{
                border: "1px dashed",
                borderColor: dragging ? "primary.main" : "divider",
                bgcolor: dragging ? "action.hover" : "transparent",
                borderRadius: 1,
                px: 1.5,
                py: 1.25,
                cursor: uploading ? "default" : "pointer",
                transition: "border-color .12s, background-color .12s",
                "&:hover": { borderColor: uploading ? "divider" : "primary.main" },
                "&:focus-visible": {
                  outline: "2px solid",
                  outlineColor: "primary.main",
                  outlineOffset: 2,
                },
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.25}>
                {receiptUrl && !uploading && (
                  <CheckIcon size={14} style={{ color: "var(--oxygen-palette-success-main)", flexShrink: 0 }} />
                )}
                <Typography
                  sx={{
                    fontSize: 12.5,
                    fontWeight: receiptUrl ? 600 : 400,
                    color: receiptUrl ? "success.main" : "text.primary",
                  }}
                  noWrap
                >
                  {uploading
                    ? "Uploading…"
                    : receiptUrl
                      ? fileName
                      : dragging
                        ? "Drop the receipt here"
                        : "Drop a receipt here, or click to browse"}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Typography sx={{ fontSize: 11.5, color: "text.disabled" }} noWrap>
                  {receiptUrl && !uploading
                    ? "Click to replace"
                    : `JPG, PNG or PDF · max ${maxSizeLabel(EXPENSE_RECEIPT_MAX_BYTES)}`}
                </Typography>
              </Stack>
            </Box>
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

export function SubmitterFieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      sx={{
        fontSize: 10.5,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: "text.disabled",
        fontWeight: 600,
        mb: 0.75,
      }}
    >
      {children}
    </Typography>
  );
}
