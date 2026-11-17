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

import { Box, Tab, Tabs, Typography } from "@wso2/oxygen-ui";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { G2AccountIntent, PaginatedResponse, useApiClient } from "../api/client";
import DataTable, { ColumnDef } from "../components/DataTable";
import RegionFilter from "../components/RegionFilter";
import { C, F } from "../theme/pageTokens";
import { FS, FW } from "../theme/typeScale";



const PRODUCTS_LIST = ["WSO2 API Platform", "WSO2 Identity Platform", "WSO2 Integration Platform"];

const RAW_COLS: ColumnDef<G2AccountIntent>[] = [
  { key: "raw_company_name",             header: "Company" },
  { key: "company_domain",               header: "Domain" },
  { key: "company_country",              header: "Country" },
  { key: "company_employees",            header: "Employees" },
  { key: "buying_stage",                 header: "Stage" },
  { key: "activity_level",               header: "Activity" },
  { key: "last_seen",                    header: "Last Seen" },
  { key: "total_pageviews",              header: "Total PV" },
  { key: "product_profile_pageviews",    header: "Profile PV" },
  { key: "pricing_pageviews",            header: "Pricing PV" },
  { key: "comparison_pageviews",         header: "Compare PV" },
  { key: "competitors_pageviews",        header: "Competitor PV" },
  { key: "category_pageviews",           header: "Category PV" },
  { key: "competitive_signals",          header: "Comp. Signals" },
];

const EMPTY_PAGE: PaginatedResponse<G2AccountIntent> = { items: [], total: 0, page: 1, page_size: 50, pages: 1 };

/** G2 Intent Signals raw data table — browse row-level G2 buyer intent records per product. */
export default function G2Signals() {
  const { get } = useApiClient();

  const [rawTab, setRawTab] = useState(0);
  const [rawPage, setRawPage] = useState(1);
  const [rawSort, setRawSort] = useState<{ field: string; dir: "asc" | "desc" }>({ field: "last_seen", dir: "desc" });
  const [rawFilters, setRawFilters] = useState<Record<string, string>>({});
  const [rawDebounced, setRawDebounced] = useState<Record<string, string>>({});
  const [rawRegion, setRawRegion] = useState("");

  useEffect(() => {
    const t = setTimeout(() => { setRawDebounced(rawFilters); setRawPage(1); }, 400);
    return () => clearTimeout(t);
  }, [rawFilters]);

  /** Switch product tab: each product starts on page 1 with no column filters. */
  function handleTabChange(_: React.SyntheticEvent, v: number) {
    setRawTab(v);
    setRawPage(1);
    setRawFilters({});
    setRawDebounced({});
  }

  const cfParams = Object.fromEntries(
    Object.entries(rawDebounced).filter(([, v]) => v).map(([k, v]) => [`cf_${k}`, v])
  );
  const params = {
    page: rawPage, page_size: 50,
    sort_by: rawSort.field, sort_dir: rawSort.dir,
    cf_wso2_product: PRODUCTS_LIST[rawTab],
    ...cfParams,
    ...(rawRegion && { region: rawRegion }),
  };
  const query = useQuery({
    retry: 1, refetchOnMount: true,
    queryKey: ["isac", "g2-intent", params],
    queryFn: () => get<PaginatedResponse<G2AccountIntent>>("/g2/intent", params),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const rawData = query.data ?? EMPTY_PAGE;
  const rawLoading = query.isFetching;

  return (
    <Box sx={{ fontFamily: F, bgcolor: C.bg, minHeight: "100%" }}>

      {/* Header */}
      <Box sx={{ px: 2.5, py: 2, bgcolor: C.panel, borderBottom: `1px solid ${C.border}` }}>
        <Typography sx={{ fontFamily: F, fontSize: FS.title, fontWeight: FW.bold, color: C.text }}>
          G2 Intent Signals
        </Typography>
        <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.sub }}>
          Raw G2 buyer intent data — browse and filter by product, region, and activity
        </Typography>
      </Box>

      {/* Content */}
      <Box sx={{ p: 2.5 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
          <Tabs value={rawTab} onChange={handleTabChange}
            sx={{ "& .MuiTab-root": { textTransform: "none", fontFamily: F, fontSize: FS.body } }}>
            {PRODUCTS_LIST.map(p => <Tab key={p} label={p.replace("WSO2 ", "")} />)}
          </Tabs>
          <RegionFilter value={rawRegion} onChange={(r) => { setRawRegion(r); setRawPage(1); }} />
        </Box>
        <DataTable
          spreadsheet
          columns={RAW_COLS}
          rows={rawData.items}
          total={rawData.total}
          page={rawData.page}
          pageSize={rawData.page_size}
          pages={rawData.pages}
          loading={rawLoading}
          onPageChange={setRawPage}
          getRowKey={(r) => r.id}
          sortBy={rawSort.field}
          sortDir={rawSort.dir}
          onSort={(f, d) => { setRawSort({ field: f, dir: d }); setRawPage(1); }}
          columnFilters={rawFilters}
          onColumnFilter={(f, v) => setRawFilters((prev: Record<string, string>) => ({ ...prev, [f]: v }))}
        />
      </Box>
    </Box>
  );
}
