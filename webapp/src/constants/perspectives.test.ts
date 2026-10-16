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
  preview: { umt?: boolean; infra?: boolean; cado2?: boolean; smartSearch?: boolean } = {},
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

// Finance MIS shipped out of preview. The ARR Dashboard and ARR Analysis are
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
      ["sales-deals", "Deals", "/sales/deals"],
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
    const perspectives = await load({ cado2: true });
    const group = perspectives.findPerspectiveByKey("sales")?.sections?.find((s) => s.id === "sec-app-cado2");
    expect(group?.label).toBe("CadO2");
    expect(group?.alwaysGroup).toBe(true);
    expect(group?.children?.map((c) => [c.label, c.path])).toEqual([
      ["Quotes", "/sales/cado2/quotes"],
      ["My Approvals", "/sales/cado2/approvals"],
      ["Admin", "/sales/cado2/admin"],
    ]);
  });

  it("are gone when the flag is off, or never mentioned", async () => {
    for (const preview of [{ cado2: false }, {}]) {
      expect(salesIdsIn(await load(preview))).toEqual(["sales-echo", "sales-meetings", "sales-deals"]);
    }
  });

  it("never join the Echo gate's ids", async () => {
    const { SALES_ITEM_IDS } = await load({ cado2: true });
    // Echo and Deals are the Sales rows gated through ONE_WSO2_REVOPS_BACKEND_URL;
    // nothing of CadO2's joins them.
    expect([...SALES_ITEM_IDS]).toEqual(["sales-echo", "sales-meetings", "sales-deals"]);
  });
});

// The Library lands behind its own flag, inside a Sales Pitstop group in the Sales perspective.
describe("the Library's rail entry", () => {
  const salesIdsIn = (perspectives: Perspectives) =>
    (perspectives.findPerspectiveByKey("sales")?.sections ?? []).map((section) => section.id);

  it("is a Library row in a Sales Pitstop group, after Echo, once the flag is on", async () => {
    const perspectives = await load({ smartSearch: true });
    const group = perspectives.findPerspectiveByKey("sales")?.sections?.find((s) => s.id === "sales-pitstop");
    expect(group?.label).toBe("Sales Pitstop");
    expect(group?.alwaysGroup).toBe(true);
    expect(group?.children?.map((c) => [c.id, c.label, c.path])).toEqual([
      ["sales-library", "Library", "/sales/library"],
    ]);
    expect(salesIdsIn(perspectives)).toEqual(["sales-echo", "sales-pitstop"]);
  });

  it("sits before CadO2 when both flags are on", async () => {
    expect(salesIdsIn(await load({ smartSearch: true, cado2: true }))).toEqual([
      "sales-echo",
      "sales-pitstop",
      "sec-app-cado2",
    ]);
  });

  it("is gone when the flag is off, or never mentioned", async () => {
    for (const preview of [{ smartSearch: false }, {}]) {
      expect(salesIdsIn(await load(preview))).toEqual(["sales-echo"]);
    }
  });

  it("never joins the Echo gate's ids", async () => {
    const { SALES_ITEM_IDS } = await load({ smartSearch: true });
    // Echo and Deals are gated through ONE_WSO2_REVOPS_BACKEND_URL; the Library is decided by its own backend.
    expect([...SALES_ITEM_IDS]).toEqual(["sales-echo", "sales-meetings", "sales-deals"]);
  });
});

describe("UMT inside Engineering", () => {
  const umtGroupOf = (perspectives: Perspectives) =>
    perspectives.findPerspectiveByKey("engineering")?.sections?.find((s) => s.id === "engineering-umt");

  it("is not a perspective of its own whatever the flags say", async () => {
    for (const preview of [{}, { umt: true }]) {
      const { PERSPECTIVES } = await load(preview);
      expect(keys(PERSPECTIVES)).not.toContain("umt");
    }
  });

  it("is a group in the Engineering rail when its flag is on", async () => {
    const perspectives = await load({ umt: true });
    const group = umtGroupOf(perspectives);
    expect(group?.label).toBe("UMT");
    expect(group?.children?.map((c) => [c.label, c.path])).toEqual([
      ["Overview", "/engineering/umt"],
      ["Updates", "/engineering/umt/updates"],
      ["Product Management", "/engineering/umt/products"],
      ["Release Chunks", "/engineering/umt/release-chunks"],
      ["Statistics", "/engineering/umt/statistics"],
    ]);
    expect(perspectives.findPerspectiveByPath("/engineering/umt/updates/42")?.key).toBe("engineering");
  });

  it("is absent while its own flag is off or absent", async () => {
    expect(umtGroupOf(await load({ umt: false }))).toBeUndefined();
    expect(umtGroupOf(await load())).toBeUndefined();
  });

  // usePerspectiveVisibility falls through to sectionAllowed(s.requires, caps)
  // for any id not in a gate's own set — and umt-products deliberately sets no
  // `requires`, so that fallback answers "visible to everyone". Dropping this
  // id from the set would open the admin-only rail entry to every UMT user
  // with a green suite and no compile error; this fails loudly instead. See
  // useFinanceGate.test.tsx's "no longer carries the retired approval ids" for
  // the same shape of guard.
  it("keeps Product Management in the UMT admin gate set", async () => {
    const { UMT_ADMIN_ITEM_IDS } = await load({ umt: true });
    expect(UMT_ADMIN_ITEM_IDS.has("umt-products")).toBe(true);
  });

  // Every UMT row is decided by UMT's own roles. An id missing from this set
  // would fall back to `requires`, which none of them sets: visible to all.
  it("gates every UMT row, the group included, on UMT's roles", async () => {
    const perspectives = await load({ umt: true });
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
    const { PERSPECTIVES } = await load({ umt: true });
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
    const { PERSPECTIVES } = await load({ umt: true });
    expect(PERSPECTIVES.find((p) => p.key === "me")?.forwardsToFirstItem).toBeUndefined();
  });

  // Infra Portal is behind a preview flag, so the registry depends on
  // `window.config` and has to be imported fresh per state rather than once at
  // the top of the file.
  describe("the Infra Portal perspective", () => {
    it("is absent from the registry when the preview flag is off", async () => {
      const { PERSPECTIVES, reachablePerspectives } = await load({ infra: false });
      expect(keys(PERSPECTIVES)).not.toContain("infra");
      expect(keys(reachablePerspectives())).not.toContain("infra");
    });
  
    it("is absent on an absent flag, not only on an explicit false", async () => {
      const { PERSPECTIVES } = await load();
      expect(keys(PERSPECTIVES)).not.toContain("infra");
    });
  
    it("is present, built and routable, when the preview flag is on", async () => {
      const { PERSPECTIVES, reachablePerspectives, findPerspectiveByPath } = await load({
        infra: true,
      });
      expect(keys(PERSPECTIVES)).toContain("infra");
      expect(keys(reachablePerspectives())).toContain("infra");
      expect(findPerspectiveByPath("/infra")?.key).toBe("infra");
      expect(findPerspectiveByPath("/infra")?.label).toBe("Infrastructure");
    });
  });

  // Engineering shipped out of preview. Download Stats is its first app. UMT
  // is the second, and only while its own preview flag is on. The waffle,
  // favourites, and landing choices all read this registry.
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
