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

import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
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
import { useNotifications } from "@context/notifications/NotificationsContext";
import { isExpenseBackendConfigured, expenseServiceUrls } from "@config/apiConfig";
import { useAccessToken } from "@hooks/useAccessToken";
import FinanceShell from "../../components/FinanceShell";
import { DraftStatusChip } from "../../components/DraftStatusChip";
import { ReceiptViewer } from "../../components/ReceiptViewer";
import { describeError } from "../../util/financeError";
import { money, formatNice } from "../../util/financeFormat";
import { fetchReceiptObjectUrl, type ReceiptSource } from "../../util/financeReceipts";
import { useDraftAutosave } from "../../util/useDraftAutosave";
import { useExpenseAppData, useExpenseEmployees, useOnBehalfOfTravels } from "../useExpense";
import { AddExpenseDialog, FieldLabel, type DraftLine } from "../ExpenseLineDialog";
import { useExpenseDraftSync, useExpenseReceiptUpload, useSubmitExpenseClaim } from "../useExpenseMutations";
import type { ExpenseEmployeeTravel, ExpenseTransactionPayload } from "../expenseTypes";
import { withLoadingAdornment } from "@components/picker-loading/pickerLoading";
import { FINANCE_EYEBROW } from "@constants/financeApps";
import { useNavigate } from "react-router";
import { claimTabPath } from "../../claims/claimsTabs";


export default function ExpenseNewClaimPage() {
  // NewClaimBody registers the Submit button here once there's a claim to
  // submit, so it sits beside the page title rather than buried in the card.
  const [headerAction, setHeaderAction] = useState<ReactNode>(null);
  return (
    <FinanceShell
      eyebrow={FINANCE_EYEBROW.claims}
      title="New expense claim"
      action={headerAction}
      configured={isExpenseBackendConfigured()}
      configKey="ONE_WSO2_EXPENSE_CLAIMS_BACKEND_URL"
    >
      <NewClaimBody onHeaderActionChange={setHeaderAction} />
    </FinanceShell>
  );
}


