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

import { Box } from "@wso2/oxygen-ui";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PaginatedResponse, PardotSnapshot, useApiClient } from "../api/client";
import DataTable, { ColumnDef } from "../components/DataTable";
import RegionFilter from "../components/RegionFilter";

const COLUMNS: ColumnDef<PardotSnapshot>[] = [
  { key: "raw_account_name",             header: "Name" },
  { key: "assigned_user",                header: "Assigned User" },
  { key: "prospects_count",              header: "Prospects" },
  { key: "last_activity_at",             header: "Last Activity" },
  { key: "iam_total",                    header: "IAM Activities Total" },
  { key: "iam_avg",                      header: "IAM Activities Average" },
  { key: "bfsi_total",                   header: "BFSI Activities Total" },
  { key: "bfsi_avg",                     header: "BFSI Activities Average" },
  { key: "oh_total",                     header: "OH Activities Total" },
  { key: "oh_avg",                       header: "OH Activities Average" },
  { key: "oem_total",                    header: "OEM Activities Total" },
  { key: "oem_avg",                      header: "OEM Activities Average" },
  { key: "integration_total",            header: "Integration Activities Total" },
  { key: "integration_avg",              header: "Integration Activities Average" },
  { key: "content_syndication_total",    header: "Content Syndication Total" },
  { key: "content_syndication_avg",      header: "Content Syndication Average" },
  { key: "external_events_total",        header: "External Events Total" },
  { key: "external_events_avg",          header: "External Events Average" },
  { key: "webinar_total",                header: "Webinar Activities Total" },
  { key: "webinar_avg",                  header: "Webinar Activities Average" },
  { key: "drift_engagement_total",       header: "Drift Engagement Total" },
  { key: "drift_engagement_avg",         header: "Drift Engagement Average" },
  { key: "sdr_interaction_total",        header: "SDR Interaction Total" },
  { key: "sdr_interaction_avg",          header: "SDR Interaction Average" },
  { key: "contact_us_total",             header: "Contact Us Submission Total" },
  { key: "contact_us_avg",               header: "Contact Us Submission Average" },
  { key: "analyst_report_total",         header: "Analyst Report Total" },
  { key: "analyst_report_avg",           header: "Analyst Report Average" },
  { key: "content_wp_ebook_total",       header: "Content (WP,ebook) Activity Total" },
  { key: "content_wp_ebook_avg",         header: "Content (WP,ebook) Activity Average" },
  { key: "internal_events_total",        header: "Internal Events Total" },
  { key: "internal_events_avg",          header: "Internal Events Average" },
  { key: "choreo_total",                 header: "Choreo Activity Total" },
  { key: "choreo_avg",                   header: "Choreo Activity Average" },
  { key: "asgardeo_total",               header: "Asgardeo Activity Total" },
  { key: "asgardeo_avg",                 header: "Asgardeo Activity Average" },
  { key: "ballerina_total",              header: "Ballerina Activity Total" },
  { key: "ballerina_avg",                header: "Ballerina Activity Average" },
  { key: "pricing_request_total",        header: "Pricing Request Total" },
  { key: "pricing_request_avg",          header: "Pricing Request Average" },
  { key: "training_cert_total",          header: "Training and Certification Total" },
  { key: "training_cert_avg",            header: "Training and Certification Average" },
  { key: "score_reset_total",            header: "Score Reset Total" },
  { key: "score_reset_avg",              header: "Score Reset Average" },
  { key: "high_intent_page_visit_total", header: "High Intent Page Visit Total" },
  { key: "high_intent_page_visit_avg",   header: "High Intent Page Visit Average" },
];

const EMPTY_PAGE: PaginatedResponse<PardotSnapshot> = { items: [], total: 0, page: 1, page_size: 50, pages: 1 };

/** Pardot account snapshot history table with pagination and search. */
export default function PardotSnapshots() {
  const { get } = useApiClient();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ field: string; dir: "asc" | "desc" }>({ field: "snapshot_date", dir: "desc" });
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const [debouncedFilters, setDebouncedFilters] = useState<Record<string, string>>({});
  const [region, setRegion] = useState("");

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedFilters(colFilters); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [colFilters]);

  const cfParams = Object.fromEntries(
    Object.entries(debouncedFilters).filter(([, v]) => v).map(([k, v]) => [`cf_${k}`, v])
  );
  const params = {
    page, page_size: 50,
    sort_by: sort.field, sort_dir: sort.dir,
    ...cfParams,
    ...(region && { region }),
  };
  const query = useQuery({
    retry: 1, refetchOnMount: true,
    queryKey: ["isac", "pardot-snapshots", params],
    queryFn: () => get<PaginatedResponse<PardotSnapshot>>("/pardot-snapshots", params),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const data = query.data ?? EMPTY_PAGE;
  const loading = query.isFetching;

  function handleSort(field: string, dir: "asc" | "desc") {
    setSort({ field, dir });
    setPage(1);
  }

  function handleColFilter(field: string, value: string) {
    setColFilters((prev: Record<string, string>) => ({ ...prev, [field]: value }));
  }

  return (
    <Box>
      <Box sx={{ mb: 1.5, px: 0.5, display: "flex", alignItems: "center" }}>
        <RegionFilter value={region} onChange={(r) => { setRegion(r); setPage(1); }} />
      </Box>
      <DataTable
        spreadsheet
        columns={COLUMNS}
        rows={data.items}
        total={data.total}
        page={data.page}
        pageSize={data.page_size}
        pages={data.pages}
        loading={loading}
        onPageChange={setPage}
        getRowKey={(r) => r.id}
        sortBy={sort.field}
        sortDir={sort.dir}
        onSort={handleSort}
        columnFilters={colFilters}
        onColumnFilter={handleColFilter}
      />
    </Box>
  );
}
