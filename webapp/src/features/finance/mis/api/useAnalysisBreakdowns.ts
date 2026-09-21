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
import type { MisCivilDate } from "../util/misPacificTime";
import type { MisAnalysisFilters } from "../util/misAnalysisFilters";
import { analysisIndustryRequests, analysisPartnerModelRequests } from "./misAnalysisRequest";
import { useColumnQueries } from "./useColumnQueries";
import { figureIn } from "./useAnalysisAccounts";

// The two breakdowns above the account table, each several reads of the same
// endpoint.
//
// `POST /exit-arr/search` answers with a bare `decimal` and takes one cut per
// call, so a breakdown is not one request returning a series — it is N requests
// returning one figure each. `useColumnQueries` is what fans them out: every
// body is its own cache key, they go in parallel, and a failing one blanks only
// itself.
//
// ---- that last part is a DEVIATION, not the source's behaviour -------------
//
// The source's `Promise.allSettled` is over its FOUR fetches
// (`ArrAnalysisDashboard.js:770-777`), so the table surviving a failed chart is
// its behaviour. Inside each breakdown it is `Promise.all`
// (`arrAnalysisApi.js:254`, `:299`), so **one failing industry read rejects the
// whole breakdown**: `setIndustryBreakdown([])` leaves all six reading as zero,
// under a page-level error banner. Six industries silently worth nothing
// because one request fell over is the same false claim this screen is built to
// refuse, one level up. Here the other five keep their figures and the one that
// failed says so. Recorded in spec §7.
//
// ---- what these hooks return, and what they deliberately do not ------------
//
// Neither returns zeros for the calls it did not make. `useAnalysisIndustries`
// hands back the set of industries it ASKED about beside the amounts, and
// `industrySeries` draws no bar for the rest — see `analysisBreakdowns.ts` for
// why a zero and an absence are different answers on this chart.

/** One partner model's figure, or its absence. */
export interface PartnerModelBreakdown {
  channel?: number;
  direct?: number;
  /**
   * Which models were asked about — one when the reader has narrowed, two
   * otherwise.
   *
   * Carried for the same reason the industry breakdown carries its own: an
   * absent figure means "not asked" or "asked and failed", and only the first
   * of those makes the other model's 100% true.
   */
  asked: Set<string>;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  retry: () => void;
}

/**
 * The Channel/Direct split — two reads, or one when the reader has already
 * narrowed to a model.
 *
 * The side that was not asked about stays `undefined` rather than becoming `0`.
 * The source sets it to `0` (`arrAnalysisApi.js:230-248`), which is correct
 * arithmetic for a filtered view — a Channel-only view really does hold no
 * Direct ARR — but indistinguishable from a read that FAILED, which is the one
 * case where drawing the survivor at 100% states something false. `asked` is
 * what separates them, and `partnerModelSlices` refuses the split rather than
 * drawing half of one.
 */
export function useAnalysisPartnerModels(
  filters: MisAnalysisFilters,
  today: MisCivilDate,
  enabled = true,
): PartnerModelBreakdown {
  const calls = useMemo(
    () => analysisPartnerModelRequests(filters, today),
    [filters, today],
  );
  const bodies = useMemo(() => calls.map((call) => call.body), [calls]);

  const state = useColumnQueries({
    name: "analysis-partner-model",
    url: misArrServiceUrls.exitArrSearch,
    bodies,
    // The model name, so a column can be found by what it asked rather than by
    // its position — the list is one or two depending on the filter.
    labels: calls.map((call) => call.model),
    parse: figureIn,
    enabled,
  });

  const figureFor = (model: string) =>
    state.columns.find((column) => column.label === model)?.data;

  return {
    channel: figureFor("Channel"),
    direct: figureFor("Direct"),
    asked: new Set(calls.map((call) => call.model)),
    isLoading: state.isLoading,
    isError: state.isError,
    errorMessage: state.errorMessage,
    retry: state.retry,
  };
}

export interface IndustryBreakdown {
  /** Amount per industry, for the industries that were asked about. */
  byIndustry: Record<string, number | undefined>;
  /**
   * Which of the chart's six reached the backend at all.
   *
   * Carried rather than inferred from `byIndustry`, because an industry that
   * WAS asked about and answered zero belongs in the set and an industry that
   * was never asked about does not — and both look like "no amount" from the
   * outside.
   */
  asked: Set<string>;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  retry: () => void;
}

/**
 * ARR per industry — one read per industry, over the chart's six.
 *
 * `offeredIndustries` is `GET /app-configs`'s list. Only the six the chart
 * names AND the backend offers are asked about; the rest are reported as not
 * asked, which is what stops the chart claiming an industry holds nothing on
 * the strength of a question nobody put.
 */
export function useAnalysisIndustries(
  filters: MisAnalysisFilters,
  today: MisCivilDate,
  offeredIndustries: readonly string[],
  enabled = true,
): IndustryBreakdown {
  const calls = useMemo(
    () => analysisIndustryRequests(filters, today, offeredIndustries),
    [filters, today, offeredIndustries],
  );
  const bodies = useMemo(() => calls.map((call) => call.body), [calls]);
  const labels = useMemo(() => calls.map((call) => call.industry), [calls]);

  const state = useColumnQueries({
    name: "analysis-industry",
    url: misArrServiceUrls.exitArrSearch,
    bodies,
    labels,
    parse: figureIn,
    enabled,
  });

  const byIndustry = useMemo(() => {
    const amounts: Record<string, number | undefined> = {};
    for (const column of state.columns) amounts[column.label] = column.data;
    return amounts;
  }, [state.columns]);

  const asked = useMemo(() => new Set(labels), [labels]);

  return {
    byIndustry,
    asked,
    isLoading: state.isLoading,
    isError: state.isError,
    errorMessage: state.errorMessage,
    retry: state.retry,
  };
}
