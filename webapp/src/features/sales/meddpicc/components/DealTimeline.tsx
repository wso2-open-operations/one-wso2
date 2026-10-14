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
import { Box, Stack, Tooltip, Typography } from "@wso2/oxygen-ui";
import { parseUtc, formatDateTime } from "../../util/salesTime";
import type { EvidenceSourceType, SourceSummary, TimelineMark } from "../types";
import { daysAgo, daysBetween, describeSources } from "../util/evidenceSource";

/** How far back the track reaches, and how far ahead for booked calls. Shared by every row. */
export const TIMELINE_PAST_DAYS = 90;
export const TIMELINE_AHEAD_DAYS = 14;
/** Past this, a deal with no activity reads as quiet. */
export const QUIET_AFTER_DAYS = 21;

const DAY = 86_400_000;
const SOURCE_NAME: Record<EvidenceSourceType, string> = { CALL: "Call", EMAIL: "Email", ACTIVITY: "Salesforce activity" };

/**
 * The shape for a source. Identity is carried by shape, not colour: every mark wears the
 * one primary hue, so the timeline reads the same to a colour-blind reader and in print.
 * A mark still to come is drawn hollow.
 */
function Shape({ type, upcoming, size = 9 }: { type: EvidenceSourceType; upcoming: boolean; size?: number }) {
  const filled = !upcoming && type !== "ACTIVITY";
  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        display: "block",
        width: size,
        height: size,
        boxSizing: "border-box",
        border: 2,
        borderColor: "primary.main",
        bgcolor: filled ? "primary.main" : "background.paper",
        borderRadius: type === "EMAIL" ? 0.25 : "50%",
        transform: type === "EMAIL" ? "rotate(45deg) scale(0.85)" : undefined,
        // A ring of the surface, so marks on the same day stay separate.
        boxShadow: (theme) => `0 0 0 2px ${theme.palette.background.paper}`,
      }}
    />
  );
}

/** The key to the shapes, once, above the column. */
export function DealTimelineLegend() {
  const item = (type: EvidenceSourceType, label: string, upcoming = false) => (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }} key={label}>
      <Shape type={type} upcoming={upcoming} size={8} />
      <span>{label}</span>
    </Stack>
  );
  return (
    <Stack
      direction="row"
      spacing={1.25}
      sx={{ alignItems: "center", flexWrap: "wrap", typography: "caption", color: "text.secondary", fontWeight: 400 }}
    >
      {item("CALL", "Call")}
      {item("EMAIL", "Email")}
      {item("ACTIVITY", "Activity")}
      {item("CALL", "Upcoming", true)}
    </Stack>
  );
}

/**
 * A deal's activity on one shared track, for a row of the Deals list: the last
 * TIMELINE_PAST_DAYS to TIMELINE_AHEAD_DAYS ahead, with today marked. Every row uses the
 * same window, so a column of tracks shows at a glance which deals are busy and which
 * have gone quiet. Older entries are counted at the left edge rather than squeezed in.
 *
 * Each mark has a tooltip naming it; a call opens its analysis. Under the track, what the
 * deal's evidence is drawn from and when it last moved.
 */
export default function DealTimeline({
  marks,
  sources,
  now,
  onOpenCall,
}: {
  marks: readonly TimelineMark[];
  sources: SourceSummary;
  /** The current time in ms; the table passes one clock to every row. */
  now: number;
  onOpenCall?: (meetingId: number) => void;
}) {
  const from = now - TIMELINE_PAST_DAYS * DAY;
  const to = now + TIMELINE_AHEAD_DAYS * DAY;
  const span = to - from;
  const pct = (ms: number) => ((ms - from) / span) * 100;

  const timed = marks
    .map((mark) => ({ mark, ms: parseUtc(mark.at)?.getTime() }))
    .filter((m): m is { mark: TimelineMark; ms: number } => m.ms !== undefined);
  const earlier = timed.filter((m) => m.ms < from).length;
  const shown = timed.filter((m) => m.ms >= from && m.ms <= to);

  const lastMs = sources.lastActivityAt ? parseUtc(sources.lastActivityAt)?.getTime() : undefined;
  const quietDays = lastMs !== undefined ? daysBetween(lastMs, now) : null;
  const quiet = quietDays !== null && quietDays > QUIET_AFTER_DAYS;

  return (
    <Box sx={{ minWidth: 0 }}>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
        {/* Width kept even when empty, so every row's track starts at the same place. */}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ width: 24, flexShrink: 0, textAlign: "right", fontVariantNumeric: "tabular-nums" }}
          title={earlier ? `${earlier} earlier than ${TIMELINE_PAST_DAYS} days ago` : undefined}
        >
          {earlier ? `+${earlier}` : ""}
        </Typography>
        <Box
          role="list"
          aria-label={`Activity over the last ${TIMELINE_PAST_DAYS} days`}
          sx={{ position: "relative", flex: 1, height: 22, minWidth: 120 }}
        >
          {/* The axis: a recessive hairline, and today. */}
          <Box aria-hidden sx={{ position: "absolute", left: 0, right: 0, top: "50%", height: "1px", bgcolor: "divider" }} />
          <Box
            aria-hidden
            title="Today"
            sx={{ position: "absolute", top: 3, bottom: 3, left: `${pct(now)}%`, width: "1px", bgcolor: "text.disabled" }}
          />
          {shown.map(({ mark, ms }, i) => {
            const upcoming = ms > now;
            const label = `${SOURCE_NAME[mark.type]}${upcoming ? " (upcoming)" : ""} · ${mark.title} · ${formatDateTime(mark.at)}`;
            const callId = mark.type === "CALL" ? mark.meetingId : null;
            const open = callId !== null && onOpenCall ? () => onOpenCall(callId) : undefined;
            return (
              // The list item places the mark on the track; the hit target inside it is
              // wider than the mark, so a 9px mark is easy to hover and click.
              <Box
                key={`${mark.type}-${mark.at}-${i}`}
                role="listitem"
                sx={{ position: "absolute", top: 0, left: `${pct(ms)}%`, transform: "translateX(-50%)" }}
              >
                <Tooltip title={label} arrow disableInteractive>
                  <Box
                    component={open ? "button" : "span"}
                    type={open ? "button" : undefined}
                    tabIndex={open ? undefined : 0}
                    aria-label={open ? `Open ${label}` : label}
                    onClick={
                      open
                        ? (event: MouseEvent) => {
                            event.stopPropagation();
                            open();
                          }
                        : undefined
                    }
                    sx={{
                      width: 18,
                      height: 22,
                      p: 0,
                      border: 0,
                      background: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: open ? "pointer" : "default",
                      "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", borderRadius: 0.5 },
                    }}
                  >
                    <Shape type={mark.type} upcoming={upcoming} />
                  </Box>
                </Tooltip>
              </Box>
            );
          })}
        </Box>
      </Stack>
      <Typography variant="caption" color="text.secondary" component="div" sx={{ pl: 3.75 }}>
        {describeSources(sources) || "No activity yet"}
        {quietDays !== null && (
          <Box
            component="span"
            sx={quiet ? { color: "warning.dark", fontWeight: 600 } : undefined}
          >
            {" · "}
            {quiet ? `quiet for ${quietDays} days` : `last ${daysAgo(quietDays)}`}
          </Box>
        )}
      </Typography>
    </Box>
  );
}
