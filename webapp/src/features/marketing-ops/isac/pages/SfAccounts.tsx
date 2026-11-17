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

import { Box, Button, InputAdornment, TextField } from "@wso2/oxygen-ui";
import { Search as SearchIcon } from "../icons";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PaginatedResponse, SfAccount, useApiClient } from "../api/client";
import DataTable, { ColumnDef } from "../components/DataTable";
import RegionFilter from "../components/RegionFilter";
import { C, F } from "../theme/pageTokens";
import { FS, FW } from "../theme/typeScale";

/** Every SF-pulled column with its exact Salesforce API field (hover tooltip). */
const COLUMNS: ColumnDef<SfAccount>[] = [
  { key: "raw_company_name",    header: "Account Name",          sfField: "Account.Name" },
  { key: "account_owner",       header: "Account Owner",         sfField: "Account.Owner.Name" },
  { key: "account_record_type", header: "Type",                  sfField: "Account.Type" },
  { key: "account_life_cycle",  header: "Account Lifecycle",     sfField: "Account_Status__c" },
  { key: "rating",              header: "Rating",                sfField: "Account.Rating" },
  { key: "arr_current",         header: "ARR (Current)",         sfField: "ARR_Now__c" },
  { key: "won_value",           header: "Closed-Won Value",      sfField: "Closed_Won_Opportunity_Value_New__c" },
  { key: "open_opps",           header: "Open Opportunities",    sfField: "Number_of_Open_Opps__c" },
  { key: "activation_date",     header: "Customer Since",        sfField: "Activation_Date__c" },
  { key: "customer_lifetime",   header: "Customer Lifetime (yrs)", sfField: "Customer_Lifetime__c" },
  { key: "lost_date",           header: "Lost Date",             sfField: "Lost_Date__c" },
  { key: "lost_reason",         header: "Lost Reason",           sfField: "Lost_Reason__c" },
  { key: "products_use",        header: "Products in Use",       sfField: "Products_Use__c" },
  { key: "domain_list",         header: "Domain List",           sfField: "Domain_list__c" },
  { key: "naics_industry",      header: "NAICS Industry",        sfField: "NAICS_Industry__c" },
  { key: "region_bucket",       header: "Sub-Region",            sfField: "Sub_Region__c" },
  { key: "billing_state",       header: "Billing State/Province", sfField: "Account.BillingState" },
  { key: "billing_country",     header: "Billing Country",       sfField: "Account.BillingCountry" },
  { key: "business_model",      header: "Business Model",        sfField: "Business_Model__c" },
  { key: "partner_type",        header: "Partner Level",         sfField: "Partner_Level__c" },
  { key: "partner_status",      header: "Partner Status",        sfField: "Partner_Status__c" },
  { key: "last_activity",       header: "Last Activity",     sfField: "Internal — legacy import field; not populated by the API feed" },
  { key: "last_modified_date",  header: "Last Modified Date", sfField: "Internal — legacy import field; not populated by the API feed" },
];

const EMPTY_PAGE: PaginatedResponse<SfAccount> = { items: [], total: 0, page: 1, page_size: 50, pages: 1 };

/** Salesforce accounts table with pagination and search. */
export default function SfAccounts() {
  const { get } = useApiClient();
  const [page, setPage] = useState(1);
  // Typed vs committed search — committed on the Search button / Enter.
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  // Default to name A–Z: the old default (last_activity, a legacy CSV-only
  // field the API feed never fills) sank every API-synced account to the
  // bottom of the table, which read as "account missing".
  const [sort, setSort] = useState<{ field: string; dir: "asc" | "desc" }>({ field: "raw_company_name", dir: "asc" });
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
    ...(search && { search }),
  };
  const query = useQuery({
    retry: 1, refetchOnMount: true,
    queryKey: ["isac", "sf-accounts", params],
    queryFn: () => get<PaginatedResponse<SfAccount>>("/sf-accounts", params),
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

  /** Commit the typed search term (Search button / Enter). */
  function commitSearch() { setSearch(searchInput.trim()); setPage(1); }

  return (
    <Box>
      <Box sx={{ mb: 1.5, px: 0.5, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <TextField size="small" placeholder="Search account name or Salesforce ID…"
          inputProps={{ name: "search-sf-accounts", id: "search-sf-accounts" }} value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            if (e.target.value === "" && search) { setSearch(""); setPage(1); }
          }}
          onKeyDown={(e) => { if (e.key === "Enter") commitSearch(); }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 14, color: C.dim }} /></InputAdornment> }}
          sx={{ width: 320, "& .MuiInputBase-root": { fontFamily: F, fontSize: FS.body, borderRadius: "7px", height: 32, bgcolor: C.cardBg, color: C.text, "& fieldset": { borderColor: C.borderSoft }, "&:hover fieldset": { borderColor: C.border }, "&.Mui-focused fieldset": { borderColor: C.orange } }, "& .MuiInputBase-input::placeholder": { color: C.dim, opacity: 1 } }} />
        <Button size="small" variant="contained" disableElevation onClick={commitSearch}
          sx={{ textTransform: "none", fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, borderRadius: "7px", height: 32, minWidth: 64, bgcolor: C.orange, "&:hover": { bgcolor: C.orangeDark } }}>
          Search
        </Button>
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
