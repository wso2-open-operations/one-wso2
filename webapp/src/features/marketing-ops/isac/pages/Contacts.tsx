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

import { Search as SearchIcon } from "../icons";
import { Box, InputAdornment, TextField } from "@wso2/oxygen-ui";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Contact, PaginatedResponse, useApiClient } from "../api/client";
import DataTable, { ColumnDef } from "../components/DataTable";

const COLUMNS: ColumnDef<Contact>[] = [
  { key: "first_name", header: "First Name" },
  { key: "last_name",  header: "Last Name" },
  { key: "email",      header: "Email" },
  { key: "job_title",  header: "Job Title" },
  { key: "department", header: "Department" },
  { key: "country",    header: "Country" },
  { key: "source",     header: "Source" },
];

const EMPTY_PAGE: PaginatedResponse<Contact> = { items: [], total: 0, page: 1, page_size: 20, pages: 1 };

/** Paginated contact list with search and column sorting. */
export default function Contacts() {
  const { get } = useApiClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const params = { page, page_size: 20, search: search || undefined };
  const query = useQuery({
    retry: 1, refetchOnMount: true,
    queryKey: ["isac", "contacts", params],
    queryFn: () => get<PaginatedResponse<Contact>>("/contacts", params),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const data = query.data ?? EMPTY_PAGE;
  const loading = query.isFetching;

  return (
    <Box>
      <Box mb={2}>
        <TextField
          size="small"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          sx={{ width: 320 }}
        />
      </Box>
      <DataTable
        columns={COLUMNS}
        rows={data.items}
        total={data.total}
        page={data.page}
        pageSize={data.page_size}
        pages={data.pages}
        loading={loading}
        onPageChange={setPage}
        getRowKey={(r) => r.id}
      />
    </Box>
  );
}
