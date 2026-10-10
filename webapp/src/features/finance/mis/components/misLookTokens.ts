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

// The ARR Dashboard's look, as Oxygen theme tokens.
//
// Every colour, radius and weight the page's CHROME uses — the Period
// segments, the table tabs, the unit pills, the filter card and its buttons,
// the grid card's head — is named here once. The tables themselves are not
// here: they are Oxygen's `ListingTable` at its compact density and take that
// component's text, weights, padding and head fill (see `buildTableSx.ts` for
// the pieces it cannot supply). Most values resolve to a shell token. The few
// that cannot are literals, marked NO TOKEN below, each with the design value
// it stands for and why the shipped themes have nothing to offer in its place:
//
//   design value                     token here
//   -------------------------------- ----------------------------------------------
//   orange fills                     primary.main                 (the shell's orange)
//   orange text                      primary.dark in light, primary.main in dark
//   orange hover wash                rgba(primary.mainChannel / .06)
//   orange selected wash             rgba(primary.mainChannel / .12)
//   orange hover border              primary.light
//   slate-200 #e2e8f0 rules          divider
//   slate-600 #475569 control labels NO TOKEN — Oxygen's text.secondary equals
//                                    text.primary in both shipped themes, so the
//                                    checkbox labels have no tonal step to use
//   white surfaces                   background.paper
//   4 / 8 / 12px radii               NO TOKEN — shape.borderRadius is 12 or 20 in
//                                    the shipped themes, so the small radii of the
//                                    chrome are not derivable from the shape token
//                                    (the grid card itself uses the shape token)
//   soft shadows                     theme.shadows[1] / theme.shadows[3]
//   Inter                            typography.fontFamily (already Inter Variable)

import type { Theme } from "@mui/material/styles";
import type { SxProps } from "@mui/material/styles";

/** `var(--oxygen-palette-…)` — the shell's CSS-variable prefix. */
export const cssVar = (path: string) => `var(--oxygen-palette-${path})`;

/** The primary at an alpha, scheme-aware: always a wash of the shell's own orange. */
export const primaryTint = (alpha: number) =>
  `rgba(${cssVar("primary-mainChannel")} / ${alpha})`;

/**
 * Orange TEXT, contrast-safe: `primary.dark` on light surfaces (what the a11y
 * overlay already does for outlined primary chips and buttons), `primary.main`
 * in dark mode where the orange clears AA on its own.
 */
export const brandText = (theme: Theme) => ({
  color: cssVar("primary-main"),
  ...theme.applyStyles("light", { color: cssVar("primary-dark") }),
});

/**
 * The grid card's control labels (Values in '000, BU only, Totals only) in
 * slate-600 `#475569`, a step below the body text. NO TOKEN: Oxygen's
 * `text.secondary` equals `text.primary`, so the step is a literal in light and
 * `grey.400` in dark.
 */
export const slateText = (theme: Theme) => ({
  color: cssVar("grey-400"),
  ...theme.applyStyles("light", { color: "#475569" }),
});

/** The small radii of the chrome, as literals — see the header note. */
export const RADIUS = { sm: "4px", md: "8px", lg: "12px", pill: "999px" } as const;

// ---- Period segments ----------------------------------------------------------

export const periodSegmentSx = (pressed: boolean) => (theme: Theme) => ({
  height: 32,
  px: "12px",
  minWidth: 96,
  borderRadius: RADIUS.md,
  border: "1px solid",
  borderColor: pressed ? cssVar("primary-main") : cssVar("divider"),
  backgroundColor: pressed ? primaryTint(0.12) : "transparent",
  color: pressed ? cssVar("text-primary") : cssVar("text-secondary"),
  fontFamily: "inherit",
  fontSize: 12.5,
  fontWeight: pressed ? 700 : 500,
  whiteSpace: "nowrap",
  transition: "all 150ms ease-in-out",
  "&:hover": {
    borderColor: cssVar("primary-main"),
    backgroundColor: pressed ? primaryTint(0.18) : primaryTint(0.08),
    color: cssVar("text-primary"),
  },
  "&.Mui-focusVisible": { outline: `2px solid ${cssVar("primary-main")}`, outlineOffset: 2 },
  ...theme.applyStyles("dark", {
    borderColor: pressed ? cssVar("primary-main") : "rgba(255,255,255,0.18)",
  }),
});

// ---- Table tabs ---------------------------------------------------------------

export const underlineTabRowSx: SxProps<Theme> = {
  display: "flex",
  flexWrap: "wrap",
  gap: 0.5,
  borderBottom: "1px solid",
  borderColor: "divider",
  mb: 1.5,
};

export const underlineTabSx = (active: boolean) => (theme: Theme) => ({
  background: "transparent",
  border: "none",
  borderBottom: "3px solid transparent",
  borderBottomColor: active ? cssVar("primary-main") : "transparent",
  borderRadius: `${RADIUS.sm} ${RADIUS.sm} 0 0`,
  px: "10px",
  py: "14px",
  fontFamily: "inherit",
  fontSize: "0.875rem",
  fontWeight: 600,
  lineHeight: 1,
  color: active ? cssVar("text-primary") : cssVar("text-secondary"),
  // Oxygen's text.secondary equals text.primary, so a resting tab has no tonal
  // step of its own: opacity stands in for slate-600.
  opacity: active ? 1 : 0.72,
  transition: "all 300ms cubic-bezier(0.4, 0, 0.2, 1)",
  "&:hover": {
    ...brandText(theme),
    opacity: 1,
    borderBottomColor: active ? cssVar("primary-main") : cssVar("primary-light"),
  },
  "&.Mui-focusVisible": { outline: `2px solid ${cssVar("primary-main")}`, outlineOffset: 2 },
});

