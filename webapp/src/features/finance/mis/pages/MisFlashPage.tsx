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

import { useMemo, useState } from "react";
import {
  Box,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import { useDocumentTitle } from "@hooks/useDocumentTitle";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import MisShell from "../components/MisShell";
import MisFlashFilters from "../components/MisFlashFilters";
import MisFlashDetailDialog from "../components/MisFlashDetailDialog";
import MisExportButton, { type MisExportChoice } from "../components/MisExportButton";
import BuildTable, { type BuildCellFor } from "../components/BuildTable";
import {
  FLASH_UNIT_COLUMNS,
  flashPnlFigure,
  flashPnlRows,
  type FlashUnitColumn,
} from "../components/flashPnlRows";
import { flashSectionIds } from "../components/flashRowIds";
import { flashDetailRows } from "../components/flashDetailRows";
import { useFlashBalanceStatement } from "../api/useFlashBalanceStatement";
import { useFlashSubRegions } from "../api/useFlashSubRegions";
import { useFlashDetail } from "../api/useFlashDetail";
import { useFlashDetailReader } from "../api/useFlashDetailReader";
import {
  misFlashAnnualSheet,
  misFlashMonthlySheet,
  misFlashReportFilename,
  type MisFlashReportContext,
} from "../export/misFlashWorkbook";
import {
  chosenMonth,
  defaultFlashMonths,
  flashMonthlyRanges,
  flashRangeOf,
  loadedMonth,
  pacificMonth,
  resetFlashMonths,
  type FlashMonthFilter,
  type MisFlashRange,
  type MisMonth,
} from "../util/misFlashPeriods";
import { flashSubRegionsFor } from "../util/misFlashSubRegions";
import { amountUnitCaption, formatMisValue } from "../util/misMoney";
import { useScalePreference } from "../util/ScalePreferenceContext";
import { MIS_SCALES } from "../util/misViewVocabulary";

// Flash Dashboard — the monthly P&L reported ahead of a formal close.
//
// The one MIS screen behind the Flash privilege (`789`), which is INDEPENDENT
// of the ARR one: a reader here may hold neither of the ARR dashboards, and a
// reader of those may not open this. `MisShell` takes the gate id and
// `useMisGate` makes that decision; spec §10.11 pins both halves and is closed
// by ticket 01's routing and rail suites.
//
// ---- what ticket 15 builds, and what the tickets after it add --------------
//
// This is the only MIS surface where users WRITE. Forecasts are written from
// the detail dialog, against the GL accounts behind a figure rather than on the
// P&L itself (ticket 16 — see `MisFlashAccountsDialog`).
// The ExcelJS export is ticket 18's: the source's Export menu, whose Full
// Report is this P&L plus all six units' monthly views, and whose Annual Report
// is the P&L alone (`misFlashWorkbook`). Still ahead: comments against the
// admin backend (ticket 17, blocked on ticket 04 establishing whether that
// backend is alive at all), which extends this screen and the detail dialog
// behind it rather than replacing them.
//
// ---- three date computations in one screen ---------------------------------
//
// The source asks the backend for a different range depending on how the reader
// got there — first-of-month on load, last-of-month on Search, and a third pair
// a month earlier again on Reset. All three are reproduced under ADR 0003 and
// recorded in spec §8; `misFlashPeriods` holds each and says why.
//
// ---- and why the filters are a draft, committed by Search -------------------
//
// Nothing here refetches on change. That is the source's shape, and on a screen
// whose read is a fourteen-section P&L across six business units it is the
// right one — but it is also what makes the three ranges above expressible at
// all: the range a read asks for depends on which button committed it, so a
// filter that settled itself would have nothing to say about which.

/** The screen's own name, in the rail, the tab title and the heading. */
const TITLE = "Flash Dashboard";

export default function MisFlashPage() {
  useDocumentTitle(TITLE);

  return (
    <MisShell
      gateId="mis-flash"
      title={TITLE}
      subtitle="The monthly P&L flash: revenue, cost of sales, gross profit and margin."
      // The figures here come from the FLASH service, not the ARR one that
      // answered for the gate — so the shell owns "not connected" for this
      // screen too, which is what a Page shell is for (CONTEXT.md).
      backend="flash"
    >
      <Flash />
    </MisShell>
  );
}

/**
 * What the screen is currently SHOWING, as opposed to what is being edited.
 *
 * `settled`, not `applied`: CONTEXT.md reserves **Applied filter** for one
 * serialised into the query string, and nothing on this screen is (§11.15).
 * `MisArrAnalysisPage` names its own committed filters the same way, for the
 * same reason.
 */
interface SettledFlash {
  months: { start: MisMonth; end: MisMonth };
  /** The dates the backend is asked for — see `misFlashPeriods`. */
  range: MisFlashRange;
  /** Already expanded, and fixed at the moment Search was pressed. */
  subRegions: readonly string[];
}

/** Inside the shell, so it is only mounted once the gate has said yes. */
function Flash() {
  // Read once per mount, not per render: every request resolves its months
  // against this, and a value that moved mid-session would re-key every query
  // at midnight Pacific.
  const [today] = useState(pacificMonth);

  // The two ends as the source's `filterState` holds them: a month, and the
  // date that month will send. Which is not one fact — see `FlashMonthFilter`.
  const [draft, setDraft] = useState(() => {
    const months = defaultFlashMonths(today);
    return {
      start: loadedMonth(months.start),
      end: loadedMonth(months.end),
      regions: [] as string[],
    };
  });
  const [settled, setSettled] = useState<SettledFlash>(() => {
    const months = defaultFlashMonths(today);
    // First-of-month at BOTH ends, because neither picker has been moved. A
    // Search pressed right now asks this same question again.
    return {
      months,
      range: flashRangeOf(loadedMonth(months.start), loadedMonth(months.end)),
      subRegions: [],
    };
  });

  // Keyed by the SETTLED range, so the menu and the statement under it always
  // describe the same period — which is what the source does by refetching on
  // `dateFilter` rather than on the pickers.
  const subRegions = useFlashSubRegions(settled.range);
  const statement = useFlashBalanceStatement(settled.range, settled.subRegions);

  const pnl = useMemo(() => flashPnlRows(statement.statement), [statement.statement]);
  const { rows, figures } = pnl;
  // In the words the status line above the table uses, so the file's title and
  // the screen describe one range one way.
  const rangeLabel = `${settled.range.startDate} to ${settled.range.endDate}`;

  const { preference: scale, setPreference: setScale } = useScalePreference();

  // Which business unit's monthly detail is open. The unit rather than a
  // boolean: the dialog's request is built from it, and `null` is the shut
  // state that keeps `useFlashDetail` from asking anything.
  const [openUnit, setOpenUnit] = useState<FlashUnitColumn | null>(null);
  const detailRanges = useMemo(
    () => flashMonthlyRanges(settled.months.start, settled.months.end),
    [settled.months],
  );
  const detailRequest = useMemo(
    () =>
      openUnit
        ? {
            businessUnit: openUnit.businessUnit,
            ranges: detailRanges,
            // Integration alone, reproducing the source's five lower-case
            // `subregions=` props — see `FlashUnitColumn.sendsSubRegions` and
            // spec §8. So a narrowed P&L opens an UNnarrowed monthly view on
            // five of its six columns, in both apps.
            subRegions: openUnit.sendsSubRegions ? settled.subRegions : [],
          }
        : null,
    [openUnit, detailRanges, settled.subRegions],
  );
  const detail = useFlashDetail(detailRequest);
  const readDetails = useFlashDetailReader();

  /** What the P&L was asked under, and the moment the export was taken. */
  const reportContext = (instant: Date): MisFlashReportContext => ({
    subRegions: settled.subRegions,
    rangeLabel,
    instant,
  });

  // The source's Export menu, both items (`FlashConsole.js`). The Full Report
  // reads every unit's monthly view first — the source warns it "may take a few
  // minutes" — and narrows EVERY unit by the reader's sub-regions, which its
  // own dialogs do not (spec §8). So with a sub-region applied, five of its
  // sheets differ from those units' dialogs, in both apps.
  const exportChoices: readonly MisExportChoice[] = [
    {
      label: "Full Report",
      workbook: async (instant) => {
        const answers = await readDetails(
          FLASH_UNIT_COLUMNS.map((unit) => ({
            businessUnit: unit.businessUnit,
            ranges: detailRanges,
            subRegions: settled.subRegions,
          })),
        );
        return {
          sheets: [
            misFlashAnnualSheet(pnl, "full", reportContext(instant)),
            ...FLASH_UNIT_COLUMNS.map((unit, index) =>
              misFlashMonthlySheet(
                unit,
                flashDetailRows(answers[index].sales, answers[index].accounts),
                detailRanges,
                settled.subRegions,
              ),
            ),
          ],
        };
      },
      filename: (instant) => misFlashReportFilename("full", instant),
    },
    {
      label: "Annual Report",
      workbook: (instant) => ({
        sheets: [misFlashAnnualSheet(pnl, "annual", reportContext(instant))],
      }),
      filename: (instant) => misFlashReportFilename("annual", instant),
    },
  ];

  const columnGroups = useMemo(
    () =>
      FLASH_UNIT_COLUMNS.map((unit) => ({
        ...unit,
        // The source's affordance: a column header opens that unit's monthly
        // view. Here it stays a `<th>` with a button inside it, so the figures
        // below keep a header to point at.
        onActivate: () => setOpenUnit(unit),
      })),
    [],
  );

  const cell: BuildCellFor = (row, group) => {
    const held = figures.get(row.id);
    // A section heading carries no figures of its own — the source's does not
    // either. Blank, not nought.
    if (!held) return { text: "" };
    // The export's sheet reads through this same function — spec §10.18.
    const raw = flashPnlFigure(figures, row, group);
    return {
      // Ticket 05. `formatMisValue` reads `scale` in the currency branch and
      // nowhere else, so Gross Margin — the one percentage section — cannot be
      // divided by a thousand however this is called. Spec §3.
      text: formatMisValue(raw, held.valueType, { scale }),
      negative: typeof raw === "number" && raw < 0,
    };
  };

  const settleTo = (start: FlashMonthFilter, end: FlashMonthFilter, regions: readonly string[]) =>
    setSettled({
      months: { start: start.month, end: end.month },
      range: flashRangeOf(start, end),
      // Expanded HERE rather than on the way into the request, so the
      // sub-regions are fixed against the menu the reader was actually looking
      // at. Deriving them later would re-expand against a menu that has since
      // refetched for the new range — briefly empty, so the P&L would arrive
      // unfiltered and then change under them.
      subRegions: flashSubRegionsFor(regions, subRegions.groups),
    });

  // A picker the reader MOVES starts sending the last of its month, and the one
  // they leave alone keeps sending the first. That is per picker in the source
  // too — see `FlashMonthFilter`.
  const onMonthChange = (which: "start" | "end", month: MisMonth) =>
    setDraft((held) => ({ ...held, [which]: chosenMonth(month) }));

  const onSearch = () => settleTo(draft.start, draft.end, draft.regions);

  const onReset = () => {
    // NOT where the screen opened. Spec §8 — `resetFlashMonths` says why. And
    // Reset writes last-of-month into BOTH ends, so a Search straight after it
    // sends those rather than the first-of-month pair the load sent.
    const months = resetFlashMonths(today);
    const start = chosenMonth(months.start);
    const end = chosenMonth(months.end);
    setDraft({ start, end, regions: [] });
    settleTo(start, end, []);
  };

  // Nothing here closes the detail dialog, and nothing needs to: it is modal,
  // so the filter bar beneath it cannot be reached while it is open. A guard
  // here would be a line no test could exercise.

  return (
    <Box>
      <MisFlashFilters
        months={{ start: draft.start.month, end: draft.end.month }}
        regions={draft.regions}
        groups={subRegions.groups}
        groupsLoading={subRegions.isLoading}
        groupsErrorMessage={subRegions.isError ? subRegions.errorMessage : ""}
        onRetryGroups={subRegions.retry}
        onMonthChange={onMonthChange}
        onRegionsChange={(regions) => setDraft((held) => ({ ...held, regions }))}
        onSearch={onSearch}
        onReset={onReset}
      />

      <Stack
        direction="row"
        sx={{
          alignItems: "baseline",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1,
          mb: 0.75,
        }}
      >
        {/* Always mounted, so the region exists before it has anything to say —
            one created at the moment its text appears is announced unreliably
            or not at all. `MisFilterBar` keeps its own mounted for the same
            reason. */}
        <Typography
          role="status"
          variant="caption"
          component="p"
          color="text.secondary"
          sx={{ minHeight: 18 }}
        >
          {statement.isLoading ? "Loading the P&L…" : statement.isError ? "" : rangeLabel}
        </Typography>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          {/* The caption travels with the TABLE rather than with the control,
              because Finance's workflow is to crop one into a deck. */}
          <Typography variant="caption" color="text.secondary">
            {amountUnitCaption(scale)}
          </Typography>
          {/* The same label and the same stored preference as the Build's bar,
              so switching screens does not switch units under the reader. The
              source defaults this screen ALONE to thousands
              (`TableView.js`'s `useState(true)`); the port keeps one
              cross-screen preference instead, which spec §4 already settled. */}
          <FormControlLabel
            sx={{ m: 0 }}
            control={
              <Checkbox
                size="small"
                checked={scale === MIS_SCALES.THOUSANDS}
                onChange={(event) =>
                  setScale(event.target.checked ? MIS_SCALES.THOUSANDS : MIS_SCALES.UNITS)
                }
              />
            }
            label={<Typography variant="body2">Values in &apos;000</Typography>}
          />
          {/* Only once there is a P&L to write — the source disables its menu
              until then. Always at units whatever the box beside it says, and
              the file says so. */}
          {!statement.isLoading && !statement.isError && (
            <MisExportButton choices={exportChoices} />
          )}
        </Stack>
      </Stack>

      {statement.isError ? (
        <ErrorNotice onRetry={statement.retry} sx={{ mt: 1.5 }}>
          Couldn&apos;t load the P&amp;L. {statement.errorMessage}
        </ErrorNotice>
      ) : statement.isLoading ? (
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", mt: 2 }}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">
            Loading the P&amp;L…
          </Typography>
        </Stack>
      ) : (
        <BuildTable
          label="Monthly P&L flash"
          // The source leaves this header blank (`renderHeader: () =>
          // <strong></strong>`). A named column costs nothing and is the
          // difference between a screen reader saying "Revenue, 1,234" and
          // saying "blank, 1,234" — and `BuildTable`'s whole `headers` wiring
          // exists so a figure can be placed by the cells that head it.
          rowLabelHeader="Line"
          columnGroups={columnGroups}
          // No sub-division: one figure column per business unit.
          subColumns={[]}
          rows={rows}
          cell={cell}
          // Every section open, every sub-level folded — the statement as the
          // source's flat grid shows it, with the sub-levels still behind an
          // interaction.
          defaultExpandedIds={flashSectionIds(rows)}
        />
      )}

      <MisFlashDetailDialog
        open={Boolean(openUnit)}
        onClose={() => setOpenUnit(null)}
        unit={openUnit}
        ranges={detailRanges}
        subRegions={detailRequest?.subRegions ?? []}
        state={detail}
        scale={scale}
      />
    </Box>
  );
}
