// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy at
// http://www.apache.org/licenses/LICENSE-2.0

import { describe, expect, it } from "vitest";
import { localIsoDate } from "@utils/localDate";
import type { UmtMetadataProduct } from "../api/umtTypes";
import {
  buildUmtCreateUpdateRequest,
  isCreateUpdateFormValid,
  isValidCaseId,
  isValidEstimateDate,
  isValidGithubIssueUrl,
  resolveCreateUpdateProductId,
  type UmtCreateUpdateFormValues,
} from "./umtCreateUpdate";

function product(overrides: Partial<UmtMetadataProduct>): UmtMetadataProduct {
  return {
    id: 1,
    name: "carbon-kernel",
    version: "4.9.0",
    latestVersion: "4.9.0",
    isLatest: true,
    leadMail: "lead@wso2.com",
    edMail: "ed@wso2.com",
    supportRepoUrl: "",
    publicRepoUrl: "",
    ...overrides,
  };
}

describe("isValidGithubIssueUrl", () => {
  it("accepts a wso2 internal GitHub issue URL", () => {
    expect(isValidGithubIssueUrl("https://github.com/wso2/internal-issues/issues/123")).toBe(true);
  });

  it("rejects a non-GitHub or malformed URL", () => {
    expect(isValidGithubIssueUrl("https://gitlab.com/wso2/repo/issues/123")).toBe(false);
    expect(isValidGithubIssueUrl("not a url")).toBe(false);
    expect(isValidGithubIssueUrl("")).toBe(false);
  });
});

describe("isValidCaseId", () => {
  it("accepts a CS-prefixed case id", () => {
    expect(isValidCaseId("CS12345")).toBe(true);
    expect(isValidCaseId("  CS999  ")).toBe(true);
  });

  it("rejects a case id in the wrong format", () => {
    expect(isValidCaseId("12345")).toBe(false);
    expect(isValidCaseId("INC12345")).toBe(false);
    expect(isValidCaseId("")).toBe(false);
  });
});

describe("isValidEstimateDate", () => {
  it("requires a Thursday for a non-hotfix update", () => {
    expect(isValidEstimateDate(new Date(2026, 0, 1), false)).toBe(true); // Thursday
    expect(isValidEstimateDate(new Date(2026, 0, 6), false)).toBe(false); // Tuesday
  });

  it("allows any day for a hotfix", () => {
    expect(isValidEstimateDate(new Date(2026, 0, 6), true)).toBe(true);
  });
});

describe("resolveCreateUpdateProductId", () => {
  const products: Record<string, UmtMetadataProduct[]> = {
    "carbon-kernel": [
      product({ id: 10, version: "4.8.0", latestVersion: "4.8.0" }),
      product({ id: 11, version: "4.9.0", latestVersion: "4.9.0" }),
    ],
    asgardeo: [product({ id: 20, name: "asgardeo", version: "1.0.0", latestVersion: "1.0.0" })],
  };

  it("matches latestVersion when showAllVersions is false", () => {
    expect(resolveCreateUpdateProductId(products, "carbon-kernel", "4.9.0", false, false)).toBe(11);
  });

  it("matches the source version when showAllVersions is true", () => {
    expect(resolveCreateUpdateProductId(products, "carbon-kernel", "4.8.0", true, false)).toBe(10);
  });

  it("returns null when nothing matches", () => {
    expect(resolveCreateUpdateProductId(products, "carbon-kernel", "9.9.9", false, false)).toBeNull();
    expect(resolveCreateUpdateProductId(products, null, "4.9.0", false, false)).toBeNull();
    expect(resolveCreateUpdateProductId(products, "carbon-kernel", null, false, false)).toBeNull();
  });

  it("resolves Cloud Support from the product's first row, without needing a version", () => {
    expect(resolveCreateUpdateProductId(products, "asgardeo", null, false, true)).toBe(20);
  });
});

function baseValues(overrides: Partial<UmtCreateUpdateFormValues> = {}): UmtCreateUpdateFormValues {
  return {
    isProactive: false,
    isHotfix: false,
    updateType: "regular",
    issueType: "bug",
    caseId: "CS12345",
    internalGitIssue: "https://github.com/wso2/internal-issues/issues/1",
    publicOrSecurityGitIssue: "https://github.com/wso2/public-issues/issues/2",
    productId: 11,
    // Local-time constructors, not ISO date-only strings (which parse as
    // UTC) — the day-of-week and calendar-day checks below are local-time
    // based (matching the app's real DatePicker values), and a UTC-parsed
    // fixture would land on a different weekday/day in a non-UTC test
    // environment.
    bestCaseEstimate: new Date(2026, 0, 1), // Thursday
    mostLikelyEstimate: new Date(2026, 0, 8), // Thursday
    worstCaseEstimate: new Date(2026, 0, 15), // Thursday
    ...overrides,
  };
}

