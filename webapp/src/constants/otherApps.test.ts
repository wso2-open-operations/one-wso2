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

import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readOtherAppUrls } from "@config/apiConfig";
import { OTHER_APPS, OTHER_APP_GROUPS, VPN_ONLY_SUFFIX, otherAppRow, otherAppsSections } from "./otherApps";

const originalConfig = window.config;
afterEach(() => {
  window.config = originalConfig;
  vi.restoreAllMocks();
});

type Perspective = Parameters<typeof otherAppsSections>[0];
const sectionIds = (perspective: Perspective, urls: Record<string, string>) =>
  otherAppsSections(perspective, urls).map((section) => section.id);
const childIds = (perspective: Perspective, urls: Record<string, string>, groupId: string) =>
  (otherAppsSections(perspective, urls).find((section) => section.id === groupId)?.children ?? []).map((row) => row.id);

describe("readOtherAppUrls", () => {
  it("keeps only http(s) addresses, trimmed", () => {
    expect(
      readOtherAppUrls({
        netsuite: " https://netsuite.example/app ",
        allocations: "http://allocations.example",
        travel: "javascript:alert(1)",
        "hr-site": "data:text/html,hi",
        "cs-tools": "not a url",
        nexus: "",
        explorecs: 42,
      }),
    ).toEqual({
      netsuite: "https://netsuite.example/app",
      allocations: "http://allocations.example",
    });
  });

  it("drops a scheme without //, which the browser would open on One WSO2's own site", () => {
    expect(
      readOtherAppUrls({
        travel: "https:travel.example",
        nexus: "http:nexus.example/repo",
        netsuite: "HTTPS://netsuite.example",
      }),
    ).toEqual({ netsuite: "HTTPS://netsuite.example" });
  });

  it("reads nothing from an absent or malformed value", () => {
    expect(readOtherAppUrls(undefined)).toEqual({});
    expect(readOtherAppUrls("https://netsuite.example")).toEqual({});
  });
});

describe("otherAppsSections", () => {
  it("lists nothing when none of the perspective's apps has an address", () => {
    expect(otherAppsSections("finance", {})).toEqual([]);
    expect(otherAppsSections("finance", { salesforce: "https://sf.example" })).toEqual([]);
  });

  it("makes an app with no group an item of its own: a link, in registry order", () => {
    const sections = otherAppsSections("finance", {
      "msl-payslip": "https://payslip.example",
      netsuite: "https://netsuite.example",
    });
    expect(sections).toEqual([
      expect.objectContaining({ id: "other-app-netsuite", label: "NetSuite", externalUrl: "https://netsuite.example" }),
      expect.objectContaining({ id: "other-app-msl-payslip", externalUrl: "https://payslip.example" }),
    ]);
    for (const section of sections) {
      expect(section.children).toBeUndefined();
      expect(section.onSelect).toBeUndefined();
    }
  });

  it("puts related apps inside their group, in the groups' own order", () => {
    const urls = {
      "apim-site": "https://apim.example",
      "wso2-github": "https://github.example",
      nexus: "https://nexus.example",
    };
    expect(sectionIds("engineering", urls)).toEqual([
      "engineering-source-code",
      "engineering-builds-artifacts",
      "engineering-product-sites",
    ]);
    expect(childIds("engineering", urls, "engineering-source-code")).toEqual(["other-app-wso2-github"]);
    const [group] = otherAppsSections("engineering", urls);
    expect(group).toMatchObject({ label: "Source Code", alwaysGroup: true });
  });

  it("leaves out a group none of whose apps has an address", () => {
    expect(sectionIds("engineering", { nexus: "https://nexus.example" })).toEqual(["engineering-builds-artifacts"]);
  });

  it("marks an app reachable only on the VPN", () => {
    const urls = { "support-jenkins": "https://jenkins.example", nexus: "https://nexus.example" };
    const labels = (otherAppsSections("engineering", urls)[0]?.children ?? []).map((row) => row.label);
    expect(labels).toEqual(["WSO2 Nexus Repository", `Support Jenkins${VPN_ONLY_SUFFIX}`]);
  });

  it("opens a grouped app in a new tab, without giving it a handle on One WSO2", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const row = otherAppsSections("engineering", { nexus: "https://nexus.example" })[0]?.children?.[0];

    row?.onSelect?.({ queryClient: new QueryClient() });

    expect(row?.opensInNewTab).toBe(true);
    // Its address too, so a landing can list it as a real link.
    expect(row?.outboundUrl).toBe("https://nexus.example");
    expect(open).toHaveBeenCalledWith("https://nexus.example", "_blank", "noopener,noreferrer");
  });

  it("leaves out an app the rail links from its own group", () => {
    expect(otherAppsSections("sales", { "sales-pitstop": "https://pitstop.example" })).toEqual([]);
    expect(sectionIds("sales", { "sales-pitstop": "https://pitstop.example", salesforce: "https://sf.example" })).toEqual([
      "other-app-salesforce",
    ]);
  });
});

