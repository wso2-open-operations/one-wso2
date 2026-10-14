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

import type { MouseEvent, ReactNode } from "react";
import { Box, Stack, Tooltip, Typography, useTheme } from "@wso2/oxygen-ui";
import { parseUtc } from "../../util/salesTime";
import type { Journey, SourceSummary, TimelineKind, TimelineMark } from "../types";
import { daysAgo, daysBetween, kindOf } from "../util/evidenceSource";
import { formatSalesforceDate } from "../util/meddpiccFormat";

/** Past this, a deal with no activity reads as quiet. */
const QUIET_AFTER_DAYS = 21;

const DAY = 86_400_000;

/**
 * How each kind of activity is drawn: colour, size and shape together, so no one of them
 * carries identity alone. The three hues are the first three categorical slots, which
 * validate against each other in both modes (all pairs, as marks on one track can sit
 * side by side); a Salesforce activity, the weakest evidence, is a neutral ring rather
 * than a fourth hue. Size follows weight: a customer call is the biggest thing on the track.
 */
const KINDS: Record<
  TimelineKind,
  { label: string; plural: string; size: number; shape: "circle" | "diamond" | "ring"; light?: string; dark?: string }
> = {
  CUSTOMER_CALL: { label: "Customer call", plural: "customer calls", size: 12, shape: "circle", light: "#2a78d6", dark: "#3987e5" },
  EMAIL: { label: "Email", plural: "emails", size: 10, shape: "diamond", light: "#1baf7a", dark: "#199e70" },
  INTERNAL_CALL: { label: "Internal discussion", plural: "internal discussions", size: 8, shape: "circle", light: "#eb6834", dark: "#d95926" },
  ACTIVITY: { label: "Salesforce activity", plural: "activities", size: 7, shape: "ring" },
};
const KIND_ORDER: TimelineKind[] = ["CUSTOMER_CALL", "INTERNAL_CALL", "EMAIL", "ACTIVITY"];

function useKindColor(): (kind: TimelineKind) => string {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  return (kind) => {
    const k = KINDS[kind];
    return (dark ? k.dark : k.light) ?? theme.palette.text.secondary;
  };
}

function Mark({ kind, upcoming, scale = 1 }: { kind: TimelineKind; upcoming: boolean; scale?: number }) {
  const color = useKindColor()(kind);
  const k = KINDS[kind];
  const size = Math.round(k.size * scale);
  const hollow = upcoming || k.shape === "ring";
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
        borderColor: color,
        bgcolor: hollow ? "background.paper" : color,
        borderRadius: k.shape === "diamond" ? 0.25 : "50%",
        transform: k.shape === "diamond" ? "rotate(45deg) scale(0.85)" : undefined,
        // A ring of the surface, so marks on the same day stay separate.
        boxShadow: (theme) => `0 0 0 2px ${theme.palette.background.paper}`,
      }}
    />
  );
}

/** A stage's shade: darker the further along the deal is, in the gates' stage order. */
function stageShade(stage: string, order: readonly string[], seen: readonly string[]): number {
  const at = order.indexOf(stage);
  const index = at >= 0 ? at : seen.indexOf(stage);
  return Math.min(0.55, 0.12 + 0.07 * Math.max(0, index));
}

/** The key to the marks and bands, once, above the column. */
export function DealJourneyLegend() {
  const swatch = (node: ReactNode, label: string) => (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }} key={label}>
      <Box sx={{ width: 12, display: "flex", justifyContent: "center" }}>{node}</Box>
      <span>{label}</span>
    </Stack>
  );
  return (
    <Stack
      direction="row"
      sx={{ alignItems: "center", flexWrap: "wrap", columnGap: 1.25, rowGap: 0.25, typography: "caption", color: "text.secondary", fontWeight: 400 }}
    >
      {KIND_ORDER.map((kind) => swatch(<Mark kind={kind} upcoming={false} />, KINDS[kind].label))}
      {swatch(<Mark kind="CUSTOMER_CALL" upcoming scale={0.8} />, "Upcoming")}
      {swatch(<Box sx={{ width: 12, height: 6, borderRadius: 0.5, bgcolor: "action.selected" }} />, "Stage")}
      {swatch(<Box sx={{ width: "2px", height: 12, bgcolor: "text.secondary" }} />, "Close date")}
    </Stack>
  );
}

interface Segment {
  stage: string | null;
  from: number;
  to: number;
  ahead: boolean;
}

/**
 * The stage bands: from each observation to the next, the deal in the earlier stage;
 * before the first, not recorded. Whatever lies after today is the current stage still
 * to run, drawn lighter.
 */
