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

import { Box, Card, CardContent, MenuItem, Select, Tab, Tabs, TextField } from "@wso2/oxygen-ui";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import {
  LinkedInCompanyStat, LinkedInJobTitleStat,
  PaginatedResponse, useApiClient,
} from "../api/client";
import DataTable, { ColumnDef } from "../components/DataTable";
import RegionFilter from "../components/RegionFilter";
import { C } from "../theme/pageTokens";
import { FS, FW } from "../theme/typeScale";

const F = "'Inter', system-ui, sans-serif";

const JOB_TITLE_COLS: ColumnDef<LinkedInJobTitleStat>[] = [
  { key: "member_job_title", header: "Job Title" },
  { key: "campaign_name",    header: "Campaign" },
  { key: "report_date",      header: "Report Date" },
  { key: "campaign_status",  header: "Status" },
  { key: "impressions",      header: "Impressions" },
  { key: "clicks",           header: "Clicks" },
  { key: "total_spent",      header: "Spend" },
  { key: "cpc",              header: "CPC" },
  { key: "ctr",              header: "CTR" },
];

const COMPANY_COLS: ColumnDef<LinkedInCompanyStat>[] = [
  { key: "raw_company_name", header: "Company" },
  { key: "campaign_name",    header: "Campaign" },
  { key: "report_date",      header: "Report Date" },
  { key: "campaign_status",  header: "Status" },
  { key: "impressions",      header: "Impressions" },
  { key: "clicks",           header: "Clicks" },
  { key: "total_spent",      header: "Spend" },
  { key: "cpc",              header: "CPC" },
  { key: "ctr",              header: "CTR" },
];

interface CampaignOption {
  id: number;
  name: string;
}

const filterBoxSx = () => ({
  display: "flex", alignItems: "center", gap: 0.6,
  px: 1.2, py: 0.4, borderRadius: "7px", height: 32,
  bgcolor: C.card, border: `1px solid ${C.border}`,
  transition: "border-color 0.15s",
  "&:hover": { borderColor: C.orange },
});

const selectSx = (hasValue: boolean) => ({
  fontFamily: F,
  fontSize: FS.body,
  fontWeight: hasValue ? FW.semibold : FW.regular,
  color: hasValue ? C.text : C.sub,
  minWidth: 140,
  "& .MuiSelect-select": { py: 0, pr: "20px !important" },
  "& .MuiSelect-icon": { color: hasValue ? C.orange : C.dim, fontSize: 16 },
});

const dateFieldSx = () => ({
  "& .MuiInputBase-root": {
    fontFamily: F, fontSize: FS.body, height: 28,
    bgcolor: C.card, borderRadius: "7px",
    "& fieldset": { borderColor: C.border },
    "&:hover fieldset": { borderColor: C.orange },
  },
  "& .MuiInputBase-input": { py: 0.4, px: 1 },
  width: 140,
});

const EMPTY_JOB_TITLES: PaginatedResponse<LinkedInJobTitleStat> =
  { items: [], total: 0, page: 1, page_size: 50, pages: 1 };
const EMPTY_COMPANIES: PaginatedResponse<LinkedInCompanyStat> =
  { items: [], total: 0, page: 1, page_size: 50, pages: 1 };