describe("otherAppRow", () => {
  it("is the app's row when it has an address", () => {
    expect(otherAppRow("sales-pitstop", { "sales-pitstop": "https://pitstop.example" })).toMatchObject([
      { id: "other-app-sales-pitstop", label: "Sales Pitstop App", opensInNewTab: true },
    ]);
  });

  it("is nothing when the app has no address or is unknown", () => {
    expect(otherAppRow("sales-pitstop", {})).toEqual([]);
    expect(otherAppRow("not-an-app", { "not-an-app": "https://x.example" })).toEqual([]);
  });
});

describe("the registry", () => {
  it("names every app once", () => {
    const ids = OTHER_APPS.map((app) => app.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every app a marketplace name, a hint and lower-case keywords", () => {
    for (const app of OTHER_APPS) {
      expect(app.marketplaceName.trim(), app.id).not.toBe("");
      expect(app.hint.trim(), app.id).not.toBe("");
      for (const keyword of app.keywords) expect(keyword, app.id).toBe(keyword.toLowerCase());
    }
  });

  it("does not call the security team's site by the Security and Compliance perspective's own name", () => {
    const site = OTHER_APPS.find((app) => app.id === "security-compliance-site");
    expect(site?.label).toBe("Security & Compliance Google Site");
    expect(site?.marketplaceName).toBe("Security & Compliance Portal");
  });

  it("links the rest of the People App from People Ops", () => {
    expect(OTHER_APPS.find((app) => app.id === "people-app")?.perspective).toBe("people");
  });

  it("puts each app under its domain", () => {
    const perspectiveOf = (id: string) => OTHER_APPS.find((app) => app.id === id)?.perspective;
    expect(perspectiveOf("msl-payslip")).toBe("finance");
    expect(perspectiveOf("hr-site")).toBe("people");
    expect(perspectiveOf("sa-site")).toBe("engineering");
    for (const id of ["explorecs", "cs-tools", "cs-tooling-site"]) expect(perspectiveOf(id), id).toBe("customer-success");
    for (const id of ["vpn-setup-guide", "guest-wifi", "network-printer-guide", "diy-infra-portal", "new-software-request"]) {
      expect(perspectiveOf(id), id).toBe("infra");
    }
  });

  it("links no retired app", () => {
    const ids = OTHER_APPS.map((app) => app.id);
    for (const retired of ["github-committership-form", "support-portal-lite", "vpn-qr-code"]) {
      expect(ids).not.toContain(retired);
    }
  });

  it("links neither Allocations nor Travel, which One WSO2 now hosts as the Engagement App", () => {
    const ids = OTHER_APPS.map((app) => app.id);
    expect(ids).not.toContain("allocations");
    expect(ids).not.toContain("travel");
  });

  it("gives every group a label and at least one app", () => {
    for (const group of OTHER_APP_GROUPS) {
      expect(group.label.trim(), group.id).not.toBe("");
      expect(OTHER_APPS.some((app) => app.group === group.id), group.id).toBe(true);
    }
  });
});

describe("the perspectives' rails", () => {
  it("end with each configured app of that perspective, grouped or on its own", async () => {
    vi.resetModules();
    window.config = {
      ...(window.config ?? {}),
      ONE_WSO2_OTHER_APP_URLS: Object.fromEntries(OTHER_APPS.map((app) => [app.id, `https://${app.id}.example`])),
    } as Window["config"];
    const { PERSPECTIVES } = await import("./perspectives");

    const perspectives = new Set(OTHER_APPS.map((app) => app.perspective));
    for (const key of perspectives) {
      const sections = PERSPECTIVES.find((perspective) => perspective.key === key)?.sections ?? [];
      const linked = sections.flatMap((section) => [section, ...(section.children ?? [])]).map((row) => row.id);
      for (const app of OTHER_APPS.filter((candidate) => candidate.perspective === key && !candidate.inOwnGroup)) {
        expect(linked, `${key}: ${app.id}`).toContain(`other-app-${app.id}`);
      }
      // A grouped app runs an action; an app of its own leaves through externalUrl. Never both, never a route.
      for (const section of sections) {
        if (section.id.startsWith("other-app-")) {
          expect(section.externalUrl, section.id).toBeDefined();
          expect(section.onSelect, section.id).toBeUndefined();
        }
        for (const row of section.children ?? []) {
          if (!row.id.startsWith("other-app-")) continue;
          expect(row.path, row.id).toBeUndefined();
          expect(row.externalUrl, row.id).toBeUndefined();
        }
      }
    }
  });

  it("offer Customer Success only once one of its apps is configured", async () => {
    vi.resetModules();
    window.config = { ...(window.config ?? {}), ONE_WSO2_OTHER_APP_URLS: {} } as Window["config"];
    let { PERSPECTIVES } = await import("./perspectives");
    expect(PERSPECTIVES.find((perspective) => perspective.key === "customer-success")?.access).toBe(false);

    vi.resetModules();
    window.config = {
      ...(window.config ?? {}),
      ONE_WSO2_OTHER_APP_URLS: { explorecs: "https://explorecs.example" },
    } as Window["config"];
    ({ PERSPECTIVES } = await import("./perspectives"));
    expect(PERSPECTIVES.find((perspective) => perspective.key === "customer-success")).toMatchObject({
      access: true,
      path: "/customer-success",
    });
  });

  it("put the Digital Operations links in the renamed Infrastructure perspective, after its own tools", async () => {
    vi.resetModules();
    window.config = {
      ...(window.config ?? {}),
      ONE_WSO2_OTHER_APP_URLS: { "guest-wifi": "https://wifi.example", "new-software-request": "https://forms.example" },
    } as Window["config"];
    const { PERSPECTIVES } = await import("./perspectives");

    const infra = PERSPECTIVES.find((perspective) => perspective.key === "infra");
    expect(infra).toMatchObject({ label: "Digital Operations", path: "/infra" });
    const ids = (infra?.sections ?? []).map((section) => section.id);
    expect(ids.slice(-2)).toEqual(["infra-network-vpn", "infra-requests"]);
    expect(PERSPECTIVES.some((perspective) => perspective.key === "digital-operations")).toBe(false);
  });

  it("link Sales Pitstop from its own group, after Ask Sales", async () => {
    vi.resetModules();
    window.config = {
      ...(window.config ?? {}),
      ONE_WSO2_OTHER_APP_URLS: { "sales-pitstop": "https://pitstop.example" },
    } as Window["config"];
    const { PERSPECTIVES } = await import("./perspectives");

    const pitstop = PERSPECTIVES.find((perspective) => perspective.key === "sales")?.sections?.find(
      (section) => section.id === "sales-pitstop",
    );
    expect(pitstop?.children?.map((row) => row.id)).toEqual(["sales-library", "other-app-sales-pitstop"]);
  });

  it("link no app when none is configured", async () => {
    vi.resetModules();
    window.config = { ...(window.config ?? {}), ONE_WSO2_OTHER_APP_URLS: {} } as Window["config"];
    const { PERSPECTIVES } = await import("./perspectives");

    const ids = PERSPECTIVES.flatMap((perspective) => perspective.sections ?? []).flatMap((section) => [
      section.id,
      ...(section.children ?? []).map((row) => row.id),
    ]);
    expect(ids.filter((id) => id.startsWith("other-app-"))).toEqual([]);
    const groupIds = new Set(
      [...new Set(OTHER_APPS.map((app) => app.perspective))].flatMap((key) => OTHER_APP_GROUPS.map((group) => `${key}-${group.id}`)),
    );
    expect(ids.filter((id) => groupIds.has(id))).toEqual([]);
  });
});
