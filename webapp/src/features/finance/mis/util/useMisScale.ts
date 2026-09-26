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

import { useEffect, useRef } from "react";
import { useScalePreference } from "./ScalePreferenceContext";
import type { MisViewState } from "./useMisViewState";
import { MIS_SCALES, type MisScale } from "./misViewVocabulary";

// Which Scale a screen is actually showing figures in.
//
// Scale is held in two places at once, deliberately, and this is the only place
// they meet (spec §4, §10.7):
//
//   the link       — so a view someone shares renders as the sender saw it
//   the preference — so a reader who works in thousands keeps working in
//                    thousands, across MIS screens and across reloads
//
// The source states the traffic between them in one sentence
// (`arrDashboard/hooks/useViewStateUrl.js`): *"A Scale in the URL is adopted
// into the session store on mount; otherwise the session Scale seeds the URL."*
// Both halves are ported, and the first is narrowed:
//
//   link → screen       yes. A link wins while it is being read.
//   link → preference   NO. This is the deliberate deviation. The source's
//                       store is Redux and dies with the tab, so adopting into
//                       it costs nothing; ours is `one-wso2.scale` and survives,
//                       so adopting would let a colleague's link permanently
//                       change how the recipient reads every later screen.
//                       Spec §4: "without permanently changing the recipient's
//                       preference".
//   preference → link   yes, and it has to be. Without it a reader who works in
//                       thousands copies an address carrying no Scale, and the
//                       view the recipient opens is not the view that was sent.
//
// It stays out of `useMisViewState` on purpose. That hook's single source of
// truth is the URL; a preference that also fed into it would give the same
// address two meanings depending on what is in localStorage.

export interface MisScaleState {
  /** What this screen shows figures in right now. */
  scale: MisScale;
  /** Change it: the address the reader would copy, and their own preference. */
  setScale: (next: MisScale) => void;
}

export function useMisScale(view: Pick<MisViewState, "scale" | "setView">): MisScaleState {
  const { preference, setPreference } = useScalePreference();
  const linkScale = view.scale;

  // `view` is rebuilt on every render, so `setView` cannot be an effect
  // dependency without re-running the seed on every render. A ref that a
  // separate effect keeps current is how the seed depends on the two values
  // that actually decide it, and on nothing else.
  const latestSetView = useRef(view.setView);
  useEffect(() => {
    latestSetView.current = view.setView;
  });

  useEffect(() => {
    // Only when the link carried no Scale of its own — a link that did carry
    // one is being read, not written, and must not be rewritten under its
    // reader. Units needs no seeding: it is the default, and a default is never
    // written (spec §4). So this fires once, on a thousands reader's first
    // render, and the guard extinguishes it because the write puts `scale=k`
    // into `linkScale`.
    if (linkScale !== undefined || preference !== MIS_SCALES.THOUSANDS) return;
    latestSetView.current({ scale: preference });
  }, [linkScale, preference]);

  return {
    scale: linkScale ?? preference,
    setScale: (next) => {
      setPreference(next);
      // Fed back through `setView` rather than left to the preference alone, so
      // the address keeps describing what is on screen. `setView` patch-merges,
      // so this survives every later filter change; and `serializeViewState`
      // writes `scale` only at thousands, so choosing units takes it back out
      // of a link that carried it rather than pinning a default into the URL.
      view.setView({ scale: next });
    },
  };
}
