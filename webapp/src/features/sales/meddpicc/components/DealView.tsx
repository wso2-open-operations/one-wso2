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
import { Link as RouterLink } from "react-router";
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
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import {
  ArrowRightIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  MailIcon,
  NotebookPenIcon,
  VideoIcon,
} from "@wso2/oxygen-ui-icons-react";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { formatDateTime } from "../../util/salesTime";
import { describeError } from "../../util/salesError";
import {
  describeMoveStageError,
  useApproveDeal,
  useIncludeCalls,
  useMoveStage,
  type MoveStageFailure,
} from "../api/useMeddpiccMutations";
import type {
  ApproveResult,
  DealActivity,
  DealDetail,
  DealField,
  EvidenceSourceType,
  FieldValue,
  LetterKey,
} from "../types";
import { activityOf, describeSources, sourcesOf } from "../util/evidenceSource";
import {
  EMPTY_DRAFT,
  buildApproveRequest,
  hasSomethingToApprove,
  initialRoleMatches,
  unmatchedRoles,
  type ApprovalDraft,
} from "../util/approval";
import { formatAmount, formatSalesforceDate, letterLabel } from "../util/meddpiccFormat";
import DealFieldRow from "./DealFieldRow";
import MeddpiccCircles from "./MeddpiccCircles";
import StageChip from "./StageChip";

/**
 * One deal's MEDDPICC, as the body of its own page (/sales/deals/:opportunityId).
 *
 * A page rather than the drawer it used to be: a deal is somewhere people go and work,
 * and a page has an address to send, room for the fields beside the deal's timeline,
 * and survives a refresh. The page owns loading and errors; this renders a loaded deal.
 *
 * Two columns once there is room: the stage's fields, where the work happens, on the
 * left; what to ask next, the activity and products discussed on the right. The
 * approval bar stays in view at the bottom while the fields scroll.
 */
/** Gates in gates.json order, as the fields carry them. */
function gatesInOrder(fields: readonly DealField[]): string[] {
  return [...new Set(fields.map((field) => field.gate))];
}

