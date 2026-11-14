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

import { useEffect, useMemo, useRef, useState, type JSX, type ReactNode } from "react";
import { Link as RouterLink, Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { Alert, alpha, Box, Button, Chip, CircularProgress, Collapse, Divider, Link, Paper, Stack, Tab, Tabs, Typography, type Theme } from "@wso2/oxygen-ui";
import DeleteDraftDialog from "@features/sales/cado2/quotes/components/detail/DeleteDraftDialog";
import OpportunityClosedNotice from "@features/sales/cado2/quotes/components/OpportunityClosedNotice";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import {
  useAuditEvents,
  useCloneQuote,
  useCloseQuote,
  useQuote,
  useQuoteVersion,
  useRecallVersion,
  useReviseQuote,
} from "@features/sales/cado2/quotes/api/useQuoteApi";
import OpportunityQuotesPanel from "@features/sales/cado2/quotes/components/detail/OpportunityQuotesPanel";
import PrimaryDialog from "@features/sales/cado2/quotes/components/detail/PrimaryDialog";
import { sheetFromVersion } from "@features/sales/cado2/quotes/sheet/sheetModel";
import QuoteSheet from "@features/sales/cado2/quotes/components/sheet/QuoteSheet";
import DocumentsPanel from "@features/sales/cado2/quotes/components/detail/DocumentsPanel";
import StatusPanel from "@features/sales/cado2/quotes/components/detail/StatusPanel";
import CustomerBand from "@features/sales/cado2/quotes/components/sheet/CustomerBand";
import {
  STATUS_COLOR,
  STATUS_LABEL,
  SYNCED_DRAFT_NOTE,
  quoteLabel,
  syncedDraft,
} from "@features/sales/cado2/quotes/lifecycle/lifecycle";
import LifecycleDialog from "@features/sales/cado2/quotes/components/detail/LifecycleDialog";
import VersionsTab from "@features/sales/cado2/quotes/components/detail/VersionsTab";
import HistoryTab from "@features/sales/cado2/quotes/components/detail/HistoryTab";
import QuoteApprovals from "@features/sales/cado2/approvals/components/QuoteApprovals";
import {
  useApprovalWorkflow,
  useDecideStep,
  useReview,
  useStoredApprovalPreview,
} from "@features/sales/cado2/approvals/api/useApprovalApi";
import type { ApprovalOutcome, ApprovalStep, LensRole } from "@features/sales/cado2/approvals/api/approvalTypes";
import { decisionNote, renewalStartPoints } from "@features/sales/cado2/approvals/model/myApprovals";
import ReviewNotes from "@features/sales/cado2/approvals/components/ReviewNotes";
import DecisionCard from "@features/sales/cado2/approvals/components/DecisionCard";
import YoursToWrite from "@features/sales/cado2/approvals/components/YoursToWrite";
import OnBehalfPanel from "@features/sales/cado2/approvals/components/OnBehalfPanel";
import { useCado2Toast } from "@features/sales/cado2/components/toast/toastContext";
import LegalTermsEditor from "@features/sales/cado2/approvals/components/LegalTermsEditor";
import SpecialTermsEditor from "@features/sales/cado2/approvals/components/SpecialTermsEditor";
import ActingAsChip from "@features/sales/cado2/quotes/components/detail/ActingAsChip";
import { legalApproveBlock } from "@features/sales/cado2/quotes/form/legalModel";
import YourApprovalPanel, { YOUR_APPROVAL_ANCHOR } from "@features/sales/cado2/approvals/components/YourApprovalPanel";
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  PencilIcon,
  RotateCcwIcon,
  StarIcon,
  Trash2Icon,
  Undo2Icon,
  XCircleIcon,
} from "@wso2/oxygen-ui-icons-react";
import QuoteActionsMenu from "@features/sales/cado2/quotes/components/detail/QuoteActionsMenu";
import PrimaryStar from "@features/sales/cado2/components/primary-star/PrimaryStar";
import { cado2Access, useCado2Me } from "@features/sales/cado2/api/useCado2Me";
import { cado2Paths, type Cado2QuoteTab } from "@features/sales/cado2/cado2Paths";
import StatusChip from "@features/sales/cado2/components/status-chip/StatusChip";
import { useDocumentTitle } from "@hooks/useDocumentTitle";

type Dialog = "recall" | "revise" | "clone" | "close" | "delete" | "primary" | null;

const scrollToYourApproval = () =>
  document.getElementById(YOUR_APPROVAL_ANCHOR)?.scrollIntoView?.({ behavior: "smooth", block: "start" });
