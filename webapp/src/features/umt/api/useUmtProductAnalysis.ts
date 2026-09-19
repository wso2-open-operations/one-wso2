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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authedPut } from "@api/http";
import { umtServiceUrls } from "@config/apiConfig";
import { useAccessToken } from "@hooks/useAccessToken";
import type { UmtProductAnalysisRequest, UmtUpdateProduct } from "./umtUpdates";

// Thrown when the product replace succeeds but the analysis save that follows
// it fails. `productsRestored` tells the caller whether the compensating
// revert (putting `previousProducts` back) itself succeeded, so it can choose
// between "retry analysis" (products are back to what you saw before) and a
// louder warning (the replace is still in effect and needs a manual look).
export class UmtPartialProductAnalysisSaveError extends Error {
  constructor(
    public readonly analysisError: unknown,
    public readonly productsRestored: boolean,
  ) {
    super(
      productsRestored
        ? "Saved the product list, but the analysis failed to save. The product list was reverted — retry Analyze."
        : "Saved the product list, but the analysis failed to save, and reverting the product list also failed.",
    );
    this.name = "UmtPartialProductAnalysisSaveError";
  }
}

// Modifies the update's product list, then resubmits the product-analysis
// result — the "Analyze" action on this step makes both calls together
// (PUT .../products then PUT .../productAnalysis). If the second call fails,
// the first has already committed a full product-list replace on the
// backend, so we compensate by putting `previousProducts` back rather than
// leaving the update holding a product list the analysis was never run
// against. Invalidation runs in onSettled so the cache reflects whichever
// state (reverted or not) the backend actually ended up in.
export function useUmtSaveProductAnalysis(id: string) {
  const getAccessToken = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    { products: UmtUpdateProduct[]; analysis: UmtProductAnalysisRequest; previousProducts: UmtUpdateProduct[] }
  >({
    mutationFn: async ({ products, analysis, previousProducts }) => {
      const accessToken = await getAccessToken();
      await authedPut(umtServiceUrls.updateProducts(id), accessToken, products);
      try {
        await authedPut(umtServiceUrls.updateProductAnalysis(id), accessToken, analysis);
      } catch (analysisError) {
        let productsRestored = false;
        try {
          await authedPut(umtServiceUrls.updateProducts(id), accessToken, previousProducts);
          productsRestored = true;
        } catch {
          // Restoration failed too — surfaced via productsRestored below
          // rather than thrown, so the caller sees the original failure.
        }
        throw new UmtPartialProductAnalysisSaveError(analysisError, productsRestored);
      }
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["umt-update"] }),
        queryClient.invalidateQueries({ queryKey: ["umt-update-product-analysis"] }),
      ]);
    },
  });
}
