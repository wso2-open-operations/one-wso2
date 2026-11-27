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

import type { JSX, ReactNode } from "react";
import { Box, Button, Card, CircularProgress, Stack, Typography } from "@wso2/oxygen-ui";
import { ArrowLeftIcon, ExternalLinkIcon } from "@wso2/oxygen-ui-icons-react";
import { useQueryClient } from "@tanstack/react-query";
import type { PerspectiveSection } from "@constants/perspectives";
import { Link as RouterLink, Navigate } from "react-router";
import { useActivePerspective } from "@context/perspective/PerspectiveContext";
import { usePerspectiveVisibility } from "@components/side-rail/usePerspectiveVisibility";
import ErrorNotice from "@components/error-notice/ErrorNotice";

/**
 * The landing route for a perspective that has no overview of its own.
 *
 * Finance, Legal, People Ops and Security each used to open on a page of tiles
 * — one per rail item, built by hand, sitting two feet to the right of the rail
 * that already listed them. Reaching a screen took two clicks instead of one,
 * and every item added to a registry had to be remembered in a second place or
 * the tile page quietly fell behind. So these perspectives now open on the first
 * screen you can actually use, and the Overview row leaves their rail with it
 * (`forwardsToFirstItem` in @constants/perspectives).
 *
 * The route itself stays, because it is still reached — switching perspective
 * navigates to its `path` — and because someone who can see nothing here has to
 * be told that somewhere.
 *
 * States, and the order is the point:
 *
 *   have one  → go to it NOW, even if another gate this perspective also
 *               depends on is still resolving. `firstVisibleLeaf` is already
 *               the RAIL-ORDER-correct answer — it does not report a leaf
 *               until every section ranked above it has answered too, so
 *               there is no lower-ranked leaf here to later get bumped by a
 *               higher-ranked one landing late (see `firstVisibleLeaf` in
 *               railActive.ts). Waiting past this point would only hold
 *               someone on a backend that has nothing to do with the item
 *               they are about to open.
 *   resolving → hold. Nothing decidable YET could still resolve to a leaf once
 *               every gate above it settles, and reporting "nothing here" on
 *               an incomplete answer would send people chasing access they
 *               already hold.
 *   failed    → say so, with a Retry. Checked BEFORE the empty state for the
 *               same reason MarketingOpsShell checks it there: a failed request
 *               also leaves us with nothing to show, and reporting that as "you
 *               have no access" sends people chasing a permission they hold.
 *   have none → one sentence saying so, and where access comes from.
 *
 * Everything here reads from usePerspectiveVisibility, which is the rail's own
 * gate wiring — so this cannot send you somewhere the rail is hiding, or refuse
 * you a perspective whose rail has rows in it.
 */
export default function PerspectiveLanding(): JSX.Element {
  const active = useActivePerspective();
  const { firstVisibleLeaf, visibleOutbound, isResolving, isError, error, retry } = usePerspectiveVisibility();
  const first = firstVisibleLeaf?.path;

  // `replace`, so Back leaves the perspective rather than bouncing off this
  // route and forwarding again.
  //
  // `state` for the same reason SideRail's RouteItem passes it: some
  // destinations sit outside their perspective's path prefix (Finance and People
  // Ops both reach the shared /banking/admin), and the rail asks the
  // URL first. Without this it falls through to the sessionStorage memory of the
  // last non-Me perspective, which happens to hold the right answer here — but
  // only because an effect ran before we left, which is not a thing to depend on.
  if (first) return <Navigate to={first} replace state={{ fromPerspective: active.key }} />;

  if (isResolving) {
    return (
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", mt: 2 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">
          Opening {active.label}…
        </Typography>
      </Stack>
    );
  }

  if (isError) {
    return (
      <Box>
        <PageTitle label={active.label} />
        <ErrorNotice onRetry={retry} error={error} sx={{ mt: 1.5 }}>
          Couldn&apos;t work out what you can open in {active.label}.
        </ErrorNotice>
        {/* A failed check is about this app's own screens; the rail's links to
            other apps do not depend on it and stay shown there, so they stay
            reachable here too. */}
        {visibleOutbound?.length ? (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              These open other WSO2 apps in a new tab.
            </Typography>
            <OutboundLinks links={visibleOutbound} />
          </Box>
        ) : null}
      </Box>
    );
  }

  return (
    <Box>
      <PageTitle label={active.label} />
      {/* The rail may still show links to other apps here, which this page is
          never forwarded to (they open another site). Offer them, so the card
          does not say there is nothing while the rail shows something. */}
      <NothingHere label={active.label} icon={active.icon} links={visibleOutbound ?? []} />
    </Box>
  );
}

