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

import { useNavigate } from "react-router";
import { Box, ButtonBase } from "@wso2/oxygen-ui";
import { MIS_BUILD_PATH_BY_PERIOD } from "@constants/misApps";
import {
  MIS_PERIOD_CHOICE_LABELS,
  MIS_PERIOD_CHOICE_ORDER,
  periodChoiceOf,
  periodChoiceTarget,
  type MisPeriodChoice,
} from "../util/misFilterBarModel";
import { MIS_WINDOWS } from "../util/misViewVocabulary";
import type { MisViewState } from "../util/useMisViewState";
import { periodSegmentSx } from "./misLookTokens";

// The Period row — Annually | Quarterly | Monthly | TTM — at the top of the
// ARR Dashboard, above the filter card.
//
// Drawn as 8px-radius segments: a primary border and a 12% primary tint when
// pressed, weight 700 — never orange text.

export default function MisPeriodRow({ view }: { view: MisViewState }) {
  const navigate = useNavigate();
  const current = periodChoiceOf(view.period, view.viewWindow);

  // Three Periods navigate to their bare route; TTM sets a Window on the
  // Annually route already showing — see `periodChoiceTarget`.
  const choose = (choice: MisPeriodChoice) => {
    const target = periodChoiceTarget(choice);
    if (target.period === view.period) {
      view.setWindow(target.viewWindow ?? MIS_WINDOWS.CALENDAR);
      return;
    }
    navigate(MIS_BUILD_PATH_BY_PERIOD[target.period]);
  };

  return (
    <Box role="group" aria-label="Period" sx={{ display: "flex", flexWrap: "wrap", gap: "6px", mb: 1.5 }}>
      {MIS_PERIOD_CHOICE_ORDER.map((choice) => {
        const pressed = choice === current;
        return (
          <ButtonBase
            key={choice}
            aria-pressed={pressed}
            onClick={() => choose(choice)}
            sx={periodSegmentSx(pressed)}
          >
            {MIS_PERIOD_CHOICE_LABELS[choice]}
          </ButtonBase>
        );
      })}
    </Box>
  );
}
