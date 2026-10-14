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

// The eight routes of contract §3.6, behind one interface: the backend over
// HTTP here, and an in-memory test double in ../mock that the tests swap in,
// so they exercise the same loading, error and cache paths the real screens do.

import { HttpError, authedGet, authedPost } from "@api/http";
import { buildDealsUrl, echoServiceUrls } from "@config/apiConfig";
import type {
  AskAnswer,
  AskRequest,
  ApproveRequest,
  ApproveResult,
  DealDetail,
  DealList,
  GatesResponse,
  IncludeCallsRequest,
  MeetingCoverageList,
  MeetingCoverageRequest,
  MoveStageRequest,
  MoveStageResult,
} from "../types";

export interface DealsQuery {
  search: string | null;
  owner: string | null;
  stage: string | null;
  hideClosed: boolean;
}

export interface MeddpiccClient {
  gates(): Promise<GatesResponse>;
  meetingCoverage(meetingIds: number[]): Promise<MeetingCoverageList>;
  reanalyse(meetingId: number): Promise<void>;
  deals(query: DealsQuery): Promise<DealList>;
  deal(opportunityId: string): Promise<DealDetail>;
  approve(opportunityId: string, request: ApproveRequest): Promise<ApproveResult>;
  moveStage(opportunityId: string, toStage: string): Promise<MoveStageResult>;
  includeCalls(opportunityId: string, meetingIds: number[]): Promise<DealDetail>;
  ask(opportunityId: string, request: AskRequest): Promise<AskAnswer>;
}

/** The contract's cap on one coverage request. */
export const COVERAGE_BATCH_LIMIT = 200;

/**
 * authedPost answers null on an empty 2xx. Every route here that returns a body
 * is specified to, so an empty one is a broken response, reported as such
 * rather than surfacing later as "cannot read properties of null".
 */
function required<T>(url: string, value: T | null): T {
  if (value === null) throw new HttpError(url, 502, "");
  return value;
}

export function httpMeddpiccClient(getAccessToken: () => Promise<string>): MeddpiccClient {
  return {
    gates: async () => authedGet<GatesResponse>(echoServiceUrls.gates, await getAccessToken()),
    meetingCoverage: async (meetingIds) => {
      const body: MeetingCoverageRequest = { meetingIds };
      const url = echoServiceUrls.meetingCoverage;
      return required(url, await authedPost<MeetingCoverageList>(url, await getAccessToken(), body));
    },
    reanalyse: async (meetingId) => {
      await authedPost<unknown>(echoServiceUrls.reanalyse(meetingId), await getAccessToken(), {});
    },
    deals: async (query) => authedGet<DealList>(buildDealsUrl(query), await getAccessToken()),
    deal: async (opportunityId) =>
      authedGet<DealDetail>(echoServiceUrls.deal(opportunityId), await getAccessToken()),
    approve: async (opportunityId, request) => {
      const url = echoServiceUrls.approve(opportunityId);
      return required(url, await authedPost<ApproveResult>(url, await getAccessToken(), request));
    },
    moveStage: async (opportunityId, toStage) => {
      const body: MoveStageRequest = { toStage };
      const url = echoServiceUrls.moveStage(opportunityId);
      return required(url, await authedPost<MoveStageResult>(url, await getAccessToken(), body));
    },
    includeCalls: async (opportunityId, meetingIds) => {
      const body: IncludeCallsRequest = { meetingIds };
      const url = echoServiceUrls.includeCalls(opportunityId);
      return required(url, await authedPost<DealDetail>(url, await getAccessToken(), body));
    },
    ask: async (opportunityId, request) => {
      const url = echoServiceUrls.ask(opportunityId);
      return required(url, await authedPost<AskAnswer>(url, await getAccessToken(), request));
    },
  };
}
