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
import type { ReviewNote } from "@features/sales/cado2/approvals/api/approvalTypes";
import { noteText, stateLabel } from "./reviewNotes";

const note = (over: Partial<ReviewNote>): ReviewNote => ({
  key: "DISCOUNT.L2", rule: "DISCOUNT", lineNumber: 2,
  reasons: ["Year 1 · line 2 · WSO2 API Manager (APIM): 18% discount is above the Account Manager's 15% limit"],
  roles: ["Regional Director · NA"], target: "line:2", yoursToWrite: false, state: "OPEN", ...over,
});

// D129: a note's words, from the rule sentences.
describe("noteText", () => {
  it("leads a discount with its figure and names who approves it", () => {
    expect(noteText(note({}), "DEAL_DESK")).toEqual({
      title: "18% discount",
      detail: "Above the Account Manager's 15% limit",
      who: "Regional Director · NA approves after you",
    });
    expect(noteText(note({ roles: ["Regional Director · NA", "CFO"] }), "DEAL_DESK").who).toBe("Regional Director · NA and CFO approve after you");
  });

  it("words Deal Desk's own checks and what is written, not marked", () => {
    expect(noteText(note({ rule: "RENEWAL_START", lineNumber: 0, roles: [], reasons: ["Starts 1 Mar 2027, not 1 Feb 2027, the day after APIM ends"] }), "DEAL_DESK").title)
      .toBe("Start date");
    expect(noteText(note({ rule: "GOVERNING_TERMS", lineNumber: 0, roles: [], yoursToWrite: true }), "LEGAL").who).toBe("Yours to write");
    // D139: the AM's special terms, for Deal Desk to check.
    expect(noteText(note({ rule: "SPECIAL_TERMS", lineNumber: 0, roles: ["Legal"], reasons: ["The quote includes special terms"] }), "DEAL_DESK"))
      .toEqual({ title: "Special terms from the AM", detail: "Check them, override if needed", who: "Legal approves after you" });
    expect(noteText(note({ rule: "SPECIAL_TERMS", lineNumber: 0, roles: [], reasons: ["The quote includes special terms"] }), "LEGAL"))
      .toEqual({ title: "Special terms", detail: "The quote includes special terms", who: "Why you're asked" });
    // D155: a year's support plan, warned to the AM, checked by Deal Desk.
    const support = "Year 1 has no support plan. Check the customer's support (a renewal may keep a legacy plan).";
    expect(noteText(note({ rule: "SUPPORT_PLAN", lineNumber: 0, roles: [], reasons: [support] }), "DEAL_DESK")).toEqual({
      title: "Support plan",
      detail: support,
      who: "Only Deal Desk checks this",
    });
    // D171: a line charged other than its list price.
    const price = "Year 1 · line 3 · Product Specialist (12 months on-site): sales price USD 71825.00, below the list price USD 287300.00 (allowed on Professional Services lines). Check it's right.";
    expect(noteText(note({ rule: "SALES_PRICE", lineNumber: 3, roles: [], reasons: [price] }), "DEAL_DESK")).toEqual({
      title: "Sales price changed",
      detail: price,
      who: "Only Deal Desk checks this",
    });
    const legacy = "Line 2 · WSO2 Premium Support (2019): a support product that isn't on Admin → Support Plans (legacy support). Check it's still right for this customer.";
    expect(noteText(note({ rule: "LEGACY_SUPPORT", lineNumber: 2, roles: [], reasons: [legacy] }), "DEAL_DESK")).toEqual({
      title: "Legacy support",
      detail: legacy,
      who: "Only Deal Desk checks this",
    });
  });
});

// D140: no marks; a note to write says when it's written.
describe("stateLabel", () => {
  it("says Written for a note to write once done, and nothing otherwise", () => {
    expect(stateLabel(note({}))).toBe("");
    expect(stateLabel(note({ yoursToWrite: true }))).toBe("");
    expect(stateLabel(note({ yoursToWrite: true, state: "DONE" }))).toBe("Written");
  });
});
