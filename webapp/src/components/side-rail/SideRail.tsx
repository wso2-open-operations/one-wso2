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

import { useMemo, useState, type JSX, type ReactNode } from "react";
import { Box, Link, Sidebar, Typography } from "@wso2/oxygen-ui";
import { ExternalLinkIcon, LifeBuoyIcon, SettingsIcon } from "@wso2/oxygen-ui-icons-react";
import { Link as RouterLink, matchPath, useLocation, useNavigate } from "react-router";
import { useActivePerspective } from "@context/perspective/PerspectiveContext";
import { SUBSCRIPTION_ITEM_IDS, type PerspectiveSection } from "@constants/perspectives";
import { capabilitiesFromPrivileges, type Capability } from "@constants/appMenu";
import { FINANCE_ITEM_IDS } from "@constants/financeApps";
import { LEAVE_ITEM_IDS } from "@constants/meApps";
import { DUE_DILIGENCE_ITEM_IDS } from "@constants/dueDiligenceApps";
import { csmUrl, isCsmConfigured } from "@config/apiConfig";
import { useUserInfo } from "@api/useUserInfo";
import { useFinanceGate } from "@features/finance/api/useFinanceGate";
import { useLeaveGate } from "@features/leave/api/useLeaveGate";
import {
  activeGroupIds as activeGroupIdsFor,
  activeItemId as activeItemIdFor,
} from "./railActive";
import { useMarketingOpsGate } from "@features/marketing-ops/api/useMarketingOpsGate";
import { useDueDiligenceGate } from "@features/due-diligence/api/useDueDiligenceGate";
import { useSubscriptionGate } from "@features/subscriptions/api/useSubscriptionGate";
import { isSriLankaWorkLocation } from "@features/subscriptions/util/locationGate";

// Context-sensitive left rail, built on Oxygen's compound `Sidebar`.
//
// Everything visual comes from the library: `Sidebar.ItemLabel` renders the
// selected row at weight 600 and every other row at 400, `Sidebar.ItemIcon`
// tints the active icon `primary.main`, and `Sidebar.Item` supplies the group
// chevron plus a hover flyout when the rail is collapsed. This component
// deliberately sets NO font weights, colours, or paddings of its own — if a
// style literal creeps back in here, the migration has regressed.
//
// Sections still render generically from the perspective registry: a leaf is
// either a route (`path`) or a scroll-anchor (`id`); a section with `children`
// is a collapsible group whose children are filtered by capability. A group
// with a single visible child collapses to a plain leaf (e.g. Menu → Home).
//
// Oxygen's Sidebar is id-based (`activeItem` + `onSelect`) rather than
// link-based, which suits that route/anchor duality better than the NavLink
// tree this replaces: route items are wrapped in a real anchor so
// middle-click and cmd-click still work, and anchor-only items fall through
// to `onSelect`.

interface SideRailProps {
  collapsed: boolean;
}

/** Id for the perspective's own landing route. */
const OVERVIEW_ID = "perspective-overview";
/** Footer row, outside any perspective — it is a global page, not a section. */
const SETTINGS_ID = "settings";
const SETTINGS_PATH = "/settings";
/**
 * Top-level row linking out to the CSM Portal — a separate application this
 * webapp does not host, so it opens in a new tab rather than routing. Reuses
 * the same `csmUrl`/`isCsmConfigured` gate as the waffle's CSM tile: omitted
 * entirely when unconfigured, same "no link to nowhere" contract as ISAC.
 */
const CSM_PORTAL_ID = "csm-portal";

// Left padding for a sub-item, so its label lines up with its parent's label
// rather than with the parent's icon.
//
// Oxygen indents a nested row by depth alone — `paddingLeft: spacing(2 + depth*2)`
// — which puts a depth-1 label 40px from the rail edge (8 margin + 32 padding).
// But a parent row carries an icon, so ITS label starts at 60px:
//   8 margin + 16 padding + 20 icon + 16 icon gutter.
// Left at the default, every sub-item hangs 20px to the left of the item it
// belongs to. spacing(6.5) = 52px, so 8 + 52 lands the sub-label at exactly 60.
//
// Only applies to expanded rows: Oxygen renders nested items through a popover,
// not this list, when the rail is collapsed.
const NESTED_LABEL_PL = 6.5;

