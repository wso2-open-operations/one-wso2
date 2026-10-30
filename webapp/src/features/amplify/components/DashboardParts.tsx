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

import type { ReactNode } from "react";
import { Box, Chip, Skeleton, Typography } from "@wso2/oxygen-ui";
import type { UseQueryResult } from "@tanstack/react-query";
import { HttpError } from "@api/http";
import ErrorNotice from "@components/error-notice/ErrorNotice";

/**
 * Loading, 403 and error states shared by every board. A 403 is an expected
 * refusal (the rail already hides these boards from plain employees), so it
 * is explained, not reported as a failure.
 */
export function BoardState<T>({
  queries,
  children,
}: {
  queries: UseQueryResult<T, Error>[];
  children: ReactNode;
}) {
  const forbidden = queries.find((q) => q.error instanceof HttpError && q.error.status === 403);
  if (forbidden) {
    return (
      <ErrorNotice severity="info">These boards are for people with an Amplify role (PO, Marketing, SLT or Admin).</ErrorNotice>
    );
  }
  const failed = queries.find((q) => q.isError);
  if (failed) {
    return (
      <ErrorNotice
        error={failed.error}
        onRetry={() => {
          for (const q of queries) void q.refetch();
        }}
      >
        Couldn&apos;t load this board.
      </ErrorNotice>
    );
  }
  if (queries.some((q) => q.isPending)) {
    return (
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" } }}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={92} />
        ))}
      </Box>
    );
  }
  return <>{children}</>;
}

/** A uppercase section label, like the other Amplify panels. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Typography
      component="h2"
      variant="overline"
      sx={{ fontWeight: 700, letterSpacing: "0.08em", color: "text.secondary", lineHeight: 1.5, display: "block" }}
    >
      {children}
    </Typography>
  );
}

/** One number with its label and a line of context. */
export function StatCard({
  label,
  value,
  detail,
  action,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  /** Controls for the tile, e.g. a Week / Month / Year switch, beside the heading. */
  action?: ReactNode;
}) {
  return (
    <Box
      component="section"
      aria-label={label}
      sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2, minWidth: 0 }}
    >
      {action ? (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
          <SectionLabel>{label}</SectionLabel>
          {action}
        </Box>
      ) : (
        <SectionLabel>{label}</SectionLabel>
      )}
      <Typography sx={{ fontSize: 32, fontWeight: 600, lineHeight: 1.15, mt: 1 }}>{value}</Typography>
      {detail && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
          {detail}
        </Typography>
      )}
    </Box>
  );
}

/** A bordered block for a table or chart. */
export function Block({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Box component="section" aria-label={title} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2, minWidth: 0 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
        <Box sx={{ flexGrow: 1 }}>
          <SectionLabel>{title}</SectionLabel>
        </Box>
        {action}
      </Box>
      {children}
    </Box>
  );
}

/** A horizontal bar, `fraction` of the track (0..1). */
export function Bar({ fraction, label, color = "primary.main" }: { fraction: number; label: string; color?: string }) {
  const w = Math.max(0, Math.min(1, fraction)) * 100;
  return (
    <Box
      role="img"
      aria-label={label}
      sx={{ height: 10, borderRadius: 5, bgcolor: "action.hover", overflow: "hidden", minWidth: 60, flex: "1 1 120px" }}
    >
      <Box sx={{ width: `${w}%`, height: "100%", bgcolor: color }} />
    </Box>
  );
}

/** A segmented bar for parts of a whole. Segments with no count are skipped. */
export function StackedBar({
  segments,
  label,
}: {
  segments: { label: string; value: number; color: string }[];
  label: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  return (
    <Box role="img" aria-label={label} sx={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", bgcolor: "action.hover" }}>
      {total > 0 &&
        segments
          .filter((s) => s.value > 0)
          .map((s) => <Box key={s.label} sx={{ width: `${(s.value / total) * 100}%`, bgcolor: s.color }} />)}
    </Box>
  );
}

/** A small pill for a state; outline only, so contrast follows the theme. */
export function StateChip({ label, tone = "default" }: { label: string; tone?: "default" | "primary" | "warning" | "error" | "info" }) {
  return <Chip size="small" variant="outlined" color={tone} label={label} />;
}

/** The Priority pill after a campaign title, with twice the old single-space gap. */
export function PriorityPill() {
  return (
    <Box component="span" sx={{ ml: 1, display: "inline-block" }}>
      <StateChip label="Priority" tone="primary" />
    </Box>
  );
}

/** A line of text for a block with nothing in it. */
export function Empty({ children }: { children: ReactNode }) {
  return (
    <Typography variant="body2" color="text.secondary">
      {children}
    </Typography>
  );
}

/** One exact size for every rank (the crown sits inside it), so the pills line up in a column. */
const MEDAL_W = 36;
const MEDAL_H = 24;

const MEDALS: Record<number, { bg: string; fg: string; name: string }> = {
  1: { bg: "#F5C542", fg: "#2B1D00", name: "1st place" },
  2: { bg: "#CBD5E1", fg: "#111827", name: "2nd place" },
  3: { bg: "#CD7F32", fg: "#140B00", name: "3rd place" },
};

/**
 * A rank as a medal: gold with a crown, silver, bronze, the number inside. Text colours are picked for
 * contrast on each metal (all above 7:1). Any other rank is the plain number.
 */
export function MedalRank({ rank }: { rank: number }) {
  const medal = MEDALS[rank];
  if (!medal) {
    return (
      <Box component="span" sx={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: MEDAL_W, height: MEDAL_H, color: "text.secondary", fontWeight: 600, fontSize: 13 }}>
        {rank}
      </Box>
    );
  }
  return (
    <Box
      component="span"
      role="img"
      aria-label={medal.name}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "3px",
        width: MEDAL_W,
        height: MEDAL_H,
        boxSizing: "border-box",
        borderRadius: 999,
        bgcolor: medal.bg,
        color: medal.fg,
        fontSize: 13,
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {rank === 1 && (
        <svg width="14" height="12" viewBox="0 0 14 12" aria-hidden="true" focusable="false">
          <path d="M1 10.5 L0.5 3 L4 6 L7 1 L10 6 L13.5 3 L13 10.5 Z" fill="currentColor" />
        </svg>
      )}
      <span aria-hidden="true">{rank}</span>
    </Box>
  );
}
