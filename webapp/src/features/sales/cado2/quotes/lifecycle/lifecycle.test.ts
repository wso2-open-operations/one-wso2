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
import type { AuditEvent, DraftResponse } from "@features/sales/cado2/quotes/api/quoteTypes";
import { gateway, ready } from "@features/sales/cado2/quotes/testing/fixtures";
import { compareVersions, describeEvent, groupHistory, quoteLabel, quoteStatusLabel } from "./lifecycle";

const v2: DraftResponse = {
  ...ready,
  version: {
    ...ready.version,
    versionNumber: 2,
    poNumber: "PO-9",
    lines: [
      { ...gateway, quantity: 30, discretionaryDiscountPercent: "12.00", annualNet: "9504.00" },
      { ...gateway, id: 52, pricebookEntryId: "01u000000000002", productName: "WSO2 Support", quantity: 1, unitPrice: "25000", discretionaryDiscountPercent: "0.00" },
    ],
    totals: { arr: "34504.00", acv: "34504.00", tcv: "34504.00" },
  },
};

describe("compareVersions", () => {
  const rows = compareVersions(ready, v2);
  const row = (label: string) => rows.find((r) => r.label === label);

  it("marks changed fields and leaves the rest the same", () => {
    expect(row("WSO2 Gateway · Quantity")).toMatchObject({ from: "20", to: "30", change: "changed" });
    expect(row("WSO2 Gateway · Discount")).toMatchObject({ from: "10%", to: "12%", change: "changed" });
    expect(row("PO number")).toMatchObject({ from: "–", to: "PO-9", change: "changed" });
    expect(row("TCV")).toMatchObject({ from: "6,480.00", to: "34,504.00", change: "changed" });
    expect(row("Currency")?.change).toBe("same");
    expect(row("WSO2 Gateway · Unit price")?.change).toBe("same");
  });

  it("matches lines by product and shows added and removed ones", () => {
    expect(row("WSO2 Support")).toMatchObject({ from: "–", to: "1 × USD 25,000", change: "added" });
    const back = compareVersions(v2, ready);
    expect(back.find((r) => r.label === "WSO2 Support")).toMatchObject({ change: "removed" });
  });

  // The partner agreement is compared, special terms as
  // their words, and the Legal rows come after the Commercials ones.
  it("compares the legal sections as they read", () => {
    const a = { ...ready, version: { ...ready.version, partnerContractName: "Value Added Reseller", specialTerms: { enabled: true, text: "<p>Net <strong>45</strong></p>" } } };
    const b = { ...ready, version: { ...ready.version, partnerContractName: "One Time Reseller", specialTerms: { enabled: true, text: "<p>Net 60</p>" } } };
    const legal = compareVersions(a as DraftResponse, b as DraftResponse);
    expect(legal.find((r) => r.label === "Partner agreement")).toMatchObject({ from: "Value Added Reseller", to: "One Time Reseller", change: "changed" });
    expect(legal.find((r) => r.label === "Special terms")).toMatchObject({ from: "Net 45", to: "Net 60" });
    const sections = legal.map((r) => r.section).filter((s, i, all) => all.indexOf(s) === i);
    expect(sections.indexOf("Legal")).toBe(sections.indexOf("Commercials") + 1);
  });

  it("finds nothing to report between identical versions", () => {
    expect(compareVersions(ready, ready).every((r) => r.change === "same")).toBe(true);
  });
});

const event = (over: Partial<AuditEvent>): AuditEvent => ({
  id: 1,
  eventType: "DRAFT_SAVED",
  versionNumber: 1,
  actorEmail: "rep@wso2.com",
  occurredAt: "2026-09-25T10:00:00Z",
  fromStatus: null,
  toStatus: null,
  comment: null,
  metadata: null,
  ...over,
});

