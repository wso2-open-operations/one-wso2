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

import { useEffect } from "react";
import { refreshAccessToken } from "@api/authBridge";
import { useAccessToken } from "@hooks/useAccessToken";
import { registerAuth } from "../api/client";

// The seam between the lifted Evidence Portal source and this app — the
// Evidence equivalent of the GRC module's shim/useAuthApiClient.ts, adapted to
// the source's OWN auth interface instead of reproducing the GRC module's
// fetch-passing one. The source already keeps exactly this seam (see
// api/client.ts's comment above `registerAuth`): its axios instance, and the
// Agent Runner's raw SSE fetch which cannot go through axios interceptors,
// both read a token and recover from a 401 through the three functions
// `registerAuth` takes. Calling it once, from this hook, mounted by the
// module's route element (EvidencePortalLayout), is the ONLY new wiring the
// port adds — every lifted call site is unedited.
//
// ── WHICH TOKEN ──────────────────────────────────────────────────────────
// getAccessToken: this app's own @hooks/useAccessToken — the same accessor
// every other backend here authorizes with. See the GRC shim's own comment
// (shim/useAuthApiClient.ts) for why the access token, not the id token, is
// the right one to send; the same reasoning applies here.
//
// ── WHICH REFRESH ────────────────────────────────────────────────────────
// refreshAccessToken here is @api/authBridge's refreshAccessToken, NOT
// @api/http's fetchWithReauth. They solve the same 401 at different layers:
// fetchWithReauth wraps one fetch end to end (attach token, see 401, refresh,
// retry) — the shape @api/http's authedGet/Post/etc need because they own the
// whole request. The Evidence source's axios instance already owns that same
// job for itself (api/client.ts's request/response interceptor pair: attach
// via getAuthToken(), and on 401 call `_auth.refreshAccessToken()` once, then
// retry through axios). Handing it fetchWithReauth would nest one retry loop
// inside another for no benefit. What its retry path actually needs is
// exactly what @api/authBridge's refreshAccessToken() does standalone: force
// one silent re-auth. The retried axios call then attaches whatever token
// getAuthToken() reads afterwards — which, because the re-auth just renewed
// the underlying Asgardeo session, is the fresh one.
//
// ── ON AUTH LOST ─────────────────────────────────────────────────────────
// Left unregistered, deliberately. @api/authBridge's refreshAccessToken()
// already flips the app-wide session-expired flag itself once its own
// backoff gives up (FAILURES_BEFORE_PROMPT in authBridge.ts), and
// SessionExpiryWatcher — mounted once, app-wide, in AppLayout — turns that
// into the same full-page "please sign in again" dialog every other dead
// session in this app raises. A second `onAuthLost` here would just be a
// redundant path to the identical dialog.
export function useEvidencePortalAuth(): void {
  const getAccessToken = useAccessToken();

  useEffect(() => {
    registerAuth({ getAccessToken, refreshAccessToken });
    return () => registerAuth(null);
  }, [getAccessToken]);
}
