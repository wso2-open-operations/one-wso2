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

import { useMemo, useRef } from "react";
import { useUrlViewState, type UrlViewCodec } from "@hooks/useUrlViewState";
import {
  applyWindow,
  hydrateAppliedFilters,
  parseViewState,
  serializeViewState,
  type AnnualRangesFor,
  type MisParsedView,
  type MisRememberedWindow,
  type MisView,
} from "./misViewState";
import {
  MIS_TABLES,
  MIS_WINDOWS,
  type MisAppliedFilters,
  type MisPeriod,
  type MisScale,
  type MisTable,
  type MisWindow,
} from "./misViewVocabulary";

/** What the caller changed. Anything it leaves out stays as it is. */
export interface MisViewPatch {
  table?: MisTable;
  scale?: MisScale;
  viewWindow?: MisWindow;
  /**
   * Replaces the Applied set outright rather than merging into it. Applying
   * filters is a commit: the set the reader pressed Apply on is the set, and
   * merging would let a filter they cleared survive because the patch did not
   * mention it.
   */
  filters?: MisAppliedFilters;
}

export interface MisViewState {
  /** Subscription when the link named no Table. */
  table: MisTable;
  /**
   * The Scale the link carried, if any. This hook knows nothing of the stored
   * preference — reconciling the two is ticket 05's, and `setView` carries
   * whatever it was given straight back, so a shared link keeps its Scale.
   */
  scale?: MisScale;
  /** Calendar when the link named no Window. */
  viewWindow: MisWindow;
  /** The complete Applied set, hydrated from the partial one the link carried. */
  filters: MisAppliedFilters;
  /**
   * Whether the link carried a view at all, so a screen can tell "opened fresh"
   * from "opened on someone's link". Scale alone does not count — spec §8.2.
   */
  hasViewState: boolean;
  /** Change part of the view, and put the result in the address. */
  setView(patch: MisViewPatch): void;
  /**
   * Switch an Annually table between Calendar and TTM, applying everything the
   * switch implies — the type coercion, the YTD reset, and restoring the YTD
   * the reader had on the way back. A no-op on Quarterly and Monthly.
   */
  setWindow(next: MisWindow): void;
}

export interface UseMisViewStateOptions {
  /**
   * How the Annually column ranges are computed. Pacific Time is ticket 05's,
   * so it arrives from outside rather than being imported here; omit it and the
   * ranges are simply not computed.
   *
   * Hoist it out of the render, or it changes identity every time and the
   * Applied set is rebuilt with it.
   */
  annualRangesFor?: AnnualRangesFor;
}

/**
 * The Build view a screen is looking at, read from and written to its URL.
 *
 * The Period is the route — `/finance/mis/arr-build`, `qrr-build`, `mrr-build` —
 * so it is passed in rather than parsed, and the same query string means
 * different things on the three screens. Everything else lives in the query
 * string, which is the single source of truth: `setView` navigates, and the
 * next view comes back out of the URL rather than out of a second copy held in
 * state that has to be kept in step with it.
 */
export function useMisViewState(
  period: MisPeriod,
  { annualRangesFor }: UseMisViewStateOptions = {},
): MisViewState {
  // What Calendar left behind on the way to TTM. Session state, deliberately:
  // it is what the reader would get back by pressing the control again, not
  // part of the view a link describes.
  const remembered = useRef<MisRememberedWindow>({});

  const codec = useMemo<UrlViewCodec<MisParsedView, MisView>>(
    () => ({
      parse: (search) => parseViewState(search, { period }),
      serialize: serializeViewState,
    }),
    [period],
  );
  const { view: parsed, setView: writeView } = useUrlViewState(codec);

  const table = parsed.table ?? MIS_TABLES.SUBSCRIPTION;
  const viewWindow = parsed.viewWindow ?? MIS_WINDOWS.CALENDAR;
  const filters = useMemo(
    () => hydrateAppliedFilters(parsed.filters, period, table, { viewWindow, annualRangesFor }),
    [parsed.filters, period, table, viewWindow, annualRangesFor],
  );

  const current: MisView = { period, table, scale: parsed.scale, viewWindow, filters };

  return {
    table,
    scale: parsed.scale,
    viewWindow,
    filters,
    hasViewState: parsed.hasViewState,
    setView: (patch) => writeView({ ...current, ...patch }),
    setWindow: (next) => {
      const switched = applyWindow(filters, next, {
        period,
        table,
        fromWindow: viewWindow,
        remembered: remembered.current,
        annualRangesFor,
      });
      remembered.current = switched.remembered;
      writeView({ ...current, viewWindow: switched.viewWindow, filters: switched.filters });
    },
  };
}
