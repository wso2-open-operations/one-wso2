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

import { useMemo } from "react";
import type { Meeting } from "../../api/salesTypes";
import { callInsight, type CallInsight } from "../util/callInsight";
import type { DealDetail, MeetingCoverage } from "../types";
import { isEchoBackendConfigured, useDeal, useMeetingCoverage } from "./useMeddpiccData";

export interface CallMeddpicc {
  /** False when ONE_WSO2_ECHO_BACKEND_URL is unset: the page leaves MEDDPICC out. */
  configured: boolean;
  coverage: MeetingCoverage | undefined;
  coverageLoading: boolean;
  coverageError: unknown;
  retryCoverage: () => void;
  /** The deal the call belongs to: the backend's link first, then the meeting's own. */
  opportunityId: string | null;
  deal: DealDetail | undefined;
  dealLoading: boolean;
  dealError: unknown;
  retryDeal: () => void;
  insight: CallInsight;
}

/**
 * One call's MEDDPICC, for the meeting page: its coverage, the deal it belongs to, and
 * what it contributed to that deal.
 *
 * The same two requests the meetings table and the deal page make, keyed the same way,
 * so arriving from either is a cache hit.
 */
export function useCallMeddpicc(meeting: Meeting | null | undefined): CallMeddpicc {
  const configured = isEchoBackendConfigured();
  const meetingId = meeting?.meetingId ?? null;
  const ids = useMemo(() => (configured && meetingId !== null ? [meetingId] : []), [configured, meetingId]);
  const coverageQuery = useMeetingCoverage(ids);
  const coverage = meetingId !== null ? coverageQuery.byId.get(meetingId) : undefined;
  const opportunityId = configured ? (coverage?.opportunityId ?? meeting?.opportunityId ?? null) : null;
  const dealQuery = useDeal(opportunityId);

  const insight = useMemo(
    () => callInsight(meetingId ?? -1, coverage, dealQuery.data),
    [meetingId, coverage, dealQuery.data],
  );

  return {
    configured,
    coverage,
    coverageLoading: coverageQuery.isLoading,
    coverageError: coverageQuery.error,
    retryCoverage: () => void coverageQuery.refetch(),
    opportunityId,
    deal: dealQuery.data,
    dealLoading: dealQuery.isLoading,
    dealError: dealQuery.error,
    retryDeal: () => void dealQuery.refetch(),
    insight,
  };
}
