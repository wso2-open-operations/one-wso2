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

import type { UmtPlatformStatsRow, UmtPlatformStatsVersionWireItem } from "./umtStatisticsTypes";

// The API returns one of three shapes depending on the selected breakdown.
// Normalize those shapes before caching so every chart only handles rows:
// `{ month, dynamicSeriesName: count }`.
//
// The shapes are checked rather than trusted because the declared wire type is
// only a cast over the parsed JSON. An unchecked mismatch does not fail — it
// charts silently wrong series, which is how a kebab-case rename once made a
// whole table render "N/A". Throwing instead surfaces the retryable error.
export function normalizeUmtPlatformStats(data: unknown): UmtPlatformStatsRow[] {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("Unexpected platform statistics payload: expected an object keyed by month.");
  }

  return Object.entries(data)
    .sort(([firstMonth], [secondMonth]) => firstMonth.localeCompare(secondMonth))
    .map(([month, values]) => {
      if (typeof values === "number") return { month, value: values };

      if (Array.isArray(values)) {
        return values.reduce<UmtPlatformStatsRow>((row, entry) => {
          const { product, version, count } = (entry ?? {}) as UmtPlatformStatsVersionWireItem;
          if (typeof product !== "string" || typeof version !== "string" || typeof count !== "number") {
            throw new Error(`Unexpected platform statistics entry for ${month}.`);
          }
          const series = `${product} ${version}`;
          return { ...row, [series]: ((row[series] as number | undefined) ?? 0) + count };
        }, { month });
      }

      if (typeof values !== "object" || values === null) {
        throw new Error(`Unexpected platform statistics value for ${month}.`);
      }

      const breakdown = values as Record<string, unknown>;
      if (Object.values(breakdown).some((count) => typeof count !== "number")) {
        throw new Error(`Unexpected platform statistics counts for ${month}.`);
      }
      if (Object.prototype.hasOwnProperty.call(breakdown, "month")) {
        throw new Error(`Unexpected "month" series in platform statistics for ${month}.`);
      }

      return { month, ...(breakdown as Record<string, number>) };
    });
}
