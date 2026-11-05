// Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
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
// KIND, either express governing permissions and limitations
// under the License.

import { describe, expect, it } from "vitest";
import type { Capability } from "@constants/appMenu";
import { DIRECTORY_CATALOG, isDirectoryEntryPermitted, matchDirectory } from "./directoryCatalog";

describe("matchDirectory best-match scoring", () => {
  it("prioritizes bucket match when provided", () => {
    const match = matchDirectory("anything", "LEAVE_STANDARD");
    expect(match?.id).toBe("me-leave");
  });

  it("matches exact title with top priority", () => {
    const match = matchDirectory("Settings");
    expect(match?.id).toBe("settings");
  });

  it("selects people-par-lead over me-team for multi-word 'team appraisal' when user is a lead", () => {
    const match = matchDirectory("team appraisal", null, new Set<Capability>(["lead"]));
    expect(match?.id).toBe("people-par-lead");
  });

  it("selects people-par-lead over finance-approvals and me-par for 'par review' when user is a lead", () => {
    const match = matchDirectory("par review", null, new Set<Capability>(["lead"]));
    expect(match?.id).toBe("people-par-lead");
  });

  it("selects people-par-lead over me-team for 'lead par' when user is a lead", () => {
    const match = matchDirectory("lead par", null, new Set<Capability>(["lead"]));
    expect(match?.id).toBe("people-par-lead");
  });

  it("matches single-word keywords when no longer phrase matches", () => {
    const match = matchDirectory("expense");
    expect(match?.id).toBe("me-claims");
  });

  it("returns undefined for empty, whitespace, or unmatched queries", () => {
    expect(matchDirectory("")).toBeUndefined();
    expect(matchDirectory("   ")).toBeUndefined();
    expect(matchDirectory("what is the wifi password?")).toBeUndefined();
  });
});

describe("matchDirectory role-based capability filtering", () => {
  const employeeCaps = new Set<Capability>(["employee"]);
  const leadCaps = new Set<Capability>(["employee", "lead"]);
  const adminCaps = new Set<Capability>(["employee", "admin"]);

  it("hides admin-only Subscription Management from regular employees", () => {
    const match = matchDirectory("manage subscriptions", null, employeeCaps);
    expect(match?.id).not.toBe("people-subscriptions-manage");
  });

  it("reveals Subscription Management to admins", () => {
    const match = matchDirectory("manage subscriptions", null, adminCaps);
    expect(match?.id).toBe("people-subscriptions-manage");
  });

  it("hides Active Employees Report from regular employees", () => {
    const match = matchDirectory("active employees", null, employeeCaps);
    expect(match?.id).not.toBe("people-reports-active-employees");
  });

  it("reveals Active Employees Report to leads and admins", () => {
    const leadMatch = matchDirectory("active employees", null, leadCaps);
    expect(leadMatch?.id).toBe("people-reports-active-employees");

    const adminMatch = matchDirectory("active employees", null, adminCaps);
    expect(adminMatch?.id).toBe("people-reports-active-employees");
  });

  it("hides Master Data Org Structure from regular employees and leads", () => {
    expect(matchDirectory("master data", null, employeeCaps)?.id).not.toBe(
      "people-master-data-org-structure",
    );
    expect(matchDirectory("master data", null, leadCaps)?.id).not.toBe(
      "people-master-data-org-structure",
    );
  });

  it("reveals Master Data Org Structure to admins", () => {
    const match = matchDirectory("master data", null, adminCaps);
    expect(match?.id).toBe("people-master-data-org-structure");
  });

  it("allows open employee entries for all capability sets", () => {
    expect(matchDirectory("leaves", null, employeeCaps)?.id).toBe("me-leave");
    expect(matchDirectory("leaves", null, adminCaps)?.id).toBe("me-leave");
  });

  it("evaluates entry permission directly via isDirectoryEntryPermitted", () => {
    const adminEntry = DIRECTORY_CATALOG.find((e) => e.id === "people-subscriptions-manage")!;
    expect(isDirectoryEntryPermitted(adminEntry, employeeCaps)).toBe(false);
    expect(isDirectoryEntryPermitted(adminEntry, adminCaps)).toBe(true);
  });
});
