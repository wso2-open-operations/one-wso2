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

import { Navigate, Route } from "react-router";
import EvidencePortalLayout from "./components/EvidencePortalLayout";
import Dashboard from "./pages/Dashboard";
import EvidenceList from "./pages/EvidenceList";
import SubmitEvidence from "./pages/SubmitEvidence";
import AgentRunner from "./pages/AgentRunner";
import Cost from "./pages/Cost";
import Catalogue from "./pages/Catalogue";
import AdminOnly from "./components/AdminOnly";

// Evidence Portal routes, mounted under /security/evidence by App.tsx —
// same idea as the GRC modules' own routes.tsx fragments beside it. Owned by
// this module, so a new page is added here without touching App.tsx.
//
// EvidencePortalLayout wraps the whole subtree once — the auth wiring and the
// not-connected notice both belong above every leaf page, not repeated on
// each one. Submit Evidence and Agent Runner both need that
// auth wiring: the manual upload goes through the lifted axios client, and
// the Agent Runner's own SSE fetch reads the same registered token — see
// api/client.ts's getAuthToken and shim/useEvidencePortalAuth.ts.
//
// "history" is the old standalone app's own redirect
// (grc-tools/apps/evidence-app/webapp/src/App.tsx: `/history` -> `/evidence`),
// carried across at the same relative depth so a bookmark of the old URL
// still lands on the list once rewritten under this prefix.
export const evidenceRoutes = (
  <Route path="evidence" element={<EvidencePortalLayout />}>
    <Route index element={<Navigate to="dashboard" replace />} />
    <Route path="dashboard" element={<Dashboard />} />
    <Route path="evidence" element={<EvidenceList />} />
    <Route path="submit" element={<SubmitEvidence />} />
    <Route path="agent" element={<AgentRunner />} />
    <Route path="cost" element={<AdminOnly><Cost /></AdminOnly>} />
    <Route path="catalogue" element={<AdminOnly><Catalogue /></AdminOnly>} />
    <Route path="history" element={<Navigate to="evidence" replace />} />
  </Route>
);
