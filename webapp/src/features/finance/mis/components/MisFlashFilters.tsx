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

import { Alert, Autocomplete, Box, Button, Stack, TextField } from "@wso2/oxygen-ui";
import { EraserIcon, SearchIcon } from "@wso2/oxygen-ui-icons-react";
import {
  monthFromInput,
  monthInputValue,
  type MisMonth,
} from "../util/misFlashPeriods";
import type { FlashSubRegionGroup } from "../util/misFlashSubRegions";

// The Flash screen's filters: two months and a set of regions, behind a Search.
//
// Ported from `flashConsole/filters/DateFilter.js`, `SubRegionFilter.js` and
// `FilterButton.js` — three files there, one here, because they are one bar and
// two of them exist only to hold state the fourth file then reads back.
//
// ---- this is NOT `MisFilterBar` --------------------------------------------
//
// The Build's bar is nine list filters, a Period, a unit selection and Years
// Back, all serialised into the query string by ticket 02's contract. This is
// two months and a region list, and none of it reaches the URL — the source
// keeps all of it in component state, so a shared Flash link opens on defaults
// in both apps. Reproduced under ADR 0003 for the same reason ARR Analysis's
// filters are: extending the URL contract is a contract decision, not a side
// effect of porting a screen. Recorded in spec §11.
//
// ---- the months are native inputs ------------------------------------------
//
// The source uses `@mui/x-date-pickers`, which this repo does not ship and
// which ADR 0004's reasoning declines to add for one screen. `<input
// type="month">` is the browser's own month picker, it holds `yyyy-MM`, and it
// never puts a month through a `Date` — which is the whole of spec §3's rule
// here (see `misFlashPeriods`).
//
// ---- Search is a commit, and the port keeps it that way --------------------
//
// Nothing here fetches on change. The source's Search button is what calls
// `fetchData`, and on a screen whose read is a full P&L across six business
// units that is the right shape — but it is also load-bearing for a subtler
// reason: the range the screen ASKS for depends on which button got it there
// (spec §8), so a filter that settled itself would have no way to say which.

export interface MisFlashFiltersProps {
  /** The months being edited — not necessarily the ones on screen. */
  months: { start: MisMonth; end: MisMonth };
  /** The regions being edited, by name. */
  regions: readonly string[];
  /** The menu, from `GET /sub-regions`. Narrows with the settled range. */
  groups: readonly FlashSubRegionGroup[];
  groupsLoading: boolean;
  /** Only when the menu actually FAILED. Still loading says so in the control. */
  groupsErrorMessage: string;
  onRetryGroups: () => void;
  /**
   * One picker moved. Per picker, not per bar: the source sends a different
   * DATE for a month the reader moved than for one they did not (spec §8), so
   * which of the two it was is the whole of what the caller needs to know.
   */
  onMonthChange: (which: "start" | "end", month: MisMonth) => void;
  onRegionsChange: (regions: string[]) => void;
  onSearch: () => void;
  onReset: () => void;
}

export default function MisFlashFilters({
  months,
  regions,
  groups,
  groupsLoading,
  groupsErrorMessage,
  onRetryGroups,
  onMonthChange,
  onRegionsChange,
  onSearch,
  onReset,
}: MisFlashFiltersProps) {
  const setMonth = (which: "start" | "end") => (value: string) => {
    const month = monthFromInput(value);
    // A half-typed or impossible value leaves the month alone. A month input
    // reports both while someone is using it, and jumping to whatever `new Date`
    // made of a fragment would move the other picker's bounds under them — and
    // would also mark a picker as moved that the reader never moved.
    if (month) onMonthChange(which, month);
  };

  const options = groups.map((group) => group.region);

  return (
    <Box
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: 1.5,
        p: 1.5,
        mb: 1.5,
        backgroundColor: "background.paper",
      }}
    >
      <Stack
        direction="row"
        spacing={1.25}
        sx={{ alignItems: "flex-start", flexWrap: "wrap", rowGap: 1.25 }}
      >
        <TextField
          type="month"
          size="small"
          label="Start Month"
          value={monthInputValue(months.start)}
          // The pickers hold each other apart, as the source's `maxDate` and
          // `minDate` do. Without it `flashMonthlyRanges` answers with no
          // columns at all, which reads as a P&L that has lost its detail
          // rather than as a range nobody meant.
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: monthInputValue(months.end) } }}
          onChange={(event) => setMonth("start")(event.target.value)}
          sx={{ width: 170 }}
        />
        <TextField
          type="month"
          size="small"
          label="End Month"
          value={monthInputValue(months.end)}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { min: monthInputValue(months.start) },
          }}
          onChange={(event) => setMonth("end")(event.target.value)}
          sx={{ width: 170 }}
        />

        <Autocomplete
          multiple
          size="small"
          disableCloseOnSelect
          options={options}
          value={[...regions]}
          // A region the menu no longer offers is still shown, so a reader can
          // see and remove it. What it does NOT do is reach the request —
          // `flashSubRegionsFor` drops it, because sending a region's own name
          // would filter the P&L by a sub-region that does not exist.
          onChange={(_event, next) => onRegionsChange(next)}
          loading={groupsLoading}
          sx={{ minWidth: 260, flex: "1 1 260px", maxWidth: 420 }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Sub Region (optional)"
              placeholder={regions.length ? "" : "All sub regions"}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          )}
        />

        <Stack direction="row" spacing={1} sx={{ alignItems: "center", pt: 0.25 }}>
          <Button
            variant="contained"
            size="small"
            startIcon={<SearchIcon size={15} />}
            onClick={onSearch}
          >
            Search
          </Button>
          {/* The source calls this Reset and colours it `error`, which reads as
              destructive for something that only changes a view. The word is
              kept — it is what Finance looks for — and the colour is not. */}
          <Button
            variant="outlined"
            size="small"
            color="inherit"
            startIcon={<EraserIcon size={15} />}
            onClick={onReset}
          >
            Reset
          </Button>
        </Stack>
      </Stack>

      {groupsErrorMessage && (
        <Alert
          severity="warning"
          sx={{ mt: 1.25 }}
          action={
            <Button size="small" color="inherit" onClick={onRetryGroups}>
              Retry
            </Button>
          }
        >
          {/* The P&L is still readable — it is only the NARROWING that is
              unavailable — so this is a warning beside the bar rather than an
              error in place of the table. */}
          Couldn&apos;t load the sub regions, so the P&amp;L can&apos;t be narrowed by one.{" "}
          {groupsErrorMessage}
        </Alert>
      )}
    </Box>
  );
}
