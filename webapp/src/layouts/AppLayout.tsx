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

import { useEffect, useRef, useState, type JSX } from "react";
import { Outlet, useLocation } from "react-router";
import { Box, useAppShell } from "@wso2/oxygen-ui";
import TopBar from "@components/top-bar/TopBar";
import SideRail from "@components/side-rail/SideRail";
import WaffleOverlay from "@components/waffle/WaffleOverlay";
import AppFooter from "@components/footer/AppFooter";
import TourDriver from "@features/tour/TourDriver";
import TourGuide from "@features/tour/TourGuide";
import TourPrompt from "@features/tour/TourPrompt";
import { TourProvider } from "@features/tour/TourProvider";
import AuthDebugPanel from "@features/debug/AuthDebugPanel";
import AppShellLayout from "@layouts/AppShellLayout";
import IdleTimeoutProvider from "@context/idle-timeout/IdleTimeoutProvider";
import SessionExpiryWatcher from "@components/session-expiry/SessionExpiryWatcher";
import { isFullPageLocation } from "@layouts/fullPageRoutes";

const SIDEBAR_COLLAPSED_KEY = "one-wso2.sidebar.collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    /* ignore — a blocked localStorage just means the choice isn't remembered */
  }
}

// The persistent shell — top bar and rail stay put; the canvas swaps with the
// active perspective (Outlet). Waffle and Ask Novera are overlays.
//
// NOTE: the content scroller deliberately sets no background. It used to paint
// `background.default`, which covered the <body> entirely and made any
// canvas-level treatment (Oxygen's radial wash, or ours) invisible in the
// content area. Layout boxes have to stay transparent for the wash to reach
// the content at all.
export default function AppLayout(): JSX.Element {
  // The launcher's anchor doubles as its open state — it hangs off the button
  // rather than covering the page, so there is no "open with no anchor".
  const [waffleAnchor, setWaffleAnchor] = useState<HTMLElement | null>(null);
  // The tour renders its card outside the launcher's popper, so clicking Next
  // reads as a click away and would close a panel the next step points into.
  // TourDriver raises this while a step needs the launcher open.
  const tourHoldsLauncher = useRef(false);
  const location = useLocation();
  const mainRef = useRef<HTMLDivElement>(null);

  const { state: shellState, actions: shellActions } = useAppShell({
    initialCollapsed: readCollapsed(),
  });

  useEffect(() => {
    writeCollapsed(shellState.sidebarCollapsed);
  }, [shellState.sidebarCollapsed]);

  // A new page should start at the top rather than inheriting the previous
  // page's scroll offset — the shell scrolls, not the window.
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [location.pathname]);

  // A page that brings its own frame (see fullPageRoutes) gets none of the
  // shell below, but keeps the idle timeout and the session-expired prompt.
  if (isFullPageLocation(location)) {
    return (
      <IdleTimeoutProvider>
        <SessionExpiryWatcher />
        <Outlet />
      </IdleTimeoutProvider>
    );
  }

  return (
    // Owns the idle deadline and the "still there?" prompt (ONEWSO2-R1).
    // Wraps the shell rather than sitting inside it so the dialog is a sibling
    // of the layout, not a child of the scrolling content area.
    <TourProvider>
    <IdleTimeoutProvider>
      {/* Raises the sign-in prompt when @api/authBridge gives up renewing the
          session. Inside AuthGuard on purpose: a signed-out user is already
          being redirected, so there is nothing here to ask them. */}
      <SessionExpiryWatcher />
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          height: "100dvh",
          overflow: "hidden",
        }}
      >
        <AppShellLayout
          header={
            <TopBar
              collapsed={shellState.sidebarCollapsed}
              onToggleSidebar={shellActions.toggleSidebar}
              onToggleWaffle={(el) => setWaffleAnchor((prev) => (prev ? null : el))}
              waffleOpen={waffleAnchor !== null}
            />
          }
          sidebar={<SideRail collapsed={shellState.sidebarCollapsed} />}
        >
          {/* The footer sits OUTSIDE the scroller, pinned to the bottom of the
              content column, which is where it was before this shell rewrite.
              Moving it inside would make it scroll away with the page. */}
          <Box
            ref={mainRef}
            // The id is for the lifted GRC screens under /security, which scroll
            // their own step wizard back to the top by looking this element up
            // by name (their shell names it the same). Ours is the scrolling
            // element too, so naming it here makes their assumption true rather
            // than editing ~16,000 lines of copied source to use a ref they
            // cannot reach. Without it the lookup silently finds nothing and the
            // Add Risk wizard stops scrolling between steps.
            id="main-scroll-container"
            sx={{
              flex: 1,
              minHeight: 0,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              overflow: "auto",
              p: 3,
            }}
          >
            <Outlet />
          </Box>
          <AppFooter />
        </AppShellLayout>

        {waffleAnchor && (
          <WaffleOverlay
            anchorEl={waffleAnchor}
            onClose={() => {
              if (tourHoldsLauncher.current) return;
              setWaffleAnchor(null);
            }}
          />
        )}
        {/* The introductory tour. TourDriver applies what a step needs from the
            shell; the other two are the offer and the running tour itself. */}
        <TourDriver
          sidebarCollapsed={shellState.sidebarCollapsed}
          toggleSidebar={shellActions.toggleSidebar}
          setWaffleAnchor={setWaffleAnchor}
          holdLauncher={tourHoldsLauncher}
        />
        <TourPrompt />
        <TourGuide />
        <AuthDebugPanel />
      </Box>
    </IdleTimeoutProvider>
    </TourProvider>
  );
}
