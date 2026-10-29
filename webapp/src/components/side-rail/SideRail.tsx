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
import { useQueryClient } from "@tanstack/react-query";
import { alpha, Badge, Box, Link, List, Sidebar, Typography, useSidebar } from "@wso2/oxygen-ui";
import { ArrowUpRightIcon, BookOpenIcon, ExternalLinkIcon, SettingsIcon } from "@wso2/oxygen-ui-icons-react";
import { Link as RouterLink, matchPath, useLocation, useNavigate } from "react-router";
import ScreenBadgeLabel from "@components/screen-badge/ScreenBadgeLabel";
import { screenBadgePillSx, VISUALLY_HIDDEN_SX } from "@components/screen-badge/screenBadgeSx";
import { useActivePerspective } from "@context/perspective/PerspectiveContext";
import type { PerspectiveSection } from "@constants/perspectives";
import { useUserGuideUrl } from "@features/security/api/useUserGuideUrl";
import {
  activeGroupIds as activeGroupIdsFor,
  activeItemId as activeItemIdFor,
} from "./railActive";
import {
  groupNeedsAttention,
  labelWithReason,
  type RailBadge,
  type ResolveBadge,
} from "./railBadge";
import { usePerspectiveVisibility } from "./usePerspectiveVisibility";
import { useRailBadges } from "./useRailBadges";

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

/** Size, in px, Oxygen's Sidebar.ItemIcon gives a row icon. */
const RAIL_ICON_SIZE = 20;

/** Diameter, in px, of the dot on a group's header. */
const GROUP_DOT_SIZE = 8;

/** What a screen reader hears for the dot on a group's header. */
const GROUP_ATTENTION_TEXT = "Needs attention.";

/** A row label with a badge after it, kept clear of the badge when it truncates. */
const BADGED_LABEL_SX = { ...ELLIPSIS_SX, mr: 1 } as const;

