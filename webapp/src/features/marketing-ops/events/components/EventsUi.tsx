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
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { ArrowLeft } from "@wso2/oxygen-ui-icons-react";
import { STATUS_LABEL, type Status } from "../eventsTypes";
import { useCampaignCheck } from "../../api/useEvents";
import { campaignUrlHint } from "../lib/campaignUrl";
import { sdrOwnerHint } from "../lib/sdrOwner";
import { campaignIdFrom } from "../rules/validate";
import { fieldHint, fieldInput, primaryBtn, quietBtn, STATUS_STYLE } from "./eventsStyles";

// Shared presentational pieces for the Events screens.
//
// Ported from Marketing Ops' events/components/ui.tsx, with its raw hex tokens swapped
// for One WSO2 theme tokens so everything works in dark mode. The DESIGN REASONING is
// preserved verbatim, because it is the most carefully argued part of that codebase and
// re-deriving it would be a waste.

// Ask before doing something the user cannot simply take back.
//
// One component rather than several hand-rolled dialogs, because what makes a
// confirmation useful is naming the SPECIFIC consequence — "27 fixes will be discarded",
// not "are you sure?" — and a shared shell is what makes it cheap to say something
// different every time.
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  tone: variant = "primary",
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onClose={() => !busy && onCancel()} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: 16, fontWeight: 800 }}>{title}</DialogTitle>
      <DialogContent>
        <Typography component="div" sx={{ fontSize: 13, color: "text.secondary", lineHeight: 1.55 }}>
          {body}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} disabled={busy} sx={quietBtn}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          disabled={busy}
          variant="contained"
          color={variant === "danger" ? "error" : "primary"}
          autoFocus
          startIcon={busy ? <CircularProgress size={14} color="inherit" /> : undefined}
          sx={primaryBtn}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ---- the campaign URL -----------------------------------------------------------

/** The Salesforce campaign URL input, with the campaign ID read back (or the problem
 *  named) on every keystroke. One component, so the three places it is entered agree. */
export function CampaignUrlField({
  value,
  onChange,
  disabled,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const campaignId = campaignIdFrom(value);
  const check = useCampaignCheck(campaignId);
  const hint = campaignUrlHint(value, { checking: check.isFetching, check: check.data });
  return (
    <>
      <TextField
        size="small"
        fullWidth
        sx={fieldInput}
        placeholder="https://wso2.lightning.force.com/lightning/r/Campaign/…"
        disabled={disabled}
        autoFocus={autoFocus}
        value={value}
        error={hint.tone === "error"}
        onChange={(e) => onChange(e.target.value)}
        inputProps={{ "aria-label": "Salesforce campaign URL" }}
      />
      <Typography
        sx={{
          ...fieldHint,
          ...(hint.tone === "error" ? { color: "error.main" } : hint.tone === "ok" ? { color: "success.main" } : {}),
        }}
      >
        {hint.text}
      </Typography>
    </>
  );
}

/** The SDR owner's email, with the rule shown as it is typed. */
export function SdrOwnerField({
  value,
  onChange,
  disabled,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const hint = sdrOwnerHint(value);
  return (
    <>
      <TextField
        size="small"
        fullWidth
        sx={fieldInput}
        type="email"
        placeholder="name@wso2.com"
        disabled={disabled}
        autoFocus={autoFocus}
        value={value}
        error={hint.tone === "error"}
        onChange={(e) => onChange(e.target.value)}
        inputProps={{ "aria-label": "SDR owner email" }}
      />
      <Typography
        sx={{
          ...fieldHint,
          ...(hint.tone === "error" ? { color: "error.main" } : hint.tone === "ok" ? { color: "success.main" } : {}),
        }}
      >
        {hint.text}
      </Typography>
    </>
  );
}

// ---- headings -------------------------------------------------------------------

/** The right-aligned action row over a list screen.
 *
 *  Marketing Ops had a PageHead here that drew a title and a caption alongside the
 *  action. In One WSO2 the page title and its one-sentence subtitle belong to
 *  MarketingOpsShell — every perspective screen wears the same head — so all that is
 *  left for a list screen to contribute is its action. */
export function ActionRow({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 1,
        flexWrap: "wrap",
        mb: 1.75,
      }}
    >
      {children}
    </Box>
  );
}

