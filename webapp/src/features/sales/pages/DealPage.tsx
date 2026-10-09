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

import { Link as RouterLink, useParams, useSearchParams } from "react-router";
import { Box, Breadcrumbs, CircularProgress, Link, Stack, Typography } from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import SalesShell from "../components/SalesShell";
import { isSalesBackendConfigured } from "../api/useSalesData";
import { isForbidden } from "../util/salesError";
import DealView from "../meddpicc/components/DealView";
import { isEchoBackendConfigured, useDeal } from "../meddpicc/api/useMeddpiccData";
import type { LetterKey } from "../meddpicc/types";
import { LETTER_KEYS } from "../meddpicc/util/meddpiccFormat";

/**
 * One deal: its MEDDPICC, the AI's proposals with their evidence, and the approval that
 * writes them to Salesforce.
 *
 * A route, so a deal can be linked, bookmarked and refreshed, and so Back returns to
 * wherever it was opened from: the Deals list, a meeting, or the meetings table. The
 * Deals row stays lit in the rail, since this sits under /sales/deals.
 */
export default function DealPage() {
  const { opportunityId = "" } = useParams();
  const [params] = useSearchParams();
  const raw = params.get("letter");
  const letter = raw && (LETTER_KEYS as readonly string[]).includes(raw) ? (raw as LetterKey) : null;

  const meetAppConfigured = isSalesBackendConfigured();
  const echoConfigured = isEchoBackendConfigured();
  const query = useDeal(opportunityId || null);
  const name = query.data?.deal.name;

  return (
    <SalesShell
      title={name ?? "Deal"}
      configured={meetAppConfigured && echoConfigured}
      configKey={meetAppConfigured ? "ONE_WSO2_ECHO_BACKEND_URL" : "ONE_WSO2_REVOPS_BACKEND_URL"}
      configLabel={meetAppConfigured ? "the MEDDPICC backend URL" : undefined}
      forbidden={isForbidden(query.error)}
    >
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link component={RouterLink} to="/sales/deals" underline="hover" color="inherit">
          Deals
        </Link>
        <Typography color="text.primary" variant="body2">
          {name ?? "…"}
        </Typography>
      </Breadcrumbs>

      {query.isPending ? (
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", py: 2 }}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">
            Loading MEDDPICC…
          </Typography>
        </Stack>
      ) : query.isError ? (
        <Box sx={{ py: 1 }}>
          <ErrorNotice onRetry={() => void query.refetch()} error={query.error}>
            Couldn&apos;t load this deal.
          </ErrorNotice>
        </Box>
      ) : (
        // Keyed by deal and Letter, so moving to another deal starts from a clean draft
        // rather than carrying one deal's unsaved edits into the next.
        <DealView key={`${opportunityId}:${letter ?? ""}`} detail={query.data} initialLetter={letter} />
      )}
    </SalesShell>
  );
}
