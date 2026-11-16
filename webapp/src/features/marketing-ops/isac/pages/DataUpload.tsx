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

import { CheckCircle as CheckCircleIcon } from "../icons";
import { ErrorOutline as ErrorOutlineIcon } from "../icons";
import { UploadFile as UploadFileIcon } from "../icons";
import { Sync as SyncIcon } from "../icons";
import { Autorenew as AutorenewIcon } from "../icons";
import { CloudSync as CloudSyncIcon } from "../icons";
import { LinkedIn as LinkedInIcon } from "../icons";
import { ExpandMore as ExpandMoreIcon } from "../icons";
import { ExpandLess as ExpandLessIcon } from "../icons";
import { Link as LinkIcon } from "../icons";
import { Business as BusinessIcon } from "../icons";
import { People as PeopleIcon } from "../icons";
import { School as SchoolIcon } from "../icons";
import { TrendingUp as TrendingUpIcon } from "../icons";
import { Campaign as CampaignIcon } from "../icons";
import { HubOutlined as HubOutlinedIcon } from "../icons";
import { InfoOutlined as InfoOutlinedIcon } from "../icons";
import { Schedule as ScheduleIcon } from "../icons";
import { Refresh as RefreshIcon } from "../icons";
import { AccessTime as AccessTimeIcon } from "../icons";
import { PlayArrow as PlayArrowIcon } from "../icons";
import { Replay as ReplayIcon } from "../icons";
import { RestartAlt as RestartAltIcon } from "../icons";
import { VisibilityOutlined as VisibilityOutlinedIcon } from "../icons";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  LinearProgress,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { useQueryClient } from "@tanstack/react-query";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useApiClient, type DataImport } from "../api/client";
import { invalidateSyncQueries } from "../api/queryKeys";
import ConfirmActionDialog from "../components/ConfirmActionDialog";
import { useUserRole } from "../context/UserRoleContext";
import { C } from "../theme/pageTokens";
import { FS, FW } from "../theme/typeScale";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AcceptedResponse {
  import_id: number;
  status: string;
  file_name: string;
  message: string;
}

interface ProductSyncInfo {
  account_intent?: string;
  account_intent_at?: string;
}

interface SyncRunStatus {
  run_id: string;
  status: "running" | "interrupted" | "done" | "failed";
  products: Record<string, {
    account_intent?: { rows: number; status: string; error?: string };
  }>;
  error: string | null;
}

interface SyncCycleEntry {
  name: string;
  outcome: string;
  elapsed_seconds?: number;
  rows?: number;
  new?: number;
  updated?: number;
  linked?: number;
  still_orphan?: number;
  products?: Record<string, { account_intent?: { rows: number; status: string } }>;
  error?: string;
}

