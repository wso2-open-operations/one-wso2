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

import { useEffect, useState } from "react";

// A value as the READS should see it, held back until it settles.
//
// ---- why ARR Analysis has one and the Build does not -----------------------
//
// The Build's filter bar stages changes behind Apply, so its reads fire once
// per deliberate press and there is nothing to debounce. ARR Analysis applies at
// once — its filters reach no address, so there is no history to fill and
// nothing to stage (see `misAnalysisFilters.ts`).
//
// Ticket 13 dropped the source's 250ms debounce on exactly that reasoning, and
// noted the number it was reasoning about: **two** reads per filter change, the
// table and the figure above it. Delaying every deliberate click a quarter
// second to smooth over two number fields was the wrong trade, and the two
// fields commit on blur instead.
//
// Ticket 14's charts change the number, not the reasoning. The partner-model
// split is up to two more reads and the industry breakdown is ONE PER INDUSTRY
// over a list of six, so a filter change is now up to **ten**. A reader
// stepping through four Sales Regions fires forty; through this, ten. The
// source had a debounce for this reason all along.
//
// ---- and why it is here rather than in the hooks ---------------------------
//
// One value, debounced once, feeding all four reads. Debouncing inside each
// hook would let them fire at different moments, so the table and the charts
// above it would briefly be answering two different questions — which is the
// one thing a screen built for comparing them must not do.

/** The house delay. The source's, and short enough to read as immediate. */
export const MIS_FILTER_DEBOUNCE_MS = 250;

/**
 * `value`, but only once it has stopped changing for `delayMs`.
 *
 * The FIRST value passes through immediately: a cold load has nothing to
 * debounce, and a screen that sat blank for a quarter second before asking for
 * anything would pay the cost with none of the benefit.
 *
 * Identity is preserved when nothing actually changed, which matters more here
 * than it looks: every MIS read is keyed on a request body built from this
 * value, so handing back an equal-but-new object would re-key all ten queries
 * and refetch a view nobody touched.
 */
export function useDebouncedValue<T>(value: T, delayMs = MIS_FILTER_DEBOUNCE_MS): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    // A change undone inside the window is not a change. Bailing here also
    // covers the re-render-with-the-same-value case, which is most of them.
    if (Object.is(value, settled)) return;

    // The timer closes over THIS render's `value`, and that is sufficient: a
    // burst re-runs the effect per change, so each new timer supersedes the one
    // the cleanup below has just cleared, and the last value is the one that
    // survives. (An earlier version kept a ref to read the freshest value from
    // inside the timer — unnecessary, and a ref write during render.)
    const timer = setTimeout(() => setSettled(value), delayMs);
    // Cleared on the next change AND on unmount, so a pending change never
    // lands after the screen has gone.
    return () => clearTimeout(timer);
  }, [value, settled, delayMs]);

  return settled;
}