/** An approver's decision on one step. */
type Decision = { outcome: ApprovalOutcome; step: ApprovalStep } | null;
const TABS = ["Quote", "Approvals", "Versions", "History"] as const;
/** Each tab is a route: /quotes/:quoteId/<segment>. */
const TAB_SEGMENTS: readonly Cado2QuoteTab[] = ["quote", "approvals", "versions", "history"];
const APPROVALS_TAB = 1;

/**
 * Under a lens (D129), what a note points at is marked quietly: a thin line
 * at its left edge, red to look at, green once fine; the selected note's
 * place gets a light background.
 */
const noteTint = (theme: Theme) => {
  const { error, success, text } = theme.palette;
  const line = (c: string) => `inset 2px 0 0 ${alpha(c, 0.75)}`;
  return {
    "& [data-note-state]": { cursor: "pointer", transition: "background-color .15s" },
    "& [data-note-state]:not(tr)": { borderRadius: 0.5, ml: -1.25, pl: 1.25 },
    "& [data-note-state='open']:not(tr)": { boxShadow: line(error.main) },
    "& [data-note-state='fine']:not(tr)": { boxShadow: line(success.main) },
    "& tr[data-note-state='open'] > td:first-of-type": { boxShadow: line(error.main) },
    "& tr[data-note-state='fine'] > td:first-of-type": { boxShadow: line(success.main) },
    "& [data-note-active='true']:not(tr), & tr[data-note-active='true'] > td": { bgcolor: alpha(text.primary, 0.05) },
  };
};

/** Takes the reader to a place in the quote sheet, e.g. the special terms. */
const scrollToTarget = (target: string) =>
  document.querySelector(`[data-note-target~="${target}"]`)?.scrollIntoView?.({ behavior: "smooth", block: "center" });

/** The approval notes once the quote is approved: one line, opened on request. */
function FoldedNotes({ count, children }: { count: number; children: ReactNode }): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <Box>
      <Button
        size="small"
        color="inherit"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        startIcon={open ? <ChevronDownIcon size={16} /> : <ChevronRightIcon size={16} />}
        sx={{ m: 1, textTransform: "none", color: "text.secondary" }}
      >
        Approval notes ({count})
      </Button>
      <Collapse in={open} unmountOnExit>
        {children}
      </Collapse>
    </Box>
  );
}

/**
 * The quote page: the latest
 * version as a complete read-only quote, every version with Compare, and the
 * History. The owner's lifecycle buttons follow the backend's `actions`
 *: Recall a submitted version; then Revise or Close. A draft can also
 * be closed.
 */
