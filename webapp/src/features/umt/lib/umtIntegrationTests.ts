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

import type { UmtUpdateProduct } from "../api/umtUpdates";

// A single product's persisted Test PR / Ignore Test Reason already
// satisfies Integration Tests' own completeness rule: a non-blank Test PR,
// OR a non-blank Ignore Test Reason.
export function umtProductHasIntegrationTestInfo(product: UmtUpdateProduct): boolean {
  return Boolean(product.testPr?.trim()) || Boolean(product.ignoreTestReason?.trim());
}

// True when Integration Tests is complete enough to proceed: for a
// containerized update, a non-blank Helm Chart Tag (read from the first
// product, since the backend repeats one shared value across every row);
// otherwise every product must satisfy umtProductHasIntegrationTestInfo.
// Vacuously true for an empty/absent product list in both branches, since
// the Helm Chart Tag is never evaluated when there are no products yet.
export function isIntegrationTestsComplete(
  products: UmtUpdateProduct[] | null | undefined,
  isContainerizedUpdate: boolean,
): boolean {
  if (!products || products.length === 0) return true;
  if (isContainerizedUpdate) return Boolean(products[0]?.helmChartTag?.trim());
  return products.every(umtProductHasIntegrationTestInfo);
}

export interface UmtIntegrationTestDraftRow {
  testPr: string;
  isIgnored: boolean;
  ignoreReason: string;
}

// Submit is blocked while there are no unsaved edits, or (containerized) the
// Helm Chart Tag draft is blank, or (non-containerized) any row is neither a
// non-blank Test PR nor an ignored row with a non-blank reason.
export function isIntegrationTestsSaveDisabled(params: {
  isDirty: boolean;
  isContainerizedUpdate: boolean;
  helmChartTag: string;
  rows: UmtIntegrationTestDraftRow[];
}): boolean {
  const { isDirty, isContainerizedUpdate, helmChartTag, rows } = params;
  if (!isDirty) return true;
  if (isContainerizedUpdate) return !helmChartTag.trim();
  return rows.some((row) => (row.isIgnored ? !row.ignoreReason.trim() : !row.testPr.trim()));
}
