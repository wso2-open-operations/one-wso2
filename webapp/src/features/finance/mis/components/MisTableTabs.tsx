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

import { Box, ButtonBase } from "@wso2/oxygen-ui";
import {
  MIS_UNIT_CATEGORIES,
  MIS_UNIT_CATEGORY_LABELS,
  defaultUnitCode,
  unitCategoryOf,
  type MisUnitCategory,
} from "../util/misUnits";
import { MIS_TABLES, MIS_TABLE_LABELS, type MisTable } from "../util/misViewVocabulary";
import type { MisViewState } from "../util/useMisViewState";
import type { MisUnitSelection } from "./MisUnitTabs";
import { underlineTabRowSx, underlineTabSx } from "./misLookTokens";

// The seven Table tabs — BU Build · Software Build · Cloud Build · Custom
// Build · Customers · Region Summary · BU Summary. The four Build flavours are
// the Unit categories over the Subscription Table (CONTEXT.md: "Build"), so a
// Build tab sets BOTH the Table and the Unit category; the other three set the
// Table alone. Everything commits on click: a different Table is a different
// report, not a narrowing of this one.
//
// Drawn as transparent tabs over a shared bottom rule, each with a 3px
// underline: primary under the active tab, brand text on hover.
//
// The selection is read from the view rather than held here. The URL is the
// source of truth, and a second copy would disagree with it after a back button
// or a pasted link.

type TabKey = `build:${MisUnitCategory}` | `table:${MisTable}`;

interface TabSpec {
  key: TabKey;
  label: string;
}

const TABS: readonly TabSpec[] = [
  ...MIS_UNIT_CATEGORIES.map((category) => ({
    key: `build:${category}` as const,
    label: MIS_UNIT_CATEGORY_LABELS[category],
  })),
  { key: `table:${MIS_TABLES.SOFTWARE_CLOUD_CUSTOMERS}`, label: MIS_TABLE_LABELS[MIS_TABLES.SOFTWARE_CLOUD_CUSTOMERS] },
  { key: `table:${MIS_TABLES.EXIT_ARR_BY_REGION}`, label: MIS_TABLE_LABELS[MIS_TABLES.EXIT_ARR_BY_REGION] },
  { key: `table:${MIS_TABLES.EXIT_ARR_BY_BU}`, label: MIS_TABLE_LABELS[MIS_TABLES.EXIT_ARR_BY_BU] },
];

/** Which of the seven is lit, read off the view rather than held here. */
export function activeTabKey(view: MisViewState): TabKey {
  if (view.table === MIS_TABLES.SUBSCRIPTION) {
    return `build:${unitCategoryOf(view.filters.buProductSelection)}`;
  }
  return `table:${view.table}`;
}

export default function MisTableTabs({
  view,
  onTable,
  onUnits,
}: {
  view: MisViewState;
  /** Switch Table — the page's `changeTable`, which resets the filters that do not travel. */
  onTable: (table: MisTable, units?: MisUnitSelection) => void;
  /** Change the Unit category while staying on the Subscription Table. */
  onUnits: (units: MisUnitSelection) => void;
}) {
  const active = activeTabKey(view);

  const choose = (key: TabKey) => {
    if (key === active) return;
    if (key.startsWith("build:")) {
      const category = key.slice("build:".length) as MisUnitCategory;
      const units: MisUnitSelection = {
        buProductSelection: defaultUnitCode(category),
        customBusinessUnits: [],
        customProductUnits: [],
      };
      if (view.table === MIS_TABLES.SUBSCRIPTION) onUnits(units);
      else onTable(MIS_TABLES.SUBSCRIPTION, units);
      return;
    }
    onTable(key.slice("table:".length) as MisTable);
  };

  return (
    <Box role="group" aria-label="Table" sx={underlineTabRowSx}>
      {TABS.map((tab) => {
        const selected = tab.key === active;
        return (
          <ButtonBase
            key={tab.key}
            aria-pressed={selected}
            onClick={() => choose(tab.key)}
            sx={underlineTabSx(selected)}
          >
            {tab.label}
          </ButtonBase>
        );
      })}
    </Box>
  );
}
