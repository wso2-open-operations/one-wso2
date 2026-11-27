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

import type { MouseEvent } from "react";
import { Box, Tooltip, Typography } from "@wso2/oxygen-ui";
import { Check, Languages, X } from "@wso2/oxygen-ui-icons-react";
import { tint, useToneColors } from "./eventsStyles";
import type { FieldIssues } from "../lib/issueGroups";
import { TITLE_FIELD } from "../rules/titles";

// Every field in this tab that has a problem, with accept/reject for the whole column.
//
// This lives ABOVE the grid rather than in its column headers, for two reasons worth
// keeping:
//
// **It stays correct.** A column `title` is a React element built inside a memo, and
// React skips re-rendering an element it has already seen by reference. Counts froze
// there, and the frozen element held a stale accept handler that replayed an old
// snapshot — accepting one column silently reverted edits made to another. Here it's
// ordinary React that re-renders whenever the data does.
//
// **It stays visible.** A tab can be twenty columns wide, and Content Syndication puts
// `content_offer` last, well past the right edge. A problem you have to scroll to find
// is a problem you don't know you have.

export default function IssueBar({
  groups,
  editable,
  activeField,
  onAccept,
  onReject,
  onJump,
  onReviewTitles,
}: {
  groups: FieldIssues[];
  editable: boolean;
  /** The column currently highlighted in the grid, shown pressed here. */
  activeField?: string;
  onAccept: (cells: { row_id: string; field: string }[]) => void;
  onReject: (cells: { row_id: string; field: string }[]) => void;
  onJump?: (field: string) => void;
  /** Opens the job-title dialog in place of Job Title's accept-all and reject-all. */
  onReviewTitles?: () => void;
}) {
  const tones = useToneColors();

  if (!groups.length) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <Box sx={{ color: "success.main", display: "inline-flex" }}>
          <Check size={14} />
        </Box>
        <Typography sx={{ fontSize: 11.5, color: "success.main", fontWeight: 700 }}>
          Nothing left to fix on this tab
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap", minWidth: 0 }}>
      <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "text.secondary", flexShrink: 0 }}>
        Needs attention
      </Typography>

      {groups.map((g) => {
        // Job-title translations are the one suggestion we don't take in bulk — a column
        // of them accepted unread — so they open a dialog that goes through each distinct
        // title (TitleDialog). Any other suggestion on the column (a pick-list spelling,
        // say) keeps accept-all and reject-all.
        const titles = g.field === TITLE_FIELD && !!onReviewTitles && g.translations.length > 0;
        const inBulk = titles
          ? g.suggested.filter((c) => !g.translations.some((t) => t.row_id === c.row_id))
          : g.suggested;
        const canFix = inBulk.length > 0;
        const n = inBulk.length;
        const acceptLabel = `Accept all ${n} on ${g.label}`;
        const rejectLabel = `Reject all ${n} on ${g.label}`;
        // Red only when a person is genuinely required. A field with suggestions waiting
        // is informational, not an alarm.
        const colour = g.blocked ? tones.blocking : tones.suggested;
        const on = activeField === g.field;
        return (
          // One FILLED unit per field. The fill is what separates them — a run of
          // "Country 5 ✓ ✕ · State 1" as loose text gave the eye nothing to group by, and
          // the accept/reject marks read as if they belonged to the next field.
          <Box
            key={g.field}
            sx={{
              display: "flex",
              alignItems: "stretch",
              height: 22,
              borderRadius: 0.75,
              overflow: "hidden",
              bgcolor: tint(colour, on ? 0.17 : 0.09),
              transition: "background-color .12s",
            }}
          >
            <Tooltip arrow title={on ? `Stop highlighting ${g.label}` : `Show the ${g.label} column`}>
              <Box
                component="button"
                type="button"
                aria-pressed={on}
                onClick={() => onJump?.(g.field)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  px: 0.9,
                  border: 0,
                  bgcolor: "transparent",
                  fontFamily: "inherit",
                  cursor: onJump ? "pointer" : "default",
                  "&:hover": onJump ? { bgcolor: tint(colour, 0.12) } : undefined,
                }}
              >
                <Typography
                  component="span"
                  sx={{
                    fontSize: 11,
                    fontWeight: on ? 700 : 600,
                    color: colour,
                    textDecoration: on ? "underline" : "none",
                    textUnderlineOffset: 2,
                  }}
                >
                  {g.label}
                </Typography>
                <Typography
                  component="span"
                  sx={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: colour,
                    fontVariantNumeric: "tabular-nums",
                    opacity: 0.85,
                  }}
                >
                  {g.suggested.length + g.blocked}
                </Typography>
              </Box>
            </Tooltip>

            {/* Per-field accept-all: taking five country fixes in one click is the single
                most-used action on this screen. Divided from the label so it's obvious
                these act on THIS field and aren't two more things to read. */}
            {editable && titles && (
              <>
                <Box sx={{ width: "1px", bgcolor: tint(colour, 0.25), flexShrink: 0 }} />
                <Tooltip title="Go through each title: use the English, or write your own" arrow>
                  <Box
                    component="button"
                    type="button"
                    // Opened on click, so Enter and Space open it too; mouse-down only keeps
                    // the grid's focus where it was.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onReviewTitles?.()}
                    sx={{ ...action, width: "auto", px: 0.9, gap: 0.5, color: tones.accepted, fontFamily: "inherit" }}
                  >
                    <Languages size={12} />
                    <Typography component="span" sx={{ fontSize: 11, fontWeight: 700, color: "inherit" }}>
                      Review
                    </Typography>
                  </Box>
                </Tooltip>
              </>
            )}
            {editable && canFix && (
              <>
                <Box sx={{ width: "1px", bgcolor: tint(colour, 0.25), flexShrink: 0 }} />
                <Tooltip title={acceptLabel} arrow>
                  <Box
                    component="button"
                    type="button"
                    aria-label={acceptLabel}
                    onMouseDown={fire(() => onAccept(inBulk))}
                    sx={{ ...action, color: tones.accepted }}
                  >
                    <Check size={12} />
                  </Box>
                </Tooltip>
                <Box sx={{ width: "1px", bgcolor: tint(colour, 0.25), flexShrink: 0 }} />
                <Tooltip title={rejectLabel} arrow>
                  <Box
                    component="button"
                    type="button"
                    aria-label={rejectLabel}
                    onMouseDown={fire(() => onReject(inBulk))}
                    sx={{ ...action, color: "text.secondary" }}
                  >
                    <X size={12} />
                  </Box>
                </Tooltip>
              </>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

// Act on MOUSEDOWN, before anything can re-render the element out from under the pointer
// — the same reason the in-cell buttons do it. A click handler here loses races against
// the grid's own re-render.
function fire(act: () => void) {
  return (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    act();
  };
}

/** A segment of the field unit, full height so the dividers read as one control. */
const action = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 22,
  border: 0,
  bgcolor: "transparent",
  cursor: "pointer",
  userSelect: "none" as const,
  "&:hover": { bgcolor: "action.hover" },
};