describe("isCreateUpdateFormValid", () => {
  it("is valid with every required field present and format-valid", () => {
    expect(isCreateUpdateFormValid(baseValues())).toBe(true);
  });

  it("requires a case ID unless proactive", () => {
    expect(isCreateUpdateFormValid(baseValues({ caseId: "" }))).toBe(false);
    expect(isCreateUpdateFormValid(baseValues({ caseId: "", isProactive: true }))).toBe(true);
  });

  it("requires the case ID to match the CS-prefixed format unless proactive", () => {
    expect(isCreateUpdateFormValid(baseValues({ caseId: "12345" }))).toBe(false);
    expect(isCreateUpdateFormValid(baseValues({ caseId: "12345", isProactive: true }))).toBe(true);
  });

  it("requires a resolved product id", () => {
    expect(isCreateUpdateFormValid(baseValues({ productId: null }))).toBe(false);
  });

  it("requires all three dates", () => {
    expect(isCreateUpdateFormValid(baseValues({ bestCaseEstimate: null }))).toBe(false);
    expect(isCreateUpdateFormValid(baseValues({ mostLikelyEstimate: null }))).toBe(false);
    expect(isCreateUpdateFormValid(baseValues({ worstCaseEstimate: null }))).toBe(false);
  });

  it("rejects a truthy but unparseable Invalid Date, as DatePicker can report mid-typing", () => {
    const invalidDate = new Date("not a date");
    expect(isCreateUpdateFormValid(baseValues({ bestCaseEstimate: invalidDate }))).toBe(false);
    expect(isCreateUpdateFormValid(baseValues({ mostLikelyEstimate: invalidDate }))).toBe(false);
    expect(isCreateUpdateFormValid(baseValues({ worstCaseEstimate: invalidDate }))).toBe(false);
  });

  it("requires both git-issue fields to be format-valid URLs", () => {
    expect(isCreateUpdateFormValid(baseValues({ internalGitIssue: "not a url" }))).toBe(false);
    expect(isCreateUpdateFormValid(baseValues({ publicOrSecurityGitIssue: "not a url" }))).toBe(false);
  });

  it("requires the estimates to be strictly ordered, even when typed rather than picked", () => {
    expect(
      isCreateUpdateFormValid(
        baseValues({ bestCaseEstimate: new Date(2026, 0, 8), mostLikelyEstimate: new Date(2026, 0, 1) }),
      ),
    ).toBe(false);
    expect(
      isCreateUpdateFormValid(
        baseValues({ mostLikelyEstimate: new Date(2026, 0, 15), worstCaseEstimate: new Date(2026, 0, 8) }),
      ),
    ).toBe(false);
  });

  it("requires every estimate to fall on a Thursday unless the update is a hotfix", () => {
    expect(isCreateUpdateFormValid(baseValues({ bestCaseEstimate: new Date(2026, 0, 6) }))).toBe(false);
    expect(
      isCreateUpdateFormValid(baseValues({ bestCaseEstimate: new Date(2026, 0, 6), isHotfix: true })),
    ).toBe(true);
  });
});

describe("buildUmtCreateUpdateRequest", () => {
  it("maps a regular, non-proactive update with N/A for the unused security field", () => {
    const request = buildUmtCreateUpdateRequest(baseValues());
    expect(request).toMatchObject({
      caseId: "CS12345",
      lifecycle: "UpdateLifecycle",
      issueType: "Bug",
      securityInternalGitIssue: "N/A",
      publicGitIssue: "https://github.com/wso2/public-issues/issues/2",
      productId: 11,
      hotfixRequired: false,
    });
  });

  it("sends N/A for caseId when proactive", () => {
    const request = buildUmtCreateUpdateRequest(baseValues({ isProactive: true, caseId: "" }));
    expect(request.caseId).toBe("N/A");
  });

  it("maps a security update with N/A for the unused public field", () => {
    const request = buildUmtCreateUpdateRequest(baseValues({ updateType: "security" }));
    expect(request.lifecycle).toBe("SecurityUpdateLifecycle");
    expect(request.securityInternalGitIssue).toBe("https://github.com/wso2/public-issues/issues/2");
    expect(request.publicGitIssue).toBe("N/A");
  });

  it("maps issueType and lifecycle for every option", () => {
    expect(buildUmtCreateUpdateRequest(baseValues({ issueType: "improvement" })).issueType).toBe(
      "Improvement",
    );
    expect(buildUmtCreateUpdateRequest(baseValues({ issueType: "new-feature" })).issueType).toBe(
      "New Feature",
    );
    expect(buildUmtCreateUpdateRequest(baseValues({ updateType: "cloud-support" })).lifecycle).toBe(
      "CloudSupportLifecycle",
    );
  });

  it("passes hotfixRequired through and sends local calendar-date strings", () => {
    const request = buildUmtCreateUpdateRequest(baseValues({ isHotfix: true }));
    expect(request.hotfixRequired).toBe(true);
    expect(request.bestCaseEstimate).toBe(localIsoDate(new Date(2026, 0, 1)));
  });
});
