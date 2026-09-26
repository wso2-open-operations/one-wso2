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
 * Renders an ISO timestamp as "3 minutes ago" / "2 hours ago" / "5 days ago".
 *
 * Lives here rather than in a component because all three pickers show it in
 * their delete dialog, and the elapsed time is the load-bearing part of that
 * warning: an agent run's `status` alone can't be trusted (a crashed Runner
 * leaves a row marked "running" for ever, and there's no heartbeat column),
 * but a person reading "3 minutes ago" against "6 days ago" can tell a live
 * run from a stale one instantly.
 *
 * `Intl.RelativeTimeFormat` is built in, so this needs no date library —
 * package.json has none, and one warning string doesn't justify adding one.
 * All it costs is picking the unit by hand.
 */
export function timeAgo(isoDate: string | null): string {
  if (!isoDate) return "recently";

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const diffMinutes = Math.round((new Date(isoDate).getTime() - Date.now()) / 60000);
  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, "minute");

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, "hour");

  const diffDays = Math.round(diffHours / 24);
  return rtf.format(diffDays, "day");
}
