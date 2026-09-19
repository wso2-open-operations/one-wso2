// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy at
// http://www.apache.org/licenses/LICENSE-2.0

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authedPut } from "@api/http";
import { umtServiceUrls } from "@config/apiConfig";
import { useAccessToken } from "@hooks/useAccessToken";

// Completing an update is the one real transition out of Verifying: unlike
// every other wired step's Proceed, it isn't a bare lifecycleState PUT — it
// also carries the public pull requests (or a reason to skip one) that
// justify completing without a real transition target from promoteStages.
// Same endpoint as useUmtLifecycleTransition, but a narrower invalidation
// set: Completed has no PR-analysis or product-analysis step ahead of it,
// so those two query keys aren't invalidated here.
export function useUmtCompleteUpdate(id: string) {
  const getAccessToken = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation<void, Error, { publicPullRequests: string[]; reason: string }>({
    mutationFn: async ({ publicPullRequests, reason }) => {
      const accessToken = await getAccessToken();
      await authedPut(umtServiceUrls.update(id), accessToken, {
        lifecycleState: "Completed",
        publicPullRequests,
        reason,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["umt-update"] }),
        queryClient.invalidateQueries({ queryKey: ["umt-updates"] }),
        queryClient.invalidateQueries({ queryKey: ["umt-update-lifecycle-history"] }),
      ]);
    },
  });
}
