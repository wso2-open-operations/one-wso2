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

// The Engagement App Dashboard's Phase 1 view types (see dashboardWire.ts for the wire).

import type { CostSource, CountRow, EngagementKind, MonthValue, NotConverted, Person } from "./engagementTypes";

export type { CostSource };

export type PaidKind = "paid" | "nonPaid" | "unknown";

/** A widget the caller may see, and whether it is on until they change it. */
export interface WidgetRef {
  readonly id: string;
  readonly defaultOn: boolean;
}

/** An engagement in a dashboard list. */
export interface DashboardEngagement {
  readonly id: string;
  readonly kind: EngagementKind;
  readonly typeName: string;
  readonly account: string;
  readonly title: string;
  readonly country: string;
  readonly city?: string;
  readonly start: string;
  readonly end: string;
  readonly consultantCount: number;
}

export interface TravelTeamStats {
  // Every part of the four role sections is absent when the caller may not see its widget.
  readonly awayThisWeek?: { readonly travellers: number; readonly countries: number };
  readonly endedNotCompleted?: number;
  readonly poQueue?: { readonly count: number; readonly oldestDays: number; readonly byAge?: readonly CountRow[] };
  readonly frequentTravellers?: readonly { readonly traveller: Person; readonly trips: number }[];
  readonly agentWorkload?: readonly CountRow[];
}

export interface EngagementManagerStats {
  readonly withoutConsultants?: { readonly total: number; readonly items: readonly DashboardEngagement[] };
  readonly startingIn14Days?: {
    readonly total: number;
    readonly items: readonly {
      readonly allocationId: string;
      readonly consultant: Person;
      readonly engagementId: string;
      readonly engagementTitle: string;
      readonly start: string;
      readonly end: string;
      readonly travelRequired: boolean;
    }[];
  };
  readonly mostAllocated?: readonly { readonly consultant: Person; readonly days: number }[];
  readonly topCustomers?: { readonly by: "customer" | "country"; readonly items: readonly CountRow[] };
}

export interface AccountManagerStats {
  readonly startedWithoutConsultants?: { readonly total: number; readonly items: readonly DashboardEngagement[] };
  readonly byStatus?: readonly CountRow[];
  readonly byMonth?: readonly MonthValue[];
}

export interface MarketingEventStats {
  readonly byMonth?: readonly MonthValue[];
  readonly byRegion?: readonly CountRow[];
  readonly fundingByBusinessUnit?: readonly CountRow[];
  /** Absent when the environment has no campaign column. */
  readonly campaignCoverage?: {
    readonly total: number;
    readonly withCampaign: number;
    readonly percent: number;
    readonly byCreator: readonly { readonly creator: Person; readonly total: number; readonly withCampaign: number; readonly percent: number }[];
  };
}

/** Change against the same period last year. `thin` means too little data last year for a percentage. */
export interface Delta {
  readonly previous?: number;
  readonly changePercent?: number;
  readonly thin: boolean;
}

export interface CostKpi extends Delta {
  readonly value: number;
}

export interface CostBucket extends Delta {
  /** What a click on this bar sends back as a filter. */
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly percent: number;
  readonly trips?: number;
  readonly averagePerTrip?: number;
  /** False for Card and Claim by cost type: they have no category yet. */
  readonly categorised: boolean;
}

export interface CostMonth {
  /** yyyy-MM. */
  readonly month: string;
  /** By source label: "Travel Invoices", "Per Diems", "Credit Card Expenses", "Expense Claims". */
  readonly values: Readonly<Record<string, number>>;
}

export interface TravelCosts {
  readonly currency: string;
  readonly from: string;
  readonly to: string;
  readonly compare?: { readonly from: string; readonly to: string };
  readonly dataAsOf: string;
  readonly kpis: { readonly total: CostKpi; readonly trips: CostKpi; readonly averagePerTrip: CostKpi; readonly travellers: CostKpi; readonly unlinkedSpend: CostKpi };
  readonly bySource: readonly CostBucket[];
  readonly byMonth: readonly CostMonth[];
  readonly byCountry: readonly CostBucket[];
  readonly byCustomer: readonly CostBucket[];
  readonly byTravelAgent: readonly CostBucket[];
  readonly byCostType: readonly CostBucket[];
  readonly byPaid: readonly CostBucket[];
  readonly paidSharePercent?: number;
  readonly notConverted: readonly NotConverted[];
  /** Exchange rates are still loading, so totals may be low. */
  readonly ratesPending?: boolean;
  /** Sources the backend could not read; their lines are left out of every figure. */
  readonly failedSources: readonly CostSource[];
  /** A source hit the 20,000-line cap. */
  readonly truncated: boolean;
  /** Sources that could not be read for last year. When any is listed, or last year was cut at the cap, no change against it is given. */
  readonly comparisonFailedSources: readonly CostSource[];
  readonly comparisonTruncated: boolean;
  readonly facets: {
    readonly countries: readonly string[];
    readonly travelAgents: readonly { readonly id: number; readonly name: string }[];
    readonly customers: readonly string[];
    readonly costTypes: readonly string[];
  };
}

export interface CostLine {
  readonly id: string;
  readonly source: CostSource;
  readonly reference?: string;
  readonly jobNumber?: string;
  readonly traveller?: Person;
  readonly date: string;
  readonly originalAmount: number;
  readonly originalCurrency: string;
  /** Absent when no rate was found. */
  readonly usdAmount?: number;
  /** Units of the original currency for 1 USD. */
  readonly rate?: number;
  readonly rateDate?: string;
  /** How the USD amount was found, as the backend words it ("recorded", "card", "month-end", "today"). */
  readonly rateSource?: string;
  readonly costType: string;
  readonly sourceType?: string;
  readonly country?: string;
  readonly travelAgent?: { readonly id: number; readonly name: string };
  readonly customer?: string;
  readonly paid: PaidKind;
  readonly engagementId?: string;
  readonly allocationType?: string;
}

export interface CostGroup extends Delta {
  readonly key: string;
  readonly label: string;
  readonly lines: number;
  readonly trips: number;
  readonly travellers: number;
  readonly total: number;
}

export type CostTransactions =
  | { readonly kind: "lines"; readonly items: readonly CostLine[]; readonly total: number; readonly totalUsd: number; readonly dataAsOf: string }
  | { readonly kind: "groups"; readonly groups: readonly CostGroup[]; readonly total: number; readonly dataAsOf: string };

/** A trip on the Me page with its visa position. */
export interface TripVisa {
  readonly jobNumber: string;
  readonly country: string;
  readonly city?: string;
  readonly start: string;
  readonly end: string;
  readonly tripVisa?: string;
  readonly myVisa?: { readonly type: string; readonly endDate: string };
  readonly waiting: boolean;
}

/** The cost so far of one travel request. `bySource` is absent for a travel agent. */
export interface JobCostSummary {
  readonly totalUsd: number;
  readonly bySource?: readonly { readonly source: CostSource; readonly usd: number; readonly lines: number }[];
  readonly notConverted: readonly NotConverted[];
  /** An amount in a section the viewer may not open could not be converted. No detail is given. */
  readonly hasUnconvertedHidden: boolean;
  /** A source could not be read or the line cap was reached, so the total may be too low. */
  readonly incomplete: boolean;
  readonly failedSources: readonly CostSource[];
  readonly dataAsOf: string;
}
