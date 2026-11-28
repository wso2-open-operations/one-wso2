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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "@api/http";
import { draftToInput, emptyDraft } from "../request-form/requestFormModel";
import type { Person } from "../types";

const { authedGet, authedPost, authedPut, authedDelete, fetchWithReauth } = vi.hoisted(() => ({
  authedGet: vi.fn(),
  authedPost: vi.fn(),
  authedPut: vi.fn(),
  authedDelete: vi.fn(),
  fetchWithReauth: vi.fn(),
}));
vi.mock("@api/http", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@api/http")>()),
  authedGet,
  authedPost,
  authedPut,
  authedDelete,
  fetchWithReauth,
}));

import { createProcurementApi } from "./procurementApi";
import { resetMockProcurementApis } from "./mockProcurementApi";

const user: Person = { id: "me@example.com", name: "Me Myself", email: "me@example.com" };
const getToken = async () => "token";

/** What the backend answers, by the end of the path it is asked. */
const answers: Record<string, unknown> = {
  "/me": { email: "me@example.com", roles: ["procurement_user"] },
  "/me/team-lead": { approvalExempt: false, teamLead: { email: "lead@example.com", name: "Lead" } },
  "/reference-data?type=BUDGET_CATEGORY": [{ code: "CAT-1", label: "Software" }],
  "/reference-data?type=BUSINESS_UNIT": [{ code: "BU-1", label: "Sales" }],
  "/reference-data?type=PRODUCT": [{ code: "PRD-1", label: "Choreo" }],
  "/reference-data?type=REGION": [{ code: "REG-1", label: "Global" }],
  "/budget-approvers?businessUnit=BU-1": [{ id: 10, name: "Budget Owner" }],
  "/budget-approvers?businessUnit=BU-1&region=REG-1": [{ id: 11, name: "Regional Owner" }],
  "/settings/budget-approvers": [
    { id: 10, name: "Budget Owner", email: "budget.owner@example.com", isActive: true, scopes: [{ scopeType: "BUSINESS_UNIT", code: "BU-1" }, { scopeType: "REGION", code: "REG-1" }] },
  ],
  "/settings/reference-data": [{ id: 3, type: "REGION", code: "REG-1", label: "Global", isActive: false }],
  "/engagement-codes?businessUnit=Sales": [{ code: "ENG-1", name: "Platform" }],
  "/procurement/team": [{ email: "sam.lee@example.com", name: "Sam Lee" }, { email: "robin.shaw@example.com", name: "Robin Shaw" }],
  "/directory/employees?query=dre": [{ email: "drew.parker@example.com", name: "Drew Parker" }, { email: "intern@example.com", name: "An Intern" }],
  "/directory/employees?query=dre&leadsOnly=true": [{ email: "drew.parker@example.com", name: "Drew Parker" }],
  "/approvals?limit=100": [
    { id: 4, referenceNo: "PR-2026-00004", title: "Desks", category: "NON_IT", status: "PENDING_APPROVAL", version: 1, submittedOn: null, updatedOn: "2026-11-01T00:00:00Z", requesterName: "Alex Morgan", requesterEmail: "alex@example.com" },
  ],
  "/approvals?limit=100&status=REJECTED": [],
  "/procurement/requests?limit=100": [
    { id: 8, referenceNo: "PR-2026-00008", title: "Desks", category: "NON_IT", status: "APPROVED", version: 1, submittedOn: null, updatedOn: "2026-11-01T00:00:00Z", priority: null, assigneeEmail: null, requesterName: "Alex Morgan", requesterEmail: "alex@example.com" },
  ],
  "/procurement/requests?limit=100&status=ASSIGNED&priority=P1": [],
  "/requests?limit=100": [
    { id: 3, referenceNo: "PR-2026-00003", title: "ZoomInfo", category: "IT", status: "PENDING_APPROVAL", version: 1, submittedOn: "2026-11-01T00:00:00Z", updatedOn: "2026-11-01T00:00:00Z" },
  ],
};

