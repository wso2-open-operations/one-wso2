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

// The Event Platform's shape: ONE rail entry, and the source app's two sidebars
// turned into tab rows — the Leave pattern (see features/leave/leaveTabs.ts).
//
// The source (agenda-organizer) had a dashboard sidebar (All Events, All
// Speakers) and, inside an event, a second sidebar whose groups were Sessions
// and O2C with Settings on its own. Here the dashboard sidebar is the top-level
// tab row, each in-event group is a tab, and a group's items are the toggle
// inside it. Two tab sets rather than one because the second only exists under
// an event: every path in it carries the `:eventId`.
//
// Kinds are route segments rather than component state for Leave's reason: the
// gate is enforced at the ROUTE, and a typed URL has to be refused the same way
// a hidden toggle is.

/** The base of every Event Platform route. */
export const EVENT_PLATFORM_PATH = "/marketing-ops/event-platform";

/**
 * The rail items, one per top-level tab, in rail order. The rail replaces the
 * top-level tab row; inside an event the tab row is back. All Events is gated
 * on either capability, Speakers on admin — see useMarketingOpsGate.
 */
export const EVENT_PLATFORM_ITEM_IDS = {
  events: "mops-event-platform-events",
  speakers: "mops-event-platform-speakers",
} as const;

/**
 * Permissions, resolved by `useMarketingOpsGate().canSee`. The source had two
 * roles: admin (everything) and shop (the shop, and nothing else). The
 * marketing-ops `isAdmin` master key opens every one of these.
 *
 * The events list has an id of its own, the same one as its rail item: a shop
 * user needs the list to reach an event's shop, so it takes either role, and
 * sharing the rail's id means the rail can never offer an entry the route then
 * refuses.
 */
export type EventPlatformGateId =
  /** `eventplatform` — the source's admin role. */
  | "mops-event-platform-admin"
  /** `eventplatform` OR `eventplatform-shop` — the All Events rail item and its route. */
  | typeof EVENT_PLATFORM_ITEM_IDS.events
  /** `eventplatform` OR `eventplatform-shop`. */
  | "mops-event-platform-shop";

export interface EventPlatformKindDef {
  /** URL segment. Absent from the URL of a single-kind tab — see the builders. */
  kind: string;
  /** Toggle label. */
  label: string;
  /** Checked before the toggle offers it AND before its route renders. */
  gateId: EventPlatformGateId;
  /**
   * Shown under the page title while this kind is selected. Only the top-level
   * tabs have one: inside an event the header is hidden, so a subtitle there
   * would be rendered nowhere.
   */
  subtitle?: string;
}

export interface EventPlatformTabDef {
  /** URL segment under the tab set's base path. */
  segment: string;
  label: string;
  /** Offered kinds, in toggle order. One entry means no toggle is drawn. */
  kinds: readonly EventPlatformKindDef[];
}

/** `/marketing-ops/event-platform/<segment>` — the source's DashboardSideBar. */
export const TOP_LEVEL_TABS: readonly EventPlatformTabDef[] = [
  {
    segment: "events",
    label: "Events",
    kinds: [
      {
        kind: "events",
        label: "Events",
        // router.tsx — behind AdminGuard. Opened to shop users here, so they
        // have a list to reach an event's shop from (the port spec's Q1). The
        // page itself decides what each role gets: admins the full dashboard,
        // shop users a read-only list whose cards open `shop/inventory`.
        gateId: EVENT_PLATFORM_ITEM_IDS.events,
        subtitle:
          "Every event on the platform. Open one to plan its agenda or run its shop.",
      },
    ],
  },
  {
    segment: "speakers",
    label: "Speakers",
    kinds: [
      {
        kind: "speakers",
        label: "Speakers",
        gateId: "mops-event-platform-admin",
        subtitle:
          "The speaker library shared by every event. Add a speaker once and use them anywhere.",
      },
    ],
  },
] as const;

/** `/marketing-ops/event-platform/events/:eventId/<segment>` — the source's EventSidebar. */
export const EVENT_TABS: readonly EventPlatformTabDef[] = [
  {
    segment: "sessions",
    label: "Sessions",
    kinds: [
      {
        kind: "agenda",
        // The source called this "Session Editor". The tab already says
        // Sessions, so the toggle names what the screen shows.
        label: "Agenda",
        gateId: "mops-event-platform-admin",
      },
      {
        kind: "speakers",
        label: "Speakers",
        gateId: "mops-event-platform-admin",
      },
      {
        kind: "rooms",
        label: "Rooms",
        gateId: "mops-event-platform-admin",
      },
      {
        kind: "activities",
        label: "Activities",
        gateId: "mops-event-platform-admin",
      },
      {
        kind: "export",
        label: "Export",
        gateId: "mops-event-platform-admin",
      },
    ],
  },
  {
    segment: "shop",
    // The source grouped these as "O2C". Shop is what the people using it
    // call it.
    label: "Shop",
    kinds: [
      {
        kind: "inventory",
        label: "Inventory",
        // router.tsx — outside AdminGuard: admin OR shop.
        gateId: "mops-event-platform-shop",
      },
      {
        kind: "orders",
        label: "Orders",
        gateId: "mops-event-platform-shop",
      },
    ],
  },
  {
    segment: "settings",
    label: "Settings",
    kinds: [
      {
        kind: "settings",
        label: "Settings",
        gateId: "mops-event-platform-admin",
      },
    ],
  },
] as const;

