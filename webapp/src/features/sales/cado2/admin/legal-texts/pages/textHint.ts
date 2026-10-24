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

import { formatDate } from "@features/sales/cado2/quotes/form/draftForm";

/** "A, B and C". */
const listed = (items: readonly string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}` : (items[0] ?? "");

/**
 * The hint under a standard text (2026-10-24): the placeholders only on the
 * partner texts (a direct deal has no partner to fill in), and who changed
 * it only once a person has; "seed" is the migration, not a person.
 */
export function textHint(textKey: string, updatedAt: string, updatedBy: string, placeholders: readonly string[]): string {
  const parts: string[] = [];
  if (textKey.endsWith("_PARTNER") && placeholders.length) parts.push(`${listed(placeholders)} are filled in from the deal.`);
  if (updatedBy && updatedBy !== "seed") parts.push(`Changed ${formatDate(updatedAt.slice(0, 10))} by ${updatedBy}`);
  return parts.join(" · ");
}