// The heading over a workspace: back out, what you're looking at, then the actions.
// Leaving is always the FIRST thing on the row, never buried at the bottom.
export function WorkspaceHead({
  title,
  caption,
  onBack,
  backLabel,
  status,
  children,
}: {
  title: string;
  caption?: string;
  onBack: () => void;
  backLabel: string;
  status?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
      <Button
        onClick={onBack}
        startIcon={<ArrowLeft size={16} />}
        sx={{ textTransform: "none", fontSize: 13, color: "text.secondary", "&:hover": { color: "primary.main" } }}
      >
        {backLabel}
      </Button>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </Typography>
        {caption && <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>{caption}</Typography>}
      </Box>
      {status}
      <Box sx={{ flex: 1 }} />
      {children}
    </Box>
  );
}

// ---- chips and counts -----------------------------------------------------------

export function StatusChip({ status }: { status: Status }) {
  const { color, solid } = STATUS_STYLE[status] ?? { color: "text.secondary" };
  return (
    <Chip
      label={STATUS_LABEL[status] ?? status}
      size="small"
      sx={{
        height: 19,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        flexShrink: 0,
        // Solid marks the end of the road; every other state is an outline of its hue.
        ...(solid
          ? { bgcolor: color, color: "#fff", border: 1, borderColor: color }
          : { bgcolor: "transparent", color, border: 1, borderColor: color }),
      }}
    />
  );
}

/** A small tally beside a label — the count on a filter pill or a tab. */
export function Count({ n, color }: { n: number; color?: string }) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 16,
        height: 16,
        px: 0.4,
        borderRadius: 0.5,
        bgcolor: "action.hover",
        color: color ?? "text.secondary",
        fontSize: 10,
        fontWeight: 700,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {n}
    </Box>
  );
}

// The interaction-type switcher, and the primary navigation of both Events screens.
//
// A tab RAIL rather than another row of pills, because these are not five views of one
// list — they are five separate lists that arrived in one workbook and leave as five
// separate Pardot CSVs. Switching is "open a different document", not "filter this one",
// and the rail is fused to the top of the grid so the grid visibly belongs to its tab.
//
// It previously WAS a row of pills, identical in size, radius, weight and badge to the
// needs-attention chips below it — two rows of the same object, with nothing saying
// which was navigation. Keep this visibly heavier than anything beneath it.
export function TabRail<T extends string>({
  tabs,
  value,
  onChange,
}: {
  // `dot` is a colour, and its PRESENCE is the whole message: something on this tab is
  // unresolved. No number — a bare total beside a tab name only ever invited "a number
  // for what?", and the issue bar below already breaks it down field by field. What the
  // rail has to answer is narrower: is there anything left on the tabs I am NOT on.
  tabs: { key: T; label: string; count?: number; color?: string; title?: string; dot?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "stretch",
        borderBottom: 1,
        borderColor: "divider",
        overflowX: "auto",
        // No scrollbar under the tabs; the rail scrolls by drag/wheel if it overflows.
        scrollbarWidth: "none",
        "&::-webkit-scrollbar": { display: "none" },
      }}
    >
      {tabs.map((t) => {
        const active = t.key === value;
        const tab = (
          <Box
            component="button"
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.75,
              whiteSpace: "nowrap",
              px: 1.75,
              py: 1,
              border: 0,
              bgcolor: "transparent",
              cursor: "pointer",
              position: "relative",
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: active ? 700 : 500,
              letterSpacing: "-0.01em",
              color: active ? "primary.main" : "text.secondary",
              transition: "color .12s",
              "&:hover": { color: "primary.main" },
              // Sits ON the rail's bottom border, which is also the grid's top edge.
              "&::after": {
                content: '""',
                position: "absolute",
                left: 0,
                right: 0,
                bottom: -1,
                height: 2,
                bgcolor: active ? "primary.main" : "transparent",
              },
            }}
          >
            {t.label}
            {t.dot && (
              <Box
                component="span"
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  bgcolor: t.dot,
                  flexShrink: 0,
                  // Full strength on the tab you're on, held back elsewhere, so the rail
                  // reads as "here, and also over there" rather than five things
                  // competing for attention.
                  opacity: active ? 1 : 0.75,
                }}
              />
            )}
            {Boolean(t.count) && <Count n={t.count!} color={t.color} />}
          </Box>
        );
        return t.title ? (
          <Tooltip key={t.key} title={t.title} arrow placement="top">
            {tab}
          </Tooltip>
        ) : (
          <Box key={t.key} sx={{ display: "contents" }}>
            {tab}
          </Box>
        );
      })}
    </Box>
  );
}

