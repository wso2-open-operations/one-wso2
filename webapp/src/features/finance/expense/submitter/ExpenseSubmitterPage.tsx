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

import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
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

/** Never shrink below this, however little room the window leaves. */
const MIN_CARD_HEIGHT = 420;

/**
 * How long a receipt's object URL is kept alive after a download is triggered.
 * Long enough for the browser to have read the blob, short enough not to hold
 * a file in memory for the rest of the session.
 */
const RECEIPT_URL_TTL_MS = 60_000;

/**
 * How tall the claim card may grow: everything between its top edge and the
 * bottom of the area the page is drawn in.
 *
 * Measured rather than a `calc(100vh - …)`, following AttendeeGrid: the page
 * does not own the whole viewport (AppLayout keeps the top bar and footer
 * outside its scroller), and what sits above the card MOVES — the subtitle
 * wraps when the sidebar expands, and the action row only exists once a claim
 * has a line. Every guessed constant was wrong in one of those states, either
 * leaving a gap under the card or bringing back a scrollbar.
 *
 * A floor, not a fixed height: a claim with many items still grows past it and
 * the page scrolls, which is the one case where scrolling is correct.
 */
function useFillHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const measure = () => {
      const el = ref.current;
      if (!el) return;
      setHeight(Math.max(MIN_CARD_HEIGHT, availableBelow(el)));
    };
    measure();
    window.addEventListener("resize", measure);
    // Anything above the card changing height moves its top edge. Absent in
    // jsdom, so the observer is optional — the resize listener and the mount
    // measurement still give the right answer without it.
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(document.body);
    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, []);

  return [ref, height] as const;
}

/**
 * Room left between an element's top edge and the bottom of whatever scrolls
 * it — the app shell's content area, or the window if nothing above it
 * scrolls. The scroller's own bottom padding is left free so the card stops
 * where every other page's content stops.
 *
 * The offset is taken within the scroller's CONTENT, not the viewport. A
 * viewport-relative top shrinks as the page scrolls, so the card would be told
 * it had more room the further down you went — growing, pushing the page
 * longer, and feeding its own scrollbar.
 */
function availableBelow(el: HTMLElement): number {
  const top = el.getBoundingClientRect().top;
  for (let node = el.parentElement; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.overflowY === "auto" || style.overflowY === "scroll") {
      const paddingBottom = parseFloat(style.paddingBottom) || 0;
      const offsetInContent = top - node.getBoundingClientRect().top + node.scrollTop;
      return node.clientHeight - paddingBottom - offsetInContent;
    }
  }
  return window.innerHeight - (top + window.scrollY);
}

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
  const [fillRef, fillHeight] = useFillHeight<HTMLDivElement>();
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
    // The backend PRICES a draft as it saves it — `ExpenseClaimDraftTransaction`
    // requires currencyConversionRate, reimbursementAmount and
    // reimbursementCurrency, and `validateExpenseClaimDraftTransactions` fills
    // them from the same path a submitted claim goes through. So the echoed
    // line is taken as it stands.
    //
    // Deliberately NOT re-derived with a rate of 1 when a figure looks absent:
    // on a foreign-currency line that shows the raw foreign amount as though it
    // were already converted, understating the total by the whole rate. If the
    // figures are ever genuinely missing, the total should look wrong rather
    // than quietly plausible.
    return drafted.map((t) => ({
      date: t.date,
      amount: t.amount,
      currency: t.currency,
      expenseTypeId: t.expenseTypeId,
      comment: t.comment ?? null,
      receiptUrl: t.receiptUrl ?? null,
      travelJobNumber: t.travelJobNumber ?? null,
      reimbursementAmount: t.reimbursementAmount,
      reimbursementCurrency: t.reimbursementCurrency,
      expenseType: t.expenseType ?? "",
    }));
  }, [appData.data]);

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
      <Stack spacing={1.75}>
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
    <Stack spacing={1.75}>
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
          empty space above it rather than trailing after it. `fillHeight` is a
          measured floor, so the card reaches the bottom of the page exactly —
          no gap under it, and no scrollbar from asking for more room than the
          page has. */}
      <Card
        ref={fillRef}
        variant="outlined"
        sx={{
          p: 3,
          minHeight: fillHeight ?? 420,
          display: "flex",
          flexDirection: "column",
        }}
      >
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
                                try {
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
                                  // Revoked on a later task, not this one: the
                                  // browser reads the blob asynchronously after
                                  // the click, so revoking straight away can
                                  // cancel the download before it begins.
                                  setTimeout(() => URL.revokeObjectURL(url), RECEIPT_URL_TTL_MS);
                                } catch (err) {
                                  // Without this the token or fetch failing
                                  // left the button looking like it did nothing.
                                  showError(describeError(err));
                                }
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
