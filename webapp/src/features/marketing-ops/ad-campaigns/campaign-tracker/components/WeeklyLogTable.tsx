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

// The Weekly Log: one shared log across all BUs and platforms. Every
// optimization and major change gets an entry — what, why, expected impact,
// follow-up date, outcome. Golden rule: if it's not in the log, it did not happen.
//
// A row here is a work SESSION (group) — same date/owner/BU/campaign — which
// can contain several distinct child CHANGES (entries), each with its own
// type ("Budget Change", "Creative Change", ...) and "what changed" text.
// That's why entry type lives on the child rows, not the group: a single
// sitting can span more than one kind of change.

import { Fragment, useMemo, useState } from "react";
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  MenuItem,
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogActions,
  TextField,
  Switch,
  Autocomplete,
} from "@wso2/oxygen-ui";
import { Plus, ChevronDown, ChevronUp, ChevronRight, Eye, Pencil, Link2Off, RotateCcw } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import {
  WeeklyLogRow,
  WeeklyLogEntryRow,
  BusinessUnit,
  AdPlatform,
  EntryType,
  LogStatus,
  BUSINESS_UNITS,
  ENTRY_TYPES,
  LOG_STATUSES,
  parseLocalDate,
} from "../campaignTrackerTypes";
import { CHART_COLORS } from "../../analytics/chartTheme";
import { NUMERIC, ToneChip } from "./campaignTrackerPrimitives";
import { MultiSelectFilter, InlineDateRangeFilter, ClearFiltersButton, RowCount } from "./FilterControls";

// Advanced filter: Status/BU/Entry type/Owner are each multi-select (OR
// within the field); the Completed and Follow-up date ranges narrow further.
// Every field ANDs with the rest. Entry type matches if ANY child entry has
// one of the selected types (the group itself has no single type anymore).
export interface LogFilters {
  statuses: LogStatus[];
  bus: BusinessUnit[];
  types: EntryType[];
  owners: string[];
  completedFrom: string;
  completedTo: string;
  followUpFrom: string;
  followUpTo: string;
}
export const EMPTY_LOG_FILTERS: LogFilters = {
  statuses: [],
  bus: [],
  types: [],
  owners: [],
  completedFrom: "",
  completedTo: "",
  followUpFrom: "",
  followUpTo: "",
};
function countActiveLog(f: LogFilters): number {
  return (
    f.statuses.length +
    f.bus.length +
    f.types.length +
    f.owners.length +
    (f.completedFrom ? 1 : 0) +
    (f.completedTo ? 1 : 0) +
    (f.followUpFrom ? 1 : 0) +
    (f.followUpTo ? 1 : 0)
  );
}
function matchesLogFilters(row: WeeklyLogRow, f: LogFilters): boolean {
  if (f.statuses.length && !f.statuses.includes(row.status)) return false;
  if (f.bus.length && !f.bus.includes(row.bu)) return false;
  if (f.owners.length && !f.owners.includes(row.owner)) return false;
  if (f.types.length && !row.entries.some((e) => f.types.includes(e.entryType))) return false;
  if (f.completedFrom && row.completedDate < f.completedFrom) return false;
  if (f.completedTo && row.completedDate > f.completedTo) return false;
  if (f.followUpFrom && (!row.followUpDate || row.followUpDate < f.followUpFrom)) return false;
  if (f.followUpTo && (!row.followUpDate || row.followUpDate > f.followUpTo)) return false;
  return true;
}

// Entry types are categories, not outcomes — colored from the same
// categorical palette Ad Campaigns' Analytics charts use (chartTheme.ts),
// rather than the semantic success/warning/error palette.
const ENTRY_COLOR: Record<EntryType, string> = Object.fromEntries(
  ENTRY_TYPES.map((t, i) => [t, CHART_COLORS[i % CHART_COLORS.length]]),
) as Record<EntryType, string>;

const LOG_STATUS_COLOR: Record<LogStatus, string> = {
  "Not Set": "text.secondary",
  "Not Started": "text.secondary",
  "In Progress": "warning.main",
  Completed: "success.main",
};

const fmtDate = (d: string | null) => {
  const parsed = d ? parseLocalDate(d) : null;
  return parsed ? parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—";
};
const fmtGroupDate = (d: string) => {
  const parsed = parseLocalDate(d);
  return parsed ? parsed.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" }) : "—";
};

type GroupByOption = "date" | "campaign" | "bu" | "status" | "followup";
const GROUP_BY_OPTIONS: { value: GroupByOption; label: string }[] = [
  { value: "date", label: "Date" },
  { value: "campaign", label: "Campaign" },
  { value: "bu", label: "BU" },
  { value: "status", label: "Status" },
  { value: "followup", label: "Follow-up" },
];
type SortColumn = "date" | "campaign" | "bu" | "owner" | "status" | "why" | "followup";
function compareRows(a: WeeklyLogRow, b: WeeklyLogRow, col: SortColumn): number {
  switch (col) {
    case "date":
      return a.completedDate.localeCompare(b.completedDate);
    case "campaign":
      return a.campaignName.localeCompare(b.campaignName);
    case "bu":
      return a.bu.localeCompare(b.bu);
    case "owner":
      return a.owner.localeCompare(b.owner);
    case "status":
      return a.status.localeCompare(b.status);
    case "why":
      return a.why.localeCompare(b.why);
    case "followup":
      return (a.followUpDate ?? "").localeCompare(b.followUpDate ?? "");
  }
}

const fmtTime = (d: string) => {
  const t = new Date(d);
  return isNaN(t.getTime()) ? "—" : t.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
};

