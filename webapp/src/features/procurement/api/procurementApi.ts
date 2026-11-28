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

// The seam between Procurement's screens and wherever its data comes from.
// Screens and hooks talk to `ProcurementApi` only; nothing else in the feature
// builds a URL or knows a mock exists.

import { describeError } from "@api/errors";
import { authedDelete, authedGet, authedPost, authedPut, fetchWithReauth, HttpError } from "@api/http";
import { isProcurementBackendConfigured, procurementServiceUrls as urls } from "@config/apiConfig";
import { isPreviewEnabled } from "@config/previewFeatures";
import type {
  ApprovalDecisionInput,
  ApprovalItem,
  Attachment,
  BudgetApproverOption,
  BudgetChange,
  Choice,
  Person,
  ProcurementLookups,
  ProcurementMe,
  OverrideInput,
  PurchaseRequest,
  Priority,
  PurchaseRequestInput,
  QueueItem,
  RequestStatus,
  RequestSummary,
  SubmittedRequest,
} from "../types";
import type {
  BackendBudgetApprover,
  BackendApprovalItem,
  BackendAttachment,
  BackendCreatedRequest,
  BackendProcurementItem,
  BackendUpdatedRequest,
  BackendDirectoryUser,
  BackendEngagementOption,
  BackendReferenceItem,
  BackendRequestDetail,
  BackendRequestSummary,
  BackendTeamLeadResult,
  BackendUser,
} from "./backendTypes";
import {
  toApprovalItem,
  toAttachment,
  toBackendBudgetChange,
  toBackendStatus,
  toBudgetApprovers,
  toChoices,
  toEngagementChoices,
  toMe,
  toNewDecision,
  toNewOverride,
  toNewRequest,
  toPerson,
  toQueueItem,
  toRequest,
  toSummary,
} from "./backendMapping";
import { createMockProcurementApi } from "./mockProcurementApi";

export interface ProcurementApi {
  getMe: () => Promise<ProcurementMe>;
  getLookups: () => Promise<ProcurementLookups>;
  /** Approvers who cover the business unit (by code) or the region (by code); none when neither is given. */
  getBudgetApprovers: (scope: { businessUnit: string; region: string }) => Promise<BudgetApproverOption[]>;
  /** Engagement codes funded by a business unit, asked for by the unit's name; none when no unit is given. */
  getEngagementCodes: (businessUnitName: string) => Promise<Choice[]>;
  /**
   * Employees whose email starts with `query`; name and email only, capped by the backend.
   *
   * @param leadsOnly - Keep only leads, who are the people who can approve a request
   */
  searchDirectory: (query: string, leadsOnly: boolean) => Promise<Person[]>;
  listMyRequests: () => Promise<RequestSummary[]>;
  getRequest: (requestId: string) => Promise<PurchaseRequest>;
  submitRequest: (input: PurchaseRequestInput) => Promise<SubmittedRequest>;
  /** Edit a rejected request and send it back to the approvers. */
  resubmitRequest: (requestId: string, input: PurchaseRequestInput) => Promise<void>;
  /** Requests that name the user as an approver; the ones waiting for a decision when no status is given. */
  listApprovals: (status?: RequestStatus) => Promise<ApprovalItem[]>;
  /** Approve or reject a request that waits for the user's decision. */
  decideRequest: (requestId: string, decision: ApprovalDecisionInput) => Promise<void>;
  /** As a Procurement admin, confirm the approval of a request its team lead approved, or reject it. A rejection goes back to the requester. */
  overrideRequest: (requestId: string, input: OverrideInput) => Promise<void>;
  /**
   * The requests Procurement handles, the most urgent first.
   *
   * @param filter.assignee - Only the requests assigned to this email. The backend cannot filter by it, so every page of the queue is read
   */
  listTeamQueue: (filter?: { status?: RequestStatus; priority?: Priority; assignee?: string }) => Promise<QueueItem[]>;
  /** Assign an approved request to the signed-in user, or to `email` when given. */
  assignRequest: (requestId: string, email?: string) => Promise<void>;
  /** Take the assignee off an assigned request. */
  unassignRequest: (requestId: string) => Promise<void>;
  setPriority: (requestId: string, priority: Priority) => Promise<void>;
  /** Withdraw a submitted or rejected request. */
  cancelRequest: (requestId: string) => Promise<void>;
  /** The files saved on a request the signed-in user may see, the oldest first. */
  listAttachments: (requestId: string) => Promise<Attachment[]>;
  /** The bytes of a saved file. */
  downloadAttachment: (requestId: string, attachmentId: string) => Promise<Blob>;
  /** Name another team lead, by email, for a request of the signed-in user that waits for its first decision. Both leads are emailed. */
  changeTeamLead: (requestId: string, email: string) => Promise<void>;
  /** The people a request can be assigned to: the members of the Procurement groups. */
  listTeamMembers: () => Promise<Person[]>;
  /** Replace the budget details of an approved or assigned request. */
  changeBudget: (requestId: string, change: BudgetChange) => Promise<void>;
  /** Let a person, by email, read an approved or assigned request. */
  addCollaborator: (requestId: string, email: string) => Promise<void>;
  /** Take a collaborator off a request. */
  removeCollaborator: (requestId: string, email: string) => Promise<void>;
}