function segmentsOf(journey: Journey, start: number, end: number, now: number): Segment[] {
  const points = journey.stages
    .map((p) => ({ stage: p.stage, at: parseUtc(p.at)?.getTime() }))
    .filter((p): p is { stage: string; at: number } => p.at !== undefined)
    .sort((a, b) => a.at - b.at);
  const raw: Omit<Segment, "ahead">[] = [];
  if (points.length === 0) return [];
  if (points[0].at > start) raw.push({ stage: null, from: start, to: points[0].at });
  points.forEach((p, i) => raw.push({ stage: p.stage, from: Math.max(p.at, start), to: points[i + 1]?.at ?? end }));
  // Split at today: what is past happened; what is ahead is still to run.
  return raw.flatMap((s) =>
    s.from < now && s.to > now
      ? [{ ...s, to: now, ahead: false }, { ...s, from: now, ahead: true }]
      : [{ ...s, ahead: s.from >= now }],
  ).filter((s) => s.to > s.from);
}

/**
 * One deal's journey, for a row of the Deals list: from when the deal was created to its
 * expected close, with the stages it moved through as bands and every customer call,
 * internal discussion, email and Salesforce activity as marks on the way. Today and the
 * close date are marked.
 *
 * Each row spans its own deal, so it reads as that deal's story rather than a shared
 * calendar. Stage bands come from what Echo saw (the stage at each call, and today's);
 * before the first call the stage is drawn as not recorded rather than guessed.
 */
