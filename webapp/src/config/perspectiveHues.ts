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
 * One identity colour per perspective, for the app launcher.
 *
 * Why colour at all: the launcher is scanned, not read. Six tiles that differ only
 * by glyph and label force you to read each one; a stable hue per perspective makes
 * finding one pre-attentive. Six is also about the ceiling — past eight or ten,
 * hue discrimination collapses and you are back to reading labels.
 *
 * Scope is deliberately the launcher alone. The rail already signals "you are here"
 * with selection state, so a hue there would compete with a signal that works;
 * the launcher is the one surface with nothing else doing that job.
 *
 * SIZING, and the constraint that will eventually break this: the registry holds
 * eleven perspectives, but five are locked placeholders (CSM, Rev Ops, Legal,
 * Service Requests) that render grayscaled and need no hue. So the hues cover
 * everything reachable today, which sits just inside the limit. As those unlock,
 * adding a hue each takes the set past the point where hues are tellable apart —
 * at which point the answer is a different encoding (hue per domain family, or back
 * to monochrome), not a longer list. perspectiveHues.test.ts caps the palette at
 * eight so that decision is forced rather than drifted into.
 *
 * TREATMENT: the glyph is the hue's dark shade on a wash of the same hue — not a
 * saturated fill with a white glyph. White-on-hue measures 3.05–3.99:1 across these
 * six, which passes WCAG 1.4.11 (3:1 for meaningful icons) with nothing left over
 * for a seventh perspective. The washes below measure 4.53–5.37:1 in light and
 * 3.83–5.01:1 in dark — both comfortably clear of the floor. Those figures are
 * asserted, not annotated: the test recomputes them from these hexes.
 *
 * The dark values are counter-intuitive and worth not "fixing": in dark mode the
 * glyph is the hue *itself*, so a stronger wash moves field and glyph together and
 * closes the gap. Dark therefore uses a weaker wash (12%) than light (14%).
 *
 * Values are precomputed rather than composited at runtime so they can be read,
 * reviewed, and asserted — see perspectiveHues.test.ts, which fails if any pair
 * drops below the 3:1 floor.
 *
 * OPEN: five of these six are not brand colours. The WSO2 brand system defines one
 * accent, so a palette this wide needs a brand-owner ruling — the same conversation
 * as the 180x72px logo minimum and the contained-button contrast. Until then this is
 * launcher-local and easy to withdraw.
 */
export interface PerspectiveTint {
  /** Wash behind the glyph. */
  bg: string;
  /** The glyph itself. */
  fg: string;
}

export interface PerspectiveHue {
  /** The identity hue at full saturation. Not painted directly — see the note above. */
  hue: string;
  light: PerspectiveTint;
  dark: PerspectiveTint;
}

/**
 * Keyed by `PerspectiveDef.key`. A perspective with no entry falls back to the
 * neutral treatment, so adding a perspective can't break the launcher — it just
 * renders uncoloured until a hue is chosen for it.
 */
export const PERSPECTIVE_HUES: Record<string, PerspectiveHue> = {
  // Brand orange stays with Me. That only works because selection no longer uses
  // orange (see WaffleOverlay): an orange ring around an orange tile measures
  // 3.00:1, exactly at the floor, and reads as nothing.
  me: {
    hue: "#F14E23",
    light: { bg: "#FDE6E0", fg: "#B93816" },
    dark: { bg: "#2C2124", fg: "#F14E23" },
  },
  people: {
    hue: "#2E8FE0",
    light: { bg: "#E2EFFB", fg: "#1A6BB8" },
    dark: { bg: "#1E2530", fg: "#2E8FE0" },
  },
  finance: {
    hue: "#22A37D",
    light: { bg: "#E0F2ED", fg: "#1C7A5E" },
    dark: { bg: "#1B2726", fg: "#22A37D" },
  },
  marketing: {
    hue: "#E04A8F",
    light: { bg: "#FBE6EF", fg: "#B02E6B" },
    dark: { bg: "#2C212A", fg: "#E04A8F" },
  },
  // Teal: distinct from Me's orange, People's blue, Finance's green, Workspace's
  // violet, Marketing's pink and Requests' gold at the sizes the rail and
  // launcher tiles use.
  procurement: {
    hue: "#0E8F8F",
    light: { bg: "#DEF0F0", fg: "#0B6E6E" },
    dark: { bg: "#1B2828", fg: "#17AFAF" },
  },
  requests: {
    hue: "#C08A16",
    light: { bg: "#F6EFDE", fg: "#8A6410" },
    dark: { bg: "#282520", fg: "#C08A16" },
  },
};

export function perspectiveHue(key: string): PerspectiveHue | undefined {
  return Object.prototype.hasOwnProperty.call(PERSPECTIVE_HUES, key)
    ? PERSPECTIVE_HUES[key]
    : undefined;
}
