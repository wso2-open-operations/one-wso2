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
    // primary alone no longer separates every pair, so the signature includes
    // the dark background, which is where WSO2's blue (#0b142b) distinguishes
    // itself.
    const sigs = THEME_OPTIONS.map((o) => `${primaryOf(o.key).toLowerCase()}|${darkBgOf(o.key).toLowerCase()}`);
    expect(new Set(sigs).size).toBe(THEME_OPTIONS.length);
    expect(primaryOf("acrylicOrange")).toBe("#fa7b3f");
    expect(primaryOf("wso2")).toBe("#F14E23");
    expect(
      (resolveTheme("wso2") as unknown as {
        colorSchemes: { dark: { palette: { primary: { main: string } } } };
      }).colorSchemes.dark.palette.primary.main,
    ).toBe("#F14E23");
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

describe("DataGrid panel overlay", () => {
  type Override = (props: { theme: unknown }) => Record<string, unknown>;
  const dataGridOf = (theme: unknown) =>
    (theme as { components?: { MuiDataGrid?: { styleOverrides?: Record<string, unknown> } } }).components?.MuiDataGrid
      ?.styleOverrides ?? {};

  it("paints the Columns/Filters panel with an opaque colour in every offered theme and scheme", () => {
    for (const { key } of THEME_OPTIONS) {
      const theme = resolveTheme(key) as unknown as {
        colorSchemes: Record<"light" | "dark", { palette: { background: { default: string } } }>;
      };
      const panelContent = dataGridOf(theme).panelContent as Override;
      for (const scheme of ["light", "dark"] as const) {
        const palette = theme.colorSchemes[scheme].palette;
        const { backgroundColor } = panelContent({ theme: { palette } });
        // #rgb or #rrggbb, never a #rrggbbaa that lets the grid show through.
        expect(backgroundColor, `${key} ${scheme}`).toMatch(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
      }
    }
  });

  it("reads the CSS variable when the theme has one, as it does at runtime", () => {
    const panelContent = dataGridOf(resolveTheme(THEME_OPTIONS[0].key)).panelContent as Override;
    const palette = { background: { default: "#fff" } };
    const vars = { palette: { background: { default: "var(--bg-default)" } } };
    expect(panelContent({ theme: { palette, vars } }).backgroundColor).toBe("var(--bg-default)");
  });

  it("keeps Oxygen's own DataGrid overrides alongside it", () => {
    for (const { key } of THEME_OPTIONS) {
      expect(Object.keys(dataGridOf(resolveTheme(key)))).toEqual(
        expect.arrayContaining([...Object.keys(dataGridOf(THEMES[key])), "panelContent", "menu"]),
      );
    }
  });
});
