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

// The Engagement App Dashboard's Phase 1 wire shapes: the role stat sections, Travel Costs, and the Me visas.
// Paths and rules are in the dashboard build spec (section 2) and the Backend's openapi.yaml.

import type { EngagementKind } from "./engagementTypes";
import type { WBucket, WPerson, WSeriesPoint } from "./engagementWire";

export type WCostSource = "invoice" | "perDiem" | "card" | "claim";

/** What the backend lists in GET /dashboard: every widget the caller may see, and whether it is on by default. */
export interface WWidgetRef {
  id: string;
  defaultOn: boolean;
}

export interface WDashboardEngagementItem {
  id: string;
  kind: EngagementKind;
  engagementTypeId: number;
  engagementTypeName?: string | null;
  account?: string | null;
  title: string;
  city?: string | null;
  country?: string | null;
  startDate: string;
  endDate: string;
  consultants: number;
}

// Every part of the four role sections is optional: the backend sends a part only when the caller may see the widget it feeds.
export interface WTravelTeam {
  awayThisWeek?: { travellers: number; countries: number };
  endedNotCompleted?: { count: number };
  poQueue?: { count?: number; oldestDays?: number; byAge?: WBucket[] };
  frequentTravellers?: { traveller: WPerson; trips: number }[];
  agentWorkload?: WBucket[];
}

export interface WEngagementManager {
  withoutConsultants?: { total: number; items: WDashboardEngagementItem[] };
  startingIn14Days?: {
    total: number;
    items: {
      allocationId: string;
      consultant: WPerson;
      engagementId: string;
      engagementTitle: string;
      startDate: string;
      endDate: string;
      travelRequired?: boolean | null;
    }[];
  };
  mostAllocated?: { consultant: WPerson; days: number }[];
  topCustomers?: { by: "customer" | "country"; items: WBucket[] };
}

export interface WAccountManager {
  startedWithoutConsultants?: { total: number; items: WDashboardEngagementItem[] };
  byStatus?: WBucket[];
  byMonth?: WSeriesPoint[];
}

export interface WMarketingEvents {
  byMonth?: WSeriesPoint[];
  byRegion?: WBucket[];
  fundingByBusinessUnit?: WBucket[];
  campaignCoverage?: {
    total: number;
    withCampaign: number;
    percent: number;
    byCreator: { creator: WPerson; total: number; withCampaign: number; percent: number }[];
  } | null;
}

export interface WKpi {
  value: number;
  previous?: number | null;
  changePercent?: number | null;
  thin?: boolean;
}

export interface WCostBucket {
  key: string;
  label: string;
  value: number;
  percent?: number;
  previous?: number | null;
  changePercent?: number | null;
  thin?: boolean;
  trips?: number | null;
  averagePerTrip?: number | null;
  categorised?: boolean | null;
}

export interface WTravelCosts {
  currency: string;
  rateRule?: string;
  from: string;
  to: string;
  compare?: { from: string; to: string } | null;
  dataAsOf: string;
  kpis: { total: WKpi; trips: WKpi; averagePerTrip: WKpi; travellers: WKpi; unlinkedSpend: WKpi };
  bySource: WCostBucket[];
  byMonth: WSeriesPoint[];
  byCountry: WCostBucket[];
  byCustomer: WCostBucket[];
  byTravelAgent: WCostBucket[];
  byCostType: WCostBucket[];
  byPaid: WCostBucket[];
  paidSharePercent?: number | null;
  notConverted?: { source: string; currency?: string | null; amount: number; lines?: number }[] | null;
  /** Exchange rates are still being fetched, so totals may be low. Absent from an older backend. */
  ratesPending?: boolean;
  failedSources?: string[] | null;
  truncated?: boolean;
  comparisonFailedSources?: string[] | null;
  comparisonTruncated?: boolean;
  facets?: { countries?: string[]; travelAgents?: { id: number; name: string }[]; customers?: string[]; costTypes?: string[] } | null;
}

export interface WCostLine {
  id: string;
  source: WCostSource;
  reference?: string | null;
  jobNumber?: string | null;
  traveller?: WPerson | null;
  date: string;
  originalAmount: number;
  originalCurrency?: string | null;
  usdAmount?: number | null;
  rate?: number | null;
  rateDate?: string | null;
  rateSource?: string | null;
  costType: string;
  sourceType?: string | null;
  country?: string | null;
  travelAgent?: { id: number; name: string } | null;
  customer?: string | null;
  paid: "paid" | "nonPaid" | "unknown";
  engagementId?: string | null;
  allocationType?: string | null;
}

export interface WCostGroup {
  key: string;
  label: string;
  lines: number;
  trips: number;
  travellers: number;
  total: number;
  previous?: number | null;
  changePercent?: number | null;
  thin?: boolean;
}

export type WCostTransactions =
  | { items: WCostLine[]; total: number; totalUsd: number; dataAsOf: string }
  | { groups: WCostGroup[]; total: number; dataAsOf: string };

export interface WTripVisa {
  jobNumber: string;
  country: string;
  city?: string | null;
  startDate: string;
  endDate: string;
  tripVisa?: string | null;
  myVisa?: { type: string; endDate: string } | null;
  waiting: boolean;
}

/** GET /travel-requests/{jobNumber}/cost-summary. A travel agent gets no bySource. */
export interface WJobCostSummary {
  totalUsd: number;
  bySource?: { key: string; label?: string; usd: number; lines: number }[] | null;
  notConverted?: { source: string; currency?: string | null; amount: number; lines?: number }[] | null;
  hasUnconvertedHidden?: boolean;
  incomplete?: boolean;
  failedSources?: string[] | null;
  dataAsOf: string;
}
