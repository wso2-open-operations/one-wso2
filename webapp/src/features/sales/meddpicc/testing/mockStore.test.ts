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

import { beforeEach, describe, expect, it } from "vitest";
import { HttpError } from "@api/http";
import { mockMeddpiccClient as client, resetMockStore } from "./mockStore";
import { buildApproveRequest, initialRoleMatches } from "../util/approval";

const BRIGHTWATER = "006MOCK0000BRWT";
const MERIDIAN = "006MOCK0000MERI";
const NORDLYS = "006MOCK0000NORD";
const HARBOURLINE = "006MOCK0000HARB";
const ASTERRA = "006MOCK0000ASTE";
const OAKRIDGE = "006MOCK0000OAKR";

const ALL = { search: null, owner: null, stage: null, hideClosed: false, mine: false, region: null };

async function statusOf(promise: Promise<unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpError) return { status: error.status, body: JSON.parse(error.responseBody) };
    throw error;
  }
  throw new Error("expected a refusal");
}

beforeEach(() => resetMockStore());

describe("the test double", () => {
  it("covers the situations the demo needs", async () => {
    const brightwater = await client.deal(BRIGHTWATER);
    expect(brightwater.currentStage).toBe("Qualify");
    expect(brightwater.fields.find((f) => f.key === "champion")?.proposal?.pending).toBe(true);
    expect(brightwater.askNext.map((a) => a.fieldKey)).toContain("economicBuyer");

    const meridian = await client.deal(MERIDIAN);
    const competitors = meridian.fields.find((f) => f.key === "competitors");
    expect(competitors?.salesforceValue).toEqual(["Mulesoft"]);
    expect(competitors?.proposal?.value).toEqual(["Kong"]);

    expect((await client.deal(NORDLYS)).gateComplete).toBe(true);
    expect((await client.deal(HARBOURLINE)).unassignedCalls).toHaveLength(2);
    expect((await client.deal(ASTERRA)).canEdit).toBe(false);
  });

  it("fills the circles on Approve all", async () => {
    const before = await client.deal(BRIGHTWATER);
    expect(before.deal.dealState.CH).toBe("SUGGESTED");
    expect(before.deal.dealState.DP).toBe("SUGGESTED");
    expect(before.deal.pendingCount).toBeGreaterThan(0);

    const result = await client.approve(
      BRIGHTWATER,
      buildApproveRequest(before.fields, { edits: {}, roleMatches: initialRoleMatches(before.fields) }),
    );

    expect(result.error).toBeNull();
    expect(result.written).toEqual(expect.arrayContaining(["champion", "decisionProcess", "decisionCriteria"]));
    expect(result.deal.deal.dealState.CH).toBe("FILLED");
    expect(result.deal.deal.dealState.DP).toBe("FILLED");
    expect(result.deal.deal.dealState.DC).toBe("FILLED");
    expect(result.deal.fields.find((f) => f.key === "champion")?.salesforceValue).toEqual({
      contactId: "003MOCKK1",
      name: "Priya Ranjan",
    });
    // The list sees it too.
    const listed = (await client.deals(ALL)).items.find((d) => d.opportunityId === BRIGHTWATER);
    expect(listed?.dealState.CH).toBe("FILLED");
  });

  it("writes an edit instead of the Proposal, and a clear as no value", async () => {
    const before = await client.deal(MERIDIAN);
    const result = await client.approve(
      MERIDIAN,
      buildApproveRequest(before.fields, {
        edits: { competitors: ["Kong", "Mulesoft"], cloudProvider: null, economicBuyer: null },
        roleMatches: {},
      }),
    );
    const after = result.deal.fields;
    expect(after.find((f) => f.key === "competitors")?.salesforceValue).toEqual(["Kong", "Mulesoft"]);
    expect(after.find((f) => f.key === "cloudProvider")?.salesforceValue).toBeNull();
    // Economic buyer cleared as not known: left as Salesforce had it, and no longer pending.
    expect(result.skipped).toContainEqual({ fieldKey: "economicBuyer", reason: "not known" });
    expect(after.find((f) => f.key === "economicBuyer")?.proposal?.pending).toBe(false);
  });

  it("refuses Approve all with a pending role neither matched nor cleared, as the backend does", async () => {
    const refusal = await statusOf(client.approve(MERIDIAN, { edits: {}, roleMatches: {} }));
    expect(refusal.status).toBe(400);
  });

  it("moves the stage once the Gate is complete, and the next Gate becomes current", async () => {
    const before = await client.deal(NORDLYS);
    expect(before.nextStage).toBe("Proposal");

    expect(await client.moveStage(NORDLYS, "Proposal")).toEqual({ stage: "Proposal" });

    const after = await client.deal(NORDLYS);
    expect(after.currentStage).toBe("Proposal");
    expect(after.deal.stage).toBe("Proposal");
    expect(after.nextStage).toBe("Negotiation");
    expect(after.gateComplete).toBe(false);
  });

  it("answers 409 with the blocking fields when the Gate isn't complete", async () => {
    const refusal = await statusOf(client.moveStage(BRIGHTWATER, "Technical Proof"));
    expect(refusal.status).toBe(409);
    expect(refusal.body.incomplete).toEqual(expect.arrayContaining(["economicBuyer"]));
  });

  it("answers 422 with Salesforce's message and a link when Salesforce refuses", async () => {
    const refusal = await statusOf(client.moveStage(OAKRIDGE, "Business Proof"));
    expect(refusal.status).toBe(422);
    expect(refusal.body.message).toMatch(/Update MEDDPICC Stages flow/);
    expect(refusal.body.salesforceUrl).toMatch(/006MOCK0000OAKR$/);
  });

  it("pulls an unassigned call in on Include, with what it proposes", async () => {
    const before = await client.deal(HARBOURLINE);
    expect(before.fields.find((f) => f.key === "primaryContact")?.proposal).toBeNull();

    const after = await client.includeCalls(HARBOURLINE, [91032]);

    expect(after.unassignedCalls.map((c) => c.meetingId)).toEqual([91033]);
    expect(after.calls.map((c) => c.meetingId)).toContain(91032);
    expect(after.fields.find((f) => f.key === "primaryContact")?.proposal?.pending).toBe(true);
    const coverage = await client.meetingCoverage([91032]);
    expect(coverage.items[0].opportunityId).toBe(HARBOURLINE);
  });

  it("refuses writes on a deal the caller can't edit", async () => {
    expect((await statusOf(client.approve(ASTERRA, { edits: {}, roleMatches: { procurementLegal: "003MOCKA3" } }))).status).toBe(403);
  });

  it("drops a rejected suggestion, and refuses a second reject or one on a deal the caller can't edit", async () => {
    const after = await client.rejectProposal(BRIGHTWATER, "decisionProcess", { reason: "WRONG_VALUE", note: null });
    expect(after.fields.find((f) => f.key === "decisionProcess")?.proposal).toBeNull();
    expect((await client.deal(BRIGHTWATER)).fields.find((f) => f.key === "decisionProcess")?.proposal).toBeNull();
    expect((await statusOf(client.rejectProposal(BRIGHTWATER, "decisionProcess", { reason: "OTHER", note: null }))).status).toBe(409);
    expect((await statusOf(client.rejectProposal(BRIGHTWATER, "nope", { reason: "OTHER", note: null }))).status).toBe(400);
    expect((await statusOf(client.rejectProposal(ASTERRA, "procurementLegal", { reason: "OTHER", note: null }))).status).toBe(403);
  });

  it("answers coverage for meetings it has never heard of, so a real meeting list still gets circles", async () => {
    const { items } = await client.meetingCoverage([123, 124, 91001]);
    expect(items.map((i) => i.meetingId)).toEqual([123, 124, 91001]);
    expect(items[2].opportunityId).toBe(BRIGHTWATER);
    // Missed: Brightwater is in Qualify, whose Gate needs E, and the discovery call never got there.
    expect(items[2].missed).toContain("E");
  });

  it("filters the list, and hides closed deals when asked", async () => {
    const all = await client.deals(ALL);
    expect(all.items.some((d) => d.isClosed)).toBe(true);
    const open = await client.deals({ ...ALL, hideClosed: true });
    expect(open.items.some((d) => d.isClosed)).toBe(false);
    expect((await client.deals({ ...ALL, search: "brightw" })).items.map((d) => d.opportunityId)).toEqual([BRIGHTWATER]);
    expect((await client.deals({ ...ALL, stage: "Technical Proof" })).items).toHaveLength(2);
    // My deals: the demo user's own, the ones they can edit.
    const mine = (await client.deals({ ...ALL, mine: true })).items.map((d) => d.opportunityId);
    expect(mine.length).toBeLessThan(all.items.length);
    for (const id of mine) expect((await client.deal(id)).canEdit).toBe(true);
    // A region: the deals whose account is in it.
    const apac = (await client.deals({ ...ALL, region: "APAC" })).items;
    expect(apac.length).toBeGreaterThan(0);
    expect(apac.every((d) => d.salesRegion === "APAC")).toBe(true);
  });
});
