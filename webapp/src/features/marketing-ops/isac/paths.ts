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

import { salesforceBaseUrl } from "@config/apiConfig";

/** Where every ISAC screen lives. */
export const ISAC_PATH = "/marketing-ops/isac";

/** The app path of an ISAC screen, from its path inside ISAC (`/companies/42`). */
export function isacPath(path: string): string {
  return `${ISAC_PATH}${path}`;
}

/** The ISAC screens, by the path each one has inside ISAC. */
export const ISAC_SCREEN = {
  dashboard: "/dashboard",
  askAi: "/ask-ai",
  companies: "/companies",
  leads: "/leads",
  advancedSearch: "/advanced-search",
  reoLeads: "/reo-leads",
  g2Intelligence: "/g2-intelligence",
  dataIngestion: "/data-ingestion",
  signals: "/signals",
  admin: "/admin",
} as const;

/**
 * A link to a Salesforce record, or null when the record has no Salesforce id.
 */
export function sfRecordUrl(objectType: "Lead" | "Account" | "Contact", sfId?: string | null): string | null {
  if (!sfId) return null;
  return `${salesforceBaseUrl}/lightning/r/${objectType}/${encodeURIComponent(sfId)}/view`;
}
