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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Several perspectives and rail groups are behind preview flags, so the
// registry depends on `window.config` and has to be imported fresh per state
// rather than once at the top of the file.
type Perspectives = typeof import("./perspectives");

async function load(
  preview: { quickquote?: boolean; nda?: boolean } = {},
): Promise<Perspectives> {
  vi.resetModules();
  window.config = {
    ...(window.config ?? {}),
    ONE_WSO2_PREVIEW_FEATURES: preview,
  } as Window["config"];
  return import("./perspectives");
}

const originalConfig = window.config;
beforeEach(() => vi.resetModules());
afterEach(() => {
  window.config = originalConfig;
});

const keys = (perspectives: readonly { key: string }[]) => perspectives.map((p) => p.key);

// Finance MIS shipped out of preview. The ARR Dashboard and Portfolio are
// part of Finance with no preview config, which is what production looks like.
// Quarterly and Monthly stay routes of the dashboard, not rows of their own.
describe("Finance MIS's rail entries", () => {
  const misIdsIn = (perspectives: Perspectives) =>
    (perspectives.findPerspectiveByKey("finance")?.sections ?? [])
      .flatMap((section) => [section, ...(section.children ?? [])])
      .map((section) => section.id)
      .filter((id) => id.startsWith("mis-"));

  it("are present with no preview flags set", async () => {
    expect(misIdsIn(await load({}))).toEqual(["mis-arr-build", "mis-analysis"]);
  });
});

// PAR shipped out of preview once the Lead Portal, Admin Portal, Report
// Chain and F2F all followed the Employee Portal over. Its rail entry is
// unconditional now, so there's nothing left to gate-test here.
describe("PAR's People Ops rail entry", () => {
  it("is always present", async () => {
    const { PEOPLE_OPS_SECTIONS } = await load();
    expect(PEOPLE_OPS_SECTIONS.map((s) => s.id)).toContain("people-par");
  });

  it("leaves the sections that are not gated alone", async () => {
    const { PEOPLE_OPS_SECTIONS } = await load();
    expect(PEOPLE_OPS_SECTIONS.map((s) => s.id)).toContain("people-org-chart");
  });
});

// Sales shipped out of preview: its entry is unconditional now, so it must be
// there with no flags set at all -- which is exactly what production's config
// looks like.
describe("the Sales perspective", () => {
  it("is present, built and routable with no preview flags set", async () => {
    const {
      PERSPECTIVES,
      FUNCTIONAL_PERSPECTIVES,
      reachablePerspectives,
      findPerspectiveByKey,
      findPerspectiveByPath,
    } = await load();
    expect(keys(PERSPECTIVES)).toContain("sales");
    expect(keys(FUNCTIONAL_PERSPECTIVES)).toContain("sales");
    expect(keys(reachablePerspectives())).toContain("sales");
    expect(findPerspectiveByKey("sales")?.path).toBe("/sales");
    expect(findPerspectiveByPath("/sales")?.key).toBe("sales");
  });

  it("brings its rail, not just the tile", async () => {
    // The rail is what a deep link lands beside.
    const { findPerspectiveByKey } = await load();
    expect(findPerspectiveByKey("sales")?.sections?.map((section) => section.id)).toContain("sales-echo");
  });

  // Echo is a group of its screens, like CadO2: Calls and Deals.
  it("lists Echo as a group with Calls and Deals inside it", async () => {
    const { findPerspectiveByKey } = await load();
    const echo = findPerspectiveByKey("sales")?.sections?.find((s) => s.id === "sales-echo");
    expect(echo?.label).toBe("Echo");
    expect(echo?.alwaysGroup).toBe(true);
    expect(echo?.children?.map((c) => [c.id, c.label, c.path])).toEqual([
      ["sales-meetings", "Calls", "/sales/meetings"],
      ["sales-deals", "Opportunities", "/sales/deals"],
    ]);
  });
});