/** The base of every in-event path. */
export function eventBasePath(eventId: string): string {
  return `${EVENT_PLATFORM_PATH}/events/${encodeURIComponent(eventId)}`;
}

/**
 * A single-kind tab carries no kind segment — `/settings` rather than
 * `/settings/settings`. The shape follows the tab's DEFINITION, not the
 * caller's permissions, so two people never see different URLs for one screen.
 */
function tabPath(
  base: string,
  tab: EventPlatformTabDef,
  kind?: string,
): string {
  const path = `${base}/${tab.segment}`;
  if (tab.kinds.length < 2) return path;
  return kind ? `${path}/${kind}` : path;
}

/** The URL for one top-level tab. */
export function eventPlatformPath(
  tab: EventPlatformTabDef,
  kind?: string,
): string {
  return tabPath(EVENT_PLATFORM_PATH, tab, kind);
}

/** The URL for one in-event tab, optionally at one kind. */
export function eventPath(
  eventId: string,
  tab: EventPlatformTabDef,
  kind?: string,
): string {
  return tabPath(eventBasePath(eventId), tab, kind);
}

export function topLevelTab(segment: string): EventPlatformTabDef | undefined {
  return TOP_LEVEL_TABS.find((t) => t.segment === segment);
}

export function eventTab(segment: string): EventPlatformTabDef | undefined {
  return EVENT_TABS.find((t) => t.segment === segment);
}

/** The kinds of `tab` this person may open, in toggle order. */
export function visibleKinds(
  tab: EventPlatformTabDef,
  canSee: (id: string) => boolean,
): EventPlatformKindDef[] {
  return tab.kinds.filter((k) => canSee(k.gateId));
}

/** The tabs of `tabs` worth drawing: those with at least one kind this person may open. */
export function visibleTabs(
  tabs: readonly EventPlatformTabDef[],
  canSee: (id: string) => boolean,
): EventPlatformTabDef[] {
  return tabs.filter((t) => visibleKinds(t, canSee).length > 0);
}

/**
 * Where to land: the first tab this person may open, at its first kind they
 * may open. Top level without an `eventId`, inside that event with one.
 *
 * `undefined` means there is nowhere to go — someone holding neither role.
 * Drives the index redirects and the guards' refusals both, so they cannot
 * disagree.
 */
export function firstAllowedPath(
  canSee: (id: string) => boolean,
  eventId?: string,
): string | undefined {
  const tabs = eventId === undefined ? TOP_LEVEL_TABS : EVENT_TABS;
  const tab = visibleTabs(tabs, canSee)[0];
  if (!tab) return undefined;
  const kind = visibleKinds(tab, canSee)[0];
  return eventId === undefined
    ? eventPlatformPath(tab, kind?.kind)
    : eventPath(eventId, tab, kind?.kind);
}

/**
 * Which event, tab and kind a URL under EVENT_PLATFORM_PATH names.
 *
 * `/events` is the top-level Events tab; `/events/<id>/...` is inside an event.
 * Tolerant like parseLeavePath: an unknown segment yields no tab rather than
 * throwing, and the caller decides what to do about it.
 */
export function parseEventPlatformPath(pathname: string): {
  eventId?: string;
  tab?: EventPlatformTabDef;
  kind?: EventPlatformKindDef;
} {
  const rest = pathname.startsWith(EVENT_PLATFORM_PATH)
    ? pathname.slice(EVENT_PLATFORM_PATH.length)
    : "";
  if (!rest.startsWith("/") && rest !== "") return {};
  const segments = rest.replace(/^\//, "").split("/");

  if (segments[0] === "events" && segments[1]) {
    const eventId = decodeSegment(segments[1]);
    const tab = segments[2] ? eventTab(segments[2]) : undefined;
    if (!tab) return { eventId };
    return { eventId, tab, kind: kindOf(tab, segments[3]) };
  }

  const tab = segments[0] ? topLevelTab(segments[0]) : undefined;
  if (!tab) return {};
  return { tab, kind: kindOf(tab, segments[1]) };
}

// A typed URL can carry a malformed escape (`%E0`), and decodeURIComponent
// throws on one. The pages parse the path while rendering, so a throw here
// would take down the whole tree; fall back to the raw segment, as React
// Router's own path decoding does.
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

// A single-kind tab has no kind segment, so its one kind is implied.
function kindOf(
  tab: EventPlatformTabDef,
  segment?: string,
): EventPlatformKindDef | undefined {
  if (tab.kinds.length < 2) return tab.kinds[0];
  return tab.kinds.find((k) => k.kind === segment);
}
