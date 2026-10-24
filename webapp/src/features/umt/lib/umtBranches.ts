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

import type { UmtMeta } from "../api/umtTypes";
import type { UmtBranchCreationRequest, UmtUpdateBranch, UmtUpdateSummary } from "../api/umtUpdates";

const UMT_BRANCH_SETTLED_STATUSES = new Set(["Completed", "Failed", "Not created"]);

export function isUmtBranchInProgress(branch: UmtUpdateBranch): boolean {
  return !UMT_BRANCH_SETTLED_STATUSES.has(branch.status ?? "");
}

// The request a branch is asked for with. An update's branch request is these
// five fields; a hotfix's adds its Jira id, its case id and the product
// version, so the product version is sent only for a hotfix.
export function umtBranchCreationPayload(
  request: UmtBranchCreationRequest,
  update: UmtUpdateSummary,
): UmtBranchCreationRequest {
  if (!update.isHotfix) {
    return {
      branchType: request.branchType,
      channel: request.channel,
      productName: request.productName,
      publicRepoUrl: request.publicRepoUrl,
      releaseTag: request.releaseTag,
    };
  }
  return {
    ...request,
    jiraId: update.jiraId ?? "",
    wso2CaseId: update.wso2CaseId ?? "",
    productVersion: request.productVersion ?? "",
  };
}

// A product version without its ".full" channel, as a release tag is named.
export function umtReleaseTag(productVersion: string): string {
  return productVersion.endsWith(".full") ? productVersion.slice(0, -".full".length) : productVersion;
}

// The product branch a newly created hotfix is given, built the way the
// Branch tab builds it for the hotfix's first product: from that product's
// public repository, tagged with its version. Null for an update that is not a
// hotfix, and for a hotfix with no product or no known public repository, which
// the Branch tab can still create once the repository is known.
export function umtHotfixProductBranchRequest(
  update: UmtUpdateSummary,
  products: UmtMeta["products"],
): UmtBranchCreationRequest | null {
  if (!update.isHotfix) return null;
  const productName = update.products?.[0]?.product?.name;
  const productVersion = update.products?.[0]?.product?.version;
  if (!productName || !productVersion) return null;
  const publicRepoUrl = products[productName]?.find((product) => product.version === productVersion)?.publicRepoUrl;
  if (!publicRepoUrl) return null;
  const releaseTag = umtReleaseTag(productVersion);
  return umtBranchCreationPayload(
    { publicRepoUrl, releaseTag, channel: "full", productName, branchType: "ProductBranch", productVersion: releaseTag },
    update,
  );
}