/** Whether a dev build should serve sample data in place of the missing backend. */
export function isProcurementMockActive(): boolean {
  return import.meta.env.DEV && isPreviewEnabled("procurement") && !isProcurementBackendConfigured();
}

/** Whether Procurement has any data source at all; false means "not connected". */
export function isProcurementAvailable(): boolean {
  return isProcurementBackendConfigured() || isProcurementMockActive();
}

/** The lists the form draws its budget fields from, as the backend names them. */
const REFERENCE_TYPES = ["BUDGET_CATEGORY", "BUSINESS_UNIT", "PRODUCT", "REGION"] as const;

/** My Requests shows one page of this many, the most the backend allows. */
const REQUEST_PAGE_SIZE = 100;

/** The most pages read of the queue to find the requests assigned to one person, so a fault in the paging cannot read for ever. */
const MAX_QUEUE_PAGES = 50;

const ALREADY_SUBMITTED = "This request was already submitted. Check My Requests before sending it again.";

/**
 * The backend saves a request as a draft and submits it in a second call. A submit that
 * fails after the draft was saved leaves the draft behind, so the next attempt of the same
 * user saves over it instead of leaving another draft in My Requests. A draft the backend
 * no longer accepts changes to was submitted by an earlier attempt, so it is never saved again.
 *
 * Writes answer from the backend's own reply and do not read the request back: a read that
 * fails after a write has gone through must not look like the write failing. The screens
 * refresh what they show through the queries the hooks invalidate.
 */
