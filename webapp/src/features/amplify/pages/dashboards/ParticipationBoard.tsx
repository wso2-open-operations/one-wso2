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

import { useState, type ReactNode } from "react";
import { Box, Button, ButtonBase, Chip, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@wso2/oxygen-ui";
import { humanizeHttpError } from "@api/http";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { DashboardParticipation, GroupBoard, GroupSort, SortDir } from "../../api/amplifyTypes";
import { useDashboardExport, useDashboardParticipation, useGroupBoard } from "../../api/useAmplifyDashboards";
import AmplifyShell from "../../components/AmplifyShell";
import { Bar, Block, BoardState, Empty } from "../../components/DashboardParts";
import {
  exportRange,
  exportRangeProblem,
  nextSort,
  updatedStamp,
  num,
  percentOf,
  rate,
  type ExportPeriod,
} from "../../util/dashboardFormat";

/** Employees → connected → reposted → active: where people drop out. */
export function Funnel({ data }: { data: DashboardParticipation }) {
  const f = data.funnel;
  const top = f.employees && f.employees > 0 ? f.employees : Math.max(1, f.connected);
  const steps: { name: string; value: number; detail: string; color?: string }[] = [];
  if (f.employees != null) {
    steps.push({ name: "Employees", value: f.employees, detail: num(f.employees), color: "text.disabled" });
  }
  steps.push({
    name: "Connected LinkedIn",
    value: f.connected,
    detail: f.employees ? `${num(f.connected)} · ${percentOf(f.connected, f.employees)}` : num(f.connected),
  });
  steps.push({
    name: "Reposted at least once",
    value: f.reposted,
    detail: `${num(f.reposted)} · ${percentOf(f.reposted, f.connected)} of connected`,
  });
  steps.push({
    name: "Active in last 30 days",
    value: f.active30Days,
    detail: `${num(f.active30Days)} · ${percentOf(f.active30Days, f.connected)} of connected`,
    color: "primary.main",
  });
  return (
    <Block title="Employee journey">
      <Box component="ol" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1.5 }}>
        {steps.map((s) => (
          <Box component="li" key={s.name} sx={{ display: "flex", alignItems: "center", gap: 1.75, flexWrap: "wrap" }}>
            <Box sx={{ flex: "0 0 170px" }}>{s.name}</Box>
            <Bar fraction={s.value / top} label={`${s.name}: ${s.value}`} color={s.color} />
            <Box sx={{ flex: "0 0 190px", fontSize: 14 }}>{s.detail}</Box>
          </Box>
        ))}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        {num(f.expired)} connections have expired.
        {f.employees != null && f.employees > f.connected
          ? ` ${num(f.employees - f.connected)} employees have never connected.`
          : ""}
      </Typography>
    </Block>
  );
}

interface Column {
  key: GroupSort | "bu";
  label: string;
  numeric: boolean;
  align?: "right";
  sortable: boolean;
}

const columnsFor = (nameLabel: string, withBu: boolean): Column[] => [
  { key: "rank", label: "#", numeric: true, sortable: true },
  { key: "name", label: nameLabel, numeric: false, sortable: true },
  ...(withBu ? [{ key: "bu", label: "BU", numeric: false, sortable: false } as Column] : []),
  { key: "points", label: "Points", numeric: true, align: "right", sortable: true },
  { key: "participants", label: "Participants", numeric: true, align: "right", sortable: true },
  { key: "headcount", label: "Headcount", numeric: true, align: "right", sortable: true },
  { key: "participation", label: "Participation", numeric: true, sortable: true },
];

