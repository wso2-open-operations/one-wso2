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

// The chart palette for NEW charts in One WSO2, and the chrome around them.
//
// ---- these values are computed, not chosen ---------------------------------
//
// Every hex below is a documented slot from the `dataviz` skill's reference
// palette, and the pair was run through that skill's validator against THIS
// app's own surfaces rather than the skill's — `#FFFFFF` light and `#141417`
// dark, from `config/brandTheme.ts`. Both modes pass all five computable
// checks:
//
//   light  band PASS · chroma PASS · CVD ΔE 24.7 · normal-vision ΔE 33.6 · contrast PASS
//   dark   band PASS · chroma PASS · CVD ΔE 26.8 · normal-vision ΔE 31.8 · contrast PASS
//
// (ΔE is OKLab ×100 under protanopia, Machado-Oliveira-Fernandes 2009 at
// severity 1.0; the target is ≥ 8 and the normal-vision floor is ≥ 15.)
//
// **Re-run the validator before changing any value here**, once per mode. The
// script is the `dataviz` skill's rather than this repo's — `scripts/` here
// holds only `mis-port-facts.sh` — so run it from that skill's base directory:
//
//   node scripts/validate_palette.js "#2a78d6,#eb6834" --mode light --surface "#FFFFFF"
//   node scripts/validate_palette.js "#3987e5,#d95926" --mode dark  --surface "#141417"
//
// ---- two slots, deliberately -----------------------------------------------
//
// Not eight. A palette is a liability in proportion to its size: the reference
// palette's own note records that past three slots no ordering clears the
// all-pairs floors, and that its fourth puts yellow and orange on screen
// together. Slots are added here when a chart needs one and the validator says
// the set still passes — never in advance.
//
// ---- how this relates to the Marketing Ops palette -------------------------
//
// `features/marketing-ops/ad-campaigns/analytics/chartTheme.ts` has its own, and
// keeps it: its series colours are ported unchanged from the tool the marketing
// team uses today, so its charts read the same in both apps — a continuity
// argument that is real and specific to that port. That file already records
// its own deviation from this skill (it CYCLES a nine-colour list). Neither is
// wrong; they answer different questions. New charts with no such continuity
// obligation use this module, and Marketing Ops can adopt it whenever its
// parallel period ends.

/** A categorical slot, in both modes. Assigned by ENTITY, never by rank. */
export interface ChartSeriesColor {
  light: string;
  dark: string;
}

/**
 * Slot 1 — blue. The default for a single series, and the first of a pair.
 *
 * A chart with ONE series uses this for every mark. That is the rule rather
 * than a preference: colouring nominal bars by their own value double-encodes
 * what bar length already shows and spends the identity channel on nothing.
 */
export const CHART_SERIES_1: ChartSeriesColor = { light: "#2a78d6", dark: "#3987e5" };

/** Slot 2 — orange. The second of a pair. */
export const CHART_SERIES_2: ChartSeriesColor = { light: "#eb6834", dark: "#d95926" };

/** The chart surfaces these were validated against — `brandTheme.ts`'s paper. */
export const CHART_SURFACE: ChartSeriesColor = { light: "#FFFFFF", dark: "#141417" };

/** Which half of a slot this theme mode wants. */
export const seriesColor = (slot: ChartSeriesColor, mode: "light" | "dark"): string =>
  mode === "dark" ? slot.dark : slot.light;

/**
 * Gridlines, axes and the rest of the recessive furniture.
 *
 * Hairlines one shade off the surface, and SOLID — a dashed gridline reads as a
 * projection or a threshold when it is only a grid. Expressed as alpha over the
 * surface rather than as fixed greys, so both modes stay one rule.
 */
export interface ChartChrome {
  /** Gridlines and axis rules. */
  line: string;
  /** Axis tick text. Ink, never a series colour. */
  tick: string;
}

export function chartChrome(mode: "light" | "dark"): ChartChrome {
  return mode === "dark"
    ? { line: "rgba(255, 255, 255, 0.10)", tick: "rgba(255, 255, 255, 0.62)" }
    : { line: "rgba(15, 23, 42, 0.10)", tick: "rgba(15, 23, 42, 0.60)" };
}

/**
 * The gap between two touching fills, in pixels.
 *
 * A gap rather than a border: a stroke around a mark adds a third colour and
 * thickens the shape, where a gap of surface separates the fills using nothing
 * at all. Applies to stacked segments and to adjacent bars alike.
 */
export const CHART_FILL_GAP = 2;
