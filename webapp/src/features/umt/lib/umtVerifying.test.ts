// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy at
// http://www.apache.org/licenses/LICENSE-2.0

import { describe, expect, it } from "vitest";
import { isCompleteUpdateValid, isValidHttpUrl } from "./umtVerifying";

describe("isValidHttpUrl", () => {
  it("accepts http/https URLs", () => {
    expect(isValidHttpUrl("https://github.com/wso2/carbon-kernel/pull/123")).toBe(true);
    expect(isValidHttpUrl("http://example.com")).toBe(true);
  });

  it("rejects non-URL strings and non-http(s) protocols", () => {
    expect(isValidHttpUrl("not a url")).toBe(false);
    expect(isValidHttpUrl("")).toBe(false);
    expect(isValidHttpUrl("ftp://example.com/file")).toBe(false);
  });
});

describe("isCompleteUpdateValid", () => {
  it("is invalid when neither a pull request nor a reason is provided", () => {
    expect(isCompleteUpdateValid({ publicPullRequests: [], reason: "" })).toBe(false);
    expect(isCompleteUpdateValid({ publicPullRequests: ["", "  "], reason: "  " })).toBe(false);
  });

  it("is valid with a pull request only", () => {
    expect(
      isCompleteUpdateValid({
        publicPullRequests: ["https://github.com/wso2/carbon-kernel/pull/123"],
        reason: "",
      }),
    ).toBe(true);
  });

  it("is valid with a reason only", () => {
    expect(isCompleteUpdateValid({ publicPullRequests: [], reason: "No public PR needed." })).toBe(true);
    expect(isCompleteUpdateValid({ publicPullRequests: ["", "  "], reason: "No public PR needed." })).toBe(
      true,
    );
  });

  it("is invalid when both a pull request and a reason are provided", () => {
    expect(
      isCompleteUpdateValid({
        publicPullRequests: ["https://github.com/wso2/carbon-kernel/pull/123"],
        reason: "No public PR needed.",
      }),
    ).toBe(false);
  });

  it("rejects a non-blank but invalid-URL entry outright, even alongside a reason", () => {
    expect(isCompleteUpdateValid({ publicPullRequests: ["not a url"], reason: "" })).toBe(false);
    expect(isCompleteUpdateValid({ publicPullRequests: ["not a url"], reason: "Reason given." })).toBe(false);
  });

  it("rejects a mix of one valid and one invalid pull request", () => {
    expect(
      isCompleteUpdateValid({
        publicPullRequests: ["https://github.com/wso2/carbon-kernel/pull/123", "not a url"],
        reason: "",
      }),
    ).toBe(false);
  });
});