// Group-level editable fields: Status/Why/Expected impact/Follow-up/Outcome
// are always editable ("basic"); Completed date/Owner/BU/Campaign name are
// Google-derived and only editable behind the edit dialog's Advanced toggle.
type GroupEditableFields = Pick<
  WeeklyLogRow,
  "status" | "why" | "expectedImpact" | "followUpDate" | "outcome" | "completedDate" | "owner" | "bu" | "campaignName"
>;

function diffGroupFields(a: WeeklyLogRow, b: WeeklyLogRow): Partial<GroupEditableFields> {
  const patch: Partial<GroupEditableFields> = {};
  if (a.status !== b.status) patch.status = b.status;
  if (a.why !== b.why) patch.why = b.why;
  if (a.expectedImpact !== b.expectedImpact) patch.expectedImpact = b.expectedImpact;
  if (a.followUpDate !== b.followUpDate) patch.followUpDate = b.followUpDate;
  if (a.outcome !== b.outcome) patch.outcome = b.outcome;
  if (a.completedDate !== b.completedDate) patch.completedDate = b.completedDate;
  if (a.owner !== b.owner) patch.owner = b.owner;
  if (a.bu !== b.bu) patch.bu = b.bu;
  if (a.campaignName !== b.campaignName) patch.campaignName = b.campaignName;
  return patch;
}

type EntryEditableFields = Pick<WeeklyLogEntryRow, "entryType" | "whatChanged">;

function diffEntryFields(a: WeeklyLogEntryRow, b: WeeklyLogEntryRow): Partial<EntryEditableFields> {
  const patch: Partial<EntryEditableFields> = {};
  if (a.entryType !== b.entryType) patch.entryType = b.entryType;
  if (a.whatChanged !== b.whatChanged) patch.whatChanged = b.whatChanged;
  return patch;
}

