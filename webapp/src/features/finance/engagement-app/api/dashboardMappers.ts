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

import type * as D from "./dashboardTypes";
import type * as DW from "./dashboardWire";
import type { WBucket, WPerson, WSeriesPoint } from "./engagementWire";
import type { CountRow, MonthValue, NotConverted, Person } from "./engagementTypes";

const COST_SOURCES: readonly DW.WCostSource[] = ["invoice", "perDiem", "card", "claim"];

/** A cost source the backend named; an unknown one reads as an invoice rather than breaking the page. */
export const costSource = (x: string): D.CostSource => ((COST_SOURCES as readonly string[]).includes(x) ? (x as D.CostSource) : "invoice");

const text = (x: string | null | undefined): string => x ?? "";
const opt = (x: string | null | undefined): string | undefined => (x === null || x === undefined || x === "" ? undefined : x);
const num = (x: number | null | undefined): number | undefined => (x === null || x === undefined || !Number.isFinite(x) ? undefined : x);
const who = (p: WPerson | undefined | null): Person => ({ email: p?.email ?? "", name: p?.name || p?.email || "" });
const count = (b: WBucket): CountRow => ({ label: b.label, count: b.value });
const counts = (rows: readonly WBucket[] | undefined | null): CountRow[] => (rows ?? []).map(count);
const months = (rows: readonly WSeriesPoint[] | undefined | null, key: string): MonthValue[] => (rows ?? []).map((r) => ({ month: r.month, value: r.values[key] ?? 0 }));

export const widgetRefs = (w: readonly DW.WWidgetRef[] | undefined): D.WidgetRef[] | undefined => w?.map((x) => ({ id: x.id, defaultOn: Boolean(x.defaultOn) }));

export const notConverted = (n: { source: string; currency?: string | null; amount: number; lines?: number }): NotConverted => ({
  source: costSource(n.source),
  currency: text(n.currency).trim().toUpperCase(),
  amount: n.amount,
  ...(n.lines === undefined ? {} : { lines: n.lines }),
});

export const dashboardEngagement = (e: DW.WDashboardEngagementItem): D.DashboardEngagement => ({
  id: e.id,
  kind: e.kind,
  typeName: text(e.engagementTypeName),
  account: text(e.account),
  title: e.title,
  country: text(e.country),
  city: opt(e.city),
  start: e.startDate,
  end: e.endDate,
  consultantCount: e.consultants,
});

export const travelTeam = (t: DW.WTravelTeam): D.TravelTeamStats => ({
  awayThisWeek: t.awayThisWeek ? { travellers: t.awayThisWeek.travellers, countries: t.awayThisWeek.countries } : undefined,
  endedNotCompleted: t.endedNotCompleted?.count,
  poQueue: t.poQueue ? { count: t.poQueue.count ?? 0, oldestDays: t.poQueue.oldestDays ?? 0, byAge: t.poQueue.byAge ? counts(t.poQueue.byAge) : undefined } : undefined,
  frequentTravellers: t.frequentTravellers?.map((f) => ({ traveller: who(f.traveller), trips: f.trips })),
  agentWorkload: t.agentWorkload ? counts(t.agentWorkload) : undefined,
});

export const engagementManager = (m: DW.WEngagementManager): D.EngagementManagerStats => ({
  withoutConsultants: m.withoutConsultants ? { total: m.withoutConsultants.total, items: (m.withoutConsultants.items ?? []).map(dashboardEngagement) } : undefined,
  startingIn14Days: m.startingIn14Days && {
    total: m.startingIn14Days.total,
    items: (m.startingIn14Days.items ?? []).map((a) => ({
      allocationId: a.allocationId,
      consultant: who(a.consultant),
      engagementId: a.engagementId,
      engagementTitle: a.engagementTitle,
      start: a.startDate,
      end: a.endDate,
      travelRequired: Boolean(a.travelRequired),
    })),
  },
  mostAllocated: m.mostAllocated?.map((x) => ({ consultant: who(x.consultant), days: x.days })),
  topCustomers: m.topCustomers && { by: m.topCustomers.by, items: counts(m.topCustomers.items) },
});

export const accountManager = (a: DW.WAccountManager): D.AccountManagerStats => ({
  startedWithoutConsultants: a.startedWithoutConsultants && { total: a.startedWithoutConsultants.total, items: (a.startedWithoutConsultants.items ?? []).map(dashboardEngagement) },
  byStatus: a.byStatus ? counts(a.byStatus) : undefined,
  byMonth: a.byMonth ? months(a.byMonth, "Engagements") : undefined,
});

export const marketingEvents = (e: DW.WMarketingEvents): D.MarketingEventStats => ({
  byMonth: e.byMonth ? months(e.byMonth, "Events") : undefined,
  byRegion: e.byRegion ? counts(e.byRegion) : undefined,
  fundingByBusinessUnit: e.fundingByBusinessUnit ? counts(e.fundingByBusinessUnit) : undefined,
  campaignCoverage: e.campaignCoverage
    ? {
        total: e.campaignCoverage.total,
        withCampaign: e.campaignCoverage.withCampaign,
        percent: e.campaignCoverage.percent,
        byCreator: e.campaignCoverage.byCreator.map((c) => ({ creator: who(c.creator), total: c.total, withCampaign: c.withCampaign, percent: c.percent })),
      }
    : undefined,
});

