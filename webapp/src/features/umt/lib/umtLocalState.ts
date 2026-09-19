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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import type { UmtBundleInfoChange, UmtFileOperation, UmtPullRequestAnalysisItem } from "../api/umtUpdates";

// Persists the edit-tab stepper position, PR Analysis manual-add drafts, and
// the selected update-detail tab to localStorage, all scoped per update id so
// drafts/tab-selection never leak across different updates. Follows this
// codebase's existing localStorage convention (see
// features/pinned/pinnedStore.ts): dotted, versioned keys, every access
// wrapped in try/catch with a safe fallback.

function readString(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeString(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // private browsing / storage disabled - non-fatal
  }
}

// `JSON.parse` only throws on malformed JSON text — a validly-parsed value of
// the wrong shape (manual edit, or a value written by a future/older shape)
// would otherwise reach callers as `T` on nothing more than a type
// assertion. `isValid` re-checks the parsed value's actual shape so a
// mismatch falls back the same way a parse error does.
function readJson<T>(key: string, fallback: T, isValid: (value: unknown) => value is T): T {
  const raw = readString(key);
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  writeString(key, JSON.stringify(value));
}

// --- Edit-tab stepper position (id-scoped) ---

export function readPersistedEditStep(id: string): string | null {
  return readString(`one-wso2.umt-edit-step.v1.${id}`);
}

export function writePersistedEditStep(id: string, stepId: string | null): void {
  writeString(`one-wso2.umt-edit-step.v1.${id}`, stepId);
}

// --- PR Analysis manual-add drafts (id-scoped) ---

export function readPersistedPullRequests(id: string): UmtPullRequestAnalysisItem[] {
  return readJson(`one-wso2.umt-pr-analysis-prs.v1.${id}`, [], Array.isArray);
}

export function writePersistedPullRequests(id: string, rows: UmtPullRequestAnalysisItem[]): void {
  writeJson(`one-wso2.umt-pr-analysis-prs.v1.${id}`, rows);
}

export function readPersistedManualFiles(id: string): UmtFileOperation[] {
  return readJson(`one-wso2.umt-pr-analysis-files.v1.${id}`, [], Array.isArray);
}

export function writePersistedManualFiles(id: string, rows: UmtFileOperation[]): void {
  writeJson(`one-wso2.umt-pr-analysis-files.v1.${id}`, rows);
}

export function readPersistedBundleInfoChanges(id: string): UmtBundleInfoChange[] {
  return readJson(`one-wso2.umt-pr-analysis-bundle-info.v1.${id}`, [], Array.isArray);
}

export function writePersistedBundleInfoChanges(id: string, rows: UmtBundleInfoChange[]): void {
  writeJson(`one-wso2.umt-pr-analysis-bundle-info.v1.${id}`, rows);
}

// --- Update-detail selected tab (id-scoped) ---

export function readPersistedSelectedTab(id: string): string | null {
  return readString(`one-wso2.umt-update-tab.v1.${id}`);
}

export function writePersistedSelectedTab(id: string, tab: string): void {
  writeString(`one-wso2.umt-update-tab.v1.${id}`, tab);
}