// An h1, not a styled div — a screen-reader user navigating by headings needs
// something to land on, and the card's heading below is an h2 under it.
//
// Exported with NothingHere so SalesShell's no-access screen is this exact screen.
export function PageTitle({ label }: { label: string }): JSX.Element {
  return (
    <Typography component="h1" variant="h5" sx={{ mb: 0.5, mt: 0 }}>
      {label}
    </Typography>
  );
}

// Not a padlock, and not a warning. Nothing has failed and nobody has been
// refused — there is simply nothing in here for this person yet. The
// perspective's own icon says which empty room you're standing in, which a
// generic glyph wouldn't.
//
// Exported so a perspective that learns "nothing for you" from its backend rather than from
// the rail (Sales: meet-app answers 403) shows the same card, not its own variant of it.
export function NothingHere({
  label,
  icon: Icon,
  links = [],
  heading,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  /** Visible rail rows that open other apps; listed, and the copy says only those are open. */
  links?: readonly PerspectiveSection[];
  /** Replaces the card's heading. */
  heading?: string;
  /** Replaces the card's one-sentence body. */
  children?: ReactNode;
}): JSX.Element {
  return (
    <Card variant="outlined" sx={{ mt: 1.5, p: 3, maxWidth: 620 }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.75 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            flexShrink: 0,
            borderRadius: 1.5,
            display: "grid",
            placeItems: "center",
            bgcolor: "background.default",
            border: 1,
            borderColor: "divider",
            color: "text.secondary",
          }}
          aria-hidden="true"
        >
          <Icon size={19} />
        </Box>
        <Box>
          <Typography
            component="h2"
            sx={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em", mb: 0.6 }}
          >
            {heading ?? (links.length ? "Only links to other apps here for you" : "Nothing here for you yet")}
          </Typography>
          {children ? (
            <Box sx={{ maxWidth: "52ch" }}>{children}</Box>
          ) : (
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: "52ch" }}>
            {/* One sentence, the same one everywhere. Each perspective used to
                add a line naming the system its access came from, and reading
                the five together was what killed them: only one was actually
                actionable, and the rest were "ask whoever runs that" with a
                different noun in it — the shape of help without the substance.
                Someone who needs access asks the person who sent them here. */}
            {links.length ? (
              <>
                Nothing in {label} inside One WSO2 is open to you at the moment. These open
                other WSO2 apps in a new tab.
              </>
            ) : (
              <>
                {label} is here, but none of it is open to you at the moment. When that
                changes, it&apos;ll appear in the menu on the left.
              </>
            )}
          </Typography>
          )}
          {links.length ? <OutboundLinks links={links} /> : null}
        </Box>
      </Box>

      <Box sx={{ height: "1px", bgcolor: "divider", my: 2.25 }} />

      {/* Outlined rather than contained: a11yThemeOverrides shifts outlined
          primary to primary.dark (5.77:1), while contained primary stays
          white-on-orange, which fails AA in both schemes — see the note there. */}
      <Button
        component={RouterLink}
        to="/me"
        variant="outlined"
        startIcon={<ArrowLeftIcon size={15} />}
        sx={{ textTransform: "none", fontSize: 13, fontWeight: 600 }}
      >
        Back to Home
      </Button>
    </Card>
  );
}

/**
 * The links of NothingHere, a button each opening its app in a new tab. Its own
 * component so the query client (a row's `onSelect` is handed it) is only
 * needed where there are links to open.
 */
function OutboundLinks({ links }: { links: readonly PerspectiveSection[] }): JSX.Element {
  const queryClient = useQueryClient();
  return (
    <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, mt: 1.5, display: "flex", flexWrap: "wrap", gap: 1 }}>
      {links.map((row) => {
        // A known address is a real link (copy, middle-click, context menu);
        // only a destination resolved at runtime is a button running the action.
        const href = row.externalUrl ?? row.outboundUrl;
        return (
          <Box component="li" key={row.id}>
            {href ? (
              <Button
                component="a"
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                variant="outlined"
                size="small"
                endIcon={<ExternalLinkIcon size={13} aria-hidden />}
                sx={{ textTransform: "none" }}
              >
                {row.label}
                <Box component="span" sx={VISUALLY_HIDDEN_SX}>
                  (opens in a new tab)
                </Box>
              </Button>
            ) : (
              <Button
                variant="outlined"
                size="small"
                onClick={() => row.onSelect?.({ queryClient })}
                endIcon={<ExternalLinkIcon size={13} aria-hidden />}
                sx={{ textTransform: "none" }}
              >
                {row.label}
                <Box component="span" sx={VISUALLY_HIDDEN_SX}>
                  (opens in a new tab)
                </Box>
              </Button>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

/** Read by a screen reader, not shown. */
const VISUALLY_HIDDEN_SX = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
} as const;