export default function QuoteDetailPage(): JSX.Element {
  const params = useParams();
  const navigate = useNavigate();
  // Opened from My Approvals (?from=approvals): the back link returns there.
  const [search] = useSearchParams();
  const fromApprovals = search.get("from") === "approvals";
  // Opened from the Deal Desk board (?from=desk): the back link returns there (D130).
  const fromDesk = search.get("from") === "desk";
  // Opened from the Quote Report (?from=insights&back=…): the back link returns
  // to the report with its filters. Only an Insights address is accepted.
  const insightsBack = search.get("from") === "insights" ? search.get("back") : null;
  const backToReport = insightsBack?.startsWith(cado2Paths.insights("report").split("?")[0]) ? insightsBack : null;
  const keepFrom = (path: string) =>
    backToReport ? `${path}${path.includes("?") ? "&" : "?"}${new URLSearchParams({ from: "insights", back: backToReport })}` : path;
  const quoteId = Number(params.quoteId);
  const tab = TAB_SEGMENTS.indexOf(params.tab as Cado2QuoteTab);
  const quote = useQuote(quoteId);
  const latestNumber = quote.data?.versions.at(-1)?.versionNumber ?? null;
  // View mode (2026-10-13): any version can be viewed here (?version=N), the
  // latest by default. The wizard is only for editing a draft.
  const asked = Number(search.get("version"));
  const shownNumber = quote.data?.versions.some((x) => x.versionNumber === asked) ? asked : latestNumber;
  const viewingOlder = shownNumber !== null && latestNumber !== null && shownNumber !== latestNumber;
  const shownParam = viewingOlder ? (shownNumber ?? undefined) : undefined;
  const openTab = (i: number) => navigate(keepFrom(cado2Paths.quote(quoteId, TAB_SEGMENTS[i], fromApprovals, shownParam)));
  const shown = useQuoteVersion(quoteId, shownNumber);
  const recall = useRecallVersion();
  const revise = useReviseQuote();
  const clone = useCloneQuote();
  const close = useCloseQuote();
  const events = useAuditEvents(quoteId);
  const sheet = useMemo(() => (shown.data ? sheetFromVersion(shown.data) : null), [shown.data]);
  const [dialogState, setDialogState] = useState<Dialog>(null);
  // Opened from the board with ?do=recall|revise: that confirmation opens once (D130).
  const [linkUsed, setLinkUsed] = useState(false);
  const setDialog = (d: Dialog) => {
    setLinkUsed(true);
    setDialogState(d);
  };
  const [decision, setDecision] = useState<Decision>(null);
  const shownStatus = shown.data?.version.status ?? null;
  const isDraft = shownStatus === "DRAFT";
  const workflow = useApprovalWorkflow(quoteId, shownNumber, shownStatus !== null && !isDraft);
  const approvalPreview = useStoredApprovalPreview(quoteId, shownNumber, isDraft);
  const decide = useDecideStep();
  // D129: Deal Desk and Legal see the quote through their lens, with notes.
  const review = useReview(quoteId, shownNumber, shownStatus !== null && !isDraft);
  const [rolePick, setRolePick] = useState<{ version: number | null; role: string } | null>(null);
  const [sheetEl, setSheetEl] = useState<HTMLElement | null>(null);
  const me = useCado2Me();
  // After a decision: what was recorded, as a toast (2026-10-13).
  const notify = useCado2Toast();
  // Set by the header's "Your approval" from another tab; scrolls once the
  // Quote tab shows the panel.
  const jumpPending = useRef(false);
  useEffect(() => {
    if (!jumpPending.current || tab !== 0) return;
    jumpPending.current = false;
    scrollToYourApproval();
  }, [tab]);
  useDocumentTitle(quote.data ? quoteLabel(quote.data.quoteNumber, shown.data?.version.accountName, shown.data?.version.opportunityName) : "Quote");

  const openDialog = (d: Dialog) => {
    recall.reset();
    revise.reset();
    clone.reset();
    close.reset();
    setDialog(d);
  };

  if (tab < 0) return <Navigate to={cado2Paths.quote(quoteId, "quote", fromApprovals, shownParam)} replace />;

  if (quote.isPending || (quote.data && shown.isPending)) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress aria-label="Loading the quote" />
      </Box>
    );
  }
  const loadError = quote.error ?? shown.error;
  if (loadError || !quote.data || !shown.data) {
    return (
      <ErrorNotice error={loadError} onRetry={() => void quote.refetch()} retrying={quote.isFetching}>
        Couldn&apos;t load the quote.
      </ErrorNotice>
    );
  }

  const q = quote.data;
  const v = shown.data.version;
  // The number once submitted; before that, the customer and deal.
  const name = quoteLabel(q.quoteNumber, v.accountName, v.opportunityName);
  const can = (a: "RECALL" | "REVISE" | "CLOSE") => q.actions.includes(a);
  const askedAction = search.get("do");
  const linkDialog: Dialog =
    linkUsed || viewingOlder ? null : askedAction === "recall" && can("RECALL") ? "recall" : askedAction === "revise" && can("REVISE") ? "revise" : null;
  const dialog = dialogState ?? linkDialog;
  const counts = [null, null, q.versions.length, events.data ? events.data.length : null];
  // Steps the caller may decide now; usually one.
  const actionable = (workflow.data?.steps ?? []).filter((s) => s.canAct);
  const approverRoles = me.data?.approverRoles ?? [];
  // D129: the caller's approval roles on this quote, each with its notes.
  // Several roles: tabs, opening on the one whose turn it is; the choice
  // holds for the version shown.
  const lenses = review.data?.lenses ?? [];
  const lensRoles: string[] = lenses.map((l) => l.role);
  const pickedRole = rolePick && rolePick.version === shownNumber ? rolePick.role : null;
  const steps = workflow.data?.steps ?? [];
  const pendingFor = (role: string) =>
    steps.find((s) => s.role === role && s.status === "PENDING" && (s.canAct || Boolean(s.cantActReason))) ?? null;
  // Opens on the lens whose turn it is.
  const lens =
    lenses.find((l) => l.role === pickedRole) ??
    lenses.find((l) => steps.some((s) => s.role === l.role && s.status === "PENDING" && s.canAct)) ??
    lenses[0] ??
    null;
  // The decision bar: the lens role's pending step, or under As Submitted the first lens role's.
  // The card at the top of the column: the decision when it's the reviewer's
  // turn, else how their role's approval stands.
  const barStep = lens ? (pendingFor(lens.role) ?? steps.find((s) => s.role === lens.role) ?? null) : null;
  const canWrite = (role: LensRole) => steps.some((s) => s.role === role && s.canAct);
  const barBlock = barStep?.role === "LEGAL" ? legalApproveBlock(v.legal) : "";
  const goToBlock = () => {
    if (!barStep) return;
    setRolePick({ version: shownNumber, role: barStep.role });
    setTimeout(() => scrollToTarget(barStep.role === "DEAL_DESK" ? "specialTerms" : "governingTerms"), 50);
  };
  // What the lens role writes, in its place in the quote.
  // Keyed by version, not by updatedAt: a save mustn't reset the editor and hide its "Saved".
  const writing =
    lens?.role === "DEAL_DESK" && canWrite("DEAL_DESK")
      ? {
          // D139: the AM wrote them; Deal Desk may override them, here on this version.
          special: v.legal?.specialTerms ? (
            <YoursToWrite
              title="Special terms"
              label="To review"
              intro="The AM wrote these. Check them, and override them only if they need it: your text replaces the AM's on the order form. Legal reviews them after you approve."
            >
              <SpecialTermsEditor key={`${q.id}-${v.versionNumber}`} quoteId={q.id} versionNumber={v.versionNumber} legal={v.legal} minHeight={260} />
            </YoursToWrite>
          ) : undefined,
        }
      : lens?.role === "LEGAL" && canWrite("LEGAL") && v.legal
        ? {
            governing: v.legal.sections.blocks.some((b) => b.nonStandard) ? (
              <YoursToWrite title="Governing terms" intro="The AM marked these non-standard: write them as they should print. Approve waits for them.">
                <LegalTermsEditor key={`${q.id}-${v.versionNumber}`} quoteId={q.id} versionNumber={v.versionNumber} legal={v.legal} minHeight={220} part="governing" />
              </YoursToWrite>
            ) : undefined,
            special:
              v.legal.specialTerms !== null ? (
                <YoursToWrite
                  title="Special terms"
                  label="To review"
                  intro={
                    v.legal.deskSpecialTerms
                      ? "Deal Desk overrode the AM's special terms. Review them, and override them only if they need it: your text replaces Deal Desk's on the order form."
                      : "Written by the AM. Review them, and override them only if they need it: your text replaces the AM's on the order form."
                  }
                >
                  <LegalTermsEditor key={`${q.id}-${v.versionNumber}`} quoteId={q.id} versionNumber={v.versionNumber} legal={v.legal} minHeight={220} part="special" />
                </YoursToWrite>
              ) : undefined,
          }
        : undefined;
  // Something else to decide (a role without a lens): the "Your decision" band shows.
  const panelSteps = actionable.filter((s) => !lensRoles.includes(s.role));
  const hasDecision = panelSteps.length > 0;
  // Any AM who can read the quote may clone the version shown (D108).
  const cloneAction = cado2Access(me.data).canQuote
    ? [{ label: "Clone quote", icon: <CopyIcon size={16} />, onClick: () => openDialog("clone") }]
    : [];

  const approvalProps = { isDraft, workflow, preview: approvalPreview, quoteId: q.id, versionNumber: v.versionNumber };
  // Opens the Quote tab if needed, then scrolls to "Your approval".
  const jumpToYourApproval = () => {
    if (tab === 0) {
      scrollToYourApproval();
      return;
    }
    jumpPending.current = true;
    openTab(0);
  };
  const openDecision = (outcome: ApprovalOutcome, step: ApprovalStep) => {
    decide.reset();
    setDecision({ outcome, step });
  };
  // D129: the lens role's decision, at the top of the column beside the quote.
  const decisionCard =
    barStep && !viewingOlder ? (
      <DecisionCard
        step={barStep}
        steps={steps}
        block={barBlock}
        onGoToBlock={goToBlock}
        onDecide={openDecision}
      />
    ) : null;

  // The page's one main button: the approver's task, else the AM's next step.
  // In approval and approved have none; their actions are in the menu.
  // Once approved, the order form leads the side column and the notes fold (2026-11-07).
  const approvedView = v.status === "APPROVED";
  const worksOnQuotes = cado2Access(me.data).canWorkOnQuotes;
  const documentsPanel = (
    <DocumentsPanel
      quoteId={q.id}
      version={v.versionNumber}
      approved={approvedView}
      olderVersion={viewingOlder}
      downloadOnly={!worksOnQuotes}
    />
  );
  const reviseIsMain = can("REVISE") && (v.status === "RECALLED" || v.status === "RETURNED");
  // D174: no more versions than the Admin allows; cloning starts a new quote.
  const atVersionLimit =
    !viewingOlder && q.canEdit && Boolean(q.atVersionLimit) && (v.status === "RECALLED" || v.status === "RETURNED");
  const mainAction = viewingOlder ? (
    // An older version is for reading: its actions belong to the latest.
    <Button variant="contained" component={RouterLink} to={cado2Paths.quote(q.id, TAB_SEGMENTS[tab] ?? "quote", fromApprovals)}>
      View latest version
    </Button>
  ) : actionable.length && tab !== 0 ? (
      // Decisions are made in "Your decision" on the Quote tab; from another tab this goes back there.
      <Button variant="contained" endIcon={<ArrowDownIcon size={16} />} onClick={jumpToYourApproval}>
        {actionable.length === 1 ? "Your approval" : `Your approvals (${actionable.length})`}
      </Button>
    ) : v.status === "DRAFT" && can("CLOSE") ? (
      // Into edit mode: the wizard is only for editing a draft (2026-10-13).
      <Button
        variant="contained"
        component={RouterLink}
        to={cado2Paths.editVersion(q.id, v.versionNumber)}
        startIcon={<PencilIcon size={16} />}
      >
        Edit draft
      </Button>
    ) : reviseIsMain ? (
      <Button variant="contained" onClick={() => openDialog("revise")}>
        Revise
      </Button>
    ) : atVersionLimit && cloneAction.length ? (
      <Button variant="contained" startIcon={<CopyIcon size={16} />} onClick={() => openDialog("clone")}>
        Clone quote
      </Button>
    ) : null;

  return (
    <Stack spacing={3} sx={{ maxWidth: 1400, minWidth: 0 }}>
      <Stack spacing={1.5}>
        <Link
          component={RouterLink}
          to={backToReport ?? (fromApprovals ? cado2Paths.approvals : fromDesk ? cado2Paths.desk : cado2Paths.quotes)}
          variant="body2"
          sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, alignSelf: "flex-start" }}
        >
          <ArrowLeftIcon size={14} /> {backToReport ? "Quote Report" : fromApprovals ? "My Approvals" : fromDesk ? "Deal Desk" : "Quotes"}
        </Link>
        {/* The record header (frontend.md, "Page titles"): the account is the
            page's title on every tab, with everything about who and what the
            quote is for; the deal below doesn't repeat it. */}
        {sheet ? (
          <CustomerBand
            sheet={sheet}
            header={{
              eyebrow: `${q.quoteNumber ?? "Draft"} · Version ${v.versionNumber}`,
              status: (
                <Stack direction="row" spacing={1} alignItems="center">
                  {/* The version shown: the latest, or an older one in view mode. */}
                  <StatusChip color={STATUS_COLOR[v.status]} label={STATUS_LABEL[v.status]} />
                  {q.isPrimary ? <Chip size="small" variant="outlined" icon={<PrimaryStar label="" />} label="Primary" /> : null}
                  <ActingAsChip quote={q} />
                </Stack>
              ),
              actions: (
                <>
                  {/* One main button, the next step for this status; the rest is under "⋯" (2026-10-12). */}
                  {mainAction}
                  {viewingOlder ? (
                    // An older version's only action: cloning it.
                    cloneAction.length ? <QuoteActionsMenu actions={cloneAction} destructive={[]} /> : null
                  ) : (
                    <QuoteActionsMenu
                      actions={[
                        ...(can("RECALL") ? [{ label: "Recall", icon: <Undo2Icon size={16} />, onClick: () => openDialog("recall") }] : []),
                        ...(can("REVISE") && !reviseIsMain
                          ? [{ label: "Revise", icon: <RotateCcwIcon size={16} />, onClick: () => openDialog("revise") }]
                          : []),
                        // A setting of the quote: any status, approvals untouched (D68).
                        ...(q.canEdit
                          ? [
                              {
                                label: q.isPrimary ? "Remove primary" : "Make primary",
                                icon: <StarIcon size={16} />,
                                onClick: () => openDialog("primary"),
                              },
                            ]
                          : []),
                        ...cloneAction,
                      ]}
                      destructive={[
                        ...(v.status === "DRAFT" && can("CLOSE")
                          ? [
                              {
                                label: "Delete draft",
                                icon: <Trash2Icon size={16} />,
                                onClick: () => openDialog("delete"),
                                // A synced draft can't be deleted (2026-11-11).
                                ...(syncedDraft(q, v.versionNumber) ? { disabled: true, detail: SYNCED_DRAFT_NOTE } : {}),
                              },
                            ]
                          : []),
                        ...(can("CLOSE") ? [{ label: "Close quote", icon: <XCircleIcon size={16} />, onClick: () => openDialog("close") }] : []),
                      ]}
                    />
                  )}
                </>
              ),
            }}
          />
        ) : null}
        {/* D164: closed in Salesforce since it was picked. */}
        {!viewingOlder ? (
          <OpportunityClosedNotice
            opportunityId={q.sfOpportunityId}
            blocked={v.status === "DRAFT" ? "submitted or synced to Salesforce" : v.status === "APPROVED" ? "issued" : null}
          />
        ) : null}
        {atVersionLimit ? (
          <Alert severity="info">
            This quote has reached its limit of {q.maxVersions} versions, so it can&apos;t be revised. Clone it into a new quote
            to continue.
          </Alert>
        ) : null}
        {viewingOlder ? (
          <Alert severity="info">
            You&apos;re viewing version {v.versionNumber}. The latest is version {latestNumber}. Clone copies this version; other
            actions apply to the latest.
          </Alert>
        ) : null}
      </Stack>

      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs value={tab} onChange={(_, t: number) => openTab(t)} aria-label="Quote sections">
          {TABS.map((t, i) => (
            <Tab key={t} label={counts[i] === null ? t : `${t} (${counts[i]})`} />
          ))}
        </Tabs>
      </Box>
      <Box role="tabpanel" aria-label={TABS[tab]}>
        {tab === 0 && sheet ? (
          <Stack spacing={3}>
            {/* The approver's task first, full width and set apart from the deal below. */}
            {hasDecision ? (
              <Box
                component="section"
                aria-label="Your approval"
                sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, bgcolor: "action.hover", border: 1, borderColor: "divider" }}
              >
                <Typography variant="overline" color="text.secondary" sx={{ display: "block", mb: 1.5, lineHeight: 1.6 }}>
                  Your Approval
                </Typography>
                <YourApprovalPanel
                  steps={workflow.data?.steps ?? []}
                  actionable={panelSteps}
                  deskPoints={renewalStartPoints(sheet)}
                  onDecide={openDecision}
                  legalEditor={v.legal ? <LegalTermsEditor key={v.updatedAt} quoteId={q.id} versionNumber={v.versionNumber} legal={v.legal} /> : undefined}
                  legalApproveBlock={legalApproveBlock(v.legal)}
                  deskEditor={
                    v.legal?.specialTerms ? (
                      <SpecialTermsEditor key={v.updatedAt} quoteId={q.id} versionNumber={v.versionNumber} legal={v.legal} />
                    ) : undefined
                  }
                  previousReturn={workflow.data?.previousReturn}
                />
              </Box>
            ) : null}
            {lens && workflow.data?.previousReturn ? (
              <Alert severity="info">
                Why version {workflow.data.previousReturn.versionNumber} came back: returned by {workflow.data.previousReturn.roleLabel}
                {workflow.data.previousReturn.byEmail ? ` (${workflow.data.previousReturn.byEmail})` : ""}
                {workflow.data.previousReturn.comment ? `: “${workflow.data.previousReturn.comment}”` : ""}
              </Alert>
            ) : null}
            <Box
              sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", lg: "minmax(0,1fr) 340px" }, gap: 3, alignItems: "start" }}
            >
              <Box component="section" aria-label="The deal" ref={setSheetEl} sx={(theme) => ({ minWidth: 0, ...(lens ? noteTint(theme) : {}) })}>
                <QuoteSheet sheet={sheet} writing={writing} />
              </Box>
              {/* The side column is pinned as one, so no part of it slides under
                  another; taller than the screen, it scrolls on its own (2026-10-13).
                  An approver's part comes first: their roles (tabs, only with
                  several), the decision, the approval notes (D129). Once approved, the
                  order form comes first, for everyone who may open the quote: issuing it
                  is the next step, and any approver may download it once issued (2026-11-07). */}
              <Stack
                spacing={3}
                sx={{
                  position: { lg: "sticky" },
                  top: { lg: 16 },
                  maxHeight: { lg: "calc(100vh - 32px)" },
                  overflowY: { lg: "auto" },
                }}
              >
                {approvedView ? documentsPanel : null}
                {lens ? (
                  // The approver's part as one card: their roles (tabs, only with several),
                  // the decision or how it stands, then the approval notes.
                  // flexShrink 0: in the height-capped column, a clipping card may otherwise be squeezed to nothing.
                  // "Your approval" from another tab jumps here, to the card's top, so the role tabs stay in view.
                  <Paper
                    id={hasDecision ? undefined : YOUR_APPROVAL_ANCHOR}
                    variant="outlined"
                    component="section"
                    aria-label="Approval"
                    sx={{ borderRadius: 2, overflow: "hidden", flexShrink: 0, scrollMarginTop: 16 }}
                  >
                    {lenses.length > 1 ? (
                      <Tabs
                        value={lens.role}
                        onChange={(_, role: string) => setRolePick({ version: shownNumber, role })}
                        // Scrollable: several roles may not fit the column; arrows show when they don't.
                        variant="scrollable"
                        scrollButtons="auto"
                        allowScrollButtonsMobile
                        aria-label="Your roles on this quote"
                        sx={{ minHeight: 40, borderBottom: 1, borderColor: "divider", "& .MuiTab-root": { minHeight: 40, minWidth: 0, px: 1.5, textTransform: "none", fontWeight: 600 } }}
                      >
                        {lenses.map((l) => (
                          <Tab
                            key={l.role}
                            value={l.role}
                            label={
                              <Stack direction="row" spacing={0.75} alignItems="center">
                                <span>{l.roleLabel}</span>
                                {pendingFor(l.role)?.canAct ? (
                                  <Box component="span" title="Your turn" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "primary.main" }} />
                                ) : null}
                              </Stack>
                            }
                          />
                        ))}
                      </Tabs>
                    ) : null}
                    {decisionCard}
                    {decisionCard && !(approvedView && lens.notes.length === 0) ? <Divider /> : null}
                    {approvedView ? (
                      // Approved: the notes have done their job; folded, and gone when there were none (2026-11-07).
                      lens.notes.length ? (
                        <FoldedNotes count={lens.notes.length}>
                          <ReviewNotes lens={lens} sheet={sheetEl} empty="" />
                        </FoldedNotes>
                      ) : null
                    ) : (
                      <ReviewNotes
                        lens={lens}
                        sheet={sheetEl}
                        empty={
                          lens.role === "DEAL_DESK"
                            ? "Standard quote. No approval rules apply, so your approval is the only one needed."
                            : "No notes from the approval rules on this quote."
                        }
                      />
                    )}
                    {/* Deal Desk may step in for an away approver (D120), here as on the Approvals tab. */}
                    {lens.role === "DEAL_DESK" && !viewingOlder && steps.some((s) => s.canApproveOnBehalf) ? (
                      <>
                        <Divider />
                        <OnBehalfPanel embedded quoteId={q.id} versionNumber={v.versionNumber} steps={steps} />
                      </>
                    ) : null}
                  </Paper>
                ) : null}
                {/* The timeline, the order form and the opportunity's quotes are for who works on
                    quotes (Sales, Deal Desk); a pure approver has the approval card above. */}
                {worksOnQuotes ? (
                  <>
                  <StatusPanel
                    latest={shown.data}
                    events={events.data ?? []}
                    eventsError={events.error}
                    onRetryEvents={() => void events.refetch()}
                    documents={approvedView ? undefined : documentsPanel}
                  />
                    <OpportunityQuotesPanel quoteId={q.id} opportunityId={q.sfOpportunityId} />
                  </>
                ) : null}
              </Stack>
            </Box>
          </Stack>
        ) : null}
        {tab === APPROVALS_TAB ? <QuoteApprovals {...approvalProps} /> : null}
        {tab === 2 ? <VersionsTab quote={q} currency={v.currencyIsoCode ?? ""} /> : null}
        {tab === 3 ? <HistoryTab quoteId={q.id} /> : null}
      </Box>

      {decision ? (
        <LifecycleDialog
          title={`${decision.outcome === "approve" ? "Approve" : "Return"} as ${decision.step.roleLabel}?`}
          confirmLabel={decision.outcome === "approve" ? "Approve" : "Return"}
          reason={decision.outcome === "approve" ? "optional" : "required"}
          reasonLabel={decision.outcome === "approve" ? "Comment" : "What should the owner know?"}
          pending={decide.isPending}
          error={decide.error}
          onClose={() => setDecision(null)}
          onConfirm={(comment) =>
            decide.mutate(
              { quoteId: q.id, version: v.versionNumber, stepId: decision.step.stepId as number, outcome: decision.outcome, comment },
              {
                onSuccess: (after) => {
                  // Say what was recorded, so the next step's buttons don't
                  // look like the same ones again: a toast (2026-10-13).
                  notify(decisionNote(decision.outcome, decision.step, after, approverRoles));
                  setDecision(null);
                },
              },
            )
          }
        >
          {decision.outcome === "approve"
            ? `You approve version ${v.versionNumber} for ${decision.step.roleLabel}. The next approvers are asked straight away.`
            : `The approval stops for everyone, and the owner is asked to change version ${v.versionNumber} and submit again, or close the quote.`}
        </LifecycleDialog>
      ) : null}
      {dialog === "recall" ? (
        <LifecycleDialog
          title={`Recall version ${v.versionNumber}?`}
          confirmLabel="Recall"
          reason="optional"
          reasonLabel="Why are you recalling it?"
          pending={recall.isPending}
          error={recall.error}
          onClose={() => setDialog(null)}
          onConfirm={(reason) =>
            recall.mutate(
              { quoteId: q.id, version: v.versionNumber, reason },
              {
                onSuccess: () => {
                  setDialog(null);
                  notify(`Version ${v.versionNumber} recalled`);
                },
              },
            )
          }
        >
          {v.status === "APPROVED" ? (
            // D122: approved, order form not issued yet.
            <>
              Version {v.versionNumber} is approved, but its order form isn&apos;t issued yet. Recall it to fix something:
              revise it (version {v.versionNumber + 1}), make the change and resubmit. Only the approvals your change
              affects are asked again; Deal Desk always reviews.
            </>
          ) : (
            <>
              Version {v.versionNumber} will be taken back and can&apos;t be put back in flight. Afterwards you can revise
              it (start version {v.versionNumber + 1} as a copy) or close the quote.
            </>
          )}
        </LifecycleDialog>
      ) : null}
      {dialog === "revise" ? (
        <LifecycleDialog
          title={`Revise to version ${v.versionNumber + 1}?`}
          confirmLabel="Revise"
          pending={revise.isPending}
          error={revise.error}
          onClose={() => setDialog(null)}
          onConfirm={() =>
            revise.mutate(
              { quoteId: q.id },
              {
                onSuccess: (res) => {
                  setDialog(null);
                  navigate(cado2Paths.editVersion(q.id, res.version.versionNumber));
                },
              },
            )
          }
        >
          Version {v.versionNumber + 1} starts as an exact copy of version {v.versionNumber}, with the same prices. Version{" "}
          {v.versionNumber} stays as it is.
        </LifecycleDialog>
      ) : null}
      {dialog === "clone" ? (
        <LifecycleDialog
          title={`Clone ${q.quoteNumber ?? "this quote"} v${v.versionNumber}?`}
          confirmLabel="Clone"
          pending={clone.isPending}
          error={clone.error}
          onClose={() => setDialog(null)}
          onConfirm={() =>
            clone.mutate(
              { quoteId: q.id, version: v.versionNumber },
              {
                onSuccess: (res) => {
                  setDialog(null);
                  navigate(cado2Paths.editVersion(res.quote.id, res.version.versionNumber), {
                    state: { clonedFrom: `${q.quoteNumber ?? "the quote"} v${v.versionNumber}` },
                  });
                },
              },
            )
          }
        >
          A new draft quote is created on the same account and opportunity, with everything from version {v.versionNumber}{" "}
          at the same prices. You can change anything except the account and opportunity. This quote stays as it is.
        </LifecycleDialog>
      ) : null}
      {dialog === "delete" ? (
        <DeleteDraftDialog
          quote={q}
          name={name}
          versionNumber={v.versionNumber}
          updatedAt={v.updatedAt}
          onClose={() => setDialog(null)}
          onDeleted={(res) => {
            setDialog(null);
            if (res.quoteDeleted) navigate(cado2Paths.quotes, { replace: true });
          }}
        />
      ) : null}
      {dialog === "primary" ? (
        <PrimaryDialog quoteId={q.id} opportunityId={q.sfOpportunityId} isPrimary={q.isPrimary} status={q.status} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === "close" ? (
        <LifecycleDialog
          title={`Close ${name}?`}
          confirmLabel="Close quote"
          reason="required"
          reasonLabel="Why is the quote closing?"
          danger
          pending={close.isPending}
          error={close.error}
          onClose={() => setDialog(null)}
          onConfirm={(reason) =>
            close.mutate(
              { quoteId: q.id, reason },
              {
                onSuccess: () => {
                  setDialog(null);
                  notify(`${name} closed`);
                },
              },
            )
          }
        >
          This is permanent. The quote can&apos;t be revised or submitted again; its versions stay viewable.
        </LifecycleDialog>
      ) : null}
    </Stack>
  );
}
