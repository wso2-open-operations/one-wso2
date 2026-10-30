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

import { describe, expect, it } from "vitest";
import type { ApprovalMapping, CatalogProduct } from "@features/sales/cado2/approvals/api/approvalTypes";
import {
  blankMapping,
  duplicatePattern,
  duplicateRule,
  globMatch,
  globsOverlap,
  listOf,
  moves,
  patternClashes,
  winnerFor,
} from "./productMapping";

const rule = (classification: string, productUnit: string, groupCode: string): ApprovalMapping => ({
  ...blankMapping("RULE", groupCode),
  classification,
  productUnit,
});
const sku = (skuPattern: string, groupCode: string): ApprovalMapping => ({ ...blankMapping("SKU", groupCode), skuPattern });
const list = (ids: string[], groupCode: string): ApprovalMapping => ({
  ...blankMapping("PRODUCTS", groupCode),
  products: ids.map((id) => ({ id, name: id, code: "" })),
});
const p = (id: string, code: string, classification: string, productUnit: string): CatalogProduct => ({
  id,
  name: id,
  code,
  classification,
  productUnit,
});

// The FY26 split, as in the backend's tests.
const mappings: ApprovalMapping[] = [
  list(["01tLIST"], "SERVICES"), // 0
  sku("PC-*", "SAAS"), // 1
  sku("PC-IAM-*", "PLATFORM"), // 2
  rule("PS", "APIM", "PLATFORM"), // 3
  rule("CL", "APIM", "SAAS"), // 4
  rule("CO", "", "SERVICES"), // 5
  rule("", "APIM", "PLATFORM"), // 6
];

// D117: the same ranking as the backend.
describe("productMapping", () => {
  it("picks the most specific mapping", () => {
    expect(winnerFor(mappings, p("a", "P-API", "PS", "APIM"))).toBe(3);
    expect(winnerFor(mappings, p("b", "C-API", " cl ", "apim"))).toBe(4);
    expect(winnerFor(mappings, p("c", "PC-API-B", "PC", "APIM"))).toBe(1);
    expect(winnerFor(mappings, p("d", "pc-iam-base", "PC", "IAM"))).toBe(2);
    expect(winnerFor(mappings, p("01tLIST", "PC-API-B", "CL", "APIM"))).toBe(0);
    expect(winnerFor(mappings, p("e", "S-PS", "CO", "APIM"))).toBe(5);
    expect(winnerFor(mappings, p("f", "S-TAM-B", "TAM", "APIM"))).toBe(6);
    expect(winnerFor(mappings, p("g", "C-ASG", "CL", "Asgardeo"))).toBe(-1);
  });

  it("matches and overlaps patterns like the backend", () => {
    expect(globMatch("pc-*", "pc-api-b")).toBe(true);
    expect(globMatch("pc-*", "xpc-api")).toBe(false);
    expect(globMatch("*-gold", "pc-iam-golden")).toBe(false);
    expect(globMatch("a*b*c", "axxbyyc")).toBe(true);
    expect(globsOverlap("pc-*", "*-gold")).toBe(true);
    expect(globsOverlap("pc-api-*", "pc-iam-*")).toBe(false);
    expect(globsOverlap("*x", "*y")).toBe(false);
  });

  it("finds duplicates and clashes, ignoring case", () => {
    expect(duplicateRule(mappings, rule("ps", " apim", "SAAS"), -1)).toBe(3);
    expect(duplicateRule(mappings, rule("ps", "apim", "SAAS"), 3)).toBe(-1);
    expect(duplicatePattern(mappings, sku("pc-**", "SAAS"), -1)).toBe(1);
    expect(patternClashes(mappings, sku("*-GO", "SERVICES"), -1)).toEqual([1]);
    expect(patternClashes(mappings, sku("*-GO", "SAAS"), -1)).toEqual([]);
    expect(listOf(mappings, "01tLIST", -1)).toBe(0);
    expect(listOf(mappings, "01tLIST", 0)).toBe(-1);
  });

  it("says where products fall back to without a mapping", () => {
    const covered = [p("c", "PC-API-B", "PC", "APIM"), p("h", "PC-X", "PC", "IOT")];
    const without = mappings.filter((_, i) => i !== 1);
    expect(moves(covered, without)).toEqual({ to: [{ index: 5, count: 1 }], uncovered: 1 });
  });
});
