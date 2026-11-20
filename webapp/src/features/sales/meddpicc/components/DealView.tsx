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

import { useState, type ReactNode } from "react";
import { Link as RouterLink, useNavigate } from "react-router";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Link,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import {
  ArrowRightIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
  SparklesIcon,
} from "@wso2/oxygen-ui-icons-react";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { formatDateTime, parseUtc } from "../../util/salesTime";
import { describeError } from "../../util/salesError";
import {
  describeMoveStageError,
  describeRejectError,
  useApproveDeal,
  useIncludeCalls,
  useMoveStage,
  useRefreshDeal,
  useRejectProposal,
  type MoveStageFailure,
  type RejectFailure,
} from "../api/useMeddpiccMutations";
import type {
  ApproveResult,
  DealActivity,
  DealDetail,
  DealField,
  EvidenceSourceType,
  FieldValue,
  LetterKey,
  NewContact,
  RejectProposalRequest,
  TimelineMark,
} from "../types";
import { activityOf, describeSources, journeyOf, kindOf, sourcesOf } from "../util/evidenceSource";
import { defaultGate, gateSummaries, sectionsFor } from "../util/dealSections";
import { useNow } from "../../util/useNow";
import DealJourney, { KindMark, QUIET_AFTER_DAYS } from "./DealJourney";
import DealScore from "./DealScore";
import { DealFlags } from "./DealFlags";
import { KINDS } from "../util/timelineKinds";
import StagePath from "./StagePath";
import DealChat, { type ChatEntry } from "./DealChat";
import { meetingPath, type DealTab } from "../../util/salesPaths";
import {
  EMPTY_DRAFT,
  approvalSummary,
  buildApproveRequest,
  describeApproval,
  hasSomethingToApprove,
  initialRoleMatches,
  newContactProblem,
  pendingRoleFields,
  unmatchedRoles,
  type ApprovalDraft,
} from "../util/approval";
import { formatAmount, formatSalesforceDate, letterLabel } from "../util/meddpiccFormat";
import DealFieldRow from "./DealFieldRow";
import ProvenanceDrawer from "./ProvenanceDrawer";
import RejectProposalDialog from "./RejectProposalDialog";
import MeddpiccCircles from "./MeddpiccCircles";
import StageChip from "./StageChip";

/**
 * One deal's MEDDPICC, as the body of its own page (/sales/deals/:opportunityId).
 *
 * A page rather than the drawer it used to be: a deal is somewhere people go and work,
 * and a page has an address to send, room for the fields beside the deal's timeline,
 * and survives a refresh. The page owns loading and errors; this renders a loaded deal.
 *
 * Two tabs under the header, as a meeting has Summary, MEDDPICC and Transcript:
 * MEDDPICC, the stage's fields where the work happens, with the approval actions under the
 * stage path; and Activity, the deal's journey from start to close, its activity and the
 * products discussed. The page keeps the tab in the URL. Above them, the deal's facts.
 */

/** `record` without the given keys. */
function without<T>(record: Record<string, T>, keys: ReadonlySet<string>): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !keys.has(key)));
}

