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

import { Launch as LaunchIcon } from "../icons";
import { Box, Chip, IconButton, Tab, Tabs, Tooltip } from "@wso2/oxygen-ui";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LinkedInCampaign, LinkedInCampaignGroup, PaginatedResponse, useApiClient } from "../api/client";
import DataTable, { ColumnDef } from "../components/DataTable";
import { C } from "../theme/pageTokens";
import { FS, FW } from "../theme/typeScale";

const fmtCurrency = (v: number | undefined | null, currency?: string) =>
  v != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0 }).format(v) : '—';

const humanize = (s?: string) => s ? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—';

/** One ad (creative) row from GET /linkedin/stats/ads. */
interface LinkedInAdStat {
  id: number;
  name: string | null;
  campaign_name: string | null;
  status: string | null;
  is_serving: boolean;
  impressions: number;
  clicks: number;
  ctr: number;
  spent: number;
  ad_url: string | null;
}

const AD_COLS: ColumnDef<LinkedInAdStat>[] = [
  { key: "name", header: "Ad", sortable: false, filterable: false, render: (r) => (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
      {r.name || "(unnamed ad)"}
      {r.ad_url && (
        <Tooltip title="View this ad's post on LinkedIn" arrow>
          <IconButton size="small" component="a" href={r.ad_url} target="_blank" rel="noopener noreferrer"
            aria-label="View ad on LinkedIn" sx={{ p: 0.25, color: "#0A66C2" }}>
            <LaunchIcon sx={{ fontSize: 12 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  )},
  { key: "campaign_name", header: "Campaign", sortable: false, filterable: false, render: (r) => r.campaign_name || "—" },
  { key: "status", header: "Status", sortable: false, filterable: false, render: (r) => (
    <Chip label={r.is_serving ? "LIVE" : (r.status || "—")} size="small"
      sx={{ height: 18, fontSize: FS.caption, fontWeight: FW.semibold,
            bgcolor: r.is_serving ? "#0d7d5510" : C.card,
            color: r.is_serving ? "#0d7d55" : C.sub }} />
  )},
  { key: "impressions", header: "Impressions", sortable: false, filterable: false, render: (r) => r.impressions.toLocaleString() },
  { key: "clicks", header: "Clicks", sortable: false, filterable: false, render: (r) => r.clicks.toLocaleString() },
  { key: "ctr", header: "CTR %", sortable: false, filterable: false, render: (r) => `${r.ctr}%` },
  { key: "spent", header: "Spent", sortable: false, filterable: false, render: (r) => r.spent.toLocaleString(undefined, { maximumFractionDigits: 0 }) },
];

/* ── Campaign Groups — high-level overview ────────────────────────────── */
const GROUP_COLUMNS: ColumnDef<LinkedInCampaignGroup>[] = [
  { key: "group_name",      header: "Campaign Group" },
  { key: "group_status",    header: "Status" },
  { key: "campaign_count",  header: "Campaigns", sortable: false, filterable: false },
  { key: "total_budget",    header: "Budget", sortable: false, filterable: false, render: (r) => fmtCurrency(r.total_budget, r.budget_currency) },
  { key: "total_spent",     header: "Spend", sortable: false, filterable: false, render: (r) => fmtCurrency(r.total_spent) },
  { key: "total_impressions", header: "Impressions", sortable: false, filterable: false, render: (r) => r.total_impressions.toLocaleString() },
  { key: "total_clicks",     header: "Clicks", sortable: false, filterable: false, render: (r) => r.total_clicks.toLocaleString() },
  { key: "avg_ctr",          header: "CTR", sortable: false, filterable: false, render: (r) => `${r.avg_ctr.toFixed(2)}%` },
  { key: "avg_cpc",          header: "CPC", sortable: false, filterable: false, render: (r) => `$${r.avg_cpc.toFixed(2)}` },
  { key: "date_range",       header: "Active Period", sortable: false, filterable: false, render: (r) => r.first_report_date && r.last_report_date ? `${r.first_report_date} — ${r.last_report_date}` : "—" },
];

/* ── Individual Campaigns — per-campaign detail ───────────────────────── */
const CAMPAIGN_COLUMNS: ColumnDef<LinkedInCampaign>[] = [
  { key: "campaign_name",    header: "Campaign" },
  { key: "campaign_status",  header: "Status" },
  { key: "objective_type",   header: "Objective", render: (r) => humanize(r.objective_type) },
  { key: "ad_format",        header: "Format", render: (r) => humanize(r.ad_format) },
  { key: "total_budget",     header: "Budget", sortable: false, filterable: false, render: (r) => {
    if (r.daily_budget != null) return `${fmtCurrency(r.daily_budget, r.budget_currency)}/day`;
    if (r.total_budget != null) return fmtCurrency(r.total_budget, r.budget_currency);
    return '—';
  }},
  { key: "total_spent",      header: "Spend", sortable: false, filterable: false, render: (r) => fmtCurrency(r.total_spent) },
  { key: "total_impressions", header: "Impressions", sortable: false, filterable: false, render: (r) => r.total_impressions.toLocaleString() },
  { key: "total_clicks",     header: "Clicks", sortable: false, filterable: false, render: (r) => r.total_clicks.toLocaleString() },
  { key: "avg_ctr",          header: "CTR", sortable: false, filterable: false, render: (r) => `${r.avg_ctr.toFixed(2)}%` },
  { key: "avg_cpc",          header: "CPC", sortable: false, filterable: false, render: (r) => `$${r.avg_cpc.toFixed(2)}` },
  { key: "campaign_start_date", header: "Start Date", render: (r) => r.campaign_start_date ? r.campaign_start_date.split('T')[0] : '—' },
  { key: "campaign_end_date",   header: "End Date", render: (r) => r.campaign_end_date ? r.campaign_end_date.split('T')[0] : 'Ongoing' },
];

/** Lazy row expansion for a campaign: the ads inside it, with their stats.
 * Fetched on first expand via GET /linkedin/stats/ads?campaign_id=. */
function CampaignAdsPanel({ campaignId }: { campaignId: number }) {
  const { get } = useApiClient();
  const [ads, setAds] = useState<LinkedInAdStat[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stale = false;
    get<PaginatedResponse<LinkedInAdStat>>("/linkedin/stats/ads", { campaign_id: campaignId, page_size: 100 })
      .then((d) => { if (!stale) setAds(d.items); })
      .catch(() => { if (!stale) setFailed(true); });
    return () => { stale = true; };
  }, [get, campaignId]);

  if (failed) return <Box sx={{ fontSize: FS.small, color: "text.secondary", py: 0.5 }}>Could not load the ads.</Box>;
  if (ads === null) return <Box sx={{ py: 0.5, fontSize: FS.small, color: "text.secondary" }}>Loading ads…</Box>;
  if (ads.length === 0) return <Box sx={{ py: 0.5, fontSize: FS.small, color: "text.secondary" }}>No ads captured for this campaign yet (the ad-level sync covers currently running campaigns).</Box>;
  return (
    <Box>
      <Box sx={{ fontSize: FS.caption, fontWeight: FW.semibold, textTransform: "uppercase", letterSpacing: "0.04em", color: "text.secondary", mb: 0.5 }}>
        Ads in this campaign ({ads.length})
      </Box>
      {ads.map((a) => (
        <Box key={a.id} sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.4, borderBottom: `1px solid ${C.borderSoft}` }}>
          <Box sx={{ fontSize: FS.small, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            ↳ {a.name || "(unnamed ad)"}
          </Box>
          <Chip label={a.is_serving ? "LIVE" : (a.status || "—")} size="small"
            sx={{ height: 16, fontSize: FS.micro, fontWeight: FW.semibold,
                  bgcolor: a.is_serving ? "#0d7d5510" : C.card,
                  color: a.is_serving ? "#0d7d55" : C.sub }} />
          <Box sx={{ fontSize: FS.small, color: "text.secondary", whiteSpace: "nowrap" }}>
            {a.impressions.toLocaleString()} impr · {a.clicks.toLocaleString()} clicks · {a.ctr}% · {a.spent.toLocaleString(undefined, { maximumFractionDigits: 0 })} spent
          </Box>
          {a.ad_url && (
            <Tooltip title="View this ad's post on LinkedIn" arrow>
              <IconButton size="small" component="a" href={a.ad_url} target="_blank" rel="noopener noreferrer"
                aria-label="View ad on LinkedIn" sx={{ p: 0.25, color: "#0A66C2" }}>
                <LaunchIcon sx={{ fontSize: 12 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      ))}
    </Box>
  );
}

const EMPTY_GROUPS: PaginatedResponse<LinkedInCampaignGroup> =
  { items: [], total: 0, page: 1, page_size: 50, pages: 1 };
const EMPTY_CAMPAIGNS: PaginatedResponse<LinkedInCampaign> =
  { items: [], total: 0, page: 1, page_size: 50, pages: 1 };
const EMPTY_ADS: PaginatedResponse<LinkedInAdStat> =
  { items: [], total: 0, page: 1, page_size: 50, pages: 1 };

/** LinkedIn Ads campaign performance table with job title and company breakdowns. */
export default function LinkedInCampaigns() {
  const { get } = useApiClient();
  const [tab, setTab] = useState(0);

  // Campaign Groups state
  const [groupPage, setGroupPage] = useState(1);
  const [groupSort, setGroupSort] = useState<{ field: string; dir: "asc" | "desc" }>({ field: "group_status", dir: "asc" });
  const [groupColFilters, setGroupColFilters] = useState<Record<string, string>>({});
  const [groupDebouncedFilters, setGroupDebouncedFilters] = useState<Record<string, string>>({});

  // Campaigns state
  const [campPage, setCampPage] = useState(1);
  const [campSort, setCampSort] = useState<{ field: string; dir: "asc" | "desc" }>({ field: "campaign_start_date", dir: "desc" });
  const [campColFilters, setCampColFilters] = useState<Record<string, string>>({});
  const [campDebouncedFilters, setCampDebouncedFilters] = useState<Record<string, string>>({});

  // Ads state (the creatives inside campaigns, with attributed performance)
  const [adPage, setAdPage] = useState(1);

  // Debounce filters
  useEffect(() => {
    const t = setTimeout(() => { setGroupDebouncedFilters(groupColFilters); setGroupPage(1); }, 400);
    return () => clearTimeout(t);
  }, [groupColFilters]);

  useEffect(() => {
    const t = setTimeout(() => { setCampDebouncedFilters(campColFilters); setCampPage(1); }, 400);
    return () => clearTimeout(t);
  }, [campColFilters]);

  // Campaign groups — fetched only while their tab is open
  const groupParams = {
    page: groupPage, page_size: 50,
    sort_by: groupSort.field, sort_dir: groupSort.dir,
    ...Object.fromEntries(
      Object.entries(groupDebouncedFilters).filter(([, v]) => v).map(([k, v]) => [`cf_${k}`, v])
    ),
  };
  const groupQuery = useQuery({
    retry: 1, refetchOnMount: true,
    queryKey: ["isac", "linkedin-campaign-groups", groupParams],
    queryFn: () => get<PaginatedResponse<LinkedInCampaignGroup>>("/linkedin/campaign-groups", groupParams),
    enabled: tab === 0,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const groupData = groupQuery.data ?? EMPTY_GROUPS;
  const groupLoading = groupQuery.isFetching;

  // Campaigns total, fetched up front so the tab's count chip is right before the tab is opened
  const campCountParams = { page: 1, page_size: 1 };
  const campCountQuery = useQuery({
    retry: 1, refetchOnMount: true,
    queryKey: ["isac", "linkedin-campaigns", campCountParams],
    queryFn: () => get<PaginatedResponse<LinkedInCampaign>>("/linkedin/campaigns", campCountParams),
    staleTime: 60_000,
  });

  // Campaigns — fetched only while their tab is open
  const campParams = {
    page: campPage, page_size: 50,
    sort_by: campSort.field, sort_dir: campSort.dir,
    ...Object.fromEntries(
      Object.entries(campDebouncedFilters).filter(([, v]) => v).map(([k, v]) => [`cf_${k}`, v])
    ),
  };
  const campQuery = useQuery({
    retry: 1, refetchOnMount: true,
    queryKey: ["isac", "linkedin-campaigns", campParams],
    queryFn: () => get<PaginatedResponse<LinkedInCampaign>>("/linkedin/campaigns", campParams),
    enabled: tab === 1,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const campData = campQuery.data ?? campCountQuery.data ?? EMPTY_CAMPAIGNS;
  const campLoading = campQuery.isFetching;

  const chipSx = { fontWeight: FW.semibold, fontSize: FS.small, height: 20, ml: 0.5 };

  // Ads total, fetched up front so the tab's count chip is right before the tab is opened
  const adCountParams = { page: 1, page_size: 1 };
  const adCountQuery = useQuery({
    retry: 1, refetchOnMount: true,
    queryKey: ["isac", "linkedin-stats-ads", adCountParams],
    queryFn: () => get<PaginatedResponse<LinkedInAdStat>>("/linkedin/stats/ads", adCountParams),
    staleTime: 60_000,
  });

  // Ads — fetched only while their tab is open
  const adParams = { page: adPage, page_size: 50 };
  const adQuery = useQuery({
    retry: 1, refetchOnMount: true,
    queryKey: ["isac", "linkedin-stats-ads", adParams],
    queryFn: () => get<PaginatedResponse<LinkedInAdStat>>("/linkedin/stats/ads", adParams),
    enabled: tab === 2,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const adData = adQuery.data ?? EMPTY_ADS;
  const adLoading = adQuery.isFetching;
  const adTotal = adQuery.data?.total ?? adCountQuery.data?.total ?? 0;

  return (
    <Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={
          <Box sx={{ display: "flex", alignItems: "center" }}>
            Campaign Groups
            <Chip label={groupData.total} size="small" sx={chipSx} />
          </Box>
        } />
        <Tab label={
          <Box sx={{ display: "flex", alignItems: "center" }}>
            Campaigns
            <Chip label={campData.total} size="small" sx={chipSx} />
          </Box>
        } />
        <Tab label={
          <Box sx={{ display: "flex", alignItems: "center" }}>
            Ads
            <Chip label={adTotal} size="small" sx={chipSx} />
          </Box>
        } />
      </Tabs>

      {tab === 0 && (
        <DataTable
          spreadsheet
          columns={GROUP_COLUMNS}
          rows={groupData.items}
          total={groupData.total}
          page={groupData.page}
          pageSize={groupData.page_size}
          pages={groupData.pages}
          loading={groupLoading}
          onPageChange={setGroupPage}
          getRowKey={(r) => r.id}
          sortBy={groupSort.field}
          sortDir={groupSort.dir}
          onSort={(field, dir) => { setGroupSort({ field, dir }); setGroupPage(1); }}
          columnFilters={groupColFilters}
          onColumnFilter={(field, value) => setGroupColFilters(prev => ({ ...prev, [field]: value }))}
        />
      )}

      {tab === 1 && (
        <DataTable
          spreadsheet
          columns={CAMPAIGN_COLUMNS}
          rows={campData.items}
          total={campData.total}
          page={campData.page}
          pageSize={campData.page_size}
          pages={campData.pages}
          loading={campLoading}
          onPageChange={setCampPage}
          getRowKey={(r) => r.id}
          sortBy={campSort.field}
          sortDir={campSort.dir}
          onSort={(field, dir) => { setCampSort({ field, dir }); setCampPage(1); }}
          columnFilters={campColFilters}
          onColumnFilter={(field, value) => setCampColFilters(prev => ({ ...prev, [field]: value }))}
          renderExpanded={(r) => <CampaignAdsPanel campaignId={r.id} />}
        />
      )}

      {tab === 2 && (
        <DataTable
          spreadsheet
          columns={AD_COLS}
          rows={adData.items}
          total={adData.total}
          page={adData.page}
          pageSize={adData.page_size}
          pages={adData.pages}
          loading={adLoading}
          onPageChange={setAdPage}
          getRowKey={(r) => r.id}
        />
      )}
    </Box>
  );
}
