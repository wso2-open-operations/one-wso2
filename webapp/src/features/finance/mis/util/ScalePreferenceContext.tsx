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
import { MIS_SCALES, type MisScale } from "./misViewVocabulary";

// The Scale a reader works in, held across MIS pages and across reloads.
//
// In the source this is a Redux slice, which made it session state that every
// screen could reach. It becomes a context here for the same reason the theme
// did: it is one value, it changes rarely, and the alternative is threading it
// through every Build screen's props.
//
// What this deliberately does NOT own is which Scale is on screen. A link can
// carry `scale=k`, and a link wins — see `useMisScale`, which is the only place
// the two are reconciled. This context answers one question: what did this
// reader last choose?
//
// It lives with the feature rather than in `src/context/`, where the app-wide
// providers are, because Scale is a Finance MIS word (CONTEXT.md defines it
// under Finance MIS) and no screen outside MIS has one. `features/tour` holds
// its own provider on the same grounds. What "cross-page" means here is
// cross-MIS-page, and `MisShell` — the frame every MIS screen already renders
// through — is exactly that scope.

/**
 * Namespaced like the app's other browser-stored keys (`one-wso2.theme`,
 * `one-wso2.pinned.v1`) so everything this app writes is greppable.
 *
 * Stores the vocabulary value — `units` / `thousands` — not the URL's `k`. The
 * two are different alphabets on purpose: `k` is a shortening for a link people
 * read, and a stored preference has no such pressure.
 */
const STORAGE_KEY = "one-wso2.scale";

interface ScalePreferenceContextValue {
  /** The Scale this reader last chose. Units until they choose. */
  preference: MisScale;
  /** Choose a Scale, and remember it. */
  setPreference: (next: MisScale) => void;
}

const ScalePreferenceContext = createContext<ScalePreferenceContextValue | undefined>(
  undefined,
);

const isMisScale = (value: unknown): value is MisScale =>
  value === MIS_SCALES.UNITS || value === MIS_SCALES.THOUSANDS;

/**
 * Validated on read rather than trusted. localStorage is reader-editable, and
 * an unrecognised value must fall back to units rather than reach the formatter
 * as something it will treat as "not thousands" by accident.
 */
function readStoredPreference(): MisScale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isMisScale(saved)) return saved;
  } catch {
    // Private browsing and blocked site data both land here. Units is a fine
    // answer, and a revenue report that refuses to render is not.
  }
  return MIS_SCALES.UNITS;
}

export function ScalePreferenceProvider({ children }: { children: ReactNode }): JSX.Element {
  const [preference, setStored] = useState<MisScale>(readStoredPreference);

  const setPreference = useCallback((next: MisScale) => {
    setStored(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The choice still applies for this session; only persistence is lost.
    }
  }, []);

  const value = useMemo(() => ({ preference, setPreference }), [preference, setPreference]);

  return (
    <ScalePreferenceContext.Provider value={value}>{children}</ScalePreferenceContext.Provider>
  );
}

export function useScalePreference(): ScalePreferenceContextValue {
  const context = useContext(ScalePreferenceContext);
  if (!context) {
    // Deliberately fatal rather than defaulted. A screen that quietly read
    // units here would show units while the reader's own control said
    // thousands — a revenue figure a thousand times out, with nothing on screen
    // admitting it.
    throw new Error("useScalePreference must be used within a ScalePreferenceProvider");
  }
  return context;
}