export default function DealView({
  detail,
  initialLetter = null,
  tab = "meddpicc",
  onTabChange,
}: {
  detail: DealDetail;
  /** Open already filtered to one Letter: a circle was clicked to get here. */
  initialLetter?: LetterKey | null;
  tab?: DealTab;
  onTabChange?: (tab: DealTab) => void;
}) {
  const { deal, fields, canEdit } = detail;
  const { showSuccess, showError } = useNotifications();
  const approve = useApproveDeal(deal.opportunityId);
  const moveStage = useMoveStage(deal.opportunityId);
  const includeCalls = useIncludeCalls(deal.opportunityId);
  const refresh = useRefreshDeal(deal.opportunityId);
  const reject = useRejectProposal(deal.opportunityId);

  const [letter, setLetter] = useState<LetterKey | null>(initialLetter);
  // The Ask AI thread lives here, so it survives switching tabs.
  const [chat, setChat] = useState<ChatEntry[]>([]);
  // The stage whose fields are shown; null opens on the current stage.
  const [pickedGate, setPickedGate] = useState<string | null>(null);
  const pickGate = (next: string) => {
    setPickedGate(next);
    setLetter(null);
  };
  // Which source's evidence to show. Offered only once a deal has more than one kind.
  const [sourceFilter, setSourceFilter] = useState<EvidenceSourceType | null>(null);
  const [edits, setEdits] = useState<ApprovalDraft["edits"]>(EMPTY_DRAFT.edits);
  // Only the AM's own picks. The suggested Contact is layered underneath at
  // render time rather than copied in, so a refetched deal with a new
  // suggestion is honoured without an effect to resync it.
  const [roleChoices, setRoleChoices] = useState<Record<string, string>>({});
  // The Contacts the AM asked Approve all to create, by role field.
  const [newContacts, setNewContacts] = useState<Record<string, NewContact>>({});
  // The field whose suggestion is being explained in the side panel; null when it is closed.
  const [explained, setExplained] = useState<DealField | null>(null);
  const [approveResult, setApproveResult] = useState<ApproveResult | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [moveFailure, setMoveFailure] = useState<MoveStageFailure | null>(null);
  const [includeError, setIncludeError] = useState<string | null>(null);
  // The field whose suggestion is being rejected in the dialog; null when it is closed.
  const [rejecting, setRejecting] = useState<DealField | null>(null);
  const [rejectFailure, setRejectFailure] = useState<RejectFailure | null>(null);

  const draft: ApprovalDraft = {
    edits,
    roleMatches: { ...initialRoleMatches(fields), ...roleChoices },
    newContacts,
  };
  const unmatched = unmatchedRoles(fields, draft);
  const somethingToApprove = hasSomethingToApprove(fields, draft);
  const readOnly = !canEdit;

  const labelOf = (key: string) => fields.find((f) => f.key === key)?.label ?? key;

  const setEdit = (key: string, value: FieldValue) => setEdits((prev) => ({ ...prev, [key]: value }));
  const undoEdit = (key: string) =>
    setEdits((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  const dropNewContact = (key: string) =>
    setNewContacts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  // "Create a contact" is the AM's whole answer for the role: it replaces a match or a clear.
  const setNewContact = (key: string, contact: NewContact | null) => {
    if (contact === null) {
      dropNewContact(key);
      return;
    }
    undoEdit(key);
    setRoleChoices((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setNewContacts((prev) => ({ ...prev, [key]: contact }));
  };
  const matchRole = (key: string, contactId: string | null) => {
    dropNewContact(key);
    if (contactId === null) {
      // "Not known": a clear, and no match alongside it.
      setEdit(key, null);
      setRoleChoices((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }
    undoEdit(key);
    setRoleChoices((prev) => ({ ...prev, [key]: contactId }));
  };

  const approveAll = async () => {
    setApproveError(null);
    setApproveResult(null);
    const request = buildApproveRequest(fields, draft);
    try {
      const result = await approve.mutateAsync(request);
      setApproveResult(result);
      if (!result.error) {
        // Only what this request carried is cleared: an answer given while it was in
        // flight was not sent, and stays for the next Approve all.
        const sent = new Set([
          ...Object.keys(request.edits),
          ...Object.keys(request.roleMatches),
          ...Object.keys(request.newContacts ?? {}),
        ]);
        setEdits((prev) => without(prev, sent));
        setRoleChoices((prev) => without(prev, sent));
        setNewContacts((prev) => without(prev, sent));
        const created = result.createdContacts ?? [];
        const said = [
          result.written.length ? `Written to Salesforce: ${result.written.map(labelOf).join(", ")}.` : "",
          created.length ? `Created in Salesforce: ${created.map((c) => c.name).join(", ")}.` : "",
        ].filter(Boolean);
        showSuccess(said.length ? said.join(" ") : "Approved. Nothing needed writing to Salesforce.");
      }
    } catch (error: unknown) {
      setApproveError(describeError(error));
    }
  };

  const openReject = (field: DealField) => {
    setRejectFailure(null);
    setRejecting(field);
  };

  const rejectProposal = async (request: RejectProposalRequest) => {
    if (!rejecting) return;
    const { key, label, kind } = rejecting;
    setRejectFailure(null);
    try {
      await reject.mutateAsync({ fieldKey: key, request });
      // A role's answers belong to the suggestion that just went: a "not known" left in the
      // draft would otherwise go out with Approve all as a clear of the role in Salesforce.
      if (kind === "role") {
        undoEdit(key);
        dropNewContact(key);
        setRoleChoices((prev) => without(prev, new Set([key])));
      }
      setRejecting(null);
      showSuccess(`Rejected the suggestion for ${label}. Nothing changed in Salesforce.`);
    } catch (error: unknown) {
      setRejectFailure(describeRejectError(error));
    }
  };

  const refreshDeal = () =>
    refresh.mutate(undefined, {
      onError: (err) => showError(`Couldn't refresh from Salesforce: ${describeError(err)}`),
    });

  const moveToNext = async () => {
    if (!detail.nextStage) return;
    setMoveFailure(null);
    try {
      const result = await moveStage.mutateAsync(detail.nextStage);
      showSuccess(`Moved to ${result.stage}.`);
    } catch (error: unknown) {
      setMoveFailure(describeMoveStageError(error));
    }
  };

  const include = async (meetingIds: number[]) => {
    setIncludeError(null);
    try {
      await includeCalls.mutateAsync(meetingIds);
      showSuccess(meetingIds.length === 1 ? "Call included." : `${meetingIds.length} calls included.`);
    } catch (error: unknown) {
      setIncludeError(describeError(error));
    }
  };

  // The fields, sorted for the AM: what the AI wants checked, what is missing, and what
  // Salesforce already has. One stage at a time, or one Letter across every stage.
  const summaries = gateSummaries(detail, draft);
  const gate = pickedGate ?? defaultGate(detail, summaries);
  const sections = sectionsFor(detail, draft, letter ? { letter } : { gate });
  const askNextByField = new Map(detail.askNext.map((item) => [item.fieldKey, item.question]));
  const scopeName = letter ? letterLabel(letter) : gate;

  // A new contact the AM has not finished: Approve all waits for it. Only for a role still
  // waiting: a draft for one settled meanwhile is not sent, so it must not block the rest.
  const pendingRoles = new Set(pendingRoleFields(fields).map((field) => field.key));
  const contactProblem = Object.entries(newContacts)
    .filter(([key]) => pendingRoles.has(key))
    .map(([key, contact]) => ({ key, problem: newContactProblem(contact) }))
    .find((entry) => entry.problem !== null);

  const approveHint = readOnly
    ? "Only the Opportunity owner can approve."
    : unmatched.length > 0
      ? `Pick the matching contact for ${unmatched.map((f) => f.label.toLowerCase()).join(", ")}, or mark it not known.`
      : contactProblem
        ? `Finish the new contact for ${labelOf(contactProblem.key).toLowerCase()}: ${contactProblem.problem}.`
        : !somethingToApprove
          ? "Nothing is waiting for approval."
          : null;
  // What the button is about to do, in one sentence, before anything reaches Salesforce.
  const summaryText = describeApproval(approvalSummary(fields, draft));

  // Whether the action card is needed: something to approve (or a role still to match),
  // a stage to move to, or a result or failure from the last attempt to show.
  const canMoveStage = Boolean(detail.gateComplete && detail.nextStage && canEdit);
  const showActions =
    (!readOnly && (somethingToApprove || unmatched.length > 0)) ||
    canMoveStage ||
    Boolean(approveError || approveResult?.error || approveResult?.skipped.length || moveFailure);
  const lastApproved = detail.lastApproval && (
    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
      Last approved by {detail.lastApproval.by}, {formatDateTime(detail.lastApproval.at)}
    </Typography>
  );

  const renderField = (field: DealField, variant: "full" | "compact" = "full") => (
    <DealFieldRow
      key={field.key}
      field={field}
      draft={draft}
      readOnly={readOnly}
      salesforceUrl={detail.salesforceUrl}
      onEdit={setEdit}
      onUndo={undoEdit}
      onRoleMatch={matchRole}
      onNewContact={setNewContact}
      onExplain={setExplained}
      onReject={openReject}
      accountName={deal.accountName}
      sourceFilter={sourceFilter}
      variant={variant}
      askNext={variant === "full" ? askNextByField.get(field.key) : undefined}
      gateTag={letter ? field.gate : undefined}
    />
  );

  const sources = sourcesOf(detail);
  const activity = activityOf(detail);
  const now = useNow();
  const navigate = useNavigate();
  // The source chips (All / Calls / Emails / Activities) filter what this page shows of
  // the deal's activity: the evidence quotes, the activity list and the journey's marks.
  const shownActivity = sourceFilter ? activity.filter((a) => a.type === sourceFilter) : activity;
  // The journey's marks: the deal row's own timeline when the backend sends one, else
  // the activity list, oldest first.
  const journeyMarks: TimelineMark[] = (
    deal.timeline ??
    [...activity]
      .map((a) => ({
        type: a.type,
        kind: kindOf(a),
        at: a.occurredAt,
        title: a.title,
        meetingId: a.meetingId,
      }))
      .sort((x, y) => (parseUtc(x.at)?.getTime() ?? 0) - (parseUtc(y.at)?.getTime() ?? 0))
  ).filter((mark) => !sourceFilter || mark.type === sourceFilter);
  const coverageByMeeting = new Map(detail.calls.map((call) => [call.meetingId, call.coverage]));
  const sourceKinds = (
    [
      ["CALL", "Calls", sources.calls],
      ["EMAIL", "Emails", sources.emails],
      ["ACTIVITY", "Activities", sources.activities],
    ] as const
  ).filter(([, , count]) => count > 0);

  // The header's facts. Times from the backend may carry no zone; parseUtc reads them as UTC.
  const reviewCount = summaries.reduce((n, s) => n + s.review, 0);
  const filledLetters = Object.values(deal.dealState).filter((state) => state === "FILLED").length;
  const closeEnd = deal.closeDate ? parseUtc(`${deal.closeDate.slice(0, 10)} 23:59:59`)?.getTime() : undefined;
  const closeDays = closeEnd === undefined ? null : Math.floor((closeEnd - now) / 86_400_000);
  const lastMs = sources.lastActivityAt ? parseUtc(sources.lastActivityAt)?.getTime() : undefined;
  const quietDays = lastMs === undefined ? null : Math.max(0, Math.floor((now - lastMs) / 86_400_000));

  return (
    <>
      {/* ---- Header: the deal at a glance. The page title names it. ---------- */}
      <Box sx={{ mb: 2.5 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(6, minmax(0, 1fr))" },
            gap: 1.25,
          }}
        >
          <Fact label="Account" value={deal.accountName} />
          <Fact label="Amount" value={formatAmount(deal.amount, deal.currencyIsoCode)} />
          <Fact
            label="Close date"
            value={formatSalesforceDate(deal.closeDate)}
            detail={closeDays === null ? undefined : closeDays < 0 ? `${-closeDays} days past` : closeDays === 0 ? "today" : `in ${closeDays} days`}
            warn={closeDays !== null && closeDays < 0 && !deal.isClosed}
          />
          <Fact label="Owner" value={deal.ownerName ?? deal.ownerEmail ?? "—"} />
          <Fact
            label="Last activity"
            value={quietDays === null ? "None yet" : quietDays === 0 ? "Today" : quietDays === 1 ? "Yesterday" : `${quietDays} days ago`}
            detail={describeSources(sources) || undefined}
            warn={quietDays !== null && quietDays > QUIET_AFTER_DAYS}
          />
          <Fact label="Opportunity score" value={<DealScore score={deal.dealScore} />} detail="From Salesforce" />
        </Box>

        {deal.flags && deal.flags.length > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <DealFlags flags={deal.flags} />
          </Box>
        )}

        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1, mt: 2 }}>
          <StageChip stage={deal.stage} />
          <MeddpiccCircles
            variant="dealState"
            values={deal.dealState}
            size="medium"
            selected={letter}
            onLetterClick={(key) => {
              // A Letter filters the fields, so picking one shows them.
              setLetter((current) => (current === key ? null : key));
              onTabChange?.("meddpicc");
            }}
            label={`MEDDPICC for ${deal.name}. Pick a letter to show its fields.`}
          />
          <Typography variant="body2" color="text.secondary">
            {filledLetters} of 8 in Salesforce
            {reviewCount > 0 && (
              <Box component="span" sx={{ color: "warning.dark", fontWeight: 600 }}>
                {` · ${reviewCount} to review`}
              </Box>
            )}
          </Typography>
          {/* Which source's evidence to show, once a deal has more than one kind. */}
          {sourceKinds.length > 1 && (
            <Stack direction="row" spacing={0.5} role="group" aria-label="Show evidence from">
              <Chip
                label="All"
                size="small"
                variant={sourceFilter === null ? "filled" : "outlined"}
                onClick={() => setSourceFilter(null)}
              />
              {sourceKinds.map(([type, label]) => (
                <Chip
                  key={type}
                  label={label}
                  size="small"
                  variant={sourceFilter === type ? "filled" : "outlined"}
                  onClick={() => setSourceFilter(type)}
                />
              ))}
            </Stack>
          )}
          {/* The backend keeps Salesforce's answer for ten minutes; this asks again, for
              when a change made in Salesforce should show now. */}
          <Tooltip title="Read this opportunity from Salesforce again" arrow>
            <Box component="span" sx={{ ml: "auto !important", display: "inline-flex" }}>
              <Button
                size="small"
                aria-label="Refresh from Salesforce"
                disabled={refresh.isPending}
                onClick={refreshDeal}
                startIcon={refresh.isPending ? <CircularProgress size={14} /> : <RefreshCwIcon size={14} />}
                sx={{ textTransform: "none" }}
              >
                Refresh
              </Button>
            </Box>
          </Tooltip>
          <Button
            size="small"
            variant="outlined"
            href={detail.salesforceUrl}
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<ExternalLinkIcon size={14} />}
            sx={{ textTransform: "none" }}
          >
            Open in Salesforce
          </Button>
        </Stack>
      </Box>

      {/* ---- Tabs: the MEDDPICC work, and the deal's activity ---------------- */}
      <Tabs
        value={tab}
        onChange={(_, next: DealTab) => onTabChange?.(next)}
        aria-label="Opportunity views"
        sx={{
          mb: 2.5,
          minHeight: 40,
          borderBottom: 1,
          borderColor: "divider",
          "& .MuiTab-root": { minHeight: 40, textTransform: "none" },
        }}
      >
        <Tab
          value="meddpicc"
          aria-label={reviewCount > 0 ? `MEDDPICC, ${reviewCount} to review` : "MEDDPICC"}
          label={
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
              <span>MEDDPICC</span>
              {reviewCount > 0 && (
                <Chip label={reviewCount} size="small" color="warning" sx={{ height: 18, fontSize: "0.7rem", fontWeight: 700 }} />
              )}
            </Stack>
          }
        />
        <Tab value="activity" label={`Activity (${activity.length})`} />
        <Tab
          value="ask"
          label={
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
              <SparklesIcon size={14} aria-hidden />
              <span>Ask AI</span>
            </Stack>
          }
        />
      </Tabs>

      {tab === "meddpicc" ? (
        <>
          <Stack spacing={1.5} sx={{ minWidth: 0 }}>
            {readOnly && (
              <Alert severity="info">
                You can view this opportunity. Only its Opportunity owner can approve, include calls or
                move its stage.
              </Alert>
            )}

            {detail.unassignedCalls.length > 0 && (
              <Alert
                severity="info"
                action={
                  !readOnly && detail.unassignedCalls.length > 1 ? (
                    <Button
                      size="small"
                      color="inherit"
                      disabled={includeCalls.isPending}
                      onClick={() => void include(detail.unassignedCalls.map((c) => c.meetingId))}
                    >
                      Include all
                    </Button>
                  ) : undefined
                }
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {detail.unassignedCalls.length === 1
                    ? `An earlier call with ${deal.accountName} isn't linked to this opportunity.`
                    : `${detail.unassignedCalls.length} earlier calls with ${deal.accountName} aren't linked to this opportunity.`}
                </Typography>
                <Stack component="ul" spacing={0.5} sx={{ listStyle: "none", p: 0, m: 0, mt: 0.75 }}>
                  {detail.unassignedCalls.map((call) => (
                    <Stack
                      component="li"
                      key={call.meetingId}
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "center", flexWrap: "wrap" }}
                    >
                      <Typography variant="body2">
                        {call.title} · {formatDateTime(call.start)}
                        {call.letters.length > 0 && ` · covers ${call.letters.map(letterLabel).join(", ")}`}
                      </Typography>
                      {!readOnly && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="inherit"
                          disabled={includeCalls.isPending}
                          onClick={() => void include([call.meetingId])}
                          aria-label={`Include ${call.title}`}
                        >
                          Include
                        </Button>
                      )}
                    </Stack>
                  ))}
                </Stack>
              </Alert>
            )}
            {includeError && <Alert severity="error">{includeError}</Alert>}

            <StagePath stages={summaries} current={detail.currentStage} selected={letter ? null : gate} onSelect={pickGate} />

          {/* ---- Actions ---------------------------------------------------------
              Under the stage path, where Salesforce puts its own stage button: what
              Approve all will do, with the two actions on the right. In the page's flow,
              never floating over the fields. With nothing to approve and no stage to move,
              a quiet line says so instead of a bar of disabled buttons. */}
          {showActions ? (
            <Box
              sx={{
                px: 2,
                py: 1.25,
                border: 1,
                borderColor: "divider",
                borderRadius: 2,
                bgcolor: "background.paper",
              }}
            >
              <Stack spacing={1.25}>
                {approveError && <Alert severity="error">{approveError}</Alert>}
                {approveResult?.error && (
                  <Alert severity="error">
                    Salesforce refused the update: {approveResult.error.message}
                    {approveResult.error.fields && approveResult.error.fields.length > 0 && (
                      <> ({approveResult.error.fields.map(labelOf).join(", ")})</>
                    )}
                  </Alert>
                )}
                {approveResult && !approveResult.error && approveResult.skipped.length > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    Not written: {approveResult.skipped.map((s) => `${labelOf(s.fieldKey)} (${s.reason})`).join(", ")}.
                  </Typography>
                )}

                {moveFailure?.kind === "incomplete" && (
                  <Alert severity="warning">
                    {moveFailure.message}
                    {moveFailure.incomplete.length > 0 && <> Still needed: {moveFailure.incomplete.map(labelOf).join(", ")}.</>}
                  </Alert>
                )}
                {moveFailure?.kind === "refused" && (
                  <Alert
                    severity="error"
                    action={
                      <Button
                        size="small"
                        color="inherit"
                        href={moveFailure.salesforceUrl ?? detail.salesforceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        endIcon={<ExternalLinkIcon size={14} />}
                      >
                        Open in Salesforce
                      </Button>
                    }
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Salesforce didn&apos;t change the stage.
                    </Typography>
                    <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                      {moveFailure.message}
                    </Typography>
                  </Alert>
                )}
                {moveFailure?.kind === "other" && <Alert severity="error">{moveFailure.message}</Alert>}

                <Stack direction="row" spacing={2} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
                  <Box sx={{ minWidth: 0, flex: "1 1 240px" }}>
                    {approveHint && !readOnly ? (
                      <Typography variant="body2" color="text.secondary" role="status">
                        {approveHint}
                      </Typography>
                    ) : (
                      <Typography variant="body2">
                        {somethingToApprove
                          ? summaryText || "Approve all writes your reviewed answers to Salesforce."
                          : `This stage is complete. Move the opportunity on when you're ready.`}
                      </Typography>
                    )}
                    {lastApproved}
                  </Box>

                  {canMoveStage && (
                    <Button
                      variant="outlined"
                      disabled={moveStage.isPending}
                      onClick={() => void moveToNext()}
                      endIcon={moveStage.isPending ? <CircularProgress size={14} /> : <ArrowRightIcon size={14} />}
                    >
                      Move to {detail.nextStage}
                    </Button>
                  )}

                  {!readOnly && (
                    <Tooltip title={approveHint ?? ""} arrow>
                      {/* The span keeps the tooltip working on a disabled button. */}
                      <Box component="span" sx={{ display: "inline-flex" }}>
                        <Button
                          variant="contained"
                          disabled={approveHint !== null || approve.isPending}
                          onClick={() => void approveAll()}
                          startIcon={approve.isPending ? <CircularProgress size={14} color="inherit" /> : undefined}
                        >
                          Approve all{deal.pendingCount > 0 ? ` (${deal.pendingCount})` : ""}
                        </Button>
                      </Box>
                    </Tooltip>
                  )}
                </Stack>
              </Stack>
            </Box>
          ) : (
            <Box>
              <Typography variant="caption" color="text.secondary">
                {readOnly ? "" : "Nothing is waiting for approval."}
                {!readOnly && detail.lastApproval ? " · " : ""}
                {detail.lastApproval &&
                  `Last approved by ${detail.lastApproval.by}, ${formatDateTime(detail.lastApproval.at)}`}
              </Typography>
            </Box>
          )}

            {letter && (
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Typography variant="body2" color="text.secondary">
                  Showing {letterLabel(letter)} across every stage
                </Typography>
                <Chip label="Back to stages" size="small" onClick={() => setLetter(null)} onDelete={() => setLetter(null)} />
              </Stack>
            )}

            <FieldSection
              title="Needs your review"
              tone="warning"
              count={sections.review.length}
              description="What the calls say, next to what Salesforce has. Approve all writes the suggestions; edit one first if it isn't right."
              hideWhenEmpty
            >
              {sections.review.map((field) => renderField(field))}
            </FieldSection>

            <FieldSection
              title="Missing"
              tone="info"
              count={sections.missing.length}
              description="This stage needs these, and nothing has been heard for them yet."
              empty={
                letter
                  ? `Nothing is missing for ${scopeName}.`
                  : deal.isClosed
                    ? "This opportunity is closed."
                    : `Nothing is missing in ${scopeName}.`
              }
            >
              {sections.missing.map((field) => renderField(field))}
            </FieldSection>

            <SalesforceSection
              done={sections.done}
              optional={sections.optional}
              notNeeded={sections.notNeeded}
              render={(field) => renderField(field, "compact")}
            />
          </Stack>

        </>
      ) : tab === "activity" ? (
        <Stack spacing={3} sx={{ minWidth: 0, maxWidth: 960 }}>
          {/* The deal's journey, as on the Deals list, for this deal alone. */}
          <Box component="section" aria-label="Journey">
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              Journey
            </Typography>
            <DealJourney
              marks={journeyMarks}
              journey={journeyOf(deal)}
              sources={sources}
              closeDate={deal.closeDate}
              now={now}
              onOpenCall={(meetingId) => void navigate(meetingPath(meetingId, { tab: "meddpicc" }))}
            />
          </Box>

          {detail.productsDiscussed.length > 0 && (
            <Box>
              <Typography variant="subtitle2">Products discussed</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                A hint from the calls. Never written to Salesforce, and not the product line items.
              </Typography>
              <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", rowGap: 0.75, mt: 0.75 }}>
                {detail.productsDiscussed.map((product) => (
                  <Chip key={product} label={product} size="small" variant="outlined" />
                ))}
              </Stack>
            </Box>
          )}

          {shownActivity.length > 0 && (
            <Box component="section" aria-label="Activity">
              <Typography variant="subtitle2">
                Activity ({shownActivity.length}
                {sourceFilter ? ` of ${activity.length}` : ""})
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                Everything the opportunity's MEDDPICC is drawn from, newest first.
              </Typography>
              <Stack component="ul" spacing={0.75} sx={{ listStyle: "none", p: 0, m: 0, mt: 0.75 }}>
                {shownActivity.map((entry) => (
                  <ActivityRow
                    key={`${entry.type}-${entry.id}`}
                    entry={entry}
                    coverage={entry.meetingId !== null ? coverageByMeeting.get(entry.meetingId) : undefined}
                    now={now}
                  />
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      ) : (
        <DealChat opportunityId={deal.opportunityId} entries={chat} onChange={setChat} />
      )}

      {/* The full account of a suggestion, beside the page; the field is read fresh from the deal. */}
      <ProvenanceDrawer
        field={explained ? (fields.find((f) => f.key === explained.key) ?? explained) : null}
        detail={detail}
        open={explained !== null}
        onClose={() => setExplained(null)}
      />

      <RejectProposalDialog
        field={rejecting}
        open={rejecting !== null}
        pending={reject.isPending}
        failure={rejectFailure}
        onClose={() => setRejecting(null)}
        onConfirm={(request) => void rejectProposal(request)}
        onRefresh={() => {
          setRejecting(null);
          refreshDeal();
        }}
      />
    </>
  );
}

/**
 * One entry on the deal's activity list: the same mark the journey draws for it, its
 * title (a call opens its analysis; an email or Salesforce record opens there), what it
 * was and when, and who. An analysed call shows its circles; anything else the Letters it
 * touched. Entries still to come say so.
 */
function ActivityRow({
  entry,
  coverage,
  now,
}: {
  entry: DealActivity;
  coverage: Record<LetterKey, 0 | 1 | 2> | null | undefined;
  now: number;
}) {
  const kind = kindOf(entry);
  const upcoming = (parseUtc(entry.occurredAt)?.getTime() ?? 0) > now;
  const title =
    entry.type === "CALL" && entry.meetingId !== null ? (
      <Link component={RouterLink} to={meetingPath(entry.meetingId, { tab: "meddpicc" })} underline="hover" color="inherit">
        {entry.title}
      </Link>
    ) : entry.url ? (
      <Link href={entry.url} target="_blank" rel="noopener noreferrer" underline="hover" color="inherit">
        {entry.title}
      </Link>
    ) : (
      entry.title
    );
  return (
    <Stack component="li" direction="row" spacing={1.25} sx={{ alignItems: "flex-start", py: 0.5 }}>
      <Box sx={{ width: 14, height: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <KindMark kind={kind} upcoming={upcoming} />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 500, overflowWrap: "anywhere" }}>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="div">
          {KINDS[kind].label}
          {upcoming && (
            <Box component="span" sx={{ color: "primary.main", fontWeight: 600 }}>
              {" · upcoming"}
            </Box>
          )}
          {" · "}
          {formatDateTime(entry.occurredAt)}
          {entry.actor && ` · ${entry.actor}`}
        </Typography>
        {entry.type === "CALL" && coverage ? (
          <Box sx={{ mt: 0.5 }}>
            <MeddpiccCircles variant="coverage" values={coverage} label={`Coverage for ${entry.title}`} />
          </Box>
        ) : (
          entry.letters.length > 0 && (
            <Typography variant="caption" color="text.secondary" component="div">
              Touched {entry.letters.map(letterLabel).join(", ")}
            </Typography>
          )
        )}
      </Box>
    </Stack>
  );
}

/**
 * One of the two sections the AM works through: a heading with its count, a line on what
 * it holds, and the fields. A coloured edge marks the section. When it is empty it says
 * so in a line, or with `hideWhenEmpty` is left out: the review section, whose "nothing
 * to approve" the approval bar above already says.
 */
function FieldSection({
  title,
  tone,
  count,
  description,
  empty,
  hideWhenEmpty = false,
  children,
}: {
  title: string;
  tone: "warning" | "info";
  count: number;
  description: string;
  empty?: string;
  hideWhenEmpty?: boolean;
  children: ReactNode;
}) {
  if (count === 0 && hideWhenEmpty) return null;
  return (
    <Box
      component="section"
      aria-label={title}
      sx={{
        borderLeft: 3,
        borderColor: count > 0 ? `${tone}.main` : "divider",
        pl: 1.75,
        py: 0.5,
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        {count > 0 && (
          <Chip label={count} size="small" color={tone} sx={{ height: 20, fontWeight: 700 }} />
        )}
      </Stack>
      {count > 0 ? (
        <>
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }}>
            {description}
          </Typography>
          {children}
        </>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ py: 0.5 }}>
          {empty}
        </Typography>
      )}
    </Box>
  );
}

/**
 * What Salesforce already has, folded away: a field that is in needs no work, so it is a
 * line to read, not a card to act on. Each line still has Edit. Optional fields left
 * empty, and fields this deal doesn't need, sit at the end.
 */
function SalesforceSection({
  done,
  optional,
  notNeeded,
  render,
}: {
  done: DealField[];
  optional: DealField[];
  notNeeded: DealField[];
  render: (field: DealField) => ReactNode;
}) {
  const total = done.length + optional.length + notNeeded.length;
  if (total === 0) return null;
  return (
    <Accordion
      disableGutters
      variant="outlined"
      // Read-only reference; its rows mount only when opened.
      slotProps={{ transition: { unmountOnExit: true } }}
      sx={{ "&:before": { display: "none" } }}
    >
      <AccordionSummary expandIcon={<ChevronDownIcon size={16} />}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Already in Salesforce
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
          {done.length}
          {optional.length > 0 && ` · ${optional.length} optional left empty`}
          {notNeeded.length > 0 && ` · ${notNeeded.length} not needed`}
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        {done.map(render)}
        {optional.map(render)}
        {notNeeded.map(render)}
      </AccordionDetails>
    </Accordion>
  );
}

/** One fact in the header: a label, the value, and a line of detail. */
function Fact({ label, value, detail, warn = false }: { label: string; value: ReactNode; detail?: string; warn?: boolean }) {
  return (
    <Box sx={{ border: 1, borderColor: "divider", borderRadius: "10px", px: 1.5, py: 1, minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" component="div">
        {label}
      </Typography>
      <Typography
        variant="body2"
        component="div"
        title={typeof value === "string" ? value : undefined}
        sx={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
      >
        {value}
      </Typography>
      {detail && (
        <Typography
          variant="caption"
          component="div"
          sx={{
            color: warn ? "warning.dark" : "text.secondary",
            fontWeight: warn ? 600 : 400,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {detail}
        </Typography>
      )}
    </Box>
  );
}
