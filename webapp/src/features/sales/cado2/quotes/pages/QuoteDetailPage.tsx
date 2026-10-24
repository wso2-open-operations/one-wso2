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

import { useEffect, useMemo, useRef, useState, type JSX } from "react";
import { Link as RouterLink, Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { Alert, Box, Button, Chip, CircularProgress, Link, Stack, Tab, Tabs, Typography } from "@wso2/oxygen-ui";
import DeleteDraftDialog from "@features/sales/cado2/quotes/components/detail/DeleteDraftDialog";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import {
  useAuditEvents,
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
import { STATUS_COLOR, STATUS_LABEL, quoteLabel } from "@features/sales/cado2/quotes/lifecycle/lifecycle";
import LifecycleDialog from "@features/sales/cado2/quotes/components/detail/LifecycleDialog";
import VersionsTab from "@features/sales/cado2/quotes/components/detail/VersionsTab";
import HistoryTab from "@features/sales/cado2/quotes/components/detail/HistoryTab";
import QuoteApprovals from "@features/sales/cado2/approvals/components/QuoteApprovals";
import {
  useApprovalWorkflow,
  useDecideStep,
  useStoredApprovalPreview,
} from "@features/sales/cado2/approvals/api/useApprovalApi";
import type { ApprovalOutcome, ApprovalStep } from "@features/sales/cado2/approvals/api/approvalTypes";
import { decisionNote, renewalStartPoints, repCategoryPoints } from "@features/sales/cado2/approvals/model/myApprovals";
import { useCado2Toast } from "@features/sales/cado2/components/toast/toastContext";
import LegalTermsEditor from "@features/sales/cado2/approvals/components/LegalTermsEditor";
import { legalApproveBlock } from "@features/sales/cado2/quotes/form/legalModel";
import YourApprovalPanel, { YOUR_APPROVAL_ANCHOR } from "@features/sales/cado2/approvals/components/YourApprovalPanel";
import { ArrowDownIcon, ArrowLeftIcon, PencilIcon, RotateCcwIcon, StarIcon, Trash2Icon, Undo2Icon, XCircleIcon } from "@wso2/oxygen-ui-icons-react";
import QuoteActionsMenu from "@features/sales/cado2/quotes/components/detail/QuoteActionsMenu";
import PrimaryStar from "@features/sales/cado2/components/primary-star/PrimaryStar";
import { useCado2Me } from "@features/sales/cado2/api/useCado2Me";
import { cado2Paths, type Cado2QuoteTab } from "@features/sales/cado2/cado2Paths";
import StatusChip from "@features/sales/cado2/components/status-chip/StatusChip";
import { useDocumentTitle } from "@hooks/useDocumentTitle";

type Dialog = "recall" | "revise" | "close" | "delete" | "primary" | null;

const scrollToYourApproval = () =>
  document.getElementById(YOUR_APPROVAL_ANCHOR)?.scrollIntoView?.({ behavior: "smooth", block: "start" });
/** An approver's decision on one step. */
type Decision = { outcome: ApprovalOutcome; step: ApprovalStep } | null;
const TABS = ["Quote", "Approvals", "Versions", "History"] as const;
/** Each tab is a route: /quotes/:quoteId/<segment>. */
const TAB_SEGMENTS: readonly Cado2QuoteTab[] = ["quote", "approvals", "versions", "history"];
const APPROVALS_TAB = 1;

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
  const close = useCloseQuote();
  const events = useAuditEvents(quoteId);
  const sheet = useMemo(() => (shown.data ? sheetFromVersion(shown.data) : null), [shown.data]);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [decision, setDecision] = useState<Decision>(null);
  const shownStatus = shown.data?.version.status ?? null;
  const isDraft = shownStatus === "DRAFT";
  const workflow = useApprovalWorkflow(quoteId, shownNumber, shownStatus !== null && !isDraft);
  const approvalPreview = useStoredApprovalPreview(quoteId, shownNumber, isDraft);
  const decide = useDecideStep();
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
  const counts = [null, null, q.versions.length, events.data ? events.data.length : null];
  // Steps the caller may decide now; usually one.
  const actionable = (workflow.data?.steps ?? []).filter((s) => s.canAct);
  const approverRoles = me.data?.approverRoles ?? [];
  // Something to decide: the "Your decision" band shows.
  const hasDecision = actionable.length > 0;

  const approvalProps = { isDraft, workflow, preview: approvalPreview };
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

  // The page's one main button: the approver's task, else the AM's next step.
  // In approval and approved have none; their actions are in the menu.
  const reviseIsMain = can("REVISE") && (v.status === "RECALLED" || v.status === "RETURNED");
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
    ) : null;

  return (
    <Stack spacing={3} sx={{ maxWidth: 1400, minWidth: 0 }}>
      <Stack spacing={1.5}>
        <Link
          component={RouterLink}
          to={backToReport ?? (fromApprovals ? cado2Paths.approvals : cado2Paths.quotes)}
          variant="body2"
          sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, alignSelf: "flex-start" }}
        >
          <ArrowLeftIcon size={14} /> {backToReport ? "Quote Report" : fromApprovals ? "My Approvals" : "Quotes"}
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
                </Stack>
              ),
              actions: (
                <>
                  {/* One main button, the next step for this status; the rest is under "⋯" (2026-10-12). */}
                  {mainAction}
                  {viewingOlder ? null : (
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
                      ]}
                      destructive={[
                        ...(v.status === "DRAFT" && can("CLOSE")
                          ? [{ label: "Delete draft", icon: <Trash2Icon size={16} />, onClick: () => openDialog("delete") }]
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
        {viewingOlder ? (
          <Alert severity="info">
            You&apos;re viewing version {v.versionNumber}. The latest is version {latestNumber}; actions apply to the latest.
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
                  actionable={actionable}
                  repCategories={[...repCategoryPoints(sheet.lines), ...renewalStartPoints(sheet)]}
                  onDecide={openDecision}
                  legalEditor={v.legal ? <LegalTermsEditor key={v.updatedAt} quoteId={q.id} versionNumber={v.versionNumber} legal={v.legal} /> : undefined}
                  legalApproveBlock={legalApproveBlock(v.legal)}
                />
              </Box>
            ) : null}
            <Box
              sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", lg: "minmax(0,1fr) 320px" }, gap: 3, alignItems: "start" }}
            >
              <Box component="section" aria-label="The deal" sx={{ minWidth: 0 }}>
                <QuoteSheet sheet={sheet} />
              </Box>
              {/* The side column is pinned as one, so no part of it slides under
                  another; taller than the screen, it scrolls on its own (2026-10-13). */}
              <Stack
                spacing={3}
                sx={{
                  position: { lg: "sticky" },
                  top: { lg: 16 },
                  maxHeight: { lg: "calc(100vh - 32px)" },
                  overflowY: { lg: "auto" },
                }}
              >
                <StatusPanel
                  latest={shown.data}
                  events={events.data ?? []}
                  eventsError={events.error}
                  onRetryEvents={() => void events.refetch()}
                  documents={<DocumentsPanel quoteId={q.id} version={v.versionNumber} approved={v.status === "APPROVED"} />}
                />
                <OpportunityQuotesPanel quoteId={q.id} opportunityId={q.sfOpportunityId} />
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
          Version {v.versionNumber} will be taken back and can&apos;t be put back in flight. Afterwards you can revise it
          (start version {v.versionNumber + 1} as a copy) or close the quote.
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
        <PrimaryDialog quoteId={q.id} opportunityId={q.sfOpportunityId} isPrimary={q.isPrimary} onClose={() => setDialog(null)} />
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
