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

/**
 * Shared page palette, derived from the active Oxygen theme AND color scheme.
 *
 * Pages used to each declare a local `const C = {...}` of hardcoded colors;
 * they now import this one. Surface/text/border/accent tokens re-derive from
 * the live theme + light/dark scheme (so the header's theme switcher and the
 * dark-mode toggle restyle page content), while semantic colors (success/error
 * hues, LinkedIn blue, ...) stay stable.
 *
 * The tokens are module-level getters kept in sync by IsacShell, which calls
 * syncPageTokens(theme, mode) during render — before any page renders — and
 * remounts the ISAC screens on a theme or scheme switch so every sx
 * re-evaluates. Accent values must stay 6-digit hex: pages alpha-suffix them
 * ("`${C.orange}14`").
 */

import type { Theme } from "@wso2/oxygen-ui";

export const F = "'Inter', system-ui, sans-serif";

/** Static light-scheme fallbacks — the original hand-picked palette. */
const LIGHT = {
  bg: "#fafbfd", panel: "#ffffff", card: "#f5f6f9", cardBg: "#f5f6f9",
  warmBg: "#fffaf6", border: "#e8eaef", borderSoft: "#f0f1f5",
  text: "#16172b", textMd: "#3d3f56", sub: "#7b7e94", dim: "#b3b6c6",
  orange: "#FF6700", orangeDark: "#e65c00",
  // Semantic hues — theme-independent by design.
  green: "#0d7d55", red: "#c42d4e", amber: "#a97508", blue: "#4f56c8",
  pink: "#b83d6e", slate: "#8891a0", purple: "#7c3aed",
  linkedin: "#0A66C2", apollo: "#6b48d6",
  churn: "#dc2626", prospect: "#FF6700", winBack: "#7c3aed",
  wso2: "#0d7d55", wso2Too: "#0d7d55",
  competitor: "#c42d4e", category: "#4f56c8",
  decision: "#c42d4e", consideration: "#a97508", awareness: "#4f46e5",
};

/** Dark-scheme fallbacks for the surface tokens (semantics brightened a touch
 * where the light value would sink into a dark background). */
const DARK_SURFACES = {
  bg: "#121318", panel: "#1a1c23", card: "#232630", cardBg: "#232630",
  warmBg: "#26201a", border: "#2e3140", borderSoft: "#282b38",
  text: "#e8e9f0", textMd: "#c6c8d4", sub: "#9a9db0", dim: "#5b5e70",
};

let current: typeof LIGHT = { ...LIGHT };

/** Force any CSS color into #rrggbb (pages alpha-suffix accent tokens). */
function toHex(color: string, fallback: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  const m = color.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (!m) return fallback;
  return "#" + [m[1], m[2], m[3]]
    .map((n) => Math.max(0, Math.min(255, parseInt(n, 10))).toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Re-derive the theme-following tokens from the active theme + scheme.
 *
 * Returns a string that changes whenever any token does — a key for remounting
 * what reads them.
 */
export function syncPageTokens(theme: Theme, mode: "light" | "dark" = "light"): string {
  // CSS-vars themes keep per-scheme palettes under colorSchemes; theme.palette
  // alone reflects only the default scheme.
  const schemes = (theme as unknown as { colorSchemes?: Record<string, { palette?: Theme["palette"] }> }).colorSchemes;
  const p = schemes?.[mode]?.palette ?? theme.palette;
  const dark = mode === "dark";
  const fb = dark ? { ...LIGHT, ...DARK_SURFACES } : LIGHT;
  current = {
    ...LIGHT,
    ...(dark ? DARK_SURFACES : {}),
    bg: p.background?.default ?? fb.bg,
    panel: p.background?.paper ?? fb.panel,
    border: p.divider ?? fb.border,
    borderSoft: p.divider ?? fb.borderSoft,
    text: toHex(p.text?.primary ?? "", fb.text),
    textMd: toHex(p.text?.primary ?? "", fb.textMd),
    sub: toHex(p.text?.secondary ?? "", fb.sub),
    dim: toHex(p.text?.disabled ?? "", fb.dim),
    orange: toHex(p.primary?.main ?? "", LIGHT.orange),
    orangeDark: toHex(p.primary?.dark ?? "", LIGHT.orangeDark),
    prospect: toHex(p.primary?.main ?? "", LIGHT.prospect),
    // dark scheme: card surfaces sit one step above paper
    card: dark ? DARK_SURFACES.card : (LIGHT.card),
    cardBg: dark ? DARK_SURFACES.cardBg : LIGHT.cardBg,
    warmBg: dark ? DARK_SURFACES.warmBg : LIGHT.warmBg,
  };
  return Object.values(current).join("|");
}

/** The shared page palette — getters so module-scope consumers stay live. */
export const C = {} as { readonly [K in keyof typeof LIGHT]: string };
for (const key of Object.keys(LIGHT) as (keyof typeof LIGHT)[]) {
  Object.defineProperty(C, key, { get: () => current[key], enumerable: true });
}
