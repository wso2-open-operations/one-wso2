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

// The Applied filters, said in words.
//
// The strip under the controls is what makes a shared link legible: it is the
// difference between opening someone's address and seeing a number, and opening
// it and seeing that the number is EMEA, Channel, three years back. The bar's
// menus can say the same thing, but only one at a time and only once opened.
//
// Ported from digiops-finance `arrDashboard/utils/appliedFilterChips.js`. The
// vocabulary and the order are that file's; what changed is where the rules
// about *which* filters a view has come from — see `describeAppliedFilters`.

import {
  chipLabel,
  confidenceLabel,
  misFilterBarControls,
  pendingFromApplied,
  typeLabel,
  type MisFilterControl,
  type MisFilterView,
} from "./misFilterBarModel";
import { defaultAppliedFilters } from "./misViewState";
import type { MisAppliedFilters } from "./misViewVocabulary";

/**
 * The order chips appear in, which is NOT the order the controls appear in.
 *
 * Years Back leads because it is the only one always present — it frames every
 * other chip, and a strip whose first entry moved about as filters came and
 * went would be harder to read at a glance than one that does not. After it,
 * the source's own order (`chipOrder`).
 */
const CHIP_ORDER: readonly MisFilterControl[] = [
  "yearsBack",
  "typeValue",
  "confidenceLevel",
  "viewType",
  "salesRegion",
  "subRegion",
  "channelDirect",
  "isYtd",
  "endingMonth",
  "cumulative",
  "billingCountry",
  "shippingCountry",
  "industry",
  "subIndustry",
  "accountOwner",
  "technicalOwner",
  "channelManager",
];

export interface MisFilterChip {
  /** The control this chip stands for, and what dismissing it resets. */
  key: MisFilterControl;
  label: string;
  /**
   * False for Years Back alone: every view has one, so there is no "no Years
   * Back" state to dismiss it into.
   */
  removable: boolean;
}

/**
 * The Applied set as a list of chips.
 *
 * ---- why this asks the bar which filters exist ----------------------------
 *
 * A chip and a control are two views of one filter, so they have to agree about
 * whether that filter is part of this view at all. The source keeps two
 * separate answers — `usesForecastType`/`usesYearsBack` here, and a different
 * set of conditions inside each of the four Table layouts — and they disagree on
 * a Delayed Build, where the control is shown and the chip is not.
 *
 * So this asks `misFilterBarControls`, the same function the bar lays itself out
 * from. A filter with no control gets no chip, by construction.
 */
export function describeAppliedFilters(
  applied: MisAppliedFilters,
  view: MisFilterView,
): MisFilterChip[] {
  const { period, table } = view;
  const pending = pendingFromApplied(applied, period);
  const shown = misFilterBarControls(pending, view);
  const defaults = pendingFromApplied(defaultAppliedFilters(period, table), period);

  return CHIP_ORDER.filter((key) => shown.has(key)).flatMap((key) => {
    const value = pending[key];
    // Years Back is always described, at whatever it is — it is the one filter
    // whose default is still worth stating, because every column on screen
    // depends on it.
    if (key !== "yearsBack" && isDefault(value, defaults[key])) return [];
    return [
      {
        key,
        label: `${chipLabel(key, period)}: ${describe(key, value)}`,
        removable: key !== "yearsBack",
      },
    ];
  });
}

const isDefault = (value: unknown, fallback: unknown): boolean =>
  Array.isArray(value) ? value.length === 0 : value === fallback;

function describe(key: MisFilterControl, value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "On" : "Off";
  if (key === "typeValue") return typeLabel(String(value));
  if (key === "confidenceLevel") return confidenceLabel(String(value));
  return String(value);
}