const requestDetail = {
  id: 7,
  referenceNo: "PR-2026-00007",
  title: "Chairs",
  category: "NON_IT",
  status: "PENDING_APPROVAL",
  version: 1,
  submittedOn: "2026-11-01T00:00:00Z",
  updatedOn: "2026-11-01T00:00:00Z",
  requesterName: "Me Myself",
  requesterEmail: "me@example.com",
  requirementDetails: "40 chairs",
  vendorName: null,
  businessJustification: "Needed",
  roi: null,
  additionalSpecifications: null,
  salesforceCampaign: null,
  notes: null,
  vendors: [],
  answers: [],
  budgetCategoryCode: null,
  businessUnitCode: null,
  productCode: null,
  regionCode: null,
  engagementCode: null,
  budgetApproverId: null,
  budgetApproverName: null,
  teamLeadEmail: "lead@example.com",
  additionalApprovers: [],
  itDetails: null,
  itAssessment: null,
  decisions: [],
  createdOn: "2026-11-01T00:00:00Z",
};

const nonItInput = () => {
  const draft = emptyDraft();
  draft.category = "NON-IT";
  draft.details.description = "40 chairs";
  draft.details.businessJustification = "Needed";
  draft.declarationAccepted = true;
  return draftToInput(draft);
};

const asked = (): string[] => authedGet.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  authedGet.mockReset();
  authedPost.mockReset();
  authedPut.mockReset();
  authedDelete.mockReset();
  fetchWithReauth.mockReset();
  fetchWithReauth.mockImplementation(async () => new Response(JSON.stringify({ id: 1 }), { status: 201 }));
  answers["/requests/7"] = requestDetail;
  answers["/requests/7/attachments"] = [];
  authedGet.mockImplementation(async (url: string) => {
    if (!(url in answers)) throw new Error(`unexpected request: ${url}`);
    return answers[url];
  });
  resetMockProcurementApis();
});

