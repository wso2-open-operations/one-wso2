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

import { Box, CircularProgress, IconButton, Skeleton, Stack, Tooltip, Typography } from "@wso2/oxygen-ui";
import { RefreshCwIcon } from "@wso2/oxygen-ui-icons-react";
import type { LetterKey, MeetingCoverage } from "../types";
import { letterLabel } from "../util/meddpiccFormat";
import MeddpiccCircles from "./MeddpiccCircles";
import StageChip from "./StageChip";

/** Wide enough for the longest open stage, "Technical Proof", at the chip's size. */
const STAGE_WIDTH = 116;

/**
 * The meetings table's MEDDPICC cell, on one line: the stage the deal was in at
 * the time, the call's Coverage circles, and which of the current Gate's Letters
 * the call missed. It wraps rather than clips when the column is narrow.
 *
 * The stage chip has a fixed width so the circles start at the same place on
 * every row, whatever the stage is called; a call with no stage keeps the space.
 *
 * Re-analyse is offered only when the caller may (the backend decides for
 * real) and only when no run is in flight — a second click would queue a
 * second run of the same transcript.
 */
export default function MeetingCoverageCell({
  meetingTitle,
  coverage,
  loading,
  canReanalyse,
  reanalysing,
  onReanalyse,
  onLetterClick,
}: {
  meetingTitle: string;
  coverage: MeetingCoverage | undefined;
  loading: boolean;
  canReanalyse: boolean;
  reanalysing: boolean;
  onReanalyse: () => void;
  /** Present when the call belongs to a deal; opens its panel on that Letter. */
  onLetterClick?: (letter: LetterKey) => void;
}) {
  if (!coverage) {
    return loading ? (
      <Skeleton variant="text" width={180} />
    ) : (
      <Typography variant="body2" color="text.disabled">
        —
      </Typography>
    );
  }

  if (coverage.status === "NONE") {
    return (
      <Typography variant="caption" color="text.secondary">
        No transcript yet
      </Typography>
    );
  }

  const inFlight = coverage.status === "PENDING" || coverage.status === "RUNNING" || reanalysing;
  const reanalyse = canReanalyse && !inFlight && (
    <Tooltip title="Analyse this call again" arrow>
      <IconButton
        size="small"
        onClick={(event) => {
          event.stopPropagation();
          onReanalyse();
        }}
        aria-label={`Re-analyse ${meetingTitle}`}
      >
        <RefreshCwIcon size={14} />
      </IconButton>
    </Tooltip>
  );

  if (coverage.status === "FAILED") {
    return (
      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
        <Typography variant="caption" color="error.main">
          Analysis failed
        </Typography>
        {reanalyse}
      </Stack>
    );
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 1.25, rowGap: 0.5 }}>
      <Box sx={{ width: STAGE_WIDTH, flexShrink: 0, display: "flex" }}>
        {coverage.stageAtCall && (
          <StageChip
            stage={coverage.stageAtCall}
            title={`${coverage.stageAtCall}: the deal's stage at the time of the call`}
            sx={{ width: "100%" }}
          />
        )}
      </Box>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
        <MeddpiccCircles
          variant="coverage"
          values={inFlight && !coverage.coverage ? null : coverage.coverage}
          quotes={coverage.quotes}
          onLetterClick={onLetterClick}
          label={`MEDDPICC coverage for ${meetingTitle}`}
        />
        {inFlight ? (
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }} role="status">
            <CircularProgress size={12} />
            <Typography variant="caption" color="text.secondary">
              Analysing…
            </Typography>
          </Stack>
        ) : (
          reanalyse
        )}
      </Stack>
      {coverage.missed.length > 0 && (
        <Tooltip
          title={`This call didn't cover ${coverage.missed.map(letterLabel).join(", ")}, which the deal's current Gate needs.`}
          arrow
        >
          <Typography variant="caption" sx={{ color: "warning.dark", cursor: "help", whiteSpace: "nowrap" }}>
            Missed: {coverage.missed.map(letterLabel).join(", ")}
          </Typography>
        </Tooltip>
      )}
    </Box>
  );
}
