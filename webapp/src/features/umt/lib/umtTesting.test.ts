// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy at
// http://www.apache.org/licenses/LICENSE-2.0

import { describe, expect, it } from "vitest";
import type { UmtStagingTestResultRecord } from "../api/umtUpdates";
import {
  isTestingComplete,
  umtAutomatedTestResultColor,
  umtAutomatedTestResultLabel,
  umtShouldPollStagingTestResults,
  umtStagingRowIsComplete,
  umtTestingResultRequiresComment,
} from "./umtTesting";

function record(
  manualTestResult: string | null | undefined,
  manualTestComment: string | null | undefined,
): UmtStagingTestResultRecord {
  return { productId: 1, manualTestResult, manualTestComment };
}

describe("umtTestingResultRequiresComment", () => {
  it("requires a comment for failure and not_built", () => {
    expect(umtTestingResultRequiresComment("failure")).toBe(true);
    expect(umtTestingResultRequiresComment("not_built")).toBe(true);
  });

  it("does not require a comment for success", () => {
    expect(umtTestingResultRequiresComment("success")).toBe(false);
  });
});

describe("umtStagingRowIsComplete", () => {
  it("is false when no result is selected", () => {
    expect(umtStagingRowIsComplete(record(null, null))).toBe(false);
    expect(umtStagingRowIsComplete(record("", ""))).toBe(false);
  });

  it("is true for success with no comment", () => {
    expect(umtStagingRowIsComplete(record("success", null))).toBe(true);
  });

  it("is false for failure or not_built without a comment", () => {
    expect(umtStagingRowIsComplete(record("failure", null))).toBe(false);
    expect(umtStagingRowIsComplete(record("not_built", "   "))).toBe(false);
  });

  it("is true for failure or not_built with a non-blank comment", () => {
    expect(umtStagingRowIsComplete(record("failure", "Environment unavailable"))).toBe(true);
    expect(umtStagingRowIsComplete(record("not_built", "Skipped this cycle"))).toBe(true);
  });
});

describe("isTestingComplete", () => {
  it("is false for every state other than Staging", () => {
    expect(isTestingComplete("TestingEnvironmentRequested", [])).toBe(false);
    expect(isTestingComplete("TestingEnvironmentCreated", [])).toBe(false);
    expect(isTestingComplete("TestingEnvironmentFailed", [])).toBe(false);
    expect(isTestingComplete("StagingRequested", [])).toBe(false);
    expect(isTestingComplete(null, [])).toBe(false);
  });

  it("is vacuously true for an empty, null, or undefined record list once Staging is reached", () => {
    expect(isTestingComplete("Staging", [])).toBe(true);
    expect(isTestingComplete("Staging", null)).toBe(true);
    expect(isTestingComplete("Staging", undefined)).toBe(true);
  });

  it("is true only once every row is complete", () => {
    expect(isTestingComplete("Staging", [record("success", null), record("failure", "Broken")])).toBe(true);
  });

  it("is false when one row among several is incomplete", () => {
    expect(isTestingComplete("Staging", [record("success", null), record("failure", null)])).toBe(false);
  });
});

describe("umtShouldPollStagingTestResults", () => {
  it("keeps polling during the transient in-between states", () => {
    expect(umtShouldPollStagingTestResults("TestingEnvironmentRequested")).toBe(true);
    expect(umtShouldPollStagingTestResults("TestingEnvironmentCreated")).toBe(true);
    expect(umtShouldPollStagingTestResults("StagingRequested")).toBe(true);
  });

  it("stops polling once a terminal state is reached, including failure", () => {
    expect(umtShouldPollStagingTestResults("Staging")).toBe(false);
    expect(umtShouldPollStagingTestResults("TestingEnvironmentFailed")).toBe(false);
    expect(umtShouldPollStagingTestResults(null)).toBe(false);
  });
});

describe("umtAutomatedTestResultColor", () => {
  it("maps each known backend value to legacy's dot color", () => {
    expect(umtAutomatedTestResultColor("success")).toBe("success.main");
    expect(umtAutomatedTestResultColor("failure")).toBe("error.main");
    expect(umtAutomatedTestResultColor("building")).toBe("info.main");
  });

  it("falls back to grey for an unknown or missing value", () => {
    expect(umtAutomatedTestResultColor("something-else")).toBe("grey.400");
    expect(umtAutomatedTestResultColor(null)).toBe("grey.400");
    expect(umtAutomatedTestResultColor(undefined)).toBe("grey.400");
  });
});

describe("umtAutomatedTestResultLabel", () => {
  it("title-cases a lower_snake_case backend value", () => {
    expect(umtAutomatedTestResultLabel("success")).toBe("Success");
    expect(umtAutomatedTestResultLabel("not_built")).toBe("Not Built");
  });

  it("falls back to Unknown for a missing value", () => {
    expect(umtAutomatedTestResultLabel(null)).toBe("Unknown");
    expect(umtAutomatedTestResultLabel(undefined)).toBe("Unknown");
    expect(umtAutomatedTestResultLabel("")).toBe("Unknown");
  });
});