/** The left rail of the active perspective: its overview, its sections with their badges, and Settings. */
export default function SideRail({ collapsed }: SideRailProps): JSX.Element {
  const active = useActivePerspective();
  const navigate = useNavigate();
  const location = useLocation();
  // Handed to a row's `onSelect` action — see PerspectiveSection.onSelect.
  const queryClient = useQueryClient();

  // Who can see what. This used to be ~100 lines of gate wiring right here,
  // which made the rail the only thing in the app that knew — see
  // usePerspectiveVisibility for why the perspective landing routes need the
  // same answer and why a second copy of it would drift.
  const { resolveVisible } = usePerspectiveVisibility();
  const { resolveBadge } = useRailBadges();

  // Memoised because `?? []` would otherwise hand a fresh array to the
  // dependency lists below on every render, defeating both useMemos.
  const sections = useMemo(() => active.sections ?? [], [active.sections]);

  // The GRC user guide link, served by the GRC backend rather than carried in
  // this perspective's own registry data — see useUserGuideUrl. Fetched only
  // while Security and Compliance is active, same as every other
  // perspective-scoped gate in usePerspectiveVisibility.
  const userGuide = useUserGuideUrl(active.key === "security");

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

  // Every row that runs an action instead of navigating — see
  // PerspectiveSection.onSelect.
  const actionById = useMemo(() => {
    const map = new Map<string, NonNullable<PerspectiveSection["onSelect"]>>();
    for (const s of sections) {
      if (s.onSelect) map.set(s.id, s.onSelect);
      for (const c of s.children ?? []) {
        if (c.onSelect) map.set(c.id, c.onSelect);
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
    const action = actionById.get(id);
    if (action) {
      action({ queryClient });
      return;
    }
    const path = pathById.get(id);
    if (path) {
      // Carry the perspective along, same as the Settings navigation above.
      // Harmless for a path that lives under this perspective's own prefix
      // (findPerspectiveByPath resolves it directly and never reads this
      // state) — load-bearing for one that doesn't, like Banking admin's
      // /banking/admin, which is reachable from both Finance and People Ops
      // and can't live under either one's own path prefix. Without this,
      // landing there would fall back to the Me rail instead of keeping
      // whichever of the two the caller actually came from.
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
      {/* flex column: lets the pinned-to-bottom category below push itself to
          the foot of this scroll area with `mt: auto`, rather than flowing
          directly under the main one. showDividers off: Nav would otherwise
          draw its own rule between the two categories, on top of the gap
          `mt: auto` already opens up. */}
      <Sidebar.Nav showDividers={false} sx={{ display: "flex", flexDirection: "column" }}>
        <Sidebar.Category>
          <Sidebar.CategoryLabel>{active.label}</Sidebar.CategoryLabel>

          {/* The perspective's own landing page. Previously this was a
              clickable eyebrow label; as a real row it can also be
              highlighted when you're on it.

              Dropped for the perspectives whose landing only forwards you to
              the first row below it — see `forwardsToFirstItem`. The route is
              still there and still reached (switching perspective goes to it),
              but as a rail row it would be a destination that bounces, and one
              that renders as selected for a split second on a screen you are
              about to leave. */}
          {active.path && !active.forwardsToFirstItem && (
            <Sidebar.Item id={OVERVIEW_ID} link={routeLink(active.path, active.key)}>
              <Sidebar.ItemIcon>
                <active.icon />
              </Sidebar.ItemIcon>
              <Sidebar.ItemLabel>Overview</Sidebar.ItemLabel>
            </Sidebar.Item>
          )}

          {sections.map((s) => (
            <SectionNode
              key={s.id}
              section={s}
              resolveVisible={resolveVisible}
              resolveBadge={resolveBadge}
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

        {/* A second top-level child of Sidebar.Nav, not a row joining the
            list inside the first Category — that's what lets `mt: "auto"`
            push it down the flex column to the foot of the scroll area,
            opening a gap from the groups above. showDividers is off, so no
            rule is drawn between the two; the gap alone is the separation.
            Only Security and Compliance has anything to put here today. */}
        {active.key === "security" && userGuide.data?.url && (
          <Sidebar.Category sx={{ mt: "auto" }}>
            <LeafItem id="security-user-guide" label="User Guide" icon={BookOpenIcon} href={userGuide.data.url} />
          </Sidebar.Category>
        )}
      </Sidebar.Nav>

      <Sidebar.Footer showDivider>
        {/* The footer is not a list, and Sidebar.Item is an li, so it needs one. */}
        {/* The tour marker sits on the list, not inside the label. Oxygen
            names a collapsed row with String(label children), and a span
            there becomes the accessible name "[object Object]". */}
        <Box component="ul" data-tour="settings" sx={{ m: 0, p: 0, listStyle: "none" }}>
        <Sidebar.Item id={SETTINGS_ID}>
          <Sidebar.ItemIcon>
            <SettingsIcon />
          </Sidebar.ItemIcon>
          <Sidebar.ItemLabel>Settings</Sidebar.ItemLabel>
        </Sidebar.Item>
        </Box>
      </Sidebar.Footer>
    </Sidebar>
  );
}

/**
 * The anchor for a rail row, passed as `Sidebar.Item`'s `link` so the row stays
 * `li > a` and middle-click still opens a new tab. Wrapping the item in the
 * anchor instead makes the list `ul > a > li`, which a screen reader does not
 * treat as a list.
 *
 * `fromPerspective` is navigation state, same as SideRail's own Settings
 * navigation. Harmless for a route under this perspective's own path prefix
 * (PerspectiveProvider resolves it directly and never reads this state) —
 * load-bearing for one that isn't, like Due Diligence's routes, which are
 * reachable from both Finance and Legal and can't live under either one's
 * own prefix.
 */
function routeLink(to: string, fromPerspective?: string) {
  return (
    <Link
      component={RouterLink}
      to={to}
      state={fromPerspective ? { fromPerspective } : undefined}
      color="inherit"
      underline="none"
    />
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
  resolveBadge,
  containsActiveRoute,
  fromPerspective,
}: {
  section: PerspectiveSection;
  resolveVisible: (section: PerspectiveSection) => boolean;
  resolveBadge: ResolveBadge;
  /**
   * True while this group holds the current route, which tints its icon so an
   * expanded group signals that you are inside it, and outlines it while open
   * (see GroupFrame). Oxygen computes an equivalent internally but only spends
   * it when the rail is collapsed, and the child row carrying the highlight has
   * no icon.
   *
   * It no longer makes the header non-interactive: the group opens itself on
   * navigation, and closing it again is the user's business.
   */
  containsActiveRoute: boolean;
  /** The perspective this section is rendered under — see routeLink. */
  fromPerspective: string;
}): JSX.Element | null {
  const { collapsed, expandedMenus } = useSidebar();

  // Screens offered as tabs stay children of the section (pins name them from
  // there) and are not rows. The row is the app, and it opens its first screen.
  if (section.inTabs) {
    if (!resolveVisible(section)) return null;
    return (
      <LeafItem
        id={section.id}
        label={section.label}
        icon={section.icon}
        to={section.path}
        fromPerspective={fromPerspective}
        // The row's own badge only, not its tabs'.
        badge={resolveBadge(section.id)}
      />
    );
  }

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
          // The row stands for the child, so the child's badge comes before the group's own.
          badge={resolveBadge(only.id) ?? resolveBadge(section.id)}
        />
      );
    }

    // An open group shows each child's badge on the child's own row instead.
    const showsChildBadges = !collapsed && Boolean(expandedMenus?.[section.id]);
    const needsAttention = showsChildBadges
      ? Boolean(resolveBadge(section.id))
      : groupNeedsAttention(section, resolveBadge, resolveVisible);

    return (
      <GroupFrame id={section.id} current={containsActiveRoute}>
        <Sidebar.Item id={section.id}>
          <Sidebar.ItemIcon
            sx={containsActiveRoute ? { color: "primary.main" } : undefined}
          >
            {railIcon(section.icon, collapsed && needsAttention)}
          </Sidebar.ItemIcon>
          <Sidebar.ItemLabel sx={needsAttention ? BADGED_LABEL_SX : ELLIPSIS_SX}>
            {collapsed && needsAttention ? labelWithReason(section.label, GROUP_ATTENTION_TEXT) : section.label}
          </Sidebar.ItemLabel>
          {needsAttention ? railGroupDot() : null}
          {/* Literal Sidebar.Item elements, NOT a wrapper component. Oxygen
              renders a group's children with
              `cloneElement(child, { depth: depth + 1 })` and separately reads
              `child.props.id` / `extractItemContent(child.props.children)` to
              build the collapsed-rail flyout. Any wrapper — a Link, or one of
              our own components — swallows the injected `depth` and hides the
              label from that flyout. These rows navigate via `onSelect`. */}
          {visible.map((c) => {
            // A row that names an icon wears it, starting where the parent label
            // starts. A row that doesn't stays a plain label lined up with that
            // word. The label itself stays a string: the collapsed flyout reads
            // it with String(children), and an element there becomes
            // "[object Object]".
            const Icon = c.icon;
            const badge = resolveBadge(c.id);
            // On a collapsed rail, the popup shows only the child's icon and label, so the dot marks the icon.
            const dot = collapsed ? badge : undefined;
            return (
              <Sidebar.Item key={c.id} id={c.id} sx={{ pl: NESTED_LABEL_PL }}>
                {Icon || dot ? (
                  <Sidebar.ItemIcon>{railIcon(Icon, Boolean(dot), dot && (dot.reason ?? dot.label))}</Sidebar.ItemIcon>
                ) : null}
                <Sidebar.ItemLabel sx={badge ? BADGED_LABEL_SX : ELLIPSIS_SX}>{c.label}</Sidebar.ItemLabel>
                {badge ? railBadgePill(badge, !c.opensInNewTab) : null}
                {/* The launcher's mark for a tile that leaves One WSO2 (see
                    WaffleOverlay). Inside a badge only because Oxygen takes any
                    other child of a row for a nested item; the badge is drawn
                    without its pill. */}
                {c.opensInNewTab ? (
                  <Sidebar.ItemBadge
                    color="default"
                    // The row button keeps spacing(2) clear on its right; the
                    // arrow sits in that gutter instead of taking label room.
                    sx={{ bgcolor: "transparent", mr: -1.5 }}
                  >
                    {/* Centres the arrow, and takes back the chip label's 8px
                        sides: 4px on the left, none on the right. */}
                    <Box sx={{ display: "flex", ml: -0.5, mr: -1 }}>
                      <ArrowUpRightIcon size={11} />
                      {/* The arrow is hidden from screen readers, and the row
                          is a button, not a link, so this says it instead. */}
                      <Box component="span" sx={VISUALLY_HIDDEN_SX}>
                        (opens in a new tab)
                      </Box>
                    </Box>
                  </Sidebar.ItemBadge>
                ) : null}
              </Sidebar.Item>
            );
          })}
        </Sidebar.Item>
      </GroupFrame>
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
      badge={resolveBadge(section.id)}
    />
  );
}

/**
 * A row's badge as a pill at the end of the row. Returns a literal `Sidebar.ItemBadge`, not a
 * component: Oxygen treats any other child of a row as a nested row.
 *
 * @param atRowEnd - whether nothing follows the pill, so it takes the empty chevron slot and lines
 *   up with the chevrons.
 */
function railBadgePill(badge: RailBadge, atRowEnd: boolean): JSX.Element {
  return (
    <Sidebar.ItemBadge color="primary" sx={{ ...screenBadgePillSx(badge), ml: "auto", mr: atRowEnd ? -2 : 0.5 }}>
      <ScreenBadgeLabel badge={badge} />
    </Sidebar.ItemBadge>
  );
}

/**
 * The dot on a group's header, read as "Needs attention." by screen readers, with no hover text.
 * Returns a literal `Sidebar.ItemBadge`; see {@link railBadgePill}.
 */
function railGroupDot(): JSX.Element {
  return (
    <Sidebar.ItemBadge
      color="primary"
      sx={{
        ml: "auto",
        mr: 0.5,
        flexShrink: 0,
        width: GROUP_DOT_SIZE,
        height: GROUP_DOT_SIZE,
        "& .MuiChip-label": { px: 0 },
      }}
    >
      <Box component="span" sx={VISUALLY_HIDDEN_SX}>
        {GROUP_ATTENTION_TEXT}
      </Box>
    </Sidebar.ItemBadge>
  );
}

/**
 * A row's icon, marked with a dot when the row has a badge to show on a collapsed rail. A row with
 * no icon gets the dot alone, so a group's collapsed-rail popup still marks it.
 *
 * The icon is sized here: Sidebar.ItemIcon sizes only its direct child, which would be the Badge.
 *
 * @param spoken - what a screen reader hears for the dot, for a row in a group's collapsed-rail
 *   popup. Oxygen names a popup entry by its icon and label alone, so this travels with the icon.
 */
function railIcon(Icon: PerspectiveSection["icon"], marked: boolean, spoken?: string): JSX.Element | null {
  const icon = Icon ? <Icon size={RAIL_ICON_SIZE} /> : null;
  if (!marked) return icon;
  return (
    <Badge
      variant="dot"
      color="primary"
      overlap="circular"
      // With no icon to sit on, the dot takes the icon's place instead of its corner.
      sx={icon ? undefined : { "& .MuiBadge-badge": { position: "static", transform: "none" } }}
    >
      {icon}
      {spoken ? (
        <Box component="span" sx={VISUALLY_HIDDEN_SX}>
          {spoken}
        </Box>
      ) : null}
    </Badge>
  );
}

/**
 * A faint outline and tint around the open group you are in, so its header and its screens read
 * as one unit. Nothing while the group is closed or the rail is collapsed.
 *
 * Only that one group, not every open one: a group stays open once clicked, so outlining each
 * open group soon outlines all of them, and the outline stops saying where you are.
 *
 * The frame is always rendered and only its look changes: dropping it on close would give the
 * group a different parent, remount it, and cut Collapse's closing animation short. It is an
 * <li> holding its own <ul>, because Sidebar.Category lays its rows out in a list.
 *
 * The outline is drawn by a pseudo-element, never by a margin or border on the <li>: those take
 * room even while transparent, and pushed every row in the group 9px right of the icon and label
 * columns the rest of the rail uses — open, closed and collapsed. Oxygen insets each row by
 * spacing(1), so an outline at spacing(0.5) sits in that gutter, clear of a row's hover and
 * selected fill, without moving the row.
 */
function GroupFrame({
  id,
  current,
  children,
}: {
  id: string;
  /** True while this group holds the current route. */
  current: boolean;
  children: ReactNode;
}): JSX.Element {
  const { collapsed, expandedMenus } = useSidebar();
  const framed = current && !collapsed && Boolean(expandedMenus?.[id]);
  return (
    <Box
      component="li"
      sx={(theme) => ({
        listStyle: "none",
        position: "relative",
        // Its own stacking context, so the outline can sit behind the rows without also sinking
        // behind the rail's background.
        isolation: "isolate",
        py: framed ? 0.5 : 0,
        my: framed ? 0.5 : 0,
        "&::before": {
          content: '""',
          position: "absolute",
          inset: theme.spacing(0, 0.5),
          zIndex: -1,
          pointerEvents: "none",
          border: "1px solid",
          borderRadius: 1.5,
          borderColor: framed ? alpha(theme.palette.primary.main, 0.24) : "transparent",
          bgcolor: framed ? alpha(theme.palette.primary.main, 0.04) : "transparent",
        },
      })}
    >
      <List disablePadding>{children}</List>
    </Box>
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
  badge,
}: {
  id: string;
  label: string;
  icon?: PerspectiveSection["icon"];
  to?: string;
  // An address outside One WSO2 — a new-tab anchor rather than a route. Never
  // active-highlighted: no route of ours is current once the user is over
  // there, and highlighting it would claim otherwise.
  href?: string;
  /** The perspective this leaf is rendered under — see routeLink. */
  fromPerspective?: string;
  /** The pill saying this row's screen has something for the person. */
  badge?: RailBadge;
}): JSX.Element {
  const { collapsed } = useSidebar();
  const dot = collapsed ? badge : undefined;
  const link = href ? (
    <Link href={href} target="_blank" rel="noopener noreferrer" color="inherit" underline="none" />
  ) : to ? (
    routeLink(to, fromPerspective)
  ) : undefined;
  return (
    <Sidebar.Item id={id} link={link}>
      {Icon || dot ? <Sidebar.ItemIcon>{railIcon(Icon, Boolean(dot))}</Sidebar.ItemIcon> : null}
      {/* Plain string: Oxygen derives the collapsed-rail tooltip from
          String(ItemLabel.children). */}
      <Sidebar.ItemLabel sx={badge ? BADGED_LABEL_SX : ELLIPSIS_SX}>
        {dot ? labelWithReason(label, dot.reason ?? dot.label) : label}
      </Sidebar.ItemLabel>
      {badge ? railBadgePill(badge, !href) : null}
      {/* The one affordance that says this leaves the app. Without it an
          outbound item is indistinguishable from a route until it has already
          opened a tab. */}
      {href ? (
        <Sidebar.ItemBadge
          color="default"
          sx={{
            mr: -0.75,
            // The chip's default label padding is sized for text; an
            // icon-only badge this small just wants to fill the pill.
            "& .MuiChip-label": { display: "flex", px: "4px" },
          }}
        >
          <ExternalLinkIcon size={11} />
        </Sidebar.ItemBadge>
      ) : null}
    </Sidebar.Item>
  );
}