// CadO2 lands behind its own flag, as a whole, inside the Sales perspective.
describe("CadO2's rail entries", () => {
  const salesIdsIn = (perspectives: Perspectives) =>
    (perspectives.findPerspectiveByKey("sales")?.sections ?? [])
      .flatMap((section) => [section, ...(section.children ?? [])])
      .map((section) => section.id);

  it("are a CadO2 group under Sales once the flag is on", async () => {
    const perspectives = await load({ quickquote: true });
    const group = perspectives.findPerspectiveByKey("sales")?.sections?.find((s) => s.id === "sec-app-cado2");
    expect(group?.label).toBe("QuickQuote");
    expect(group?.alwaysGroup).toBe(true);
    expect(group?.children?.map((c) => [c.label, c.path])).toEqual([
      ["Quotes", "/sales/quickquote/quotes"],
      ["Deal Desk", "/sales/quickquote/desk"], // D130
      ["My Approvals", "/sales/quickquote/approvals"],
      ["Insights", "/sales/quickquote/insights/operations"],
      ["Admin", "/sales/quickquote/admin"],
    ]);
  });

  it("are gone when the flag is off, or never mentioned", async () => {
    for (const preview of [{ quickquote: false }, {}]) {
      expect(salesIdsIn(await load(preview))).toEqual([
        "sales-echo",
        "sales-meetings",
        "sales-deals",
        "sales-pitstop",
        "sales-library",
      ]);
    }
  });

  it("never join the Echo gate's ids", async () => {
    const { SALES_ITEM_IDS } = await load({ quickquote: true });
    // Echo and Deals are the Sales rows gated through ONE_WSO2_REVOPS_BACKEND_URL;
    // nothing of CadO2's joins them.
    expect([...SALES_ITEM_IDS]).toEqual(["sales-echo", "sales-meetings", "sales-deals"]);
  });
});

// The Library shipped out of preview: its Sales Pitstop group is part of the Sales perspective with no preview flags set.
describe("the Ask Sales rail entry", () => {
  const salesIdsIn = (perspectives: Perspectives) =>
    (perspectives.findPerspectiveByKey("sales")?.sections ?? []).map((section) => section.id);

  it("is an Ask Sales row in a Sales Pitstop group, after Echo, with no preview flags set", async () => {
    const perspectives = await load({});
    const group = perspectives.findPerspectiveByKey("sales")?.sections?.find((s) => s.id === "sales-pitstop");
    expect(group?.label).toBe("Sales Pitstop");
    expect(group?.alwaysGroup).toBe(true);
    expect(group?.children?.map((c) => [c.id, c.label, c.path])).toEqual([
      ["sales-library", "Ask Sales", "/sales/library"],
    ]);
    expect(salesIdsIn(perspectives)).toEqual(["sales-echo", "sales-pitstop"]);
  });

  it("sits before CadO2 when its flag is on", async () => {
    expect(salesIdsIn(await load({ quickquote: true }))).toEqual([
      "sales-echo",
      "sales-pitstop",
      "sec-app-cado2",
    ]);
  });

  it("is not affected by the other preview flags being off", async () => {
    expect(salesIdsIn(await load({ quickquote: false }))).toEqual(["sales-echo", "sales-pitstop"]);
  });

  it("never joins the Echo gate's ids", async () => {
    const { SALES_ITEM_IDS } = await load({});
    // Echo and Deals are gated through ONE_WSO2_REVOPS_BACKEND_URL; the Library is decided by its own backend.
    expect([...SALES_ITEM_IDS]).toEqual(["sales-echo", "sales-meetings", "sales-deals"]);
  });
});

describe("UMT inside Engineering", () => {
  const umtGroupOf = (perspectives: Perspectives) =>
    perspectives.findPerspectiveByKey("engineering")?.sections?.find((s) => s.id === "engineering-umt");

  it("is not a perspective of its own", async () => {
    const { PERSPECTIVES } = await load();
    expect(keys(PERSPECTIVES)).not.toContain("umt");
  });

  it("is a group in the Engineering rail", async () => {
    const perspectives = await load();
    const group = umtGroupOf(perspectives);
    expect(group?.label).toBe("UMT");
    expect(group?.children?.map((c) => [c.label, c.path])).toEqual([
      ["Overview", "/engineering/umt"],
      ["Updates", "/engineering/umt/updates"],
      ["Products", "/engineering/umt/products"],
      ["Release Chunks", "/engineering/umt/release-chunks"],
      ["Statistics", "/engineering/umt/statistics"],
      ["Documentation", undefined],
    ]);
    // Documentation leaves the app, so the rail marks it as opening a new tab.
    expect(group?.children?.find((c) => c.id === "umt-documentation")?.opensInNewTab).toBe(true);
    expect(perspectives.findPerspectiveByPath("/engineering/umt/updates/42")?.key).toBe("engineering");
  });

  // usePerspectiveVisibility falls through to sectionAllowed(s.requires, caps)
  // for any id not in a gate's own set — and umt-products deliberately sets no
  // `requires`, so that fallback answers "visible to everyone". Dropping this
  // id from the set would open the admin-only rail entry to every UMT user
  // with a green suite and no compile error; this fails loudly instead. See
  // useFinanceGate.test.tsx's "no longer carries the retired approval ids" for
  // the same shape of guard.
  it("keeps Product Management in the UMT admin gate set", async () => {
    const { UMT_ADMIN_ITEM_IDS } = await load();
    expect(UMT_ADMIN_ITEM_IDS.has("umt-products")).toBe(true);
  });

  // Every UMT row is decided by UMT's own roles. An id missing from this set
  // would fall back to `requires`, which none of them sets: visible to all.
  it("gates every UMT row, the group included, on UMT's roles", async () => {
    const perspectives = await load();
    const group = umtGroupOf(perspectives);
    const ids = [group?.id, ...(group?.children ?? []).map((c) => c.id)];
    expect(new Set(ids)).toEqual(perspectives.UMT_ITEM_IDS);
  });
});

