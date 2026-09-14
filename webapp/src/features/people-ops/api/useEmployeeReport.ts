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

// The two backend calls behind an employee report: the paged preview search
// and the full-dataset CSV generator. Both are ADMIN-only server-side — see
// usePeopleOpsGate for why callers still gate in the UI.

import { useMutation, useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet, authedPost, authedPostText, defaultQueryRetry } from "@api/http";
import { HttpError } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { peopleBackendUrl, peopleServiceUrls } from "@config/apiConfig";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { saveBlob } from "@utils/saveFile";
import type {
  EmployeeReportPayload,
  EmployeeSearchPayload,
  FilteredEmployeesResponse,
  Manager,
} from "./peopleOpsTypes";

export function isPeopleBackendConfigured(): boolean {
  return Boolean(peopleBackendUrl);
}

// A 403 here means "you are not an admin" — a settled answer, not a blip.
// Retrying it just delays the message and burns requests, so stop immediately
// and let the shell explain. Everything else defers to the app-wide policy.
function reportRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof HttpError && error.status === 403) return false;
  return defaultQueryRetry(failureCount, error);
}

// POST /employees/search — one page of the report preview.
//
// `payload` is part of the query key, so changing any filter, page size or
// sort refetches and caches independently. Keep the object stable at the call
// site (useMemo) or every parent render will look like a new query.
export function useEmployeeSearch(payload: EmployeeSearchPayload, enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;

  const query = useQuery<FilteredEmployeesResponse>({
    queryKey: ["people-ops", "employee-search", userSub, payload],
    enabled:
      enabled && isSignedIn && isPeopleBackendConfigured() && Boolean(userSub),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      const res = await authedPost<FilteredEmployeesResponse>(
        peopleServiceUrls.employeesSearch,
        accessToken,
        payload,
      );
      // authedPost returns null on an empty body. The search endpoint always
      // sends a body on success, so treat null as "no rows" rather than
      // letting undefined reach the table.
      return res ?? { employees: [], totalCount: 0 };
    },
    staleTime: 60 * 1000,
    retry: reportRetry,
  });

  return foldIdentityError(query, subState, retryIdentity);
}

// GET /employees/managers — the "Manager Email" options in the filter drawer.
// Rarely changes, so it is cached far longer than the report itself.
export function useManagers(enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;

  const query = useQuery<Manager[]>({
    queryKey: ["people-ops", "managers", userSub],
    enabled:
      enabled && isSignedIn && isPeopleBackendConfigured() && Boolean(userSub),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<Manager[]>(peopleServiceUrls.managers, accessToken);
    },
    staleTime: 30 * 60 * 1000,
    retry: reportRetry,
  });

  return foldIdentityError(query, subState, retryIdentity);
}

// POST /reports/employees/generate — the whole filtered dataset as CSV text.
//
// A mutation rather than a query: it is a user-triggered download with a side
// effect (saving a file), it must never fire on mount or be replayed from
// cache, and its result is handed to the browser rather than rendered.
export function useEmployeeReportDownload() {
  const getAccessToken = useAccessToken();

  return useMutation<string, Error, EmployeeReportPayload>({
    mutationFn: async ({ filters, columns }) => {
      const accessToken = await getAccessToken();
      return authedPostText(peopleServiceUrls.reportsEmployees, accessToken, {
        filters,
        // Omit the key entirely when nothing is selected — the backend reads
        // an absent `columns` as "use the default set", where an empty array
        // would ask for a CSV with no columns at all.
        ...(columns && columns.length > 0 ? { columns } : {}),
      });
    },
  });
}

// Hand a generated CSV to the browser as a download.
//
// The plumbing moved to `@utils/saveFile` when MIS's Excel export needed the
// same thing (ticket 11); only the media type is this module's own.
export function saveCsv(csvText: string, filename: string): void {
  saveBlob(new Blob([csvText], { type: "text/csv;charset=utf-8" }), filename);
}