// Oxygen's ItemLabel sets `overflow: hidden; white-space: nowrap` but no
// `text-overflow`, so a label wider than the rail is cut mid-glyph — it reads
// as a typo ("Active employee repor") rather than as truncation. Rail labels
// should be short enough not to need this, but it's the difference between a
// graceful degrade and a bug report the next time one grows.
// `display: block` is load-bearing, not tidying: MUI renders the primary text
// as an inline <span>, and `text-overflow` has no effect on an inline box — the
// property applies but never renders an ellipsis. Verified in a browser.
const ELLIPSIS_SX = {
  "& .MuiListItemText-primary": {
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
} as const;

export default function SideRail({ collapsed }: SideRailProps): JSX.Element {
  const active = useActivePerspective();
  const userInfo = useUserInfo();
  const caps = capabilitiesFromPrivileges(userInfo.data?.privileges);
  const navigate = useNavigate();
  const location = useLocation();

  // Finance items (OPD/credit-card/expense, surfaced under Me) gate on each
  // finance app's OWN backend roles, not the coarse people-app capabilities
  // — so someone who is a people-app lead but not a cc-expenses lead/finance
  // doesn't see "Approve Submissions". Dispatched per item id rather than
  // per perspective since Finance items are just some of Me's sections now.
  // Only fetch those roles while Me is active.
  // Both perspectives: the claim apps' own screens are under Me, and Claim
  // approval is under Finance. One gate answers for both, so it has to be
  // asked in either place.
  const financeGate = useFinanceGate(active.key === "me" || active.key === "finance");

  // Leave is the same problem again: its backend numbers LEAD 879 /
  // PEOPLE_OPS_TEAM 789, unrelated to people-app's 993 / 999. Reading
  // `requires` against `caps` showed Reports to a people-app lead who cannot
  // use it, and hid it from a leave lead who can.
  const leaveGate = useLeaveGate(active.key === "me");

  // Marketing Ops is the same shape of problem and needs the same treatment:
  // its rail gates on the MARKETING OPS backend's own Asgardeo groups
  // (app-marketingops-*), which bear no relation to the people-app privilege
  // numbers `caps` is built from. Reading `requires` against `caps` would show
  // a people-app admin every marketing screen — including ones the marketing
  // backend then 403s — and hide them from an actual Marketing Ops admin who
  // happens not to be a people-app admin. The registry says as much at
  // @constants/perspectives: the `requires` on those sections is a coarse hint,
  // and whatever renders them has to ask this gate.
  const isMarketingOps = active.key === "marketing";
  const marketingOpsGate = useMarketingOpsGate(isMarketingOps);

  // Due Diligence is the same shape of problem again, and needs the same
  // treatment: it gates on ITS OWN backend's roles, which bear no relation to
  // the people-app privilege numbers `caps` is built from. It is reachable
  // from two perspectives (Finance and Legal — see DUE_DILIGENCE_APPS), so
  // the gate is enabled for either.
  const dueDiligenceGate = useDueDiligenceGate(active.key === "finance" || active.key === "legal");

  // Subscriptions (People Ops → PickMe Commute / LaaS) is the same shape of
  // problem once more, with one extra wrinkle worth naming: its backend
  // publishes the NAMES of its two admin Asgardeo groups on
  // /subscriptions/meta-info and leaves the comparison against the caller's own
  // groups to the client, because it has no `/me` of its own. So the gate here
  // is a join of that response and the id_token, not a single backend verdict —
  // see useSubscriptionGate. Only fetched while People Ops is the active
  // perspective; every other perspective has no business calling it.
  const isPeopleOps = active.key === "people";
  const subscriptionGate = useSubscriptionGate(isPeopleOps);

  // Both services are a Colombo-office perk, so the section as a whole is
  // Sri-Lanka-only — see isSriLankaWorkLocation. `userInfo` is the SAME call
  // `caps` above already makes (people-app's /user-info), so this piggybacks
  // on an existing fetch rather than adding one: no new request, just one more
  // field read off a response already in flight for every perspective. While
  // it's unresolved, `workLocation` reads as undefined and this returns false
  // — the same fail-closed-while-loading behaviour `caps`-gated items already
  // get from `capabilitiesFromPrivileges` defaulting privileges to `[]`, so a
  // gate is never mistakenly satisfied just because its data hasn't landed
  // yet.
  //
  // Beyond that: the group and the self-service screen are open to every Sri
  // Lanka employee — opting yourself in and out is not an HR-team action.
  // Only the manage-on-behalf screen ALSO needs a group, and it stays hidden
  // while that gate is still resolving too: showing it first and withdrawing
  // it a moment later reads as the rail flickering, and failing CLOSED is the
  // right default for an admin entry point either way.
  const isSriLankaEmployee = isSriLankaWorkLocation(userInfo.data?.workLocation);
  const subscriptionCanSee = (id: string): boolean => {
    if (!isSriLankaEmployee) return false;
    return id === "people-subscriptions-manage"
      ? subscriptionGate.isAdmin && !subscriptionGate.isResolving
      : true;
  };

  const resolveVisible = (s: PerspectiveSection): boolean => {
    if (DUE_DILIGENCE_ITEM_IDS.has(s.id)) return dueDiligenceGate.canSee(s.id);
    if (FINANCE_ITEM_IDS.has(s.id)) return financeGate.canSee(s.id);
    if (LEAVE_ITEM_IDS.has(s.id)) return leaveGate.canSee(s.id);
    if (SUBSCRIPTION_ITEM_IDS.has(s.id)) return subscriptionCanSee(s.id);
    if (isMarketingOps) return marketingOpsGate.canSee(s.id);
    return sectionAllowed(s.requires, caps);
  };

  // Memoised because `?? []` would otherwise hand a fresh array to the
  // dependency lists below on every render, defeating both useMemos.
  const sections = useMemo(() => active.sections ?? [], [active.sections]);

  // Manual open/close choices for groups the user has explicitly clicked.
  // These win: navigating into a group opens it, and closing it again is
  // allowed even while you are inside it.
  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map());

  // Whichever group contains the current route opens itself. Otherwise landing
  // on e.g. Reports via a direct link, browser back/forward, or the waffle
  // renders that group collapsed while you're actively on one of its own pages,
  // hiding both where you are and its sibling links.
  //
  // It used to be forced open, with the header made non-interactive so a click
  // that could do nothing did not read as the rail being broken. Opening on its
  // own is the useful half; refusing to close again was not. Collapsing it does
  // hide the row marking where you are — but that is now a state the user chose,
  // which is how every other accordion behaves.
  const activeGroupIds = useMemo(
    () => activeGroupIdsFor(sections, location.pathname),
    [sections, location.pathname],
  );

  // Oxygen wants a Record, not a Set.
  const expandedMenus = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const id of activeGroupIds) map[id] = true;
    for (const [id, isOpen] of overrides) map[id] = isOpen;
    return map;
  }, [activeGroupIds, overrides]);

  const onToggleExpand = (id: string) => {
    setOverrides((prev) => new Map(prev).set(id, !expandedMenus[id]));
  };

  // Which row reads as selected. Resolved from the URL rather than from
  // click state, so a deep link, a browser Back, or the waffle all highlight
  // correctly. Leaves win over the perspective overview, which is why the
  // sections are checked first.
  const activeItem = useMemo(() => {
    // Settings sits outside the registry, so it is matched before the sections.
    if (matchPath(SETTINGS_PATH, location.pathname)) return SETTINGS_ID;
    return activeItemIdFor({
      sections,
      pathname: location.pathname,
      overviewPath: active.path,
      overviewId: OVERVIEW_ID,
    });
  }, [sections, active.path, location.pathname]);

  // Scroll a canvas anchor into view. If we're on a sub-route of the
  // perspective (e.g. a Leave screen) rather than its overview page, jump to
  // the overview first, then scroll once its DOM has mounted.
  const scrollToSection = (id: string) => {
    const tryScroll = () => {
      const el = document.getElementById(id);
      if (!el) return false;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return true;
    };
    // Retry across frames rather than guessing a delay. A fixed timeout has to
    // be long enough for the slowest render, and when it isn't, the scroll
    // silently never happens and the user just lands at the top of the
    // overview. This also stays correct when routes become lazy-loaded, which
    // is exactly when a guessed delay would start being too short. Bounded so
    // an id that never mounts can't spin forever.
    const scrollWhenReady = (attemptsLeft: number) => {
      if (tryScroll() || attemptsLeft === 0) return;
      requestAnimationFrame(() => scrollWhenReady(attemptsLeft - 1));
    };
    if (active.path && location.pathname !== active.path) {
      navigate(active.path);
      scrollWhenReady(30);
    } else {
      tryScroll();
    }
  };

  // Every routable id in the current perspective, so `onSelect` can navigate
  // for rows that aren't wrapped in an anchor (see LeafItem: nested rows can't
  // be, because Oxygen clones them to inject `depth`).
  const pathById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sections) {
      if (s.path) map.set(s.id, s.path);
      for (const c of s.children ?? []) {
        if (c.path) map.set(c.id, c.path);
      }
    }
    return map;
  }, [sections]);

  // Top-level route rows navigate through their own wrapping anchor; nested
  // rows and scroll-anchors arrive here.
  const onSelect = (id: string) => {
    // Not in pathById: Settings belongs to no perspective, so it is routed here
    // rather than through the registry.
    if (id === SETTINGS_ID) {
      // Carry the perspective along. Settings belongs to none of them — it is
      // reached from all of them, and it is where the default perspective is
      // chosen — so the rail has nothing in the URL to keep it where it was.
      // Passing it in the navigation itself is the one place this can live
      // without a ref or an effect, both of which the hooks lint rules refuse.
      navigate(SETTINGS_PATH, { state: { fromPerspective: active.key } });
      return;
    }
    if (id === OVERVIEW_ID) return;
    const path = pathById.get(id);
    if (path) {
      // Carry the perspective along, same as the Settings navigation above.
      // Harmless for a path that lives under this perspective's own prefix
      // (findPerspectiveByPath resolves it directly and never reads this
      // state) — load-bearing for one that doesn't, like Due Diligence's
      // /due-diligence/* routes, which are reachable from both Finance and
      // Legal and can't live under either one's own path prefix. Without
      // this, landing there would fall back to the Me rail instead of
      // keeping whichever of the two the caller actually came from.
      navigate(path, { state: { fromPerspective: active.key } });
      return;
    }
    scrollToSection(id);
  };

  return (
    <Sidebar
      collapsed={collapsed}
      activeItem={activeItem}
      expandedMenus={expandedMenus}
      onSelect={onSelect}
      onToggleExpand={onToggleExpand}
    >
      <Sidebar.Nav>
        <Sidebar.Category>
          <Sidebar.CategoryLabel>{active.label}</Sidebar.CategoryLabel>

          {/* The perspective's own landing page. Previously this was a
              clickable eyebrow label; as a real row it can also be
              highlighted when you're on it. */}
          {active.path && (
            <RouteItem id={OVERVIEW_ID} to={active.path} fromPerspective={active.key}>
              <Sidebar.Item id={OVERVIEW_ID}>
                <Sidebar.ItemIcon>
                  <active.icon />
                </Sidebar.ItemIcon>
                <Sidebar.ItemLabel>Overview</Sidebar.ItemLabel>
              </Sidebar.Item>
            </RouteItem>
          )}

          {isCsmConfigured() && (
            <Link href={csmUrl} target="_blank" rel="noopener noreferrer" color="inherit" underline="none">
              <Sidebar.Item id={CSM_PORTAL_ID}>
                <Sidebar.ItemIcon>
                  <LifeBuoyIcon />
                </Sidebar.ItemIcon>
                <Sidebar.ItemLabel>CSM Portal</Sidebar.ItemLabel>
              </Sidebar.Item>
            </Link>
          )}

          {sections.map((s) => (
            <SectionNode
              key={s.id}
              section={s}
              resolveVisible={resolveVisible}
              containsActiveRoute={activeGroupIds.has(s.id)}
              fromPerspective={active.key}
            />
          ))}

          {sections.length === 0 && !collapsed && (
            <Box sx={{ px: 3, py: 1 }}>
              <Typography variant="body2" color="text.secondary">
                No sub-sections yet. Use the app switcher to change function.
              </Typography>
            </Box>
          )}
        </Sidebar.Category>

      </Sidebar.Nav>

      <Sidebar.Footer showDivider>
        <Sidebar.Item id={SETTINGS_ID}>
          <Sidebar.ItemIcon>
            <SettingsIcon />
          </Sidebar.ItemIcon>
          {/* The tour points here. The marker is on a span of our own because
              Sidebar.Item drops unknown props, so data-* put on it never reaches
              the DOM. */}
          <Sidebar.ItemLabel>
            <span data-tour="settings">Settings</span>
          </Sidebar.ItemLabel>
        </Sidebar.Item>
      </Sidebar.Footer>
    </Sidebar>
  );
}

