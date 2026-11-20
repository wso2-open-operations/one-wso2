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

import { useEffect, useRef } from "react";
import { alpha, Box, Button, Chip, CircularProgress, Divider, Skeleton, Stack, Typography } from "@wso2/oxygen-ui";
import { RefreshCwIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import type { CallMeddpicc } from "../api/useCallMeddpicc";
import type { LetterKey } from "../types";
import { groupEvidence, lettersInWords, type CallProposal } from "../util/callInsight";
import { COVERAGE_LABELS, LETTER_KEYS, formatFieldValue, letterLabel } from "../util/meddpiccFormat";
import { EchoIcon } from "./EchoMarker";
import EvidenceItem from "./EvidenceItem";

/**
 * The meeting page's MEDDPICC tab: what this call said, Letter by Letter, and what is
 * still open.
 *
 * Two readers. Leadership comes for the evidence: what the customer actually said, a
 * click away from hearing it. The account manager comes to check the AI heard it right
 * and to prepare the next call. Both read the same quotes; only the last section differs
 * by who is reading, and only in whether it offers the review.
 *
 * No approval here. Writing to Salesforce happens on the deal page and nowhere else, so
 * there is one place to see what was approved. No score for the call either: this is the
 * account manager's working view, not a report on them.
 */
/** Analyse this call again, for whoever may: an admin or the call's host. */
export interface Reanalysis {
  allowed: boolean;
  inFlight: boolean;
  request: () => void;
}

export default function CallMeddpiccTab({
  call,
  focusLetter,
  onSeek,
  onOpenDeal,
  reanalysis,
}: {
  call: CallMeddpicc;
  /** The Letter a circle was clicked for, scrolled to and marked. */
  focusLetter: LetterKey | null;
  onSeek: (seconds: number) => void;
  onOpenDeal: () => void;
  /** Omitted where nobody can ask: the control is left out. */
  reanalysis?: Reanalysis;
}) {
  const sectionRefs = useRef(new Map<LetterKey, HTMLElement>());
  useEffect(() => {
    if (focusLetter) sectionRefs.current.get(focusLetter)?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [focusLetter]);

  const { coverage, insight } = call;

  if (call.coverageLoading) {
    return (
      <Stack spacing={1}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} variant="text" />
        ))}
      </Stack>
    );
  }

  // Here rather than in the calls table, which lists the recordings alone: the analysis is
  // asked for where it is read. Only once an analysis has finished or failed: a call with
  // no transcript, or an empty one, has nothing to analyse again, and one still running is
  // not asked twice.
  const analysing = coverage?.status === "PENDING" || coverage?.status === "RUNNING";
  const retriable = coverage?.status === "DONE" || coverage?.status === "FAILED";
  const analyseAgain =
    reanalysis?.allowed && retriable ? (
      <Button
        size="small"
        variant="outlined"
        startIcon={reanalysis.inFlight ? <CircularProgress size={14} color="inherit" /> : <RefreshCwIcon size={14} />}
        disabled={reanalysis.inFlight}
        onClick={reanalysis.request}
      >
        Analyse again
      </Button>
    ) : null;

  if (!coverage || coverage.status !== "DONE") {
    return (
      <Stack spacing={1.5} sx={{ alignItems: "flex-start" }}>
        <Typography variant="body2" color="text.secondary">
          {analysing
            ? "This call is being analysed. The evidence appears here when it's done."
            : coverage?.status === "FAILED"
              ? "MEDDPICC analysis failed for this call."
              : coverage?.status === "EMPTY"
                ? "No MEDDPICC: this call's transcript is empty, so there was nothing to analyse."
                : "No MEDDPICC yet: this call has no transcript to analyse."}
        </Typography>
        {analyseAgain}
      </Stack>
    );
  }

  // Letters the call touched but no quote was kept for: worth naming, so a circle that
  // shows "mentioned" isn't contradicted by an empty tab.
  const quoted = new Set(insight.evidence.map((group) => group.letter));
  const unquoted = LETTER_KEYS.filter((letter) => (insight.coverage?.[letter] ?? 0) > 0 && !quoted.has(letter));
  const focusMissing = focusLetter && !quoted.has(focusLetter);

  return (
    <Box sx={{ maxHeight: "60vh", overflowY: "auto", pr: 1 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <Typography variant="subtitle2">What this call evidenced</Typography>
        {analyseAgain}
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
        What was said, by Letter, and whether the customer or WSO2 said it. Play a quote to hear
        it in the recording.
      </Typography>

      {focusMissing && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          No quote was kept for {letterLabel(focusLetter)} from this call
          {insight.coverage ? ` (${COVERAGE_LABELS[insight.coverage[focusLetter] ?? 0]})` : ""}.
        </Typography>
      )}

      {call.dealLoading && <Skeleton variant="text" sx={{ mb: 1 }} />}
      {call.dealError != null && (
        <ErrorNotice onRetry={call.retryDeal} error={call.dealError} sx={{ mb: 1.5 }}>
          Couldn&apos;t load the deal, so proposals from this call aren&apos;t shown.
        </ErrorNotice>
      )}

      {insight.evidence.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No quotes were kept from this call.
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {groupEvidence(insight.evidence).map((group) => {
            const focused = focusLetter !== null && group.letters.includes(focusLetter);
            return (
              <Box
                key={group.letters.join("-")}
                ref={(el: HTMLElement | null) => {
                  for (const letter of group.letters) {
                    if (el) sectionRefs.current.set(letter, el);
                    else sectionRefs.current.delete(letter);
                  }
                }}
                aria-label={group.letters.map(letterLabel).join(", ")}
                component="section"
                sx={{
                  p: 1.5,
                  borderRadius: "10px",
                  border: 1,
                  borderColor: focused ? "primary.main" : "divider",
                  bgcolor: focused ? "action.selected" : "transparent",
                }}
              >
                <Stack direction="row" spacing={1} sx={{ alignItems: "baseline", flexWrap: "wrap", rowGap: 0.25, mb: 1 }}>
                  {group.letters.map((letter, i) => (
                    <Typography key={letter} variant="body2" component="span">
                      {i > 0 && (
                        <Box component="span" sx={{ color: "text.disabled", mr: 1 }}>
                          ·
                        </Box>
                      )}
                      <Box component="span" sx={{ fontWeight: 700 }}>
                        {letterLabel(letter)}
                      </Box>
                      {insight.coverage && (
                        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.75 }}>
                          {COVERAGE_LABELS[insight.coverage[letter] ?? 0]}
                        </Typography>
                      )}
                    </Typography>
                  ))}
                </Stack>

                {group.proposals.length > 0 && (
                  <Stack spacing={0.75} sx={{ mb: 1.25 }}>
                    {group.proposals.map((proposal) => (
                      <Suggestion key={proposal.fieldKey} proposal={proposal} />
                    ))}
                  </Stack>
                )}

                <Stack spacing={1}>
                  {group.quotes.map((item) => (
                    <EvidenceItem
                      key={`${item.offsetSeconds}-${item.quote}`}
                      quote={item.original}
                      currentMeetingId={coverage.meetingId}
                      onSeek={onSeek}
                    />
                  ))}
                </Stack>
              </Box>
            );
          })}
        </Stack>
      )}

      {unquoted.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
          Also discussed, with no quote kept: {lettersInWords(unquoted)}.
        </Typography>
      )}

      <Divider sx={{ my: 2.5 }} />

      <NextSteps call={call} onOpenDeal={onOpenDeal} />
    </Box>
  );
}

