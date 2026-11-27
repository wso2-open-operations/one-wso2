/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { describe, expect, it } from "vitest";
import {
  activeGroupIds,
  activeItemId,
  firstVisibleLeaf,
  onPathOrBelow,
  visibleLeavesOf,
  visibleOutboundRowsOf,
} from "./railActive";
import { PERSPECTIVES, type PerspectiveSection } from "@constants/perspectives";

// Driven off the real registry, not a fixture: the bug this covers was a rail
// path that stopped being a whole route, and a fixture would have been updated
// alongside the routes and never noticed.
const { ME_APPS } = await import("@constants/meApps");

const leaveApp = ME_APPS.find((a) => a.key === "leave")!;
const sections: PerspectiveSection[] = [
  {
    id: "leave",
    label: leaveApp.name,
    children: leaveApp.items.map((it) => ({ id: it.id, label: it.label, path: it.path })),
  },
  {
    id: "my-team-section",
    label: "My Team",
    children: [{ id: "my-team", label: "My Team", path: "/me/my-team" }],
  },
];

const itemFor = (pathname: string) =>
  activeItemId({ sections, pathname, overviewPath: "/me", overviewId: "overview" });

// Every screen the Leave app can be on. A row must light on all of them, and
// the group holding it must be open, or the lit row is folded out of sight.
const LEAVE_URLS: [string, string][] = [
  // Leave is one row now, and every screen under it — tab and kind alike —
  // has to light that row. The kind is two segments deep, which is exactly
  // what `onPathOrBelow` matching by segment is for.
  ["/me/leave", "leave-home"],
  ["/me/leave/apply/general", "leave-home"],
  ["/me/leave/apply/sabbatical", "leave-home"],
  ["/me/leave/history/general", "leave-home"],
  ["/me/leave/history/sabbatical", "leave-home"],
  ["/me/leave/approvals", "leave-home"],
  ["/me/leave/approval-history", "leave-home"],
  ["/me/leave/reports/general", "leave-home"],
  ["/me/leave/reports/sabbatical", "leave-home"],
];

describe("which row is selected", () => {
  for (const [url, expected] of LEAVE_URLS) {
    it(`lights ${expected} on ${url}`, () => {
      expect(itemFor(url)).toBe(expected);
    });
  }

  it("keeps a detail route under its own section", () => {
    expect(itemFor("/me/my-team/E123")).toBe("my-team");
  });

  it("falls back to the overview when nothing else matches", () => {
    expect(itemFor("/me")).toBe("overview");
  });

  it("lights nothing on an unrelated route", () => {
    expect(itemFor("/somewhere-else")).toBe("");
  });
});

// The reported bug. Every leave URL resolved its row correctly, but the group
// was computed with an exact match only, so on a tab route no child matched and
// the accordion stayed shut — the highlight was there and invisible.
describe("which groups are open", () => {
  for (const [url] of LEAVE_URLS) {
    it(`opens Leave on ${url}`, () => {
      expect(activeGroupIds(sections, url).has("leave")).toBe(true);
    });
  }

  it("opens the section a detail route belongs to", () => {
    expect(activeGroupIds(sections, "/me/my-team/E123").has("my-team-section")).toBe(true);
  });

  it("opens nothing on an unrelated route", () => {
    expect(activeGroupIds(sections, "/somewhere-else").size).toBe(0);
  });

  it("does not open a group for a path that merely shares a prefix string", () => {
    expect(activeGroupIds(sections, "/me/leavers").size).toBe(0);
  });
});

describe("matching by segment, not by string", () => {
  it("claims a path and everything beneath it", () => {
    expect(onPathOrBelow("/me/leave", "/me/leave")).toBe(true);
    expect(onPathOrBelow("/me/leave", "/me/leave/apply/general")).toBe(true);
    expect(onPathOrBelow("/me/leave", "/me/leave/apply/general/")).toBe(true);
  });

  it("does not claim a longer word starting with it", () => {
    expect(onPathOrBelow("/me/leave", "/me/leavers")).toBe(false);
  });

  it("does not claim a sibling", () => {
    expect(onPathOrBelow("/me/leave/apply", "/me/leave/history/general")).toBe(false);
  });
});