function sectionAllowed(requires: Capability[] | undefined, caps: Set<Capability>): boolean {
  if (!requires || requires.length === 0) return true;
  return requires.some((r) => caps.has(r));
}

/**
 * Wraps a rail row in a real anchor so middle-click / cmd-click open a new
 * tab. Oxygen's Sidebar already strips link underlines (`& a` in its root
 * styles), so no styling is needed here.
 */
function RouteItem({
  to,
  children,
  fromPerspective,
}: {
  id: string;
  to: string;
  children: ReactNode;
  /**
   * Carried as navigation state, same as SideRail's own Settings navigation.
   * Harmless for a route under this perspective's own path prefix
   * (PerspectiveProvider resolves it directly and never reads this state) —
   * load-bearing for one that isn't, like Due Diligence's routes, which are
   * reachable from both Finance and Legal and can't live under either one's
   * own prefix.
   */
  fromPerspective?: string;
}): JSX.Element {
  return (
    <Link
      component={RouterLink}
      to={to}
      state={fromPerspective ? { fromPerspective } : undefined}
      color="inherit"
      underline="none"
    >
      {children}
    </Link>
  );
}

/**
 * One registry section: a collapsible app group, a single-child group
 * flattened to a leaf, or a plain leaf (route or scroll-anchor).
 *
 * Nesting in Oxygen 0.6.0 is expressed by placing child `Sidebar.Item`s
 * *inside* the parent's children — there is no `hasChildren` / `nested` prop
 * in this version, whatever the bundled docs show.
 */
