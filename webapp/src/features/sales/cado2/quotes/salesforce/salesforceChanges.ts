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
// Salesforce changes (D173): how Salesforce differs from a draft, in words.
// Pure functions, unit-tested.

import type { SalesforceChange } from "@features/sales/cado2/quotes/api/quoteTypes";

const GROUPS: readonly { readonly group: SalesforceChange["group"]; readonly label: string }[] = [
  { group: "ACCOUNT", label: "Account" },
  { group: "OPPORTUNITY", label: "Opportunity" },
  { group: "PREVIOUS_OPPORTUNITY", label: "Previous opportunities" },
  { group: "CONTACT", label: "Contacts" },
  { group: "PRODUCT", label: "Products" },
];

/** The changes by where the detail lives, in a fixed order, empty groups left out. */
export function groupChanges(
  changes: readonly SalesforceChange[],
): { readonly label: string; readonly changes: readonly SalesforceChange[] }[] {
  return GROUPS.map((g) => ({ label: g.label, changes: changes.filter((c) => c.group === g.group) })).filter(
    (g) => g.changes.length > 0,
  );
}

/** A change's name: "Sales region", or "WSO2 Gateway · list price" within a subject. */
export function changeLabel(c: SalesforceChange): string {
  return c.subject ? `${c.subject} · ${c.field.charAt(0).toLowerCase()}${c.field.slice(1)}` : c.field;
}

/** A value as shown: "—" when there is none. */
export const shown = (v: string | null): string => (v === null || v === "" ? "—" : v);

/** One line per change taken, for the banner: "Sales region NA → EU". */
export function changeLine(c: SalesforceChange): string {
  return `${changeLabel(c)}: ${shown(c.before)} → ${shown(c.after)}`;
}
