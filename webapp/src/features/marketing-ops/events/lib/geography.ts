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

// Wording for the country and state sync panel in Settings → Events.

import type { GeographyStatus } from "../eventsTypes";

/** "just now", "12 minutes ago", "3 hours ago", "2 days ago". */
export function sinceText(iso: string, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/** The one-line state of the copy. */
export function freshnessText(s: GeographyStatus, now: Date = new Date()): string {
  if (!s.synced_at) return "Not synced from Salesforce yet — these are still the template's lists.";
  const who = s.synced_by ? ` by ${s.synced_by}` : " automatically";
  return `Synced ${sinceText(s.synced_at, now)}${who}.`;
}

/** A failure worth showing: the last attempt failed and nothing has succeeded since. */
export function failureText(s: GeographyStatus, now: Date = new Date()): string | null {
  if (!s.error || !s.attempted_at) return null;
  const kept = s.synced_at
    ? `The lists from ${sinceText(s.synced_at, now)} are still in use.`
    : "The template's lists are still in use.";
  return `The last sync, ${sinceText(s.attempted_at, now)}, failed: ${s.error} ${kept}`;
}
