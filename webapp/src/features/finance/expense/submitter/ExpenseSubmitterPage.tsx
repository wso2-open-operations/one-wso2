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

import { useMemo, useState, type MouseEvent, type ReactNode } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { PencilIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import { useNavigate } from "react-router";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { isExpenseBackendConfigured, expenseServiceUrls } from "@config/apiConfig";
import { useAccessToken } from "@hooks/useAccessToken";
import { withLoadingAdornment } from "@components/picker-loading/pickerLoading";
import { FINANCE_EYEBROW } from "@constants/financeApps";
import FinanceShell from "../../components/FinanceShell";
import { DraftStatusChip } from "../../components/DraftStatusChip";
import { ReceiptViewer } from "../../components/ReceiptViewer";
import { describeError } from "../../util/financeError";
import { money, formatNice } from "../../util/financeFormat";
import { fetchReceiptObjectUrl, type ReceiptSource } from "../../util/financeReceipts";
import { useDraftAutosave } from "../../util/useDraftAutosave";
import { claimTabPath } from "../../claims/claimsTabs";
import { useExpenseEmployees } from "../useExpense";
import { useExpenseReceiptUpload } from "../useExpenseMutations";
import type { ExpenseTransactionPayload } from "../expenseTypes";
import { SubmitterLineDialog, SubmitterFieldLabel } from "./ExpenseSubmitterLineDialog";
import {
  useOnBehalfOfTravels,
  useSubmitClaimForEmployee,
  useSubmitterAppData,
  useSubmitterDraftSync,
} from "./useExpenseSubmitter";
import type { SubmitterDraftLine, SubmitterTravel } from "./expenseSubmitterTypes";

/**
 * New expense claim, filed from the Finance perspective. The same form the
 * Me-side screen offers, plus the one thing only finance can do: file the
 * claim FOR another employee, against their job numbers and routed to their
 * lead.
 */
export default function ExpenseSubmitterPage() {
  return (
    <FinanceShell
      eyebrow={FINANCE_EYEBROW.expense}
      title="New expense claim"
      subtitle="File a claim for yourself, or on behalf of another employee."
      configured={isExpenseBackendConfigured()}
      configKey="ONE_WSO2_EXPENSE_CLAIMS_BACKEND_URL"
    >
      <SubmitterBody />
    </FinanceShell>
  );
}

function SubmitterBody() {
  const appData = useSubmitterAppData();
  const employees = useExpenseEmployees();
  const upload = useExpenseReceiptUpload();
  const submit = useSubmitClaimForEmployee();
  const draft = useSubmitterDraftSync();
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotifications();
  const getAccessToken = useAccessToken();

  const [items, setItems] = useState<SubmitterDraftLine[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [confirmingDraftLoss, setConfirmingDraftLoss] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [confirmingDeleteAll, setConfirmingDeleteAll] = useState(false);
  const [receiptLoad, setReceiptLoad] = useState<(() => Promise<ReceiptSource>) | null>(null);
  // Null means "Myself", which is everyone's only option until the backend
  // says otherwise.
  const [onBehalfOfEmail, setOnBehalfOfEmail] = useState<string | null>(null);

  const email = appData.data?.userInfo.workEmail ?? "";
  const leadEmail = appData.data?.userInfo.managerEmail ?? null;

  // Resolve an address to a display name, falling back to the address itself
  // rather than printing an empty parenthetical.
  const nameFor = useMemo(() => {
    const byEmail = new Map((employees.data ?? []).map((e) => [e.workEmail, e]));
    return (addr: string): string => {
      const match = byEmail.get(addr);
      const name = match && [match.firstName, match.lastName].filter(Boolean).join(" ").trim();
      return name || addr;
    };
  }, [employees.data]);

  const leadLabel = leadEmail ? nameFor(leadEmail) : null;
  const onBehalfOfName = onBehalfOfEmail ? nameFor(onBehalfOfEmail) : null;

  // The job numbers offered are the CLAIM OWNER's. The hook is idle while no
  // one is selected, so filing for yourself never fires it.
  const onBehalfOfTravels = useOnBehalfOfTravels(onBehalfOfEmail);
  const effectiveTravels: SubmitterTravel[] = onBehalfOfEmail
    ? (onBehalfOfTravels.data ?? [])
    : (appData.data?.travels ?? []);
  // Empty for almost everyone — the picker below is hidden entirely then.
  const onBehalfOfEmployees = appData.data?.onBehalfOfEmployees ?? [];
  const reimbursementCurrency = appData.data?.currencyCode ?? "LKR";
  const total = useMemo(() => items.reduce((s, it) => s + it.reimbursementAmount, 0), [items]);

  // Trim a form line down to the wire payload (drops derived fields).
  const toPayload = (line: SubmitterDraftLine): ExpenseTransactionPayload => ({
    date: line.date,
    amount: line.amount,
    currency: line.currency,
    expenseTypeId: line.expenseTypeId,
    comment: line.comment,
    receiptUrl: line.receiptUrl,
    travelJobNumber: line.travelJobNumber ?? null,
  });

  // The saved draft is offered as an explicit choice rather than restored
  // silently, which would make a stale draft look like work in progress.
  const savedDraft = useMemo(() => {
    const drafted = appData.data?.draft?.transactions ?? [];
    // Drafts are sent as the trimmed payload, so don't assume the echoed draft
    // carries the derived figures — recompute them if absent, or the restored
    // total is NaN and renders as "Rs. 0.00".
    return drafted.map((t) => {
      const rate = Number.isFinite(t.currencyConversionRate) ? t.currencyConversionRate : 1;
      const reimbursementAmount = Number.isFinite(t.reimbursementAmount)
        ? t.reimbursementAmount
        : Math.round(t.amount * rate * 100) / 100;
      return {
        date: t.date,
        amount: t.amount,
        currency: t.currency,
        expenseTypeId: t.expenseTypeId,
        comment: t.comment ?? null,
        receiptUrl: t.receiptUrl ?? null,
        travelJobNumber: t.travelJobNumber ?? null,
        reimbursementAmount,
        reimbursementCurrency: t.reimbursementCurrency ?? reimbursementCurrency,
        expenseType: t.expenseType ?? "",
      };
    });
  }, [appData.data, reimbursementCurrency]);

  // Restoring a draft also restores WHOSE it was, which would silently
  // override whoever is currently picked. Simplest correct rule: only offer it
  // for Myself — picking someone else always starts a fresh claim for them.
  const draftOffered = items.length === 0 && savedDraft.length > 0 && onBehalfOfEmail === null;
  const savedDraftOnBehalfOf = appData.data?.draft?.onBehalfOfEmail ?? null;

  const draftState = useDraftAutosave(JSON.stringify(items), appData.isSuccess, async () => {
    if (items.length > 0) {
      await draft.save.mutateAsync({ transactions: items.map(toPayload), onBehalfOfEmail });
    } else {
      await draft.remove.mutateAsync();
    }
  });

  if (appData.isLoading) {
    return (
      <Stack spacing={1.75} sx={{ maxWidth: 1200 }}>
        <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1.5 }} />
        <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 1.5 }} />
      </Stack>
    );
  }
  if (appData.isError) {
    return <Alert severity="error">Couldn&apos;t load your expense profile. {describeError(appData.error)}</Alert>;
  }

  const handleRestoreDraft = () => {
    // Restore WHO it was for alongside the lines, batched into the same update
    // so the travels query re-keys and starts fetching immediately.
    setOnBehalfOfEmail(savedDraftOnBehalfOf);
    setItems(savedDraft);
    showSuccess("Draft restored successfully");
  };

  const handleSubmit = () => {
    if (items.length === 0) return;
    setConfirmingSubmit(false);
    submit.mutate(
      { transactions: items.map(toPayload), onBehalfOfEmail },
      {
        onSuccess: () => {
          showSuccess(
            onBehalfOfName
              ? `Expense claim submitted for ${onBehalfOfName}`
              : "Expense claim submitted to your lead",
          );
          // Delete the draft synchronously so a fast unmount can't leave it to
          // be re-seeded and submitted as a duplicate.
          draft.remove.mutate();
          setItems([]);
          // The next claim starts as your own unless you say otherwise.
          setOnBehalfOfEmail(null);
          // `replace`, so Back does not return to a form already sent.
          navigate(claimTabPath("expense"), { replace: true });
        },
        onError: (err) => showError(describeError(err)),
      },
    );
  };

  return (
    <Stack spacing={1.75} sx={{ maxWidth: 1200 }}>
      {/* Add Item, Delete All and Submit sit above the list rather than inside
          it. All three only exist once there is a line: on an empty claim the
          centred call to action below is the only way in. */}
      {items.length > 0 && (
        <Stack direction="row" spacing={1.5} justifyContent="flex-end" alignItems="center">
          <Button
            variant="outlined"
            color="error"
            onClick={() => setConfirmingDeleteAll(true)}
            sx={{ fontWeight: 600, textTransform: "none" }}
          >
            Delete All
          </Button>
          <Button
            variant="outlined"
            onClick={() => setDialogOpen(true)}
            sx={{ fontWeight: 600, textTransform: "none" }}
          >
            + Add expense
          </Button>
          <Button
            variant="contained"
            onClick={() => setConfirmingSubmit(true)}
            disabled={submit.isPending}
            sx={{ fontWeight: 600, textTransform: "none" }}
          >
            {submit.isPending ? "Submitting…" : "Submit claim"}
          </Button>
        </Stack>
      )}

      {/* Column flex so the Total row sits at the BOTTOM of the card, with the
          empty space above it rather than trailing after it. */}
      <Card variant="outlined" sx={{ p: 3, minHeight: 760, display: "flex", flexDirection: "column" }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
          <SubmitterFieldLabel>Expenses in this claim</SubmitterFieldLabel>
          {/* Once the picker is gone (below), this is the only thing saying
              whose claim this is. */}
          {items.length > 0 && onBehalfOfName && (
            <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>(for {onBehalfOfName})</Typography>
          )}
          <DraftStatusChip state={draftState} />
          <Box sx={{ flex: 1 }} />
        </Stack>

        {items.length === 0 ? (
          <Stack alignItems="center" justifyContent="center" spacing={2.5} sx={{ flex: 1, px: 2 }}>
            <Stack alignItems="center" spacing={0.5}>
              <Typography sx={{ fontSize: 14.5 }}>It looks like you haven&apos;t added any expenses yet</Typography>
              <Typography sx={{ fontSize: 13.5 }}>Let&apos;s add your expense claim.</Typography>
            </Stack>

            {/* Who this claim is for, chosen before the first line and then
                locked: the picker only exists in the empty state, so the choice
                cannot change under lines already added against that employee's
                job numbers. */}
            {onBehalfOfEmployees.length > 0 && (
              <Autocomplete
                size="small"
                disableClearable
                options={["", ...onBehalfOfEmployees]}
                getOptionLabel={(addr) => (addr === "" ? "Myself" : nameFor(addr))}
                value={onBehalfOfEmail ?? ""}
                onChange={(_e, v) => setOnBehalfOfEmail(v || null)}
                loading={employees.isLoading}
                sx={{ width: 240 }}
                renderInput={(params) => (
                  <TextField {...withLoadingAdornment(params, employees.isLoading)} label="Submitting for" />
                )}
              />
            )}

            <Stack direction="row" alignItems="center" spacing={2}>
              <Button
                variant="contained"
                onClick={() => {
                  // Starting a new line discards the saved draft.
                  if (draftOffered) {
                    setConfirmingDraftLoss(true);
                    return;
                  }
                  setDialogOpen(true);
                }}
                sx={{ fontWeight: 600, textTransform: "none" }}
              >
                + Add expense
              </Button>
              {draftOffered && (
                <>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: "text.secondary" }}>OR</Typography>
                  <Button
                    color="success"
                    variant="outlined"
                    onClick={handleRestoreDraft}
                    sx={{ textTransform: "none", fontWeight: 600 }}
                  >
                    Restore Draft
                  </Button>
                </>
              )}
            </Stack>
          </Stack>
        ) : (
          <Stack spacing={1.5} sx={{ flex: 1, alignContent: "flex-start" }}>
            {items.map((it, i) => {
              // The rate is derived from amount vs. reimbursementAmount rather
              // than stored: both already agree once the line was priced,
              // self-currency included (rate 1).
              const conversionRate = it.amount > 0 ? it.reimbursementAmount / it.amount : 0;
              return (
                <Card key={i} variant="outlined" sx={{ bgcolor: "action.hover", p: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Typography sx={{ fontSize: 12.5, fontWeight: 700, letterSpacing: "0.03em" }}>
                      EXPENSE ITEM {i + 1}
                    </Typography>
                    <Stack direction="row" spacing={0.75}>
                      <IconButton
                        size="small"
                        aria-label="Edit expense"
                        onClick={() => {
                          setEditingIndex(i);
                          setDialogOpen(true);
                        }}
                        sx={{ borderRadius: 1, bgcolor: "grey.500", color: "white", "&:hover": { bgcolor: "grey.700" } }}
                      >
                        <PencilIcon size={14} />
                      </IconButton>
                      <IconButton
                        size="small"
                        aria-label="Remove expense"
                        onClick={() => setDeletingIndex(i)}
                        sx={{ borderRadius: 1, bgcolor: "error.main", color: "white", "&:hover": { bgcolor: "error.dark" } }}
                      >
                        <XIcon size={15} />
                      </IconButton>
                    </Stack>
                  </Stack>

                  <Box sx={{ display: "flex", gap: 3, mt: 1.5 }}>
                    <Stack spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: "flex", gap: 3 }}>
                        <Box sx={{ flex: 1 }}>
                          <ItemFieldLabel>Bill Date</ItemFieldLabel>
                          <Typography sx={{ fontSize: 13 }}>{formatNice(it.date)}</Typography>
                        </Box>
                        <Box sx={{ flex: 2 }}>
                          <ItemFieldLabel>Job Number</ItemFieldLabel>
                          <Typography sx={{ fontSize: 13 }}>{it.travelJobNumber ?? "N/A"}</Typography>
                        </Box>
                      </Box>
                      <Box>
                        <ItemFieldLabel>Expense Type</ItemFieldLabel>
                        <Typography sx={{ fontSize: 13, wordBreak: "break-word" }}>{it.expenseType}</Typography>
                      </Box>
                      <Box>
                        <ItemFieldLabel>Comment</ItemFieldLabel>
                        <Typography sx={{ fontSize: 13, wordBreak: "break-word" }}>{it.comment}</Typography>
                      </Box>
                    </Stack>

                    <Stack alignItems="flex-end" spacing={1.5} sx={{ flexShrink: 0 }}>
                      <Box sx={{ textAlign: "right" }}>
                        <ItemFieldLabel>Receipt</ItemFieldLabel>
                        {it.receiptUrl ? (
                          <Stack direction="row" spacing={1}>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => {
                                const fileName = it.receiptUrl!;
                                setReceiptLoad(() => async () => {
                                  const accessToken = await getAccessToken();
                                  return fetchReceiptObjectUrl(expenseServiceUrls.receiptFile(fileName), accessToken);
                                });
                              }}
                              sx={{ fontSize: 12, textTransform: "none", color: "text.secondary", borderColor: "divider" }}
                            >
                              View
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              component="a"
                              href={expenseServiceUrls.receiptFile(it.receiptUrl)}
                              onClick={async (e: MouseEvent) => {
                                // Same binary endpoint as View, but saved
                                // straight to disk rather than previewed.
                                e.preventDefault();
                                const accessToken = await getAccessToken();
                                const { url } = await fetchReceiptObjectUrl(
                                  expenseServiceUrls.receiptFile(it.receiptUrl!),
                                  accessToken,
                                );
                                const link = document.createElement("a");
                                link.href = url;
                                link.download = it.receiptUrl!;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                URL.revokeObjectURL(url);
                              }}
                              sx={{ fontSize: 12, textTransform: "none", color: "text.secondary", borderColor: "divider" }}
                            >
                              Download
                            </Button>
                          </Stack>
                        ) : (
                          <Typography sx={{ fontSize: 13, color: "text.disabled" }}>None</Typography>
                        )}
                      </Box>

                      <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, px: 1.5, py: 1, minWidth: 220 }}>
                        <Stack direction="row" justifyContent="space-between" spacing={2}>
                          <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>Reimbursement Amount</Typography>
                          <Typography sx={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                            {money(it.reimbursementAmount, it.reimbursementCurrency)}
                          </Typography>
                        </Stack>
                        <Divider sx={{ my: 0.75 }} />
                        <Stack direction="row" justifyContent="space-between" spacing={2}>
                          <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>Conversion Rate</Typography>
                          <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
                            (1 {it.currency} = {conversionRate.toFixed(3)} {it.reimbursementCurrency})
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between" spacing={2}>
                          <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>Transaction Amount</Typography>
                          <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
                            {money(it.amount, it.currency)}
                          </Typography>
                        </Stack>
                      </Box>
                    </Stack>
                  </Box>
                </Card>
              );
            })}
          </Stack>
        )}

        {/* The running total, separate from (and always visible alongside) the
            Submit button above. */}
        {items.length > 0 && (
          <>
            <Divider sx={{ mt: 2, mb: 1 }} />
            <Stack direction="row" justifyContent="flex-end" alignItems="baseline" spacing={1}>
              <Typography sx={{ fontSize: 13 }}>Total Amount:</Typography>
              <Typography sx={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {money(total, reimbursementCurrency)}
              </Typography>
            </Stack>
          </>
        )}
      </Card>

      {submit.isError && <Alert severity="error">{describeError(submit.error)}</Alert>}

      {/* A claim leaves for review, so it is confirmed rather than sent on one
          click, and the message says who gets it. */}
      <Dialog open={confirmingSubmit} onClose={() => setConfirmingSubmit(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>Claim Submission Confirmation</DialogTitle>
        <DialogContent dividers>
          {/* Filing for someone else goes to THEIR lead, not yours, so the
              confirmation must not name your own. */}
          <Typography sx={{ fontSize: 13.5 }}>
            {onBehalfOfName ? (
              <>
                You are submitting this claim on behalf of <b>{onBehalfOfName}</b>. Once submitted, it will be
                sent to their lead for review.
              </>
            ) : (
              <>
                Are you sure you want to submit this claim? Once submitted, it will be sent to your lead
                {leadLabel && <b>{` (${leadLabel})`}</b>} for review.
              </>
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button size="small" onClick={() => setConfirmingSubmit(false)}>
            Cancel
          </Button>
          <Button size="small" variant="contained" onClick={handleSubmit} disabled={submit.isPending}>
            {submit.isPending ? "Submitting…" : "Submit"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* The saved draft goes the moment a new line is added. */}
      <Dialog open={confirmingDraftLoss} onClose={() => setConfirmingDraftLoss(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>Draft Deletion Warning</DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ fontSize: 13.5 }}>
            Adding a new claim will delete your draft. Are you sure you want to proceed?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button size="small" onClick={() => setConfirmingDraftLoss(false)}>
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={() => {
              setConfirmingDraftLoss(false);
              setDialogOpen(true);
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deletingIndex !== null} onClose={() => setDeletingIndex(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>Delete Confirmation</DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ fontSize: 13.5 }}>
            Are you sure you want to delete the claim item? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button size="small" onClick={() => setDeletingIndex(null)}>
            Cancel
          </Button>
          <Button
            size="small"
            color="error"
            variant="contained"
            onClick={() => {
              setItems((prev) => prev.filter((_, j) => j !== deletingIndex));
              setDeletingIndex(null);
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmingDeleteAll} onClose={() => setConfirmingDeleteAll(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>Delete All Confirmation</DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ fontSize: 13.5 }}>
            Are you sure you want to delete all {items.length} expense
            {items.length === 1 ? "" : "s"} in this claim? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button size="small" onClick={() => setConfirmingDeleteAll(false)}>
            Cancel
          </Button>
          <Button
            size="small"
            color="error"
            variant="contained"
            onClick={() => {
              // Emptying the list also clears the saved draft, via the same
              // autosave effect that removes it whenever items hit zero.
              setItems([]);
              setConfirmingDeleteAll(false);
            }}
          >
            Delete All
          </Button>
        </DialogActions>
      </Dialog>

      <ReceiptViewer load={receiptLoad} onClose={() => setReceiptLoad(null)} />

      {dialogOpen && appData.data && (
        <SubmitterLineDialog
          appData={appData.data}
          travels={effectiveTravels}
          travelsLoading={Boolean(onBehalfOfEmail) && onBehalfOfTravels.isLoading}
          onBehalfOfEmail={onBehalfOfEmail}
          onBehalfOfName={onBehalfOfName}
          editing={editingIndex != null ? items[editingIndex] : undefined}
          uploading={upload.isPending}
          // The receipt is filed under the person actually uploading it, even
          // when the claim is for someone else.
          onUpload={(file) => upload.mutateAsync({ email, file })}
          onClose={() => {
            setDialogOpen(false);
            setEditingIndex(null);
          }}
          onAdd={(line) => {
            setItems((prev) =>
              editingIndex != null ? prev.map((it, j) => (j === editingIndex ? line : it)) : [...prev, line],
            );
            setDialogOpen(false);
            setEditingIndex(null);
          }}
        />
      )}
    </Stack>
  );
}

// The item card's own field captions — sentence case, not the uppercase
// form-field style, since these are read-only summaries.
function ItemFieldLabel({ children }: { children: ReactNode }) {
  return <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 0.25 }}>{children}</Typography>;
}