// The two-pass ordering, asserted against a shape the registry does not
// currently contain but is one entry away from: a row whose path owns another
// row's. Today only `/me` and `/people-ops` own anything, and both are
// perspective paths matched exactly, so nothing exercises this — which is
// exactly why it is worth stating rather than leaving to be rediscovered.
describe("an exact match beats a descendant one", () => {
  const nested: PerspectiveSection[] = [
    {
      id: "reports",
      label: "Reports",
      children: [
        { id: "reports-home", label: "All", path: "/people-ops/reports" },
        { id: "reports-active", label: "Active", path: "/people-ops/reports/active-employees" },
      ],
    },
  ];
  const item = (pathname: string) =>
    activeItemId({ sections: nested, pathname, overviewPath: "/people-ops", overviewId: "ov" });

  it("gives the deeper row its own URL, not the one that owns it", () => {
    expect(item("/people-ops/reports/active-employees")).toBe("reports-active");
  });

  it("still gives the owning row its own URL", () => {
    expect(item("/people-ops/reports")).toBe("reports-home");
  });

  it("falls back to the owner for a URL only it can claim", () => {
    expect(item("/people-ops/reports/something-else")).toBe("reports-home");
  });

  // Both rows can claim this one: it sits under the owner AND under the deeper
  // row. Taking whichever appears first in the registry makes the lit row
  // depend on the order entries happen to be written in.
  it("gives a deeper URL to the deeper row, not the one listed first", () => {
    expect(item("/people-ops/reports/active-employees/E123")).toBe("reports-active");
  });

  it("does the same when the deeper row is listed first", () => {
    const reordered: PerspectiveSection[] = [
      {
        id: "reports",
        label: "Reports",
        children: [
          { id: "reports-active", label: "Active", path: "/people-ops/reports/active-employees" },
          { id: "reports-home", label: "All", path: "/people-ops/reports" },
        ],
      },
    ];
    expect(
      activeItemId({
        sections: reordered,
        pathname: "/people-ops/reports/active-employees/E123",
        overviewPath: "/people-ops",
        overviewId: "ov",
      }),
    ).toBe("reports-active");
  });
});

describe("visibleLeavesOf", () => {
  const sections: PerspectiveSection[] = [
    { id: "group", label: "Group", children: [
      { id: "child-hidden", label: "Hidden", path: "/a/hidden" },
      { id: "child-shown", label: "Shown", path: "/a/shown" },
    ] },
    { id: "leaf", label: "Leaf", path: "/b" },
  ];

  // THE thing a perspective landing depends on: the first entry is where it
  // sends you, and a group is not somewhere you can be sent.
  it("returns leaves in rail order, never the groups holding them", () => {
    expect(visibleLeavesOf(sections, () => true).map((s) => s.id)).toEqual([
      "child-hidden",
      "child-shown",
      "leaf",
    ]);
  });

  it("drops a child its gate hides", () => {
    const visible = (s: PerspectiveSection) => s.id !== "child-hidden";
    expect(visibleLeavesOf(sections, visible).map((s) => s.id)).toEqual(["child-shown", "leaf"]);
  });

  // A hidden group takes its children with it — the rail never renders them,
  // so a landing must never forward to one.
  it("drops a hidden group's children with it", () => {
    const visible = (s: PerspectiveSection) => s.id !== "group";
    expect(visibleLeavesOf(sections, visible).map((s) => s.id)).toEqual(["leaf"]);
  });

  // A scroll-anchor section carries no path. Forwarding to one would navigate
  // nowhere.
  it("skips a leaf with no route", () => {
    const anchors: PerspectiveSection[] = [{ id: "anchor", label: "Anchor" }];
    expect(visibleLeavesOf(anchors, () => true)).toEqual([]);
  });
});

