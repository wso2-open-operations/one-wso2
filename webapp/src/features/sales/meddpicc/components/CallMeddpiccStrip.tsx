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

import type { ReactNode } from "react";
import { Box, Button, CircularProgress, Paper, Skeleton, Stack, Typography } from "@wso2/oxygen-ui";
import { ArrowRightIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import type { CallMeddpicc } from "../api/useCallMeddpicc";
import type { LetterKey } from "../types";
import { lettersInWords } from "../util/callInsight";
import MeddpiccCircles from "./MeddpiccCircles";
import StageChip from "./StageChip";

/**
 * The call's MEDDPICC at a glance, above the recording and its tabs.
 *
 * The answer to "what did this call do for the deal?" in one line, readable without
 * opening anything: the stage the deal was in, the call's circles, which Letters it
 * answered for the first time, which the stage needed and it missed, and how many of its
 * proposals still wait for the account manager. Leadership can stop here; the account
 * manager reads on in the MEDDPICC tab.
 *
 * A circle opens that tab at its Letter. Open deal opens the deal panel, the one place
 * proposals are approved.
 */
export default function CallMeddpiccStrip({
  call,
  meetingTitle,
  onLetterClick,
  onOpenDeal,
}: {
  call: CallMeddpicc;
  meetingTitle: string;
  onLetterClick: (letter: LetterKey) => void;
  onOpenDeal: () => void;
}) {
  if (!call.configured) return null;

  const frame = (children: ReactNode) => (
    <Paper
      variant="outlined"
      sx={{ px: 2, py: 1.25, mb: 2, display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 2, rowGap: 1 }}
      aria-label="MEDDPICC for this call"
      component="section"
    >
      {children}
    </Paper>
  );

  if (call.coverageLoading) return frame(<Skeleton variant="text" width={320} />);
  if (call.coverageError) {
    return frame(
      <ErrorNotice onRetry={call.retryCoverage} error={call.coverageError}>
        Couldn&apos;t load MEDDPICC for this call.
      </ErrorNotice>,
    );
  }

  const { coverage, insight } = call;
  if (!coverage || coverage.status === "NONE") {
    return frame(
      <Typography variant="body2" color="text.secondary">
        No MEDDPICC yet: this call has no transcript to analyse.
      </Typography>,
    );
  }
  if (coverage.status === "PENDING" || coverage.status === "RUNNING") {
    return frame(
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }} role="status">
        <CircularProgress size={14} />
        <Typography variant="body2" color="text.secondary">
          Analysing this call for MEDDPICC…
        </Typography>
      </Stack>,
    );
  }
  if (coverage.status === "FAILED") {
    return frame(
      <Typography variant="body2" color="error.main">
        MEDDPICC analysis failed for this call.
      </Typography>,
    );
  }

  const facts: ReactNode[] = [];
  if (insight.firstAnswered) {
    facts.push(
      insight.firstAnswered.length > 0 ? (
        <Typography key="new" variant="body2" sx={{ color: "success.dark" }}>
          <Box component="span" sx={{ fontWeight: 600 }}>
            New for this deal:
          </Box>{" "}
          {lettersInWords(insight.firstAnswered)}
        </Typography>
      ) : (
        <Typography key="new" variant="body2" color="text.secondary">
          Nothing new for this deal
        </Typography>
      ),
    );
  }
  if (insight.missed.length > 0) {
    facts.push(
      <Typography
        key="missed"
        variant="body2"
        sx={{ color: "warning.dark" }}
        title={`The ${insight.stageAtCall ?? "deal's"} stage needs these, and this call didn't cover them.`}
      >
        <Box component="span" sx={{ fontWeight: 600 }}>
          Missed:
        </Box>{" "}
        {lettersInWords(insight.missed)}
      </Typography>,
    );
  }
  if (call.deal && insight.pendingFromCall > 0) {
    facts.push(
      <Typography key="pending" variant="body2" sx={{ color: "warning.dark", fontWeight: 600 }}>
        {insight.pendingFromCall} awaiting review
      </Typography>,
    );
  }

  return frame(
    <>
      {insight.stageAtCall && (
        <StageChip stage={insight.stageAtCall} title={`${insight.stageAtCall}: the deal's stage at the time of the call`} />
      )}
      <MeddpiccCircles
        variant="coverage"
        size="medium"
        values={insight.coverage}
        quotes={coverage.quotes}
        onLetterClick={onLetterClick}
        label={`MEDDPICC coverage for ${meetingTitle}`}
      />
      {facts.length > 0 && (
        <Stack direction="row" sx={{ alignItems: "center", flexWrap: "wrap", columnGap: 2, rowGap: 0.5 }}>
          {facts}
        </Stack>
      )}
      {call.opportunityId && (
        <Button
          size="small"
          variant="outlined"
          endIcon={<ArrowRightIcon size={14} />}
          onClick={onOpenDeal}
          sx={{ ml: "auto", textTransform: "none" }}
        >
          Open deal
        </Button>
      )}
    </>,
  );
}
