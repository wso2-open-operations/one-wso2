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

import { Suspense, lazy, type ComponentType, type LazyExoticComponent } from "react";
import { Navigate, Route } from "react-router";
import { Skeleton } from "@wso2/oxygen-ui";
import IsacShell, { IsacScreen } from "./components/IsacShell";
import IsacTabs, { type IsacTabDef } from "./components/IsacTabs";
import { ISAC_PATH, ISAC_SCREEN, isacPath } from "./paths";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Copilot = lazy(() => import("./pages/Copilot"));
const Companies = lazy(() => import("./pages/Companies"));
const CompanyDetail = lazy(() => import("./pages/CompanyDetail"));
const Leads = lazy(() => import("./pages/Leads"));
const LeadDetail = lazy(() => import("./pages/LeadDetail"));
const ProspectSearch = lazy(() => import("./pages/ProspectSearch"));
const ReoLeads = lazy(() => import("./pages/ReoLeads"));
const CompetitiveIntelligence = lazy(() => import("./pages/CompetitiveIntelligence"));
const DataUpload = lazy(() => import("./pages/DataUpload"));
const Campaigns = lazy(() => import("./pages/Campaigns"));
const Contacts = lazy(() => import("./pages/Contacts"));
const NLQuery = lazy(() => import("./pages/NLQuery"));
const SfAccounts = lazy(() => import("./pages/SfAccounts"));
const Certifications = lazy(() => import("./pages/Certifications"));
const PardotLeads = lazy(() => import("./pages/PardotLeads"));
const PardotSnapshots = lazy(() => import("./pages/PardotSnapshots"));
const LinkedInCampaigns = lazy(() => import("./pages/LinkedInCampaigns"));
const LinkedInStats = lazy(() => import("./pages/LinkedInStats"));
const G2Signals = lazy(() => import("./pages/G2Signals"));
const Administration = lazy(() => import("./pages/Administration"));
const CompanyManagement = lazy(() => import("./pages/CompanyManagement"));
const CountryManagement = lazy(() => import("./pages/CountryManagement"));
const ActivityLog = lazy(() => import("./pages/ActivityLog"));

const FALLBACK = <Skeleton variant="rectangular" height={220} sx={{ m: 3, borderRadius: 1.5 }} />;

/** A screen with its own place in the main content area. */
function screen(title: string, Page: LazyExoticComponent<ComponentType>, bleed = false) {
  return (
    <IsacScreen title={title} bleed={bleed}>
      <Suspense fallback={FALLBACK}>
        <Page />
      </Suspense>
    </IsacScreen>
  );
}

/** A screen shown under a tab bar, which already has the area. */
function tab(Page: LazyExoticComponent<ComponentType>) {
  return (
    <Suspense fallback={FALLBACK}>
      <Page />
    </Suspense>
  );
}

/** The source-system tables behind the scores, one tab each. */
export const SIGNAL_TABS: readonly IsacTabDef[] = [
  { segment: "sf-accounts", label: "SF Accounts" },
  { segment: "certifications", label: "Certifications" },
  { segment: "pardot-leads", label: "Pardot Leads" },
  { segment: "pardot-snapshots", label: "Pardot Snapshots" },
  { segment: "linkedin-campaigns", label: "LinkedIn Campaigns" },
  { segment: "linkedin-stats", label: "LinkedIn Stats" },
  { segment: "g2-signals", label: "G2 Signals", bleed: true },
];

/** The screens that maintain ISAC's own data, one tab each. */
export const ADMIN_TABS: readonly IsacTabDef[] = [
  { segment: "data-management", label: "Data Management" },
  { segment: "company-management", label: "Company Management" },
  { segment: "country-management", label: "Country Management" },
  { segment: "activity-log", label: "Activity Log", bleed: true },
];

const SIGNALS_PATH = isacPath(ISAC_SCREEN.signals);
const ADMIN_PATH = isacPath(ISAC_SCREEN.admin);
const HOME = isacPath(ISAC_SCREEN.dashboard);

/** Every ISAC route, for the app's route table. */
export const isacRoutes = (
  <Route path={ISAC_PATH.slice(1)} element={<IsacShell />}>
    <Route index element={<Navigate to={HOME} replace />} />
    <Route path="dashboard" element={screen("Dashboard", Dashboard, true)} />
    <Route path="ask-ai" element={screen("Ask AI", Copilot, true)} />
    <Route path="companies" element={screen("Companies", Companies, true)} />
    <Route path="companies/:id" element={screen("Company", CompanyDetail, true)} />
    <Route path="leads" element={screen("Leads", Leads, true)} />
    <Route path="leads/:id" element={screen("Lead", LeadDetail, true)} />
    <Route path="advanced-search" element={screen("Advanced Search", ProspectSearch, true)} />
    <Route path="reo-leads" element={screen("Reo Leads", ReoLeads, true)} />
    <Route path="g2-intelligence" element={screen("G2 Intelligence", CompetitiveIntelligence, true)} />
    <Route path="data-ingestion" element={screen("Data Ingestion", DataUpload)} />
    <Route path="campaigns" element={screen("Campaigns", Campaigns, true)} />
    <Route path="contacts" element={screen("Contacts", Contacts)} />
    <Route path="query" element={screen("Query", NLQuery, true)} />

    <Route
      path="signals"
      element={
        <IsacScreen title="Signal Data" bleed>
          <IsacTabs basePath={SIGNALS_PATH} tabs={SIGNAL_TABS} ariaLabel="Signal data sources" />
        </IsacScreen>
      }
    >
      <Route index element={<Navigate to={`${SIGNALS_PATH}/${SIGNAL_TABS[0].segment}`} replace />} />
      <Route path="sf-accounts" element={tab(SfAccounts)} />
      <Route path="certifications" element={tab(Certifications)} />
      <Route path="pardot-leads" element={tab(PardotLeads)} />
      <Route path="pardot-snapshots" element={tab(PardotSnapshots)} />
      <Route path="linkedin-campaigns" element={tab(LinkedInCampaigns)} />
      <Route path="linkedin-stats" element={tab(LinkedInStats)} />
      <Route path="g2-signals" element={tab(G2Signals)} />
    </Route>

    <Route
      path="admin"
      element={
        <IsacScreen title="Administration" bleed>
          <IsacTabs basePath={ADMIN_PATH} tabs={ADMIN_TABS} ariaLabel="ISAC administration" />
        </IsacScreen>
      }
    >
      <Route index element={<Navigate to={`${ADMIN_PATH}/${ADMIN_TABS[0].segment}`} replace />} />
      <Route path="data-management" element={tab(Administration)} />
      <Route path="company-management" element={tab(CompanyManagement)} />
      <Route path="country-management" element={tab(CountryManagement)} />
      <Route path="activity-log" element={tab(ActivityLog)} />
    </Route>

    <Route path="*" element={<Navigate to={HOME} replace />} />
  </Route>
);
