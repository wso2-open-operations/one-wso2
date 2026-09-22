/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { useEffect, useState } from "react";
import { Alert, Box, type SxProps, type Theme } from "@wso2/oxygen-ui";

// What a table too wide for the viewport says about itself.
//
// Spec §11.8, ticket 08. The decision it implements: **the notice appears and
// the table still renders**. It is a sentence above a table, not a replacement
// for one — every figure stays reachable by scrolling, with the row-label
// column pinned, which is what makes an honest notice better than a substitute
// layout.
//
// ---- why a notice rather than a narrow layout ------------------------------
//
// The rejected candidate was the prototype's Variant C: one Period at a time,
// rendered vertically, which fits 400px. Measured against the real Build it
// answers for ONE of the four tables. The Subscription Build needs 1,138px at
// its default Years Back (a 288px pinned label column plus five Periods at
// 170px), and Variant C takes it to 458px. But Software/Cloud Customers needs
// 8,170px at its narrowest breakdown — 2,920px of that is identity columns
// before a single figure — and reducing it to one Period still leaves 3,970px.
// Its width comes from per-Period BREADTH, not from the Period count, so the
// mechanism that rescues the Build does nothing for it.
//
// Shipping Variant C would therefore mean two mechanisms on one screen, with
// period-over-period comparison vanishing on one tab and not the others. One
// honest notice beats that.
//
// The tension ticket 08 names is real and is not papered over: the shell
// otherwise promises every screen works at every width, and this is an
// admission that the Build does not do so comfortably. It is true, and a reader
// told the truth can act on it.
//
// ---- it compares against the table's OWN width -----------------------------
//
// `tableMinWidth` is COMPUTED from the column model rather than measured off
// the DOM (`buildTableModel.ts`), which is what makes this both honest and
// testable: no layout is involved, so jsdom models it exactly.
//
// A fixed 1,024px threshold was the first attempt and was wrong, for a reason
// worth keeping written down: **the Build is not one width.** This same page
// serves QRR and MRR, where Years Back defaults to 1 — up to eight quarters
// (1,648px) or thirteen months (2,498px) — while Software/Cloud Customers is
// 8,170px and a BU Summary at `?years=1` is 380px. A fixed threshold told a
// reader on a 400px screen that a 380px table was "wider than your screen",
// which is false, and said nothing at 1,100px about a table needing 8,170px.

/** Namespaced like the app's other browser-stored keys — `one-wso2.*`. */
const STORAGE_KEY = "one-wso2.wide-table-notice.dismissed";

export interface WideTableNoticeProps {
  /**
   * The width this table needs, from `tableMinWidth` — computed from the
   * column model, never measured. Below it, the table is read by scrolling.
   */
  readonly tableMinWidth: number;
  readonly sx?: SxProps<Theme>;
}

/**
 * The notice, inside a live region that is always there.
 *
 * Always-mounted because a region created at the moment its text appears is
 * announced unreliably or not at all — the rule `MisFilterBar` states verbatim
 * and this repo follows in three other places. It matters here in particular:
 * the notice can arrive on a RESIZE, long after first paint.
 *
 * Dismissal is remembered across visits, per the ticket: a notice that returned
 * on every navigation would be worse than none, because the reader has already
 * told us they know. Remembered app-wide rather than per table — what they have
 * understood is "wide tables here scroll", which is not a fact about one table.
 */
export default function WideTableNotice({ tableMinWidth, sx }: WideTableNoticeProps) {
  const isNarrow = useNarrowerThan(tableMinWidth);
  const [dismissed, setDismissed] = useState(readDismissed);

  return (
    <Box role="status" sx={{ minHeight: 0 }}>
      {isNarrow && !dismissed && (
        <Alert
          // `info`, not `warning`: nothing has failed and nothing is at risk.
          // The table below is complete and readable.
          severity="info"
          onClose={() => {
            setDismissed(true);
            writeDismissed();
          }}
          closeText="Dismiss"
          sx={sx}
        >
          This table is wider than your screen. Scroll it sideways to read the rest — the first
          column stays put.
        </Alert>
      )}
    </Box>
  );
}

/**
 * Whether the viewport is narrower than `width`.
 *
 * A `resize` listener rather than `matchMedia`, following `useFillHeight`: this
 * repo has no `matchMedia` idiom and jsdom does not implement it, so a media
 * query would make every test of this component reach for a stub.
 */
function useNarrowerThan(width: number): boolean {
  const [isNarrow, setIsNarrow] = useState(() => window.innerWidth < width);

  useEffect(() => {
    const measure = () => setIsNarrow(window.innerWidth < width);
    // Once on mount as well as on resize: the viewport can have changed between
    // the initial state above and this effect running, and `width` itself
    // changes when the reader adds a Period.
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [width]);

  return isNarrow;
}

/**
 * Whether this reader has dismissed it before.
 *
 * Guarded, because `localStorage` THROWS rather than returning null under
 * private browsing and blocked site data — the case `ScalePreferenceContext`
 * guards for the same reason. A notice is the last thing that should take a
 * screen down, so an unreadable store means "not dismissed": the notice shows,
 * which is the harmless direction to fail in.
 */
function readDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Remember the dismissal, and say whether it stuck.
 *
 * The boolean is what lets a test assert the write guard rather than infer it:
 * a `try/catch` that swallows silently is indistinguishable from no `try/catch`
 * at all unless something observes the difference. Deleting this guard used to
 * leave every assertion in the suite passing.
 */
export function writeDismissed(): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, "true");
    return true;
  } catch {
    // Dismissed for this visit and not remembered, which is the same failure
    // the Scale preference accepts for the same reason.
    return false;
  }
}
