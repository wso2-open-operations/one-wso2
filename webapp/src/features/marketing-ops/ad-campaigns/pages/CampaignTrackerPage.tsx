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

// Ad Campaigns → Campaign Tracker: the weekly operating rhythm for every live
// campaign — the Campaign Register (what's quietly spending?), the shared
// Weekly Log (if it's not logged, it didn't happen), and Budget Pacing
// (who's over/under pace?). Ported from Marketing Ops' CampaignTrackerView +
// CampaignTrackerContext.
//
// Both platforms' Register/Budget Pacing are always fetched (see the
// useCampaignRegister/useBudgetPacing calls below) so the platform toggle
// switches instantly instead of firing a new request — same design as the
// source. Weekly Log is one shared fetch that returns whichever platform's
// groups are in the backend's tables — Google Ads' are reconciled from its
// change_event log on every read, LinkedIn's (which has no such log) by a
// periodic snapshot-diff job instead.
//
// Register/Budget Pacing rows are only ever partially persisted (the four
// Register override fields; manual Budget Pacing rows) — most fields always
// reflect live vendor data on the next fetch regardless of a local edit. This
// page keeps its own row state, seeded from the queries and kept in sync with
// them, so the tables' onChange-then-persist contract (edit applies locally
// immediately; persistence is fire-and-forget) carries over unchanged from
// the source. Weekly Log's edits DO persist server-side.

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Box, Typography, Switch, Select, MenuItem, IconButton, Tooltip } from "@wso2/oxygen-ui";
import { RefreshCw, List, NotebookPen, TrendingUp, Users } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { MARKETING_OPS_EYEBROW } from "@constants/marketingOpsApps";
import MarketingOpsShell from "../../components/MarketingOpsShell";
import { FieldLabel, ToggleChip } from "../analytics/components/AnalyticsPrimitives";
import { StatStrip, StatCell, TrackerLoading } from "../campaign-tracker/components/campaignTrackerPrimitives";
import {
  CampaignRegisterTable,
  RegisterFilterControls,
  RegisterFilters,
  EMPTY_REGISTER_FILTERS,
} from "../campaign-tracker/components/CampaignRegisterTable";
import { WeeklyLogTable, LogFilterControls, LogFilters, EMPTY_LOG_FILTERS } from "../campaign-tracker/components/WeeklyLogTable";
import {
  BudgetPacingTable,
  PacingFilterControls,
  PacingFilters,
  EMPTY_PACING_FILTERS,
} from "../campaign-tracker/components/BudgetPacingTable";
import { BuOwnersPanel } from "../campaign-tracker/components/BuOwnersPanel";
import { AD_PLATFORMS, AdPlatform, registerFlag } from "../campaign-tracker/campaignTrackerTypes";
import type { CampaignRegisterRow, WeeklyLogRow, BudgetPacingRow } from "../campaign-tracker/campaignTrackerTypes";
import {
  useCampaignRegister,
  useBudgetPacing,
  useWeeklyLog,
  useLinkedinRefreshStatus,
  useUpdateRegisterOverride,
  useAddManualPacingRow,
  useUpdateManualPacingRow,
  useDeleteManualPacingRow,
  useAddWeeklyLogEntry,
  useAddWeeklyLogEntryToGroup,
  useUpdateWeeklyLogGroup,
  useUpdateWeeklyLogEntry,
  useSetEntryUnlogged,
  useTriggerLinkedinRefresh,
  setCampaignRegisterCache,
  setBudgetPacingCache,
  setWeeklyLogCache,
} from "../../api/useCampaignTracker";

type Tab = "Register" | "Weekly Log" | "Budget Pacing" | "BU Owners";

const TRACKER_LOADING_MESSAGES = ["Loading campaigns…", "Loading change history…", "Loading budget pacing…", "Almost there…"] as const;

const TABS: { label: Tab; icon: React.ReactNode }[] = [
  { label: "Register", icon: <List size={16} /> },
  { label: "Weekly Log", icon: <NotebookPen size={16} /> },
  { label: "Budget Pacing", icon: <TrendingUp size={16} /> },
  { label: "BU Owners", icon: <Users size={16} /> },
];

// Segmented platform switch — same ToggleChip primitive as the sibling
// Analytics tab's platform selector.
function PlatformToggle({ platform, onChange }: { platform: AdPlatform; onChange: (p: AdPlatform) => void }) {
  return (
    <Box>
      <FieldLabel>Platform</FieldLabel>
      <Box sx={{ display: "flex", gap: 1 }}>
        {AD_PLATFORMS.map((p) => (
          <ToggleChip key={p} label={p} active={platform === p} onClick={() => onChange(p)} />
        ))}
      </Box>
    </Box>
  );
}

function IncludeInactiveToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
      <FieldLabel>Inactive campaigns</FieldLabel>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, height: 34 }}>
        <Switch size="small" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <Typography sx={{ fontSize: "0.78rem", color: checked ? "primary.main" : "text.secondary", fontWeight: checked ? 700 : 500 }}>
          {checked ? "Included" : "Hidden"}
        </Typography>
      </Box>
    </Box>
  );
}

function ShowUnloggedToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
      <FieldLabel>Unlogged entries</FieldLabel>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, height: 34 }}>
        <Switch size="small" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <Typography sx={{ fontSize: "0.78rem", color: checked ? "primary.main" : "text.secondary", fontWeight: checked ? 700 : 500 }}>
          {checked ? "Shown" : "Hidden"}
        </Typography>
      </Box>
    </Box>
  );
}

function RefreshButton({ onClick, refreshing, tooltip = "Refresh — fetch the latest data" }: { onClick: () => void; refreshing: boolean; tooltip?: string }) {
  return (
    <Tooltip title={tooltip}>
      <span>
        <IconButton
          onClick={onClick}
          disabled={refreshing}
          size="small"
          aria-label="Refresh"
          sx={{ color: "primary.main", border: 1, borderColor: "divider", borderRadius: 1, "&:hover": { borderColor: "primary.main" } }}
        >
          <Box
            component="span"
            sx={{
              display: "inline-flex",
              ...(refreshing && { animation: "campaignTrackerSpin 0.8s linear infinite", "@keyframes campaignTrackerSpin": { to: { transform: "rotate(360deg)" } } }),
            }}
          >
            <RefreshCw size={17} />
          </Box>
        </IconButton>
      </span>
    </Tooltip>
  );
}

function fmtRelativeTime(iso: string): string {
  const diffSec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
}

function LinkedInRefreshControl({
  lastUpdated,
  refreshing,
  message,
  onRefresh,
}: {
  lastUpdated: string | null;
  refreshing: boolean;
  message: string | null;
  onRefresh: () => void;
}) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
      <FieldLabel>LinkedIn data</FieldLabel>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, height: 34 }}>
        <Typography sx={{ fontSize: "0.76rem", color: "text.secondary" }}>{lastUpdated ? `Updated ${fmtRelativeTime(lastUpdated)}` : "Not yet captured"}</Typography>
        <RefreshButton onClick={onRefresh} refreshing={refreshing} tooltip="Refresh — capture LinkedIn's current campaign state now" />
      </Box>
      {message && <Typography sx={{ fontSize: "0.68rem", color: "warning.main" }}>{message}</Typography>}
    </Box>
  );
}

const WEEKS_OPTIONS = [1, 2, 4, 8, 12, 26] as const;

// Stable empty-array fallback for a query's `data` before it has loaded —
// a fresh `[] ` literal on every render would change identity each time and
// defeat the useMemo hooks derived from these rows.
const EMPTY_ROWS: never[] = [];

function WeeksToShowControl({ weeks, onChange }: { weeks: number; onChange: (w: number) => void }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
      <FieldLabel>Weeks to show</FieldLabel>
      <Select size="small" value={weeks} onChange={(e) => onChange(Number(e.target.value))} sx={{ minWidth: 100, height: 34, fontSize: "0.78rem", bgcolor: "background.default" }}>
        {WEEKS_OPTIONS.map((w) => (
          <MenuItem key={w} value={w} sx={{ fontSize: "0.8rem" }}>
            {w} week{w === 1 ? "" : "s"}
          </MenuItem>
        ))}
      </Select>
    </Box>
  );
}

// Weekly Log is one shared, mixed-platform fetch/cache entry (unlike
// Register/Budget Pacing, which are cached one entry per platform) — so
// writing a platform-scoped edit back needs to replace just that platform's
// rows and leave the other platform's alone, rather than overwrite the
// whole cache entry with only what's on screen.
function mergePlatformSlice<T extends { platform: AdPlatform }>(all: T[], platform: AdPlatform, rows: T[]): T[] {
  return [...all.filter((r) => r.platform !== platform), ...rows];
}

