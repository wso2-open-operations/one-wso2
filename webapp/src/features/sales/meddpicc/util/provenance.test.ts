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
import { callsBehind, explainProposal, groupBySource } from "./provenance";
import { detail, field, quote } from "./callInsight.fixtures";

const email = quote({
  meetingId: 0,
  meetingTitle: "",
  speaker: "Ingrid Solberg",
  quote: "Anything over 200k is mine to sign.",
  offsetSeconds: 0,
  source: { type: "EMAIL", id: "02s1", title: "Re: budget", occurredAt: "2026-10-02T09:00:00Z", url: "https://sf/02s1" },
  authorRole: "CUSTOMER",
});
const later = quote({ offsetSeconds: 900, quote: "Ingrid signs it.", authorRole: "WSO2" });
const earlier = quote({ offsetSeconds: 120, quote: "Lars, who signs?", authorRole: "WSO2" });

describe("groupBySource", () => {
  it("groups quotes by the call or record they were said in, newest source first, each in the order said", () => {
    const groups = groupBySource([later, email, earlier]);
    expect(groups.map((g) => g.source.title)).toEqual(["Re: budget", "Nordlys – budget sign-off"]);
    expect(groups[1]?.quotes.map((q) => q.offsetSeconds)).toEqual([120, 900]);
  });
});

describe("callsBehind", () => {
  it("splits the deal's calls into the ones the evidence came from and the ones that said nothing", () => {
    const { contributed, silent } = callsBehind(field(), detail());
    expect(contributed.map((c) => c.meetingId)).toEqual([22]);
    expect(silent.map((c) => c.meetingId)).toEqual([21]);
  });
});

describe("explainProposal", () => {
  it("says where a differing suggestion came from, who said it, how sure the AI is, and what Salesforce has", () => {
    const f = field({
      salesforceValue: "Lars Haugen",
      proposal: { value: "Ingrid Solberg", rationale: null, confidence: 0.86, evidence: [later, email], pending: true },
    });
    expect(explainProposal(f, detail())).toEqual([
      "Backed by 2 quotes from 1 call, 1 email, shown below word for word.",
      "At least one quote is the customer's own words.",
      "Where sources disagree, the newer one weighs more.",
      "The AI's confidence is high (86%).",
      "It differs from what Salesforce has (Lars Haugen), so it waits for your approval.",
      "One other analysed call on this deal did not mention it.",
    ]);
  });

  it("says when nothing is the customer's own words, and when Salesforce is empty or agrees", () => {
    const wso2Only = field({ proposal: { value: "Ingrid", rationale: null, confidence: 0.55, evidence: [earlier], pending: true } });
    expect(explainProposal(wso2Only, detail())).toContain(
      "No quote is the customer's own words: this is WSO2's account of the customer, not the customer's.",
    );
    expect(explainProposal(wso2Only, detail())).toContain("The AI's confidence is low (55%).");
    expect(explainProposal(wso2Only, detail())).toContain("Salesforce has nothing for this field, so the suggestion would fill it.");

    const agrees = field({
      salesforceValue: "Ingrid Solberg",
      proposal: { value: "Ingrid Solberg", rationale: null, confidence: 0.9, evidence: [email], pending: false },
    });
    expect(explainProposal(agrees, detail())).toContain("It matches what Salesforce has, so there is nothing to approve.");

    // Settled, then Salesforce changed: not pending, yet the two no longer match.
    const movedOn = field({
      salesforceValue: "Lars Haugen",
      proposal: { value: "Ingrid Solberg", rationale: null, confidence: 0.9, evidence: [email], pending: false },
    });
    expect(explainProposal(movedOn, detail())).toContain(
      "Salesforce now holds Lars Haugen, changed since this was settled; the calls heard Ingrid Solberg, and there is nothing to approve.",
    );
    expect(explainProposal(movedOn, detail())).not.toContain("It matches what Salesforce has, so there is nothing to approve.");

    // A role is the same person by Contact: Salesforce holds the name alone, the calls add a title.
    const heldRole = field({
      kind: "role",
      salesforceValue: { contactId: "003A", name: "Ingrid Solberg" },
      proposal: {
        value: { name: "Ingrid Solberg", title: "CFO", suggestedContactId: "003A", candidates: [] },
        rationale: null,
        confidence: 0.9,
        evidence: [email],
        pending: false,
      },
    });
    expect(explainProposal(heldRole, detail())).toContain("It matches what Salesforce has, so there is nothing to approve.");
    const otherPerson = field({
      kind: "role",
      salesforceValue: { contactId: "003B", name: "Ingrid Solberg" },
      proposal: {
        value: { name: "Ingrid Solberg", title: "CFO", suggestedContactId: "003A", candidates: [] },
        rationale: null,
        confidence: 0.9,
        evidence: [email],
        pending: false,
      },
    });
    expect(explainProposal(otherPerson, detail())).toContain(
      "Salesforce now holds Ingrid Solberg, changed since this was settled; the calls heard Ingrid Solberg (CFO), and there is nothing to approve.",
    );
  });

  it("explains a role's match, or why there is none", () => {
    const candidates = [
      { contactId: "003A", name: "Ingrid Solberg", email: null, title: "CFO", score: 0.97 },
      { contactId: "003B", name: "Lars Haugen", email: null, title: null, score: 0.2 },
    ];
    const matched = field({
      kind: "role",
      proposal: { value: { name: "Ingrid Solberg", title: "CFO", suggestedContactId: "003A", candidates }, rationale: null, confidence: 0.8, evidence: [email], pending: true },
    });
    expect(explainProposal(matched, detail())).toContain("Matched to the Contact Ingrid Solberg by name, 97% similar.");

    const unmatched = field({
      kind: "role",
      proposal: { value: { name: "Grace Lim", title: "CFO", suggestedContactId: null, candidates }, rationale: null, confidence: 0.8, evidence: [email], pending: true },
    });
    expect(explainProposal(unmatched, detail())).toContain(
      "No Contact on the Account is a close enough match to pick for you; the nearest is Ingrid Solberg at 97%.",
    );
  });

  it("is empty without a proposal, and notes a field only the AM confirms", () => {
    expect(explainProposal(field({ proposal: null }), detail())).toEqual([]);
    const attest = field({ attest: true, proposal: { value: "Yes", rationale: null, confidence: 0.7, evidence: [], pending: true } });
    expect(explainProposal(attest, detail())).toEqual([
      "No quote backs this. It comes from the AI's reading of the conversation as a whole.",
      "The AI's confidence is medium (70%).",
      "Salesforce has nothing for this field, so the suggestion would fill it.",
      "Only you confirm this field. Check a suggestion against the customer's own words before approving.",
    ]);
  });
});

describe("explainProposal with unattributed quotes", () => {
  it("says nothing about who spoke when the backend attributes nobody", () => {
    const unattributed = quote({ authorRole: undefined });
    const f = field({ proposal: { value: "Ingrid", rationale: null, confidence: 0.9, evidence: [unattributed], pending: true } });
    const facts = explainProposal(f, detail());
    expect(facts.some((fact) => fact.includes("own words"))).toBe(false);
    expect(facts[0]).toBe("Backed by 1 quote from 1 call, shown below word for word.");
  });
});
