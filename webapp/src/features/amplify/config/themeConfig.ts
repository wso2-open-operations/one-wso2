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

// Amplify-only colours. Kept apart from src/config/themeConfig.ts, which stays the
// theme picker: nothing here overrides or reads a parent theme colour, it only adds
// names the dashboards need. Every dashboard bar and line uses one of these two.
// A deployment can change them in config.js (ONE_WSO2_AMPLIFY_POSITIVE_COLOR /
// ONE_WSO2_AMPLIFY_NEGATIVE_COLOR); anything that isn't a hex colour keeps the default.
// (The top-3 medal colours are deliberately not here; they stay hardcoded where they are.)

export interface AmplifyBarColors {
  /** Healthy / on-track / "more is good" bars and lines. */
  positive: string;
  /** Problem bars: failed shares, expired connections. */
  negative: string;
}

/** The colours used when config.js sets no override, or an override that isn't a hex colour. */
export const AMPLIFY_BAR_DEFAULTS: Readonly<AmplifyBarColors> = Object.freeze({
  positive: "#089c2f",
  negative: "#d92c16",
});

/** A CSS hex colour: `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa`. */
const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** `value` when it is a CSS hex colour (surrounding spaces ignored), otherwise `fallback`. */
export function hexColorOr(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return HEX_COLOR.test(trimmed) ? trimmed : fallback;
}

/** The runtime overrides config.js may set. */
export interface AmplifyColorConfig {
  ONE_WSO2_AMPLIFY_POSITIVE_COLOR?: unknown;
  ONE_WSO2_AMPLIFY_NEGATIVE_COLOR?: unknown;
}

/**
 * The dashboard colours: the config.js overrides when they are hex colours, the defaults otherwise.
 * Reads `window.config` unless a config is passed (tests pass one).
 */
export function resolveAmplifyBar(
  config: AmplifyColorConfig | undefined = typeof window === "undefined" ? undefined : window.config,
): Readonly<AmplifyBarColors> {
  return Object.freeze({
    positive: hexColorOr(config?.ONE_WSO2_AMPLIFY_POSITIVE_COLOR, AMPLIFY_BAR_DEFAULTS.positive),
    negative: hexColorOr(config?.ONE_WSO2_AMPLIFY_NEGATIVE_COLOR, AMPLIFY_BAR_DEFAULTS.negative),
  });
}

/** The colours in force. config.js loads before the bundle, so reading it once at startup is enough. */
export const AMPLIFY_BAR: Readonly<AmplifyBarColors> = resolveAmplifyBar();
