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
import { Certification, PaginatedResponse, useApiClient } from "../api/client";
import DataTable, { ColumnDef } from "../components/DataTable";
import RegionFilter from "../components/RegionFilter";

/** Every SF-pulled column with its exact Salesforce API field (hover tooltip). */
const COLUMNS: ColumnDef<Certification>[] = [
  { key: "token",            header: "Certification Token", sfField: "Contact__r.Certification_ID__c" },
  { key: "cert_type",        header: "Type",                sfField: "Certification__c.Type__c" },
  { key: "raw_company_name", header: "Person / Account",    sfField: "Derived — Contact__r.FirstName + Contact__r.LastName" },
  { key: "contact_email",    header: "Contact Email",       sfField: "Contact__r.Email" },
  { key: "is_awarded",       header: "Awarded",             sfField: "Certification_Awarded__c", render: (r) => r.is_awarded ? "Yes" : "No" },
  { key: "awarded_date",     header: "Awarded Date",        sfField: "Certification_Awarded_Date__c" },
];

const EMPTY_PAGE: PaginatedResponse<Certification> = { items: [], total: 0, page: 1, page_size: 50, pages: 1 };

/** WSO2 certification records table with pagination and search. */
export default function Certifications() {
  const { get } = useApiClient();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ field: string; dir: "asc" | "desc" }>({ field: "awarded_date", dir: "desc" });
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
    queryKey: ["isac", "certifications", params],
    queryFn: () => get<PaginatedResponse<Certification>>("/certifications", params),
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
