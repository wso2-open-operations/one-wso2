// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy at
// http://www.apache.org/licenses/LICENSE-2.0

import { describe, expect, it } from "vitest";
import type { UmtUpdateBranch } from "../api/umtUpdates";
import { umtHotfixJobUrl, umtHotfixProductBranch } from "./umtHotfixRelease";

const JOB_URL = "https://jenkins.example.com/job/update-2/job/uat/job/full/job/wso2am/job/wso2am-4.4.0.88-hotfix-x";

function branch(overrides: Partial<UmtUpdateBranch>): UmtUpdateBranch {
  return { branchType: "ProductBranch", status: "Completed", jenkinsJobUrl: JOB_URL, ...overrides };
}

describe("umtHotfixProductBranch", () => {
  it("finds the completed product branch, even when it has no Jenkins job", () => {
    const gradleBranch = branch({ jenkinsJobUrl: null });
    expect(umtHotfixProductBranch([branch({ branchType: "ComponentBranch" }), gradleBranch])).toBe(gradleBranch);
  });

  it.each(["Pending", "Creating", "Failed"])("ignores a product branch that is %s", (status) => {
    expect(umtHotfixProductBranch([branch({ status })])).toBeUndefined();
  });
});

describe("umtHotfixJobUrl", () => {
  it("returns the job of the completed product branch", () => {
    expect(umtHotfixJobUrl([branch({})])).toBe(JOB_URL);
  });

  it.each(["Pending", "Creating", "Failed"])(
    "skips other branch types and a product branch that is %s",
    (status) => {
      const other = "https://jenkins.example.com/job/other";
      expect(
        umtHotfixJobUrl([
          branch({ branchType: "ComponentBranch", jenkinsJobUrl: other }),
          branch({ status, jenkinsJobUrl: other }),
          branch({}),
        ]),
      ).toBe(JOB_URL);
    },
  );

  it.each([
    ["no branches", undefined],
    ["an empty list", []],
  ])("is empty for %s", (_label, branches) => {
    expect(umtHotfixJobUrl(branches)).toBe("");
  });

  it.each(["Pending", "Creating", "Failed"])("is empty when the only product branch is %s", (status) => {
    expect(umtHotfixJobUrl([branch({ status })])).toBe("");
  });

  it.each([null, "", "N/A", "javascript:alert(1)"])("is empty when the job is %j", (jenkinsJobUrl) => {
    expect(umtHotfixJobUrl([branch({ jenkinsJobUrl })])).toBe("");
  });
});
