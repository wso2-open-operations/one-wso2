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
import { Alert, Box } from "@wso2/oxygen-ui";
import { Outlet } from "react-router";
import { isEvidencePortalBackendConfigured } from "@config/apiConfig";
import { useEvidencePortalAuth } from "../shim/useEvidencePortalAuth";

// Element for the "evidence" parent route (routes.tsx) — mounted once, above
// every leaf page the module has today or grows into, rather than repeated on
// each one. Two jobs:
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
export default function EvidencePortalLayout(): JSX.Element {
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

  return <Outlet />;
}