// ---- Unit pills ---------------------------------------------------------------

export const unitPillSx = (active: boolean) => (theme: Theme) => ({
  height: 28,
  px: "12px",
  borderRadius: RADIUS.pill,
  border: "1px solid",
  borderColor: active ? cssVar("primary-main") : cssVar("divider"),
  backgroundColor: active ? primaryTint(0.12) : "transparent",
  color: cssVar("text-primary"),
  opacity: active ? 1 : 0.78,
  fontFamily: "inherit",
  fontSize: "0.8125rem",
  fontWeight: active ? 700 : 500,
  whiteSpace: "nowrap",
  transition: "all 150ms ease-in-out",
  "&:hover": {
    opacity: 1,
    borderColor: cssVar("primary-light"),
    backgroundColor: active ? primaryTint(0.16) : primaryTint(0.06),
  },
  "&.Mui-focusVisible": { outline: `2px solid ${cssVar("primary-main")}`, outlineOffset: 2 },
  ...theme.applyStyles("dark", {
    borderColor: active ? cssVar("primary-main") : "rgba(255,255,255,0.18)",
  }),
});

// ---- Filter card --------------------------------------------------------------

/** The white→slate gradient card, light border, 12px radius, soft shadow. */
export const gradientCardSx = (theme: Theme) => ({
  p: 1.5,
  borderRadius: RADIUS.lg,
  border: "1px solid",
  borderColor: cssVar("divider"),
  background: `linear-gradient(180deg, ${cssVar("background-paper")}, ${cssVar("grey-50")})`,
  boxShadow: "0 6px 16px -10px rgba(15, 23, 42, 0.28)",
  ...theme.applyStyles("dark", {
    background: `linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))`,
    boxShadow: "none",
  }),
});

/** The card's text button (More / Less): uppercase 12px/700, letter-spacing .35px, 8px radius. */
export const faithfulTextButtonSx = (theme: Theme) => ({
  textTransform: "uppercase",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.35px",
  borderRadius: RADIUS.md,
  px: "10px",
  py: "6px",
  color: cssVar("text-secondary"),
  opacity: 0.85,
  "&:hover": { ...brandText(theme), opacity: 1, backgroundColor: primaryTint(0.08) },
});

/** Apply: filled primary, uppercase 12px/600, 4px radius. */
export const faithfulApplySx = {
  textTransform: "uppercase",
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.5px",
  borderRadius: RADIUS.sm,
  px: 1,
  py: "4px",
  boxShadow: 1,
  "&:not(:disabled)": { background: cssVar("primary-main"), color: cssVar("primary-contrastText") },
  "&:hover:not(:disabled)": { background: cssVar("primary-dark"), boxShadow: 3 },
} as const;

/** The outlined button (Clear All, Reset): primary border, brand text, uppercase 12px/700, 8px radius. */
export const faithfulOutlinedSx = (theme: Theme) => ({
  textTransform: "uppercase",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.35px",
  borderRadius: RADIUS.md,
  px: "10px",
  py: "5px",
  borderColor: cssVar("primary-main"),
  ...brandText(theme),
  "&:hover": { backgroundColor: primaryTint(0.12), borderColor: cssVar("primary-dark") },
});

/** Applied-filter chips: primary tint, brand text, 700. */
export const faithfulChipSx = (theme: Theme) => ({
  height: 24,
  fontSize: 12,
  fontWeight: 700,
  backgroundColor: primaryTint(0.12),
  border: `1px solid ${primaryTint(0.24)}`,
  ...brandText(theme),
  "& .MuiChip-deleteIcon": { color: "inherit", opacity: 0.7, "&:hover": { opacity: 1 } },
});

// ---- Per-grid header ----------------------------------------------------------

/**
 * The grid card is ONE outlined Oxygen surface — a 1px `divider` border on
 * `background.paper`, the theme's radius on its outer corners, no shadow — in
 * two pieces: this head, which takes the top corners, and `gridFrameSx` below,
 * which takes the bottom ones. The narrow-viewport notice sits square between
 * them, so the card reads as one piece whether or not it is showing.
 */
export const gridHeaderBarSx = (theme: Theme) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  // `as const`: csstype's FlexWrap is a closed union, so a widened `string`
  // fails SxProps once a theme value is spread in beside it.
  flexWrap: "wrap" as const,
  gap: 1.5,
  px: 2,
  pt: 1.5,
  pb: 1.25,
  backgroundColor: "background.paper",
  border: "1px solid",
  borderBottom: 0,
  borderColor: "divider",
  borderRadius: `${theme.shape.borderRadius}px ${theme.shape.borderRadius}px 0 0`,
});

/** The body of the grid card — see `gridHeaderBarSx`. */
export const gridFrameSx = (theme: Theme) => ({
  border: "1px solid",
  borderColor: "divider",
  borderRadius: `0 0 ${theme.shape.borderRadius}px ${theme.shape.borderRadius}px`,
  overflow: "hidden",
  backgroundColor: "background.paper",
});

/** The Table title: 20px/600, -0.025em, line-height 1.6, brand text. */
export const gridTitleSx = (theme: Theme) => ({
  m: 0,
  fontSize: "1.25rem",
  fontWeight: 600,
  letterSpacing: "-0.025em",
  lineHeight: 1.6,
  ...brandText(theme),
});

/** The units caption: 12px/500 in the secondary tone. */
export const gridCaptionSx = {
  display: "block",
  fontSize: "0.75rem",
  fontWeight: 500,
  lineHeight: 1.66,
  color: "text.secondary",
} as const;

/** Export: the same filled primary as Apply. */
export const faithfulExportSx = faithfulApplySx;