function SectionNode({
  section,
  resolveVisible,
  containsActiveRoute,
  fromPerspective,
}: {
  section: PerspectiveSection;
  resolveVisible: (section: PerspectiveSection) => boolean;
  /**
   * True while this group holds the current route, which tints its icon so an
   * expanded group signals that you are inside it. Oxygen computes an equivalent
   * internally but only spends it when the rail is collapsed, and the child row
   * carrying the highlight has no icon.
   *
   * It no longer makes the header non-interactive: the group opens itself on
   * navigation, and closing it again is the user's business.
   */
  containsActiveRoute: boolean;
  /** The perspective this section is rendered under — see RouteItem. */
  fromPerspective: string;
}): JSX.Element | null {
  if (section.children && section.children.length > 0) {
    const visible = section.children.filter((c) => resolveVisible(c));
    if (visible.length === 0) return null;

    // Single visible child → collapse the group to a plain leaf pointing
    // straight at it (e.g. Menu → its one Home item).
    //
    // Unless the app opts out. An app that is permanently one screen reads
    // better collapsed; one that is about to gain siblings does not, because the
    // child's name vanishes from the rail until the second one arrives.
    if (visible.length === 1 && !section.alwaysGroup) {
      const only = visible[0];
      return (
        <LeafItem
          id={only.id}
          label={section.label}
          icon={section.icon}
          to={only.path}
          fromPerspective={fromPerspective}
        />
      );
    }


    return (
      <Sidebar.Item id={section.id}>
        <Sidebar.ItemIcon
          sx={containsActiveRoute ? { color: "primary.main" } : undefined}
        >
          {section.icon ? <section.icon /> : null}
        </Sidebar.ItemIcon>
        <Sidebar.ItemLabel sx={ELLIPSIS_SX}>{section.label}</Sidebar.ItemLabel>
        {/* Literal Sidebar.Item elements, NOT a wrapper component. Oxygen
            renders a group's children with
            `cloneElement(child, { depth: depth + 1 })` and separately reads
            `child.props.id` / `extractItemContent(child.props.children)` to
            build the collapsed-rail flyout. Any wrapper — a Link, or one of
            our own components — swallows the injected `depth` and hides the
            label from that flyout. These rows navigate via `onSelect`. */}
        {visible.map((c) => (
          <Sidebar.Item key={c.id} id={c.id} sx={{ pl: NESTED_LABEL_PL }}>
            <Sidebar.ItemLabel sx={ELLIPSIS_SX}>{c.label}</Sidebar.ItemLabel>
          </Sidebar.Item>
        ))}
      </Sidebar.Item>
    );
  }

  if (!resolveVisible(section)) return null;
  return (
    <LeafItem
      id={section.id}
      label={section.label}
      icon={section.icon}
      to={section.path}
      href={section.externalUrl}
      fromPerspective={fromPerspective}
    />
  );
}

