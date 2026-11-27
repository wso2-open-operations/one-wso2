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

import { matchPath } from "react-router";
import type { PerspectiveSection } from "@constants/perspectives";

// Which rail row reads as selected, and which groups are open, resolved from
// the URL rather than from click state — so a deep link, a browser Back or the
// waffle all light the same row.

/**
 * True when the URL *is* this path or sits beneath it.
 *
 * A rail row stands for a screen, and a screen may own routes under itself: a
 * team member's detail page under My Team, a tab under a Leave group. Matching
 * only the exact path leaves the row dark on all of them.
 *
 * `matchPath` rather than `startsWith` so the comparison is by path segment —
 * `/me/leave/general` must not claim `/me/leave/generalization`.
 */
export function onPathOrBelow(path: string, pathname: string): boolean {
  return Boolean(matchPath({ path, end: false }, pathname));
}

/**
 * Groups to render expanded: any holding a child whose screen the URL is on.
 *
 * This has to be as tolerant as `activeItemId` below. It was exact-only, which
 * was invisible while every rail path was also a whole route — then Leave's
 * screens moved under `/me/leave/{kind}/{action}`, no child path matched a URL
 * exactly any more, and the group stopped opening. The selected row was still
 * being computed correctly; it was just folded away inside a closed accordion.
 */
export function activeGroupIds(
  sections: readonly PerspectiveSection[],
  pathname: string,
): Set<string> {
  const ids = new Set<string>();
  for (const s of sections) {
    // A tabbed app is one row. Its children are screens for pins and for
    // lighting that row, not an accordion to open.
    if (s.inTabs) continue;
    if (s.children?.some((c) => c.path && onPathOrBelow(c.path, pathname))) {
      ids.add(s.id);
    }
  }
  return ids;
}

/**
 * The id of the row to mark selected, or "" for none.
 *
 * Two passes on purpose. An exact match must win outright, or a section whose
 * path prefixes another's would steal it; only when nothing matches exactly do
 * descendants count.
 */
/**
 * True when this tabbed app owns the URL: the row's own path, or any screen
 * kept as a child so pins can name it. Those children are not rows, so the
 * app's row is what lights.
 */
function holdsTabbedScreen(section: PerspectiveSection, pathname: string): boolean {
  if (section.path && onPathOrBelow(section.path, pathname)) return true;
  return section.children?.some((c) => c.path && onPathOrBelow(c.path, pathname)) ?? false;
}

export function activeItemId({
  sections,
  pathname,
  overviewPath,
  overviewId,
}: {
  sections: readonly PerspectiveSection[];
  pathname: string;
  overviewPath?: string;
  overviewId: string;
}): string {
  for (const s of sections) {
    // Before the child walk. A tabbed app's screens match exactly, and
    // returning the child would light a row the rail does not render.
    if (s.inTabs && holdsTabbedScreen(s, pathname)) return s.id;
    if (s.path && matchPath(s.path, pathname)) return s.id;
    for (const c of s.children ?? []) {
      if (c.path && matchPath(c.path, pathname)) return c.id;
    }
  }
  if (overviewPath && matchPath(overviewPath, pathname)) return overviewId;

  // The DEEPEST row that can claim this URL, not the first one written down.
  // Two rows can both own a path — a list and a detail beneath it — and taking
  // whichever comes first makes the lit row depend on the order the registry
  // happens to be authored in.
  let best: { id: string; depth: number } | undefined;
  const consider = (id: string, path: string) => {
    if (!onPathOrBelow(path, pathname)) return;
    const depth = path.split("/").filter(Boolean).length;
    if (!best || depth > best.depth) best = { id, depth };
  };
  for (const s of sections) {
    for (const c of s.children ?? []) {
      if (c.path) consider(c.id, c.path);
    }
    if (s.path) consider(s.id, s.path);
  }
  return best?.id ?? "";
}

/**
 * Every rail row someone can actually open, in the order the rail shows them.
 *
 * Leaves only. A group is not a destination — it has no path of its own, it
 * just opens — so the first thing a perspective can forward you to is the first
 * LEAF, which may sit inside the first group rather than being it. Rail order,
 * so "the first one" means on screen what it means here.
 *
 * `path` only, never `externalUrl`, and that is a rule rather than an
 * oversight: ISAC is the FIRST row of the Marketing Ops rail, and opening a
 * perspective must not fling you into another tab. An outbound row is
 * something you choose, so it is offered in the rail and skipped here.
 *
 * `resolveVisible` is asked about a group as well as its children: a group
 * hidden as a whole takes its children with it, which is what the rail does.
 */
export function visibleLeavesOf(
  sections: readonly PerspectiveSection[],
  resolveVisible: (s: PerspectiveSection) => boolean,
): PerspectiveSection[] {
  const leaves: PerspectiveSection[] = [];
  for (const s of sections) {
    if (!resolveVisible(s)) continue;
    if (s.children?.length) {
      leaves.push(...s.children.filter((c) => resolveVisible(c) && c.path));
    } else if (s.path) {
      leaves.push(s);
    }
  }
  return leaves;
}

/**
 * Visible rows that leave One WSO2: a top-level link (`externalUrl`) or a
 * group's row whose action opens another site (`opensInNewTab`). Never a
 * landing's destination (only `path` rows are, see `firstVisibleLeaf`), but a
 * perspective whose only visible rows are these is not empty to its user.
 */
export function visibleOutboundRowsOf(
  sections: readonly PerspectiveSection[],
  resolveVisible: (s: PerspectiveSection) => boolean,
): PerspectiveSection[] {
  const rows: PerspectiveSection[] = [];
  for (const s of sections) {
    if (!resolveVisible(s)) continue;
    if (s.children?.length) {
      rows.push(...s.children.filter((c) => resolveVisible(c) && !c.path && c.opensInNewTab && c.onSelect));
    } else if (!s.path && s.externalUrl) {
      rows.push(s);
    }
  }
  return rows;
}

/**
 * The first leaf in rail order someone may open — WITHOUT skipping ahead of a
 * higher-ranked one that simply hasn't answered yet.
 *
 * `visibleLeaves[0]` is not this: it is built by filtering out everything not
 * YET visible, so a leaf two gates down that answered quickly can land ahead
 * of one first in rail order whose gate is merely slower — the exact bug
 * PerspectiveLanding was reviewed for landing someone on the wrong screen.
 *
 * `sectionAnswered` is what makes the difference: walking rail order, this
 * stops and returns `undefined` ("not decidable yet") the moment it reaches a
 * section whose own answer isn't final, rather than skipping past it to a
 * later one that happens to be. Only once every section ABOVE a visible one
 * has settled — visible or not — does that one count as "the first".
 */
export function firstVisibleLeaf(
  sections: readonly PerspectiveSection[],
  resolveVisible: (s: PerspectiveSection) => boolean,
  sectionAnswered: (s: PerspectiveSection) => boolean,
): PerspectiveSection | undefined {
  for (const s of sections) {
    if (!sectionAnswered(s)) return undefined;
    if (!resolveVisible(s)) continue;
    if (s.children?.length) {
      for (const c of s.children) {
        if (!c.path) continue;
        if (!sectionAnswered(c)) return undefined;
        if (resolveVisible(c)) return c;
      }
      continue;
    }
    if (s.path) return s;
  }
  return undefined;
}
