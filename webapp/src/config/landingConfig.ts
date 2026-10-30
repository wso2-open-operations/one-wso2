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

import { reachablePerspectives, type PerspectiveDef } from "@constants/perspectives";

/**
 * Where the app opens, when the URL names no particular page.
 *
 * A per-user choice only. There used to be a deployment-wide
 * ONE_WSO2_DEFAULT_PERSPECTIVE as well, with the user's preference layered over
 * it — a "follow the deployment" state distinct from picking a perspective, so
 * a user kept moving when the deployment moved. It bought nothing: everyone
 * lands on Me until they say otherwise, and anyone who wants something else can
 * set it themselves in a couple of clicks.
 *
 * Me is the floor. It is the one perspective every signed-in user can open, so
 * anything unusable resolves back to it.
 */
const FALLBACK_KEY = "me";

export interface LandingOption {
  key: string;
  label: string;
  path: string;
}

function asOptions(perspectives: PerspectiveDef[]): LandingOption[] {
  return perspectives.map((p) => ({ key: p.key, label: p.label, path: p.path as string }));
}

/**
 * What one PERSON may choose for themselves, in Settings.
 *
 * Everything reachable, gated or not. Someone who works in Marketing Ops all
 * day should be able to open there, and they are the only one affected by the
 * choice — they would not pick it if it did not work for them. An authorized
 * caller gets the real page; only an unauthorized one meets the locked door,
 * and that is the same screen the launcher would have given them.
 */
export function landingOptions(): LandingOption[] {
  return asOptions(reachablePerspectives()).sort((a, b) => a.label.localeCompare(b.label));
}

export function isLandingKey(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return landingOptions().some((o) => o.key === value);
}

/**
 * Resolve a perspective key to the path to land on, falling back to Me.
 *
 * Separate from `landingPath()` so a user-level preference can reuse the same
 * validation without going through `window.config`.
 */
export function landingPathFor(key: string | undefined): string {
  const match = landingOptions().find((o) => o.key === key);
  if (match) return match.path;
  const fallback = landingOptions().find((o) => o.key === FALLBACK_KEY);
  // If even Me were unlandable the registry would be broken, but returning "/"
  // here would make the index route redirect to itself forever.
  return fallback?.path ?? "/me";
}

/** Namespaced like the app's other browser-stored keys. */
const STORAGE_KEY = "one-wso2.landing";

/**
 * The user's own landing choice, or undefined when they have not made one.
 *
 * Validated on read — localStorage is user-editable, and a perspective can stop
 * being landable between releases.
 */
export function landingPreference(): string | undefined {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return isLandingKey(saved) ? saved : undefined;
  } catch {
    return undefined;
  }
}

/** Save a landing choice, or clear it with `undefined` to fall back to Me. */
export function setLandingPreference(key: string | undefined): void {
  try {
    if (key === undefined) localStorage.removeItem(STORAGE_KEY);
    else if (isLandingKey(key)) localStorage.setItem(STORAGE_KEY, key);
  } catch {
    // Private browsing and quota failures land here. The choice is lost, which
    // is better than throwing out of a settings form.
  }
}

/** Where the app opens: the user's choice if they made one, otherwise Me. */
export function landingPath(): string {
  return landingPathFor(landingPreference());
}
