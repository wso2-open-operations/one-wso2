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

/** Shared pieces for the list pages (Companies, Leads, Advanced Search).
 *
 * The four lists grew up separately and drifted: each had its own pagination
 * ("1 / 8", "Page 1 of 324", "Page 1 of 1381 · 82,831 total"), its own export
 * buttons, its own selection controls, and cells that wrapped to four lines.
 * These keep them reading as one product.
 */

import { FileDownload as FileDownloadIcon } from "../icons";
import { KeyboardArrowDown as KeyboardArrowDownIcon } from "../icons";
import { Box, Button, CircularProgress, Menu, MenuItem, Tooltip, Typography } from "@wso2/oxygen-ui";
import type { SxProps, Theme } from "@wso2/oxygen-ui";
import React, { useState } from "react";
import { C, F } from "../theme/pageTokens";
import { FS, FW, LABEL } from "../theme/typeScale";

/** Text clamped to `lines` with an ellipsis; the full value shows on hover.
 * Long titles / industries / locations no longer stretch a row to 4 lines. */
export function ClampText({ text, lines = 1, sx }: {
  text: string | null | undefined; lines?: number; sx?: SxProps<Theme>;
}) {
  const value = text?.trim() || "—";
  const node = (
    <Typography component="span" sx={{
      fontFamily: F, fontSize: "inherit", color: "inherit", display: "-webkit-box",
      WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden",
      wordBreak: "break-word", ...(sx as object),
    }}>
      {value}
    </Typography>
  );
  return value === "—" ? node : <Tooltip title={value} enterDelay={500} placement="top-start">{node}</Tooltip>;
}

/** "SANTA CLARA" → "Santa Clara". Only fully upper-case words longer than
 * three letters are re-cased, so "USA", "NY" or "McLean" are left alone. */
function smartCase(part: string): string {
  return part.replace(/\b([A-ZÀ-Þ]{4,})\b/g, (w) => w.charAt(0) + w.slice(1).toLowerCase());
}

/** Text that means "no value" when it reaches us as a string. Some imports and
 * enrichment payloads stored JSON `null` / Python `None` in city or state as
 * literal text, which rendered as "null, Novosibirsk Oblast, Russia". */
const NULLISH_TEXT = new Set(["", "null", "none", "nil", "undefined", "n/a", "-"]);

/** True when a location part holds a real value: not blank, not a null-ish placeholder. */
export function hasLocationPart(part: string | null | undefined): part is string {
  return typeof part === "string" && !NULLISH_TEXT.has(part.trim().toLowerCase());
}

/** One location format everywhere: "City, State, Country"; empty, null and
 * placeholder parts ("null", "None") are skipped. */
export function formatLocation(...parts: (string | null | undefined)[]): string {
  return parts.filter(hasLocationPart).map((p) => smartCase(p.trim())).join(", ");
}

/** The one pagination footer: "Prev · Page X of Y · N total · Next". */
export function ListFooter({ page, totalPages, total, noun, onPage, disabled }: {
  page: number; totalPages: number; total: number; noun: string;
  onPage: (p: number) => void; disabled?: boolean;
}) {
  const btn = { textTransform: "none", fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, minWidth: 0 } as const;
  return (
    <Box sx={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: 2, py: 0.9,
      borderTop: `1px solid ${C.border}`, bgcolor: C.panel, flexShrink: 0,
    }}>
      <Button size="small" disabled={disabled || page <= 1} onClick={() => onPage(page - 1)} sx={btn}>Prev</Button>
      <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.sub }}>
        Page {page.toLocaleString()} of {Math.max(1, totalPages).toLocaleString()}
        {" · "}{total.toLocaleString()} {noun}
      </Typography>
      <Button size="small" disabled={disabled || page >= totalPages} onClick={() => onPage(page + 1)} sx={btn}>Next</Button>
    </Box>
  );
}

export interface ExportOption {
  label: string;
  hint: string;
  onClick: () => void;
  color?: string;
}

