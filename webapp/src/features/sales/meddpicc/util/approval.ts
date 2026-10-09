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

// What the deal page sends on Approve all, kept out of the component so the
// rules can be tested on their own.
//
// The backend owns the semantics (contract §3.6, "Approve all semantics"): a
// field's final value is the AM's edit when there is one, otherwise the pending
// Proposal. This file only decides what the AM has said, and whether the
// request is complete enough to send — the backend answers 400 to a pending
// role Proposal with neither a contact match nor a clear.

import type { ApproveRequest, DealField, FieldValue } from "../types";
import { isRoleProposal } from "./meddpiccFormat";

/** The AM's unsaved answers on the deal page. */
export interface ApprovalDraft {
  /** fieldKey -> value. null means "clear" (for a role: "not known, leave unset"). */
  edits: Record<string, FieldValue>;
  /** Role fieldKey -> the Contact the AM matched the proposed person to. */
  roleMatches: Record<string, string>;
}

export const EMPTY_DRAFT: ApprovalDraft = { edits: {}, roleMatches: {} };

/** Role fields whose Proposal is waiting for approval. */
export function pendingRoleFields(fields: readonly DealField[]): DealField[] {
  return fields.filter((field) => field.kind === "role" && field.proposal?.pending);
}

/**
 * The contact picker's starting point: the backend's suggested Contact for
 * every pending role, where it had one confident enough to suggest.
 */
export function initialRoleMatches(fields: readonly DealField[]): Record<string, string> {
  const matches: Record<string, string> = {};
  for (const field of pendingRoleFields(fields)) {
    const value = field.proposal?.value;
    if (isRoleProposal(value) && value.suggestedContactId) {
      matches[field.key] = value.suggestedContactId;
    }
  }
  return matches;
}

function hasEdit(draft: ApprovalDraft, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(draft.edits, key);
}

/**
 * Pending role Proposals the AM has neither matched to a Contact nor cleared.
 * Approve all stays disabled while this is non-empty.
 */
export function unmatchedRoles(fields: readonly DealField[], draft: ApprovalDraft): DealField[] {
  return pendingRoleFields(fields).filter(
    (field) => !(hasEdit(draft, field.key) && draft.edits[field.key] === null) && !draft.roleMatches[field.key],
  );
}

/** True when Approve all would change something: a pending Proposal, or an edit. */
export function hasSomethingToApprove(fields: readonly DealField[], draft: ApprovalDraft): boolean {
  return fields.some((field) => field.proposal?.pending || hasEdit(draft, field.key));
}

/**
 * The request body for POST /deals/{id}/approve.
 *
 * Only keys the deal actually has are sent, and only for fields an AM can
 * answer here — a Salesforce-only field is filled in Salesforce. A role's edit
 * can only be a clear; picking a Contact is a roleMatch, and a role that was
 * cleared sends no match alongside it.
 */
export function buildApproveRequest(fields: readonly DealField[], draft: ApprovalDraft): ApproveRequest {
  const edits: Record<string, FieldValue> = {};
  const roleMatches: Record<string, string> = {};

  for (const field of fields) {
    if (!field.conversational || field.kind === "salesforceOnly") continue;
    const edited = hasEdit(draft, field.key);

    if (field.kind === "role") {
      if (edited && draft.edits[field.key] === null) {
        edits[field.key] = null;
        continue;
      }
      const match = draft.roleMatches[field.key];
      if (match && field.proposal?.pending) roleMatches[field.key] = match;
      continue;
    }

    if (edited) edits[field.key] = draft.edits[field.key];
  }

  return { edits, roleMatches };
}
