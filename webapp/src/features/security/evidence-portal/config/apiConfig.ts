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

// The lifted source imports BACKEND_BASE_URL from its own @config/apiConfig,
// reading it off a `window.config.EVIDENCE_PORTAL_BACKEND_BASE_URL`
// declaration that clashed with One WSO2's own window.config type (see
// webapp/src/config/authConfig.ts) and has been removed. Re-exporting this
// app's value under that name is what lets every lifted call site come
// across unedited — same idea as the GRC module's shim/apiConfig.ts. The
// config key itself is this app's own — ONE_WSO2_EVIDENCE_PORTAL_BACKEND_URL.
//
// A trailing slash is already stripped by evidencePortalBackendUrl. Every
// caller here still appends a path beginning with "/" (api/client.ts and the
// SSE fetch in pages/AgentRunner.tsx), so an empty value collapses to just
// "/api...", the relative form a reverse proxy forwards.
export { evidencePortalBackendUrl as BACKEND_BASE_URL } from "@config/apiConfig";
