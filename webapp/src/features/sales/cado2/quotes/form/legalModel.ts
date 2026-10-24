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

// The order form's legal sections for the wizard
// (2026-10-24), worked out exactly as the backend's legal package does, so
// the Legal step shows what will print:
//
//   Governing Terms  a block per product type: on-prem (PS) and SaaS (CL); the
//                standard text (direct or partner) or non-standard terms
//                Legal writes during their approval
//   Notices      those whose conditions match the deal
//
// Pure functions only, unit-tested.

import type {
  LegalView,
  LegalBlock,
  LegalConfig,
  LegalNoticeConfig,
  LegalNoticeOut,
  LegalSections,
} from "@features/sales/cado2/quotes/api/quoteTypes";
import { isEmptyLegalText, toLegalHtml } from "@features/sales/cado2/utils/legalRichText";

/** Salesforce classifications that decide the blocks (decided 2026-10-24). */
export const CLASS_SAAS = "CL";
export const CLASS_ONPREM = "PS";

/** The partner agreements Legal named; Admins can map more roles. */
/** The partner agreements the AM chooses from; the name prints as chosen (2026-10-24). */
export const CONTRACT_NAMES = ["Value Added Reseller", "Global System Integrator", "One Time Reseller"] as const;

/** The blocks the products call for: SaaS for CL, on-prem for PS; neither uses the on-prem terms. */
export function legalMix(classifications: readonly (string | null | undefined)[]): { onPrem: boolean; saas: boolean } {
  let onPrem = false;
  let saas = false;
  for (const c of classifications) {
    const k = (c ?? "").trim().toUpperCase();
    if (k === CLASS_SAAS) saas = true;
    if (k === CLASS_ONPREM) onPrem = true;
  }
  return { onPrem: onPrem || !saas, saas };
}

export interface LegalDeal {
  readonly onPrem: boolean;
  readonly saas: boolean;
  readonly partner: boolean;
  readonly region: string;
  /** FIRST_SALE, RENEWAL, EXPANSION. */
  readonly dealKind: string;
  readonly partnerName: string;
  /** The partner agreement the AM chose. */
  readonly contractName: string;
  /** YYYY-MM-DD, or "". */
  readonly contractDate: string;
}

export interface LegalChoice {
  readonly onPremNonStandard: boolean;
  readonly saasNonStandard: boolean;
}

const PLACEHOLDERS = ["CONTRACT_NAME", "PARTNER_NAME", "CONTRACT_DATE"];

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Fills a text's {PLACEHOLDER}s; an empty one shows as "[contract date]" so a gap is never silent. */
export function fillLegal(text: string, values: Readonly<Record<string, string>>): string {
  return text.replace(/\{([A-Z_]+)\}/g, (all, key: string) => {
    if (values[key]) return values[key];
    return PLACEHOLDERS.includes(key) ? `[${key.replace("_", " ").toLowerCase()}]` : all;
  });
}

/** "12 March 2024", as the backend writes it on the order form. */
function longDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

const matches = (list: readonly string[] | null, v: string) => !list || list.length === 0 || list.some((x) => x.toLowerCase() === v.toLowerCase());

const KIND_LABEL: Record<string, string> = { FIRST_SALE: "first sale", RENEWAL: "renewal", EXPANSION: "expansion" };

function reason(n: LegalNoticeConfig, d: LegalDeal): string {
  const bits: string[] = [];
  if (n.channels?.length === 1) bits.push(d.partner ? "partner deal" : "direct deal");
  if (n.regions?.length) bits.push(`region ${d.region}`);
  if (n.dealKinds?.length) bits.push(KIND_LABEL[d.dealKind] ?? d.dealKind);
  return bits.join(" · ");
}

/** Sections 04 and 05 for the deal; a non-standard block is empty: Legal writes it. */
export function resolveLegal(
  cfg: LegalConfig,
  d: LegalDeal,
  c: LegalChoice,
  { markFilled = false }: { markFilled?: boolean } = {},
): LegalSections {
  const contractName = d.contractName.trim();
  // The texts are rich text (HTML), so the values going in are escaped. On
  // the Legal step the deal's values are marked, so the AM can check them;
  // the mark is the screen's only, never printed.
  const deal = (v: string) => (v && markFilled ? `<mark>${v}</mark>` : v);
  const values: Record<string, string> = {
    CONTRACT_NAME: deal(escapeHtml(contractName)),
    PARTNER_NAME: deal(escapeHtml(d.partnerName)),
    CONTRACT_DATE: deal(longDate(d.contractDate)),
  };
  const block = (kind: "ONPREM" | "SAAS", nonStandard: boolean): LegalBlock => {
    if (nonStandard) return { kind, nonStandard: true, text: "" };
    const key = `TERMS_${kind}_${d.partner ? "PARTNER" : "DIRECT"}`;
    return { kind, nonStandard: false, text: fillLegal(toLegalHtml(cfg.texts[key] ?? ""), values) };
  };
  const blocks: LegalBlock[] = [];
  if (d.onPrem) blocks.push(block("ONPREM", c.onPremNonStandard));
  if (d.saas) blocks.push(block("SAAS", c.saasNonStandard));
  const channel = d.partner ? "PARTNER" : "DIRECT";
  const notices: LegalNoticeOut[] = cfg.notices
    .filter((n) => matches(n.channels, channel) && matches(n.regions, d.region) && matches(n.dealKinds, d.dealKind))
    .map((n) => ({ title: n.title, body: toLegalHtml(n.body), showTitle: n.showTitle, finePrint: n.finePrint, reason: reason(n, d) }));
  return { blocks, notices, contractName };
}

/** Whether a block on the quote is non-standard, so Legal must approve. */
export const needsLegal = (d: Pick<LegalDeal, "onPrem" | "saas">, c: LegalChoice) =>
  (d.onPrem && c.onPremNonStandard) || (d.saas && c.saasNonStandard);

/** A block's heading on the screens. */
export const BLOCK_TITLE: Record<"ONPREM" | "SAAS", string> = { ONPREM: "On-premises products", SAAS: "SaaS products" };

/** What still needs writing before Legal can approve; "" when nothing. */
export function legalApproveBlock(legal: LegalView | null | undefined): string {
  const missing = (legal?.sections.blocks ?? []).filter((b) => b.nonStandard && isEmptyLegalText(b.text)).map((b) => (b.kind === "SAAS" ? "SaaS" : "on-prem"));
  return missing.length ? `Write the ${missing.join(" and ")} terms` : "";
}
