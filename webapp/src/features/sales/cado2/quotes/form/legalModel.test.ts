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
import type { LegalConfig } from "@features/sales/cado2/quotes/api/quoteTypes";
import { fillLegal, legalApproveBlock, legalMix, needsLegal, resolveLegal, type LegalDeal } from "./legalModel";

const cfg: LegalConfig = {
  texts: {
    TERMS_ONPREM_DIRECT: '<p>Governed by this Order Form and <a href="https://wso2.com/licenses/eula/3.6">WSO2 Software License</a>.</p>',
    TERMS_ONPREM_PARTNER: "Governed by the {CONTRACT_NAME} between WSO2, LLC and {PARTNER_NAME} dated {CONTRACT_DATE}.",
    TERMS_SAAS_DIRECT: "SaaS terms.",
    TERMS_SAAS_PARTNER: "SaaS terms under the {CONTRACT_NAME}.",
  },
  notices: [
    { id: 1, title: "Additional capacity", body: "capacity", showTitle: false, finePrint: false, channels: null, regions: null, dealKinds: null },
    { id: 2, title: "Auto Renewal", body: "renewal", showTitle: true, finePrint: false, channels: ["PARTNER"], regions: null, dealKinds: null },
    { id: 3, title: "MEA new", body: "mea", showTitle: true, finePrint: false, channels: ["PARTNER"], regions: ["ME", "AFRICA"], dealKinds: ["FIRST_SALE"] },
    { id: 4, title: "Middle East", body: "me", showTitle: true, finePrint: false, channels: ["PARTNER"], regions: ["ME"], dealKinds: null },
  ],
};

const direct: LegalDeal = {
  onPrem: true, saas: false, partner: false, region: "NA", dealKind: "FIRST_SALE",
  partnerName: "", contractName: "", contractDate: "",
};
const std = { onPremNonStandard: false, saasNonStandard: false };

// Legal terms (2026-10-24), as the backend's legal package.
describe("legalModel", () => {
  it("tells the blocks from the classifications: CL is SaaS, PS on-prem, neither is on-prem", () => {
    expect(legalMix(["PS", "CO"])).toEqual({ onPrem: true, saas: false });
    expect(legalMix(["CL"])).toEqual({ onPrem: false, saas: true });
    expect(legalMix(["ps", "cl"])).toEqual({ onPrem: true, saas: true });
    expect(legalMix(["CO", ""])).toEqual({ onPrem: true, saas: false });
  });

  it("gives a direct deal's on-prem terms with their EULA link", () => {
    const s = resolveLegal(cfg, direct, std);
    expect(s.blocks).toEqual([{ kind: "ONPREM", nonStandard: false, text: '<p>Governed by this Order Form and <a href="https://wso2.com/licenses/eula/3.6" target="_blank" rel="noopener">WSO2 Software License</a>.</p>' }]);
    expect(s.notices.map((n) => n.title)).toEqual(["Additional capacity"]);
  });

  it("fills the partner agreement and adds the partner and regional notices, each saying why", () => {
    const s = resolveLegal(
      cfg,
      { ...direct, saas: true, partner: true, region: "ME", contractName: "Value Added Reseller", partnerName: "Acme Reseller", contractDate: "2024-03-12" },
      std,
    );
    expect(s.blocks[0].text).toBe("<p>Governed by the Value Added Reseller between WSO2, LLC and Acme Reseller dated 12 March 2024.</p>");
    expect(s.blocks[1].text).toBe("<p>SaaS terms under the Value Added Reseller.</p>");
    expect(s.notices).toHaveLength(4);
    expect(s.notices[2].reason).toBe("partner deal · region ME · first sale");
    expect(s.contractName).toBe("Value Added Reseller"); // printed as chosen
  });

  it("marks the deal's values only when asked (the Legal step's preview)", () => {
    const deal = { ...direct, partner: true, contractName: "Value Added Reseller", partnerName: "Acme Reseller", contractDate: "2024-03-12" };
    expect(resolveLegal(cfg, deal, std, { markFilled: true }).blocks[0].text).toContain("<mark>Acme Reseller</mark> dated <mark>12 March 2024</mark>");
    expect(resolveLegal(cfg, deal, std).blocks[0].text).not.toContain("<mark>");
  });

  it("escapes a value going into a rich text", () => {
    const s = resolveLegal(cfg, { ...direct, partner: true, contractName: "Value Added Reseller", partnerName: "Acme <b>& Co</b>" }, std);
    expect(s.blocks[0].text).toContain("Acme &lt;b&gt;&amp; Co&lt;/b&gt;");
  });

  it("never leaves a gap silent until the AM chooses the agreement", () => {
    const deal = { ...direct, partner: true, region: "AFRICA", dealKind: "RENEWAL", partnerName: "Acme" };
    expect(resolveLegal(cfg, deal, std).blocks[0].text).toContain("the [contract name] between");
    expect(resolveLegal(cfg, deal, std).notices.map((n) => n.title)).toEqual(["Additional capacity", "Auto Renewal"]);
    expect(resolveLegal(cfg, { ...deal, contractName: "One Time Reseller" }, std).blocks[0].text).toContain("the One Time Reseller between");
    expect(fillLegal("a {not one} b", {})).toBe("a {not one} b");
  });

  it("leaves a non-standard block for Legal, and counts it only for a product type on the quote", () => {
    const s = resolveLegal(cfg, { ...direct, saas: true }, { onPremNonStandard: false, saasNonStandard: true });
    expect(s.blocks[1]).toEqual({ kind: "SAAS", nonStandard: true, text: "" });
    expect(needsLegal({ onPrem: true, saas: true }, { onPremNonStandard: false, saasNonStandard: true })).toBe(true);
    expect(needsLegal({ onPrem: true, saas: false }, { onPremNonStandard: false, saasNonStandard: true })).toBe(false);
  });

  it("holds Legal's approval until every non-standard block is written", () => {
    const view = (text: string) =>
      ({ sections: { blocks: [{ kind: "SAAS", nonStandard: true, text }] } }) as unknown as Parameters<typeof legalApproveBlock>[0];
    expect(legalApproveBlock(view(""))).toBe("Write the SaaS terms");
    expect(legalApproveBlock(view("Bespoke."))).toBe("");
    expect(legalApproveBlock(null)).toBe("");
  });
});
