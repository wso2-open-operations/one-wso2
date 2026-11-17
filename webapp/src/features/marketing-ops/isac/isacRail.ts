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

import { ISAC_SCREEN, isacPath } from "./paths";

/** The rail id of the ISAC group. */
export const ISAC_RAIL_GROUP_ID = "mops-isac";

/** The ISAC screens the rail lists, in rail order. */
export const ISAC_RAIL_ITEMS: readonly { id: string; label: string; path: string }[] = [
  { id: "mops-isac-dashboard", label: "Dashboard", path: isacPath(ISAC_SCREEN.dashboard) },
  { id: "mops-isac-ask-ai", label: "Ask AI", path: isacPath(ISAC_SCREEN.askAi) },
  { id: "mops-isac-companies", label: "Companies", path: isacPath(ISAC_SCREEN.companies) },
  { id: "mops-isac-leads", label: "Leads", path: isacPath(ISAC_SCREEN.leads) },
  { id: "mops-isac-advanced-search", label: "Advanced Search", path: isacPath(ISAC_SCREEN.advancedSearch) },
  { id: "mops-isac-reo-leads", label: "Reo Leads", path: isacPath(ISAC_SCREEN.reoLeads) },
  { id: "mops-isac-g2-intelligence", label: "G2 Intelligence", path: isacPath(ISAC_SCREEN.g2Intelligence) },
  { id: "mops-isac-data-ingestion", label: "Data Ingestion", path: isacPath(ISAC_SCREEN.dataIngestion) },
  { id: "mops-isac-signals", label: "Signal Data", path: isacPath(ISAC_SCREEN.signals) },
  { id: "mops-isac-admin", label: "Administration", path: isacPath(ISAC_SCREEN.admin) },
];
