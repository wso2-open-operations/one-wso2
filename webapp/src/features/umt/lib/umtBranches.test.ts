// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy at
// http://www.apache.org/licenses/LICENSE-2.0

import { describe, expect, it } from "vitest";
import type { UmtMeta } from "../api/umtTypes";
import type { UmtUpdateSummary } from "../api/umtUpdates";
import { isUmtBranchInProgress, umtBranchCreationPayload, umtHotfixProductBranchRequest } from "./umtBranches";

describe("isUmtBranchInProgress", () => {
  it("treats Completed, Failed and Not created as settled", () => {
    expect(isUmtBranchInProgress({ status: "Completed" })).toBe(false);
    expect(isUmtBranchInProgress({ status: "Failed" })).toBe(false);
    expect(isUmtBranchInProgress({ status: "Not created" })).toBe(false);
  });

  it("treats any other status as still in progress", () => {
    expect(isUmtBranchInProgress({ status: "Pending" })).toBe(true);
    expect(isUmtBranchInProgress({ status: "In progress" })).toBe(true);
    expect(isUmtBranchInProgress({ status: null })).toBe(true);
  });
});

const PRODUCTS: UmtMeta["products"] = {
  wso2am: [
    {
      id: 7,
      name: "wso2am",
      version: "4.2.0.0.full",
      latestVersion: "4.2.0.15.full",
      isLatest: true,
      leadMail: "",
      edMail: "",
      supportRepoUrl: "https://github.com/wso2-support/product-apim",
      publicRepoUrl: "https://github.com/wso2/product-apim",
    },
  ],
};

function hotfix(overrides: Partial<UmtUpdateSummary> = {}): UmtUpdateSummary {
  return {
    id: 501,
    isHotfix: true,
    jiraId: "SUPPORT-123",
    wso2CaseId: "CS0012345",
    products: [{ productId: 7, product: { name: "wso2am", version: "4.2.0.0.full" } }],
    ...overrides,
  };
}

describe("umtBranchCreationPayload", () => {
  const request = {
    publicRepoUrl: "https://github.com/wso2/product-apim",
    releaseTag: "4.2.0.0",
    channel: "full",
    productName: "wso2am",
    branchType: "ProductBranch" as const,
    productVersion: "4.2.0.0",
  };

  it("sends an update branch request with only the fields that endpoint takes", () => {
    expect(umtBranchCreationPayload(request, { id: 1, isHotfix: false })).toEqual({
      publicRepoUrl: request.publicRepoUrl,
      releaseTag: "4.2.0.0",
      channel: "full",
      productName: "wso2am",
      branchType: "ProductBranch",
    });
  });

  it("adds the hotfix's Jira id, case id and product version to a hotfix branch request", () => {
    expect(umtBranchCreationPayload(request, { id: 1, isHotfix: true, jiraId: "SUPPORT-1", wso2CaseId: "CS1" })).toEqual({
      ...request,
      jiraId: "SUPPORT-1",
      wso2CaseId: "CS1",
    });
  });

  it("sends empty strings for a hotfix's missing ids", () => {
    expect(umtBranchCreationPayload({ ...request, productVersion: undefined }, { id: 1, isHotfix: true })).toEqual({
      ...request,
      productVersion: "",
      jiraId: "",
      wso2CaseId: "",
    });
  });
});

describe("umtHotfixProductBranchRequest", () => {
  it("asks for the hotfix's product branch from the product's public repository", () => {
    expect(umtHotfixProductBranchRequest(hotfix(), PRODUCTS)).toEqual({
      publicRepoUrl: "https://github.com/wso2/product-apim",
      releaseTag: "4.2.0.0",
      channel: "full",
      productName: "wso2am",
      branchType: "ProductBranch",
      productVersion: "4.2.0.0",
      jiraId: "SUPPORT-123",
      wso2CaseId: "CS0012345",
    });
  });

  it("asks for nothing for an update that is not a hotfix", () => {
    expect(umtHotfixProductBranchRequest(hotfix({ isHotfix: false }), PRODUCTS)).toBeNull();
    expect(umtHotfixProductBranchRequest(hotfix({ isHotfix: undefined }), PRODUCTS)).toBeNull();
  });

  it("cannot be built for a hotfix with no product, or one the metadata has no public repository for", () => {
    expect(umtHotfixProductBranchRequest(hotfix({ products: [] }), PRODUCTS)).toBeNull();
    expect(umtHotfixProductBranchRequest(hotfix({ products: undefined }), PRODUCTS)).toBeNull();
    expect(umtHotfixProductBranchRequest(hotfix(), {})).toBeNull();
    expect(
      umtHotfixProductBranchRequest(hotfix({ products: [{ product: { name: "wso2am", version: "9.9.9.0.full" } }] }), PRODUCTS),
    ).toBeNull();
    expect(
      umtHotfixProductBranchRequest(hotfix(), { wso2am: [{ ...PRODUCTS.wso2am[0], publicRepoUrl: "" }] }),
    ).toBeNull();
  });
});