export default function CampaignTrackerPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Register");
  const [registerFilters, setRegisterFilters] = useState<RegisterFilters>(EMPTY_REGISTER_FILTERS);
  const [logFilters, setLogFilters] = useState<LogFilters>(EMPTY_LOG_FILTERS);
  const [pacingFilters, setPacingFilters] = useState<PacingFilters>(EMPTY_PACING_FILTERS);

  const [platform, setPlatform] = useState<AdPlatform>("Google Ads");
  const [includeInactiveCampaigns, setIncludeInactiveCampaigns] = useState(false);
  const [weeksToShow, setWeeksToShow] = useState(2);
  const [includeUnlogged, setIncludeUnlogged] = useState(false);
  const [linkedinMessage, setLinkedinMessage] = useState<string | null>(null);

  // Both platforms always fetched so the toggle above is instant.
  const registerGoogle = useCampaignRegister("Google Ads", includeInactiveCampaigns);
  const registerLinkedIn = useCampaignRegister("LinkedIn", includeInactiveCampaigns);
  const pacingGoogle = useBudgetPacing("Google Ads");
  const pacingLinkedIn = useBudgetPacing("LinkedIn");
  const weeklyLog = useWeeklyLog(weeksToShow * 7, includeUnlogged);
  const linkedinStatus = useLinkedinRefreshStatus(true);

  const updateRegisterOverride = useUpdateRegisterOverride();
  const addManualPacingRow = useAddManualPacingRow();
  const updateManualPacingRow = useUpdateManualPacingRow();
  const deleteManualPacingRow = useDeleteManualPacingRow();
  const addWeeklyLogEntry = useAddWeeklyLogEntry();
  const addWeeklyLogEntryToGroup = useAddWeeklyLogEntryToGroup();
  const updateWeeklyLogGroup = useUpdateWeeklyLogGroup();
  const updateWeeklyLogEntry = useUpdateWeeklyLogEntry();
  const setEntryUnlogged = useSetEntryUnlogged();
  const triggerLinkedinRefresh = useTriggerLinkedinRefresh();
  const qc = useQueryClient();

  // Rows come straight from the queries — Register/Budget Pacing are cached
  // one entry per platform, so the current platform's data IS the scoped
  // view already. A table's onChange (an edit that applies immediately,
  // regardless of whether persistence resolves) writes straight back into
  // the query cache via the setCampaignRegisterCache/setBudgetPacingCache/
  // setWeeklyLogCache helpers below, rather than through a parallel piece of
  // local state kept in sync with an effect.
  const scopedRegisterRows: CampaignRegisterRow[] = (platform === "Google Ads" ? registerGoogle.data : registerLinkedIn.data) ?? EMPTY_ROWS;
  const scopedPacingRows: BudgetPacingRow[] = (platform === "Google Ads" ? pacingGoogle.data : pacingLinkedIn.data) ?? EMPTY_ROWS;
  const logRows: WeeklyLogRow[] = weeklyLog.data ?? EMPTY_ROWS;
  const scopedLogRows = useMemo(() => logRows.filter((r) => r.platform === platform), [logRows, platform]);
  const persistedLogIds = useMemo(() => new Set(logRows.map((r) => r.id)), [logRows]);

  const registerOwners = useMemo(() => Array.from(new Set(scopedRegisterRows.map((r) => r.owner).filter(Boolean))).sort(), [scopedRegisterRows]);
  const logOwners = useMemo(() => Array.from(new Set(scopedLogRows.map((r) => r.owner).filter(Boolean))).sort(), [scopedLogRows]);
  const registerCampaignNames = useMemo(() => Array.from(new Set(scopedRegisterRows.map((r) => r.campaignName))).sort(), [scopedRegisterRows]);

  const flags = scopedRegisterRows.map(registerFlag);
  const total = scopedRegisterRows.length;
  const active = scopedRegisterRows.filter((r) => r.status === "Active").length;
  const overdue = flags.filter((f) => f === "REVIEW OVERDUE").length;
  const neverReviewed = flags.filter((f) => f === "NEVER REVIEWED").length;
  const pastEnd = flags.filter((f) => f === "PAST END DATE").length;

  const trackerLoading = registerGoogle.isFetching || registerLinkedIn.isFetching || pacingGoogle.isFetching || pacingLinkedIn.isFetching || weeklyLog.isFetching;
  const trackerErrorObj = registerGoogle.error ?? registerLinkedIn.error ?? pacingGoogle.error ?? pacingLinkedIn.error ?? weeklyLog.error;
  const trackerError = trackerErrorObj ? describeError(trackerErrorObj) : null;

  function refresh() {
    void registerGoogle.refetch();
    void registerLinkedIn.refetch();
    void pacingGoogle.refetch();
    void pacingLinkedIn.refetch();
    void weeklyLog.refetch();
  }

  async function handleAddEntry(row: Omit<WeeklyLogRow, "id">): Promise<WeeklyLogRow> {
    return addWeeklyLogEntry.mutateAsync(row);
  }

  async function handleRegisterUpdate(campaignId: string, platform: AdPlatform, patch: Parameters<typeof updateRegisterOverride.mutateAsync>[0]["patch"]) {
    await updateRegisterOverride.mutateAsync({ campaignId, platform, patch });
  }

  async function handleLinkedinRefresh() {
    setLinkedinMessage(null);
    try {
      const result = await triggerLinkedinRefresh.mutateAsync();
      if (result?.status === "in_progress") setLinkedinMessage("Update already in progress — try again shortly");
    } catch (e) {
      setLinkedinMessage(describeError(e));
    }
  }

  return (
    <MarketingOpsShell
      eyebrow={MARKETING_OPS_EYEBROW.adCampaigns}
      title="Campaign Tracker"
      subtitle="Every optimization, major change, and budget check lives here. No campaign runs indefinitely without an owner, an end/review-by date, and a recent log entry."
    >
      {activeTab !== "BU Owners" && (
        <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, p: 2.5, mb: 3 }}>
          <Box sx={{ display: "flex", alignItems: "flex-end", gap: 3, rowGap: 2, flexWrap: "wrap" }}>
            <PlatformToggle platform={platform} onChange={setPlatform} />
            {activeTab === "Register" && <RegisterFilterControls filters={registerFilters} onChange={setRegisterFilters} owners={registerOwners} />}
            {activeTab === "Register" && <IncludeInactiveToggle checked={includeInactiveCampaigns} onChange={setIncludeInactiveCampaigns} />}
            {activeTab === "Weekly Log" && <WeeksToShowControl weeks={weeksToShow} onChange={setWeeksToShow} />}
            {activeTab === "Weekly Log" && <ShowUnloggedToggle checked={includeUnlogged} onChange={setIncludeUnlogged} />}
            {activeTab === "Weekly Log" && <LogFilterControls filters={logFilters} onChange={setLogFilters} owners={logOwners} />}
            {activeTab === "Weekly Log" && platform === "LinkedIn" && (
              <LinkedInRefreshControl
                lastUpdated={linkedinStatus.data?.lastUpdated ?? null}
                refreshing={triggerLinkedinRefresh.isPending}
                message={linkedinMessage}
                onRefresh={handleLinkedinRefresh}
              />
            )}
            {activeTab === "Budget Pacing" && <PacingFilterControls filters={pacingFilters} onChange={setPacingFilters} />}
            {(activeTab === "Register" || activeTab === "Weekly Log" || activeTab === "Budget Pacing") && (
              <Box sx={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
                <RefreshButton onClick={refresh} refreshing={trackerLoading} />
              </Box>
            )}
          </Box>
        </Box>
      )}

      {activeTab !== "BU Owners" && trackerLoading && <TrackerLoading messages={TRACKER_LOADING_MESSAGES} />}
      {activeTab !== "BU Owners" && trackerError && (
        <Typography sx={{ fontSize: "0.76rem", color: "error.main", mb: 2 }}>Couldn't load campaign data: {trackerError}</Typography>
      )}

      {activeTab !== "BU Owners" && (
        <StatStrip>
          <StatCell label="Active campaigns" value={active} color="success.main" total={total} />
          <StatCell label="Review overdue" value={overdue} color="error.main" total={total} />
          <StatCell label="Never reviewed" value={neverReviewed} color="warning.main" total={total} />
          <StatCell label="Past end date" value={pastEnd} color="error.main" total={total} />
        </StatStrip>
      )}

      <Box role="tablist" sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 3, borderBottom: 1, borderColor: "divider" }}>
        {TABS.map(({ label, icon }) => {
          const activeState = activeTab === label;
          const slug = label.toLowerCase().replace(/\s+/g, "-");
          return (
            <Box
              key={label}
              component="button"
              type="button"
              role="tab"
              id={`campaign-tracker-tab-${slug}`}
              aria-controls={`campaign-tracker-tabpanel-${slug}`}
              aria-selected={activeState}
              onClick={() => setActiveTab(label)}
              sx={{
                px: 2,
                py: 1.25,
                border: 0,
                bgcolor: "transparent",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: activeState ? 700 : 500,
                color: activeState ? "primary.main" : "text.secondary",
                display: "flex",
                alignItems: "center",
                gap: 1,
                position: "relative",
                transition: "color .12s ease",
                "&:hover": { color: activeState ? "primary.main" : "text.primary" },
                "&::after": activeState
                  ? { content: '""', position: "absolute", left: 0, right: 0, bottom: -1, height: 3, borderRadius: "2px 2px 0 0", bgcolor: "primary.main" }
                  : {},
              }}
            >
              <Box sx={{ display: "flex", color: activeState ? "primary.main" : "text.secondary" }}>{icon}</Box>
              {label}
            </Box>
          );
        })}
      </Box>

      {activeTab === "Register" && (
        <Box
          role="tabpanel"
          id="campaign-tracker-tabpanel-register"
          aria-labelledby="campaign-tracker-tab-register"
          sx={{ p: 2, borderRadius: "10px", border: 1, borderColor: "divider", bgcolor: "background.paper" }}
        >
          <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, mb: 1.5 }}>Campaign Register</Typography>
          <CampaignRegisterTable
            rows={scopedRegisterRows}
            filters={registerFilters}
            platform={platform}
            onChange={(next) => setCampaignRegisterCache(qc, platform, includeInactiveCampaigns, next)}
            onSave={handleRegisterUpdate}
          />
        </Box>
      )}

      {activeTab === "Weekly Log" && (
        <Box
          role="tabpanel"
          id="campaign-tracker-tabpanel-weekly-log"
          aria-labelledby="campaign-tracker-tab-weekly-log"
          sx={{ p: 2, borderRadius: "10px", border: 1, borderColor: "divider", bgcolor: "background.paper" }}
        >
          <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, mb: 1.5 }}>Weekly Log</Typography>
          <WeeklyLogTable
            rows={scopedLogRows}
            platform={platform}
            filters={logFilters}
            campaignNames={registerCampaignNames}
            owners={registerOwners}
            onChange={(next) => setWeeklyLogCache(qc, weeksToShow * 7, includeUnlogged, mergePlatformSlice(logRows, platform, next))}
            persistedLogIds={persistedLogIds}
            onGroupUpdate={(groupId, patch) => updateWeeklyLogGroup.mutateAsync({ groupId, patch })}
            onEntryUpdate={(groupId, entryId, patch) => updateWeeklyLogEntry.mutateAsync({ groupId, entryId, patch })}
            onEntryUnlog={(groupId, entryId, isUnlogged) => setEntryUnlogged.mutateAsync({ groupId, entryId, isUnlogged })}
            onAddEntry={handleAddEntry}
            onAddEntryToGroup={(groupId, entry) => addWeeklyLogEntryToGroup.mutateAsync({ groupId, entry })}
          />
        </Box>
      )}

      {activeTab === "Budget Pacing" && (
        <Box
          role="tabpanel"
          id="campaign-tracker-tabpanel-budget-pacing"
          aria-labelledby="campaign-tracker-tab-budget-pacing"
          sx={{ p: 2, borderRadius: "10px", border: 1, borderColor: "divider", bgcolor: "background.paper" }}
        >
          <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, mb: 1.5 }}>Budget Pacing</Typography>
          <BudgetPacingTable
            rows={scopedPacingRows}
            platform={platform}
            filters={pacingFilters}
            onChange={(next) => setBudgetPacingCache(qc, platform, next)}
            onAdd={(row) => addManualPacingRow.mutateAsync(row)}
            onUpdate={(id, patch) => updateManualPacingRow.mutateAsync({ id, patch })}
            onDelete={async (id) => {
              await deleteManualPacingRow.mutateAsync(id);
            }}
          />
        </Box>
      )}

      {activeTab === "BU Owners" && (
        <Box
          role="tabpanel"
          id="campaign-tracker-tabpanel-bu-owners"
          aria-labelledby="campaign-tracker-tab-bu-owners"
          sx={{ p: 2, borderRadius: "10px", border: 1, borderColor: "divider", bgcolor: "background.paper" }}
        >
          <BuOwnersPanel />
        </Box>
      )}

      <Typography sx={{ fontSize: 11, color: "text.disabled", mt: 4 }}>
        Register and Budget Pacing edits apply immediately; only Weekly Log edits and the four Register override fields (BU, Status, Last Reviewed, CPL) are persisted server-side.
      </Typography>
    </MarketingOpsShell>
  );
}
