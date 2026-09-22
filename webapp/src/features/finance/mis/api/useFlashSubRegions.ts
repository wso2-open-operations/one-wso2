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
import { useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet, humanizeHttpError } from "@api/http";
import { httpRetry } from "@api/errors";
import { useAccessToken } from "@hooks/useAccessToken";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { isMisFlashConfigured, misFlashServiceUrls } from "@config/apiConfig";
import type { MisFlashRange } from "../util/misFlashPeriods";
import { flashSubRegionGroups, type FlashSubRegionGroup } from "../util/misFlashSubRegions";
import { arrayIn } from "./misResponseArray";

// `GET /sub-regions` — what the Sub Region filter is made of.
//
// Keyed by the date range, and that is the interesting part: this is NOT a
// reference list like the ARR backend's `/app-configs`. The endpoint answers
// with the sub-regions PRESENT IN THE DATA over those dates, so the menu
// narrows as the range moves and a region offered at one range can be absent at
// another. `flashSubRegionsFor` is what stops a selection outliving its option.
//
// It follows the range rather than the draft: the source refetches on
// `dateFilter`, which is the range the P&L was last fetched with. So changing a
// month picker does not move this menu until Search is pressed — the menu and
// the statement below it always describe the same period.
//
// An hour of staleTime, as `/app-configs` takes: a sub-region is not created
// during a reading session, and the range is in the key, so moving the range
// back and forth re-reads nothing.

export interface FlashSubRegionsState {
  /** The menu, empty until the call answers. */
  groups: FlashSubRegionGroup[];
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  retry: () => void;
}

const ONE_HOUR = 60 * 60 * 1000;

export function useFlashSubRegions(range: MisFlashRange): FlashSubRegionsState {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;

  const url = useMemo(() => {
    const parameters = new URLSearchParams({
      startDate: range.startDate,
      endDate: range.endDate,
    });
    return `${misFlashServiceUrls.subRegions}?${parameters.toString()}`;
  }, [range]);

  const query = useQuery<string[], Error>({
    queryKey: ["mis", "sub-regions", userSub, url],
    enabled: isSignedIn && isMisFlashConfigured() && Boolean(userSub),
    queryFn: async () => arrayIn<string>(await authedGet<unknown>(url, await getAccessToken())),
    staleTime: ONE_HOUR,
    retry: httpRetry,
  });

  const folded = foldIdentityError(query, subState, retryIdentity);
  const groups = useMemo(() => flashSubRegionGroups(folded.data ?? []), [folded.data]);

  return {
    groups,
    isLoading: folded.isPending && folded.fetchStatus !== "idle",
    isError: folded.isError,
    errorMessage: folded.error ? humanizeHttpError(folded.error) : "",
    retry: () => void folded.refetch(),
  };
}
