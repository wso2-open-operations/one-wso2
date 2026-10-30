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

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authedDelete, authedPost, authedUpload } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { leaveServiceUrls } from "@config/apiConfig";
import type { CalculatedLeave, LeavePayload, LeaveValidationPayload } from "./leaveTypes";

// POST /leaves?isValidationOnlyMode=true — returns computed working days +
// overlap check without creating anything. The Apply form calls this on
// every date/portion change to surface "N working days" and validity.
export function useValidateLeave() {
  const getAccessToken = useAccessToken();
  return useMutation<CalculatedLeave, Error, LeaveValidationPayload>({
    mutationFn: async (payload) => {
      const accessToken = await getAccessToken();
      const res = await authedPost<CalculatedLeave>(
        `${leaveServiceUrls.leaves}?isValidationOnlyMode=true`,
        accessToken,
        payload,
      );
      // Validation mode always returns a body.
      if (!res) throw new Error("Empty validation response");
      return res;
    },
  });
}

// POST /leaves — creates the leave.
//
// Both caches have to go. Submitting spends entitlement, and
// ["leave-entitlement"] carries a five-minute staleTime — invalidating only
// ["leaves"] left the balance panel showing the pre-submit figures for that
// long. The source has the same problem and solves it by remounting the panel
// (GeneralLeave.tsx:148,264); invalidating is the same fix without the remount.
export function useSubmitLeave() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<void, Error, LeavePayload>({
    mutationFn: async (payload) => {
      const accessToken = await getAccessToken();
      await authedPost<unknown>(
        `${leaveServiceUrls.leaves}?isValidationOnlyMode=false`,
        accessToken,
        payload,
      );
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["leaves"] }),
        qc.invalidateQueries({ queryKey: ["leave-entitlement"] }),
        // The app config too, and not for the sabbatical flags: its
        // `cachedEmails.optionalMails` IS the copyEmailList of the caller's
        // most recent request, recomputed server-side on every read
        // (leave-app/backend/utils.bal:648-691). The request just posted
        // changed it. Without this the query's 30-minute staleTime serves the
        // PREVIOUS list, so editing who to notify, submitting, and coming back
        // showed the people from the request before.
        qc.invalidateQueries({ queryKey: ["leave-app-config"] }),
      ]);
    },
  });
}

// POST /leaves/sick-leave — multipart: `leave` (JSON Blob, same body as
// POST /leaves) and `sickNote` (the file). No Content-Type is set by hand;
// authedUpload leaves it to the browser so the boundary is kept.
export function useSubmitSickLeave() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<void, Error, { payload: LeavePayload; sickNote: File }>({
    mutationFn: async ({ payload, sickNote }) => {
      const accessToken = await getAccessToken();
      const form = new FormData();
      form.append("leave", new Blob([JSON.stringify(payload)], { type: "application/json" }));
      form.append("sickNote", sickNote);
      await authedUpload<unknown>(leaveServiceUrls.sickLeave, accessToken, form);
    },
    // Same effects as useSubmitLeave: balance, list and the copy-list config.
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["leaves"] }),
        qc.invalidateQueries({ queryKey: ["leave-entitlement"] }),
        qc.invalidateQueries({ queryKey: ["leave-app-config"] }),
      ]);
    },
  });
}

// DELETE /leaves/{id} — cancels a leave (backend enforces the 30-day
// window and ownership / people-ops rules).
export function useCancelLeave() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: async (id) => {
      const accessToken = await getAccessToken();
      await authedDelete(leaveServiceUrls.leave(id), accessToken);
    },
    // Cancelling returns the days too, so the balance moves here as well.
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["leaves"] }),
        qc.invalidateQueries({ queryKey: ["leave-entitlement"] }),
      ]);
    },
  });
}

// POST /leaves/{id}/{approve|reject} — lead action on a pending leave. The body
// is `{ reason }` when a reason is given, otherwise `{}` (sabbatical calls).
export function useApproveLeave() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<void, Error, { id: number; action: "approve" | "reject"; reason?: string }>({
    mutationFn: async ({ id, action, reason }) => {
      const accessToken = await getAccessToken();
      await authedPost<unknown>(
        leaveServiceUrls.leaveAction(id, action),
        accessToken,
        reason ? { reason } : {},
      );
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["leaves"] });
    },
  });
}
