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

// Absolute URLs for the Evidence Portal, same idea as the Audit Hub's own
// paths.ts beside it (features/security/grc/modules/audit/paths.ts):
// routes.tsx declares the same tree as relative segments under
// <Route path="evidence">, which App.tsx mounts inside "security", so an
// in-app link needs the full path. Keeping it here, once, is what stops a
// link back to the old standalone app's paths ("/", "/evidence", "/submit",
// "/agent", "/cost", "/catalogue", "/history") from surviving the port
// scattered across pages — see Dashboard.tsx's "view all" link.
const EVIDENCE_BASE = "/security/evidence";

export const evidencePortalPaths = {
  dashboard: `${EVIDENCE_BASE}/dashboard`,
  evidence: `${EVIDENCE_BASE}/evidence`,
  submit: `${EVIDENCE_BASE}/submit`,
  agent: `${EVIDENCE_BASE}/agent`,
  cost: `${EVIDENCE_BASE}/cost`,
  catalogue: `${EVIDENCE_BASE}/catalogue`,
};
