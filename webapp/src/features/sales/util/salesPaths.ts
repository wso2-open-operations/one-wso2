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

import type { LetterKey } from "../meddpicc/types";

/** The meeting page's tabs. */
export type MeetingTab = "summary" | "meddpicc" | "transcript";
export const MEETING_TABS: readonly MeetingTab[] = ["summary", "meddpicc", "transcript"];

/**
 * Where a meeting lives. `tab` opens it on one of its tabs (Summary when left out), and
 * `letter`, with the MEDDPICC tab, marks one Letter in it, as a clicked circle does.
 */
export function meetingPath(
  meetingId: number,
  options: { tab?: MeetingTab; letter?: LetterKey | null } = {},
): string {
  const params = new URLSearchParams();
  if (options.tab && options.tab !== "summary") params.set("tab", options.tab);
  if (options.tab === "meddpicc" && options.letter) params.set("letter", options.letter);
  const query = params.toString();
  return `/sales/meetings/${meetingId}${query ? `?${query}` : ""}`;
}

/** Where a deal lives. `letter` opens it filtered to one Letter, as a clicked circle does. */
export function dealPath(opportunityId: string, letter?: LetterKey | null): string {
  const base = `/sales/deals/${encodeURIComponent(opportunityId)}`;
  return letter ? `${base}?letter=${letter}` : base;
}