interface SyncCycleResult {
  // "failed"/"interrupted": the orchestrator died mid-cycle (pod restart) and the
  // sweeper flagged it — the steps after the one marked "running" never ran.
  status: "running" | "interrupted" | "done" | "failed";
  started_at: string;
  finished_at: string | null;
  last_heartbeat?: string | null;
  error?: string | null;
  elapsed_seconds: number;
  total: number;
  ok: number;
  failed: number;
  skipped: number;
  syncs: SyncCycleEntry[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 3000;
// 30 minutes of a run that has gone quiet. A run still reporting a fresh heartbeat
// resets the count (see useSyncPanel) — the full lead re-sync legitimately runs for hours.
const SYNC_POLL_MAX_ATTEMPTS = 600;
const CSV_POLL_MAX_ATTEMPTS = 200;   // ~10 minutes — CSV uploads are faster

const G2_PRODUCTS = [
  "WSO2 API Platform",
  "WSO2 Identity Platform",
  "WSO2 Integration Platform",
];

const G2_INTENT_COLS = [
  "company_id", "company_name", "company_domain", "company_state",
  "company_country", "company_employees", "bombora_intent_topics",
  "annual_revenue", "total_pageviews", "direct_pageviews",
  "product_profile_pageviews", "activity_level", "buying_stage", "last_seen",
  "sponsored_content_pageviews", "comparison_pageviews", "category_pageviews",
  "pricing_pageviews", "competitors_pageviews", "visitor_locations",
  "competitive_signals", "subject_product_id", "subject_product_slug",
  "subject_product_name",
];

const CSV_SOURCES = [
  { key: "sf-customers", label: "SF Accounts (Customers)", endpoint: "/upload/sf-customers", columns: [
    "Account Name", "Account Owner", "Account Life Cycle", "Rating",
    "Billing State/Province (text only)", "Type", "Last Activity", "Last Modified Date", "NAICS Industry",
  ]},
  { key: "sf-partners", label: "SF Partners", endpoint: "/upload/sf-partners", columns: [
    "Account Name", "Account Owner", "Account Record Type", "Rating",
    "Partner Type", "Partner Status", "Business Model", "Sub Category", "Partner Start Date", "Region Bucket",
  ]},
  { key: "sf-leads", label: "SF Leads", endpoint: "/upload/pardot-leads", columns: [
    "Prospect Id", "Email", "Company", "Job Title", "Country", "City",
    "State", "Zip", "Phone", "Source", "Industry", "Annual Revenue",
    "Employees", "Campaign", "Grade", "Website", "Referrer",
    "Do Not Email", "Do Not Call", "Opted Out", "User",
    "CRM Contact FID", "CRM Lead FID",
    "Last Activity At", "First Assigned", "Created Date", "Updated Date",
  ]},
  { key: "certifications", label: "Certifications", endpoint: "/upload/certifications", columns: [
    "Certification: Token", "Type", "Contact: Account Name",
    "Certification Awarded", "Certification Awarded Date", "Contact Email",
  ]},
  { key: "pardot-snapshots", label: "Engagement Snapshots", endpoint: "/upload/pardot-snapshots", columns: [
    "Name", "Assigned User", "Prospects", "Last Activity",
    "IAM activities Total", "IAM activities Average", "BFSI activities Total",
    "BFSI activities Average", "Integration-activities Total", "Integration-activities Average",
    "Content Syndication Total", "External events Total", "Webinar activities Total",
    "Drift Engagement Total", "SDR interaction Total", "Contact Us submission Total",
    "High intent page visit Total",
  ]},
  { key: "g2-intent", label: "G2 Account Intent", endpoint: "/upload/g2-account-intent", columns: G2_INTENT_COLS },
  { key: "li-job-title", label: "LinkedIn by Job Title", endpoint: "/upload/linkedin-stats-job-title", columns: [
    "Campaign name", "Date", "Month", "Campaign status", "Member job title",
    "Clicks", "Impressions", "Total spent", "CPC", "CTR", "Region", "BU", "Budget Allocation",
  ]},
  { key: "li-company", label: "LinkedIn by Company", endpoint: "/upload/linkedin-stats-company", columns: [
    "Campaign name", "Date", "Month", "Campaign status", "Member company name",
    "Clicks", "Impressions", "Total spent", "CPC", "CTR", "Region", "BU", "Budget Allocation",
  ]},
];

// ── Shared helpers ────────────────────────────────────────────────────────────



function formatDateTime(iso: string): string {
  try {
    // Handle date-only strings (YYYY-MM-DD) by appending time
    const d = iso.includes("T") ? new Date(iso) : new Date(iso + "T00:00:00");
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

/** Parse a sync_runs timestamp as UTC. The backend writes naive UTC isoformat (no
 * "Z"), which Date.parse would otherwise read as browser-local time — 5½ h off in
 * IST, enough to make a dead run look freshly alive. */
function parseUtcMs(iso?: string | null): number | null {
  if (!iso) return null;
  const s = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}Z`;
  const ms = Date.parse(s);
  return isNaN(ms) ? null : ms;
}

// A run that beats normally does so every ~30 s; the backend heals silence past 2 min.
// The UI waits a little longer before calling it dead, so the auto-heal usually
// gets there first and the operator only sees "Clear" when it genuinely didn't.
const HEARTBEAT_DEAD_MS = 5 * 60_000;
// Runs that never beat (older builds' rows) fall back to the 2 h backstop + margin.
const NO_HEARTBEAT_DEAD_MS = (2 * 60 + 15) * 60_000;

/** Whether a run the server still reports as "running" has evidently died. */
function heartbeatLooksDead(lastHeartbeat?: string | null, startedAt?: string | null): boolean {
  const beat = parseUtcMs(lastHeartbeat);
  if (beat != null) return Date.now() - beat > HEARTBEAT_DEAD_MS;
  const started = parseUtcMs(startedAt);
  return started != null && Date.now() - started > NO_HEARTBEAT_DEAD_MS;
}

// ── Sync status pill ──────────────────────────────────────────────────────────

function SyncStatusPill({ lastSync, lastSyncAt, isRunning }: { lastSync: string | null; lastSyncAt?: string | null; isRunning?: boolean }) {
  if (isRunning) {
    return (
      <Chip
        icon={<CircularProgress size={9} color="inherit" />}
        label="Syncing…"
        size="small"
        color="warning"
        variant="outlined"
        sx={{ height: 20, fontSize: FS.caption, fontWeight: FW.semibold }}
      />
    );
  }
  if (lastSyncAt || lastSync) {
    // Always show date + time when available
    const label = lastSyncAt ? formatDateTime(lastSyncAt) : formatDateTime(lastSync!);
    return (
      <Chip
        icon={<CheckCircleIcon sx={{ fontSize: "10px !important" }} />}
        label={label}
        size="small"
        color="success"
        variant="outlined"
        sx={{ height: 20, fontSize: FS.caption }}
      />
    );
  }
  return (
    <Chip
      label="Never synced"
      size="small"
      variant="outlined"
      sx={{ height: 20, fontSize: FS.caption, color: "text.disabled", borderColor: "divider" }}
    />
  );
}

// ── Collapsible section wrapper ───────────────────────────────────────────────

function CollapsibleSection({ title, icon, open, onToggle, children }: {
  title: string;
  icon: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: "10px", overflow: "hidden" }}>
      <Box
        onClick={onToggle}
        sx={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          px: 2, py: 1.5, cursor: "pointer", userSelect: "none",
          bgcolor: `${C.text}06`,
          "&:hover": { bgcolor: `${C.text}0d` },
          transition: "background 0.12s",
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          {icon}
          <Typography variant="body2" fontWeight={FW.semibold} fontSize={FS.reading}>{title}</Typography>
        </Stack>
        {open
          ? <ExpandLessIcon sx={{ fontSize: 16, color: "text.disabled" }} />
          : <ExpandMoreIcon sx={{ fontSize: 16, color: "text.disabled" }} />
        }
      </Box>
      <Collapse in={open}>
        <Box sx={{ p: 2.5, pt: 2 }}>
          {children}
        </Box>
      </Collapse>
    </Paper>
  );
}


// ── Upload Drop Zone ──────────────────────────────────────────────────────────

interface UploadPanelProps {
  endpoint: string;
  wso2Product: string;
  columns: string[];
}

function UploadPanel({ endpoint, wso2Product, columns }: UploadPanelProps) {
  const { upload, get } = useApiClient();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [liveCount, setLiveCount] = useState(0);
  const [result, setResult] = useState<DataImport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  // Start clean whenever the panel is pointed at another source or product.
  const [target, setTarget] = useState({ endpoint, wso2Product });
  if (target.endpoint !== endpoint || target.wso2Product !== wso2Product) {
    setTarget({ endpoint, wso2Product });
    setFile(null); setResult(null); setError(null); setShowErrors(false); setLiveCount(0);
  }

  const handleFile = (f: File | null) => {
    setFile(f); setResult(null); setError(null); setShowErrors(false); setLiveCount(0);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.name.endsWith(".csv")) handleFile(f);
  };

  const pollImport = useCallback(async (importId: number) => {
    setProcessing(true); setLiveCount(0);
    let attempts = 0;
    while (attempts < CSV_POLL_MAX_ATTEMPTS) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
      attempts++;
      try {
        const imp = await get<DataImport>(`/data-imports/${importId}`);
        if (imp.rows_imported) setLiveCount(imp.rows_imported);
        if (imp.status === "done" || imp.status === "partial" || imp.status === "failed") {
          setResult(imp); setProcessing(false);
          if (imp.status !== "failed") { invalidateSyncQueries(qc); }
          return;
        }
      } catch { /* retry */ }
    }
    setProcessing(false);
    setError("Timed out waiting for processing. Check Data Imports page.");
  }, [get, qc]);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true); setResult(null); setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("wso2_product", wso2Product);
      const accepted = await upload<AcceptedResponse>(endpoint, fd);
      setLoading(false);
      pollImport(accepted.import_id);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as { message?: string })?.message || "Upload failed";
      setError(String(msg)); setLoading(false);
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Expected columns */}
      <Box>
        <Typography variant="caption" fontWeight={FW.semibold} color="text.secondary"
          sx={{ textTransform: "uppercase", letterSpacing: 0.8, display: "block", mb: 0.75 }}>
          Expected CSV columns
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
          {columns.map(col => (
            <Chip key={col} label={col} size="small" variant="outlined"
              sx={{ fontSize: FS.small, height: 22, fontFamily: "monospace" }} />
          ))}
        </Box>
      </Box>

      <Divider />

      {/* Drop zone */}
      <Box
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        sx={{
          border: "2px dashed",
          borderColor: dragging ? "primary.main" : file ? "success.main" : "divider",
          borderRadius: "8px", py: 1.75, px: 2,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5,
          cursor: "pointer", bgcolor: dragging ? "action.hover" : "background.default",
          transition: "border-color 0.15s, background-color 0.15s",
          "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
        }}
      >
        <input ref={inputRef} type="file" accept=".csv" style={{ display: "none" }}
          onChange={e => { handleFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
        <UploadFileIcon sx={{ fontSize: 26, color: file ? "success.main" : "text.disabled" }} />
        {file ? (
          <>
            <Typography variant="body2" fontWeight={FW.semibold}>{file.name}</Typography>
            <Typography variant="caption" color="text.secondary">
              {file.size >= 1048576 ? `${(file.size / 1048576).toFixed(1)} MB`
                : file.size >= 1024 ? `${(file.size / 1024).toFixed(1)} KB`
                : `${file.size} B`} — click or drop to replace
            </Typography>
          </>
        ) : (
          <>
            <Typography variant="body2" fontWeight={FW.medium}>Drop a CSV file here or click to browse</Typography>
            <Typography variant="caption" color="text.secondary">Only .csv files are accepted</Typography>
          </>
        )}
      </Box>

      <Stack direction="row" alignItems="center" spacing={2}>
        <Button
          variant="contained"
          startIcon={(loading || processing) ? <CircularProgress size={18} color="inherit" /> : <UploadFileIcon />}
          onClick={handleUpload}
          disabled={!file || loading || processing}
          sx={{ textTransform: "none", px: 3, borderRadius: "6px" }}
        >
          {loading ? "Uploading…" : processing ? "Processing…" : "Upload CSV"}
        </Button>
        {file && !loading && !processing && (
          <Typography variant="caption" color="text.secondary">{file.name}</Typography>
        )}
      </Stack>

      {processing && (
        <Box>
          <Typography variant="body2" fontWeight={FW.medium} mb={0.5}>
            {liveCount > 0 ? `Processing… ${liveCount.toLocaleString()} rows so far` : "Processing…"}
          </Typography>
          <LinearProgress sx={{ borderRadius: 1, height: 6 }} />
        </Box>
      )}

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {result && (
        <Alert
          severity={result.status === "done" ? "success" : result.status === "failed" ? "error" : "warning"}
          icon={result.status === "done" ? <CheckCircleIcon fontSize="small" /> : <ErrorOutlineIcon fontSize="small" />}
        >
          <Stack spacing={0.5}>
            <Typography variant="body2">
              {result.status === "failed"
                ? <><strong>Import failed:</strong> {result.error_msg || "Unknown error"}</>
                : <><strong>{result.rows_imported?.toLocaleString()}</strong> rows imported
                  {result.status === "partial" && (
                    <Button size="small" sx={{ ml: 1, py: 0, textTransform: "none", minWidth: 0 }}
                      onClick={() => setShowErrors(v => !v)}>
                      {showErrors ? "Hide errors" : "Show errors"}
                    </Button>
                  )}
                </>}
            </Typography>
            <Collapse in={showErrors}>
              <Box component="pre" sx={{ fontSize: FS.small, whiteSpace: "pre-wrap", maxHeight: 160, overflow: "auto", m: 0 }}>
                {result.error_msg}
              </Box>
            </Collapse>
          </Stack>
        </Alert>
      )}
    </Box>
  );
}

// ── G2 panel ──────────────────────────────────────────────────────────────────


// ── Reusable API sync hook ────────────────────────────────────────────────────

interface GenericSyncState { last_sync: string | null; last_sync_at?: string | null; }
interface GenericRunStatus {
  run_id: string; status: "running" | "interrupted" | "done" | "failed";
  rows: number | null; import_id: number | null; error: string | null;
  new?: number | null; updated?: number | null;
  // Liveness/progress (sync_runs row): rows committed so far during a streaming
  // run, and the heartbeat that says the worker is still alive.
  rows_so_far?: number | null; last_heartbeat?: string | null; started_at?: string | null;
}

/** Per-source sync controls. `activeRunId` (from /sync/active-runs) re-attaches the
 * row to a run already in flight — after a reload, or one started by someone else. */
function useSyncPanel(endpoint: string, activeRunId?: string | null) {
  const { get, request } = useApiClient();
  // sync_runs.sync_type for this source (sf-leads → sf_leads) — the reset endpoint keys on it.
  const syncType = endpoint.replace(/-/g, "_");
  const [syncState, setSyncState]   = useState<GenericSyncState>({ last_sync: null });
  const [isRunning, setIsRunning]   = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [resetting, setResetting]   = useState(false);
  const [runStatus, setRunStatus]   = useState<GenericRunStatus | null>(null);
  const [syncError, setSyncError]   = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchState = useCallback(async () => {
    try { const s = await get<GenericSyncState>(`/sync/${endpoint}/state`); setSyncState(s); }
    catch { /* ignore */ }
  }, [get, endpoint]);

  useEffect(() => { fetchState(); }, [fetchState]);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const pollRun = useCallback((runId: string, onDone?: () => void) => {
    if (pollRef.current) clearInterval(pollRef.current);
    let attempts = 0;
    let consecutiveErrors = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const s = await get<GenericRunStatus>(`/sync/${endpoint}/${runId}`);
        consecutiveErrors = 0;
        setRunStatus(s);
        // A run that is still beating is alive however long it takes (the full lead
        // re-sync runs for hours); the timeout below is for runs that went quiet.
        if (s.status === "running" && !heartbeatLooksDead(s.last_heartbeat, s.started_at)) attempts = 0;
        // 'interrupted' is transient — the retry sweeper relaunches it on the same
        // run_id within ~60s, so keep polling rather than treating it as terminal.
        if (s.status !== "running" && s.status !== "interrupted") {
          clearInterval(pollRef.current!); setIsRunning(false); fetchState(); onDone?.();
        }
      } catch {
        consecutiveErrors++;
        // If we get 5 consecutive errors (e.g. 404 after container restart), stop polling
        if (consecutiveErrors >= 5) {
          clearInterval(pollRef.current!);
          setIsRunning(false);
          setSyncError("Sync status lost — the server may have restarted. Check the sync state.");
          fetchState();
        }
      }
      if (attempts > SYNC_POLL_MAX_ATTEMPTS) {
        clearInterval(pollRef.current!);
        setIsRunning(false);
        setRunStatus(null);
        setSyncError("Polling timed out — the sync may still be running in the background. Refresh the page to check.");
        fetchState();
      }
    }, POLL_INTERVAL_MS);
  }, [get, endpoint, fetchState]);

  // Re-attach to an in-flight run (a reload, another tab, another admin).
  useEffect(() => {
    if (activeRunId && !isRunning) { setIsRunning(true); pollRun(activeRunId); }
  }, [activeRunId]);

  const trigger = async (path: string, onDone?: () => void): Promise<boolean> => {
    setTriggering(true); setSyncError(null); setRunStatus(null);
    try {
      const resp = await request<{ run_id: string }>("post", path, {});
      setIsRunning(true);
      pollRun(resp.run_id, onDone);
      return true;
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { error?: string; detail?: string } } })?.response?.data?.error ||
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as { message?: string })?.message || "Failed to trigger sync";
      setSyncError(String(detail));
      return false;
    } finally { setTriggering(false); }
  };

  /** Normal (incremental) sync. Resolves true once the run has started. */
  const handleSync = (onDone?: () => void) => trigger(`/sync/${endpoint}`, onDone);
  /** Admin: the one-time full re-pull (only SF Leads exposes it). */
  const handleFullSync = (onDone?: () => void) => trigger(`/sync/${endpoint}/full`, onDone);

  /** Admin: clear this source's stuck run so a new one can start right away. */
  const handleReset = async () => {
    setResetting(true); setSyncError(null);
    try {
      await request<{ reset: number }>("post", `/sync/${syncType}/reset`);
      if (pollRef.current) clearInterval(pollRef.current);
      setIsRunning(false); setRunStatus(null); fetchState();
    } catch (err: unknown) {
      setSyncError((err as { message?: string })?.message || "Failed to clear the stuck run");
    } finally { setResetting(false); }
  };

  return { syncState, isRunning, triggering, resetting, runStatus, syncError, handleSync, handleFullSync, handleReset };
}

// ── Sync row — compact single-line item for the flat list ───────────────────

function SyncRow({
  icon, color, label, lastSync, lastSyncAt,
  isRunning, triggering, runStatus, syncError,
  onSync, rowLabel = "rows", secondaryActions, onReset, resetting = false,
}: {
  icon: ReactNode;
  color: string;
  label: string;
  lastSync: string | null;
  lastSyncAt?: string | null;
  isRunning: boolean;
  triggering: boolean;
  runStatus: {
    status: string; rows?: number | null; error?: string | null; new?: number | null; updated?: number | null;
    rows_so_far?: number | null; last_heartbeat?: string | null; started_at?: string | null;
  } | null;
  syncError: string | null;
  onSync: () => void;
  rowLabel?: string;
  /** Extra controls rendered after the Sync button (e.g. the SF Leads full re-sync). */
  secondaryActions?: ReactNode;
  /** Admin escape hatch: clear this source's stuck run. Offered only when the run looks dead. */
  onReset?: () => void;
  resetting?: boolean;
}) {
  const busy = triggering || isRunning;
  // "Stuck" = the server still says running but the run has stopped beating. That
  // is the only safe signal: a trigger refused with "already running" is the normal
  // 409 for a perfectly healthy concurrent run, and treating it as stuck would
  // offer to force-fail a live sync and let a duplicate start. A run that really is
  // in flight surfaces through /sync/active-runs instead, and this row polls it —
  // so if it later dies, the heartbeat check below catches it. The backend heals
  // these itself within minutes; the button is for not waiting.
  const looksStuck = !!onReset && runStatus?.status === "running"
    && heartbeatLooksDead(runStatus.last_heartbeat, runStatus.started_at);
  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ py: 1, px: 0.5 }}>
        <Box sx={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 26, height: 26, borderRadius: "6px",
          bgcolor: `${color}14`, color, flexShrink: 0,
        }}>
          {icon}
        </Box>
        <Typography sx={{
          fontFamily: "'Inter', system-ui, sans-serif", fontWeight: FW.semibold,
          fontSize: FS.body, minWidth: 120, flexShrink: 0,
        }}>
          {label}
        </Typography>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <SyncStatusPill lastSync={lastSync} lastSyncAt={lastSyncAt} isRunning={isRunning} />
        </Box>
        <Button
          size="small"
          variant="outlined"
          startIcon={busy
            ? <CircularProgress size={11} color="inherit" />
            : <SyncIcon sx={{ fontSize: 13 }} />}
          onClick={onSync}
          disabled={busy}
          sx={{
            textTransform: "none", fontSize: FS.small, borderRadius: "6px",
            fontFamily: "'Inter', system-ui, sans-serif", fontWeight: FW.semibold,
            px: 1.5, py: 0.3, minWidth: 80, flexShrink: 0,
          }}
        >
          {triggering ? "Starting…" : isRunning ? "Running…" : "Sync"}
        </Button>
        {secondaryActions}
      </Stack>
      {looksStuck && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: 5.5, mb: 0.5 }}>
          <Typography sx={{ fontSize: FS.caption, color: "warning.main" }}>
            This run has stopped reporting progress — it is probably dead.
          </Typography>
          <Button size="small" color="warning" onClick={onReset} disabled={resetting}
            startIcon={<RestartAltIcon sx={{ fontSize: 12 }} />}
            sx={{ textTransform: "none", fontSize: FS.caption, py: 0, minWidth: 0 }}>
            {resetting ? "Clearing…" : "Clear stuck run"}
          </Button>
        </Stack>
      )}
      {syncError && (
        <Alert severity="error" sx={{ ml: 5.5, mb: 0.5, py: 0, fontSize: FS.small, borderRadius: "5px" }}>
          {syncError}
        </Alert>
      )}
      {isRunning && !runStatus && <LinearProgress sx={{ ml: 5.5, borderRadius: 4, height: 2, mb: 0.5 }} />}
      {isRunning && runStatus?.status === "running" && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: 5.5, mb: 0.5 }}>
          <LinearProgress sx={{ flex: 1, borderRadius: 4, height: 2 }} />
          {runStatus.rows_so_far != null && (
            <Chip label={`${runStatus.rows_so_far.toLocaleString()} ${rowLabel} so far`}
              size="small" color="info" variant="outlined" sx={{ height: 16, fontSize: FS.caption }} />
          )}
        </Stack>
      )}
      {runStatus && runStatus.status !== "running" && (
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ ml: 5.5, mb: 0.5 }} flexWrap="wrap">
          {runStatus.status === "done"   && <CheckCircleIcon color="success" sx={{ fontSize: 11 }} />}
          {runStatus.status === "failed" && <ErrorOutlineIcon color="error"  sx={{ fontSize: 11 }} />}
          {runStatus.status === "interrupted" && (
            <>
              <AutorenewIcon color="warning" sx={{ fontSize: 11 }} />
              <Typography sx={{ fontSize: FS.caption, color: "warning.main" }}>
                Interrupted by a restart — auto-retrying…
              </Typography>
            </>
          )}
          {runStatus.status === "done" && runStatus.rows != null && (
            <>
              <Chip label={`${runStatus.rows.toLocaleString()} ${rowLabel}`}
                size="small" color="success" variant="outlined" sx={{ height: 16, fontSize: FS.caption }} />
              {runStatus.new != null && runStatus.new > 0 && (
                <Chip label={`${runStatus.new.toLocaleString()} new`}
                  size="small" color="info" variant="outlined" sx={{ height: 16, fontSize: FS.caption }} />
              )}
              {runStatus.updated != null && runStatus.updated > 0 && (
                <Chip label={`${runStatus.updated.toLocaleString()} updated`}
                  size="small" variant="outlined" sx={{ height: 16, fontSize: FS.caption, color: "text.secondary", borderColor: "divider" }} />
              )}
            </>
          )}
          {runStatus.status === "failed" && runStatus.error && (
            <Typography sx={{ fontSize: FS.caption, color: "error.main" }}>{runStatus.error}</Typography>
          )}
        </Stack>
      )}
    </Box>
  );
}

// ── G2 sync row — one trigger syncs all products in a single run ────────────
// The backend keeps per-product separation (each product gets its own DataImport
// and every row is stamped with wso2_product); a single run avoids the 409s that
// arose when each product was triggered independently against the global lock.

function G2SyncAllRow() {
  const { get, request } = useApiClient();
  const qc = useQueryClient();
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [runStatus, setRunStatus] = useState<{ status: string; rows?: number | null; error?: string | null } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchState = useCallback(async () => {
    try {
      const s = await get<Record<string, ProductSyncInfo>>("/sync/g2/state");
      // Show the most recent account_intent date across all products.
      let latest: string | null = null;
      let latestAt: string | null = null;
      for (const info of Object.values(s)) {
        if (info?.account_intent && (!latest || info.account_intent > latest)) {
          latest = info.account_intent;
          latestAt = info.account_intent_at ?? null;
        }
      }
      setLastSync(latest);
      setLastSyncAt(latestAt);
    } catch { /* ignore */ }
  }, [get]);

  useEffect(() => { fetchState(); }, [fetchState]);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleSync = async () => {
    setTriggering(true); setSyncError(null); setRunStatus(null);
    try {
      // No `product` → backend syncs all products in one run (one lock, no 409s).
      const resp = await request<{ run_id: string }>("post", "/sync/g2", { full_sync: false });
      setIsRunning(true);
      if (pollRef.current) clearInterval(pollRef.current);
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts++;
        try {
          const s = await get<SyncRunStatus>(`/sync/g2/${resp.run_id}`);
          if (s.status === "running") {
            // Leave runStatus null so SyncRow keeps showing the progress bar.
            setRunStatus(null);
          } else if (s.status === "interrupted") {
            // A restart interrupted the run; the sweeper relaunches it on the same
            // run_id within ~60s. Show "recovering" and keep polling.
            setRunStatus({ status: "interrupted", rows: null, error: s.error });
          } else {
            const totalRows = Object.values(s.products ?? {}).reduce(
              (sum, p) => sum + (p.account_intent?.rows ?? 0), 0);
            setRunStatus({ status: s.status, rows: totalRows, error: s.error });
            clearInterval(pollRef.current!); setIsRunning(false); fetchState();
            if (s.status === "done") { invalidateSyncQueries(qc); }
          }
        } catch { /* ignore */ }
        if (attempts > SYNC_POLL_MAX_ATTEMPTS) {
          clearInterval(pollRef.current!); setIsRunning(false); setRunStatus(null);
          setSyncError("Polling timed out — sync may still be running."); fetchState();
        }
      }, POLL_INTERVAL_MS);
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { error?: string; detail?: string } } })?.response?.data?.error ||
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as { message?: string })?.message || "Failed to trigger sync";
      setSyncError(String(detail));
    } finally { setTriggering(false); }
  };

  return (
    <SyncRow
      icon={<TrendingUpIcon sx={{ fontSize: 14 }} />}
      color="#FF492C"
      label="Sync G2 Signals"
      lastSync={lastSync}
      lastSyncAt={lastSyncAt}
      isRunning={isRunning}
      triggering={triggering}
      runStatus={runStatus}
      syncError={syncError}
      onSync={handleSync}
      rowLabel="signals"
    />
  );
}

// ── Relinker row ─────────────────────────────────────────────────────────────

/** The company-domain heal's report — `dry_run` tells preview from apply. */
interface DomainHealReport {
  filled?: number;
  fillable?: number;
  ambiguous?: number;
  contested?: number;
  candidates?: number;
  dry_run?: boolean;
  contested_groups?: Record<string, number[]>;
  error?: string;
}

interface RelinkRunStatus {
  run_id: string;
  status: "running" | "interrupted" | "done" | "failed";
  total_linked: number | null;
  total_orphan: number | null;
  tables: Record<string, { linked: number; still_orphan: number; error?: string }> | null;
  merge: { companies_merged?: number; groups?: number; rows_reparented?: number; error?: string } | null;
  domain_merge?: { companies_merged?: number; error?: string } | null;
  domain_heal?: DomainHealReport | null;
  last_heartbeat?: string | null;
  started_at?: string | null;
  error: string | null;
}

const MAX_CONTESTED_SHOWN = 10;

/** Company Re-linker, plus the company-domain heal it carries.
 *
 * Two ways to run it. "Preview heal" performs the normal re-link but only REPORTS
 * what the heal would claim (the backend's domain_dry_run). "Re-link & heal
 * domains" commits the claims. A claim is a permanent identity change — the
 * domain becomes what every future match keys on — so the apply is admin-only,
 * confirmed, and the preview's contested/ambiguous counts are there to read first. */
function RelinkRow({ activeRunId }: { activeRunId?: string | null }) {
  const { get, request } = useApiClient();
  const qc = useQueryClient();
  const { isAdmin } = useUserRole();
  const [isRunning, setIsRunning] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [runStatus, setRunStatus] = useState<RelinkRunStatus | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const pollRun = useCallback((runId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    setIsRunning(true);
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const s = await get<RelinkRunStatus>(`/sync/relink-companies/${runId}`);
        setRunStatus(s);
        if (s.status !== "running" && s.status !== "interrupted") {
          clearInterval(pollRef.current!); setIsRunning(false);
          if (s.status === "done") { invalidateSyncQueries(qc); }
        }
      } catch { /* ignore */ }
      if (attempts > SYNC_POLL_MAX_ATTEMPTS) {
        clearInterval(pollRef.current!); setIsRunning(false); setRunStatus(null);
        setSyncError("Polling timed out — re-link may still be running.");
      }
    }, POLL_INTERVAL_MS);
  }, [get, qc]);

  // Re-attach to a run already in flight (a reload, another tab, another admin).
  useEffect(() => {
    if (activeRunId && !isRunning) pollRun(activeRunId);
  }, [activeRunId]);

  const start = async (dryRun: boolean) => {
    setTriggering(true); setSyncError(null); setRunStatus(null); setShowGroups(false);
    try {
      const path = dryRun ? "/sync/relink-companies?domain_dry_run=true" : "/sync/relink-companies";
      const resp = await request<{ run_id: string }>("post", path, {});
      setConfirmOpen(false);
      pollRun(resp.run_id);
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { error?: string; detail?: string } } })?.response?.data?.error ||
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as { message?: string })?.message || "Failed";
      setSyncError(String(detail));
    } finally { setTriggering(false); }
  };

  const busy = triggering || isRunning;
  const heal = runStatus?.domain_heal ?? null;
  const contestedGroups = heal?.contested_groups ? Object.entries(heal.contested_groups) : [];
  const btnSx = {
    textTransform: "none", fontSize: FS.small, borderRadius: "6px",
    fontFamily: "'Inter', system-ui, sans-serif", fontWeight: FW.semibold,
    px: 1.5, py: 0.3, flexShrink: 0,
  } as const;

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ py: 1, px: 0.5 }}>
        <Box sx={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 26, height: 26, borderRadius: "6px",
          bgcolor: "rgba(123,31,162,0.08)", color: "#7B1FA2", flexShrink: 0,
        }}>
          <LinkIcon sx={{ fontSize: 14 }} />
        </Box>
        <Typography sx={{
          fontFamily: "'Inter', system-ui, sans-serif", fontWeight: FW.semibold,
          fontSize: FS.body, minWidth: 120, flexShrink: 0,
        }}>
          Company Re-linker
        </Typography>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: FS.caption, color: "text.secondary" }}>
            Merge duplicates, re-match orphan records, and give domainless companies the domain their people's emails use
          </Typography>
        </Box>
        <Tooltip title="Runs the re-link, but only reports what the domain heal would claim — nothing is claimed.">
          <span>
            <Button size="small" variant="outlined" disabled={busy} onClick={() => start(true)}
              startIcon={busy ? <CircularProgress size={11} color="inherit" /> : <VisibilityOutlinedIcon sx={{ fontSize: 13 }} />}
              sx={{ ...btnSx, minWidth: 80 }}>
              {triggering ? "Starting…" : isRunning ? "Running…" : "Preview heal"}
            </Button>
          </span>
        </Tooltip>
        {isAdmin && (
          <Tooltip title="Commits the domain claims — permanent. Read the preview's contested count first.">
            <span>
              <Button size="small" variant="contained" color="secondary" disableElevation disabled={busy}
                onClick={() => setConfirmOpen(true)}
                startIcon={<LinkIcon sx={{ fontSize: 13 }} />} sx={btnSx}>
                Re-link &amp; heal domains
              </Button>
            </span>
          </Tooltip>
        )}
      </Stack>
      {syncError && (
        <Alert severity="error" sx={{ ml: 5.5, mb: 0.5, py: 0, fontSize: FS.small, borderRadius: "5px" }}>
          {syncError}
        </Alert>
      )}
      {isRunning && <LinearProgress sx={{ ml: 5.5, borderRadius: 4, height: 2, mb: 0.5 }} />}
      {runStatus && runStatus.status !== "running" && runStatus.status !== "interrupted" && (
        <Stack spacing={0.5} sx={{ ml: 5.5, mb: 0.5 }}>
          <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
            {runStatus.status === "done"   && <CheckCircleIcon color="success" sx={{ fontSize: 11 }} />}
            {runStatus.status === "failed" && <ErrorOutlineIcon color="error"  sx={{ fontSize: 11 }} />}
            {runStatus.merge?.companies_merged != null && runStatus.merge.companies_merged > 0 && (
              <Chip label={`${runStatus.merge.companies_merged.toLocaleString()} merged`}
                size="small" color="secondary" variant="outlined" sx={{ height: 16, fontSize: FS.caption }} />
            )}
            {runStatus.domain_merge?.companies_merged != null && runStatus.domain_merge.companies_merged > 0 && (
              <Chip label={`${runStatus.domain_merge.companies_merged.toLocaleString()} domain-merged`}
                size="small" color="secondary" variant="outlined" sx={{ height: 16, fontSize: FS.caption }} />
            )}
            {runStatus.total_linked != null && (
              <Chip label={`${runStatus.total_linked.toLocaleString()} linked`}
                size="small" color="success" variant="outlined" sx={{ height: 16, fontSize: FS.caption }} />
            )}
            {runStatus.total_orphan != null && runStatus.total_orphan > 0 && (
              <Chip label={`${runStatus.total_orphan.toLocaleString()} still orphan`}
                size="small" color="warning" variant="outlined" sx={{ height: 16, fontSize: FS.caption }} />
            )}
            {heal && !heal.dry_run && heal.filled != null && (
              <Chip label={`${heal.filled.toLocaleString()} domains healed`}
                size="small" color="success" variant="outlined" sx={{ height: 16, fontSize: FS.caption }} />
            )}
            {heal && !heal.dry_run && (heal.contested ?? 0) > 0 && (
              <Chip label={`${heal.contested} contested · skipped`}
                size="small" color="warning" variant="outlined" sx={{ height: 16, fontSize: FS.caption }} />
            )}
            {runStatus.error && (
              <Typography sx={{ fontSize: FS.caption, color: "error.main" }}>{runStatus.error}</Typography>
            )}
          </Stack>
          {heal?.dry_run && (
            <Alert severity="info" sx={{ py: 0.25, fontSize: FS.small, borderRadius: "5px", fontFamily: "'Inter', system-ui, sans-serif" }}>
              <b>Domain heal preview</b> — {heal.fillable ?? 0} domainless {heal.fillable === 1 ? "company" : "companies"} would
              receive a domain from their people's corporate emails
              {(heal.contested ?? 0) > 0 && <> · <b>{heal.contested}</b> contested (wanted by more than one company — skipped)</>}
              {(heal.ambiguous ?? 0) > 0 && <> · {heal.ambiguous} ambiguous (no clear winner — skipped)</>}.
              {contestedGroups.length > 0 && (
                <Button size="small" onClick={() => setShowGroups(v => !v)}
                  sx={{ textTransform: "none", fontSize: FS.small, ml: 1, py: 0, minWidth: 0 }}>
                  {showGroups ? "Hide" : "Show"} contested groups
                </Button>
              )}
              <Collapse in={showGroups}>
                <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2, fontSize: FS.small }}>
                  {contestedGroups.slice(0, MAX_CONTESTED_SHOWN).map(([domain, ids]) => (
                    <li key={domain}><code>{domain}</code> — companies {ids.join(", ")}</li>
                  ))}
                  {contestedGroups.length > MAX_CONTESTED_SHOWN && (
                    <li>…and {contestedGroups.length - MAX_CONTESTED_SHOWN} more</li>
                  )}
                </Box>
              </Collapse>
            </Alert>
          )}
          {heal?.error && (
            <Typography sx={{ fontSize: FS.caption, color: "error.main" }}>Domain heal: {heal.error}</Typography>
          )}
        </Stack>
      )}

      <ConfirmActionDialog
        open={confirmOpen}
        title="Re-link companies and heal their domains?"
        confirmLabel="Re-link & heal domains"
        severity="error"
        confirming={triggering}
        error={syncError}
        onConfirm={() => start(false)}
        onClose={() => setConfirmOpen(false)}
      >
        <p style={{ marginTop: 0 }}>
          Gives every domainless company the corporate email domain its linked people share.
          A domain claim is <b>permanent</b>: it becomes the company's identity and everything
          matches on it from then on.
        </p>
        <p>
          Domains wanted by more than one company are <b>skipped</b> and listed in the result —
          run <i>Preview heal</i> first if you have not, and read that count.
        </p>
        <p style={{ marginBottom: 0 }}>
          Also merges LinkedIn and domain duplicates and re-links orphan records, exactly as the
          nightly cycle does. Takes 10–20 minutes on production.
        </p>
      </ConfirmActionDialog>
    </Box>
  );
}

// ── Daily sync summary card ──────────────────────────────────────────────────

function SyncCycleCard({ entry, cycleFailed = false }: { entry: SyncCycleEntry; cycleFailed?: boolean }) {
  // In a cycle that died, the step still marked "running" is where it died —
  // show it as such, not as a spinner that will never stop.
  const diedHere = entry.outcome === "running" && cycleFailed;
  const isDone = entry.outcome === "done";
  const isFailed = entry.outcome === "failed" || entry.outcome === "error" || diedHere;
  const isTimeout = entry.outcome === "timeout";
  // Completed, but one of its product feeds failed (e.g. one G2 product 504'd).
  const isPartial = entry.outcome === "partial";
  const isWarn = isTimeout || isPartial;
  const isSkipped = entry.outcome === "skipped";
  const isRunning = entry.outcome === "running" && !cycleFailed;
  const isPending = entry.outcome === "pending";

  const g2Rows = entry.products
    ? Object.values(entry.products).reduce((sum, p) => sum + (p.account_intent?.rows ?? 0), 0)
    : null;

  return (
    <Paper variant="outlined" sx={{
      borderRadius: "10px", p: 1.5, display: "flex", flexDirection: "column",
      alignItems: "center", textAlign: "center", gap: 0.5, minHeight: 110,
      justifyContent: "space-between",
      borderColor: isFailed ? "error.main" : isWarn ? "warning.main" : isRunning ? "info.main" : undefined,
      opacity: (isSkipped || isPending) ? 0.45 : 1,
    }}>
      <Box>
        <Typography sx={{ fontFamily: "'Inter', system-ui, sans-serif", fontWeight: FW.semibold, fontSize: FS.body, mb: 0.25 }}>
          {entry.name}
        </Typography>
        <Stack direction="row" alignItems="center" spacing={0.5} justifyContent="center">
          {isDone && <CheckCircleIcon color="success" sx={{ fontSize: 11 }} />}
          {isFailed && <ErrorOutlineIcon color="error" sx={{ fontSize: 11 }} />}
          {isTimeout && <AccessTimeIcon color="warning" sx={{ fontSize: 11 }} />}
          {isPartial && <ErrorOutlineIcon color="warning" sx={{ fontSize: 11 }} />}
          {isSkipped && <ErrorOutlineIcon sx={{ fontSize: 11, color: "text.disabled" }} />}
          {isRunning && <CircularProgress size={10} />}
          <Typography sx={{
            fontFamily: "'Inter', system-ui, sans-serif", fontSize: FS.caption, fontWeight: FW.semibold,
            color: isDone ? "success.main" : isFailed ? "error.main" : isWarn ? "warning.main" : isRunning ? "info.main" : "text.disabled",
          }}>
            {isPending ? "waiting" : diedHere ? "died here" : entry.outcome}
          </Typography>
        </Stack>
        {isRunning && <LinearProgress sx={{ width: "100%", borderRadius: 4, height: 2, mt: 0.5 }} />}
      </Box>

      <Stack spacing={0.25} alignItems="center">
        {entry.rows != null && (
          <Chip label={`${entry.rows.toLocaleString()} rows`} size="small" variant="outlined"
            sx={{ height: 16, fontSize: FS.caption }} />
        )}
        {g2Rows != null && g2Rows > 0 && (
          <Chip label={`${g2Rows.toLocaleString()} rows`} size="small" variant="outlined"
            sx={{ height: 16, fontSize: FS.caption }} />
        )}
        {entry.new != null && entry.new > 0 && (
          <Chip label={`${entry.new.toLocaleString()} new`} size="small" color="info" variant="outlined"
            sx={{ height: 16, fontSize: FS.caption }} />
        )}
        {entry.updated != null && entry.updated > 0 && (
          <Chip label={`${entry.updated.toLocaleString()} updated`} size="small" variant="outlined"
            sx={{ height: 16, fontSize: FS.caption, color: "text.secondary", borderColor: "divider" }} />
        )}
        {entry.linked != null && (
          <Chip label={`${entry.linked} linked`} size="small" color="success" variant="outlined"
            sx={{ height: 16, fontSize: FS.caption }} />
        )}
        {entry.still_orphan != null && entry.still_orphan > 0 && (
          <Chip label={`${entry.still_orphan} orphan`} size="small" color="warning" variant="outlined"
            sx={{ height: 16, fontSize: FS.caption }} />
        )}
        {entry.elapsed_seconds != null && (
          <Typography sx={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: FS.caption, color: "text.disabled" }}>
            {entry.elapsed_seconds}s
          </Typography>
        )}
      </Stack>

      {entry.error && (
        <Tooltip title={entry.error} arrow>
          <Typography sx={{
            fontFamily: "'Inter', system-ui, sans-serif", fontSize: FS.caption, color: "error.main",
            maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {entry.error.slice(0, 60)}
          </Typography>
        </Tooltip>
      )}
    </Paper>
  );
}


/** Render an ISO timestamp as HH:MM, d MMM in IST — the schedule's timezone —
 * regardless of the viewer's browser timezone. */
function formatIst(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", day: "numeric", month: "short",
  });
}

interface SyncSchedule {
  enabled: boolean;
  hour: number;
  minute: number;
  timezone: string;
  next_run?: string | null;
}

/** Run-now button + editable daily schedule (times in IST). Backend enforces
 * admin on the mutations; non-admins get a clear error toast. */
function SyncScheduleControls({ onCycleStarted }: { onCycleStarted: () => void }) {
  const { get, request } = useApiClient();
  const [schedule, setSchedule] = useState<SyncSchedule | null>(null);
  const [hour, setHour] = useState("5");
  const [minute, setMinute] = useState("0");
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchSchedule = useCallback(async () => {
    try {
      const sched = await get<SyncSchedule>("/sync/schedule");
      setSchedule(sched);
      setHour(String(sched.hour));
      setMinute(String(sched.minute));
      setEnabled(sched.enabled);
    } catch { /* schedule endpoint unavailable — hide the editor */ }
  }, [get]);

  useEffect(() => { fetchSchedule(); }, [fetchSchedule]);

  const runNow = async () => {
    setStarting(true); setError(null); setNotice(null);
    try {
      await request<{ status: string }>("post", "/sync/cycle", {});
      setNotice("Full sync cycle started — progress appears below.");
      onCycleStarted();
    } catch (err) {
      setError((err as { message?: string })?.message || "Failed to start the sync cycle");
    } finally { setStarting(false); }
  };

  const saveSchedule = async () => {
    const h = parseInt(hour, 10), m = parseInt(minute, 10);
    if (Number.isNaN(h) || h < 0 || h > 23 || Number.isNaN(m) || m < 0 || m > 59) {
      setError("Time must be a valid HH (0-23) and MM (0-59)."); return;
    }
    setSaving(true); setError(null); setNotice(null);
    try {
      const sched = await request<SyncSchedule>("put", "/sync/schedule", { enabled, hour: h, minute: m });
      setSchedule(sched);
      setNotice(sched.enabled
        ? `Daily sync scheduled at ${String(sched.hour).padStart(2, "0")}:${String(sched.minute).padStart(2, "0")} IST.`
        : "Daily sync disabled.");
    } catch (err) {
      setError((err as { message?: string })?.message || "Failed to save the schedule");
    } finally { setSaving(false); }
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1.5} justifyContent="space-between">
        <Button
          variant="contained"
          size="small"
          disableElevation
          startIcon={starting ? <CircularProgress size={12} color="inherit" /> : <PlayArrowIcon sx={{ fontSize: 16 }} />}
          disabled={starting}
          onClick={runNow}
          sx={{ textTransform: "none", fontFamily: "'Inter', system-ui, sans-serif", fontWeight: FW.semibold, fontSize: FS.body }}
        >
          Run full sync now
        </Button>

        {schedule && (
          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
            <AccessTimeIcon sx={{ fontSize: 15, color: "text.secondary" }} />
            <Typography sx={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: FS.small, color: "text.secondary" }}>
              Daily at
            </Typography>
            <TextField value={hour} onChange={e => setHour(e.target.value)} size="small"
              inputProps={{ "aria-label": "Sync hour (IST, 0-23)", style: { padding: "3px 6px", width: 26, fontSize: FS.body, textAlign: "center" } }} />
            <Typography sx={{ fontSize: FS.body, color: "text.secondary" }}>:</Typography>
            <TextField value={minute} onChange={e => setMinute(e.target.value)} size="small"
              inputProps={{ "aria-label": "Sync minute (0-59)", style: { padding: "3px 6px", width: 26, fontSize: FS.body, textAlign: "center" } }} />
            <Chip label="IST" size="small" variant="outlined" sx={{ height: 18, fontSize: FS.caption }} />
            <Switch checked={enabled} onChange={e => setEnabled(e.target.checked)} size="small"
              inputProps={{ "aria-label": "Enable daily sync" }} />
            <Button size="small" onClick={saveSchedule} disabled={saving}
              sx={{ textTransform: "none", fontFamily: "'Inter', system-ui, sans-serif", fontSize: FS.small }}>
              {saving ? "Saving…" : "Save"}
            </Button>
            {schedule.next_run && enabled && (
              <Typography sx={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: FS.small, color: "text.disabled" }}>
                next: {formatIst(schedule.next_run)} IST
              </Typography>
            )}
          </Stack>
        )}
      </Stack>
      {error && <Alert severity="error" sx={{ mt: 1, py: 0, fontSize: FS.small }}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mt: 1, py: 0, fontSize: FS.small }}>{notice}</Alert>}
    </Box>
  );
}


function DailySyncSummary() {
  const { get, request } = useApiClient();
  const qc = useQueryClient();
  const { isAdmin } = useUserRole();
  const [cycle, setCycle] = useState<SyncCycleResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  const prevStatusRef = useRef<string | null>(null);

  const fetchCycle = useCallback(async () => {
    try {
      const data = await get<SyncCycleResult>("/sync/last-cycle");
      if (prevStatusRef.current === "running" && data.status === "done") {
        invalidateSyncQueries(qc);
      }
      prevStatusRef.current = data.status;
      setCycle(data);
    } catch {
      // Keep previous cycle on transient errors — only null on initial load
    } finally { setLoading(false); }
  }, [get, qc]);

  useEffect(() => { fetchCycle(); }, [fetchCycle]);
  useEffect(() => {
    const interval = cycle?.status === "running" ? 5_000 : 60_000;
    const id = setInterval(fetchCycle, interval);
    return () => clearInterval(id);
  }, [fetchCycle, cycle?.status]);

  if (loading) {
    return (
      <Paper variant="outlined" sx={{ p: 3, borderRadius: "10px", textAlign: "center" }}>
        <CircularProgress size={20} />
      </Paper>
    );
  }

  if (!cycle) {
    return (
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: "10px" }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <InfoOutlinedIcon sx={{ fontSize: 17, color: "text.secondary", mt: 0.15, flexShrink: 0 }} />
          <Box>
            <Typography sx={{ fontFamily: "'Inter', system-ui, sans-serif", fontWeight: FW.semibold, fontSize: FS.reading, mb: 0.5 }}>
              No scheduled sync has run yet
            </Typography>
            <Typography sx={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: FS.small, color: "text.secondary" }}>
              Daily automatic sync runs when SYNC_ENABLED=true. Use the Manual Sync section below to trigger syncs on demand.
            </Typography>
          </Box>
        </Stack>
      </Paper>
    );
  }

  const isRunning = cycle.status === "running";
  const isFailed = cycle.status === "failed" || cycle.status === "interrupted";
  // Still "running" but no longer beating: the orchestrator died with its pod.
  // The backend flips it to failed within minutes; admins can clear it right away.
  const stuck = isRunning && heartbeatLooksDead(cycle.last_heartbeat, cycle.started_at);
  const diedAt = (isFailed || stuck) ? cycle.syncs.find(s => s.outcome === "running")?.name : undefined;

  const clearCycle = async () => {
    setClearing(true); setClearError(null);
    try {
      await request<{ reset: number }>("post", "/sync/scheduled_cycle/reset");
      await fetchCycle();
    } catch (err) {
      setClearError((err as { message?: string })?.message || "Failed to clear the cycle");
    } finally { setClearing(false); }
  };

  const elapsedMin = cycle.elapsed_seconds >= 60
    ? `${Math.floor(cycle.elapsed_seconds / 60)}m ${Math.round(cycle.elapsed_seconds % 60)}s`
    : `${Math.round(cycle.elapsed_seconds)}s`;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
        <Stack direction="row" alignItems="center" spacing={1}>
          {isRunning
            ? <CircularProgress size={13} />
            : <ScheduleIcon sx={{ fontSize: 15, color: "text.secondary" }} />}
          <Typography sx={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: FS.body, color: "text.secondary" }}>
            {isRunning ? "Started " : ""}{formatDateTime(cycle.started_at)}
          </Typography>
          <Chip label={isRunning ? `${elapsedMin} elapsed` : elapsedMin} size="small" variant="outlined"
            color={isRunning ? "info" : "default"}
            sx={{ height: 18, fontSize: FS.caption, fontFamily: "'Inter', system-ui, sans-serif" }} />
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center">
          {isFailed ? (
            <Chip
              icon={<ErrorOutlineIcon sx={{ fontSize: "10px !important" }} />}
              label={`cycle ${cycle.status} · ${cycle.ok}/${cycle.total} done`}
              size="small"
              color="error"
              variant="outlined"
              sx={{ height: 20, fontSize: FS.caption, fontWeight: FW.semibold, fontFamily: "'Inter', system-ui, sans-serif" }}
            />
          ) : isRunning ? (
            <Chip
              icon={<CircularProgress size={9} color="inherit" />}
              label={`${cycle.ok}/${cycle.total} syncing…`}
              size="small"
              color="info"
              variant="outlined"
              sx={{ height: 20, fontSize: FS.caption, fontWeight: FW.semibold, fontFamily: "'Inter', system-ui, sans-serif" }}
            />
          ) : (
            <Chip
              icon={cycle.failed === 0 ? <CheckCircleIcon sx={{ fontSize: "10px !important" }} /> : undefined}
              label={`${cycle.ok}/${cycle.total} synced`}
              size="small"
              color={cycle.failed > 0 ? "warning" : "success"}
              variant="outlined"
              sx={{ height: 20, fontSize: FS.caption, fontWeight: FW.semibold, fontFamily: "'Inter', system-ui, sans-serif" }}
            />
          )}
          {cycle.failed > 0 && (
            <Chip label={`${cycle.failed} failed`} size="small" color="error" variant="outlined"
              sx={{ height: 20, fontSize: FS.caption, fontWeight: FW.semibold, fontFamily: "'Inter', system-ui, sans-serif" }} />
          )}
          <Tooltip title="Refresh">
            <Button size="small" onClick={fetchCycle} sx={{ minWidth: 28, p: 0.5 }}>
              <RefreshIcon sx={{ fontSize: 14, color: "text.secondary" }} />
            </Button>
          </Tooltip>
        </Stack>
      </Stack>

      {(isFailed || stuck) && (
        <Alert
          severity={isFailed ? "error" : "warning"}
          sx={{ py: 0.25, fontSize: FS.small, fontFamily: "'Inter', system-ui, sans-serif" }}
          action={isAdmin && stuck ? (
            <Button color="inherit" size="small" onClick={clearCycle} disabled={clearing}
              startIcon={<RestartAltIcon sx={{ fontSize: 13 }} />}
              sx={{ textTransform: "none", fontSize: FS.small, whiteSpace: "nowrap" }}>
              {clearing ? "Clearing…" : "Clear stuck cycle"}
            </Button>
          ) : undefined}
        >
          {isFailed ? (
            <>
              This cycle did not finish{diedAt ? <> — it died during <b>{diedAt}</b></> : null}.
              {cycle.error ? <> {cycle.error}</> : null} The steps after it did not run; trigger
              them from Manual Sync below.
            </>
          ) : (
            <>
              This cycle has stopped reporting progress{diedAt ? <> during <b>{diedAt}</b></> : null} —
              the pod probably restarted. It will be marked failed automatically within a few
              minutes{isAdmin ? ", or clear it now" : ""}.
            </>
          )}
          {clearError && <> {clearError}</>}
        </Alert>
      )}

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 1.5 }}>
        {cycle.syncs.map(s => <SyncCycleCard key={s.name} entry={s} cycleFailed={isFailed || stuck} />)}
      </Box>
    </Box>
  );
}


// ── CSV upload section ──────────────────────────────────────────────────────

function CsvUploadSection() {
  const [sourceKey, setSourceKey] = useState(CSV_SOURCES[0].key);
  const [g2Product, setG2Product] = useState(G2_PRODUCTS[0]);

  const selected = CSV_SOURCES.find(s => s.key === sourceKey)!;
  const wso2Product = sourceKey === "g2-intent" ? g2Product : "";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box>
        <Typography variant="caption" fontWeight={FW.semibold} color="text.secondary"
          sx={{ textTransform: "uppercase", letterSpacing: 0.8, display: "block", mb: 1, fontFamily: "'Inter', system-ui, sans-serif" }}>
          Select data source
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={0.5}>
          {CSV_SOURCES.map(s => (
            <Chip
              key={s.key}
              label={s.label}
              onClick={() => setSourceKey(s.key)}
              variant={sourceKey === s.key ? "filled" : "outlined"}
              color={sourceKey === s.key ? "primary" : "default"}
              size="small"
              sx={{ fontSize: FS.small, fontFamily: "'Inter', system-ui, sans-serif", fontWeight: sourceKey === s.key ? FW.semibold : FW.regular }}
            />
          ))}
        </Stack>
      </Box>

      {sourceKey === "g2-intent" && (
        <Box>
          <Typography variant="caption" fontWeight={FW.semibold} color="text.secondary"
            sx={{ textTransform: "uppercase", letterSpacing: 0.8, display: "block", mb: 0.75, fontFamily: "'Inter', system-ui, sans-serif" }}>
            G2 Product
          </Typography>
          <Stack direction="row" gap={0.5}>
            {G2_PRODUCTS.map(p => (
              <Chip
                key={p}
                label={p.replace("WSO2 ", "")}
                onClick={() => setG2Product(p)}
                variant={g2Product === p ? "filled" : "outlined"}
                color={g2Product === p ? "primary" : "default"}
                size="small"
                sx={{ fontSize: FS.small, fontFamily: "'Inter', system-ui, sans-serif", fontWeight: g2Product === p ? FW.semibold : FW.regular }}
              />
            ))}
          </Stack>
        </Box>
      )}

      <Divider />

      <UploadPanel endpoint={selected.endpoint} wso2Product={wso2Product} columns={selected.columns} />
    </Box>
  );
}



// How often to re-check which runs are live. The page may sit open for hours while
// a backfill streams, and a run can be started from another tab, another admin, or
// the nightly cycle — a mount-only fetch would never see those.
const ACTIVE_RUNS_REFRESH_MS = 30_000;

/** Live runs by sync_type (`/sync/active-runs`), so every row can attach its polling
 * to a run it did not start — after a reload, or one that began while the page was
 * open. The full lead re-sync runs for hours and the operator will not sit on this
 * page for it. Rows whose run has finished simply stop being listed; the row's own
 * poll has already seen the terminal status by then. */
function useActiveRuns(): Record<string, string> {
  const { get } = useApiClient();
  const [active, setActive] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    const load = () => {
      get<Record<string, string>>("/sync/active-runs")
        .then(runs => { if (alive) setActive(runs); })
        .catch(() => { /* optional — rows still work without it */ });
    };
    load();
    const id = setInterval(load, ACTIVE_RUNS_REFRESH_MS);
    return () => { alive = false; clearInterval(id); };
  }, [get]);
  return active;
}

type ManualSyncRow = {
  label: string; icon: ReactNode; color: string;
  hook: ReturnType<typeof useSyncPanel>; rowLabel: string; secondaryActions?: ReactNode;
};

function ManualSyncSection() {
  const qc = useQueryClient();
  const { isAdmin } = useUserRole();
  const active = useActiveRuns();
  const sfAccounts = useSyncPanel("sf-accounts", active.sf_accounts);
  const sfLeads    = useSyncPanel("sf-leads", active.sf_leads);
  const certs      = useSyncPanel("certifications", active.certifications);
  const liJobTitle = useSyncPanel("linkedin-job-title", active.linkedin_job_title);
  const liCompany  = useSyncPanel("linkedin-company", active.linkedin_company);
  const liCamps    = useSyncPanel("linkedin-campaigns", active.linkedin_campaigns);
  const reo        = useSyncPanel("reo", active.reo);
  const [fullResyncOpen, setFullResyncOpen] = useState(false);

  const invalidateAll = useCallback(() => invalidateSyncQueries(qc), [qc]);

  const startFullResync = async () => {
    const started = await sfLeads.handleFullSync(invalidateAll);
    if (started) setFullResyncOpen(false);
  };

  // The one-time backfill — admin-only on the backend too.
  const fullResyncButton = isAdmin ? (
    <Tooltip title="Re-pull every lead through the current feed — the one-time backfill. Takes hours; runs in the background.">
      <span>
        <Button size="small" color="warning" disabled={sfLeads.triggering || sfLeads.isRunning}
          onClick={() => setFullResyncOpen(true)} startIcon={<ReplayIcon sx={{ fontSize: 13 }} />}
          sx={{
            textTransform: "none", fontSize: FS.small, fontFamily: "'Inter', system-ui, sans-serif",
            fontWeight: FW.semibold, px: 1, py: 0.3, flexShrink: 0,
          }}>
          Full re-sync…
        </Button>
      </span>
    </Tooltip>
  ) : undefined;

  const sfRows: ManualSyncRow[] = [
    { label: "SF Accounts",    icon: <BusinessIcon sx={{ fontSize: 14 }} />,  color: "#00A1E0", hook: sfAccounts, rowLabel: "accounts" },
    { label: "SF Leads",       icon: <PeopleIcon sx={{ fontSize: 14 }} />,    color: "#00A1E0", hook: sfLeads,    rowLabel: "leads", secondaryActions: fullResyncButton },
    { label: "Certifications", icon: <SchoolIcon sx={{ fontSize: 14 }} />,    color: "#00A1E0", hook: certs,      rowLabel: "certs" },
  ];

  const liRows: ManualSyncRow[] = [
    { label: "LI Job Title",  icon: <LinkedInIcon sx={{ fontSize: 14 }} />, color: "#0A66C2", hook: liJobTitle, rowLabel: "rows" },
    { label: "LI Company",    icon: <LinkedInIcon sx={{ fontSize: 14 }} />, color: "#0A66C2", hook: liCompany,  rowLabel: "rows" },
    { label: "LI Campaigns",  icon: <CampaignIcon sx={{ fontSize: 14 }} />, color: "#0A66C2", hook: liCamps,    rowLabel: "campaigns" },
  ];

  const renderRow = (r: ManualSyncRow) => (
    <SyncRow
      key={r.label} icon={r.icon} color={r.color} label={r.label}
      lastSync={r.hook.syncState.last_sync} lastSyncAt={r.hook.syncState.last_sync_at}
      isRunning={r.hook.isRunning} triggering={r.hook.triggering}
      runStatus={r.hook.runStatus} syncError={r.hook.syncError}
      onSync={() => r.hook.handleSync(invalidateAll)} rowLabel={r.rowLabel}
      secondaryActions={r.secondaryActions}
      onReset={isAdmin ? () => r.hook.handleReset() : undefined}
      resetting={r.hook.resetting}
    />
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Salesforce group */}
      <Typography sx={{
        fontFamily: "'Inter', system-ui, sans-serif", fontSize: FS.caption,
        fontWeight: FW.semibold, color: "text.disabled", textTransform: "uppercase",
        letterSpacing: 1, px: 0.5, pt: 0.5, pb: 0.5,
      }}>
        Salesforce
      </Typography>
      {sfRows.map(renderRow)}

      <Divider sx={{ my: 1 }} />

      {/* G2 group */}
      <Typography sx={{
        fontFamily: "'Inter', system-ui, sans-serif", fontSize: FS.caption,
        fontWeight: FW.semibold, color: "text.disabled", textTransform: "uppercase",
        letterSpacing: 1, px: 0.5, pt: 0.5, pb: 0.5,
      }}>
        G2 Intent
      </Typography>
      <G2SyncAllRow />

      <Divider sx={{ my: 1 }} />

      {/* LinkedIn group */}
      <Typography sx={{
        fontFamily: "'Inter', system-ui, sans-serif", fontSize: FS.caption,
        fontWeight: FW.semibold, color: "text.disabled", textTransform: "uppercase",
        letterSpacing: 1, px: 0.5, pt: 0.5, pb: 0.5,
      }}>
        LinkedIn
      </Typography>
      {liRows.map(renderRow)}

      <Divider sx={{ my: 1 }} />

      {/* Reo.dev group */}
      <Typography sx={{
        fontFamily: "'Inter', system-ui, sans-serif", fontSize: FS.caption,
        fontWeight: FW.semibold, color: "text.disabled", textTransform: "uppercase",
        letterSpacing: 1, px: 0.5, pt: 0.5, pb: 0.5,
      }}>
        Reo.dev
      </Typography>
      {renderRow({ label: "Reo Intent", icon: <HubOutlinedIcon sx={{ fontSize: 14 }} />, color: "#6b4fbb", hook: reo, rowLabel: "records" })}

      <Divider sx={{ my: 1 }} />

      {/* Tools group */}
      <Typography sx={{
        fontFamily: "'Inter', system-ui, sans-serif", fontSize: FS.caption,
        fontWeight: FW.semibold, color: "text.disabled", textTransform: "uppercase",
        letterSpacing: 1, px: 0.5, pt: 0.5, pb: 0.5,
      }}>
        Tools
      </Typography>
      <RelinkRow activeRunId={active.company_relinker} />

      <ConfirmActionDialog
        open={fullResyncOpen}
        title="Re-pull every Salesforce lead?"
        confirmLabel="Start full re-sync"
        severity="warning"
        confirming={sfLeads.triggering}
        error={fullResyncOpen ? sfLeads.syncError : null}
        onConfirm={startFullResync}
        onClose={() => setFullResyncOpen(false)}
      >
        <p style={{ marginTop: 0 }}>
          Streams <b>every</b> Salesforce lead (~750k) through the current feed in 500-row pages
          and re-resolves the canonical source, region and company domain on each one. Fields
          filled by enrichment (Apollo / ZoomInfo) are preserved.
        </p>
        <p>
          <b>Expect hours.</b> It runs in the background — you can leave this page; the row
          re-attaches when you come back and shows "leads so far".
        </p>
        <p>
          If it is interrupted (a deploy, a pod restart), click <b>Full re-sync</b> again: it
          carries its own cursor and picks up from the last committed page, so nothing restarts
          from zero. The nightly <i>Sync</i> is unaffected either way — it keeps its own position.
        </p>
        <p style={{ marginBottom: 0 }}>
          The lead retention window applies on ingest exactly as on a nightly sync.
        </p>
      </ConfirmActionDialog>
    </Box>
  );
}


// ── Main page ─────────────────────────────────────────────────────────────────

/** CSV upload and manual/scheduled data sync management panel. */
function DailySyncControls() {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <>
      <SyncScheduleControls onCycleStarted={() => setRefreshKey(k => k + 1)} />
      <DailySyncSummary key={refreshKey} />
    </>
  );
}


export default function DataUpload() {
  const [openSection, setOpenSection] = useState<string | null>(null);

  const toggle = (key: string) => setOpenSection(prev => prev === key ? null : key);

  return (
    <Box sx={{
      display: "flex", flexDirection: "column", gap: 2.5,
      fontFamily: "'Inter', system-ui, sans-serif",
      p: 0.5,
    }}>
      {/* ── Section 1: Daily sync summary ─────────────────────── */}
      <Paper variant="outlined" sx={{
        borderRadius: "12px", overflow: "hidden",
        bgcolor: C.panel,
      }}>
        <Box sx={{
          px: 2.5, py: 1.5,
          bgcolor: `${C.text}06`,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <CloudSyncIcon sx={{ fontSize: 18, color: C.orange }} />
            <Typography sx={{ fontFamily: "'Inter', system-ui, sans-serif", fontWeight: FW.semibold, fontSize: FS.reading }}>
              Daily Sync
            </Typography>
          </Stack>
        </Box>
        <Box sx={{ p: 2.5 }}>
          <DailySyncControls />
        </Box>
      </Paper>

      {/* ── Section 2: Manual sync (collapsed) ────────────────── */}
      <CollapsibleSection
        title="Manual Sync"
        icon={<SyncIcon sx={{ fontSize: 15, color: "text.secondary" }} />}
        open={openSection === "manual"}
        onToggle={() => toggle("manual")}
      >
        <Typography sx={{
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: FS.small, color: "text.secondary", mb: 2,
        }}>
          Use when the daily sync fails or you need to force-refresh a specific data source.
        </Typography>
        <ManualSyncSection />
      </CollapsibleSection>

      {/* ── Section 3: CSV upload (collapsed) ─────────────────── */}
      <CollapsibleSection
        title="CSV Upload"
        icon={<UploadFileIcon sx={{ fontSize: 15, color: "text.disabled" }} />}
        open={openSection === "csv"}
        onToggle={() => toggle("csv")}
      >
        <Typography sx={{
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: FS.small, color: "text.secondary", mb: 2,
        }}>
          Last resort — upload a CSV file when API sync is unavailable for a data source.
        </Typography>
        <CsvUploadSection />
      </CollapsibleSection>
    </Box>
  );
}
