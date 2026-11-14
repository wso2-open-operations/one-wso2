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
// Admin change logs (D172): what an Admin changed in settings that keep no
// history of their own, with what it was before and after. Pure functions,
// unit-tested.

/** One change, as GET /admin/…/changes returns it; before is null when created, after when deleted. */
export interface AdminChange {
  readonly id: number;
  readonly area: string;
  readonly item: string;
  readonly action: "CREATED" | "CHANGED" | "DELETED";
  readonly before: unknown;
  readonly after: unknown;
  readonly changedByEmail: string;
  readonly changedAt: string;
}

export const ACTION_LABEL: Record<AdminChange["action"], string> = {
  CREATED: "Created",
  CHANGED: "Changed",
  DELETED: "Deleted",
};

/** A volume discount table as the log keeps it. */
interface VolumeSnapshot {
  readonly name: string;
  readonly products: readonly string[];
  readonly tiers: readonly { readonly fromQuantity: number; readonly ceilingPercent: string }[];
}

const asVolume = (v: unknown): VolumeSnapshot | null => (v && typeof v === "object" ? (v as VolumeSnapshot) : null);
const pct = (v: string) => `${Number(v).toFixed(2)}%`;

/** The table's name, as it is now or was when deleted. */
export function volumeTitle(c: AdminChange): string {
  return asVolume(c.after)?.name ?? asVolume(c.before)?.name ?? `Table ${c.item}`;
}

/**
 * What changed in a volume discount table, one line each:
 *   "Name: Gateway → API Gateway"
 *   "Products added: C-API-PORTAL"
 *   "From 101: 27.34% → 40.00%"
 *   "From 501: added at 30.00%"
 */
export function volumeChangeLines(c: AdminChange): string[] {
  const before = asVolume(c.before);
  const after = asVolume(c.after);
  if (!before && after) return [`${after.tiers.length} tiers, products ${after.products.join(", ") || "none"}`];
  if (before && !after) return [`Had ${before.tiers.length} tiers, products ${before.products.join(", ") || "none"}`];
  if (!before || !after) return [];
  const lines: string[] = [];
  if (before.name !== after.name) lines.push(`Name: ${before.name} → ${after.name}`);
  const added = after.products.filter((p) => !before.products.includes(p));
  const removed = before.products.filter((p) => !after.products.includes(p));
  if (added.length) lines.push(`Products added: ${added.join(", ")}`);
  if (removed.length) lines.push(`Products removed: ${removed.join(", ")}`);
  const was = new Map(before.tiers.map((t) => [t.fromQuantity, t.ceilingPercent]));
  const now = new Map(after.tiers.map((t) => [t.fromQuantity, t.ceilingPercent]));
  const starts = [...new Set([...was.keys(), ...now.keys()])].sort((a, b) => a - b);
  for (const from of starts) {
    const b = was.get(from);
    const a = now.get(from);
    if (b !== undefined && a !== undefined && Number(b) !== Number(a)) lines.push(`From ${from}: ${pct(b)} → ${pct(a)}`);
    else if (b === undefined && a !== undefined) lines.push(`From ${from}: added at ${pct(a)}`);
    else if (b !== undefined && a === undefined) lines.push(`From ${from}: removed (was ${pct(b)})`);
  }
  return lines;
}

/** A legal text or notice as the log keeps it: its body, and a notice's title. */
interface LegalSnapshot {
  readonly body?: string;
  readonly title?: string;
}

const asLegal = (v: unknown): LegalSnapshot | null => (v && typeof v === "object" ? (v as LegalSnapshot) : null);

/** A legal change's name: the text's label, or the notice's title. */
export function legalTitle(c: AdminChange, textLabel: (key: string) => string): string {
  if (c.area === "LEGAL_TEXT") return textLabel(c.item);
  return `Notice: ${asLegal(c.after)?.title ?? asLegal(c.before)?.title ?? c.item}`;
}

/** A legal text's or notice's wording before and after (null when created or deleted). */
export function legalBodies(c: AdminChange): { before: string | null; after: string | null } {
  return { before: asLegal(c.before)?.body ?? null, after: asLegal(c.after)?.body ?? null };
}
