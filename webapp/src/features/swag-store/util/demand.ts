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

import type { SwagStoreDemandRow } from "../api/swagStoreTypes";

/** One product on the demand board, with the options people wait for. */
export interface DemandProduct {
  readonly productId: string;
  readonly productName: string;
  /** People waiting, across every option. */
  readonly waiting: number;
  /** When the longest wait began. */
  readonly firstAlertAt: string;
  /** The earliest restock date set on any waiting option ("2026-12-12"), or null. */
  readonly nextRestock: string | null;
  /** Most wanted first. */
  readonly variants: readonly SwagStoreDemandRow[];
}

/** The civil date of the API's restock timestamp ("2026-12-12T00:00:00Z" → "2026-12-12"). */
export function restockDate(eta: string | null): string | null {
  return eta ? eta.slice(0, 10) : null;
}

/** Groups the per-option rows by product: most people waiting first, then whoever has waited longest. */
export function groupDemand(rows: readonly SwagStoreDemandRow[]): DemandProduct[] {
  const byProduct = new Map<string, SwagStoreDemandRow[]>();
  for (const row of rows) byProduct.set(row.productId, [...(byProduct.get(row.productId) ?? []), row]);
  const groups = [...byProduct.values()].map((variants): DemandProduct => {
    const dates = variants.map((v) => restockDate(v.restockEta)).filter((d): d is string => d !== null);
    return {
      productId: variants[0].productId,
      productName: variants[0].productName,
      waiting: variants.reduce((n, v) => n + v.pendingAlerts, 0),
      firstAlertAt: variants.map((v) => v.firstAlertAt).reduce((a, b) => (a < b ? a : b)),
      nextRestock: dates.length > 0 ? dates.reduce((a, b) => (a < b ? a : b)) : null,
      variants: [...variants].sort((a, b) => b.pendingAlerts - a.pendingAlerts),
    };
  });
  return groups.sort((a, b) => b.waiting - a.waiting || a.firstAlertAt.localeCompare(b.firstAlertAt));
}
