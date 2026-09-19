// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy at
// http://www.apache.org/licenses/LICENSE-2.0

import { describe, expect, it } from "vitest";
import { umtSecurityAdvisoryFormatValid } from "./umtSecurityAdvisory";

describe("umtSecurityAdvisoryFormatValid", () => {
  it("accepts well-formed WSO2-YYYY-NNNN ids", () => {
    expect(umtSecurityAdvisoryFormatValid("WSO2-2024-1234")).toBe(true);
    expect(umtSecurityAdvisoryFormatValid("WSO2-1999-0001")).toBe(true);
  });

  it("trims surrounding whitespace before checking", () => {
    expect(umtSecurityAdvisoryFormatValid("  WSO2-2024-1234  ")).toBe(true);
  });

  it("rejects the wrong number of digits", () => {
    expect(umtSecurityAdvisoryFormatValid("WSO2-24-1234")).toBe(false);
    expect(umtSecurityAdvisoryFormatValid("WSO2-2024-123")).toBe(false);
    expect(umtSecurityAdvisoryFormatValid("WSO2-2024-12345")).toBe(false);
  });

  it("rejects a missing or wrong separator", () => {
    expect(umtSecurityAdvisoryFormatValid("WSO2 2024 1234")).toBe(false);
    expect(umtSecurityAdvisoryFormatValid("WSO220241234")).toBe(false);
  });

  it("rejects a lowercase or otherwise wrong prefix", () => {
    expect(umtSecurityAdvisoryFormatValid("wso2-2024-1234")).toBe(false);
    expect(umtSecurityAdvisoryFormatValid("WS02-2024-1234")).toBe(false);
  });

  it("rejects empty or whitespace-only input", () => {
    expect(umtSecurityAdvisoryFormatValid("")).toBe(false);
    expect(umtSecurityAdvisoryFormatValid("   ")).toBe(false);
  });

  it("rejects extra trailing/leading characters within the string", () => {
    expect(umtSecurityAdvisoryFormatValid("WSO2-2024-12345 extra")).toBe(false);
    expect(umtSecurityAdvisoryFormatValid("prefix WSO2-2024-1234")).toBe(false);
  });
});
