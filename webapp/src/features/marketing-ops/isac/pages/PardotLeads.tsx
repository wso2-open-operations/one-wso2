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
import { PaginatedResponse, PardotLead, useApiClient } from "../api/client";
import DataTable, { ColumnDef } from "../components/DataTable";
import RegionFilter from "../components/RegionFilter";

/** Every SF-pulled column with its exact Salesforce API field (hover tooltip);
 * derived columns explain their derivation instead. */
const COLUMNS: ColumnDef<PardotLead>[] = [
  { key: "email",            header: "Email",           sfField: "Lead.Email" },
  { key: "first_name",       header: "First Name",      sfField: "Lead.FirstName" },
  { key: "last_name",        header: "Last Name",       sfField: "Lead.LastName" },
  { key: "raw_company_name", header: "Company",         sfField: "Lead.Company" },
  { key: "job_title",        header: "Job Title",       sfField: "Lead.Title" },
  { key: "job_role",         header: "Job Role",        sfField: "Job_Role__c" },
  { key: "pardot_score",     header: "Pardot Score",    sfField: "pi__score__c" },
  { key: "grade",            header: "Grade",           sfField: "pi__grade__c" },
  { key: "source",           header: "Source",          sfField: "Derived — resolved from Lead_Source_Details__c → Sub_Channel__c → LeadSource → Lead_Channel__c" },
  { key: "lead_source",      header: "Lead Source (raw)",     sfField: "Lead.LeadSource" },
  { key: "sub_channel",      header: "Sub Channel (raw)",     sfField: "Sub_Channel__c" },
  { key: "lead_source_details", header: "Source Details (raw)", sfField: "Lead_Source_Details__c" },
  { key: "lead_channel",     header: "Lead Channel (raw)",    sfField: "Lead_Channel__c" },
  { key: "lead_status",      header: "Status",          sfField: "Lead.Status" },
  { key: "lead_stage",       header: "Funnel Stage",    sfField: "Derived — from status, MQL/SQL dates and conversion" },
  { key: "lead_type",        header: "Lead Type",       sfField: "Lead_Type__c" },
  { key: "mql_at",           header: "MQL Date",        sfField: "MQL_Date__c" },
  { key: "sal_at",           header: "SAL Date",        sfField: "SAL_Date__c" },
  { key: "sql_at",           header: "SQL Date",        sfField: "SQL_Date__c" },
  { key: "is_converted",     header: "Converted",       sfField: "Lead.IsConverted", render: (r) => r.is_converted ? "Yes" : "No" },
  { key: "last_responded_campaign", header: "Last Responded Campaign", sfField: "Last_Responded_Campaign__c" },
  { key: "country",          header: "Country",         sfField: "Lead.Country (fallback Geo_IP_Country__c)" },
  { key: "region",           header: "Region",          sfField: "Derived — from country" },
  { key: "city",             header: "City",            sfField: "Lead.City" },
  { key: "state",            header: "State",           sfField: "Lead.State" },
  { key: "zip",              header: "Zip",             sfField: "Lead.PostalCode" },
  { key: "phone",            header: "Phone",           sfField: "Lead.Phone (fallback MobilePhone)" },
  { key: "linkedin_url",     header: "LinkedIn",        sfField: "LinkedIn_Profile__c" },
  { key: "website",          header: "Website",         sfField: "Lead.Website" },
  { key: "industry",         header: "Industry",        sfField: "Lead.Industry" },
  { key: "annual_revenue",   header: "Annual Revenue",  sfField: "Lead.AnnualRevenue" },
  { key: "employees",        header: "Employees",       sfField: "Lead.NumberOfEmployees" },
  { key: "rating",           header: "Rating",          sfField: "Lead.Rating" },
  { key: "do_not_email",     header: "Do Not Email",    sfField: "Lead.HasOptedOutOfEmail", render: (r) => r.do_not_email ? "Yes" : "No" },
  { key: "created_date",     header: "Created Date",    sfField: "Lead.CreatedDate" },
  { key: "updated_date",     header: "Updated Date",    sfField: "Lead.LastModifiedDate" },
  { key: "last_activity_at", header: "Last Activity",   sfField: "Lead.LastActivityDate" },
  { key: "assigned_user",    header: "Owner",           sfField: "Lead.Owner.Name" },
  { key: "campaign",         header: "Campaign (legacy)", sfField: "Lead.Status (legacy back-compat mapping)" },
  { key: "crm_lead_fid",     header: "SF Lead ID",      sfField: "Lead.Id" },
  { key: "crm_contact_fid",  header: "SF Contact ID",   sfField: "SFDC_Existing_Contact__c" },
  { key: "prospect_id",      header: "Prospect Id" },
  { key: "do_not_call",      header: "Do Not Call",  render: (r) => r.do_not_call  ? "Yes" : "No" },
  { key: "opted_out",        header: "Opted Out",    render: (r) => r.opted_out    ? "Yes" : "No" },
  { key: "referrer",         header: "Referrer" },
  { key: "first_assigned",   header: "First Assigned" },
];

const EMPTY_PAGE: PaginatedResponse<PardotLead> = { items: [], total: 0, page: 1, page_size: 50, pages: 1 };

/** Pardot marketing leads table with pagination and search. */
export default function PardotLeads() {
  const { get } = useApiClient();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ field: string; dir: "asc" | "desc" }>({ field: "last_activity_at", dir: "desc" });
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
    queryKey: ["isac", "pardot-leads", params],
    queryFn: () => get<PaginatedResponse<PardotLead>>("/pardot-leads", params),
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
