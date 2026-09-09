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
const RECEIPT_TYPES = new Set(RECEIPT_ACCEPT.split(","));
import { useExchangeRates, useExpenseTypes } from "./useExpense";
import type {
  ExpenseAppData,
  ExpenseEmployeeTravel,
  ExpenseTransactionPayload,
} from "./expenseTypes";

export const COMMENT_MAX = 100;
export const NO_JOB = "N/A";

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
  travels,
  travelsLoading,
  onBehalfOfEmail = null,
  onBehalfOfName = null,
  editing,
  restrictionFrom,
  uploading,
  onUpload,
  onClose,
  onAdd,
}: {
  appData: ExpenseAppData;
  /**
   * Job numbers to offer. Omit for the ordinary case — the signed-in person's
   * own `appData.travels`. The New Claim screen passes an explicit list
   * because filing on behalf of someone else swaps in THEIR job numbers
   * (ExpenseForm.tsx:66).
   */
  travels?: ExpenseEmployeeTravel[];
  /** True while an on-behalf-of travels fetch is still in flight. */
  travelsLoading?: boolean;
  /** Set when this line is being added to a claim filed for someone else. */
  onBehalfOfEmail?: string | null;
  /** That employee's display name, resolved by the caller (ExpenseForm.tsx:68-69). */
  onBehalfOfName?: string | null;
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
  // Omitted means "the signed-in person's own", which is what appData carries.
  const jobNumbers: ExpenseEmployeeTravel[] = travels ?? appData.travels;
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
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // The picker's `min`/`max` steer, but the field is typeable and neither
  // attribute takes part in `valid` — so both ends are checked here. The source
  // sets maxDate={new Date()} (CustomDatePicker.tsx:73): a bill cannot be dated
  // in the future.
  const today = todayIso();
  const dateWithinLimit =
    date.length > 0 && date <= today && (minDate == null || date >= minDate);

  const rates = useExchangeRates(reimbursementCurrency, date);
  const expenseTypes = useExpenseTypes(jobNumber === NO_JOB ? undefined : jobNumber, onBehalfOfEmail);

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
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
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
              <FormControl size="small" fullWidth>
                <Select
                  value={jobNumber}
            
                  disabled={travelsLoading}
                  onChange={(e) => {
                    setJobNumber(String(e.target.value));
                    setExpenseTypeId(""); // type list depends on the job number
                  }}
                >
                  <MenuItem value={NO_JOB}>N/A (non-travel)</MenuItem>
                  {jobNumbers.map((t) => (
                    <MenuItem key={t.jobNumber} value={t.jobNumber}>
                      {t.jobNumber}
                      {t.customerName ? ` — ${t.customerName}` : ""}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
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
                {/* AmountPreviewCard.tsx:74-86 — the rate the estimate above
                    was computed from, live as the amount/currency change. */}
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
            <FieldLabel>Expense type</FieldLabel>
            <FormControl size="small" fullWidth>
              <Select<number | "">
                value={expenseTypeId}
                onChange={(e) => setExpenseTypeId(e.target.value === "" ? "" : Number(e.target.value))}
                disabled={expenseTypes.isLoading}
                displayEmpty
                renderValue={(v) => (v === "" ? <span style={{ opacity: 0.6 }}>Select a type…</span> : selectedType?.type ?? String(v))}
              >
                {(expenseTypes.data ?? []).map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.type}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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
                // :94-97 — a multi-file drop is refused outright rather than
                // silently taking the first one.
                if (files.length > 1) {
                  showError("Unable to upload more than one file at a time.");
                  return;
                }
                if (files[0]) void acceptFile(files[0]);
              }}
              onClick={() => !uploading && fileInput.current?.click()}
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
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.25}>
                {receiptUrl && !uploading && (
                  <CheckIcon size={14} style={{ color: "var(--oxygen-palette-success-main)", flexShrink: 0 }} />
                )}
                <Typography
                  sx={{ fontSize: 12.5, fontWeight: receiptUrl ? 600 : 400, color: receiptUrl ? "success.main" : "text.primary" }}
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

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      sx={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: "text.disabled", fontWeight: 600, mb: 0.75 }}
    >
      {children}
    </Typography>
  );
}