const delta = (x: { previous?: number | null; changePercent?: number | null; thin?: boolean }): D.Delta => ({
  previous: num(x.previous),
  changePercent: num(x.changePercent),
  thin: Boolean(x.thin),
});

const kpi = (k: DW.WKpi): D.CostKpi => ({ value: k.value, ...delta(k) });

export const costBucket = (b: DW.WCostBucket): D.CostBucket => ({
  key: b.key,
  label: b.label,
  value: b.value,
  percent: b.percent ?? 0,
  trips: num(b.trips),
  averagePerTrip: num(b.averagePerTrip),
  categorised: b.categorised !== false,
  ...delta(b),
});

export function travelCosts(w: DW.WTravelCosts): D.TravelCosts {
  const buckets = (rows: readonly DW.WCostBucket[] | undefined | null) => (rows ?? []).map(costBucket);
  return {
    currency: w.currency || "USD",
    from: w.from,
    to: w.to,
    compare: w.compare ? { from: w.compare.from, to: w.compare.to } : undefined,
    dataAsOf: w.dataAsOf,
    kpis: { total: kpi(w.kpis.total), trips: kpi(w.kpis.trips), averagePerTrip: kpi(w.kpis.averagePerTrip), travellers: kpi(w.kpis.travellers), unlinkedSpend: kpi(w.kpis.unlinkedSpend) },
    bySource: buckets(w.bySource),
    byMonth: (w.byMonth ?? []).map((m) => ({ month: m.month, values: m.values })),
    byCountry: buckets(w.byCountry),
    byCustomer: buckets(w.byCustomer),
    byTravelAgent: buckets(w.byTravelAgent),
    byCostType: buckets(w.byCostType),
    byPaid: buckets(w.byPaid),
    paidSharePercent: num(w.paidSharePercent),
    notConverted: (w.notConverted ?? []).map(notConverted),
    ratesPending: w.ratesPending === true ? true : undefined,
    failedSources: (w.failedSources ?? []).map(costSource),
    truncated: Boolean(w.truncated),
    comparisonFailedSources: (w.comparisonFailedSources ?? []).map(costSource),
    comparisonTruncated: Boolean(w.comparisonTruncated),
    facets: {
      countries: w.facets?.countries ?? [],
      travelAgents: w.facets?.travelAgents ?? [],
      customers: w.facets?.customers ?? [],
      costTypes: w.facets?.costTypes ?? [],
    },
  };
}

export const costLine = (l: DW.WCostLine): D.CostLine => ({
  id: l.id,
  source: costSource(l.source),
  reference: opt(l.reference),
  jobNumber: opt(l.jobNumber),
  traveller: l.traveller ? who(l.traveller) : undefined,
  date: l.date,
  originalAmount: l.originalAmount,
  originalCurrency: text(l.originalCurrency),
  usdAmount: num(l.usdAmount),
  rate: num(l.rate),
  rateDate: opt(l.rateDate),
  rateSource: opt(l.rateSource),
  costType: l.costType,
  sourceType: opt(l.sourceType),
  country: opt(l.country),
  travelAgent: l.travelAgent ?? undefined,
  customer: opt(l.customer),
  paid: l.paid,
  engagementId: opt(l.engagementId),
  allocationType: opt(l.allocationType),
});

export function costTransactions(w: DW.WCostTransactions): D.CostTransactions {
  if ("groups" in w) {
    return {
      kind: "groups",
      total: w.total,
      dataAsOf: w.dataAsOf,
      groups: w.groups.map((g) => ({ key: g.key, label: g.label, lines: g.lines, trips: g.trips, travellers: g.travellers, total: g.total, ...delta(g) })),
    };
  }
  return { kind: "lines", items: w.items.map(costLine), total: w.total, totalUsd: w.totalUsd, dataAsOf: w.dataAsOf };
}

export const tripVisa = (t: DW.WTripVisa): D.TripVisa => ({
  jobNumber: t.jobNumber,
  country: t.country,
  city: opt(t.city),
  start: t.startDate,
  end: t.endDate,
  tripVisa: opt(t.tripVisa),
  myVisa: t.myVisa ?? undefined,
  waiting: Boolean(t.waiting),
});

/** Trips that still need a visa: the person has none for that country that covers the trip. */
export const tripsWaiting = (trips: readonly D.TripVisa[]): number => trips.filter((t) => t.waiting).length;

export const jobCostSummary = (w: DW.WJobCostSummary): D.JobCostSummary => ({
  totalUsd: w.totalUsd,
  ...(w.bySource ? { bySource: w.bySource.map((b) => ({ source: costSource(b.key), usd: b.usd, lines: b.lines })) } : {}),
  notConverted: (w.notConverted ?? []).map(notConverted),
  hasUnconvertedHidden: Boolean(w.hasUnconvertedHidden),
  incomplete: Boolean(w.incomplete),
  failedSources: (w.failedSources ?? []).map(costSource),
  dataAsOf: w.dataAsOf,
});