describe("history", () => {
  it("groups consecutive saves by the same person on the same version", () => {
    const entries = groupHistory([
      event({ id: 1, eventType: "QUOTE_CREATED" }),
      event({ id: 2 }),
      event({ id: 3 }),
      event({ id: 4, occurredAt: "2026-09-25T11:00:00Z" }),
      event({ id: 5, actorEmail: "other@wso2.com" }),
      event({ id: 6, eventType: "VERSION_SUBMITTED", metadata: { expiryDate: "2026-10-31" } }),
    ]);
    expect(entries.map((e) => [e.event.id, e.count])).toEqual([[1, 1], [4, 3], [5, 1], [6, 1]]);
    expect(describeEvent(entries[1])).toBe("Version 1 draft saved ×3");
    expect(describeEvent(entries[3])).toBe("Version 1 submitted · expires 31 Oct 2026");
  });

  it("says which draft was deleted", () => {
    const e = event({ eventType: "VERSION_DELETED", versionNumber: null, metadata: { versionNumber: 2 } });
    expect(describeEvent({ event: e, count: 1 })).toBe("Version 2 draft deleted");
  });

  // D120: Deal Desk approving for an approver who was away.
  it("says Deal Desk approved on someone's behalf", () => {
    expect(describeEvent({ event: event({ eventType: "APPROVAL_APPROVED_ON_BEHALF", metadata: { role: "AREA_GM" } }), count: 1 })).toBe(
      "Deal Desk approved version 1 on behalf of Area GM",
    );
  });

  // D119: an approval kept from an earlier version on a resubmission.
  it("says whose approval carried over, and from which version", () => {
    expect(describeEvent({ event: event({ eventType: "APPROVAL_CARRIED_OVER", metadata: { role: "CFO", fromVersion: 1 } }), count: 1 })).toBe(
      "CFO's approval carried over from version 1",
    );
  });

  // DGD-10: the documents added after the order form.
  it("names the supporting documents after a change", () => {
    expect(
      describeEvent({ event: event({ eventType: "SUPPORTING_DOCUMENTS_CHANGED", metadata: { before: [], after: ["Support Policy", "Security Overview"] } }), count: 1 }),
    ).toBe("Supporting documents changed: Support Policy, Security Overview");
    expect(describeEvent({ event: event({ eventType: "SUPPORTING_DOCUMENTS_CHANGED", metadata: { before: ["Support Policy"], after: [] } }), count: 1 })).toBe(
      "Supporting documents removed",
    );
  });

  // D111: the order form on the Salesforce opportunity.
  it("says what happened to the order form in Salesforce", () => {
    expect(describeEvent({ event: event({ eventType: "ORDER_FORM_ATTACHED" }), count: 1 })).toBe("Order form attached to Salesforce");
    expect(describeEvent({ event: event({ eventType: "ORDER_FORM_DETACHED", metadata: { replacedBy: "Q-26-00007-v1-d1.pdf" } }), count: 1 })).toBe(
      "Order form removed from Salesforce, replaced by Q-26-00007-v1-d1.pdf",
    );
    expect(describeEvent({ event: event({ eventType: "ORDER_FORM_ATTACH_FAILED", metadata: { action: "attach" } }), count: 1 })).toBe(
      "Couldn't attach the order form to Salesforce",
    );
    expect(describeEvent({ event: event({ eventType: "ORDER_FORM_ATTACH_FAILED", metadata: { action: "remove" } }), count: 1 })).toBe(
      "Couldn't remove the order form from Salesforce",
    );
  });

  it("says which quote a clone came from", () => {
    const e = event({ eventType: "QUOTE_CREATED", metadata: { clonedFrom: { quoteId: 3, quoteNumber: "Q-26-00003", versionNumber: 2 } } });
    expect(describeEvent({ event: e, count: 1 })).toBe("Quote created (cloned from Q-26-00003 v2)");
  });

  it("says where a revision came from", () => {
    const e = event({ eventType: "VERSION_CREATED", versionNumber: 2, metadata: { copiedFromVersion: 1 } });
    expect(describeEvent({ event: e, count: 1 })).toBe("Version 2 created (revised from v1)");
  });
});

describe("quoteStatusLabel", () => {
  it("shows the latest version's status, naming a later draft's version", () => {
    expect(quoteStatusLabel("DRAFT", 1)).toBe("Draft");
    expect(quoteStatusLabel("DRAFT", 2)).toBe("Draft (v2)");
    expect(quoteStatusLabel("RECALLED", 1)).toBe("Recalled");
  });
});

describe("quoteLabel", () => {
  it("is the number once submitted, else the customer and deal", () => {
    expect(quoteLabel("Q-26-00184", "Acme Corp", "APIM renewal")).toBe("Q-26-00184");
    expect(quoteLabel(null, "Acme Corp", "APIM renewal")).toBe("Acme Corp · APIM renewal");
    expect(quoteLabel(null, "Acme Corp", null)).toBe("Acme Corp");
    expect(quoteLabel(null, null, null)).toBe("Draft quote");
  });
});


// D77: each sync to Salesforce, and each refusal with its reason.
describe("Salesforce sync history", () => {
  it("says what changed in Salesforce, or why it refused", () => {
    const synced = event({ eventType: "QUOTE_SYNCED", metadata: { version: 1, added: 1, updated: 2, removed: 0 } });
    expect(describeEvent({ event: synced, count: 1 })).toBe("Version 1 synced to Salesforce · 2 updated, 1 added, 0 removed");
    const refused = event({ eventType: "QUOTE_SYNC_FAILED", metadata: { reasons: ["Closed Won opportunities can't be edited"] } });
    expect(describeEvent({ event: refused, count: 1 })).toBe(
      "Salesforce refused the sync of version 1: Closed Won opportunities can't be edited",
    );
  });
});
