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

import { useState } from "react";
import { useNavigate } from "react-router";
import { Alert, Box } from "@wso2/oxygen-ui";
import SalesShell from "../components/SalesShell";
import { isSalesBackendConfigured } from "../api/useSalesData";
import { describeError, isForbidden } from "../util/salesError";
import DealFilters, { type OwnerOption } from "../meddpicc/components/DealFilters";
import DealsTable from "../meddpicc/components/DealsTable";
import { dealPath } from "../util/salesPaths";
import { isEchoBackendConfigured, useDeals, useMeddpiccGates } from "../meddpicc/api/useMeddpiccData";
import type { DealSummary } from "../meddpicc/types";

/** The owners seen so far, so filtering to one owner doesn't empty the list of owners. */
function mergeOwners(known: OwnerOption[], deals: DealSummary[] | undefined): OwnerOption[] {
  const byEmail = new Map(known.map((o) => [o.email, o]));
  for (const deal of deals ?? []) {
    if (deal.ownerEmail && !byEmail.has(deal.ownerEmail)) {
      byEmail.set(deal.ownerEmail, { email: deal.ownerEmail, name: deal.ownerName ?? deal.ownerEmail });
    }
  }
  return [...byEmail.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Sales — Deals: one row per Opportunity with its MEDDPICC state. A row opens the
 * deal's own page, where an AM checks the AI's Proposals and approves them to Salesforce.
 *
 * Served by the MEDDPICC backend, not meet-app. The Sales shell's access check
 * still asks meet-app, because it is the same sales team either way and the
 * rail already gates on that answer; the MEDDPICC backend enforces its own.
 * Either URL missing shows the shell's not-connected state for that key.
 */
export default function SalesDealsPage() {
  const meetAppConfigured = isSalesBackendConfigured();
  const echoConfigured = isEchoBackendConfigured();

  const [search, setSearch] = useState<string | null>(null);
  const [owner, setOwner] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [hideClosed, setHideClosed] = useState(true);
  const navigate = useNavigate();

  const gatesQuery = useMeddpiccGates();
  const dealsQuery = useDeals({ search, owner, stage, hideClosed });
  const deals = dealsQuery.data?.items ?? [];

  // Adjusted during render rather than in an effect, as MeetingFilters does.
  const [owners, setOwners] = useState<OwnerOption[]>([]);
  const [ownersFrom, setOwnersFrom] = useState<DealSummary[] | undefined>(undefined);
  if (dealsQuery.data?.items !== ownersFrom) {
    setOwnersFrom(dealsQuery.data?.items);
    setOwners(mergeOwners(owners, dealsQuery.data?.items));
  }

  const forbidden = isForbidden(dealsQuery.error);

  return (
    <SalesShell
      title="Deals"
      subtitle="MEDDPICC for every deal with a recorded call."
      configured={meetAppConfigured && echoConfigured}
      configKey={meetAppConfigured ? "ONE_WSO2_ECHO_BACKEND_URL" : "ONE_WSO2_REVOPS_BACKEND_URL"}
      configLabel={meetAppConfigured ? "the MEDDPICC backend URL" : undefined}
      forbidden={forbidden}
    >
      <Box>
        <DealFilters
          search={search}
          onSearchChange={setSearch}
          owner={owner}
          onOwnerChange={setOwner}
          owners={owners}
          stage={stage}
          onStageChange={setStage}
          stages={gatesQuery.data?.stages ?? []}
          hideClosed={hideClosed}
          onHideClosedChange={setHideClosed}
        />

        {dealsQuery.error && !forbidden && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {describeError(dealsQuery.error)}
          </Alert>
        )}

        <DealsTable
          deals={deals}
          loading={dealsQuery.isLoading || dealsQuery.isFetching}
          onOpenDeal={(id, letter) => void navigate(dealPath(id, letter))}
        />
      </Box>

    </SalesShell>
  );
}
