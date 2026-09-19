// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy at
// http://www.apache.org/licenses/LICENSE-2.0

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authedPost } from "@api/http";
import { umtServiceUrls } from "@config/apiConfig";
import { useAccessToken } from "@hooks/useAccessToken";
import {
  EMPTY_UMT_UPDATE_FILTERS,
  type UmtCreateUpdateRequest,
  type UmtUpdateSummary,
  type UmtUpdatesResponse,
} from "./umtUpdates";

export function useUmtCreateUpdate() {
  const getAccessToken = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation<UmtUpdateSummary[], Error, UmtCreateUpdateRequest>({
    mutationFn: async (request) => {
      const accessToken = await getAccessToken();
      const response = await authedPost<UmtUpdateSummary[]>(
        umtServiceUrls.createUpdate,
        accessToken,
        request,
      );
      return response ?? [];
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["umt-updates"] }),
        queryClient.invalidateQueries({ queryKey: ["umt-dashboard-stats"] }),
      ]);
    },
  });
}

// Client-side duplicate pre-check: not a dedicated backend endpoint, just
// the same paginated search the Updates list already uses, filtered by
// case ID. A one-shot on-submit check, so this is a mutation (not
// useUmtUpdates' live query) even though it's a GET-shaped search POST.
export function useUmtCheckDuplicateUpdatesByCaseId() {
  const getAccessToken = useAccessToken();

  return useMutation<UmtUpdatesResponse, Error, string>({
    mutationFn: async (caseId) => {
      const accessToken = await getAccessToken();
      const response = await authedPost<UmtUpdatesResponse>(umtServiceUrls.updatesSearch, accessToken, {
        page: 0,
        pageSize: 100,
        filters: { ...EMPTY_UMT_UPDATE_FILTERS, serviceNowCaseId: caseId },
      });
      return response ?? { updates: [], totalPages: 0, pageSize: 100 };
    },
  });
}