describe("the Procurement backend adapter", () => {
  const api = () => createProcurementApi(getToken, user);

  it("combines /me and /me/team-lead, with the name from the token", async () => {
    expect(await api().getMe()).toMatchObject({
      name: "Me Myself",
      roles: ["procurement_user"],
      teamLead: { email: "lead@example.com" },
      approvalExempt: false,
    });
    expect(asked().sort()).toEqual(["/me", "/me/team-lead"]);
  });

  it("combines the four reference lists into labelled choices", async () => {
    expect(await api().getLookups()).toEqual({
      budgetCategories: [{ value: "CAT-1", label: "Software" }],
      businessUnits: [{ value: "BU-1", label: "Sales" }],
      products: [{ value: "PRD-1", label: "Choreo" }],
      regions: [{ value: "REG-1", label: "Global" }],
    });
    expect(asked()).toHaveLength(4);
  });

  it("asks for approvers by the unit's code and/or region, and for none when neither is chosen", async () => {
    expect(await api().getBudgetApprovers({ businessUnit: "BU-1", region: "" })).toEqual([{ id: "10", name: "Budget Owner" }]);
    expect(await api().getBudgetApprovers({ businessUnit: "BU-1", region: "REG-1" })).toEqual([{ id: "11", name: "Regional Owner" }]);
    authedGet.mockClear();
    expect(await api().getBudgetApprovers({ businessUnit: "", region: "" })).toEqual([]);
    expect(authedGet).not.toHaveBeenCalled();
  });

  it("asks for engagement codes by the unit's name, and for none without one", async () => {
    expect(await api().getEngagementCodes("Sales")).toEqual([{ value: "ENG-1", label: "ENG-1 - Platform" }]);
    authedGet.mockClear();
    expect(await api().getEngagementCodes("")).toEqual([]);
    expect(authedGet).not.toHaveBeenCalled();
  });

  it("searches the directory and returns people", async () => {
    expect((await api().searchDirectory("dre", false)).map((p) => p.name)).toEqual(["Drew Parker", "An Intern"]);
  });

  it("adds a collaborator by email, and takes one off", async () => {
    authedPost.mockResolvedValue(null);
    authedDelete.mockResolvedValue(undefined);
    await api().addCollaborator("7", "kim@example.com");
    await api().removeCollaborator("7", "kim@example.com");
    expect(authedPost.mock.calls).toEqual([["/requests/7/collaborators", "token", { email: "kim@example.com" }]]);
    expect(authedDelete.mock.calls.map((c) => c[0])).toEqual(["/requests/7/collaborators/kim%40example.com"]);
  });

  it("replaces the budget details of a request, sending a blank one as none", async () => {
    authedPut.mockResolvedValue(null);
    await api().changeBudget("7", {
      budget: { category: "CAT-1", businessUnit: "BU-1", product: "", region: "REG-1", engagementCode: "ENG-1", salesforceCampaign: "ignored" },
      budgetApproverId: "10",
    });
    expect(authedPut).toHaveBeenCalledWith("/requests/7/budget", "token", {
      budgetCategoryCode: "CAT-1",
      businessUnitCode: "BU-1",
      productCode: null,
      regionCode: "REG-1",
      engagementCode: "ENG-1",
      budgetApproverId: 10,
    });
    await api().changeBudget("7", { budget: { category: "", businessUnit: "", product: "", region: "", engagementCode: "", salesforceCampaign: "" }, budgetApproverId: "" });
    expect(authedPut.mock.calls[1][2]).toMatchObject({ budgetCategoryCode: null, budgetApproverId: null });
  });

  it("lists the budget approvers for Settings, and adds and changes one with the business units and regions as scopes", async () => {
    authedPost.mockResolvedValue({ id: 11 });
    authedPut.mockResolvedValue({ id: 10 });
    expect(await api().listBudgetApproverSettings()).toEqual([
      { id: "10", name: "Budget Owner", email: "budget.owner@example.com", isActive: true, businessUnits: ["BU-1"], regions: ["REG-1"] },
    ]);
    await api().addBudgetApprover("new.approver@example.com", { businessUnits: ["BU-1"], regions: [] });
    await api().changeBudgetApprover("10", { isActive: false, businessUnits: [], regions: ["REG-1"] });
    expect(authedPost).toHaveBeenCalledWith("/settings/budget-approvers", "token", {
      email: "new.approver@example.com",
      scopes: [{ scopeType: "BUSINESS_UNIT", code: "BU-1" }],
    });
    expect(authedPut).toHaveBeenCalledWith("/settings/budget-approvers/10", "token", {
      isActive: false,
      scopes: [{ scopeType: "REGION", code: "REG-1" }],
    });
  });

  it("lists the options of the form's lists for Settings, and adds and changes one", async () => {
    authedPost.mockResolvedValue({ id: 4 });
    authedPut.mockResolvedValue({ id: 3 });
    expect(await api().listReferenceSettings()).toEqual([{ id: "3", kind: "REGION", code: "REG-1", label: "Global", isActive: false }]);
    await api().addReferenceOption({ kind: "PRODUCT", code: "PRD-9", label: "Ballerina" });
    await api().changeReferenceOption("3", { label: "Worldwide", isActive: true });
    expect(authedPost).toHaveBeenCalledWith("/settings/reference-data", "token", { type: "PRODUCT", code: "PRD-9", label: "Ballerina" });
    expect(authedPut).toHaveBeenCalledWith("/settings/reference-data/3", "token", { label: "Worldwide", isActive: true });
  });

  it("lists the Procurement team's members as people, for the assignee dropdown", async () => {
    expect(await api().listTeamMembers()).toEqual([
      { id: "sam.lee@example.com", name: "Sam Lee", email: "sam.lee@example.com" },
      { id: "robin.shaw@example.com", name: "Robin Shaw", email: "robin.shaw@example.com" },
    ]);
    expect(asked()).toEqual(["/procurement/team"]);
  });

  it("asks the backend for leads only when that is wanted, so the answer holds only people who can approve", async () => {
    expect(await api().searchDirectory("dre", true)).toEqual([
      { id: "drew.parker@example.com", name: "Drew Parker", email: "drew.parker@example.com" },
    ]);
    expect(asked()).toEqual(["/directory/employees?query=dre&leadsOnly=true"]);
  });

  it("lists the user's requests as rows, one page of 100", async () => {
    expect(await api().listMyRequests()).toEqual([
      { id: "3", reference: "PR-2026-00003", title: "ZoomInfo", category: "IT", status: "submitted", submittedAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z" },
    ]);
  });

  it("surfaces a failed read rather than an empty answer", async () => {
    authedGet.mockRejectedValue(new Error("boom"));
    await expect(api().listMyRequests()).rejects.toThrow("boom");
  });

  it("saves the request as a draft, then submits it with the declaration, and answers with the reference the backend gave", async () => {
    authedPost.mockImplementation(async (url: string) =>
      url === "/requests" ? { id: 7, status: "DRAFT" } : { id: 7, status: "PENDING_APPROVAL", referenceNo: "PR-2026-00007" },
    );
    const submitted = await api().submitRequest(nonItInput());
    expect(authedPost.mock.calls.map((c) => c[0])).toEqual(["/requests", "/requests/7/submit"]);
    expect(authedPost.mock.calls[0][2]).toMatchObject({ category: "NON_IT", requirementDetails: "40 chairs", businessJustification: "Needed", itDetails: null });
    expect(authedPost.mock.calls[1][2]).toEqual({ commitmentConfirmed: true });
    expect(submitted).toEqual({ id: "7", reference: "PR-2026-00007" });
    expect(asked()).toEqual([]);
  });

  it("does not leave a submitted request to be saved again when reading it back would fail", async () => {
    authedPost.mockImplementation(async (url: string) =>
      url === "/requests" ? { id: 7, status: "DRAFT" } : { id: 7, status: "PENDING_APPROVAL", referenceNo: "PR-2026-00007" },
    );
    authedGet.mockRejectedValue(new Error("read failed"));
    const client = api();
    await expect(client.submitRequest(nonItInput())).resolves.toEqual({ id: "7", reference: "PR-2026-00007" });
    await client.submitRequest(nonItInput());
    expect(authedPost.mock.calls.filter((c) => c[0] === "/requests")).toHaveLength(2);
    expect(authedPut).not.toHaveBeenCalled();
  });

  it("saves over the draft a failed submit left behind, instead of leaving another one", async () => {
    authedPost.mockImplementation(async (url: string) => {
      if (url === "/requests") return { id: 7, status: "DRAFT" };
      if (authedPost.mock.calls.filter((c) => c[0] === "/requests/7/submit").length === 1) throw new Error("boom");
      return null;
    });
    const client = api();
    await expect(client.submitRequest(nonItInput())).rejects.toThrow("boom");
    await client.submitRequest(nonItInput());
    expect(authedPost.mock.calls.filter((c) => c[0] === "/requests")).toHaveLength(1);
    expect(authedPut.mock.calls.map((c) => c[0])).toEqual(["/requests/7"]);
  });

  it("starts a new draft when the one left behind no longer exists", async () => {
    authedPost.mockImplementation(async (url: string) => {
      if (url === "/requests") return { id: 7, status: "DRAFT" };
      if (authedPost.mock.calls.filter((c) => c[0] === "/requests/7/submit").length === 1) throw new Error("boom");
      return null;
    });
    authedPut.mockRejectedValue(new HttpError("/requests/7", 404, ""));
    const client = api();
    await expect(client.submitRequest(nonItInput())).rejects.toThrow("boom");
    await client.submitRequest(nonItInput());
    expect(authedPost.mock.calls.filter((c) => c[0] === "/requests")).toHaveLength(2);
  });

  it("does not create another request when the one left behind was already submitted", async () => {
    authedPost.mockImplementation(async (url: string) => {
      if (url === "/requests") return { id: 7, status: "DRAFT" };
      throw new Error("boom");
    });
    authedPut.mockRejectedValue(new HttpError("/requests/7", 409, ""));
    const client = api();
    await expect(client.submitRequest(nonItInput())).rejects.toThrow("boom");
    await expect(client.submitRequest(nonItInput())).rejects.toThrow("already submitted");
    expect(authedPost.mock.calls.filter((c) => c[0] === "/requests")).toHaveLength(1);
  });

  it("replaces a rejected request, then submits it again", async () => {
    authedPost.mockResolvedValue(null);
    await api().resubmitRequest("7", nonItInput());
    expect(authedPut.mock.calls.map((c) => c[0])).toEqual(["/requests/7"]);
    expect(authedPost.mock.calls.map((c) => c[0])).toEqual(["/requests/7/submit"]);
  });

  describe("attachments", () => {
    const file = (name: string, size = 3) => new File([new Uint8Array(size)], name, { type: "application/pdf" });
    const withFiles = (files: File[], removed: string[] = []) => {
      const input = nonItInput();
      input.attachments = { saved: [], removed, files };
      return input;
    };
    const uploaded = (): string[] => fetchWithReauth.mock.calls.map((c) => ((c[1] as RequestInit).body as FormData).get("file")).map((f) => (f as File).name);

    it("uploads the files after saving the draft and before submitting it", async () => {
      const order: string[] = [];
      authedPost.mockImplementation(async (url: string) => {
        order.push(url);
        return url === "/requests" ? { id: 7, status: "DRAFT" } : { id: 7, status: "PENDING_APPROVAL", referenceNo: "PR-2026-00007" };
      });
      fetchWithReauth.mockImplementation(async (url: string) => {
        order.push(`upload ${url}`);
        return new Response(JSON.stringify({ id: order.length }), { status: 201 });
      });
      await api().submitRequest(withFiles([file("quote.pdf"), file("spec.pdf")]));
      expect(order).toEqual(["/requests", "upload /requests/7/attachments", "upload /requests/7/attachments", "/requests/7/submit"]);
      expect(uploaded()).toEqual(["quote.pdf", "spec.pdf"]);
    });

    it("does not submit when a file is refused, and says which one and why", async () => {
      authedPost.mockResolvedValue({ id: 7, status: "DRAFT" });
      fetchWithReauth.mockResolvedValue(new Response(JSON.stringify({ message: "The file type is not allowed." }), { status: 400 }));
      await expect(api().submitRequest(withFiles([file("quote.pdf")]))).rejects.toThrow('"quote.pdf" could not be attached. The file type is not allowed.');
      expect(authedPost.mock.calls.map((c) => c[0])).toEqual(["/requests"]);
    });

    it("does not upload again a file this session already uploaded, so a retry does not attach it twice", async () => {
      authedPost.mockResolvedValue({ id: 7, status: "DRAFT" });
      fetchWithReauth
        .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1 }), { status: 201 }))
        .mockResolvedValueOnce(new Response("", { status: 503 }));
      const input = withFiles([file("a.pdf"), file("b.pdf")]);
      const adapter = api();
      await expect(adapter.submitRequest(input)).rejects.toThrow('"b.pdf" could not be attached.');
      fetchWithReauth.mockReset();
      fetchWithReauth.mockResolvedValue(new Response(JSON.stringify({ id: 2 }), { status: 201 }));
      authedPost.mockImplementation(async (url: string) => (url === "/requests/7/submit" ? { id: 7, status: "PENDING_APPROVAL" } : null));
      await adapter.submitRequest(input);
      expect(uploaded()).toEqual(["b.pdf"]);
    });

    it("uploads two different files that have the same name and size", async () => {
      authedPost.mockResolvedValue({ id: 7, status: "DRAFT" });
      fetchWithReauth.mockImplementation(async () => new Response(JSON.stringify({ id: 1 }), { status: 201 }));
      await api().submitRequest(withFiles([new File(["aaa"], "quote.pdf"), new File(["bbb"], "quote.pdf")]));
      expect(uploaded()).toEqual(["quote.pdf", "quote.pdf"]);
    });

    it("treats an upload whose answer has no id as failed, so no file is ever tracked without an id to delete it by", async () => {
      authedPost.mockResolvedValue({ id: 7, status: "DRAFT" });
      for (const answer of [null, JSON.stringify({}), JSON.stringify({ id: "x" })]) {
        fetchWithReauth.mockResolvedValue(new Response(answer, { status: 201 }));
        await expect(api().submitRequest(withFiles([file("quote.pdf")]))).rejects.toThrow('"quote.pdf" could not be attached.');
      }
      expect(authedPost.mock.calls.map((c) => c[0]).filter((u) => u.endsWith("/submit"))).toEqual([]);
    });

    it("removes a file an earlier attempt uploaded when the requester drops it before trying again", async () => {
      authedPost.mockResolvedValue({ id: 7, status: "DRAFT" });
      authedDelete.mockResolvedValue(undefined);
      fetchWithReauth
        .mockResolvedValueOnce(new Response(JSON.stringify({ id: 11 }), { status: 201 }))
        .mockResolvedValueOnce(new Response("", { status: 503 }));
      const [a, b] = [file("a.pdf"), file("b.pdf")];
      const adapter = api();
      await expect(adapter.submitRequest(withFiles([a, b]))).rejects.toThrow('"b.pdf" could not be attached.');
      fetchWithReauth.mockReset();
      fetchWithReauth.mockResolvedValue(new Response(JSON.stringify({ id: 12 }), { status: 201 }));
      authedPost.mockImplementation(async (url: string) => (url === "/requests/7/submit" ? { id: 7, status: "PENDING_APPROVAL" } : null));
      await adapter.submitRequest(withFiles([b]));
      expect(authedDelete.mock.calls.map((c) => c[0])).toEqual(["/requests/7/attachments/11"]);
      expect(uploaded()).toEqual(["b.pdf"]);
    });

    it("takes off what the requester removed, then uploads what they added, when a rejected request is resubmitted", async () => {
      authedPost.mockResolvedValue(null);
      authedDelete.mockResolvedValue(undefined);
      await api().resubmitRequest("7", withFiles([file("new.pdf")], ["4", "5"]));
      expect(authedDelete.mock.calls.map((c) => c[0])).toEqual(["/requests/7/attachments/4", "/requests/7/attachments/5"]);
      expect(uploaded()).toEqual(["new.pdf"]);
      expect(authedPost.mock.calls.map((c) => c[0])).toEqual(["/requests/7/submit"]);
    });

    it("ignores a removed file the backend no longer has", async () => {
      authedPost.mockResolvedValue(null);
      authedDelete.mockRejectedValue(new HttpError("/requests/7/attachments/4", 404, ""));
      await expect(api().resubmitRequest("7", withFiles([], ["4"]))).resolves.toBeUndefined();
    });

    it("lists a request's files with their scan result, and downloads one as bytes", async () => {
      answers["/requests/7/attachments"] = [{ id: 1, fileName: "a.pdf", contentType: "application/pdf", sizeBytes: 3, scanStatus: "INFECTED", uploadedBy: "me@example.com", uploadedOn: "2026-11-02T00:00:00Z" }];
      expect(await api().listAttachments("7")).toEqual([
        { id: "1", name: "a.pdf", contentType: "application/pdf", sizeBytes: 3, scanStatus: "infected", uploadedBy: "me@example.com", uploadedAt: "2026-11-02T00:00:00Z" },
      ]);
      fetchWithReauth.mockResolvedValue(new Response("bytes"));
      expect((await api().downloadAttachment("7", "1")).size).toBe(5);
      expect(fetchWithReauth.mock.calls[0][0]).toBe("/requests/7/attachments/1");
    });
  });

  it("names another team lead for a request, by email", async () => {
    authedPut.mockResolvedValue({ id: 7, status: "PENDING_APPROVAL" });
    await api().changeTeamLead("7", "drew.parker@example.com");
    expect(authedPut).toHaveBeenCalledWith("/requests/7/team-lead", "token", { email: "drew.parker@example.com" });
  });

  it("cancels a request", async () => {
    authedPost.mockResolvedValue(null);
    await api().cancelRequest("7");
    expect(authedPost.mock.calls.map((c) => c[0])).toEqual(["/requests/7/cancel"]);
  });

  it("lists the requests waiting for the user's decision, or those of another status", async () => {
    expect((await api().listApprovals()).map((a) => [a.id, a.requester.name])).toEqual([["4", "Alex Morgan"]]);
    expect(await api().listApprovals("rejected")).toEqual([]);
    expect(asked()).toEqual(["/approvals?limit=100", "/approvals?limit=100&status=REJECTED"]);
  });

  it("sends a decision", async () => {
    authedPost.mockResolvedValue(null);
    await api().decideRequest("7", { decision: "approved", comment: "", disclaimerAccepted: true });
    expect(authedPost).toHaveBeenCalledWith("/requests/7/decision", "token", { decision: "APPROVED", comment: null, disclaimerAccepted: true });
  });

  it("finds the requests assigned to one person on every page of the queue, since the backend cannot filter by assignee", async () => {
    const row = (id: number, assignee: string | null) => ({
      id, referenceNo: `PR-2026-${id}`, title: `Request ${id}`, category: "NON_IT", status: "ASSIGNED", version: 1, submittedOn: null,
      updatedOn: "2026-11-01T00:00:00Z", priority: null, assigneeEmail: assignee, requesterName: "Alex Morgan", requesterEmail: "alex@example.com",
    });
    answers["/procurement/requests?limit=100&status=ASSIGNED"] = Array.from({ length: 100 }, (_, i) => row(i + 1, i === 3 ? "pat@example.com" : "sam@example.com"));
    answers["/procurement/requests?limit=100&status=ASSIGNED&offset=100"] = [row(101, "PAT@example.com"), row(102, "sam@example.com")];
    const mine = await api().listTeamQueue({ status: "assigned", assignee: "Pat@example.com" });
    expect(mine.map((r) => r.id)).toEqual(["4", "101"]);
    expect(asked()).toEqual(["/procurement/requests?limit=100&status=ASSIGNED", "/procurement/requests?limit=100&status=ASSIGNED&offset=100"]);
  });

  it("says the search is incomplete when every permitted page was full, instead of returning what it found as the whole answer", async () => {
    const row = (id: number) => ({
      id, referenceNo: `PR-2026-${id}`, title: `Request ${id}`, category: "NON_IT", status: "ASSIGNED", version: 1, submittedOn: null,
      updatedOn: "2026-11-01T00:00:00Z", priority: null, assigneeEmail: "sam@example.com", requesterName: "Alex Morgan", requesterEmail: "alex@example.com",
    });
    for (let page = 0; page < 50; page += 1) {
      answers[`/procurement/requests?limit=100&status=ASSIGNED${page > 0 ? `&offset=${page * 100}` : ""}`] = Array.from({ length: 100 }, (_, i) => row(page * 100 + i + 1));
    }
    await expect(api().listTeamQueue({ status: "assigned", assignee: "pat@example.com" })).rejects.toThrow(/too many requests/);
    expect(asked()).toHaveLength(50);
  });

  it("stops reading the queue at the first page that is not full, and reads only one page when no assignee is asked for", async () => {
    await api().listTeamQueue({ status: "assigned", priority: "P1" });
    expect(asked()).toEqual(["/procurement/requests?limit=100&status=ASSIGNED&priority=P1"]);
  });

  it("lists the Procurement queue, narrowed by stage and priority when asked", async () => {
    expect((await api().listTeamQueue()).map((r) => [r.id, r.requester.name])).toEqual([["8", "Alex Morgan"]]);
    expect(await api().listTeamQueue({ status: "assigned", priority: "P1" })).toEqual([]);
    expect(asked()).toEqual(["/procurement/requests?limit=100", "/procurement/requests?limit=100&status=ASSIGNED&priority=P1"]);
  });

  it("assigns to the user or to another person, unassigns and sets the priority", async () => {
    authedPost.mockResolvedValue(null);
    authedPut.mockResolvedValue(null);
    await api().assignRequest("7");
    await api().assignRequest("7", "pat@example.com");
    await api().unassignRequest("7");
    await api().setPriority("7", "P2");
    expect(authedPost.mock.calls.map((c) => c[0])).toEqual(["/requests/7/assign", "/requests/7/assign/pat%40example.com", "/requests/7/unassign"]);
    expect(authedPut).toHaveBeenCalledWith("/requests/7/priority", "token", { priority: "P2" });
  });
});
