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

import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_THEME_KEY,
  canonicalThemeKey,
  THEMES,
  THEME_OPTIONS,
  configThemeKey,
  isThemeKey,
  resolveTheme,
} from "@config/themeConfig";

/**
 * The light-scheme primary, which is the cheapest stable fingerprint for "which
 * theme is this". Whole-object comparison is not an option: an Oxygen theme
 * carries functions (applyStyles, style-override callbacks), so deep equality
 * compares those by reference and never matches.
 */
function primaryOf(key: string | undefined): string {
  const theme = resolveTheme(key) as unknown as {
    colorSchemes: { light: { palette: { primary: { main: string } } } };
  };
  return theme.colorSchemes.light.palette.primary.main;
}

/** A theme's dark-mode canvas — what separates WSO2's blue from the neutrals. */
function darkBgOf(key: string | undefined): string {
  const theme = resolveTheme(key) as unknown as {
    colorSchemes: { dark: { palette: { background: { default: string } } } };
  };
  return theme.colorSchemes.dark.palette.background.default;
}

beforeEach(() => {
  // configThemeKey reads window.config, which the SDK populates at runtime.
  delete (window as { config?: unknown }).config;
});

describe("theme registry", () => {
  it("offers seven themes in the picker", () => {
    expect(THEME_OPTIONS).toHaveLength(7);
  });

  it("only offers keys that actually resolve", () => {
    for (const o of THEME_OPTIONS) {
      expect(isThemeKey(o.key), `"${o.key}" is offered but not a theme key`).toBe(true);
      expect(resolveTheme(o.key)).toBeDefined();
    }
  });

  it("labels every option, distinctly", () => {
    const labels = THEME_OPTIONS.map((o) => o.label);
    expect(labels.every((l) => l.length > 0)).toBe(true);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("leads with the default so the picker opens on the applied theme", () => {
    expect(THEME_OPTIONS[0].key).toBe(DEFAULT_THEME_KEY);
  });

  it("keeps the superseded key resolvable but unlisted", () => {
    // An earlier iteration persisted "oneWso2"; saved preferences must keep
    // working without the menu offering the same theme twice.
    expect(isThemeKey("oneWso2")).toBe(true);
    expect(THEME_OPTIONS.some((o) => o.key === "oneWso2")).toBe(false);
    // Asserted on the registry, where the aliasing actually lives. resolveTheme
    // returns a fresh object per call (the accessibility overlay clones), so it
    // could only be compared structurally — this is the real invariant.
    expect(THEMES.oneWso2).toBe(THEMES.acrylicOrange);
    expect(canonicalThemeKey("oneWso2")).toBe("acrylicOrange");
  });

  it("falls back rather than trusting an unknown or hostile key", () => {
    expect(primaryOf("nonsense")).toBe(primaryOf(DEFAULT_THEME_KEY));
    expect(primaryOf(undefined)).toBe(primaryOf(DEFAULT_THEME_KEY));
    // `in` would accept these off the prototype chain and hand a function to
    // the accessibility overlay.
    expect(isThemeKey("toString")).toBe(false);
    expect(isThemeKey("constructor")).toBe(false);
  });

  it("takes the deployment default from config, ignoring a bad value", () => {
    (window as { config?: Record<string, unknown> }).config = { ONE_WSO2_THEME: "acrylicPurple" };
    expect(configThemeKey()).toBe("acrylicPurple");

    (window as { config?: Record<string, unknown> }).config = { ONE_WSO2_THEME: "bogus" };
    expect(configThemeKey()).toBe(DEFAULT_THEME_KEY);

    delete (window as { config?: unknown }).config;
    expect(configThemeKey()).toBe(DEFAULT_THEME_KEY);
  });

  it("offers seven visibly different themes, not aliases of one", () => {
    // The point of a picker is that the options look different. The light
    // primary alone no longer separates them: Classic is #ff7300 and WSO2 is
    // #FF7300 — the same colour in different case, so comparing raw strings
    // would "pass" by accident. They are genuinely different themes (different
    // secondary, surfaces, and dark mode), so the signature includes the dark
    // background, which is where WSO2's blue (#0b142b) distinguishes itself.
    const sigs = THEME_OPTIONS.map((o) => `${primaryOf(o.key).toLowerCase()}|${darkBgOf(o.key).toLowerCase()}`);
    expect(new Set(sigs).size).toBe(THEME_OPTIONS.length);
    expect(primaryOf("acrylicOrange")).toBe("#fa7b3f");
    // The reason WSO2 is the default: it is the only dark mode that is not neutral.
    expect(darkBgOf("wso2").toLowerCase()).toBe("#0b142b");
  });

  it("registers more themes than it offers, and every offer is registered", () => {
    // THEMES is the superset (it carries the alias); THEME_OPTIONS is the menu.
    const offered = THEME_OPTIONS.map((o) => o.key);
    for (const key of offered) expect(Object.keys(THEMES)).toContain(key);
    expect(Object.keys(THEMES).length).toBeGreaterThan(offered.length);
  });
});