/** A ranked group board (teams or houses); every sortable header is a button that sorts on the server. */
function GroupTable({
  title,
  noun,
  nameLabel,
  withBu,
  action,
  board,
  sort,
  dir,
  onSort,
}: {
  title: string;
  /** Plural, for the empty and footnote text. */
  noun: string;
  nameLabel: string;
  withBu: boolean;
  action?: ReactNode;
  board: GroupBoard | undefined;
  sort: GroupSort;
  dir: SortDir;
  onSort: (col: GroupSort) => void;
}) {
  const COLUMNS = columnsFor(nameLabel, withBu);
  return (
    <Block title={title} action={action}>
      {!board || board.entries.length === 0 ? (
        <Empty>No {noun} to show.</Empty>
      ) : (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 640 }}>
            <TableHead>
              <TableRow>
                {COLUMNS.map((c) => {
                  const active = c.sortable && sort === c.key;
                  return (
                    <TableCell
                      key={c.key}
                      align={c.align}
                      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : c.sortable ? "none" : undefined}
                    >
                      {c.sortable ? (
                        <ButtonBase
                          onClick={() => onSort(c.key as GroupSort)}
                          sx={{ font: "inherit", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 0.5 }}
                        >
                          {c.label}
                          <span aria-hidden="true" style={{ width: 12, display: "inline-block" }}>
                            {active ? (dir === "asc" ? "↑" : "↓") : ""}
                          </span>
                        </ButtonBase>
                      ) : (
                        c.label
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableHead>
            <TableBody>
              {board.entries.map((e) => (
                <TableRow key={e.key}>
                  <TableCell>{e.rank}</TableCell>
                  <TableCell>{e.name}</TableCell>
                  {withBu && <TableCell>{e.businessUnit ?? "-"}</TableCell>}
                  <TableCell align="right">{num(e.points)}</TableCell>
                  <TableCell align="right">{num(e.participants)}</TableCell>
                  <TableCell align="right">{num(e.headcount)}</TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box sx={{ flex: "0 0 90px", display: "flex" }}>
                        <Bar fraction={e.participationRate} label={rate(e.participationRate)} />
                      </Box>
                      {rate(e.participationRate)}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
      {board && board.unassigned.participants > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          {num(board.unassigned.participants)} people with {num(board.unassigned.points)} points aren&apos;t placed in a{" "}
          {nameLabel.toLowerCase()} by the people directory.
        </Typography>
      )}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Points are all-time. Participation is people with points out of {nameLabel.toLowerCase()} headcount.
      </Typography>
    </Block>
  );
}

/** The teams of one business unit, ranked. */
export function TeamTable({
  board,
  bus,
  bu,
  onBu,
  sort,
  dir,
  onSort,
}: {
  board: GroupBoard | undefined;
  /** Business units in rank order (best first). */
  bus: string[];
  /** The one selected BU. */
  bu: string | undefined;
  onBu: (bu: string) => void;
  sort: GroupSort;
  dir: SortDir;
  onSort: (col: GroupSort) => void;
}) {
  return (
    <GroupTable
      title="Team leaderboard"
      noun="teams"
      nameLabel="Team"
      withBu
      board={board}
      sort={sort}
      dir={dir}
      onSort={onSort}
      action={
        <Box role="group" aria-label="Business unit" sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
          {bus.map((b) => (
            <Chip
              key={b}
              size="small"
              label={b}
              color={bu === b ? "primary" : "default"}
              variant={bu === b ? "filled" : "outlined"}
              onClick={() => onBu(b)}
              aria-pressed={bu === b}
            />
          ))}
        </Box>
      }
    />
  );
}

/** Every house, ranked. */
export function HouseTable({
  board,
  sort,
  dir,
  onSort,
}: {
  board: GroupBoard | undefined;
  sort: GroupSort;
  dir: SortDir;
  onSort: (col: GroupSort) => void;
}) {
  return <GroupTable title="House leaderboard" noun="houses" nameLabel="House" withBu={false} board={board} sort={sort} dir={dir} onSort={onSort} />;
}

const EXPORT_PERIODS: { key: ExportPeriod; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

/** Saves a CSV blob under `name` through a temporary link. */
function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Export: Day / Week / Month / Year pills (to today, UTC) or a from/to calendar, then a CSV of the raw rows
 * every board is counted from. A pill fills the dates in; typing a date unselects the pill.
 */
export function ExportPanel({ onExport, now }: { onExport: (from: string, to: string) => Promise<Blob>; now?: Date }) {
  const [period, setPeriod] = useState<ExportPeriod | null>("month");
  const [range, setRange] = useState(() => exportRange("month", now));
  const [busy, setBusy] = useState(false);
  const { showError } = useNotifications();
  const problem = exportRangeProblem(range.from, range.to);
  const pick = (p: ExportPeriod) => {
    setPeriod(p);
    setRange(exportRange(p, now));
  };
  const download = async () => {
    setBusy(true);
    try {
      saveFile(await onExport(range.from, range.to), `amplify-${range.from}-to-${range.to}.csv`);
    } catch (err) {
      showError(humanizeHttpError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Block title="Export">
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Box role="group" aria-label="Period" sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
          {EXPORT_PERIODS.map((p) => (
            <Chip
              key={p.key}
              label={p.label}
              color={period === p.key ? "primary" : "default"}
              variant={period === p.key ? "filled" : "outlined"}
              onClick={() => pick(p.key)}
              aria-pressed={period === p.key}
            />
          ))}
        </Box>
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
          <TextField
            type="date"
            size="small"
            label="From"
            value={range.from}
            onChange={(e) => {
              setPeriod(null);
              setRange({ ...range, from: e.target.value });
            }}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: range.to || undefined } }}
          />
          <TextField
            type="date"
            size="small"
            label="To"
            value={range.to}
            onChange={(e) => {
              setPeriod(null);
              setRange({ ...range, to: e.target.value });
            }}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: range.from || undefined } }}
          />
          <Button variant="contained" onClick={() => void download()} disabled={problem !== null || busy}>
            {busy ? "Preparing…" : "Download CSV"}
          </Button>
        </Box>
        {problem && (
          <Typography variant="body2" color="error" role="alert">
            {problem}
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary">
          One row for every repost, share attempt, points entry, post opened and LinkedIn connection in the range (UTC days, both
          ends included). The record_type column tells them apart.
        </Typography>
      </Box>
    </Block>
  );
}

export default function ParticipationPage() {
  const exportRows = useDashboardExport();
  const funnel = useDashboardParticipation();
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const [order, setOrder] = useState<{ sort: GroupSort; dir: SortDir }>({ sort: "rank", dir: "asc" });
  const bus = useGroupBoard("BU");
  // Best-ranked BU first; the first one is selected until the reader picks another.
  const buNames = (bus.data?.entries ?? []).map((e) => e.name);
  const bu = picked && buNames.includes(picked) ? picked : buNames[0];
  const teams = useGroupBoard("TEAM", bu, order.sort, order.dir, bu !== undefined);
  const [houseOrder, setHouseOrder] = useState<{ sort: GroupSort; dir: SortDir }>({ sort: "rank", dir: "asc" });
  const houses = useGroupBoard("HOUSE", undefined, houseOrder.sort, houseOrder.dir);
  return (
    <AmplifyShell
      title="Participation"
      subtitle="Where employees drop out between hearing of Amplify and reposting regularly, and which teams lead."
    >
      <BoardState queries={[funnel]}>
        {funnel.data && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography variant="caption" color="text.secondary">
              {updatedStamp(funnel.data.asOf)}
            </Typography>
            <Funnel data={funnel.data} />
            <BoardState queries={bus.data && buNames.length === 0 ? [bus] : [bus, teams]}>
              <TeamTable
                board={teams.data}
                bus={buNames}
                bu={bu}
                onBu={setPicked}
                sort={order.sort}
                dir={order.dir}
                onSort={(col) => setOrder((cur) => nextSort(cur, col))}
              />
            </BoardState>
            <BoardState queries={[houses]}>
              <HouseTable
                board={houses.data}
                sort={houseOrder.sort}
                dir={houseOrder.dir}
                onSort={(col) => setHouseOrder((cur) => nextSort(cur, col))}
              />
            </BoardState>
            <ExportPanel onExport={exportRows} />
          </Box>
        )}
      </BoardState>
    </AmplifyShell>
  );
}
