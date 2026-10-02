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

import { useAsgardeo } from "@asgardeo/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { Box, Button, CircularProgress, Typography } from "@wso2/oxygen-ui";
import {
  getRenewalInFlightSnapshot,
  SDK_SESSION_PICKUP_MS,
  sdkHasSession,
  subscribeRenewal,
} from "@api/authBridge";
import {
  forgetSignInRedirect,
  rememberSignInRedirect,
  signInRedirectIsRecent,
} from "@layouts/signInLoopGuard";

import {
  forgetPostLoginTarget,
  isRestorableTarget,
  isSignOutLanding,
  readPostLoginTarget,
  rememberPostLoginTarget,
} from "@layouts/postLoginRedirect";

// Wrap every authenticated route. If the user isn't signed in, stash the
// intended path so we can restore it after the Asgardeo redirect completes,
// then call signIn().
export default function AuthGuard() {
  const { isSignedIn, isLoading, signIn } = useAsgardeo();
  const location = useLocation();
  const navigate = useNavigate();
  // Prevents a second signIn() from firing under StrictMode's double-render
  // or on any incidental re-run of this effect before the browser has left
  // the page. Reset when the SDK reports the user as signed in, or when a
  // pre-redirect check ends without redirecting.
  const startedSignInRef = useRef(false);
  const renewing = useSyncExternalStore(subscribeRenewal, getRenewalInFlightSnapshot);
  // Whether this page load is the return from a sign-in this tab started moments
  // ago. Read once, before this page can record a redirect of its own.
  const [returnedFromRecentSignIn, setReturnedFromRecentSignIn] = useState(signInRedirectIsRecent);
  // That sign-in worked, so losing the session later on this page load (a
  // refresh token revoked hours on, say) is not a loop and gets its redirect.
  if (returnedFromRecentSignIn && isSignedIn) setReturnedFromRecentSignIn(false);
  const reportedLoopRef = useRef(false);
  const signInLooped = returnedFromRecentSignIn && !isLoading && !isSignedIn;

  const currentHref = location.pathname + location.search + location.hash;

  // Read (don't consume) any stashed redirect so render can gate on it below.
  const pendingRedirect =
    isSignedIn && !isLoading ? readPostLoginTarget() : null;
  const hasPendingRedirect = pendingRedirect !== null && pendingRedirect !== currentHref;

  useEffect(() => {
    // Scrub Asgardeo's post-logout marker before anything else reasons about
    // the URL. Routed rather than `history.replaceState` so React Router's own
    // location stays in sync. Only ever matches the sign-OUT landing, so it
    // can't interfere with the sign-in callback the SDK still needs to read.
    if (isSignOutLanding(location.search)) {
      navigate(location.pathname, { replace: true });
      return;
    }

    if (isLoading) return;

    if (!isSignedIn) {
      if (startedSignInRef.current) return;
      // Back from a sign-in and still signed out: redirecting again would only
      // loop. The render below offers a retry instead — see signInLoopGuard.
      if (signInLooped) {
        if (!reportedLoopRef.current) {
          reportedLoopRef.current = true;
          console.warn("[auth] Returned from sign-in still signed out, so not redirecting again.");
        }
        return;
      }
      startedSignInRef.current = true;
      // The context says signed out, but the SDK may be exchanging a refresh
      // token for an expired session right now. Redirecting before that settles
      // is a needless round trip to the IdP — one that lands on its login page if
      // the IdP session has ended while the refresh token has not.
      let cancelled = false;
      let redirected = false;
      let pickupTimer: ReturnType<typeof setTimeout> | undefined;
      const redirect = () => {
        redirected = true;
        if (isRestorableTarget(location.pathname, location.search)) {
          rememberPostLoginTarget(currentHref);
        }
        rememberSignInRedirect();
        signIn();
      };
      void sdkHasSession().then((held) => {
        if (cancelled) return;
        if (!held) {
          redirect();
          return;
        }
        // The provider sees it on its next check, and this effect runs again
        // signed in, cancelling the timer. Should it never catch up, redirect
        // after a bounded wait rather than leave the spinner up for good.
        pickupTimer = setTimeout(() => {
          console.warn("[auth] The SDK reported a session the provider never picked up, so signing in again.");
          redirect();
        }, SDK_SESSION_PICKUP_MS);
      });
      return () => {
        cancelled = true;
        clearTimeout(pickupTimer);
        if (!redirected) startedSignInRef.current = false;
      };
    }

    // Signed in: consume any stashed redirect and let React Router own the
    // history stack so useNavigate()/Back behave predictably.
    startedSignInRef.current = false;
    forgetSignInRedirect();
    const restored = readPostLoginTarget();
    if (!restored) return;
    forgetPostLoginTarget();
    if (restored !== currentHref) {
      navigate(restored, { replace: true });
    }
  }, [isLoading, isSignedIn, location, currentHref, signIn, navigate, signInLooped]);

  if (signInLooped) {
    const retrySignIn = () => {
      rememberSignInRedirect();
      signIn();
    };
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
          height: "100vh",
          px: 3,
          textAlign: "center",
        }}
      >
        <Typography component="h1" variant="h4" fontWeight={700}>
          We couldn&apos;t sign you in
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 420 }}>
          The sign-in didn&apos;t finish. Try again, and if it keeps happening, open One WSO2 in a new
          tab.
        </Typography>
        <Button variant="contained" onClick={retrySignIn} sx={{ mt: 1 }}>
          Try again
        </Button>
      </Box>
    );
  }

  // Hold the children back while a stashed redirect is still pending. Without
  // this the child route tree mounts first, its own redirects fire from child
  // effects, and this guard's effect then overrides them — the race described
  // on isRestorableTarget above.
  //
  // The SDK also reports loading while a silent sign-in renews a session the
  // page already has. Holding the children back then would unmount the page,
  // and anything typed into it, for the whole attempt.
  if ((isLoading && !renewing) || !isSignedIn || hasPendingRedirect) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return <Outlet />;
}
