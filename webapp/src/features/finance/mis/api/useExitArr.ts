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
import { asOfColumnLabel } from "../util/misPeriods";
import type { MisAppliedFilters, MisDateRange } from "../util/misViewVocabulary";
import type { BuFigures, RegionExitResponse } from "../components/exitArrRows";
import { buExitRequests, regionExitRequests } from "./misExitArrRequest";
import { useColumnQueries } from "./useColumnQueries";

// `POST /arr-summary/region-exit` and `POST /arr-summary/bu-exit` — the figures
// behind the two Exit ARR summaries, one call per column.
//
// Ported from `useExitArrByRegion.js` and `useExitArrByBU.js`, which are 404
// and 268 lines. Almost all of what is missing is machinery the port already
// has once: both source hooks carry their own in-flight request cache keyed by
// a stringified payload, their own request-id ref to settle races, and their
// own parser that reads a column's closing date back OUT of the header string
// it was given. Here the columns are `MisDateRange`s to begin with, and
// `useColumnQueries` owns the caching and the races for every MIS table at
// once.
//
// The two hooks live in one module because they are one question asked at two
// grains — Exit ARR by region, Exit ARR in total — and their bodies differ by a
// single field. Splitting them across two files would put that one difference
// where nobody can see it.

/** One summary column, and whatever is known about it so far. */
export interface ExitArrColumn<TResponse> {
  /** The column header, `As of {end}` — and its identity. */
  label: string;
  /** Absent while loading, and absent for good if this column failed. */
  response?: TResponse;
  isError: boolean;
}

export interface ExitArrState<TResponse> {
  columns: ExitArrColumn<TResponse>[];
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  retry: () => void;
}

/**
 * Exit ARR by Region.
 *
 * `isSalesRegionSummary` is a parameter and not a filter because the source
 * keeps it in the Region Summary's own component state, so it never reaches the
 * Applied set. It travels in the BODY, which is the React Query key — so the
 * Sales Region and Sub Region cuts are two cache entries and switching between
 * them is a fresh read rather than a regrouping of figures already held.
 */
export function useExitArrByRegion(
  ranges: readonly MisDateRange[],
  filters: MisAppliedFilters,
  isSalesRegionSummary: boolean,
  enabled = true,
): ExitArrState<RegionExitResponse> {
  const bodies = useMemo(
    () => regionExitRequests(ranges, filters, isSalesRegionSummary),
    [ranges, filters, isSalesRegionSummary],
  );
  return useAsOfColumns<RegionExitResponse>({
    name: "region-exit",
    url: misArrServiceUrls.regionExit,
    bodies,
    ranges,
    enabled,
  });
}

/** Exit ARR by Business Unit. */
export function useExitArrByBU(
  ranges: readonly MisDateRange[],
  filters: MisAppliedFilters,
  enabled = true,
): ExitArrState<BuFigures> {
  const bodies = useMemo(() => buExitRequests(ranges, filters), [ranges, filters]);
  return useAsOfColumns<BuFigures>({
    name: "bu-exit",
    url: misArrServiceUrls.buExit,
    bodies,
    ranges,
    enabled,
  });
}

function useAsOfColumns<TResponse>({
  name,
  url,
  bodies,
  ranges,
  enabled,
}: {
  name: string;
  url: string;
  bodies: readonly object[];
  ranges: readonly MisDateRange[];
  enabled: boolean;
}): ExitArrState<TResponse> {
  // Bodies and labels stay index-aligned: a body is what a column is fetched
  // with, and pairing them anywhere else would be two lists that could fall out
  // of step.
  const labels = useMemo(() => ranges.map(asOfColumnLabel), [ranges]);

  const state = useColumnQueries({
    name,
    url,
    bodies,
    labels,
    parse: objectIn<TResponse>,
    enabled,
  });

  return {
    ...state,
    columns: state.columns.map(({ label, data, isError }) => ({ label, response: data, isError })),
  };
}

/**
 * The record in a response, whatever shape it arrived in.
 *
 * Both endpoints answer with an object — a `BuType`, or a map of them keyed by
 * region — so an ARRAY is the shape worth naming: reaching the row builder, its
 * indices would become regions and the table would grow rows called "0" and
 * "1". An empty object instead, which reads everywhere as a column that
 * answered with nothing.
 *
 * That is the same distinction `useArrSummary` makes with `?? {}` and for the
 * same reason: a column that answered with nothing is a column that ANSWERED,
 * and every lookup on it should read as absent rather than as still loading.
 */
function objectIn<T>(payload: unknown): T {
  const isRecord = typeof payload === "object" && payload !== null && !Array.isArray(payload);
  return (isRecord ? payload : {}) as T;
}
