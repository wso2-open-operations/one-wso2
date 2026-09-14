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

import { useMemo } from "react";
import { misArrServiceUrls } from "@config/apiConfig";
import type { DrillDownCustomer } from "../components/drillDownColumns";
import type { DrillDownRequest } from "./misDrillDownRequest";
import { arrayIn } from "./misResponseArray";
import { useColumnQueries } from "./useColumnQueries";

// `POST /arr-summary/customers` — the customers behind one figure in the Build.
//
// ONE request, not one per column, which is why this reads oddly beside its two
// neighbours: `useColumnQueries` takes a LIST of bodies and this passes a list
// of one. That is the right trade rather than a fresh hook — everything the
// drill-down needs from it is the part that has nothing to do with columns: the
// body as the cache key, the sub-scoping, `httpRetry`, `humanizeHttpError`, the
// identity-error fold, and the clean idle state when there is nothing to ask.
//
// `null` request means the dialog is shut: no body, no query, no fetch. That
// yields the engine's idle state — except when the SUBJECT itself has failed,
// which is reported ahead of it. Harmless here because the page unmounts the
// dialog when nothing is open, but worth knowing before reading this state
// anywhere else.
//
// ---- the source's error handling is BROKEN, and this does not copy it -------
//
// Three times over. `http.js:65` hands the failure callback a STRING, so
// `useArrSummaryCustomers.js:52` reading `err?.message` off it always falls
// through to the literal 'Failed'; and `DataGrid.js:911` never destructures
// `error` at all, so the dialog has no error prop and no error state. A failed
// drill-down there renders an EMPTY GRID, indistinguishable from "no customers
// matched" — on a screen whose whole purpose is to explain a figure. The
// backend does send a usable message. This surfaces it. Recorded as a
// deliberate divergence in `docs/ported-apps/mis.md` §7.

export interface DrillDownState {
  customers: DrillDownCustomer[];
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  retry: () => void;
}

export function useDrillDownCustomers(request: DrillDownRequest | null): DrillDownState {
  const bodies = useMemo(() => (request ? [request] : []), [request]);

  const state = useColumnQueries({
    name: "arr-summary-customers",
    url: misArrServiceUrls.drillDownCustomers,
    bodies,
    // No labels: this has one "column" and it is never shown — the dialog heads
    // its columns by field, not by Period.
    parse: arrayIn<DrillDownCustomer>,
  });

  return {
    customers: state.columns[0]?.data ?? [],
    isLoading: state.isLoading,
    isError: state.isError,
    errorMessage: state.errorMessage,
    retry: state.retry,
  };
}
