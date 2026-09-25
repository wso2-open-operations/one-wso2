// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy at
// http://www.apache.org/licenses/LICENSE-2.0

import { describe, expect, it } from "vitest";
import { normalizeUmtPlatformStats } from "./umtPlatformStats";

describe("UMT platform stats wire format", () => {
  it("sorts months ascending whatever order the backend sent them in", () => {
    expect(normalizeUmtPlatformStats({ "2026-03": 3, "2026-01": 1, "2026-02": 2 })).toEqual([
      { month: "2026-01", value: 1 },
      { month: "2026-02", value: 2 },
      { month: "2026-03", value: 3 },
    ]);
  });

  it("keeps a breakdown object's own keys as the series names", () => {
    expect(normalizeUmtPlatformStats({ "2026-01": { WSO2AM: 4, "WSO2 IS": 2 } })).toEqual([
      { month: "2026-01", WSO2AM: 4, "WSO2 IS": 2 },
    ]);
  });

  it("joins product and version into one series and sums repeated entries", () => {
    expect(
      normalizeUmtPlatformStats({
        "2026-01": [
          { product: "WSO2AM", version: "4.0.0", count: 2 },
          { product: "WSO2AM", version: "4.1.0", count: 9 },
          { product: "WSO2AM", version: "4.0.0", count: 3 },
        ],
      }),
    ).toEqual([{ month: "2026-01", "WSO2AM 4.0.0": 5, "WSO2AM 4.1.0": 9 }]);
  });

  it("returns no rows for an empty response", () => {
    expect(normalizeUmtPlatformStats({})).toEqual([]);
  });

  // The declared wire type is only a cast over parsed JSON, so a backend shape
  // change has to fail loudly here rather than chart nonsense series.
  it("rejects a payload that is not an object keyed by month", () => {
    expect(() => normalizeUmtPlatformStats(null)).toThrow(/expected an object keyed by month/);
    expect(() => normalizeUmtPlatformStats(undefined)).toThrow(/expected an object keyed by month/);
    expect(() => normalizeUmtPlatformStats([])).toThrow(/expected an object keyed by month/);
    expect(() => normalizeUmtPlatformStats("nope")).toThrow(/expected an object keyed by month/);
  });

  it("rejects a month whose value is neither a count, a breakdown nor a list", () => {
    expect(() => normalizeUmtPlatformStats({ "2026-01": "abc" })).toThrow(/value for 2026-01/);
    expect(() => normalizeUmtPlatformStats({ "2026-01": true })).toThrow(/value for 2026-01/);
    expect(() => normalizeUmtPlatformStats({ "2026-01": null })).toThrow(/value for 2026-01/);
  });

  it("rejects a breakdown whose counts are not numbers", () => {
    expect(() => normalizeUmtPlatformStats({ "2026-01": { WSO2AM: "abc" } })).toThrow(
      /counts for 2026-01/,
    );
    expect(() => normalizeUmtPlatformStats({ "2026-01": { WSO2AM: { nested: 1 } } })).toThrow(
      /counts for 2026-01/,
    );
  });

  it("rejects a version entry whose fields were renamed on the wire", () => {
    expect(() =>
      normalizeUmtPlatformStats({ "2026-01": [{ "product-name": "WSO2AM", version: "4.0.0", count: 2 }] }),
    ).toThrow(/entry for 2026-01/);
  });

  // A breakdown series literally named "month" would spread over the row's
  // own month label instead of joining it as a series.
  it("rejects a breakdown series named the same as the row's own month field", () => {
    expect(() => normalizeUmtPlatformStats({ "2026-01": { month: 4, WSO2AM: 2 } })).toThrow(
      /"month" series.*2026-01/,
    );
  });
});
