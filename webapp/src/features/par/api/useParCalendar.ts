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

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet, authedPost, defaultQueryRetry } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { parBackendUrl, parServiceUrls } from "@config/apiConfig";
import { digiopsHeaders } from "@features/my/util/digiopsHeaders";
import type { ParFreeBusyResponse, ParScheduleF2fRequest } from "./types";

// GET the caller's and their lead's busy periods for one day — the backend
// resolves the lead; only `date` is sent. Only fires once a date is picked.
export function useCalendarBusyTimes(date: string | undefined) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const backendConfigured = Boolean(parBackendUrl);
  return useQuery<ParFreeBusyResponse>({
    queryKey: ["par-calendar-busy-times", date],
    enabled: isSignedIn && backendConfigured && Boolean(date),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<ParFreeBusyResponse>(
        parServiceUrls.calendarBusyTimes(date!),
        accessToken,
        digiopsHeaders(),
      );
    },
    // Busy periods can change between one check and the next; short-lived
    // rather than the 5-10 min staleTime the rest of this feature uses.
    staleTime: 30 * 1000,
    retry: defaultQueryRetry,
  });
}

// POST the chosen slot + meeting details — creates the Google Calendar
// event server-side and emails both attendees the invite. Returns a bare
// 201 with no body (see parServiceUrls.calendarScheduleF2f), so there is
// nothing to read back beyond success/failure.
export function useScheduleF2fMeeting(parCycleId: number | undefined, workEmail: string | undefined) {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<void, Error, ParScheduleF2fRequest>({
    mutationFn: async (payload) => {
      const accessToken = await getAccessToken();
      await authedPost<void>(parServiceUrls.calendarScheduleF2f(), accessToken, payload, digiopsHeaders());
    },
    onSuccess: async () => {
      // manager.bal's scheduleF2FMeeting flips parF2fStatus to SCHEDULED as
      // a side effect right after creating the calendar event — refetch so
      // the tab picks that up.
      await qc.invalidateQueries({ queryKey: ["par-rating", parCycleId, workEmail] });
    },
  });
}