export function WeeklyLogTable({
  rows,
  onChange,
  platform,
  filters,
  persistedLogIds,
  onGroupUpdate,
  onEntryUpdate,
  onEntryUnlog,
  onAddEntry,
  onAddEntryToGroup,
  campaignNames,
  owners,
}: {
  rows: WeeklyLogRow[];
  onChange: (rows: WeeklyLogRow[]) => void;
  platform: AdPlatform;
  filters: LogFilters;
  // Known campaign names for this platform (from the Register tab) — offered
  // as "Add log entry"'s Campaign name suggestions. Free text still works.
  campaignNames?: string[];
  // Known owners for this platform (from the Register tab, itself resolved
  // from the BU Owners registry) — offered as "Add log entry"'s Owner
  // suggestions. Free text still works.
  owners?: string[];
  // Ids of rows the backend actually knows about (a fetched Google Ads
  // change-event group, or the result of a prior onAddEntry call) — only
  // these can be PATCHed.
  persistedLogIds?: Set<string>;
  onGroupUpdate?: (groupId: string, patch: Partial<GroupEditableFields>) => Promise<WeeklyLogRow>;
  onEntryUpdate?: (groupId: string, entryId: string, patch: Partial<EntryEditableFields>) => Promise<WeeklyLogRow>;
  // Mark/restore a child entry as "unlog" — a one-click row action separate
  // from the edit dialog.
  onEntryUnlog?: (groupId: string, entryId: string, isUnlogged: boolean) => Promise<WeeklyLogRow>;
  // Persist a brand-new manual entry. Always becomes its own group server-side
  // — never merged into an existing one.
  onAddEntry?: (row: Omit<WeeklyLogRow, "id">) => Promise<WeeklyLogRow>;
  // Append a new child entry to an EXISTING (already-persisted) group/session
  // — the per-group "add entry" button. Only meaningful for rows in
  // persistedLogIds (the backend needs a real group id to attach to).
  onAddEntryToGroup?: (groupId: string, entry: Pick<WeeklyLogEntryRow, "entryType" | "whatChanged">) => Promise<WeeklyLogRow>;
}) {
  // Child rows start collapsed; a row's id lands in this set once a user
  // expands it (or "expand all" is used), so absence means collapsed.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingGroup, setEditingGroup] = useState<WeeklyLogRow | null>(null);
  const [viewingGroup, setViewingGroup] = useState<WeeklyLogRow | null>(null);
  const [editingEntry, setEditingEntry] = useState<{ group: WeeklyLogRow; entry: WeeklyLogEntryRow } | null>(null);
  const [adding, setAdding] = useState(false);
  const [addingToGroup, setAddingToGroup] = useState<WeeklyLogRow | null>(null);
  const [groupBy, setGroupBy] = useState<GroupByOption>("date");
  // Regroup sections (the Date/BU/Status buckets) start collapsed; a key
  // lands here once a user expands that section.
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<Set<string>>(new Set());
  // Clicking a column header sorts by it (toggling direction on repeat
  // clicks); defaults match the prior fixed "newest first" behavior.
  const [sortBy, setSortBy] = useState<SortColumn>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  // Unlike Register/Budget Pacing, Weekly Log edits actually persist
  // server-side (see CampaignTrackerPage's footnote) — so a failed save here
  // must NOT be applied locally or silently dropped; it's surfaced here and
  // the editor/action stays open so the user can retry.
  const [saveError, setSaveError] = useState<string | null>(null);

  function toggleSort(col: SortColumn) {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(col);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    const list = rows.filter((r) => matchesLogFilters(r, filters));
    list.sort((a, b) => (sortDir === "asc" ? compareRows(a, b, sortBy) : -compareRows(a, b, sortBy)));
    return list;
  }, [rows, filters, sortBy, sortDir]);

  // Rows within each bucket below keep whatever order `filtered` arrives in
  // (i.e. the active column sort). Date groups are always ordered newest
  // first regardless of column sort — grouping by date is its own explicit
  // ordering; BU/status use their canonical order; campaign is alphabetical;
  // follow-up sorts by date (soonest first, no follow-up date last).
  const NO_FOLLOW_UP_KEY = "__no-follow-up__";
  const groupedRows = useMemo(() => {
    if (groupBy === "date") {
      const byKey = new Map<string, WeeklyLogRow[]>();
      for (const row of filtered) {
        const bucket = byKey.get(row.completedDate);
        if (bucket) bucket.push(row);
        else byKey.set(row.completedDate, [row]);
      }
      return Array.from(byKey.keys())
        .sort((a, b) => b.localeCompare(a))
        .map((key) => ({ key, label: fmtGroupDate(key), rows: byKey.get(key)! }));
    }

    if (groupBy === "bu" || groupBy === "status") {
      const keyOrder: readonly string[] = groupBy === "bu" ? BUSINESS_UNITS : LOG_STATUSES;
      const byKey = new Map<string, WeeklyLogRow[]>();
      for (const row of filtered) {
        const key = groupBy === "bu" ? row.bu : row.status;
        const bucket = byKey.get(key);
        if (bucket) bucket.push(row);
        else byKey.set(key, [row]);
      }
      return keyOrder.filter((key) => byKey.has(key)).map((key) => ({ key, label: key, rows: byKey.get(key)! }));
    }

    if (groupBy === "campaign") {
      const byKey = new Map<string, WeeklyLogRow[]>();
      for (const row of filtered) {
        const bucket = byKey.get(row.campaignName);
        if (bucket) bucket.push(row);
        else byKey.set(row.campaignName, [row]);
      }
      return Array.from(byKey.keys())
        .sort((a, b) => a.localeCompare(b))
        .map((key) => ({ key, label: key, rows: byKey.get(key)! }));
    }

    // followup
    const byKey = new Map<string, WeeklyLogRow[]>();
    for (const row of filtered) {
      const key = row.followUpDate ?? NO_FOLLOW_UP_KEY;
      const bucket = byKey.get(key);
      if (bucket) bucket.push(row);
      else byKey.set(key, [row]);
    }
    return Array.from(byKey.keys())
      .sort((a, b) => {
        if (a === NO_FOLLOW_UP_KEY) return 1;
        if (b === NO_FOLLOW_UP_KEY) return -1;
        return a.localeCompare(b);
      })
      .map((key) => ({ key, label: key === NO_FOLLOW_UP_KEY ? "No follow-up date" : fmtGroupDate(key), rows: byKey.get(key)! }));
  }, [filtered, groupBy]);

  function toggleGroupCollapsed(key: string) {
    setExpandedGroupKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const allGroupsExpanded = groupedRows.length > 0 && groupedRows.every((g) => expandedGroupKeys.has(g.key));
  function toggleAllGroupsCollapsed() {
    setExpandedGroupKeys(allGroupsExpanded ? new Set() : new Set(groupedRows.map((g) => g.key)));
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allExpanded = filtered.length > 0 && filtered.every((r) => expandedIds.has(r.id));
  function toggleAllExpanded() {
    setExpandedIds(allExpanded ? new Set() : new Set(filtered.map((r) => r.id)));
  }

  async function saveGroupEdit(edited: WeeklyLogRow) {
    const original = rows.find((r) => r.id === edited.id);
    if (original && persistedLogIds?.has(edited.id) && onGroupUpdate) {
      const patch = diffGroupFields(original, edited);
      if (Object.keys(patch).length > 0) {
        try {
          const finalRow = await onGroupUpdate(edited.id, patch);
          onChange(rows.map((r) => (r.id === edited.id ? finalRow : r)));
        } catch (e) {
          setSaveError(describeError(e));
          return;
        }
        setEditingGroup(null);
        setSaveError(null);
        return;
      }
    }
    onChange(rows.map((r) => (r.id === edited.id ? edited : r)));
    setEditingGroup(null);
    setSaveError(null);
  }

  async function saveEntryEdit(group: WeeklyLogRow, edited: WeeklyLogEntryRow) {
    const originalEntry = group.entries.find((e) => e.id === edited.id);
    if (originalEntry && persistedLogIds?.has(group.id) && onEntryUpdate) {
      const patch = diffEntryFields(originalEntry, edited);
      if (Object.keys(patch).length > 0) {
        try {
          const finalGroup = await onEntryUpdate(group.id, edited.id, patch);
          onChange(rows.map((r) => (r.id === group.id ? finalGroup : r)));
        } catch (e) {
          setSaveError(describeError(e));
          return;
        }
        setEditingEntry(null);
        setSaveError(null);
        return;
      }
    }
    const locallyPatched = { ...group, entries: group.entries.map((e) => (e.id === edited.id ? edited : e)) };
    onChange(rows.map((r) => (r.id === group.id ? locallyPatched : r)));
    setEditingEntry(null);
    setSaveError(null);
  }

  async function toggleEntryUnlog(group: WeeklyLogRow, entry: WeeklyLogEntryRow) {
    const next = !entry.isUnlogged;
    if (persistedLogIds?.has(group.id) && onEntryUnlog) {
      try {
        const finalGroup = await onEntryUnlog(group.id, entry.id, next);
        onChange(rows.map((r) => (r.id === group.id ? finalGroup : r)));
        setSaveError(null);
      } catch (e) {
        setSaveError(describeError(e));
      }
      return;
    }
    const locallyToggled = { ...group, entries: group.entries.map((e) => (e.id === entry.id ? { ...e, isUnlogged: next } : e)) };
    onChange(rows.map((r) => (r.id === group.id ? locallyToggled : r)));
    setSaveError(null);
  }

  async function saveNewEntry(row: WeeklyLogRow) {
    if (onAddEntry) {
      try {
        const finalRow = await onAddEntry(row);
        onChange([finalRow, ...rows]);
      } catch (e) {
        setSaveError(describeError(e));
        return;
      }
      setAdding(false);
      setSaveError(null);
      return;
    }
    onChange([row, ...rows]);
    setAdding(false);
    setSaveError(null);
  }

  async function saveEntryToGroup(group: WeeklyLogRow, entry: Pick<WeeklyLogEntryRow, "entryType" | "whatChanged">) {
    if (!onAddEntryToGroup) {
      setAddingToGroup(null);
      return;
    }
    try {
      const finalGroup = await onAddEntryToGroup(group.id, entry);
      onChange(rows.map((r) => (r.id === group.id ? finalGroup : r)));
      setAddingToGroup(null);
      setSaveError(null);
    } catch (e) {
      setSaveError(describeError(e));
    }
  }

  return (
    <Box>
      {saveError && (
        <Typography sx={{ fontSize: "0.76rem", color: "error.main", mb: 1.5 }}>Couldn't save: {saveError}</Typography>
      )}
      <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
          <RowCount shown={filtered.length} total={rows.length} singular="log entry" plural="log entries" />
          <TextField
            select
            size="small"
            label="Group by"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupByOption)}
            sx={{ width: 130 }}
          >
            {GROUP_BY_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
          <Tooltip title={allGroupsExpanded ? "Collapse all groups" : "Expand all groups"} arrow placement="top">
            <IconButton size="small" onClick={toggleAllGroupsCollapsed} sx={{ color: "text.secondary", p: 0.5, "&:hover": { color: "primary.main" } }}>
              {allGroupsExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </IconButton>
          </Tooltip>
        </Box>
        <Button size="small" variant="contained" startIcon={<Plus size={16} />} onClick={() => setAdding(true)} sx={{ textTransform: "none", fontSize: "0.76rem", fontWeight: 700 }}>
          Add log entry
        </Button>
      </Box>

      {filtered.length === 0 ? (
        <Typography sx={{ fontSize: "0.76rem", color: "text.disabled", textAlign: "center", py: 3 }}>No log entries match these filters</Typography>
      ) : (
        <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, overflow: "hidden" }}>
          <Box sx={{ overflow: "auto", maxHeight: 640 }}>
            <Table size="small" stickyHeader sx={{ minWidth: 1080 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 36 }}>
                    <Tooltip title={allExpanded ? "Collapse all" : "Expand all"} arrow placement="top">
                      <IconButton size="small" onClick={toggleAllExpanded} sx={{ p: 0.25 }}>
                        {allExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                  <SortableHeaderCell label="Date" col="date" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} />
                  <SortableHeaderCell label="Campaign" col="campaign" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} />
                  <SortableHeaderCell label="BU" col="bu" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} />
                  <SortableHeaderCell label="Owner" col="owner" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} />
                  <SortableHeaderCell label="Status" col="status" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} />
                  <SortableHeaderCell label="Why" col="why" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} />
                  <SortableHeaderCell label="Follow-up" col="followup" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} />
                  <TableCell align="right" sx={{ width: 112 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {groupedRows.map((group) => {
                  const groupCollapsed = !expandedGroupKeys.has(group.key);
                  return (
                    <Fragment key={group.key}>
                      <TableRow onClick={() => toggleGroupCollapsed(group.key)} sx={{ bgcolor: "action.hover", cursor: "pointer" }}>
                        <TableCell sx={{ width: 36, py: 0.6 }}>
                          <IconButton size="small" sx={{ p: 0.25 }}>
                            {groupCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                          </IconButton>
                        </TableCell>
                        <TableCell colSpan={8} sx={{ py: 0.6 }}>
                          <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                            {group.label} · {group.rows.length} {group.rows.length === 1 ? "entry" : "entries"}
                          </Typography>
                        </TableCell>
                      </TableRow>
                      {!groupCollapsed &&
                        group.rows.map((row) => {
                      const collapsed = !expandedIds.has(row.id);
                      return (
                        <Fragment key={row.id}>
                          <TableRow onClick={() => toggleExpanded(row.id)} sx={{ cursor: "pointer" }}>
                            <TableCell sx={{ width: 36 }}>
                              <IconButton size="small" sx={{ p: 0.25 }}>
                                {collapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                              </IconButton>
                            </TableCell>
                            <TableCell>
                              <Typography sx={{ fontSize: "0.72rem", ...NUMERIC }}>{fmtDate(row.completedDate)}</Typography>
                            </TableCell>
                            <TableCell>
                              <Typography sx={{ fontSize: "0.76rem", fontWeight: 600, letterSpacing: "-0.005em" }}>{row.campaignName}</Typography>
                            </TableCell>
                            <TableCell>
                              <Typography sx={{ fontSize: "0.74rem" }}>{row.bu}</Typography>
                            </TableCell>
                            <TableCell>
                              <Typography sx={{ fontSize: "0.74rem" }}>{row.owner}</Typography>
                            </TableCell>
                            <TableCell>
                              <ToneChip label={row.status} color={LOG_STATUS_COLOR[row.status]} />
                            </TableCell>
                            <TableCell sx={{ maxWidth: 220 }}>
                              <Typography sx={{ fontSize: "0.74rem", color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {row.why}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography sx={{ fontSize: "0.72rem", ...NUMERIC }}>{fmtDate(row.followUpDate)}</Typography>
                            </TableCell>
                            <TableCell align="right" sx={{ width: 112 }} onClick={(e) => e.stopPropagation()}>
                              {onAddEntryToGroup && persistedLogIds?.has(row.id) && (
                                <Tooltip title="Add entry to this session" arrow placement="top">
                                  <IconButton size="small" onClick={() => setAddingToGroup(row)} sx={{ color: "text.secondary", p: 0.5, "&:hover": { color: "primary.main" } }}>
                                    <Plus size={16} />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <Tooltip title="Full view" arrow placement="top">
                                <IconButton size="small" onClick={() => setViewingGroup(row)} sx={{ color: "text.secondary", p: 0.5, "&:hover": { color: "primary.main" } }}>
                                  <Eye size={16} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Edit" arrow placement="top">
                                <IconButton size="small" onClick={() => setEditingGroup(row)} sx={{ color: "text.secondary", p: 0.5, "&:hover": { color: "primary.main" } }}>
                                  <Pencil size={16} />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                          {!collapsed &&
                            row.entries.map((entry) => (
                              <TableRow
                                key={entry.id}
                                onClick={() => setEditingEntry({ group: row, entry })}
                                sx={{
                                  cursor: "pointer",
                                  bgcolor: "action.hover",
                                  "&:hover": { bgcolor: "action.selected" },
                                  opacity: entry.isUnlogged ? 0.5 : 1,
                                }}
                              >
                                <TableCell />
                                <TableCell colSpan={7}>
                                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, pl: 1 }}>
                                    <ToneChip label={entry.entryType} color={ENTRY_COLOR[entry.entryType]} />
                                    {entry.isUnlogged && <ToneChip label="Unlogged" color="text.secondary" />}
                                    <Typography
                                      sx={{
                                        fontSize: "0.74rem",
                                        flex: 1,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                        textDecoration: entry.isUnlogged ? "line-through" : "none",
                                      }}
                                    >
                                      {entry.whatChanged}
                                    </Typography>
                                  </Box>
                                </TableCell>
                                <TableCell align="right" sx={{ width: 44 }} onClick={(e) => e.stopPropagation()}>
                                  <Tooltip title={entry.isUnlogged ? "Restore to log" : "Mark as unlogged"} arrow placement="top">
                                    <IconButton size="small" onClick={() => toggleEntryUnlog(row, entry)} sx={{ color: "text.secondary", p: 0.5, "&:hover": { color: "primary.main" } }}>
                                      {entry.isUnlogged ? <RotateCcw size={16} /> : <Link2Off size={16} />}
                                    </IconButton>
                                  </Tooltip>
                                </TableCell>
                              </TableRow>
                            ))}
                        </Fragment>
                      );
                    })}
                  </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        </Box>
      )}

      {adding && (
        <AddEntryDialog platform={platform} campaignNames={campaignNames ?? []} owners={owners ?? []} onCancel={() => setAdding(false)} onSave={saveNewEntry} />
      )}
      {addingToGroup && (
        <AddEntryToGroupDialog group={addingToGroup} onCancel={() => setAddingToGroup(null)} onSave={(entry) => saveEntryToGroup(addingToGroup, entry)} />
      )}
      {editingGroup && <GroupEditDialog initial={editingGroup} onCancel={() => setEditingGroup(null)} onSave={saveGroupEdit} />}
      {viewingGroup && <GroupDetailDialog group={viewingGroup} onClose={() => setViewingGroup(null)} />}
      {editingEntry && (
        <EntryEditDialog initial={editingEntry.entry} onCancel={() => setEditingEntry(null)} onSave={(entry) => saveEntryEdit(editingEntry.group, entry)} />
      )}
    </Box>
  );
}

export function LogFilterControls({ filters, onChange, owners }: { filters: LogFilters; onChange: (f: LogFilters) => void; owners: string[] }) {
  return (
    <>
      <MultiSelectFilter label="Status" options={LOG_STATUSES} selected={filters.statuses} onChange={(statuses) => onChange({ ...filters, statuses })} />
      <MultiSelectFilter label="Business unit" options={BUSINESS_UNITS} selected={filters.bus} onChange={(bus) => onChange({ ...filters, bus })} />
      <MultiSelectFilter label="Entry type" options={ENTRY_TYPES} selected={filters.types} width={190} onChange={(types) => onChange({ ...filters, types })} />
      <MultiSelectFilter label="Owner" options={owners} selected={filters.owners} onChange={(owners) => onChange({ ...filters, owners })} />
      <InlineDateRangeFilter
        label="Completed date range"
        from={filters.completedFrom}
        to={filters.completedTo}
        onFromChange={(v) => onChange({ ...filters, completedFrom: v })}
        onToChange={(v) => onChange({ ...filters, completedTo: v })}
      />
      <InlineDateRangeFilter
        label="Follow-up date range"
        from={filters.followUpFrom}
        to={filters.followUpTo}
        onFromChange={(v) => onChange({ ...filters, followUpFrom: v })}
        onToChange={(v) => onChange({ ...filters, followUpTo: v })}
      />
      <ClearFiltersButton activeCount={countActiveLog(filters)} onClear={() => onChange(EMPTY_LOG_FILTERS)} />
    </>
  );
}

// Campaign details (date/owner/BU/campaign) come from Google Ads for a
// fetched row, shown read-only here — same convention as CampaignRegisterTable.
function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography sx={{ fontSize: "0.66rem", fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.04em", mb: 0.4 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: "0.82rem", color: "text.primary" }}>{value || "—"}</Typography>
    </Box>
  );
}

// Edit an existing group. Why/Expected impact/Follow-up/Outcome/Status are
// always editable (the human-authored fields). Completed date/Owner/BU/
// Campaign name are Google-derived for a fetched row — read-only until
// "Advanced edit" is switched on, matching today's full-edit behavior.
function GroupEditDialog({ initial, onCancel, onSave }: { initial: WeeklyLogRow; onCancel: () => void; onSave: (row: WeeklyLogRow) => void }) {
  const [row, setRow] = useState<WeeklyLogRow>(initial);
  const [advanced, setAdvanced] = useState(false);
  const set = <K extends keyof WeeklyLogRow>(k: K, v: WeeklyLogRow[K]) => setRow((r) => ({ ...r, [k]: v }));

  return (
    <Dialog open onClose={onCancel} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: "12px" } }}>
      <Box sx={{ px: 3, pt: 3, pb: 1, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
        <Box>
          <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, letterSpacing: "-0.01em" }}>Edit log entry</Typography>
          <Typography sx={{ fontSize: "0.7rem", color: "text.secondary", mt: 0.25 }}>
            {row.entries.length} change{row.entries.length === 1 ? "" : "s"} in this session — edit them from the table row below.
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
          <Typography sx={{ fontSize: "0.68rem", fontWeight: 600, color: advanced ? "primary.main" : "text.secondary" }}>Advanced edit</Typography>
          <Switch size="small" checked={advanced} onChange={(e) => setAdvanced(e.target.checked)} />
        </Box>
      </Box>
      <Box sx={{ px: 3, py: 1.5, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
        {advanced ? (
          <>
            <TextField label="Campaign name" size="small" fullWidth sx={{ gridColumn: "1 / -1" }} value={row.campaignName} onChange={(e) => set("campaignName", e.target.value)} />
            <TextField label="Owner" size="small" fullWidth value={row.owner} onChange={(e) => set("owner", e.target.value)} />
            <TextField
              label="Completed date"
              type="date"
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={row.completedDate}
              onChange={(e) => set("completedDate", e.target.value)}
            />
            <LabeledSelect label="BU" value={row.bu} options={BUSINESS_UNITS} onChange={(v) => set("bu", v)} />
          </>
        ) : (
          <>
            <ReadOnlyField label="Campaign name" value={row.campaignName} />
            <ReadOnlyField label="Owner" value={row.owner} />
            <ReadOnlyField label="Completed date" value={fmtDate(row.completedDate)} />
            <ReadOnlyField label="BU" value={row.bu} />
          </>
        )}

        <Box sx={{ gridColumn: "1 / -1", borderTop: 1, borderColor: "divider", pt: 1.5, mt: 0.5 }} />

        <LabeledSelect label="Status" value={row.status} options={LOG_STATUSES} onChange={(v) => set("status", v)} />
        <TextField
          label="Follow-up date"
          type="date"
          size="small"
          fullWidth
          InputLabelProps={{ shrink: true }}
          value={row.followUpDate ?? ""}
          onChange={(e) => set("followUpDate", e.target.value || null)}
        />
        <TextField label="Why (data & rationale)" size="small" fullWidth multiline minRows={2} sx={{ gridColumn: "1 / -1" }} value={row.why} onChange={(e) => set("why", e.target.value)} />
        <TextField label="Expected impact" size="small" fullWidth sx={{ gridColumn: "1 / -1" }} value={row.expectedImpact} onChange={(e) => set("expectedImpact", e.target.value)} />
        <TextField label="Outcome (fill at follow-up)" size="small" fullWidth sx={{ gridColumn: "1 / -1" }} value={row.outcome} onChange={(e) => set("outcome", e.target.value)} />
      </Box>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
        <Button onClick={onCancel} sx={{ textTransform: "none", fontSize: "0.78rem", color: "text.secondary" }}>
          Cancel
        </Button>
        <Button onClick={() => onSave(row)} variant="contained" sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.78rem" }}>
          Save changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Correct one child entry's type and/or "what changed" text.
// Clicking a child row opens this: the full detail view of that one change
// (every field's old -> new value, read-only) plus the two fields an
// operator can correct (type and the short summary).
function EntryEditDialog({ initial, onCancel, onSave }: { initial: WeeklyLogEntryRow; onCancel: () => void; onSave: (entry: WeeklyLogEntryRow) => void }) {
  const [entry, setEntry] = useState<WeeklyLogEntryRow>(initial);
  const set = <K extends keyof WeeklyLogEntryRow>(k: K, v: WeeklyLogEntryRow[K]) => setEntry((e) => ({ ...e, [k]: v }));

  return (
    <Dialog open onClose={onCancel} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: "12px" } }}>
      <Box sx={{ px: 3, pt: 3, pb: 1 }}>
        <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, letterSpacing: "-0.01em" }}>Change detail</Typography>
        <Typography sx={{ fontSize: "0.72rem", color: "text.secondary", mt: 0.25 }}>{fmtTime(entry.occurredAt)}</Typography>
      </Box>

      {entry.changeDetails.length > 0 && (
        <Box sx={{ px: 3, pb: 1, display: "flex", flexDirection: "column", gap: 0.75 }}>
          {entry.changeDetails.map((d, i) => (
            <Box key={i} sx={{ border: 1, borderColor: "divider", borderRadius: "8px", p: 1 }}>
              <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.03em", mb: 0.25 }}>{d.label}</Typography>
              <Typography sx={{ fontSize: "0.78rem" }}>
                {d.oldValue || "—"} <Box component="span" sx={{ color: "text.disabled" }}>→</Box> {d.newValue || "—"}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      <Box sx={{ px: 3, py: 1.5, display: "flex", flexDirection: "column", gap: 1.5, borderTop: entry.changeDetails.length > 0 ? 1 : 0, borderColor: "divider" }}>
        <LabeledSelect label="Entry type" value={entry.entryType} options={ENTRY_TYPES} onChange={(v) => set("entryType", v)} />
        <TextField label="What changed (summary)" size="small" fullWidth multiline minRows={2} value={entry.whatChanged} onChange={(e) => set("whatChanged", e.target.value)} />
      </Box>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
        <Button onClick={onCancel} sx={{ textTransform: "none", fontSize: "0.78rem", color: "text.secondary" }}>
          Cancel
        </Button>
        <Button onClick={() => onSave(entry)} variant="contained" sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.78rem" }}>
          Save change
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Read-only "full view" — every group field plus every child entry, nothing editable.
function GroupDetailDialog({ group, onClose }: { group: WeeklyLogRow; onClose: () => void }) {
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: "12px" } }}>
      <Box sx={{ px: 3, pt: 3, pb: 1 }}>
        <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, letterSpacing: "-0.01em" }}>{group.campaignName}</Typography>
        <Typography sx={{ fontSize: "0.74rem", color: "text.secondary", mt: 0.25 }}>
          {fmtDate(group.completedDate)} · {group.owner} · {group.bu}
        </Typography>
      </Box>
      <Box sx={{ px: 3, py: 1.5, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
        <ReadOnlyField label="Status" value={group.status} />
        <ReadOnlyField label="Follow-up date" value={fmtDate(group.followUpDate)} />
        <ReadOnlyField label="Why" value={group.why} />
        <ReadOnlyField label="Expected impact" value={group.expectedImpact} />
        <ReadOnlyField label="Outcome" value={group.outcome} />
      </Box>

      <Box sx={{ px: 3, pt: 1, pb: 0.5, borderTop: 1, borderColor: "divider" }}>
        <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.04em", mt: 1.5, mb: 1 }}>
          Changes ({group.entries.length})
        </Typography>
      </Box>
      <Box sx={{ px: 3, pb: 2.5, display: "flex", flexDirection: "column", gap: 1, maxHeight: 280, overflow: "auto" }}>
        {group.entries.map((entry) => (
          <Box key={entry.id} sx={{ border: 1, borderColor: "divider", borderRadius: "8px", p: 1.25 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
              <ToneChip label={entry.entryType} color={ENTRY_COLOR[entry.entryType]} />
              <Typography sx={{ fontSize: "0.68rem", color: "text.secondary", ...NUMERIC }}>{fmtTime(entry.occurredAt)}</Typography>
            </Box>
            {entry.changeDetails.length > 0 ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                {entry.changeDetails.map((d, i) => (
                  <Typography key={i} sx={{ fontSize: "0.76rem" }}>
                    <Box component="span" sx={{ fontWeight: 600 }}>
                      {d.label}:
                    </Box>{" "}
                    {d.oldValue} <Box component="span" sx={{ color: "text.disabled" }}>→</Box> {d.newValue}
                  </Typography>
                ))}
              </Box>
            ) : (
              <Typography sx={{ fontSize: "0.76rem" }}>{entry.whatChanged}</Typography>
            )}
          </Box>
        ))}
      </Box>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 0 }}>
        <Button onClick={onClose} variant="contained" sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.78rem" }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

let draftSeq = 0;

// Add a brand-new manual entry — one flat form (a fresh submission is one
// human composing one change in one sitting, so there's no basic/advanced
// split here: everything about it is fresh input).
function AddEntryDialog({
  platform,
  campaignNames,
  owners,
  onCancel,
  onSave,
}: {
  platform: AdPlatform;
  campaignNames: string[];
  owners: string[];
  onCancel: () => void;
  onSave: (row: WeeklyLogRow) => void;
}) {
  const [row, setRow] = useState<WeeklyLogRow>({
    id: `log-draft-${++draftSeq}`,
    completedDate: new Date().toISOString().slice(0, 10),
    owner: "",
    // 'Not Set' (not 'Completed') until a human actually picks one — a
    // status nobody chose yet shouldn't silently read as "done".
    status: "Not Set",
    bu: "IAM",
    platform,
    campaignName: "",
    why: "",
    expectedImpact: "",
    followUpDate: null,
    outcome: "",
    entries: [{ id: `entry-draft-${draftSeq}`, entryType: "Routine Optimization", whatChanged: "", changeDetails: [], occurredAt: new Date().toISOString(), isUnlogged: false }],
  });

  const set = <K extends keyof WeeklyLogRow>(k: K, v: WeeklyLogRow[K]) => setRow((r) => ({ ...r, [k]: v }));
  const setEntry = <K extends keyof WeeklyLogEntryRow>(k: K, v: WeeklyLogEntryRow[K]) => setRow((r) => ({ ...r, entries: [{ ...r.entries[0], [k]: v }] }));

  const [entry] = row.entries;
  const canSave = row.campaignName.trim().length > 0 && entry.whatChanged.trim().length > 0 && row.why.trim().length > 0;

  return (
    <Dialog open onClose={onCancel} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: "12px" } }}>
      <Box sx={{ px: 3, pt: 3, pb: 1 }}>
        <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, letterSpacing: "-0.01em" }}>Add log entry</Typography>
      </Box>
      <Box sx={{ px: 3, py: 1.5, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
        <Autocomplete
          freeSolo
          options={campaignNames}
          value={row.campaignName}
          sx={{ gridColumn: "1 / -1" }}
          onInputChange={(_, v) => set("campaignName", v)}
          renderInput={(p) => <TextField {...p} label="Campaign name" size="small" fullWidth />}
        />
        <Autocomplete freeSolo options={owners} value={row.owner} onInputChange={(_, v) => set("owner", v)} renderInput={(p) => <TextField {...p} label="Owner" size="small" fullWidth />} />
        <TextField label="Completed date" type="date" size="small" fullWidth InputLabelProps={{ shrink: true }} value={row.completedDate} onChange={(e) => set("completedDate", e.target.value)} />
        <LabeledSelect label="BU" value={row.bu} options={BUSINESS_UNITS} onChange={(v) => set("bu", v)} />
        <LabeledSelect label="Entry type" value={entry.entryType} options={ENTRY_TYPES} onChange={(v) => setEntry("entryType", v)} />
        <LabeledSelect label="Status" value={row.status} options={LOG_STATUSES} onChange={(v) => set("status", v)} />
        <TextField
          label="Follow-up date"
          type="date"
          size="small"
          fullWidth
          InputLabelProps={{ shrink: true }}
          value={row.followUpDate ?? ""}
          onChange={(e) => set("followUpDate", e.target.value || null)}
        />
        <TextField
          label="What was done / changed"
          size="small"
          fullWidth
          multiline
          minRows={2}
          sx={{ gridColumn: "1 / -1" }}
          value={entry.whatChanged}
          onChange={(e) => setEntry("whatChanged", e.target.value)}
        />
        <TextField label="Why (data & rationale)" size="small" fullWidth multiline minRows={2} sx={{ gridColumn: "1 / -1" }} value={row.why} onChange={(e) => set("why", e.target.value)} />
        <TextField
          label="Expected impact"
          size="small"
          fullWidth
          multiline
          minRows={2}
          sx={{ gridColumn: "1 / -1" }}
          value={row.expectedImpact}
          onChange={(e) => set("expectedImpact", e.target.value)}
        />
        <TextField
          label="Outcome (fill at follow-up)"
          size="small"
          fullWidth
          multiline
          minRows={2}
          sx={{ gridColumn: "1 / -1" }}
          value={row.outcome}
          onChange={(e) => set("outcome", e.target.value)}
        />
      </Box>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
        <Button onClick={onCancel} sx={{ textTransform: "none", fontSize: "0.78rem", color: "text.secondary" }}>
          Cancel
        </Button>
        <Button onClick={() => onSave(row)} disabled={!canSave} variant="contained" sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.78rem" }}>
          Add entry
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Log a second (or third) distinct change into a session that's already
// there — an operator who did more than one kind of change in the same
// sitting, without composing a whole new why/expected-impact/follow-up
// group for it.
function AddEntryToGroupDialog({
  group,
  onCancel,
  onSave,
}: {
  group: WeeklyLogRow;
  onCancel: () => void;
  onSave: (entry: Pick<WeeklyLogEntryRow, "entryType" | "whatChanged">) => void;
}) {
  const [entryType, setEntryType] = useState<EntryType>("Routine Optimization");
  const [whatChanged, setWhatChanged] = useState("");
  const canSave = whatChanged.trim().length > 0;

  return (
    <Dialog open onClose={onCancel} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: "12px" } }}>
      <Box sx={{ px: 3, pt: 3, pb: 1 }}>
        <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, letterSpacing: "-0.01em" }}>Add entry to this session</Typography>
        <Typography sx={{ fontSize: "0.72rem", color: "text.secondary", mt: 0.25 }}>
          {group.campaignName} · {fmtDate(group.completedDate)} · {group.owner}
        </Typography>
      </Box>
      <Box sx={{ px: 3, py: 1.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
        <LabeledSelect label="Entry type" value={entryType} options={ENTRY_TYPES} onChange={setEntryType} />
        <TextField label="What was done / changed" size="small" fullWidth multiline minRows={2} value={whatChanged} onChange={(e) => setWhatChanged(e.target.value)} />
      </Box>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
        <Button onClick={onCancel} sx={{ textTransform: "none", fontSize: "0.78rem", color: "text.secondary" }}>
          Cancel
        </Button>
        <Button onClick={() => onSave({ entryType, whatChanged })} disabled={!canSave} variant="contained" sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.78rem" }}>
          Add entry
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function SortableHeaderCell({
  label,
  col,
  sortBy,
  sortDir,
  onClick,
}: {
  label: string;
  col: SortColumn;
  sortBy: SortColumn;
  sortDir: "asc" | "desc";
  onClick: (col: SortColumn) => void;
}) {
  const active = sortBy === col;
  return (
    <TableCell onClick={() => onClick(col)} sx={{ cursor: "pointer", userSelect: "none", "&:hover": { color: "text.primary" } }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
        {label}
        <Box sx={{ display: "flex", width: 14, opacity: active ? 1 : 0.25 }}>
          {active && sortDir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </Box>
      </Box>
    </TableCell>
  );
}

function LabeledSelect<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly T[]; onChange: (v: T) => void }) {
  return (
    <TextField select label={label} size="small" fullWidth value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <MenuItem key={o} value={o}>
          {o}
        </MenuItem>
      ))}
    </TextField>
  );
}
