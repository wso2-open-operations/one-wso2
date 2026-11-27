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

import { useEffect, useRef, useState, type JSX } from "react";
import { Alert, Badge, Box, Button, Card, Chip, FormControlLabel, keyframes, Menu, MenuItem, Stack, Switch, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from "@wso2/oxygen-ui";
import { ChartColumnIcon, DownloadIcon, FilterIcon, TableIcon } from "@wso2/oxygen-ui-icons-react";
import { eaSurfaceSx } from "../../components/eaStyles";
import { FilterDate, FilterSelect } from "../../components/FilterFields";
import { fmtDate } from "../../model/format";
import { InfoHint } from "../dashboardParts";
import { utcStamp } from "./costFormat";
import { COST_SOURCE_LABEL, USD_RATE_HINT_WITH_TRANSACTIONS } from "../travelCostText";
import type { CostCtx } from "../widgets/types";
import NotConvertedNote from "./NotConvertedNote";
import CostFilterDialog from "./CostFilterDialog";
import { describeFilter, FILTER_LABEL } from "./filterOptions";
import { FILTER_KEYS, filterCount, type FilterKey } from "./costView";
import { RANGE_PRESETS, rangeFor, rangeProblem, recentYears, type RangePreset } from "./dateRanges";

// A just-added filter chip: three soft rings in the brand colour, then still. Reduced motion gets a plain outline.
const chipPulse = keyframes`
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--oxygen-palette-primary-main) 55%, transparent); }
  100% { box-shadow: 0 0 0 8px color-mix(in srgb, var(--oxygen-palette-primary-main) 0%, transparent); }
`;
const FLASH_MS = 2200;
const FLASH_SX = {
  backgroundColor: "color-mix(in srgb, var(--oxygen-palette-primary-main) 16%, transparent)",
  outline: "1px solid",
  outlineColor: "primary.main",
  animation: `${chipPulse} 700ms ease-out 3`,
  transition: "background-color 300ms",
  "@media (prefers-reduced-motion: reduce)": { animation: "none", outlineWidth: 2 },
} as const;

// The app bar stays on top of the page; a card scrolled to the top must clear it.
const APP_BAR_CLEARANCE = 80;
const VISUALLY_HIDDEN = { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" } as const;

/** The view toggle's buttons: icons, each with its name as tooltip and label. */
const VIEW_MODES = [
  { mode: "charts", label: "Charts", Icon: ChartColumnIcon },
  { mode: "tables", label: "Tables", Icon: TableIcon },
] as const;

/** The Travel Costs controls bar: period, comparison, view, filters, download, and what to know about the figures. */
export default function TravelCostControls({ cost, today, canDownloadTransactions }: { cost: CostCtx; today: string; canDownloadTransactions: boolean }): JSX.Element {
  const { view, set } = cost;
  const data = cost.query.data;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<{ key: string; from: string; to: string }>({ key: "", from: "", to: "" });
  // The custom dates being typed, until both make a valid range. A new applied range replaces them.
  const key = `${view.period.from}|${view.period.to}`;
  const typed = draft.key === key ? draft : { key, from: view.period.from, to: view.period.to };
  const problem = view.range === "custom" ? rangeProblem(typed) : "";

  const pickPreset = (v: string) => {
    const preset = v as RangePreset;
    if (preset === "custom") {
      const r = rangeFor("custom", today, { from: view.period.from, to: view.period.to });
      set({ tcRange: "custom", tcFrom: r.from, tcTo: r.to, tcYear: undefined });
    } else if (preset === "year") set({ tcRange: "year", tcYear: String(view.year ?? recentYears(today)[1]), tcFrom: undefined, tcTo: undefined });
    else set({ tcRange: preset === "ytd" ? undefined : preset, tcYear: undefined, tcFrom: undefined, tcTo: undefined });
  };
  const editDates = (next: { from: string; to: string }) => {
    setDraft({ key, ...next });
    if (!rangeProblem(next)) set({ tcRange: "custom", tcFrom: next.from, tcTo: next.to });
  };
  const download = async (what: "summary" | "transactions") => {
    setMenu(null);
    setBusy(true);
    try {
      await cost.exportCsv(what);
    } finally {
      setBusy(false);
    }
  };

  const active = FILTER_KEYS.filter((k) => view.filters[k]?.length);
  // A click on a chart bar sets a filter somewhere else on the page: show where it went.
  const card = useRef<HTMLElement | null>(null);
  const [flash, setFlash] = useState<FilterKey>();
  const [said, setSaid] = useState("");
  const drill = cost.lastDrill;
  useEffect(() => {
    if (!drill) return;
    const values = view.filters[drill.key];
    setSaid(`Filtered by ${FILTER_LABEL[drill.key]}: ${describeFilter(drill.key, values?.length ? values : [drill.value], data?.facets)}`);
    setFlash(drill.key);
    // The controls card is always on the page (the chip row may not be drawn yet on the first click), so bring it into view
    // when its top is under the app bar or below the fold.
    const el = card.current;
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.top < APP_BAR_CLEARANCE || r.top > window.innerHeight - 80) {
        const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        el.scrollIntoView({ block: "start", behavior: calm ? "auto" : "smooth" });
      }
    }
    const t = setTimeout(() => setFlash(undefined), FLASH_MS);
    return () => clearTimeout(t);
    // Only a new click: the filters it set are read as they stand then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drill?.id]);
  return (
    <Card ref={card} variant="outlined" component="section" aria-label="Travel Costs controls" sx={[{ p: 2, minWidth: 0, scrollMarginTop: APP_BAR_CLEARANCE + 16 }, eaSurfaceSx]}>
      <Stack direction="row" useFlexGap spacing={2.5} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1.5 }}>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
          <Typography component="h2" sx={{ fontSize: 15, fontWeight: 600 }}>
            Travel Costs
          </Typography>
          <InfoHint label="How USD is calculated">{USD_RATE_HINT_WITH_TRANSACTIONS}</InfoHint>
        </Stack>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ minWidth: 180 }}>
          <FilterSelect label="Period" anyLabel={null} value={view.range} options={RANGE_PRESETS.map((p) => [p.value, p.label] as const)} onChange={pickPreset} />
        </Box>
        {view.range === "year" ? (
          <Box sx={{ minWidth: 110 }}>
            <FilterSelect
              label="Year"
              anyLabel={null}
              value={String(view.year ?? recentYears(today)[1])}
              options={recentYears(today).map((y) => [String(y), String(y)] as const)}
              onChange={(v) => set({ tcYear: v })}
            />
          </Box>
        ) : null}
        {view.range === "custom" ? (
          <Stack direction="row" spacing={1.5}>
            <Box sx={{ minWidth: 150 }}>
              <FilterDate label="Start Date" value={typed.from} onChange={(v) => editDates({ from: v, to: typed.to })} />
            </Box>
            <Box sx={{ minWidth: 150 }}>
              <FilterDate label="End Date" value={typed.to} onChange={(v) => editDates({ from: typed.from, to: v })} />
            </Box>
          </Stack>
        ) : null}
        <FormControlLabel
          control={<Switch size="small" checked={view.compare} onChange={(e) => set({ tcCompare: e.target.checked ? undefined : "0" })} />}
          label="Compare With Last Year"
          slotProps={{ typography: { fontSize: 13 } }}
          sx={{ m: 0, gap: 1 }}
        />
        <ToggleButtonGroup exclusive size="small" value={view.mode} onChange={(_, v: "charts" | "tables" | null) => v && set({ tcView: v === "tables" ? "tables" : undefined })} aria-label="View" sx={{ "& .MuiToggleButton-root": { px: 1.25, height: 36 } }}>
          {VIEW_MODES.map(({ mode, label, Icon }) => (
            <Tooltip key={mode} title={label}>
              <ToggleButton value={mode} aria-label={label} aria-pressed={view.mode === mode}>
                <Icon size={16} aria-hidden />
              </ToggleButton>
            </Tooltip>
          ))}
        </ToggleButtonGroup>
        <Badge color="primary" badgeContent={filterCount(view)} invisible={!filterCount(view)}>
          <Button variant="outlined" size="small" startIcon={<FilterIcon size={15} />} onClick={() => setFiltersOpen(true)} sx={{ fontWeight: 600, height: 36 }}>
            Filters
          </Button>
        </Badge>
        <Button variant="outlined" size="small" startIcon={<DownloadIcon size={15} />} disabled={busy} onClick={(e) => setMenu(e.currentTarget)} aria-haspopup="menu" sx={{ fontWeight: 600, height: 36 }}>
          {busy ? "Downloading…" : "Download CSV"}
        </Button>
        <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)}>
          <MenuItem onClick={() => void download("summary")}>Summary CSV</MenuItem>
          {canDownloadTransactions ? <MenuItem onClick={() => void download("transactions")}>Transactions CSV</MenuItem> : null}
        </Menu>
      </Stack>
      {problem ? (
        <Typography variant="caption" color="error" role="alert" sx={{ display: "block", mt: 0.75 }}>
          {problem}
        </Typography>
      ) : null}
      <Box component="span" role="status" sx={VISUALLY_HIDDEN}>
        {said}
      </Box>
      {active.length ? (
        <Stack direction="row" spacing={0.75} sx={{ mt: 1.5, flexWrap: "wrap", rowGap: 0.75 }}>
          {active.map((k: FilterKey) => (
            <Chip
              key={k}
              size="small"
              data-highlighted={k === flash ? "true" : undefined}
              sx={k === flash ? FLASH_SX : { transition: "background-color 300ms" }}
              label={`${FILTER_LABEL[k]}: ${describeFilter(k, view.filters[k] ?? [], data?.facets)}`} onDelete={() => set({ [k]: undefined })} />
          ))}
          {active.length > 1 ? (
            <Button size="small" variant="text" onClick={() => set(Object.fromEntries(active.map((k) => [k, undefined])))} sx={{ minWidth: 0, py: 0, px: 1 }}>
              Clear All
            </Button>
          ) : null}
        </Stack>
      ) : null}
      {data ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          Period {fmtDate(data.from)} to {fmtDate(data.to)}. {data.compare ? `Compared With ${fmtDate(data.compare.from)} to ${fmtDate(data.compare.to)}. ` : ""}Data As Of {utcStamp(data.dataAsOf)}.
        </Typography>
      ) : null}
      {data?.failedSources.length ? (
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          Some figures are missing. {data.failedSources.map((s) => COST_SOURCE_LABEL[s]).join(" and ")} could not be read, so they are left out of every total.
        </Alert>
      ) : null}
      {data?.comparisonFailedSources.length || data?.comparisonTruncated ? (
        <Alert severity="info" sx={{ mt: 1.5 }}>
          Last year's figures are incomplete{data.comparisonFailedSources.length ? `, ${data.comparisonFailedSources.map((s) => COST_SOURCE_LABEL[s]).join(" and ")} could not be read for that period` : ""}, so no change against last year is shown.
        </Alert>
      ) : null}
      {data?.truncated ? (
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          This range has more lines than the dashboard can total. Choose a shorter period.
        </Alert>
      ) : null}
      <NotConvertedNote rows={data?.notConverted ?? []} ratesPending={data?.ratesPending} />
      {filtersOpen ? (
        <CostFilterDialog
          view={view}
          facets={data?.facets}
          onClose={() => setFiltersOpen(false)}
          onApply={(patch) => {
            setFiltersOpen(false);
            set(patch);
          }}
        />
      ) : null}
    </Card>
  );
}
