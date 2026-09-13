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

import { useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@wso2/oxygen-ui";
import { ChevronDownIcon, ChevronUpIcon, EraserIcon, ListFilterIcon } from "@wso2/oxygen-ui-icons-react";
import { describeAppliedFilters } from "../util/misAppliedFilterChips";
import {
  MIS_COLLAPSED_CONTROL_COUNT,
  MIS_CONFIDENCE_OPTIONS,
  MIS_FILTER_CONTROL_ORDER,
  appliedFromPending,
  confidenceLabel,
  controlLabel,
  misFilterBarControls,
  normalisePending,
  pendingFromApplied,
  samePending,
  typeLabel,
  type MisFilterControl,
  type MisFilterView,
  type MisPendingFilters,
} from "../util/misFilterBarModel";
import { allowedTypeValues, defaultAppliedFilters } from "../util/misViewState";
import {
  ENDING_MONTH_VALUES,
  MIS_CHANNEL_DIRECT,
  MIS_SCALES,
  MIS_VIEW_TYPES,
  MIS_WINDOWS,
  YEARS_BACK_RANGE,
  type MisWindow,
} from "../util/misViewVocabulary";
import type { MisViewState } from "../util/useMisViewState";
import type { MisScaleState } from "../util/useMisScale";
import type { MisFilterOptions } from "../api/misAppConfigs";
import MisAppliedFilterChips from "./MisAppliedFilterChips";
import MisUnitTabs, { type MisUnitSelection } from "./MisUnitTabs";

// The whole filter surface above a Build.
//
// Four things that look like one control each but are not the same KIND of
// control, and the difference is the thing to hold on to:
//
//   the Period      navigates. Calendar ↔ TTM is a different cut of the same
//                   Build, and `view.setWindow` owns everything that implies.
//   the unit tabs   commit on click. A different business unit is a different
//                   report, not a narrowing of this one.
//   the filters     are PENDING until APPLY. Narrowing is a sentence you finish
//                   before anyone acts on it — and every filter change costs a
//                   fetch per column, so a bar that applied as you typed would
//                   ask the backend five times to set one filter.
//   the Scale       is neither: it changes how the figures are written, not
//                   which figures they are, so it takes effect at once and is
//                   remembered across screens (ticket 05).
//
// Everything here writes through `useMisViewState` (ticket 02). There is no
// second copy of the view: what APPLY does is put a filter set in the address,
// and what the bar shows next comes back out of it.

/** Which option list each list filter draws on. */
const OPTION_SOURCE: Partial<Record<MisFilterControl, keyof MisFilterOptions>> = {
  salesRegion: "salesRegions",
  subRegion: "subRegions",
  // Both country controls read ONE list, which is `shippingCountries`. The
  // backend sends `billingCountries` as well and the source never reads it —
  // see `misAppConfigs.ts` for why that is reproduced rather than corrected.
  billingCountry: "countries",
  shippingCountry: "countries",
  industry: "industries",
  subIndustry: "subIndustries",
  accountOwner: "accountOwners",
  technicalOwner: "technicalOwners",
  channelManager: "channelManagers",
};

const YEARS_BACK_OPTIONS = Array.from(
  { length: YEARS_BACK_RANGE.max - YEARS_BACK_RANGE.min + 1 },
  (_, index) => YEARS_BACK_RANGE.min + index,
);

const CHANGE_MESSAGE = "Filters changed — apply to refresh";

/** The two ways an Annually Build cuts its columns. Ticket 12 adds the other Periods. */
const WINDOW_OPTIONS: readonly { value: MisWindow; label: string }[] = [
  { value: MIS_WINDOWS.CALENDAR, label: "Annually" },
  { value: MIS_WINDOWS.TTM, label: "TTM" },
];

export default function MisFilterBar({
  view,
  scale,
  options,
  optionsLoading = false,
  optionsErrorMessage = "",
  onRetryOptions,
}: {
  view: MisViewState;
  scale: MisScaleState;
  options: MisFilterOptions;
  /** While true the list menus are empty because they have not arrived, not because they are empty. */
  optionsLoading?: boolean;
  /** Non-empty when `/app-configs` failed; the written-down controls still work. */
  optionsErrorMessage?: string;
  onRetryOptions?: () => void;
}) {
  const { period, table, viewWindow, filters } = view;
  // The three that every rule in `misFilterBarModel` is a question about.
  const filterView: MisFilterView = { period, table, viewWindow };
  const applied = pendingFromApplied(filters, period);

  const [pending, setPending] = useState<MisPendingFilters>(applied);
  // Reseed when the view itself changes underneath the controls — a Window
  // switch coerces the type and resets YTD, and the bar has to show what the
  // grid is now showing rather than what the reader had chosen for the old cut.
  // The Table and Period are here for tickets 10 and 12, which add both.
  const seed = `${table}|${viewWindow}|${period}`;
  const [seededAt, setSeededAt] = useState(seed);
  if (seededAt !== seed) {
    setSeededAt(seed);
    setPending(applied);
  }

  const [expanded, setExpanded] = useState(false);

  const shown = misFilterBarControls(pending, filterView);
  const visible = MIS_FILTER_CONTROL_ORDER.filter((control) => shown.has(control));
  const hasPendingChanges = !samePending(pending, applied);

  const update = (patch: Partial<MisPendingFilters>) =>
    setPending((current) => normalisePending({ ...current, ...patch }, filterView));

  const commit = (next: MisPendingFilters) =>
    view.setView({ filters: appliedFromPending(next, filters, period) });

  const apply = () => commit(pending);

  const clearAll = () => {
    // Everything the BAR owns goes back to this Table's defaults. The unit
    // selection is not among them: it belongs to the tabs above, which commit
    // on their own, and clearing filters is not the same as changing report.
    const defaults = pendingFromApplied(defaultAppliedFilters(period, table), period);
    setPending(defaults);
    commit(defaults);
  };

  // Dismissing a chip is an APPLY of exactly one change, and it leaves any OTHER
  // edit the reader has not applied still pending — which is why the applied set
  // and the pending set are each patched from themselves rather than from a
  // single merged one.
  const removeChip = (key: MisFilterControl) => {
    const defaults = pendingFromApplied(defaultAppliedFilters(period, table), period);
    const one = { [key]: defaults[key] } as Partial<MisPendingFilters>;
    setPending((current) => normalisePending({ ...current, ...one }, filterView));
    commit(normalisePending({ ...applied, ...one }, filterView));
  };

  const changeUnits = (next: MisUnitSelection) => view.setView({ filters: { ...filters, ...next } });

  return (
    <Box sx={{ mb: 1.5 }}>
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", gap: 1.5, flexWrap: "wrap", mb: 1.5 }}
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          value={viewWindow}
          aria-label="Period"
          onChange={(_, next: MisWindow | null) => next && view.setWindow(next)}
        >
          {WINDOW_OPTIONS.map((option) => (
            <ToggleButton key={option.value} value={option.value} sx={{ textTransform: "none" }}>
              {option.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        {/* The label the source uses, which ticket 05 deliberately left for
            whoever built the control. */}
        <FormControlLabel
          sx={{ m: 0 }}
          control={
            <Checkbox
              size="small"
              checked={scale.scale === MIS_SCALES.THOUSANDS}
              onChange={(event) =>
                scale.setScale(event.target.checked ? MIS_SCALES.THOUSANDS : MIS_SCALES.UNITS)
              }
            />
          }
          label={<Typography variant="body2">Values in &apos;000</Typography>}
        />
      </Stack>

      <MisUnitTabs
        selection={{
          buProductSelection: filters.buProductSelection,
          customBusinessUnits: filters.customBusinessUnits,
          customProductUnits: filters.customProductUnits,
        }}
        businessUnitOptions={options.businessUnits}
        productUnitOptions={options.productUnits}
        onChange={changeUnits}
      />

      <Box sx={{ p: 1.5, borderRadius: 1.5, border: 1, borderColor: "divider" }}>
        <Stack
          direction="row"
          sx={{ alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap", mb: 1.25 }}
        >
          <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
            <ListFilterIcon size={16} />
            <Typography variant="subtitle2">Filters</Typography>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            {visible.length > MIS_COLLAPSED_CONTROL_COUNT && (
              <Button
                size="small"
                onClick={() => setExpanded((open) => !open)}
                startIcon={expanded ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />}
              >
                {expanded ? "Less" : "More"}
              </Button>
            )}
            <Button
              size="small"
              variant="contained"
              disabled={!hasPendingChanges}
              onClick={apply}
            >
              Apply
            </Button>
            <Button size="small" variant="outlined" startIcon={<EraserIcon size={14} />} onClick={clearAll}>
              Clear All
            </Button>
          </Stack>
        </Stack>

        {optionsErrorMessage && (
          <Alert
            severity="warning"
            sx={{ mb: 1.25 }}
            action={
              onRetryOptions && (
                <Button size="small" color="inherit" onClick={onRetryOptions}>
                  Retry
                </Button>
              )
            }
          >
            Couldn&apos;t load the filter lists. {optionsErrorMessage} Everything except the
            region, country, industry and owner menus still works.
          </Alert>
        )}

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25 }}>
          {(expanded ? visible : visible.slice(0, MIS_COLLAPSED_CONTROL_COUNT)).map((control) => (
            <Control
              key={control}
              control={control}
              pending={pending}
              view={filterView}
              options={options}
              optionsLoading={optionsLoading}
              onChange={update}
            />
          ))}
        </Box>

        {/* Always mounted, so the live region exists before it has anything to
            say. A region created at the moment its text appears is announced
            unreliably, or not at all. */}
        <Typography
          role="status"
          variant="caption"
          component="p"
          color="text.secondary"
          sx={{ mt: 1, minHeight: 18 }}
        >
          {hasPendingChanges ? CHANGE_MESSAGE : ""}
        </Typography>

        <MisAppliedFilterChips
          chips={describeAppliedFilters(filters, filterView)}
          onRemove={removeChip}
        />
      </Box>
    </Box>
  );
}

const CONTROL_WIDTH = { minWidth: 190, flex: "0 1 190px" } as const;

function Control({
  control,
  pending,
  view,
  options,
  optionsLoading,
  onChange,
}: {
  control: MisFilterControl;
  pending: MisPendingFilters;
  view: MisFilterView;
  options: MisFilterOptions;
  optionsLoading: boolean;
  onChange: (patch: Partial<MisPendingFilters>) => void;
}) {
  if (control === "isYtd" || control === "cumulative") {
    const label = controlLabel(control, view.period);
    return (
      <FormControlLabel
        sx={{ ...CONTROL_WIDTH, m: 0 }}
        control={
          <Checkbox
            size="small"
            checked={pending[control]}
            onChange={(event) => onChange({ [control]: event.target.checked })}
          />
        }
        label={<Typography variant="body2">{label}</Typography>}
      />
    );
  }

  const listSource = OPTION_SOURCE[control];
  if (listSource) {
    const value = pending[control] as string[];
    return (
      <Autocomplete
        multiple
        disableCloseOnSelect
        // One chip plus a count, rather than one chip per value: a reader who
        // has picked nine countries needs the control to stay the height of a
        // control. The full list is in the chip strip below.
        limitTags={1}
        size="small"
        sx={CONTROL_WIDTH}
        value={value}
        options={options[listSource] as string[]}
        // So an empty menu says which of the two empties it is: still coming,
        // or genuinely nothing to choose from.
        loading={optionsLoading}
        noOptionsText={optionsLoading ? "Loading…" : "No options"}
        onChange={(_, next: string[]) => onChange({ [control]: next })}
        renderInput={(params) => <TextField {...params} label={controlLabel(control, view.period)} />}
      />
    );
  }

  if (control === "yearsBack") {
    return (
      <Autocomplete
        disableClearable
        size="small"
        sx={CONTROL_WIDTH}
        value={pending.yearsBack}
        options={YEARS_BACK_OPTIONS}
        getOptionLabel={(option) => String(option)}
        onChange={(_, next: number) => onChange({ yearsBack: next })}
        renderInput={(params) => <TextField {...params} label={controlLabel(control, view.period)} />}
      />
    );
  }

  // Everything left is a single-select over a list this app writes down: the
  // Type a Table and Window allow, and the four closed vocabularies.
  const { values, format } = singleSelect(control, view);
  return (
    <Autocomplete
      disableClearable
      size="small"
      sx={CONTROL_WIDTH}
      value={pending[control] as string}
      options={values as string[]}
      getOptionLabel={format}
      onChange={(_, next: string) => onChange({ [control]: next })}
      renderInput={(params) => <TextField {...params} label={controlLabel(control, view.period)} />}
    />
  );
}

const IDENTITY = (value: string) => value;

function singleSelect(
  control: MisFilterControl,
  { period, table, viewWindow = MIS_WINDOWS.CALENDAR }: MisFilterView,
): { values: readonly string[]; format: (value: string) => string } {
  switch (control) {
    case "typeValue":
      // The SAME function the URL contract validates against, so the menu can
      // never offer a type the address would drop — see `allowedTypeValues`.
      return { values: allowedTypeValues(period, table, viewWindow), format: typeLabel };
    case "confidenceLevel":
      return { values: MIS_CONFIDENCE_OPTIONS, format: confidenceLabel };
    case "viewType":
      return { values: MIS_VIEW_TYPES, format: IDENTITY };
    case "channelDirect":
      return { values: MIS_CHANNEL_DIRECT, format: IDENTITY };
    case "endingMonth":
      return { values: ENDING_MONTH_VALUES, format: IDENTITY };
    // Named rather than defaulted. A `default` here would render the next
    // single-select control anyone adds as an Ending Month — silently, and
    // bound to the right field, so it would look like a styling bug.
    default:
      throw new Error(`MisFilterBar: no single-select options for "${control}"`);
  }
}