/** LinkedIn Ads analytics dashboard — displays ad performance metrics pivoted by job title and company. */
export default function LinkedInStats() {
  const { get } = useApiClient();
  const [tab, setTab] = useState(0);

  // Shared filters
  const [campaignId, setCampaignId] = useState<number | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);

  // Job title state
  const [jtPage, setJtPage] = useState(1);
  const [jtSort, setJtSort] = useState<{ field: string; dir: "asc" | "desc" }>({ field: "report_date", dir: "desc" });
  const [jtFilters, setJtFilters] = useState<Record<string, string>>({});
  const [jtDebounced, setJtDebounced] = useState<Record<string, string>>({});

  // Company state
  const [coPage, setCoPage] = useState(1);
  const [coSort, setCoSort] = useState<{ field: string; dir: "asc" | "desc" }>({ field: "report_date", dir: "desc" });
  const [coFilters, setCoFilters] = useState<Record<string, string>>({});
  const [coDebounced, setCoDebounced] = useState<Record<string, string>>({});

  const [region, setRegion] = useState("");

  // Load campaign options
  useEffect(() => {
    get<CampaignOption[]>("/linkedin/stats/campaigns").then(setCampaigns);
  }, [get]);

  // Debounce column filters
  useEffect(() => {
    const t = setTimeout(() => { setJtDebounced(jtFilters); setJtPage(1); }, 400);
    return () => clearTimeout(t);
  }, [jtFilters]);

  useEffect(() => {
    const t = setTimeout(() => { setCoDebounced(coFilters); setCoPage(1); }, 400);
    return () => clearTimeout(t);
  }, [coFilters]);

  /** Both tabs go back to page 1 whenever a shared filter changes. */
  function resetPages() { setJtPage(1); setCoPage(1); }

  // Job title data — fetched only while its tab is open
  const jtParams = {
    page: jtPage, page_size: 50,
    sort_by: jtSort.field, sort_dir: jtSort.dir,
    ...(campaignId && { campaign_id: campaignId }),
    ...(dateFrom && { date_from: dateFrom }),
    ...(dateTo && { date_to: dateTo }),
    ...Object.fromEntries(
      Object.entries(jtDebounced).filter(([, v]) => v).map(([k, v]) => [`cf_${k}`, v])
    ),
  };
  const jtQuery = useQuery({
    retry: 1, refetchOnMount: true,
    queryKey: ["isac", "linkedin-stats-job-title", jtParams],
    queryFn: () => get<PaginatedResponse<LinkedInJobTitleStat>>("/linkedin/stats/job-title", jtParams),
    enabled: tab === 0,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const jtData = jtQuery.data ?? EMPTY_JOB_TITLES;

  // Company data — fetched only while its tab is open
  const coParams = {
    page: coPage, page_size: 50,
    sort_by: coSort.field, sort_dir: coSort.dir,
    ...(campaignId && { campaign_id: campaignId }),
    ...(dateFrom && { date_from: dateFrom }),
    ...(dateTo && { date_to: dateTo }),
    ...(region && { region }),
    ...Object.fromEntries(
      Object.entries(coDebounced).filter(([, v]) => v).map(([k, v]) => [`cf_${k}`, v])
    ),
  };
  const coQuery = useQuery({
    retry: 1, refetchOnMount: true,
    queryKey: ["isac", "linkedin-stats-company", coParams],
    queryFn: () => get<PaginatedResponse<LinkedInCompanyStat>>("/linkedin/stats/company", coParams),
    enabled: tab === 1,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const coData = coQuery.data ?? EMPTY_COMPANIES;

  // One loading flag for whichever tab is showing
  const loading = tab === 0 ? jtQuery.isFetching : coQuery.isFetching;

  return (
    <Box>
      <Card sx={{ borderRadius: "2px" }}>
        <CardContent>
          {/* Tabs + Filters row */}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 1.5 }}>
            <Tabs value={tab} onChange={(_: React.SyntheticEvent, v: number) => setTab(v)} sx={{ "& .MuiTab-root": { textTransform: "none" } }}>
              <Tab label="By Job Title" />
              <Tab label="By Company" />
            </Tabs>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              {/* Campaign filter */}
              <Box sx={filterBoxSx()}>
                <Select
                  value={campaignId}
                  onChange={(e) => { setCampaignId(e.target.value as number | ""); resetPages(); }}
                  variant="standard"
                  disableUnderline
                  displayEmpty
                  sx={selectSx(!!campaignId)}
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        bgcolor: C.panel, color: C.text, fontFamily: F,
                        borderRadius: "8px", border: `1px solid ${C.border}`,
                        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                        maxHeight: 320,
                      },
                    },
                  }}
                  renderValue={(v) => {
                    if (!v) return "All Campaigns";
                    const c = campaigns.find((c) => c.id === v);
                    const name = c?.name || "";
                    return name.length > 35 ? name.slice(0, 35) + "..." : name;
                  }}
                >
                  <MenuItem value="" sx={{ fontFamily: F, fontSize: FS.body }}>All Campaigns</MenuItem>
                  {campaigns.map((c) => (
                    <MenuItem key={c.id} value={c.id} sx={{ fontFamily: F, fontSize: FS.body }}>
                      {c.name}
                    </MenuItem>
                  ))}
                </Select>
              </Box>

              {/* Date range */}
              <TextField
                type="date"
                size="small"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); resetPages(); }}
                sx={dateFieldSx()}
                InputLabelProps={{ shrink: true }}
                placeholder="From"
                inputProps={{ title: "From date" }}
              />
              <Box sx={{ color: C.sub, fontSize: FS.body }}>to</Box>
              <TextField
                type="date"
                size="small"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); resetPages(); }}
                sx={dateFieldSx()}
                InputLabelProps={{ shrink: true }}
                placeholder="To"
                inputProps={{ title: "To date" }}
              />

              {/* Region (company tab only) */}
              {tab === 1 && <RegionFilter value={region} onChange={(r) => { setRegion(r); setCoPage(1); }} />}
            </Box>
          </Box>

          {tab === 0 && (
            <DataTable
              spreadsheet
              columns={JOB_TITLE_COLS}
              rows={jtData.items}
              total={jtData.total}
              page={jtData.page}
              pageSize={jtData.page_size}
              pages={jtData.pages}
              loading={loading}
              onPageChange={setJtPage}
              getRowKey={(r) => r.id}
              sortBy={jtSort.field}
              sortDir={jtSort.dir}
              onSort={(f, d) => { setJtSort({ field: f, dir: d }); setJtPage(1); }}
              columnFilters={jtFilters}
              onColumnFilter={(f, v) => setJtFilters((prev: Record<string, string>) => ({ ...prev, [f]: v }))}
            />
          )}
          {tab === 1 && (
            <DataTable
              spreadsheet
              columns={COMPANY_COLS}
              rows={coData.items}
              total={coData.total}
              page={coData.page}
              pageSize={coData.page_size}
              pages={coData.pages}
              loading={loading}
              onPageChange={setCoPage}
              getRowKey={(r) => r.id}
              sortBy={coSort.field}
              sortDir={coSort.dir}
              onSort={(f, d) => { setCoSort({ field: f, dir: d }); setCoPage(1); }}
              columnFilters={coFilters}
              onColumnFilter={(f, v) => setCoFilters((prev: Record<string, string>) => ({ ...prev, [f]: v }))}
            />
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
