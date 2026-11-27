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
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import { afterEach, describe, expect, it, vi } from "vitest";
import type { Capability } from "@constants/appMenu";
import { OTHER_APPS } from "@constants/otherApps";
import { DIRECTORY_CATALOG, otherAppDirectoryEntries, searchDirectories } from "./directoryCatalog";

/** Every capability some catalog entry asks for, so a search sees every entry. */
const ALL_CAPS = new Set<Capability>([
  "employee",
  ...DIRECTORY_CATALOG.flatMap((entry) => entry.requires ?? []),
]);

const originalConfig = window.config;

afterEach(() => {
  window.config = originalConfig;
  vi.resetModules();
});

describe("otherAppDirectoryEntries", () => {
  it("has no entry for a tool with no address", () => {
    expect(otherAppDirectoryEntries({})).toEqual([]);
  });

  it("opens each configured tool in a new tab, under its perspective's category", () => {
    const [netsuite] = otherAppDirectoryEntries({ netsuite: "https://netsuite.example" });
    expect(netsuite).toMatchObject({
      id: "other-app-netsuite",
      title: "NetSuite",
      label: "Open NetSuite",
      href: "https://netsuite.example",
      category: "Finance",
      isExternal: true,
      hasWebApp: true,
      hint: "The finance system. Opens in a new tab.",
    });
    expect(netsuite.keywords).toEqual(expect.arrayContaining(["netsuite", "erp"]));
  });

  it("says a VPN-only tool needs the VPN", () => {
    const [jenkins] = otherAppDirectoryEntries({ "public-jenkins": "https://jenkins.example" });
    expect(jenkins.title).toBe("Public Jenkins (VPN)");
    expect(jenkins.hint).toBe("The public build server. Opens in a new tab; needs the VPN.");
  });

  it("titles a tool linked from its own rail group by its marketplace name", () => {
    const [pitstop] = otherAppDirectoryEntries({ "sales-pitstop": "https://pitstop.example" });
    expect(pitstop.title).toBe("Sales Pitstop");
    expect(pitstop.label).toBe("Open Sales Pitstop");
  });

  it("keeps registry order and builds one entry per configured tool", () => {
    const urls = Object.fromEntries(OTHER_APPS.map((app) => [app.id, `https://${app.id}.example`]));
    expect(otherAppDirectoryEntries(urls).map((entry) => entry.id)).toEqual(
      OTHER_APPS.filter((app) => !app.ownSearchEntry).map((app) => `other-app-${app.id}`),
    );
  });

  // The CSM portal already has "Customer Success Management (CSM)" in search.
  it("adds no second search entry for the CSM portal", () => {
    expect(otherAppDirectoryEntries({ csm: "https://csm.example" })).toEqual([]);
  });
});

describe("searchDirectories", () => {
  it("finds a configured marketplace tool by its marketplace name", async () => {
    window.config = {
      ...(originalConfig ?? {}),
      ONE_WSO2_OTHER_APP_URLS: {
        "msl-payslip": "https://payslip.example",
        "security-compliance-site": "https://security-site.example",
      },
    } as Window["config"];
    vi.resetModules();
    const fresh = await import("./directoryCatalog");
    expect(fresh.searchDirectories("MSL Payslip Viewer", ALL_CAPS)[0]?.id).toBe("other-app-msl-payslip");
    // Labelled differently in One WSO2, still found by its marketplace name.
    expect(fresh.searchDirectories("Security & Compliance Portal", ALL_CAPS)[0]?.id).toBe("other-app-security-compliance-site");
  });

  it("does not offer a tool whose address is not configured", async () => {
    window.config = { ...(originalConfig ?? {}), ONE_WSO2_OTHER_APP_URLS: {} } as Window["config"];
    vi.resetModules();
    const fresh = await import("./directoryCatalog");
    expect(fresh.searchDirectories("payslip", ALL_CAPS).map((entry) => entry.id)).not.toContain(
      "other-app-msl-payslip",
    );
  });

  it.each([
    ["Leave App", "me-leave"],
    ["Dinner On Demand", "me-menu"],
    ["Menu and Meals App", "me-menu"],
    ["Email Group Manager", "po-email-groups"],
    ["Banking App", "po-banking"],
    ["Org Chart App", "po-org-chart"],
    ["Performance Appraisal App", "po-par"],
    ["Promotion App", "po-promotions"],
    ["Expense Claims App", "fin-expenses"],
    ["Credit Card Expenses", "fin-cc"],
    ["Product Download Stats - GitHub", "eng-downloads"],
    ["GITHUB - Repo Creation Request", "infra-requests"],
    ["repo creation request", "infra-requests"],
    ["Infra Portal", "infra-portal"],
  ])("finds the One WSO2 screen for the marketplace app %s", (name, id) => {
    expect(searchDirectories(name, ALL_CAPS)[0]?.id).toBe(id);
  });
});