describe("perspectives whose landing forwards to the first rail item", () => {
  // The flag is only meaningful on a perspective that HAS a landing route and
  // HAS rows to forward to. Set on one without sections it would mean everyone
  // sees "Nothing here for you yet", permanently, with no way to tell that
  // from a privilege problem.
  it("only ever sits on a perspective with a route and sections", async () => {
    const { PERSPECTIVES } = await load();
    const forwarding = PERSPECTIVES.filter((p) => p.forwardsToFirstItem);
    expect(forwarding.length).toBeGreaterThan(0);
    for (const p of forwarding) {
      expect(p.path, `${p.key} forwards but has no route`).toBeTruthy();
      expect(p.sections?.length, `${p.key} forwards but has no sections`).toBeTruthy();
    }
  });

  // Me's landing is the person's own profile — a page someone stops and reads,
  // so it keeps its Overview row. This fails if a later pass sweeps it up with
  // the rest.
  it("leaves Me alone", async () => {
    const { PERSPECTIVES } = await load();
    expect(PERSPECTIVES.find((p) => p.key === "me")?.forwardsToFirstItem).toBeUndefined();
  });

  describe("the Infra Portal perspective", () => {
    it("is present, built and routable with no preview flag", async () => {
      const { PERSPECTIVES, reachablePerspectives, findPerspectiveByPath } = await load();
      expect(keys(PERSPECTIVES)).toContain("infra");
      expect(keys(reachablePerspectives())).toContain("infra");
      expect(findPerspectiveByPath("/infra")?.key).toBe("infra");
      expect(findPerspectiveByPath("/infra")?.label).toBe("Infrastructure");
    });
  });

  // Engineering shipped out of preview. Download Stats is its first app. UMT
  // is the second. The waffle, favourites, and landing choices all read this
  // registry.
  describe("the Engineering perspective", () => {
    it("offers Download Stats and its six screens with no preview flags set", async () => {
      const { PERSPECTIVES, reachablePerspectives, findPerspectiveByPath } = await load();
      expect(keys(PERSPECTIVES)).toContain("engineering");
      expect(keys(reachablePerspectives())).toContain("engineering");
      const engineering = findPerspectiveByPath("/engineering");
      expect(engineering?.label).toBe("Engineering");
      const labels = (engineering?.sections ?? []).flatMap((section) => [
        section.label,
        ...(section.children ?? []).map((child) => child.label),
      ]);
      expect(labels).toContain("Download Stats");
      expect(labels).not.toContain("Product Download Stats");
      expect(labels).toContain("Overview");
      expect(labels).toContain("Downloads");
      expect(labels).toContain("Versions");
      expect(labels).toContain("Packages");
      expect(labels).toContain("Repository Stats");
      expect(labels).toContain("Admin");
    });
  });
});

// A rail row does exactly one thing when chosen: go to a page (`path`), open a
// site (`externalUrl`), or run an action (`onSelect`). Only this test stops a
// row from carrying two. SideRail hands every click, links included, to its
// `onSelect`, so a row with a `path` or an `externalUrl` and an action would
// follow its link and run the action.
describe("a rail row does one thing", () => {
  type Row = NonNullable<Perspectives["PERSPECTIVES"][number]["sections"]>[number];
  const rowsOf = (rows: readonly Row[] | undefined): Row[] =>
    (rows ?? []).flatMap((row) => [row, ...rowsOf(row.children)]);

  it.each([[true], [false]])("across every perspective, with the preview flags on = %s", async (previewOn) => {
    vi.resetModules();
    window.config = {
      ...(window.config ?? {}),
      ONE_WSO2_PREVIEW_FEATURES: previewOn
        ? { quickquote: true, nda: true }
        : {},
      // ISAC and CSM are only in the registry once their addresses are set.
      ONE_WSO2_MARKETINGOPS_ISAC_URL: "https://isac.example",
      ONE_WSO2_CSM_URL: "https://csm.example",
    } as Window["config"];
    const { PERSPECTIVES } = await import("./perspectives");

    const rows = PERSPECTIVES.flatMap((perspective) => rowsOf(perspective.sections));
    const ids = rows.map((row) => row.id);
    // Guards against this walking nothing and passing for the wrong reason.
    expect(ids).toContain("mops-isac");
    expect(ids).toContain("umt-documentation");

    const doingMoreThanOne = rows
      .filter((row) => [row.path, row.externalUrl, row.onSelect].filter((field) => field !== undefined).length > 1)
      .map((row) => row.id);
    expect(doingMoreThanOne).toEqual([]);
  });
});