/** A genuine filter over one list — the review queue's status filter — and so genuinely
 *  a row of pills, unlike the tab rail above. */
export function FilterPills<T extends string | null>({
  options,
  value,
  onChange,
}: {
  // `title` explains what `count` counts. A bare number on a pill is unreadable
  // otherwise, and the same badge means different things on different screens.
  options: { key: T; label: string; count?: number; color?: string; title?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 2 }}>
      {options.map((opt) => {
        const active = value === opt.key;
        const pill = (
          <Box
            component="button"
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.key)}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.6,
              px: 1.5,
              py: 0.6,
              borderRadius: 1,
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 12.5,
              fontWeight: active ? 700 : 500,
              border: 1,
              borderColor: active ? "primary.main" : "divider",
              color: active ? "primary.main" : "text.secondary",
              bgcolor: active ? "action.selected" : "transparent",
              transition: "all .12s",
              "&:hover": { borderColor: "primary.main", color: "primary.main" },
            }}
          >
            {opt.label}
            {opt.count !== undefined && <Count n={opt.count} color={opt.color} />}
          </Box>
        );
        return opt.title ? (
          <Tooltip key={opt.label} title={opt.title} arrow placement="top">
            {pill}
          </Tooltip>
        ) : (
          <Box key={opt.label} sx={{ display: "contents" }}>
            {pill}
          </Box>
        );
      })}
    </Box>
  );
}

// ---- containers -----------------------------------------------------------------

/** The hairline frame that goes around every table and canvas. */
export function Panel({ children, sx }: { children: ReactNode; sx?: object }) {
  return (
    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1.25, overflow: "hidden", ...sx }}>
      {children}
    </Box>
  );
}

/** Nothing here yet. Plain centred text, no dashed box — state the fact and say what to
 *  do about it; a placeholder drawn in dashes only advertises absence. */
export function Empty({ children }: { children: ReactNode }) {
  return (
    <Typography
      component="div"
      sx={{ fontSize: 13, color: "text.disabled", textAlign: "center", py: 4, lineHeight: 1.6 }}
    >
      {children}
    </Typography>
  );
}

export function Timestamp({ value }: { value?: string | null }) {
  if (!value) return <>—</>;
  const d = new Date(value);
  return (
    <Box component="span" sx={{ fontVariantNumeric: "tabular-nums" }}>
      {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
      {", "}
      {d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
    </Box>
  );
}

/** Progress state for a screen that's loading. */
export function EventsLoading({ messages }: { messages: readonly string[] }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1.25, py: 6 }}>
      <CircularProgress size={16} />
      <Typography sx={{ fontSize: 13, color: "text.secondary" }}>{messages[0]}</Typography>
    </Box>
  );
}
