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

// Theme selection, then the accessibility overlay.
//
// Oxygen's presets are used as shipped, except the WSO2 theme's primary.
// Oxygen sets that to brand orange 600 (#D32F00). This app uses brand orange
// 500 (#F14E23) and keeps the neighbouring steps: 400 for light, 600 for dark.

import { deepmerge } from "@mui/utils";
import { extendTheme } from "@mui/material/styles";
import {
  AcrylicOrangeTheme,
  AcrylicPurpleTheme,
  ClassicTheme,
  HighContrastTheme,
  PaleGrayTheme,
  PaleIndigoTheme,
  WSO2Theme,
} from "@wso2/oxygen-ui";
import type { OxygenTheme } from "@wso2/oxygen-ui/styles/OxygenThemeBase";
import { withA11yOverrides } from "@config/a11yThemeOverrides";

const BRAND_ORANGE = {
  light: "#FF6E47",
  main: "#F14E23",
  dark: "#D32F00",
  contrastText: "#FFFFFF",
} as const;

function withBrandOrangePrimary(theme: OxygenTheme): OxygenTheme {
  return extendTheme(
    deepmerge(theme, {
      colorSchemes: {
        light: { palette: { primary: BRAND_ORANGE } },
        dark: { palette: { primary: BRAND_ORANGE } },
      },
    }),
  ) as OxygenTheme;
}

export const THEMES = {
  acrylicOrange: AcrylicOrangeTheme,
  // Alias, resolvable but not offered — an earlier iteration persisted this key,
  // so saved preferences must keep working. canonicalThemeKey() folds it back.
  oneWso2: AcrylicOrangeTheme,
  acrylicPurple: AcrylicPurpleTheme,
  classic: ClassicTheme,
  highContrast: HighContrastTheme,
  // Deliberately NOT offered: OxygenTheme (= AcrylicBaseTheme) and
  // PaleBaseTheme, which are the bases the themes above extend rather than
  // finished looks of their own.
  wso2: withBrandOrangePrimary(WSO2Theme),
  paleIndigo: PaleIndigoTheme,
  paleGray: PaleGrayTheme,
} satisfies Record<string, OxygenTheme>;

export type ThemeKey = keyof typeof THEMES;

// WSO2 is the default: it is Oxygen's own WSO2-branded preset, and the only one
// whose dark mode is the WSO2 blue (background.default #0b142b) rather than a
// neutral black. THEME_OPTIONS lists it first — a test pins option[0] to this.
export const DEFAULT_THEME_KEY: ThemeKey = "wso2";

/**
 * What the picker offers, in display order. The brand theme leads because it is
 * the default; the rest are the shipped presets. Deliberately a subset of
 * THEMES: `oneWso2` resolves to the same theme as `acrylicOrange` and is left
 * out so the menu does not list it twice.
 */
export const THEME_OPTIONS: { key: ThemeKey; label: string }[] = [
  { key: "wso2", label: "WSO2" },
  { key: "acrylicOrange", label: "Acrylic Orange" },
  { key: "acrylicPurple", label: "Acrylic Purple" },
  { key: "classic", label: "Classic" },
  { key: "highContrast", label: "High Contrast" },
  { key: "paleIndigo", label: "Pale Indigo" },
  { key: "paleGray", label: "Pale Gray" },
];

export function isThemeKey(value: unknown): value is ThemeKey {
  // `hasOwn` rather than `in`: `in` also matches inherited names such as
  // "toString", which would pass as a theme key and hand a function to
  // withA11yOverrides.
  return typeof value === "string" && Object.hasOwn(THEMES, value);
}

/**
 * Fold an alias onto the key the picker lists.
 *
 * Without this, a preference saved under the alias resolves to the right theme
 * but matches no menu row, so the picker opens with nothing ticked.
 */
export function canonicalThemeKey(key: ThemeKey): ThemeKey {
  return key === "oneWso2" ? "acrylicOrange" : key;
}

/** The theme key configured for this deployment, falling back to the default. */
export function configThemeKey(): ThemeKey {
  const configured = window.config?.ONE_WSO2_THEME;
  return isThemeKey(configured) ? canonicalThemeKey(configured) : DEFAULT_THEME_KEY;
}

/** Resolve a key to a ready-to-use theme, accessibility overlay included. */
export function resolveTheme(key: string | undefined): OxygenTheme {
  return withA11yOverrides(isThemeKey(key) ? THEMES[key] : THEMES[DEFAULT_THEME_KEY]);
}

// No module-level resolved theme any more: the theme is chosen at runtime and can
// change, so it belongs in React state. ThemePreferenceProvider owns it and calls
// resolveTheme() per key; configThemeKey() is the fallback when nothing is saved.
