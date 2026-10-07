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

// Who may maintain the four Master Data tables — asked of the finance
// master-data backend itself, the way CC's rail rows ask cc-expenses.
//
// This replaces a gate on people-app privilege 999 (`admin`). That privilege
// is the portal's GENERIC administrator and has nothing to do with finance —
// it also opens ~50 unrelated rows across MIS, Marketing Ops, Due Diligence
// and Infra — so using it here was wrong in both directions at once:
//
//  - a portal admin saw all four rail rows and was then refused by the
//    backend, which gates on the `app-finance-masterdata-admin` group;
//  - the finance staff who actually hold that group saw nothing at all,
//    because almost none of them hold 999.
//
// The backend now reports its own verdict (`UserInfo.privileges`, derived in
// its `modules/utils/privileges.bal` from the same group check it enforces),
// so the rail and the route can agree with it exactly — no row that 403s, and
// no screen hidden from the person who maintains it. `financeApps.ts` says why
// the portal had no finance capability to use instead: "One WSO2 has no
// dedicated Finance privilege number."

import { useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import {
  financeMasterDataServiceUrls,
  isFinanceMasterDataBackendConfigured,
} from "@config/apiConfig";
import { financeRetry } from "../util/financeError";

/**
 * What this backend says a reader may do. One level today — see the
 * `AccessLevel` note in the backend's `modules/types/types.bal` for why it is
 * still carried as a list.
 */
export type MasterDataAccessLevel = "admin";

/** The master-data backend's `/user-info`. */
export interface MasterDataUserInfo {
  image: string | null;
  email: string;
  /**
   * Optional on the way IN only. A deployment still running the build whose
   * `/user-info` returned just an email and an avatar sends no `privileges`
   * at all, and `undefined` has to read as "no" rather than crash the rail —
   * so this stays fail-closed rather than being asserted non-null.
   */
  privileges?: MasterDataAccessLevel[];
}

/**
 * Whether this reader may maintain master data.
 *
 * Same shape as `ccHasAccess`, and fail-closed for the same reasons: a
 * missing field, a null, or a response from an older build all mean no.
 */
export function masterDataHasAccess(
  user: MasterDataUserInfo | undefined,
  level: MasterDataAccessLevel = "admin",
): boolean {
  return Boolean(user?.privileges?.includes(level));
}

/**
 * This reader's master-data record.
 *
 * Keyed on `userSub` like every other per-reader finance query: the four
 * table queries in `useMasterData.ts` are deliberately NOT user-scoped
 * (reference data is the same for everyone, as that file explains), but this
 * one is the opposite — it is entirely about who is asking, so a second
 * account signing into the same tab must not read the first one's answer.
 */
export function useMasterDataUserInfo(enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const configured = isFinanceMasterDataBackendConfigured();

  const query = useQuery<MasterDataUserInfo>({
    queryKey: ["finance-master-data-user-info", userSub],
    enabled: enabled && isSignedIn && configured && Boolean(userSub),
    queryFn: async () =>
      authedGet<MasterDataUserInfo>(
        financeMasterDataServiceUrls.userInfo,
        await getAccessToken(),
      ),
    staleTime: 5 * 60 * 1000,
    retry: financeRetry,
  });

  return foldIdentityError(query, subState, retryIdentity);
}

/** A route guard's or a rail's whole answer about Master Data. */
export interface MasterDataAccess {
  isAdmin: boolean;
  /**
   * Identity or this backend has not finished answering. Callers WAIT on
   * this rather than refusing: treating "not yet known" as "no" would throw
   * a genuine maintainer off the screen on every cold load.
   */
  isResolving: boolean;
  /**
   * The lookup failed, as opposed to answering no. Kept separate so the
   * route can offer a retry instead of silently redirecting someone who has
   * nothing to act on — and so a bad minute from this backend never reads as
   * a grant.
   */
  isError: boolean;
  error: unknown;
  retry: () => void;
}

/**
 * Master Data access, resolved against the backend that owns it.
 *
 * Asks exactly this one backend and nothing else. `MasterDataRoute` is the
 * caller that forced that: built on the full `useFinanceGate`, it blocked on
 * the CC, OPD and Expense queries' loading state, so a slow or erroring one
 * of those in some environment held this page on a blank screen for a reader
 * who was always going to be let in. Those three have nothing to say about
 * who maintains reference data.
 *
 * An environment with no master-data URL configured resolves to "no": there
 * is no backend to admit anyone, and the screens behind it render their own
 * not-configured state anyway (`MasterDataScreen`).
 */
export function useMasterDataAccess(enabled = true): MasterDataAccess {
  const query = useMasterDataUserInfo(enabled);
  const configured = isFinanceMasterDataBackendConfigured();

  // Monotonic per identity, matching `useFinanceGate`'s `hasAnswered`:
  // `isLoading` is `isPending && isFetching`, so it reads false in the gap
  // between a failed attempt and its retry and true again when the retry
  // fires — settled, unsettled, settled, with nothing about this reader
  // having changed. A route that renders nothing while resolving would blank
  // and come back on that. `isSuccess`/`isError` are terminal in React Query,
  // so neither goes back to false for a given key.
  const answered = !enabled || !configured || query.isSuccess || query.isError;

  return {
    isAdmin: masterDataHasAccess(query.data),
    isResolving: !answered,
    isError: query.isError,
    error: query.error,
    retry: () => void query.refetch(),
  };
}