// THE thing PerspectiveLanding redirects on now — not visibleLeavesOf[0],
// which fills in whatever has resolved so far and can rank a quick lower
// answer ahead of a slow higher one.
describe("firstVisibleLeaf", () => {
  const sections: PerspectiveSection[] = [
    {
      id: "group",
      label: "Group",
      children: [
        { id: "child-hidden", label: "Hidden", path: "/a/hidden" },
        { id: "child-shown", label: "Shown", path: "/a/shown" },
      ],
    },
    { id: "leaf", label: "Leaf", path: "/b" },
  ];
  const allAnswered = () => true;

  it("returns the first visible leaf when everything has answered", () => {
    const visible = (s: PerspectiveSection) => s.id !== "child-hidden";
    expect(firstVisibleLeaf(sections, visible, allAnswered)?.id).toBe("child-shown");
  });

  it("returns undefined, not a lower-ranked leaf, while a section above it has not answered", () => {
    // "leaf" is visible and would rank last of what's answered, but "group"
    // (ranked above it) has not answered — nothing here is safe to return yet.
    const visible = (s: PerspectiveSection) => s.id === "leaf";
    const answered = (s: PerspectiveSection) => s.id !== "group";
    expect(firstVisibleLeaf(sections, visible, answered)).toBeUndefined();
  });

  it("returns undefined while an EARLIER CHILD within an answered, visible group has not answered", () => {
    // The group itself has answered and is visible, but its first child
    // (ranked above the second) has not — the second child must not be
    // returned just because it happens to already be visible.
    const visible = (s: PerspectiveSection) => s.id === "group" || s.id === "child-shown";
    const answered = (s: PerspectiveSection) => s.id !== "child-hidden";
    expect(firstVisibleLeaf(sections, visible, answered)).toBeUndefined();
  });

  it("moves past a group that answered hidden, without waiting on its children", () => {
    // A hidden group's children are never checked at all — matching
    // visibleLeavesOf, which drops them the same way.
    const visible = (s: PerspectiveSection) => s.id === "leaf";
    const answered = (s: PerspectiveSection) => s.id !== "child-hidden" && s.id !== "child-shown";
    expect(firstVisibleLeaf(sections, visible, answered)?.id).toBe("leaf");
  });

  it("skips a leaf with no route, same as visibleLeavesOf", () => {
    const anchors: PerspectiveSection[] = [{ id: "anchor", label: "Anchor" }];
    expect(firstVisibleLeaf(anchors, () => true, allAnswered)).toBeUndefined();
  });

  it("returns undefined when every section has answered and none is visible", () => {
    expect(firstVisibleLeaf(sections, () => false, allAnswered)).toBeUndefined();
  });
});

// Download Stats is one rail row, and every screen under it — the ones the
// tab bar offers — has to light that row. The screens are siblings, not routes
// nested under Overview, which is why a prefix of Overview is not enough.
// Engineering is not behind a preview flag, so this reads the registry as it
// ships, with no flag set.
const downloadStats = PERSPECTIVES.find((p) => p.key === "engineering")?.sections?.find(
  (section) => section.label === "Download Stats",
);

describe("Download Stats stays selected on every screen", () => {
  const urls = [
    "/engineering/download-stats/overview",
    "/engineering/download-stats/downloads",
    "/engineering/download-stats/versions",
    "/engineering/download-stats/packages",
    "/engineering/download-stats/repository-stats",
    "/engineering/download-stats/admin",
  ];

  for (const url of urls) {
    it(`lights Download Stats on ${url}`, () => {
      expect(downloadStats?.inTabs).toBe(true);
      expect(
        activeItemId({
          sections: downloadStats ? [downloadStats] : [],
          pathname: url,
          overviewId: "overview",
        }),
      ).toBe(downloadStats?.id);
      // A leaf has nothing to expand. Treating it as an open group asks the
      // rail for a flyout of screens it no longer lists.
      expect(activeGroupIds(downloadStats ? [downloadStats] : [], url).size).toBe(0);
    });
  }
});

describe("visibleOutboundRowsOf", () => {
  const sections: PerspectiveSection[] = [
    { id: "home", label: "Home", path: "/x" },
    { id: "site", label: "Site", externalUrl: "https://site.example" },
    {
      id: "group",
      label: "Group",
      children: [
        { id: "page", label: "Page", path: "/x/page" },
        { id: "tool", label: "Tool", opensInNewTab: true, onSelect: () => {} },
        { id: "hidden-tool", label: "Hidden", opensInNewTab: true, onSelect: () => {} },
      ],
    },
  ];

  it("lists the visible rows that open another site, and no in-app page", () => {
    const rows = visibleOutboundRowsOf(sections, (s) => s.id !== "hidden-tool");
    expect(rows.map((row) => row.id)).toEqual(["site", "tool"]);
  });

  it("lists nothing under a group the rail hides", () => {
    const rows = visibleOutboundRowsOf(sections, (s) => s.id !== "group");
    expect(rows.map((row) => row.id)).toEqual(["site"]);
  });
});