/** One "Export ▾" button with described options (CSV, LinkedIn CSV, Apollo …). */
export function ExportMenu({ options, disabled, busy, busyLabel }: {
  options: ExportOption[]; disabled?: boolean; busy?: boolean; busyLabel?: string | null;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <Button size="small" variant="outlined" disabled={disabled || busy}
        startIcon={busy ? <CircularProgress size={13} /> : <FileDownloadIcon sx={{ fontSize: 15 }} />}
        endIcon={busy ? undefined : <KeyboardArrowDownIcon sx={{ fontSize: 16 }} />}
        onClick={(e) => setAnchor(e.currentTarget)} aria-haspopup="menu"
        sx={{
          textTransform: "none", whiteSpace: "nowrap", fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold,
          borderRadius: "7px", height: 32, borderColor: C.border, color: C.sub,
          "&:hover": { borderColor: C.orange, color: C.orange },
        }}>
        {busy ? (busyLabel || "Exporting…") : "Export"}
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{ sx: { bgcolor: C.panel, color: C.text, borderRadius: "8px", border: `1px solid ${C.border}`, boxShadow: "0 4px 16px rgba(0,0,0,0.08)", mt: 0.5 } }}>
        {options.map((o) => (
          <MenuItem key={o.label} onClick={() => { setAnchor(null); o.onClick(); }} sx={{ fontFamily: F, display: "block", py: 0.75 }}>
            <Typography sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: o.color ?? C.text }}>{o.label}</Typography>
            <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub }}>{o.hint}</Typography>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

/** Row actions for the current selection — shown only while rows are selected,
 * so they never crowd the filter bar. */
export function SelectionBar({ count, onClear, children, note }: {
  count: number; onClear: () => void; children?: React.ReactNode; note?: React.ReactNode;
}) {
  if (count <= 0) return null;
  return (
    <Box sx={{
      px: 2, py: 0.6, display: "flex", alignItems: "center", gap: 1.25, flexShrink: 0,
      bgcolor: `${C.orange}0d`, borderBottom: `1px solid ${C.orange}33`,
    }}>
      <Typography noWrap sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: C.orange }}>
        {count.toLocaleString()} selected
      </Typography>
      {note}
      {children}
      <Button size="small" onClick={onClear}
        sx={{ textTransform: "none", whiteSpace: "nowrap", fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, height: 28, color: C.sub, "&:hover": { color: C.orange, bgcolor: "transparent" } }}>
        Clear selection
      </Button>
    </Box>
  );
}

/** Active filters as removable chips above a result list, plus "Clear all". */
export function ActiveFilterChips({ chips, onClearAll }: {
  chips: { key: string; label: string; onRemove: () => void }[];
  onClearAll: () => void;
}) {
  if (chips.length === 0) return null;
  return (
    <Box sx={{
      px: 2, py: 0.75, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75,
      borderBottom: `1px solid ${C.border}`, bgcolor: C.panel,
    }}>
      {chips.map((c) => (
        <Box key={c.key} sx={{
          display: "inline-flex", alignItems: "center", gap: 0.5, pl: 1, pr: 0.4, height: 24, maxWidth: 360,
          borderRadius: "12px", bgcolor: `${C.orange}12`, border: `1px solid ${C.orange}33`,
        }}>
          <Typography noWrap sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.text }}>{c.label}</Typography>
          <Box component="button" type="button" aria-label={`Remove ${c.label}`} onClick={c.onRemove}
            sx={{
              border: 0, bgcolor: "transparent", cursor: "pointer", color: C.sub, p: 0.25, lineHeight: 1,
              fontSize: FS.small, borderRadius: "50%", "&:hover": { color: C.orange },
            }}>
            {"✕"}
          </Box>
        </Box>
      ))}
      <Box component="button" type="button" onClick={onClearAll}
        sx={{
          border: 0, bgcolor: "transparent", cursor: "pointer", fontFamily: F, fontSize: FS.caption,
          fontWeight: FW.semibold, color: C.sub, ml: 0.5, "&:hover": { color: C.orange, textDecoration: "underline" },
        }}>
        Clear all
      </Box>
    </Box>
  );
}

/** Every stage card in the pipeline headers is the same size. */
export const PIPELINE_CARD_H = 68;
const PIPELINE_STACK_GAP = 8;
/** Band height = two stacked cards (Companies' Research over Engage) — shared so
 * the Companies and Leads headers stay the same height; single cards centre in it. */
export const PIPELINE_BAND_H = PIPELINE_CARD_H * 2 + PIPELINE_STACK_GAP;
export const PIPELINE_STACK_GAP_PX = PIPELINE_STACK_GAP;

/** The pipeline header frame both pages use: same padding, same title row. */
export function PipelineHeader({ title, right, children }: {
  title: string; right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <Box sx={{ flexShrink: 0, borderBottom: `1px solid ${C.border}`, bgcolor: C.panel, px: 2.5, py: 1.25 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, minHeight: 20, mb: 1 }}>
        <Typography sx={{ fontFamily: F, ...LABEL, fontSize: FS.small, letterSpacing: "0.06em", color: C.textMd }}>
          {title}
        </Typography>
        <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 2 }}>{right}</Box>
      </Box>
      <Box sx={{ height: PIPELINE_BAND_H, display: "flex", alignItems: "center" }}>{children}</Box>
    </Box>
  );
}