/**
 * A single TOP-LEVEL row. `href` → outbound; `to` → a route; otherwise a
 * scroll-anchor.
 *
 * Only safe at the top level: this is a wrapper component, and Oxygen clones a
 * group's children to inject `depth`, which a wrapper would swallow. Nested
 * rows are written as literal `Sidebar.Item` elements at the call site instead.
 */
function LeafItem({
  id,
  label,
  icon: Icon,
  to,
  href,
  fromPerspective,
}: {
  id: string;
  label: string;
  icon?: PerspectiveSection["icon"];
  to?: string;
  // An address outside One WSO2 — a new-tab anchor rather than a route. Never
  // active-highlighted: no route of ours is current once the user is over
  // there, and highlighting it would claim otherwise.
  href?: string;
  /** The perspective this leaf is rendered under — see RouteItem. */
  fromPerspective?: string;
}): JSX.Element {
  const item = (
    <Sidebar.Item id={id}>
      {Icon ? (
        <Sidebar.ItemIcon>
          <Icon />
        </Sidebar.ItemIcon>
      ) : null}
      {/* Plain string: Oxygen derives the collapsed-rail tooltip from
          String(ItemLabel.children). */}
      <Sidebar.ItemLabel sx={ELLIPSIS_SX}>{label}</Sidebar.ItemLabel>
      {/* The one affordance that says this leaves the app. Without it an
          outbound item is indistinguishable from a route until it has already
          opened a tab. */}
      {href ? (
        <Sidebar.ItemBadge color="default">
          <ExternalLinkIcon size={11} />
        </Sidebar.ItemBadge>
      ) : null}
    </Sidebar.Item>
  );
  if (href) {
    return (
      <Link href={href} target="_blank" rel="noopener noreferrer" color="inherit" underline="none">
        {item}
      </Link>
    );
  }
  return to ? (
    <RouteItem id={id} to={to} fromPerspective={fromPerspective}>
      {item}
    </RouteItem>
  ) : (
    item
  );
}