// Due Diligence lives under the Legal prefix, so the URL alone selects the
// Legal rail, whichever rail the link was clicked in.
describe("Due Diligence", () => {
  it("is under /legal, so its pages open the Legal rail", async () => {
    const perspectives = await load();
    expect(perspectives.findPerspectiveByPath("/legal/due-diligence/partners")?.key).toBe("legal");
    expect(perspectives.findPerspectiveByPath("/legal/due-diligence/partners/12/finance")?.key).toBe("legal");
  });

  it("links every rail item to /legal/due-diligence", async () => {
    const { DUE_DILIGENCE_APPS } = await import("./dueDiligenceApps");
    const paths = DUE_DILIGENCE_APPS.flatMap((app) => app.items.map((item) => item.path));
    expect(paths).toEqual([
      "/legal/due-diligence/partners",
      "/legal/due-diligence/trade-references",
      "/legal/due-diligence/preferences",
    ]);
  });
});

describe("the Marketing Ops rail", () => {
  it("leads with the Marketing Calendar, then ISAC, when the calendar's preview flag is on", async () => {
    vi.resetModules();
    window.config = {
      ...(window.config ?? {}),
      ONE_WSO2_PREVIEW_FEATURES: { marketingCalendar: true },
      ONE_WSO2_MARKETINGOPS_ISAC_URL: "https://isac.example",
    } as Window["config"];
    const { PERSPECTIVES } = await import("./perspectives");

    const ids = PERSPECTIVES.find((perspective) => perspective.key === "marketing")?.sections?.map(
      (section) => section.id,
    );
    expect(ids?.slice(0, 3)).toEqual(["sec-app-marketing-calendar", "mops-isac", "sec-app-email-workbench"]);
  });
});

describe("the Swag Store perspective", () => {
  async function loadWithStore(on: boolean): Promise<Perspectives> {
    vi.resetModules();
    window.config = {
      ...(window.config ?? {}),
      ONE_WSO2_PREVIEW_FEATURES: on ? { swagStore: true } : {},
    } as Window["config"];
    return import("./perspectives");
  }

  it("is absent while its preview flag is off, so /store opens no rail", async () => {
    const perspectives = await loadWithStore(false);
    expect(perspectives.findPerspectiveByKey("store")).toBeUndefined();
    expect(perspectives.findPerspectiveByPath("/store")).toBeUndefined();
  });

  it("is reachable at /store with the Shop row first once the flag is on", async () => {
    const perspectives = await loadWithStore(true);
    const store = perspectives.findPerspectiveByKey("store");
    expect(store?.path).toBe("/store");
    expect(perspectives.reachablePerspectives().map((p) => p.key)).toContain("store");
    expect(store?.sections?.[0]).toMatchObject({ id: "swag-store-shop", label: "Shop", path: "/store" });
  });

  it("puts the store's admin group in People Ops only while the flag is on", async () => {
    const off = await loadWithStore(false);
    expect(off.findPerspectiveByKey("people")?.sections?.some((s) => s.id === "swag-store-admin")).toBe(false);

    const on = await loadWithStore(true);
    const people = on.findPerspectiveByKey("people");
    const group = people?.sections?.find((s) => s.id === "swag-store-admin");
    expect(group).toMatchObject({ label: "Swag Store", alwaysGroup: true });
    expect(group?.children?.map((c) => [c.id, c.label, c.path])).toEqual([
      ["swag-store-admin-dashboard", "Dashboard", "/people-ops/swag-store/dashboard"],
    ]);
    expect(on.findPerspectiveByPath("/people-ops/swag-store/dashboard")?.key).toBe("people");
  });

  it("owns every store page, so product pages keep the store rail", async () => {
    const perspectives = await loadWithStore(true);
    expect(perspectives.findPerspectiveByPath("/store/p/hoodie")?.key).toBe("store");
  });

  it("lists Shop, Cart, Orders and Alerts as flat rows, with checkout under Cart", async () => {
    const perspectives = await loadWithStore(true);
    const rows = perspectives.findPerspectiveByKey("store")?.sections ?? [];
    expect(rows.map((r) => [r.label, r.path])).toEqual([
      ["Shop", "/store"],
      ["Cart", "/store/cart"],
      ["Orders", "/store/orders"],
      ["Alerts", "/store/alerts"],
    ]);
    expect(rows.every((r) => !r.children)).toBe(true);
    expect(perspectives.findPerspectiveByPath("/store/cart/checkout")?.key).toBe("store");
  });
});