/** What the AI took from this call for one field: the field, the value, and where it stands. */
function Suggestion({ proposal }: { proposal: CallProposal }) {
  return (
    <Box
      sx={(theme) => ({
        display: "flex",
        gap: 1,
        alignItems: "flex-start",
        px: 1.25,
        py: 0.75,
        borderRadius: "8px",
        bgcolor: proposal.pending ? alpha(theme.palette.warning.main, 0.08) : "action.hover",
      })}
    >
      <Box component="span" sx={{ color: proposal.pending ? "warning.dark" : "text.secondary", display: "inline-flex", mt: "3px" }} aria-hidden>
        <EchoIcon size={14} />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.25 }}>
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            {proposal.fieldLabel}
          </Typography>
          <Chip
            label={proposal.pending ? "To review" : proposal.notInSalesforce ? "Kept in Echo" : "Matches Salesforce"}
            size="small"
            color={proposal.pending ? "warning" : "default"}
            variant="outlined"
            sx={{ height: 16, fontSize: "0.6rem", fontWeight: 600 }}
          />
          <Typography variant="caption" color="text.secondary">
            {Math.round(proposal.confidence * 100)}% confident
          </Typography>
        </Stack>
        <Typography variant="body2" sx={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}>
          {formatFieldValue(proposal.value)}
        </Typography>
      </Box>
    </Box>
  );
}

/**
 * What is still open, and the one action this page offers: going to the deal to review.
 *
 * The account manager gets the button. Anyone else sees the same facts as a status line,
 * since the deal's own canEdit already says who may approve.
 */
function NextSteps({ call, onOpenDeal }: { call: CallMeddpicc; onOpenDeal: () => void }) {
  const { insight, deal } = call;
  const pending = insight.pendingFromCall;

  return (
    <Box component="section" aria-label="Next steps">
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Next steps
      </Typography>

      {insight.missed.length > 0 && (
        <Typography variant="body2" sx={{ mb: 1 }}>
          <Box component="span" sx={{ color: "warning.dark", fontWeight: 600 }}>
            Missed:
          </Box>{" "}
          {lettersInWords(insight.missed)}
          <Typography component="span" variant="caption" color="text.secondary">
            {" "}
            — the {insight.stageAtCall ?? "opportunity's"} stage needs these.
          </Typography>
        </Typography>
      )}

      {insight.openQuestions.length > 0 && (
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            Ask on the next call
          </Typography>
          <Stack component="ul" spacing={0.5} sx={{ pl: 2.5, my: 0.5 }}>
            {insight.openQuestions.map((q) => (
              <Typography component="li" variant="body2" key={q.fieldKey}>
                {q.question}{" "}
                <Typography component="span" variant="caption" color="text.secondary">
                  ({q.letters.length ? lettersInWords(q.letters) : q.fieldLabel})
                </Typography>
              </Typography>
            ))}
          </Stack>
        </Box>
      )}

      {!call.opportunityId ? (
        <Typography variant="body2" color="text.secondary">
          This call isn&apos;t linked to an opportunity, so there is nothing to review.
        </Typography>
      ) : !deal ? null : deal.canEdit ? (
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <Button
            size="small"
            variant={pending > 0 ? "contained" : "outlined"}
            onClick={onOpenDeal}
            sx={{ textTransform: "none" }}
          >
            Review in opportunity
          </Button>
          <Typography variant="caption" color="text.secondary">
            {pending > 0
              ? `${pending} ${pending === 1 ? "proposal" : "proposals"} from this call ${pending === 1 ? "waits" : "wait"} for your review.`
              : "Nothing from this call is waiting for review."}
          </Typography>
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {pending > 0
            ? `${pending} ${pending === 1 ? "proposal" : "proposals"} from this call ${pending === 1 ? "waits" : "wait"} for the account manager's review.`
            : "Nothing from this call is waiting for review."}
        </Typography>
      )}
    </Box>
  );
}
