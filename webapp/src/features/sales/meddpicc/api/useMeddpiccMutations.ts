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

// Writes to the MEDDPICC backend.
//
// No retries, as in useSalesMutations: every refusal here (403 edit rights,
// 409 Gate incomplete, 422 Salesforce said no) is an answer, not a blip, and a
// retried write to Salesforce is a second write.
//
// No toasts either. The deal page owns the wording, and the 409/422 answers belong
// next to the button that produced them.

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { HttpError } from "@api/http";
import { describeError } from "../../util/salesError";
import type {
  ApproveRequest,
  ApproveResult,
  DealDetail,
  MoveStageConflict,
  MoveStageRefusal,
  MoveStageResult,
} from "../types";
import { useMeddpiccBasis } from "./useMeddpiccData";

/** Put a fresh DealDetail in the deal page's cache, and mark every list stale. */
async function afterDealChange(
  qc: QueryClient,
  key: readonly unknown[],
  detail: DealDetail | null,
): Promise<void> {
  if (detail) qc.setQueryData(key, detail);
  else await qc.invalidateQueries({ queryKey: key });
  // The list's circles and pending counts, and the meetings table's links to
  // this deal, all changed with it.
  await Promise.all([
    qc.invalidateQueries({ queryKey: ["meddpicc-deals"] }),
    qc.invalidateQueries({ queryKey: ["meddpicc-coverage"] }),
  ]);
}

/**
 * POST /deals/{id}/approve.
 *
 * A Salesforce refusal is NOT a thrown error: the contract returns it inside a
 * 200 as `error`, alongside the deal as it now stands, so the caller reads
 * `result.error` rather than catching.
 */
export function useApproveDeal(opportunityId: string) {
  const { client, userSub } = useMeddpiccBasis();
  const qc = useQueryClient();
  return useMutation<ApproveResult, Error, ApproveRequest>({
    mutationFn: (request) => client.approve(opportunityId, request),
    onSuccess: (result) =>
      afterDealChange(qc, ["meddpicc-deal", userSub, opportunityId], result.deal),
  });
}

/** POST /deals/{id}/move-stage. Read failures with describeMoveStageError. */
export function useMoveStage(opportunityId: string) {
  const { client, userSub } = useMeddpiccBasis();
  const qc = useQueryClient();
  return useMutation<MoveStageResult, Error, string>({
    mutationFn: (toStage) => client.moveStage(opportunityId, toStage),
    // The response carries only the new stage, so the deal is fetched again.
    onSuccess: () => afterDealChange(qc, ["meddpicc-deal", userSub, opportunityId], null),
  });
}

/** POST /deals/{id}/include-calls. Answers the new DealDetail. */
export function useIncludeCalls(opportunityId: string) {
  const { client, userSub } = useMeddpiccBasis();
  const qc = useQueryClient();
  return useMutation<DealDetail, Error, number[]>({
    mutationFn: (meetingIds) => client.includeCalls(opportunityId, meetingIds),
    onSuccess: (detail) => afterDealChange(qc, ["meddpicc-deal", userSub, opportunityId], detail),
  });
}

/** POST /meetings/{id}/reanalyse — 202; the coverage query then polls until it's done. */
export function useReanalyseMeeting() {
  const { client } = useMeddpiccBasis();
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: (meetingId) => client.reanalyse(meetingId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["meddpicc-coverage"] });
    },
  });
}

export type MoveStageFailure =
  | { kind: "incomplete"; message: string; incomplete: string[] }
  | { kind: "refused"; message: string; salesforceUrl: string | null }
  | { kind: "other"; message: string };

/**
 * What a failed Move stage should say.
 *
 * 409 (the Gate is incomplete) lists the blocking fields; 422 (Salesforce
 * refused) carries Salesforce's own message, shown verbatim, and where to fix
 * it. Anything else is an ordinary error.
 */
export function describeMoveStageError(error: unknown): MoveStageFailure {
  if (error instanceof HttpError && (error.status === 409 || error.status === 422)) {
    let body: Partial<MoveStageConflict & MoveStageRefusal> = {};
    try {
      body = JSON.parse(error.responseBody) as Partial<MoveStageConflict & MoveStageRefusal>;
    } catch {
      // No readable body; fall through with defaults.
    }
    if (error.status === 409) {
      return {
        kind: "incomplete",
        message: body.message || "The Gate isn't complete yet.",
        incomplete: Array.isArray(body.incomplete) ? body.incomplete : [],
      };
    }
    return {
      kind: "refused",
      message: body.message || "Salesforce refused the stage change.",
      salesforceUrl: typeof body.salesforceUrl === "string" ? body.salesforceUrl : null,
    };
  }
  return { kind: "other", message: describeError(error) };
}
