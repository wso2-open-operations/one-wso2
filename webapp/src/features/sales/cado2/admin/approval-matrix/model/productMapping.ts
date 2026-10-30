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

// Product mapping (D117), the same rules as the backend's approval/mapping.go,
// so what the admin page counts and warns about is what QuickQuote does:
//
//   1 product list   >   2 SKU pattern (more fixed characters first)
//   > 3 classification + product unit   > classification only   > product unit only
//
// The backend checks everything again on save.

import type { ApprovalMapping, CatalogProduct } from "@features/sales/cado2/approvals/api/approvalTypes";

/** A classification or product unit, comparable: case and spaces ignored. */
export const normaliseValue = (v: string): string => v.trim().toLowerCase();

/** A SKU pattern, comparable: lower-cased, runs of * folded into one. */
export const normaliseSku = (v: string): string => v.trim().toLowerCase().replace(/\*+/g, "*");

/** How specific a mapping is: lower tier wins; within SKU, a higher weight. */
function rank(m: ApprovalMapping): [tier: number, weight: number] {
  if (m.kind === "PRODUCTS") return [0, 0];
  if (m.kind === "SKU") return [1, normaliseSku(m.skuPattern).replace(/\*/g, "").length];
  const c = normaliseValue(m.classification) !== "";
  const u = normaliseValue(m.productUnit) !== "";
  return c && u ? [2, 0] : c ? [3, 0] : [4, 0];
}

/** Whether a is more specific than b. */
export function beats(a: ApprovalMapping, b: ApprovalMapping): boolean {
  const [at, aw] = rank(a);
  const [bt, bw] = rank(b);
  return at < bt || (at === bt && aw > bw);
}

/** Whether s matches the whole pattern p (both normalised); * = any run. */
export function globMatch(p: string, s: string): boolean {
  let pi = 0;
  let si = 0;
  let star = -1;
  let mark = 0;
  while (si < s.length) {
    if (pi < p.length && p[pi] === "*") {
      star = pi++;
      mark = si;
    } else if (pi < p.length && p[pi] === s[si]) {
      pi++;
      si++;
    } else if (star >= 0) {
      pi = star + 1;
      si = ++mark;
    } else {
      return false;
    }
  }
  while (pi < p.length && p[pi] === "*") pi++;
  return pi === p.length;
}

/** Whether some product code could match both patterns (normalised). */
export function globsOverlap(a: string, b: string): boolean {
  const seen = new Set<string>();
  const walk = (i: number, j: number): boolean => {
    const k = `${i},${j}`;
    if (seen.has(k)) return false;
    seen.add(k);
    if (i === a.length && j === b.length) return true;
    if (i < a.length && a[i] === "*" && (walk(i + 1, j) || (j < b.length && walk(i, j + 1)))) return true;
    if (j < b.length && b[j] === "*" && (walk(i, j + 1) || (i < a.length && walk(i + 1, j)))) return true;
    return i < a.length && j < b.length && a[i] !== "*" && b[j] !== "*" && a[i] === b[j] && walk(i + 1, j + 1);
  };
  return walk(0, 0);
}

/** Whether the mapping covers the product. */
export function matches(m: ApprovalMapping, p: CatalogProduct): boolean {
  if (m.kind === "PRODUCTS") return m.products.some((x) => x.id === p.id);
  if (m.kind === "SKU") return p.code !== "" && globMatch(normaliseSku(m.skuPattern), p.code.trim().toLowerCase());
  const c = normaliseValue(m.classification);
  const u = normaliseValue(m.productUnit);
  if (!c && !u) return false;
  return (!c || c === normaliseValue(p.classification)) && (!u || u === normaliseValue(p.productUnit));
}

/** The index of the most specific mapping covering the product, or -1; the earlier wins a tie. */
export function winnerFor(mappings: readonly ApprovalMapping[], p: CatalogProduct): number {
  let best = -1;
  mappings.forEach((m, i) => {
    if (matches(m, p) && (best < 0 || beats(m, mappings[best]))) best = i;
  });
  return best;
}

/** The products a mapping matches today. */
export const matchedBy = (m: ApprovalMapping, catalog: readonly CatalogProduct[]): CatalogProduct[] =>
  catalog.filter((p) => matches(m, p));

/** "PC-*", "CL + APIM", "Classification CO", "Product Unit APIM", "3 products". */
export function mappingLabel(m: ApprovalMapping): string {
  if (m.kind === "PRODUCTS") return m.products.length === 1 ? m.products[0].name || m.products[0].id : `a list of ${m.products.length} products`;
  if (m.kind === "SKU") return `pattern ${m.skuPattern}`;
  const c = m.classification.trim();
  const u = m.productUnit.trim();
  if (c && u) return `Classification ${c} + Product Unit ${u}`;
  return c ? `Classification ${c}` : `Product Unit ${u}`;
}

/** The rule already there for the same classification and unit, or -1 (ignoring `except`). */
export function duplicateRule(mappings: readonly ApprovalMapping[], m: ApprovalMapping, except: number): number {
  const key = `${normaliseValue(m.classification)}|${normaliseValue(m.productUnit)}`;
  return mappings.findIndex(
    (o, i) => i !== except && o.kind === "RULE" && `${normaliseValue(o.classification)}|${normaliseValue(o.productUnit)}` === key,
  );
}

/** The same pattern already there, or -1. */
export function duplicatePattern(mappings: readonly ApprovalMapping[], m: ApprovalMapping, except: number): number {
  const v = normaliseSku(m.skuPattern);
  return mappings.findIndex((o, i) => i !== except && o.kind === "SKU" && normaliseSku(o.skuPattern) === v);
}

/**
 * Patterns that tie with m (as specific, can match the same code) but point
 * to another group: saving them together is refused.
 */
export function patternClashes(mappings: readonly ApprovalMapping[], m: ApprovalMapping, except: number): number[] {
  const v = normaliseSku(m.skuPattern);
  const [, w] = rank(m);
  const out: number[] = [];
  mappings.forEach((o, i) => {
    if (i === except || o.kind !== "SKU" || o.groupCode === m.groupCode) return;
    if (rank(o)[1] === w && globsOverlap(normaliseSku(o.skuPattern), v)) out.push(i);
  });
  return out;
}

/** The product list (index) a product is already in, other than `except`, or -1. */
export function listOf(mappings: readonly ApprovalMapping[], productId: string, except: number): number {
  return mappings.findIndex((o, i) => i !== except && o.kind === "PRODUCTS" && o.products.some((p) => p.id === productId));
}

/**
 * Where the products a mapping covers today would go: for each other mapping
 * that would cover some of them, how many; and how many nothing covers.
 * Used for "N of these move here from …" (adding) and "fall back to …"
 * (removing): `next` is the matrix after the change.
 */
export function moves(
  products: readonly CatalogProduct[],
  next: readonly ApprovalMapping[],
): { to: { index: number; count: number }[]; uncovered: number } {
  const counts = new Map<number, number>();
  let uncovered = 0;
  for (const p of products) {
    const w = winnerFor(next, p);
    if (w < 0) uncovered++;
    else counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return { to: [...counts].map(([index, count]) => ({ index, count })).sort((a, b) => b.count - a.count), uncovered };
}

/** An empty mapping of a kind. */
export function blankMapping(kind: ApprovalMapping["kind"], groupCode: string): ApprovalMapping {
  return { kind, products: [], skuPattern: "", classification: "", productUnit: "", groupCode };
}
