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

import { useEffect, useState } from "react";
import { useAsgardeo } from "@asgardeo/react";

// Minimal shell-level view of the signed-in user, derived from the id_token
// claims. Used by chrome (top-bar avatar, greeting) that just needs an
// identity string without pulling the whole people-app profile.
//
// We can't rely on useAsgardeo().user because it's only populated when
// preferences.user.fetchUserProfile is enabled (we disable it) or on the
// AsgardeoV2 platform (our tenant isn't). Decoding the id_token is the one
// path that always works — same trick useAsgardeoSub / AuthDebugPanel use.

export interface AsgardeoUser {
  ready: boolean;
  sub?: string;
  email?: string;
  givenName?: string;
  familyName?: string;
  displayName?: string;
  initials: string;
}

interface IdTokenClaims {
  sub?: string;
  email?: string;
  given_name?: string;
  family_name?: string;
  name?: string;
  preferred_username?: string;
}

function initialsFrom(claims: IdTokenClaims): string {
  const g = claims.given_name?.trim();
  const f = claims.family_name?.trim();
  if (g && f) return `${g[0]}${f[0]}`.toUpperCase();
  const full = claims.name?.trim();
  if (full) {
    const parts = full.split(/\s+/);
    const a = parts[0]?.[0] ?? "";
    const b = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
    if (a) return `${a}${b}`.toUpperCase();
  }
  // Fallback for IdPs that emit only one of the two name claims.
  if (g) return g[0].toUpperCase();
  if (f) return f[0].toUpperCase();
  const email = (claims.email ?? claims.preferred_username)?.trim();
  if (email) return email[0]?.toUpperCase() ?? "";
  return "";
}

/** The user before an ID token has been read, and after sign-out. */
const SIGNED_OUT: AsgardeoUser = { ready: false, initials: "" };

export function useAsgardeoUser(): AsgardeoUser {
  const { isSignedIn, getDecodedIdToken } = useAsgardeo();
  const [user, setUser] = useState<AsgardeoUser>(SIGNED_OUT);
  const [prevSignedIn, setPrevSignedIn] = useState(isSignedIn);
  if (prevSignedIn !== isSignedIn) {
    setPrevSignedIn(isSignedIn);
    if (!isSignedIn) setUser(SIGNED_OUT);
  }

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    getDecodedIdToken()
      .then((token) => {
        if (cancelled) return;
        const c = (token ?? {}) as IdTokenClaims;
        setUser({
          ready: true,
          sub: c.sub,
          email: c.email,
          givenName: c.given_name,
          familyName: c.family_name,
          displayName: c.name ?? ([c.given_name, c.family_name].filter(Boolean).join(" ") || undefined),
          initials: initialsFrom(c),
        });
      })
      .catch(() => {
        if (!cancelled) setUser({ ready: true, initials: "" });
      });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getDecodedIdToken]);

  return user;
}
