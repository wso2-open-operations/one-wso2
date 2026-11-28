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
import type { Person, PurchaseRequestInput } from "../types";
import { draftToInput, emptyDraft } from "../request-form/requestFormModel";
import { createMockProcurementApi, MOCK_DIRECTORY, resetMockProcurementApis } from "./mockProcurementApi";

const user: Person = { id: "requester@example.com", name: "Req Uester", email: "requester@example.com" };

const input = (approvers: Person[] = [], declared = true): PurchaseRequestInput => {
  const draft = emptyDraft();
  return draftToInput({
    ...draft,
    category: "NON-IT",
    additionalApprovers: approvers,
    details: { ...draft.details, description: "Chairs", businessJustification: "Worn out" },
    declarationAccepted: declared,
  });
};

beforeEach(() => resetMockProcurementApis());

describe("the Procurement sample data", () => {
  it("knows the signed-in user, their default team lead and that they need approval", async () => {
    const me = await createMockProcurementApi(user).getMe();
    expect(me).toMatchObject({ email: user.email, teamLead: { name: "Jordan Ellis" }, approvalExempt: false });
  });

  it("raises a request as the signed-in user, awaiting approval, with a backend-style reference", async () => {
    const api = createMockProcurementApi(user);
    const submitted = await api.submitRequest(input());
    expect(submitted.reference).toMatch(/^PR-\d{4}-\d{5}$/);
    const created = await api.getRequest(submitted.id);
    expect(created).toMatchObject({ status: "submitted", requester: user });
    expect(created.teamLeadDecision.decision).toBe("pending");
    expect((await api.listMyRequests()).map((r) => r.id)).toContain(created.id);
  });

  it("lists rows without the request's content, newest first", async () => {
    const rows = await createMockProcurementApi(user).listMyRequests();
    expect(rows.map((r) => r.reference)).toEqual(["PR-2026-00003", "PR-2026-00002", "PR-2026-00001"]);
    expect(Object.keys(rows[0]).sort()).toEqual(["category", "id", "reference", "status", "submittedAt", "title", "updatedAt"]);
  });

  it("keeps one store per user across calls", async () => {
    const created = await createMockProcurementApi(user).submitRequest(input());
    expect(await createMockProcurementApi(user).getRequest(created.id)).toBeDefined();
  });

  it("refuses the requester or the team lead as an additional approver", async () => {
    const api = createMockProcurementApi(user);
    const teamLead = MOCK_DIRECTORY[10];
    await expect(api.submitRequest(input([user]))).rejects.toThrow(/cannot be you or your team lead/);
    await expect(api.submitRequest(input([teamLead]))).rejects.toThrow(/cannot be you or your team lead/);
  });

  it("refuses a submission without the declaration", async () => {
    await expect(createMockProcurementApi(user).submitRequest(input([], false))).rejects.toThrow(/declaration/);
  });

  it("edits and resubmits only a rejected request", async () => {
    const api = createMockProcurementApi(user);
    await expect(api.resubmitRequest("seed-1", input())).rejects.toThrow(/Only a rejected request/);
    await api.resubmitRequest("seed-2", input());
    const resubmitted = await api.getRequest("seed-2");
    expect(resubmitted.status).toBe("submitted");
    expect(resubmitted.teamLeadDecision.decision).toBe("pending");
  });

  it("refuses to resubmit without the declaration, and leaves the request rejected", async () => {
    const api = createMockProcurementApi(user);
    await expect(api.resubmitRequest("seed-2", input([], false))).rejects.toThrow(/declaration/);
    expect((await api.getRequest("seed-2")).status).toBe("rejected");
  });

  it("cancels a submitted or rejected request only", async () => {
    const api = createMockProcurementApi(user);
    await api.cancelRequest("seed-1");
    await api.cancelRequest("seed-2");
    expect((await api.getRequest("seed-1")).status).toBe("cancelled");
    expect((await api.getRequest("seed-2")).status).toBe("cancelled");
    await expect(api.cancelRequest("seed-3")).rejects.toThrow(/Only a submitted or rejected/);
  });

  it("searches the directory from 3 characters, capped, and never returns the requester", async () => {
    const api = createMockProcurementApi({ ...user, id: "blake.rivers@example.com", name: "Blake Rivers", email: "blake.rivers@example.com" });
    expect(await api.searchDirectory("bl", false)).toEqual([]);
    const found = await api.searchDirectory("dre", false);
    expect(found.map((p) => p.name)).toEqual(["Drew Parker"]);
    expect((await api.searchDirectory("bla", false)).map((p) => p.email)).not.toContain("blake.rivers@example.com");
    expect(found.length).toBeLessThanOrEqual(10);
  });

  it("matches the start of the email address only, as the backend does, not a name", async () => {
    const api = createMockProcurementApi(user);
    expect((await api.searchDirectory("drew.parker", false)).map((p) => p.name)).toEqual(["Drew Parker"]);
    expect(await api.searchDirectory("parker", false)).toEqual([]);
    expect(await api.searchDirectory("Drew Parker", false)).toEqual([]);
  });

  it("leaves out people who are not leads when only leads are asked for", async () => {
    const api = createMockProcurementApi(user);
    expect((await api.searchDirectory("cas", false)).map((p) => p.name)).toEqual(["Casey Lane"]);
    expect(await api.searchDirectory("cas", true)).toEqual([]);
    expect((await api.searchDirectory("dre", true)).map((p) => p.name)).toEqual(["Drew Parker"]);
  });

  it("serves dependent lists only once a business unit or region is chosen", async () => {
    const api = createMockProcurementApi(user);
    expect(await api.getEngagementCodes("")).toEqual([]);
    expect((await api.getEngagementCodes("Sales")).length).toBeGreaterThan(0);
    expect(await api.getBudgetApprovers({ businessUnit: "", region: "" })).toEqual([]);
    expect(await api.getBudgetApprovers({ businessUnit: "BU-4", region: "" })).toEqual([{ id: "10", name: "Budget Owner" }]);
  });

  it("lists what waits for the user's decision, and lets them approve or reject it", async () => {
    const api = createMockProcurementApi(user);
    expect((await api.listApprovals()).map((a) => a.id)).toEqual(["approval-1"]);
    expect((await api.listApprovals("approved")).map((a) => a.id)).toEqual(["approval-2"]);
    await expect(api.decideRequest("approval-1", { decision: "rejected", comment: " ", disclaimerAccepted: false })).rejects.toThrow(/why/);
    await expect(api.decideRequest("approval-1", { decision: "approved", comment: "", disclaimerAccepted: false })).rejects.toThrow(/reviewed/);
    await api.decideRequest("approval-1", { decision: "approved", comment: "", disclaimerAccepted: true });
    expect(await api.getRequest("approval-1")).toMatchObject({ status: "approved", teamLeadDecision: { decision: "approved", decidedBy: user.email } });
    expect(await api.listApprovals()).toEqual([]);
    await expect(api.decideRequest("approval-1", { decision: "approved", comment: "", disclaimerAccepted: true })).rejects.toThrow(/not waiting/);
  });

  it("queues the approved requests, and lets the team assign, unassign and prioritise one that is not the user's own", async () => {
    const api = createMockProcurementApi(user);
    expect((await api.listTeamQueue()).map((r) => r.id).sort()).toEqual(["approval-2", "seed-3", "team-1", "team-2"]);
    await expect(api.assignRequest("seed-3")).rejects.toThrow(/your own request/);
    await api.assignRequest("approval-2");
    expect(await api.getRequest("approval-2")).toMatchObject({ status: "assigned", assignee: user.email });
    expect((await api.listTeamQueue({ status: "assigned" })).map((r) => r.id).sort()).toEqual(["approval-2", "team-2"]);
    await api.setPriority("approval-2", "P1");
    expect((await api.listTeamQueue({ priority: "P1" })).map((r) => r.id)).toEqual(["approval-2"]);
    await api.unassignRequest("approval-2");
    expect(await api.getRequest("approval-2")).toMatchObject({ status: "approved", assignee: "" });
    await expect(api.unassignRequest("approval-2")).rejects.toThrow(/Only an assigned/);
  });

  it("lists the queue with the most urgent request first, and those without a priority last", async () => {
    const api = createMockProcurementApi(user);
    await api.setPriority("seed-3", "P2");
    await api.setPriority("approval-2", "P1");
    expect((await api.listTeamQueue()).map((r) => r.id)).toEqual(["approval-2", "seed-3", "team-2", "team-1"]);
  });

  it("lets the requester name another team lead while the request waits for its first decision, and refuses what the backend refuses", async () => {
    const api = createMockProcurementApi(user);
    await expect(api.changeTeamLead("seed-1", "casey.lane@example.com")).rejects.toThrow(/active team lead/);
    await expect(api.changeTeamLead("seed-1", "alex.morgan@example.com")).resolves.toBeUndefined();
    expect((await api.getRequest("seed-1")).teamLead?.email).toBe("alex.morgan@example.com");
    await expect(api.changeTeamLead("seed-1", "alex.morgan@example.com")).rejects.toThrow(/cannot be the team lead/);
    await expect(api.changeTeamLead("seed-3", "alex.morgan@example.com")).rejects.toThrow(/no longer waits/);
    await expect(api.changeTeamLead("approval-1", "alex.morgan@example.com")).rejects.toThrow(/Only the requester/);
  });

  it("lists only the requests assigned to a person when asked, whatever the case of the email", async () => {
    const api = createMockProcurementApi(user);
    expect((await api.listTeamQueue({ assignee: "BLAKE.RIVERS@example.com" })).map((r) => r.id)).toEqual(["team-2"]);
    expect(await api.listTeamQueue({ assignee: "nobody@example.com" })).toEqual([]);
  });

  it("gives each read of a request as a new object, so a save that changes it is seen as new data", async () => {
    const api = createMockProcurementApi(user);
    const before = await api.getRequest("team-1");
    await api.addCollaborator("team-1", "kim@example.com");
    const after = await api.getRequest("team-1");
    expect(after).not.toBe(before);
    expect(after.collaborators).toEqual(["kim@example.com"]);
    expect(before.collaborators).toEqual([]);
  });

  it("has requests that someone else raised and approved, which the user can handle and whose budget they can change", async () => {
    const api = createMockProcurementApi(user);
    await api.assignRequest("team-1");
    expect(await api.getRequest("team-1")).toMatchObject({ status: "assigned", assignee: user.email });
    const budget = (await api.getRequest("team-1")).budget;
    await api.changeBudget("team-1", { budget: { ...budget, engagementCode: "ENG-2041" }, budgetApproverId: "10" });
    expect((await api.getRequest("team-1")).budget.engagementCode).toBe("ENG-2041");
  });
  it("lets an admin add, change and stop offering a budget approver, and offers the form only the ones who are active and cover the scope", async () => {
    const api = createMockProcurementApi(user);
    const lookups = await api.getLookups();
    const unit = lookups.businessUnits[0].value;
    await api.addBudgetApprover("drew.parker@example.com", { businessUnits: [unit], regions: [] });
    const added = (await api.listBudgetApproverSettings()).find((a) => a.email === "drew.parker@example.com");
    expect(added).toMatchObject({ name: "Drew Parker", isActive: true, businessUnits: [unit], regions: [] });
    expect((await api.getBudgetApprovers({ businessUnit: unit, region: "" })).map((a) => a.name)).toEqual(["Budget Owner", "Drew Parker"]);
    await api.changeBudgetApprover(added!.id, { isActive: false, businessUnits: [unit], regions: [] });
    expect((await api.getBudgetApprovers({ businessUnit: unit, region: "" })).map((a) => a.name)).toEqual(["Budget Owner"]);
  });

  it("refuses a budget approver with no scope, an unknown scope, someone who is not an employee, or someone who already is one", async () => {
    const api = createMockProcurementApi(user);
    const unit = (await api.getLookups()).businessUnits[0].value;
    await expect(api.addBudgetApprover("drew.parker@example.com", { businessUnits: [], regions: [] })).rejects.toThrow(/at least one/);
    await expect(api.addBudgetApprover("drew.parker@example.com", { businessUnits: ["nope"], regions: [] })).rejects.toThrow(/cannot be used/);
    await expect(api.addBudgetApprover("nobody@example.com", { businessUnits: [unit], regions: [] })).rejects.toThrow(/active employee/);
    await expect(api.addBudgetApprover("Budget.Owner@example.com", { businessUnits: [unit], regions: [] })).rejects.toThrow(/already/);
    await expect(api.changeBudgetApprover("99", { isActive: true, businessUnits: [unit], regions: [] })).rejects.toThrow(/not found/);
  });
  it("lets an admin add an option and stop offering another, so the form's lists follow", async () => {
    const api = createMockProcurementApi(user);
    await api.addReferenceOption({ kind: "PRODUCT", code: "PRD-99", label: "Ballerina Central" });
    const listed = await api.listReferenceSettings();
    const region = listed.find((o) => o.kind === "REGION")!;
    await api.changeReferenceOption(region.id, { label: region.label, isActive: false });
    const lookups = await api.getLookups();
    expect(lookups.products.map((c) => c.label)).toContain("Ballerina Central");
    expect(lookups.regions.map((c) => c.value)).not.toContain(region.code);
    expect((await api.listReferenceSettings()).find((o) => o.id === region.id)).toMatchObject({ isActive: false });
  });

  it("refuses an option with a blank or repeated code, or a blank label, and one that is not there", async () => {
    const api = createMockProcurementApi(user);
    const first = (await api.listReferenceSettings())[0];
    await expect(api.addReferenceOption({ kind: first.kind, code: " ", label: "X" })).rejects.toThrow(/Invalid code/);
    await expect(api.addReferenceOption({ kind: first.kind, code: first.code, label: "X" })).rejects.toThrow(/already/);
    await expect(api.addReferenceOption({ kind: first.kind, code: "NEW-1", label: " " })).rejects.toThrow(/Invalid label/);
    await expect(api.changeReferenceOption("999", { label: "X", isActive: true })).rejects.toThrow(/not found/);
  });
});