export default function DealView({
  detail,
  initialLetter = null,
}: {
  detail: DealDetail;
  /** Open already filtered to one Letter: a circle was clicked to get here. */
  initialLetter?: LetterKey | null;
}) {
  const { deal, fields, canEdit } = detail;
  const { showSuccess } = useNotifications();
  const approve = useApproveDeal(deal.opportunityId);
  const moveStage = useMoveStage(deal.opportunityId);
  const includeCalls = useIncludeCalls(deal.opportunityId);

  const [letter, setLetter] = useState<LetterKey | null>(initialLetter);
  // Which source's evidence to show. Offered only once a deal has more than one kind.
  const [sourceFilter, setSourceFilter] = useState<EvidenceSourceType | null>(null);
  const [edits, setEdits] = useState<ApprovalDraft["edits"]>(EMPTY_DRAFT.edits);
  // Only the AM's own picks. The suggested Contact is layered underneath at
  // render time rather than copied in, so a refetched deal with a new
  // suggestion is honoured without an effect to resync it.
  const [roleChoices, setRoleChoices] = useState<Record<string, string>>({});
  const [approveResult, setApproveResult] = useState<ApproveResult | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [moveFailure, setMoveFailure] = useState<MoveStageFailure | null>(null);
  const [includeError, setIncludeError] = useState<string | null>(null);

  const draft: ApprovalDraft = {
    edits,
    roleMatches: { ...initialRoleMatches(fields), ...roleChoices },
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
  const matchRole = (key: string, contactId: string | null) => {
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
    try {
      const result = await approve.mutateAsync(buildApproveRequest(fields, draft));
      setApproveResult(result);
      if (!result.error) {
        setEdits({});
        setRoleChoices({});
        showSuccess(
          result.written.length
            ? `Written to Salesforce: ${result.written.map(labelOf).join(", ")}.`
            : "Approved. Nothing needed writing to Salesforce.",
        );
      }
    } catch (error: unknown) {
      setApproveError(describeError(error));
    }
  };

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

  const gates = gatesInOrder(fields);
  const currentGateFields = fields.filter((field) => field.gate === detail.currentStage);
  const otherGates = gates.filter((gate) => gate !== detail.currentStage);

  const approveHint = readOnly
    ? "Only the Opportunity owner, a call host or a Sales admin can approve."
    : unmatched.length > 0
      ? `Pick the matching contact for ${unmatched.map((f) => f.label.toLowerCase()).join(", ")}, or mark it not known.`
      : !somethingToApprove
        ? "Nothing is waiting for approval."
        : null;

  const renderField = (field: DealField) => (
    <DealFieldRow
      key={field.key}
      field={field}
      draft={draft}
      readOnly={readOnly}
      salesforceUrl={detail.salesforceUrl}
      onEdit={setEdit}
      onUndo={undoEdit}
      onRoleMatch={matchRole}
      sourceFilter={sourceFilter}
    />
  );

  const sources = sourcesOf(detail);
  const activity = activityOf(detail);
  const coverageByMeeting = new Map(detail.calls.map((call) => [call.meetingId, call.coverage]));
  const sourceKinds = (
    [
      ["CALL", "Calls", sources.calls],
      ["EMAIL", "Emails", sources.emails],
      ["ACTIVITY", "Activities", sources.activities],
    ] as const
  ).filter(([, , count]) => count > 0);

  return (
    <>
      {/* ---- Header: the page title names the deal ------------------------- */}
      <Box sx={{ pb: 2, mb: 2.5, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="body2" color="text.secondary">
          {deal.accountName}
          {" · "}
          {formatAmount(deal.amount, deal.currencyIsoCode)}
          {" · closes "}
          {formatSalesforceDate(deal.closeDate)}
        </Typography>

        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1, mt: 1.25 }}>
          <StageChip stage={deal.stage} />
          <MeddpiccCircles
            variant="dealState"
            values={deal.dealState}
            size="medium"
            selected={letter}
            onLetterClick={(key) => setLetter((current) => (current === key ? null : key))}
            label={`MEDDPICC for ${deal.name}. Pick a letter to show its fields.`}
          />
          <Button
            size="small"
            href={detail.salesforceUrl}
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<ExternalLinkIcon size={14} />}
            sx={{ ml: "auto" }}
          >
            Open in Salesforce
          </Button>
        </Stack>

        {/* What the deal's evidence is drawn from. Calls only for now; emails and
            Salesforce activities join here once the backend reads them. */}
        {(sources.calls + sources.emails + sources.activities > 0) && (
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.5, mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Evidence from {describeSources(sources)}
              {sources.lastActivityAt && ` · last activity ${formatDateTime(sources.lastActivityAt)}`}
            </Typography>
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
          </Stack>
        )}
      </Box>

      {/* ---- Body: fields on the left, the deal's context on the right ---- */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) minmax(280px, 360px)" },
          gap: 3,
          alignItems: "start",
        }}
      >
        <Stack spacing={1.5} sx={{ minWidth: 0 }}>
          {readOnly && (
            <Alert severity="info">
              You can view this deal. Only its owner, a call host or a Sales admin can approve, include calls or
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
                  ? `An earlier call with ${deal.accountName} isn't linked to this deal.`
                  : `${detail.unassignedCalls.length} earlier calls with ${deal.accountName} aren't linked to this deal.`}
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

          {letter ? (
            <Box>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
                <Typography variant="subtitle2">{letterLabel(letter)} across every Gate</Typography>
                <Chip label="Show all" size="small" onClick={() => setLetter(null)} onDelete={() => setLetter(null)} />
              </Stack>
              {gates.map((gate) => {
                const inGate = fields.filter((field) => field.gate === gate && field.letters.includes(letter));
                if (inGate.length === 0) return null;
                return (
                  <Box key={gate} sx={{ mb: 1 }}>
                    <Typography variant="overline" color="text.secondary">
                      {gate}
                    </Typography>
                    {inGate.map(renderField)}
                  </Box>
                );
              })}
              {fields.every((field) => !field.letters.includes(letter)) && (
                <Typography variant="body2" color="text.secondary">
                  No Gate field feeds {letterLabel(letter)}.
                </Typography>
              )}
            </Box>
          ) : (
            <>
              {currentGateFields.length > 0 ? (
                <Box>
                  <Typography variant="subtitle2">To leave {detail.currentStage}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {detail.gateComplete
                      ? "Every field this Gate needs is in Salesforce."
                      : `${detail.incomplete.length} of ${currentGateFields.length} still needed.`}
                  </Typography>
                  {currentGateFields.map(renderField)}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {deal.isClosed ? "This deal is closed." : `${detail.currentStage} has no Gate fields.`}
                </Typography>
              )}

              {otherGates.map((gate) => {
                const inGate = fields.filter((field) => field.gate === gate);
                const pending = inGate.filter((field) => field.proposal?.pending).length;
                return (
                  <Accordion
                    key={gate}
                    disableGutters
                    variant="outlined"
                    // Other Gates are reference; their fields mount only when opened.
                    slotProps={{ transition: { unmountOnExit: true } }}
                    sx={{ "&:before": { display: "none" } }}
                  >
                    <AccordionSummary expandIcon={<ChevronDownIcon size={16} />}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {gate} Gate
                      </Typography>
                      {pending > 0 && (
                        <Typography variant="caption" color="warning.dark" sx={{ ml: 1, alignSelf: "center" }}>
                          {pending} AI {pending === 1 ? "proposal" : "proposals"}
                        </Typography>
                      )}
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 0 }}>{inGate.map(renderField)}</AccordionDetails>
                  </Accordion>
                );
              })}
            </>
          )}

        </Stack>

        <Stack component="aside" spacing={2.5} sx={{ minWidth: 0 }} aria-label="About this deal">
          {detail.askNext.length > 0 && (
            <Box>
              <Typography variant="subtitle2">Ask next</Typography>
              <Typography variant="caption" color="text.secondary">
                Still open for this Gate, with nothing heard yet.
              </Typography>
              <Stack component="ol" spacing={0.75} sx={{ pl: 2.5, m: 0, mt: 0.75 }}>
                {detail.askNext.map((item) => (
                  <Typography component="li" variant="body2" key={item.fieldKey}>
                    {item.question}{" "}
                    <Typography component="span" variant="caption" color="text.secondary">
                      ({labelOf(item.fieldKey)})
                    </Typography>
                  </Typography>
                ))}
              </Stack>
            </Box>
          )}

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

          {activity.length > 0 && (
            <Box component="section" aria-label="Activity">
              <Typography variant="subtitle2">Activity ({activity.length})</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                Everything the deal's MEDDPICC is drawn from, newest first.
              </Typography>
              <Stack component="ul" spacing={0.75} sx={{ listStyle: "none", p: 0, m: 0, mt: 0.75 }}>
                {activity.map((entry) => (
                  <ActivityRow
                    key={`${entry.type}-${entry.id}`}
                    entry={entry}
                    coverage={entry.meetingId !== null ? coverageByMeeting.get(entry.meetingId) : undefined}
                  />
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      </Box>

      {/* ---- Footer: the two actions, kept in view while the fields scroll ---- */}
      <Box
        sx={{
          position: "sticky",
          bottom: 0,
          zIndex: 2,
          mt: 3,
          py: 1.5,
          borderTop: 1,
          borderColor: "divider",
          bgcolor: "background.default",
        }}
      >
        <Stack spacing={1}>
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

          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
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

            {detail.gateComplete && detail.nextStage && canEdit && (
              <Button
                variant="outlined"
                disabled={moveStage.isPending}
                onClick={() => void moveToNext()}
                endIcon={moveStage.isPending ? <CircularProgress size={14} /> : <ArrowRightIcon size={14} />}
              >
                Move to {detail.nextStage}
              </Button>
            )}

            {detail.lastApproval && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>
                Last approved by {detail.lastApproval.by}, {formatDateTime(detail.lastApproval.at)}
              </Typography>
            )}
          </Stack>

          {approveHint && !readOnly && (
            <Typography variant="caption" color="text.secondary" role="status">
              {approveHint}
            </Typography>
          )}
        </Stack>
      </Box>

    </>
  );
}

const ACTIVITY_ICON: Record<EvidenceSourceType, typeof VideoIcon> = {
  CALL: VideoIcon,
  EMAIL: MailIcon,
  ACTIVITY: NotebookPenIcon,
};

/**
 * One entry on the deal's timeline. A call links to its page and shows its circles; an
 * email or Salesforce activity links out and lists the Letters it touched.
 */
function ActivityRow({
  entry,
  coverage,
}: {
  entry: DealActivity;
  coverage: Record<LetterKey, 0 | 1 | 2> | null | undefined;
}) {
  const Icon = ACTIVITY_ICON[entry.type] ?? VideoIcon;
  const title =
    entry.type === "CALL" && entry.meetingId !== null ? (
      <Link component={RouterLink} to={`/sales/meetings/${entry.meetingId}`} underline="hover" color="inherit">
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
    <Stack
      component="li"
      direction="row"
      spacing={1.5}
      sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", rowGap: 0.5 }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
        <Box component="span" sx={{ display: "inline-flex", color: "text.secondary" }} aria-hidden>
          <Icon size={14} />
        </Box>
        <Typography variant="body2" sx={{ minWidth: 0 }}>
          {title}
          <Typography component="span" variant="caption" color="text.secondary">
            {" · "}
            {formatDateTime(entry.occurredAt)}
            {entry.actor && ` · ${entry.actor}`}
          </Typography>
        </Typography>
      </Stack>
      {entry.type === "CALL" ? (
        <MeddpiccCircles variant="coverage" values={coverage ?? null} label={`Coverage for ${entry.title}`} />
      ) : (
        entry.letters.length > 0 && (
          <Typography variant="caption" color="text.secondary">
            {entry.letters.map(letterLabel).join(", ")}
          </Typography>
        )
      )}
    </Stack>
  );
}
