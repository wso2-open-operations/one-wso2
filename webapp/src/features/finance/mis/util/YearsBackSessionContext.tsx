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

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type JSX,
  type ReactNode,
} from "react";
import { YEARS_BACK_RANGE } from "./misViewVocabulary";

// The Years Back a reader set, carried across Tables and Periods.
//
// Every Table and Period has its own default — 5 on Annually, 2 on Exit ARR by
// Region, 1 on Quarterly and Monthly — and a reader who has chosen three years
// means three years on the next Table too. So the value they chose outlives the
// screen they chose it on, and `null` means they have not chosen: the Table
// defaults still apply.
//
// ---- why this is in memory and not in storage -----------------------------
//
// `ScalePreferenceContext` sits beside this one and looks almost identical, but
// it writes to `localStorage` and this deliberately writes nowhere. The source
// keeps Years Back in a Redux slice (`viewPrefsSlice.js`) alongside Scale, and
// a Redux slice dies with the tab — so the two preferences that look alike in
// the source are NOT alike in what they promise:
//
//   Scale       survives a reload and the next visit. A reader who works in
//               thousands said so once.
//   Years Back  dies with the tab, and with a reload. It is the shape of the
//               question the reader is asking right now, not a standing
//               preference about how figures are written.
//
// `sessionStorage` would be the near miss: it survives a reload, which the
// source does not, and a Years Back that outlived a refresh would silently
// re-narrow a Build somebody came back to.

interface YearsBackSessionValue {
  /** The Years Back this reader set, or `null` while the Table defaults apply. */
  yearsBack: number | null;
  /** Record a Years Back, or `null` to hand the question back to the Table. */
  setYearsBack: (next: number | null) => void;
}

const YearsBackSessionContext = createContext<YearsBackSessionValue | undefined>(undefined);

/**
 * Validated on the way in rather than trusted, for the same reason the URL's
 * `years` is: this value seeds the column list, and one outside the range the
 * control offers would ask the backend for a Build nobody can reach from the UI.
 */
const isYearsBack = (value: number): boolean =>
  Number.isInteger(value) && value >= YEARS_BACK_RANGE.min && value <= YEARS_BACK_RANGE.max;

export function YearsBackSessionProvider({ children }: { children: ReactNode }): JSX.Element {
  const [yearsBack, setStored] = useState<number | null>(null);

  const setYearsBack = useCallback((next: number | null) => {
    if (next === null || isYearsBack(next)) setStored(next);
  }, []);

  const value = useMemo(() => ({ yearsBack, setYearsBack }), [yearsBack, setYearsBack]);

  return (
    <YearsBackSessionContext.Provider value={value}>{children}</YearsBackSessionContext.Provider>
  );
}

export function useYearsBackSession(): YearsBackSessionValue {
  const context = useContext(YearsBackSessionContext);
  if (!context) {
    // Fatal rather than defaulted, as with Scale. A bar that quietly read "no
    // session value" would seed itself from the Table default while the screen
    // beside it seeded from the session, and neither would say which it used.
    throw new Error("useYearsBackSession must be used within a YearsBackSessionProvider");
  }
  return context;
}
