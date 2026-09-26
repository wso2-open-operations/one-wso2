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

import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useAccessToken } from "@hooks/useAccessToken";
import { meApi } from "../api/client";

export type CurrentUser = { email: string; role: string };

// Fallback for when a proxy or gateway strips the response body: the person
// must still see why they were refused, not a blank page.
const FALLBACK_FORBIDDEN_MESSAGE =
  "You do not have access to the Evidence App. Ask an administrator to assign you the compliance evidence engineer role in Asgardeo.";

/**
 * Returns the currently logged-in user (from /api/me) — the Asgardeo JWT
 * principal, resolved by the backend from the Bearer token.
 *
 * `enabled` (default true) lets a caller that only sometimes needs this
 * answer — the Security gate, when the Evidence backend isn't configured or
 * the gate itself is disabled — skip the request entirely rather than fire
 * it and throw the result away.
 *
 * Reads the access token itself via One WSO2's own `useAccessToken`, the
 * same accessor `useEvidencePortalAuth` hands to `registerAuth`, rather than
 * relying on `registerAuth` having already been called. The Evidence route
 * layout (EvidencePortalLayout) is the ONLY thing that calls `registerAuth`,
 * and it is mounted only under /security/evidence/* — but the Security side
 * rail asks this same question (via the gate, folding this hook in) on
 * EVERY Security page, well before that layout exists. Fetching the token
 * directly here, the same way the lifted GRC hooks fetch theirs
 * (shim/useAuthApiClient.ts) rather than through a shared registration,
 * means this works identically whichever caller mounts first — and because
 * the query key stays exactly "me", the gate and a mounted Evidence page
 * still share one cached answer instead of asking twice.
 *
 * Convenience flags:
 *   isAdmin          — show admin UI (Cost page, delete buttons, etc.)
 *   isLoaded         — first /me roundtrip has finished
 *   isForbidden      — /me came back 403: signed in, but no role in this app
 *   forbiddenMessage — the backend's own explanation, for isForbidden
 */
export function useCurrentUser(enabled = true) {
  const getAccessToken = useAccessToken();
  const query = useQuery<CurrentUser>({
    queryKey: ["me"],
    queryFn: async () => meApi.whoami(await getAccessToken()),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 min — identity rarely changes within a session
    // A 403 leaves the query with no data, and by default a newly mounted
    // component re-runs a failed query like that, which resets it to
    // loading. False here means any component reading this hook cannot
    // restart the refusal.
    retryOnMount: false,
    // A 4xx here will never turn into a 200 on retry, so retrying wastes
    // seconds a person with no role would spend staring at a spinner.
    // 408 and 429 are the exceptions: a timeout or a rate limit can succeed
    // on a second try. Everything else still gets one retry rather than the
    // library default of three, so a real transient failure still recovers.
    retry: (failureCount, error) => {
      const status = isAxiosError(error) ? error.response?.status : undefined;
      if (status !== undefined && status >= 400 && status < 500 && status !== 408 && status !== 429) {
        return false;
      }
      return failureCount < 1;
    },
  });

  const axiosError = isAxiosError(query.error) ? query.error : undefined;
  const isForbidden = axiosError?.response?.status === 403;
  const detail = (axiosError?.response?.data as { detail?: string } | undefined)?.detail;

  return {
    user: query.data,
    isLoaded: !query.isPending,
    isAdmin: query.data?.role === "admin",
    isEngineer: query.data?.role === "engineer",
    error: query.error,
    isForbidden,
    forbiddenMessage: isForbidden ? (detail ?? FALLBACK_FORBIDDEN_MESSAGE) : undefined,
  };
}
