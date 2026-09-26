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

import type { JSX } from "react";
import { Alert, Box, CircularProgress } from "@wso2/oxygen-ui";
import { Outlet } from "react-router";
import { isEvidencePortalBackendConfigured } from "@config/apiConfig";
import { useEvidencePortalAuth } from "../shim/useEvidencePortalAuth";
import { useCurrentUser } from "../hooks/useCurrentUser";
import AccessDenied from "./AccessDenied";

// Element for the "evidence" parent route (routes.tsx) — mounted once, above
// every leaf page the module has today or grows into, rather than repeated on
// each one. Three jobs:
//
//   1. Wire the lifted axios client to One WSO2's access token
//      (useEvidencePortalAuth). One registration for the whole subtree keeps
//      every leaf page's own imports exactly as the source wrote them.
//   2. Stand in for every leaf page when the Evidence backend has no
//      configured address — same info-Alert shape MenuShell and
//      SubscriptionsShell use for their own "not connected" state, naming the
//      missing config key. Rendering the Alert INSTEAD OF `<Outlet />` is
//      what makes "no request" true: a lifted page's own react-query hooks
//      never fire if the page itself never mounts.
//   3. Answer the same access question the Security gate asks (useSecurityGate
//      folds this same useCurrentUser in, so the rail and this layout cannot
//      disagree) for someone who reaches an Evidence URL directly rather than
//      through the rail — a bookmark, or a link typed by hand. The rail simply
//      would not have offered them the item, so this is the only place that
//      question gets asked for that visitor. Mirrors the source's own
//      App.tsx/Gate split (see grc-tools's webapp/src/App.tsx): resolving shows
//      nothing, a 403 shows AccessDenied with the backend's own message, and
//      only then does the subtree mount.
export default function EvidencePortalLayout(): JSX.Element | null {
  useEvidencePortalAuth();

  if (!isEvidencePortalBackendConfigured()) {
    return (
      <Box>
        <Alert severity="info" sx={{ mt: 1.5 }}>
          Evidence Portal isn&apos;t connected yet. Set{" "}
          <code>ONE_WSO2_EVIDENCE_PORTAL_BACKEND_URL</code> in{" "}
          <code>public/config.js</code> (the backend URL) and reload.
        </Alert>
      </Box>
    );
  }

  return <EvidenceAccessGate />;
}

// Split out so its useCurrentUser() call only ever runs once the backend is
// known to be configured — the earlier return above never mounts this.
function EvidenceAccessGate(): JSX.Element | null {
  const { isLoaded, isForbidden, forbiddenMessage } = useCurrentUser();

  // Fail closed: render nothing rather than the subtree while /api/me is
  // still in flight, same as the rail hides the nav item until it answers.
  if (!isLoaded) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Only a 403 blocks. A 500, a timeout or a dead backend falls through to
  // the subtree, which shows its own per-page errors — telling someone they
  // have no access when the server is merely down would send them to an
  // administrator for nothing (see the source's own Gate for the same rule).
  if (isForbidden) {
    return <AccessDenied message={forbiddenMessage} />;
  }

  return <Outlet />;
}