function NewClaimBody({ onHeaderActionChange }: { onHeaderActionChange: (node: ReactNode) => void }) {
  const appData = useExpenseAppData();
  const upload = useExpenseReceiptUpload();
  const submit = useSubmitExpenseClaim();
  const draft = useExpenseDraftSync();
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotifications();

  const [items, setItems] = useState<DraftLine[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  // ClaimItemCard gets AccessMode.EDIT_DELETE (NewClaim.tsx:139) — a line can
  // be corrected in place, not just removed and retyped.
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [confirmingDraftLoss, setConfirmingDraftLoss] = useState(false);
  // ClaimItemCard.tsx:246-262 — removing a line is confirmed, not one click.
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [confirmingDeleteAll, setConfirmingDeleteAll] = useState(false);
  const [receiptLoad, setReceiptLoad] = useState<(() => Promise<ReceiptSource>) | null>(null);
  // NewClaim.tsx:170-198 — a finance/admin user can file this claim FOR
  // someone else. Null means "Myself", which is everyone's only option.
  const [onBehalfOfEmail, setOnBehalfOfEmail] = useState<string | null>(null);
  const getAccessToken = useAccessToken();

  const email = appData.data?.userInfo.workEmail ?? "";
  const employees = useExpenseEmployees();
  const leadEmail = appData.data?.userInfo.managerEmail ?? null;
  // AppHandler.tsx:28 resolves the lead's name from /employees and falls back
  // to the address; NewClaim.tsx:240-242 omits the parenthetical when neither
  // is known, rather than printing an empty one.
  const leadLabel = useMemo(() => {
    if (!leadEmail) return null;
    const match = (employees.data ?? []).find((e) => e.workEmail === leadEmail);
    const name = match && [match.firstName, match.lastName].filter(Boolean).join(" ").trim();
    return name || leadEmail;
  }, [employees.data, leadEmail]);

  // Same lookup as leadLabel, for whoever the claim is being filed for.
  const nameFor = useMemo(() => {
    const byEmail = new Map((employees.data ?? []).map((e) => [e.workEmail, e]));
    return (addr: string): string => {
      const match = byEmail.get(addr);
      const name = match && [match.firstName, match.lastName].filter(Boolean).join(" ").trim();
      return name || addr;
    };
  }, [employees.data]);
  const onBehalfOfName = onBehalfOfEmail ? nameFor(onBehalfOfEmail) : null;

  // ExpenseForm.tsx:66 — the job numbers offered are the CLAIM OWNER's, so
  // filing for someone else swaps in theirs. The hook is disabled while no one
  // is selected, so the self case never fires it.
  const onBehalfOfTravels = useOnBehalfOfTravels(onBehalfOfEmail);
  const effectiveTravels: ExpenseEmployeeTravel[] = onBehalfOfEmail
    ? (onBehalfOfTravels.data ?? [])
    : (appData.data?.travels ?? []);
  // Empty for almost everyone — the picker below is hidden entirely then.
  const onBehalfOfEmployees = appData.data?.onBehalfOfEmployees ?? [];
  const reimbursementCurrency = appData.data?.currencyCode ?? "LKR";
  const total = useMemo(() => items.reduce((s, it) => s + it.reimbursementAmount, 0), [items]);

  // NewClaim.tsx:83-96 — Add Item and Submit sit together at the top right of
  // the page, not inside the list card. Both only exist once there is a line:
  // on an empty claim the centred call to action below is the only way in.
  useEffect(() => {
    if (items.length === 0) {
      onHeaderActionChange(null);
      return;
    }
    onHeaderActionChange(
      <Stack direction="row" spacing={1.5} alignItems="center">
        {/* Clears every line at once. Confirmed like the single-line delete —
            it throws away more work, not less. */}
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
          {/* Just the action — the amount is the Total row at the foot of the
              card, the way NewClaim.tsx's SUBMIT + AmountFooter split it. */}
          {submit.isPending ? "Submitting…" : "Submit claim"}
        </Button>
      </Stack>,
    );
    // Unregister on unmount so a stale button doesn't linger if this body
    // ever goes away while the shell stays mounted.
    return () => onHeaderActionChange(null);
  }, [items.length, submit.isPending, onHeaderActionChange]);

  // Trim a form line down to the wire payload (drops derived fields).
  const toPayload = (line: DraftLine): ExpenseTransactionPayload => ({
    date: line.date,
    amount: line.amount,
    currency: line.currency,
    expenseTypeId: line.expenseTypeId,
    comment: line.comment,
    receiptUrl: line.receiptUrl,
    travelJobNumber: line.travelJobNumber ?? null,
  });

  // NewClaim.tsx:200-216 puts the saved draft behind an explicit "Restore
  // Draft" choice beside "Create Claim". Restoring it silently makes a stale
  // draft look like work in progress, and leaves no way to start fresh without
  // first deleting lines you never entered this session.
  const savedDraft = useMemo(() => {
    const drafted = appData.data?.draft?.transactions ?? [];
    return (
      // We send drafts as the trimmed payload (no derived fields), so don't
      // assume the echoed draft carries reimbursementAmount / currency /
      // expenseType — recompute them if absent, or the restored total is
      // NaN and renders as "Rs. 0.00".
      drafted.map((t) => {
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
      })
    );
  }, [appData.data, reimbursementCurrency]);

  // Restoring a draft also restores WHOSE it was (handleRestoreDraft sets
  // onBehalfOfEmail from the draft itself), which would silently override
  // whoever is currently picked. Simplest correct rule: only offer it for
  // Myself — picking someone else always starts a fresh claim for them.
  const draftOffered = items.length === 0 && savedDraft.length > 0 && onBehalfOfEmail === null;
  // A draft filed for someone else comes back knowing who — appDataSlice.ts:49.
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
    return <Alert severity="error">Couldn't load your expense profile. {describeError(appData.error)}</Alert>;
  }

  // NewClaim.tsx:64-69. No year checks here — unlike OPD an expense claim is
  // not filed against a single year's balance.
  const handleRestoreDraft = () => {
    // Restore WHO it was for alongside the lines — batched into the same
    // update, so useOnBehalfOfTravels re-keys and starts fetching that
    // employee's job numbers immediately.
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
          // Delete the draft synchronously (see OPD note) so a fast unmount
          // can't leave it to be re-seeded and submitted as a duplicate.
          draft.remove.mutate();
          setItems([]);
          // newClaimSlice.ts:161-167 clears this on a successful submit — the
          // next claim starts as your own unless you say otherwise.
          setOnBehalfOfEmail(null);
          // Back to the list the claim just joined, so the submission has a
          // visible result rather than leaving an emptied form on screen.
          //
          // `replace`, so Back does not return to a form that has already been
          // sent — it goes wherever the user was before they opened it.
          navigate(claimTabPath("expense"), { replace: true });
        },
        onError: (err) => showError(describeError(err)),
      },
    );
  };

  return (
    <Stack spacing={1.75} sx={{ maxWidth: 1200 }}>
      {/* Column flex so the Total row below sits at the BOTTOM of the card
          (AmountFooter.tsx's placement), with the empty space above it
          rather than trailing after it. */}
      <Card variant="outlined" sx={{ p: 3, minHeight: 760, display: "flex", flexDirection: "column" }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
          <FieldLabel>Expenses in this claim</FieldLabel>
          {/* NewClaim.tsx:99 — once the picker is gone (below), this is the
              only thing saying whose claim this is. */}
          {items.length > 0 && onBehalfOfName && (
            <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>(for {onBehalfOfName})</Typography>
          )}
          <DraftStatusChip state={draftState} />
          <Box sx={{ flex: 1 }} />
        </Stack>

        {items.length === 0 ? (
          // NewClaim.tsx:163-215 — the empty state's outline: what to do, who
          // it is for, then the way in (and the draft as the alternative).
          <Stack alignItems="center" justifyContent="center" spacing={2.5} sx={{ flex: 1, px: 2 }}>
            <Stack alignItems="center" spacing={0.5}>
              <Typography sx={{ fontSize: 14.5 }}>
                It looks like you haven&apos;t added any expenses yet
              </Typography>
              <Typography sx={{ fontSize: 13.5 }}>Let&apos;s add your expense claim.</Typography>
            </Stack>

            {/* :170-198 — who this claim is for, chosen before the first line
                and then locked: the picker only exists in the empty state, so
                the choice cannot change under lines already added against that
                employee's job numbers. */}
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

            {/* :194-232 — Create Claim, with the saved draft offered beside it
                as the OR rather than replacing it. */}
            <Stack direction="row" alignItems="center" spacing={2}>
              <Button
                variant="contained"
                onClick={() => {
                  // :187-193 — starting a new line discards the saved draft.
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
            {/* ClaimItemCard.tsx:74-247 — the full item card (every field,
                Receipt View/Download, and the detailed Reimbursement
                breakdown), not a condensed one-liner. */}
            {items.map((it, i) => {
              // ClaimItemCard never stores the rate — it derives it from
              // amount vs. reimbursementAmount for the same reason: both
              // already agree once the line was priced, self-currency
              // included (rate 1).
              const conversionRate = it.amount > 0 ? it.reimbursementAmount / it.amount : 0;
              return (
                <Card key={i} variant="outlined" sx={{ bgcolor: "action.hover", p: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Typography sx={{ fontSize: 12.5, fontWeight: 700, letterSpacing: "0.03em" }}>
                      EXPENSE ITEM {i + 1}
                    </Typography>
                    {/* ClaimItemCard.tsx:82-134 — filled squares (grey for
                        edit, red for delete), not plain hover-tinted icons. */}
                    <Stack direction="row" spacing={0.75}>
                      <IconButton
                        size="small"
                        aria-label="Edit expense"
                        onClick={() => {
                          setEditingIndex(i);
                          setDialogOpen(true);
                        }}
                        sx={{
                          borderRadius: 1,
                          bgcolor: "grey.500",
                          color: "white",
                          "&:hover": { bgcolor: "grey.700" },
                        }}
                      >
                        <PencilIcon size={14} />
                      </IconButton>
                      <IconButton
                        size="small"
                        aria-label="Remove expense"
                        onClick={() => setDeletingIndex(i)}
                        sx={{
                          borderRadius: 1,
                          bgcolor: "error.main",
                          color: "white",
                          "&:hover": { bgcolor: "error.dark" },
                        }}
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

                      {/* AmountPreviewCard.tsx:89-125 (isDetailedCard) — main
                          amount, then Conversion Rate and Transaction Amount
                          as their own rows. */}
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
        {/* AmountFooter.tsx — the running total, separate from (and always
            visible alongside) the Submit button's own total. */}
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

      {/* NewClaim.tsx:225-248 — a claim leaves for review, so it is confirmed
          rather than sent on one click, and the message says who gets it. */}
      <Dialog open={confirmingSubmit} onClose={() => setConfirmingSubmit(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>Claim Submission Confirmation</DialogTitle>
        <DialogContent dividers>
          {/* :243-246 — filing for someone else goes to THEIR lead, not
              yours, so the confirmation must not name your own. */}
          <Typography sx={{ fontSize: 13.5 }}>
            {onBehalfOfName ? (
              <>
                You are submitting this claim on behalf of <b>{onBehalfOfName}</b>. Once submitted, it
                will be sent to their lead for review.
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

      {/* :263-270 — the saved draft goes the moment a new line is added. */}
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

      {/* ClaimItemCard.tsx:246-262 */}
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
        <AddExpenseDialog
          appData={appData.data}
          travels={effectiveTravels}
          travelsLoading={Boolean(onBehalfOfEmail) && onBehalfOfTravels.isLoading}
          onBehalfOfEmail={onBehalfOfEmail}
          onBehalfOfName={onBehalfOfName}
          editing={editingIndex != null ? items[editingIndex] : undefined}
          uploading={upload.isPending}
          // FileUploadArea.tsx:30 — the receipt is filed under the person
          // actually uploading it, even when the claim is for someone else.
          onUpload={(file) => upload.mutateAsync({ email, file })}
          onClose={() => {
            setDialogOpen(false);
            setEditingIndex(null);
          }}
          onAdd={(line) => {
            setItems((prev) =>
              editingIndex != null
                ? prev.map((it, j) => (j === editingIndex ? line : it))
                : [...prev, line],
            );
            setDialogOpen(false);
            setEditingIndex(null);
          }}
        />
      )}
    </Stack>
  );
}

// ClaimItemCard.tsx:144,152,161,169,179 — the item card's own field
// captions (sentence case, not the uppercase form-field style of
// ExpenseLineDialog's FieldLabel, since these are read-only summaries).
function ItemFieldLabel({ children }: { children: ReactNode }) {
  return (
    <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 0.25 }}>{children}</Typography>
  );
}