export default function DealJourney({
  marks,
  journey,
  sources,
  closeDate,
  stageOrder = [],
  now,
  onOpenCall,
}: {
  marks: readonly TimelineMark[];
  journey: Journey;
  sources: SourceSummary;
  /** Salesforce's close date, YYYY-MM-DD. */
  closeDate: string | null;
  /** The stages in the gates' order, for shading. */
  stageOrder?: readonly string[];
  /** The current time in ms; the table passes one clock to every row. */
  now: number;
  onOpenCall?: (meetingId: number) => void;
}) {
  const color = useKindColor();
  const timed = marks
    .map((mark) => ({ mark, ms: parseUtc(mark.at)?.getTime() }))
    .filter((m): m is { mark: TimelineMark; ms: number } => m.ms !== undefined);
  const stageTimes = journey.stages.map((p) => parseUtc(p.at)?.getTime()).filter((t): t is number => t !== undefined);
  const startedMs = journey.startedAt ? parseUtc(journey.startedAt)?.getTime() : undefined;
  const closeMs = closeDate ? parseUtc(`${closeDate.slice(0, 10)} 23:59:59`)?.getTime() : undefined;

  const start = Math.min(startedMs ?? Infinity, ...timed.map((m) => m.ms), ...stageTimes, now);
  const rawEnd = Math.max(closeMs ?? -Infinity, now, ...timed.map((m) => m.ms));
  const end = rawEnd - start < 7 * DAY ? start + 7 * DAY : rawEnd;
  const pct = (ms: number) => Math.min(100, Math.max(0, ((ms - start) / (end - start)) * 100));

  const seen = [...new Set(journey.stages.map((p) => p.stage))];
  const segments = segmentsOf(journey, start, end, now);

  const counts = KIND_ORDER.map((kind) => [kind, timed.filter((m) => kindOf(m.mark) === kind).length] as const).filter(
    ([, n]) => n > 0,
  );
  const lastMs = sources.lastActivityAt ? parseUtc(sources.lastActivityAt)?.getTime() : undefined;
  const quietDays = lastMs !== undefined ? daysBetween(lastMs, now) : null;
  const quiet = quietDays !== null && quietDays > QUIET_AFTER_DAYS;
  const dayN = daysBetween(start, now) + 1;
  // Whole days left until the end of the close date; negative once it has passed.
  const toClose = closeMs !== undefined ? Math.floor((closeMs - now) / DAY) : null;

  return (
    <Box sx={{ minWidth: 0 }}>
      <Box
        role="list"
        aria-label="Deal journey, from its start to its close"
        sx={{ position: "relative", height: 32, minWidth: 160 }}
      >
        {/* The axis, a recessive hairline. */}
        <Box aria-hidden sx={{ position: "absolute", left: 0, right: 0, top: 11, height: "1px", bgcolor: "divider" }} />

        {/* Stage bands along the bottom, each with its own tooltip. */}
        {segments.map((s, i) => {
          const label =
            s.stage === null
              ? "Stage not recorded before the first call"
              : s.ahead
                ? `${s.stage} · now, until the close`
                : `${s.stage} · ${formatDay(s.from)} to ${s.to >= now - DAY ? "today" : formatDay(s.to)}`;
          return (
            <Tooltip key={`seg-${i}`} title={label} arrow disableInteractive>
              <Box
                aria-label={label}
                sx={{
                  position: "absolute",
                  top: 24,
                  height: 6,
                  left: `${pct(s.from)}%`,
                  width: `${pct(s.to) - pct(s.from)}%`,
                  borderRadius: 0.5,
                  // 2px of surface between neighbouring bands.
                  borderRight: (theme) => `2px solid ${theme.palette.background.paper}`,
                  background: (theme) =>
                    s.stage === null
                      ? `repeating-linear-gradient(45deg, ${theme.palette.action.hover} 0 3px, transparent 3px 6px)`
                      : theme.palette.text.primary,
                  opacity: s.stage === null ? 1 : stageShade(s.stage, stageOrder, seen) * (s.ahead ? 0.45 : 1),
                }}
              />
            </Tooltip>
          );
        })}

        {/* Today, across the track. */}
        <Box
          aria-hidden
          title="Today"
          sx={{ position: "absolute", top: 0, bottom: 0, left: `${pct(now)}%`, width: "1px", bgcolor: "text.disabled" }}
        />
        {/* The expected close. */}
        {closeMs !== undefined && (
          <Tooltip title={`Close date · ${formatSalesforceDate(closeDate)}`} arrow disableInteractive>
            <Box
              aria-label={`Close date ${formatSalesforceDate(closeDate)}`}
              sx={{
                position: "absolute",
                top: 2,
                bottom: 2,
                left: `calc(${pct(closeMs)}% - 1px)`,
                width: "2px",
                bgcolor: "text.secondary",
              }}
            />
          </Tooltip>
        )}

        {/* The marks, biggest last so a customer call sits on top. */}
        {[...timed]
          .sort((a, b) => KINDS[kindOf(a.mark)].size - KINDS[kindOf(b.mark)].size)
          .map(({ mark, ms }, i) => {
            const kind = kindOf(mark);
            const upcoming = ms > now;
            const label = `${KINDS[kind].label}${upcoming ? " (upcoming)" : ""} · ${mark.title} · ${formatDay(ms)}`;
            const callId = mark.type === "CALL" ? mark.meetingId : null;
            const open = callId !== null && onOpenCall ? () => onOpenCall(callId) : undefined;
            return (
              <Box
                key={`${mark.type}-${mark.at}-${i}`}
                role="listitem"
                sx={{ position: "absolute", top: 0, left: `${pct(ms)}%`, transform: "translateX(-50%)" }}
              >
                <Tooltip title={label} arrow disableInteractive>
                  {/* The hit target is wider than the mark, so a 7px mark is easy to hover. */}
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
                      width: 20,
                      height: 22,
                      p: 0,
                      border: 0,
                      background: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: open ? "pointer" : "default",
                      "&:focus-visible": { outline: "2px solid", outlineColor: color(kind), borderRadius: 0.5 },
                    }}
                  >
                    <Mark kind={kind} upcoming={upcoming} />
                  </Box>
                </Tooltip>
              </Box>
            );
          })}
      </Box>

      {/* The path in words, and where the deal stands now. Text in text colours only. */}
      <Typography
        variant="caption"
        color="text.secondary"
        component="div"
        sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        title={seen.join(" › ")}
      >
        {seen.length ? seen.join(" › ") : "No stage recorded"}
        {startedMs !== undefined && ` · started ${formatDay(startedMs)}`}
        {` · day ${dayN}`}
        {toClose !== null && ` · ${closeIn(toClose)}`}
      </Typography>
      <Typography variant="caption" color="text.secondary" component="div">
        {counts.length ? counts.map(([kind, n]) => `${n} ${n === 1 ? KINDS[kind].label.toLowerCase() : KINDS[kind].plural}`).join(" · ") : "No activity yet"}
        {quietDays !== null && (
          <Box component="span" sx={quiet ? { color: "warning.dark", fontWeight: 600 } : undefined}>
            {" · "}
            {quiet ? `quiet for ${quietDays} days` : `last ${daysAgo(quietDays)}`}
          </Box>
        )}
      </Typography>
    </Box>
  );
}

function closeIn(days: number): string {
  if (days === 0) return "closes today";
  const n = Math.abs(days);
  const unit = n === 1 ? "day" : "days";
  return days > 0 ? `${n} ${unit} to close` : `${n} ${unit} past close`;
}

function formatDay(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
