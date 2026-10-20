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
import { Box, Collapse, ToggleButton } from "@wso2/oxygen-ui";
import { FilterIcon } from "@wso2/oxygen-ui-icons-react";
import { useNotifications } from "@context/notifications/NotificationsContext";
import ExpenseTypeFilters from "../ExpenseTypeFilters";
import MasterDataScreen from "../MasterDataScreen";
import { MASTER_DATA_SNACK } from "../masterDataCopy";
import { useExpenseTypeAutoComplete, useExpenseTypes } from "../useMasterData";
import type { ExpenseTypeFilter } from "../masterDataTypes";

// The filter panel's height slide, and the fade that covers it.
const FILTER_EASE_IN = "cubic-bezier(0.4, 0, 0.2, 1)";
const FILTER_EASE_OUT = "cubic-bezier(0.4, 0, 1, 1)";
const FILTER_SLIDE_MS = 260;
const FILTER_FADE_IN_MS = 220;
const FILTER_FADE_OUT_MS = 120;
// Lets the height open before the contents arrive.
const FILTER_FADE_DELAY_MS = 40;

const FADE_PROPS = ["opacity", "transform"];
const fadeTransition = (ms: number, ease: string, delay = 0) =>
  FADE_PROPS.map((prop) => `${prop} ${ms}ms ${ease} ${delay}ms`).join(", ");

/**
 * The expense-type catalogue — `pages/ExpenseTypes.tsx`.
 *
 * Opens on the whole catalogue. The rows come from a POST filter rather than
 * a GET, but an empty filter is not an unanswerable question:
 * `search-expense-types` builds no WHERE clause for one and returns every
 * row. Asking people to pick a filter before they can see what there is to
 * filter BY had it backwards, so the catalogue loads and the bar narrows it.
 *
 * Two filter objects, not one. `draft` is what the bar is editing; `applied`
 * is what the table is showing. Without the split, every keystroke in the
 * filter bar would be a new query key and a new request — the source avoids
 * that with an explicit Apply, and so does this.
 *
 * Filters start collapsed: the catalogue is already on screen, so the bar is
 * there for the person who wants to narrow it, not a gate on the way in.
 */
export default function ExpenseTypesPage() {
  const [showFilters, setShowFilters] = useState(false);
  const [draft, setDraft] = useState<ExpenseTypeFilter>({});
  // `{}` rather than null: the first render asks for the unfiltered
  // catalogue, and Apply replaces it with a narrower question.
  const [applied, setApplied] = useState<ExpenseTypeFilter>({});

  const options = useExpenseTypeAutoComplete();
  const query = useExpenseTypes(applied);
  const { showError } = useNotifications();

  // CustomTable.tsx:54-59 — the option lists failing is its own message,
  // separate from the rows failing, because it leaves the filter bar empty
  // while the table may still be fine.
  useEffect(() => {
    if (options.isError) showError(MASTER_DATA_SNACK.error.autoComplete);
  }, [options.isError, showError]);

  return (
    <MasterDataScreen
      tab="expenseTypes"
      rows={query.data ?? []}
      loading={query.isLoading}
      error={query.isError ? query.error : undefined}
      onRetry={() => void query.refetch()}
      autoComplete={options.data}
      toolbar={
        <ToggleButton
          value="filters"
          size="small"
          selected={showFilters}
          onChange={() => setShowFilters((v) => !v)}
          // One width for both labels: the toolbar is right-aligned, so a
          // button that resizes on click nudges "Add New Expense Type" too.
          sx={{ textTransform: "none", gap: 0.75, px: 1.5, minWidth: 140 }}
        >
          <FilterIcon size={16} />
          {showFilters ? "Hide Filters" : "Show Filters"}
        </ToggleButton>
      }
    >
      {/* flexShrink: 0 stops the flex-column parent squeezing Collapse and
          clipping the buttons. The fade hides Collapse un-clipping the
          filters a row at a time. */}
      <Collapse in={showFilters} timeout={FILTER_SLIDE_MS} easing={FILTER_EASE_IN} sx={{ flexShrink: 0 }}>
        <Box
          sx={{
            opacity: showFilters ? 1 : 0,
            transform: showFilters ? "translateY(0)" : "translateY(-4px)",
            transition: showFilters
              ? fadeTransition(FILTER_FADE_IN_MS, FILTER_EASE_IN, FILTER_FADE_DELAY_MS)
              : fadeTransition(FILTER_FADE_OUT_MS, FILTER_EASE_OUT),
          }}
        >
          <ExpenseTypeFilters
            draft={draft}
            options={options.data}
            optionsLoading={options.isLoading}
            busy={query.isFetching}
            onChange={setDraft}
            onApply={() => setApplied(draft)}
            // Clears what the table is showing too, not just the bar. With the
            // catalogue as the starting point, "Clear" means "back to all of
            // it" — emptying the fields while the table stayed narrowed would
            // leave no way to read what it was still narrowed by.
            onClear={() => {
              setDraft({});
              setApplied({});
            }}
          />
        </Box>
      </Collapse>
    </MasterDataScreen>
  );
}
