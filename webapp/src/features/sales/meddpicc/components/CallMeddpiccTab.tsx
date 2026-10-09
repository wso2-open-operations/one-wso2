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
import { Box, Button, Divider, Skeleton, Stack, Typography } from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import type { CallMeddpicc } from "../api/useCallMeddpicc";
import type { LetterKey } from "../types";
import { lettersInWords, type CallEvidence } from "../util/callInsight";
import { COVERAGE_LABELS, LETTER_KEYS, formatFieldValue, letterLabel } from "../util/meddpiccFormat";
import { AiMarker } from "./DealFieldRow";
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
export default function CallMeddpiccTab({
  call,
  focusLetter,
  onSeek,
  onOpenDeal,
}: {
  call: CallMeddpicc;
  /** The Letter a circle was clicked for, scrolled to and marked. */
  focusLetter: LetterKey | null;
  onSeek: (seconds: number) => void;
  onOpenDeal: () => void;
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
  if (!coverage || coverage.status !== "DONE") {
    return (
      <Typography variant="body2" color="text.secondary">
        {coverage?.status === "PENDING" || coverage?.status === "RUNNING"
          ? "This call is being analysed. The evidence appears here when it's done."
          : coverage?.status === "FAILED"
            ? "MEDDPICC analysis failed for this call."
            : "No MEDDPICC yet: this call has no transcript to analyse."}
      </Typography>
    );
  }

  // Letters the call touched but no quote was kept for: worth naming, so a circle that
  // shows "mentioned" isn't contradicted by an empty tab.
  const quoted = new Set(insight.evidence.map((group) => group.letter));
  const unquoted = LETTER_KEYS.filter((letter) => (insight.coverage?.[letter] ?? 0) > 0 && !quoted.has(letter));
  const focusMissing = focusLetter && !quoted.has(focusLetter);

  return (
    <Box sx={{ maxHeight: "60vh", overflowY: "auto", pr: 1 }}>
      <Typography variant="subtitle2">What this call evidenced</Typography>
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
          {insight.evidence.map(({ letter, items }) => (
            <Box
              key={letter}
              ref={(el: HTMLElement | null) => {
                if (el) sectionRefs.current.set(letter, el);
                else sectionRefs.current.delete(letter);
              }}
              aria-label={letterLabel(letter)}
              component="section"
              sx={{
                p: 1.25,
                borderRadius: 1,
                border: 1,
                borderColor: focusLetter === letter ? "primary.main" : "divider",
                bgcolor: focusLetter === letter ? "action.selected" : "transparent",
              }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: "baseline", mb: 0.75 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {letterLabel(letter)}
                </Typography>
                {insight.coverage && (
                  <Typography variant="caption" color="text.secondary">
                    {COVERAGE_LABELS[insight.coverage[letter] ?? 0]}
                  </Typography>
                )}
              </Stack>
              <Stack spacing={1}>
                {items.map((item) => (
                  <Quote
                    key={`${item.offsetSeconds}-${item.quote}`}
                    item={item}
                    meetingId={coverage.meetingId}
                    onSeek={onSeek}
                  />
                ))}
              </Stack>
            </Box>
          ))}
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

/** One quote from this call, and the proposal it backs when it backs one. */
function Quote({
  item,
  meetingId,
  onSeek,
}: {
  item: CallEvidence;
  meetingId: number;
  onSeek: (seconds: number) => void;
}) {
  return (
    <Box>
      <EvidenceItem quote={item.original} currentMeetingId={meetingId} onSeek={onSeek} />
      {item.proposal && (
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexWrap: "wrap", mt: 0.5, pl: 1.5 }}>
          <AiMarker confidence={item.proposal.confidence} />
          <Typography variant="caption">
            Proposes <strong>{item.proposal.fieldLabel}</strong>: {formatFieldValue(item.proposal.value)}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: item.proposal.pending ? "warning.dark" : "text.secondary" }}
          >
            {item.proposal.pending ? "· awaiting review" : "· matches Salesforce"}
          </Typography>
        </Stack>
      )}
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
            — the {insight.stageAtCall ?? "deal's"} stage needs these.
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
          This call isn&apos;t linked to a deal, so there is nothing to review.
        </Typography>
      ) : !deal ? null : deal.canEdit ? (
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <Button
            size="small"
            variant={pending > 0 ? "contained" : "outlined"}
            onClick={onOpenDeal}
            sx={{ textTransform: "none" }}
          >
            Review in deal
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