function createHttpProcurementApi(getAccessToken: () => Promise<string>, user: Person): ProcurementApi {
  const get = async <T>(url: string): Promise<T> => authedGet<T>(url, await getAccessToken());
  let leftoverDraftId: string | null = null;

  const saveDraft = async (input: PurchaseRequestInput): Promise<string> => {
    const body = toNewRequest(input);
    if (leftoverDraftId) {
      try {
        await authedPut(urls.request(leftoverDraftId), await getAccessToken(), body);
        return leftoverDraftId;
      } catch (error) {
        if (!(error instanceof HttpError) || (error.status !== 404 && error.status !== 409)) throw error;
        leftoverDraftId = null;
        if (error.status === 409) throw new Error(ALREADY_SUBMITTED);
      }
    }
    const created = await authedPost<BackendCreatedRequest>(urls.createRequest, await getAccessToken(), body);
    if (!created) throw new Error("The request could not be saved.");
    leftoverDraftId = String(created.id);
    return leftoverDraftId;
  };

  /** What this session has uploaded to each request, by the file chosen: the id the backend gave it. */
  const uploaded = new Map<string, Map<File, string>>();

  /** Removes a file from a request; a file the backend no longer has counts as removed. */
  const removeAttachment = async (requestId: string, attachmentId: string): Promise<void> => {
    try {
      await authedDelete(urls.attachment(requestId, attachmentId), await getAccessToken());
    } catch (error) {
      if (!(error instanceof HttpError) || error.status !== 404) throw error;
    }
  };

  /**
   * Makes the request's files match the requester's choice: removes what they took off, removes what an
   * earlier attempt uploaded and they have since dropped, and uploads what is new, one file at a time.
   * A file this session already uploaded is not uploaded again, so a retry after a failure part-way does
   * not attach it twice, and two different files with the same name and size are never taken for one.
   */
  const syncAttachments = async (requestId: string, { removed, files }: PurchaseRequestInput["attachments"]): Promise<void> => {
    for (const id of removed) await removeAttachment(requestId, id);
    const done = uploaded.get(requestId) ?? new Map<File, string>();
    uploaded.set(requestId, done);
    for (const [file, id] of done) {
      if (files.includes(file)) continue;
      await removeAttachment(requestId, id);
      done.delete(file);
    }
    for (const file of files) {
      if (done.has(file)) continue;
      const body = new FormData();
      body.append("file", file, file.name);
      const url = urls.attachments(requestId);
      const res = await fetchWithReauth(url, { method: "POST", body }, await getAccessToken());
      if (!res.ok) {
        const message = describeError(new HttpError(url, res.status, await res.text().catch(() => "")));
        throw new Error(`"${file.name}" could not be attached. ${message}`);
      }
      const created = (await res.json().catch(() => null)) as Partial<Pick<BackendAttachment, "id">> | null;
      if (typeof created?.id !== "number") throw new Error(`"${file.name}" could not be attached. The answer to the upload was not understood.`);
      done.set(file, String(created.id));
    }
  };

  const submitSaved = async (requestId: string, declarationAccepted: boolean): Promise<SubmittedRequest> => {
    const submitted = await authedPost<BackendUpdatedRequest>(urls.submitRequest(requestId), await getAccessToken(), {
      commitmentConfirmed: declarationAccepted,
    });
    return { id: requestId, reference: submitted?.referenceNo ?? null };
  };

  return {
    // A user who is not in the HR data gets an error from the team lead lookup, so the form cannot open for them.
    getMe: async () => {
      const [backendUser, lead] = await Promise.all([get<BackendUser>(urls.me), get<BackendTeamLeadResult>(urls.meTeamLead)]);
      return toMe(backendUser, lead, user);
    },
    getLookups: async () => {
      const [budgetCategories, businessUnits, products, regions] = await Promise.all(
        REFERENCE_TYPES.map((type) => get<BackendReferenceItem[]>(urls.referenceData(type))),
      );
      return {
        budgetCategories: toChoices(budgetCategories),
        businessUnits: toChoices(businessUnits),
        products: toChoices(products),
        regions: toChoices(regions),
      };
    },
    getBudgetApprovers: async ({ businessUnit, region }) =>
      businessUnit || region ? toBudgetApprovers(await get<BackendBudgetApprover[]>(urls.budgetApprovers(businessUnit, region))) : [],
    getEngagementCodes: async (businessUnitName) =>
      businessUnitName ? toEngagementChoices(await get<BackendEngagementOption[]>(urls.engagementCodes(businessUnitName))) : [],
    searchDirectory: async (query, leadsOnly) =>
      (await get<BackendDirectoryUser[]>(urls.directoryEmployees(query, leadsOnly))).map(toPerson),
    listMyRequests: async () => (await get<BackendRequestSummary[]>(urls.requests(REQUEST_PAGE_SIZE))).map(toSummary),
    getRequest: async (requestId) => toRequest(await get<BackendRequestDetail>(urls.request(requestId))),
    submitRequest: async (input) => {
      const requestId = await saveDraft(input);
      await syncAttachments(requestId, input.attachments);
      const submitted = await submitSaved(requestId, input.declarationAccepted);
      leftoverDraftId = null;
      uploaded.delete(requestId);
      return submitted;
    },
    resubmitRequest: async (requestId, input) => {
      await authedPut(urls.request(requestId), await getAccessToken(), toNewRequest(input));
      await syncAttachments(requestId, input.attachments);
      await submitSaved(requestId, input.declarationAccepted);
      uploaded.delete(requestId);
    },
    listApprovals: async (status) =>
      (await get<BackendApprovalItem[]>(urls.approvals(REQUEST_PAGE_SIZE, status && toBackendStatus(status)))).map(toApprovalItem),
    decideRequest: async (requestId, decision) => {
      await authedPost(urls.decideRequest(requestId), await getAccessToken(), toNewDecision(decision));
    },
    overrideRequest: async (requestId, input) => {
      await authedPost(urls.overrideRequest(requestId), await getAccessToken(), toNewOverride(input));
    },
    listTeamQueue: async ({ status, priority, assignee } = {}) => {
      const page = async (offset: number): Promise<QueueItem[]> =>
        (await get<BackendProcurementItem[]>(urls.teamQueue(REQUEST_PAGE_SIZE, status && toBackendStatus(status), priority, offset))).map(toQueueItem);
      if (!assignee) return page(0);
      const mine: QueueItem[] = [];
      for (let index = 0; index < MAX_QUEUE_PAGES; index += 1) {
        const rows = await page(index * REQUEST_PAGE_SIZE);
        mine.push(...rows.filter((r) => r.assignee.toLowerCase() === assignee.toLowerCase()));
        if (rows.length < REQUEST_PAGE_SIZE) return mine;
      }
      // Every permitted page was full, so the queue may go on, and what was found is not the whole answer.
      throw new Error("There are too many requests in the queue to find all the ones assigned to you.");
    },
    assignRequest: async (requestId, email) => {
      await authedPost(urls.assignRequest(requestId, email), await getAccessToken(), {});
    },
    unassignRequest: async (requestId) => {
      await authedPost(urls.unassignRequest(requestId), await getAccessToken(), {});
    },
    setPriority: async (requestId, priority) => {
      await authedPut(urls.requestPriority(requestId), await getAccessToken(), { priority });
    },
    cancelRequest: async (requestId) => {
      await authedPost(urls.cancelRequest(requestId), await getAccessToken(), {});
    },
    listAttachments: async (requestId) => (await get<BackendAttachment[]>(urls.attachments(requestId))).map(toAttachment),
    downloadAttachment: async (requestId, attachmentId) => {
      const url = urls.attachment(requestId, attachmentId);
      const res = await fetchWithReauth(url, {}, await getAccessToken());
      if (!res.ok) throw new HttpError(url, res.status, await res.text().catch(() => ""));
      return res.blob();
    },
    changeTeamLead: async (requestId, email) => {
      await authedPut(urls.requestTeamLead(requestId), await getAccessToken(), { email });
    },
    listTeamMembers: async () => (await get<BackendDirectoryUser[]>(urls.teamMembers)).map(toPerson),
    changeBudget: async (requestId, change) => {
      await authedPut(urls.requestBudget(requestId), await getAccessToken(), toBackendBudgetChange(change));
    },
    addCollaborator: async (requestId, email) => {
      await authedPost(urls.requestCollaborators(requestId), await getAccessToken(), { email });
    },
    removeCollaborator: async (requestId, email) => {
      await authedDelete(urls.requestCollaborator(requestId, email), await getAccessToken());
    },
  };
}

/**
 * The API for the signed-in user.
 *
 * @param getAccessToken - Resolves the current access token
 * @param user - The signed-in user's identity, which the sample data stands in for the backend with
 */
export function createProcurementApi(getAccessToken: () => Promise<string>, user: Person): ProcurementApi {
  return isProcurementMockActive() ? createMockProcurementApi(user) : createHttpProcurementApi(getAccessToken, user);
}
