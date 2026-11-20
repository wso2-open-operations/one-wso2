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
import { OTHER_APPS, OTHER_APPS_GROUP_LABEL, VPN_ONLY_SUFFIX, otherAppRow, otherAppsSections } from "./otherApps";

const originalConfig = window.config;
afterEach(() => {
  window.config = originalConfig;
  vi.restoreAllMocks();
});

const childIds = (perspective: Parameters<typeof otherAppsSections>[0], urls: Record<string, string>) =>
  (otherAppsSections(perspective, urls)[0]?.children ?? []).map((row) => row.id);

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
  it("adds no group when none of the perspective's apps has an address", () => {
    expect(otherAppsSections("finance", {})).toEqual([]);
    expect(otherAppsSections("finance", { travel: "https://travel.example" })).toEqual([]);
  });

  it("lists only the apps that have an address, in registry order", () => {
    expect(childIds("finance", { netsuite: "https://netsuite.example" })).toEqual(["other-app-netsuite"]);
    expect(
      childIds("finance", { netsuite: "https://netsuite.example", allocations: "https://allocations.example" }),
    ).toEqual(["other-app-allocations", "other-app-netsuite"]);
  });

  it("is one group that stays a group with a single row", () => {
    const [group] = otherAppsSections("finance", { netsuite: "https://netsuite.example" });
    expect(group).toMatchObject({ id: "finance-other-apps", label: OTHER_APPS_GROUP_LABEL, alwaysGroup: true });
  });

  it("marks an app reachable only on the VPN", () => {
    const [group] = otherAppsSections("engineering", {
      "support-jenkins": "https://jenkins.example",
      nexus: "https://nexus.example",
    });
    expect(group.children?.map((row) => row.label)).toEqual([
      "WSO2 Nexus Repository",
      `Support Jenkins${VPN_ONLY_SUFFIX}`,
    ]);
  });

  it("opens the app in a new tab, without giving it a handle on One WSO2", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const [group] = otherAppsSections("finance", { netsuite: "https://netsuite.example" });
    const row = group.children?.[0];

    row?.onSelect?.({ queryClient: new QueryClient() });

    expect(row?.opensInNewTab).toBe(true);
    expect(open).toHaveBeenCalledWith("https://netsuite.example", "_blank", "noopener,noreferrer");
  });

  it("leaves out an app the rail links from its own group", () => {
    expect(otherAppsSections("sales", { "sales-pitstop": "https://pitstop.example" })).toEqual([]);
    expect(
      childIds("sales", { "sales-pitstop": "https://pitstop.example", salesforce: "https://sf.example" }),
    ).toEqual(["other-app-salesforce"]);
  });
});

describe("otherAppRow", () => {
  it("is the app's row when it has an address", () => {
    expect(otherAppRow("sales-pitstop", { "sales-pitstop": "https://pitstop.example" })).toMatchObject([
      { id: "other-app-sales-pitstop", label: "Open Sales Pitstop", opensInNewTab: true },
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
});

describe("the perspectives' rails", () => {
  it("end with an Other apps group holding each configured app of that perspective", async () => {
    vi.resetModules();
    window.config = {
      ...(window.config ?? {}),
      ONE_WSO2_OTHER_APP_URLS: Object.fromEntries(OTHER_APPS.map((app) => [app.id, `https://${app.id}.example`])),
    } as Window["config"];
    const { PERSPECTIVES } = await import("./perspectives");

    const perspectives = new Set(OTHER_APPS.map((app) => app.perspective));
    for (const key of perspectives) {
      const sections = PERSPECTIVES.find((perspective) => perspective.key === key)?.sections ?? [];
      const last = sections[sections.length - 1];
      expect(last?.id).toBe(`${key}-other-apps`);
      expect(last?.children?.map((row) => row.id)).toEqual(
        OTHER_APPS.filter((app) => app.perspective === key && !app.inOwnGroup).map((app) => `other-app-${app.id}`),
      );
      // A row either routes, leaves through externalUrl, or runs an action; these only run one.
      for (const row of last?.children ?? []) {
        expect(row.path).toBeUndefined();
        expect(row.externalUrl).toBeUndefined();
      }
    }
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

  it("have no Other apps group in a perspective none of whose apps is configured", async () => {
    vi.resetModules();
    window.config = { ...(window.config ?? {}), ONE_WSO2_OTHER_APP_URLS: {} } as Window["config"];
    const { PERSPECTIVES } = await import("./perspectives");

    const groups = PERSPECTIVES.flatMap((perspective) => perspective.sections ?? [])
      .map((section) => section.id)
      .filter((id) => id.endsWith("-other-apps"));
    expect(groups).toEqual([]);
  });
});
