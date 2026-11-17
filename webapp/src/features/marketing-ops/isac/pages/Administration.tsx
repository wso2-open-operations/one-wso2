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

import { AutoFixHigh as AutoFixHighIcon } from "../icons";
import { Refresh as RefreshIcon } from "../icons";
import { Send as SendIcon } from "../icons";
import { NotificationsActive as NotificationsActiveIcon } from "../icons";
import { StopCircle as StopCircleIcon } from "../icons";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  FormGroup,
  Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { StageAlertsRun, StageAlertsStatus, useApiClient } from "../api/client";
import { useUserRole } from "../context/UserRoleContext";
import { FS, FW } from "../theme/typeScale";

// ── Types ────────────────────────────────────────────────────────────────────

interface TableCount {
  label: string;
  count: number;
}

interface ImportRecord {
  id: number;
  source_system: string;
  file_name: string;
  rows_imported: number;
  status: "done" | "partial" | "processing" | "pending";
  imported_by: string;
  started_at: string | null;
  error_msg: string | null;
}

interface StatsResponse {
  table_counts: TableCount[];
  imports: ImportRecord[];
}

/** Message for a failed request: the server's `detail` when it sent one, else the error's own message. */
function errorMessage(e: unknown, fallback: string): string {
  if (typeof e !== "object" || e === null) return fallback;
  const { response, message } = e as { response?: { data?: { detail?: unknown } }; message?: unknown };
  const detail = response?.data?.detail;
  if (typeof detail === "string") return detail;
  return typeof message === "string" ? message : fallback;
}

// ── Source system display labels ──────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  sf_customers:             "SF Customers",
  sf_partners:              "SF Partners",
  certifications:           "Certifications",
  pardot_leads:             "Pardot Leads",
  pardot_snapshots:         "Pardot Snapshots",
  linkedin_stats_job_title: "LinkedIn by Job Title",
  linkedin_stats_company:   "LinkedIn by Company",
  g2_visit_events:          "G2 Visit Events",
  g2_account_intent:        "G2 Account Intent",
};

// ── Status chip ───────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { color: "success" | "warning" | "error" | "default"; label: string }> = {
    done:       { color: "success", label: "Done" },
    partial:    { color: "warning", label: "Partial" },
    processing: { color: "default", label: "Processing" },
    pending:    { color: "default", label: "Pending" },
  };
  const cfg = map[status] ?? { color: "default", label: status };
  return <Chip size="small" color={cfg.color} label={cfg.label} />;
}

// ── Tab: Overview ─────────────────────────────────────────────────────────────

function OverviewTab({ counts }: { counts: TableCount[] }) {
  return (
    <Box>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
        Current row counts across all tables.
      </Typography>
      <Grid container spacing={2}>
        {counts.map((t) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={t.label}>
            <Card variant="outlined">
              <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {t.label}
                </Typography>
                <Typography variant="h5" fontWeight={FW.bold} color="primary">
                  {t.count.toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

// ── Tab: Import History ────────────────────────────────────────────────────────

function ImportHistoryTab({ imports }: { imports: ImportRecord[] }) {
  if (!imports.length) {
    return (
      <Typography color="text.secondary" sx={{ mt: 2 }}>
        No import records found.
      </Typography>
    );
  }

  return (
    <Box sx={{ overflowX: "auto" }}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
        The 50 most recent data imports.
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>Source</TableCell>
            <TableCell>File</TableCell>
            <TableCell align="right">Rows</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Uploaded By</TableCell>
            <TableCell>Date</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {imports.map((imp) => (
            <TableRow key={imp.id} hover>
              <TableCell sx={{ color: "text.secondary" }}>#{imp.id}</TableCell>
              <TableCell>
                <Typography variant="body2" fontFamily="monospace" fontSize={FS.small}>
                  {SOURCE_LABELS[imp.source_system] ?? imp.source_system}
                </Typography>
              </TableCell>
              <TableCell>
                <Tooltip title={imp.file_name ?? ""}>
                  <Typography
                    variant="body2"
                    noWrap
                    sx={{ maxWidth: 200, display: "block" }}
                  >
                    {imp.file_name ?? "—"}
                  </Typography>
                </Tooltip>
              </TableCell>
              <TableCell align="right">
                {(imp.rows_imported ?? 0).toLocaleString()}
              </TableCell>
              <TableCell>
                <StatusChip status={imp.status} />
                {imp.error_msg && (
                  <Tooltip title={imp.error_msg}>
                    <Typography variant="caption" color="warning.main" sx={{ ml: 0.5 }}>
                      ⚠
                    </Typography>
                  </Tooltip>
                )}
              </TableCell>
              <TableCell>
                <Typography variant="body2" noWrap sx={{ maxWidth: 160 }}>
                  {imp.imported_by ?? "—"}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {imp.started_at
                    ? new Date(imp.started_at).toLocaleString()
                    : "—"}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

// ── Tab: Maintenance (admin data tasks) ───────────────────────────────────────

/** Status of a lead-backfill run. The backend spreads the result dict into the
 * top-level response, so counts sit alongside `status`. */
interface BackfillRun {
  status: "running" | "done" | "failed" | string;
  error?: string | null;
  sf_leads?: number;
  contacts?: number;
  skipped_no_email?: number;
  attach_linked?: Record<string, number>;
}

/** Admin data-maintenance actions.
 *
 * Currently one task: the **canonical lead backfill** — resolves existing
 * `sf_leads` + `contacts` into the canonical `leads` entity (deduped by email),
 * populates the journey rollup, and links the enrichment / campaign / cert / reo
 * attach rows to the canonical person. Idempotent — safe to re-run; it only fills
 * gaps. Gated to admins (and the endpoint itself is admin-only). */
function MaintenanceTab() {
  const { get, request } = useApiClient();
  const { isAdmin } = useUserRole();
  const [run, setRun] = useState<BackfillRun | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The polls re-arm themselves from a timer; the timer reaches them through these refs.
  const pollFnRef = useRef<(runId: string) => void>(() => {});
  const pollRunningFnRef = useRef<() => void>(() => {});

  /** Poll a specific run by id until it finishes, surfacing its result. */
  const poll = useCallback((runId: string) => {
    get<BackfillRun>(`/sync/backfill-leads/${runId}`)
      .then((s) => {
        setRun(s);
        if (s.status === "running") pollRef.current = setTimeout(() => pollFnRef.current(runId), 2000);
        else setRunning(false);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Failed to poll backfill status");
        setRunning(false);
      });
  }, [get]);

  /** Fallback when a run is already in progress (no run_id to poll — e.g. started
   * on another pod/tab): watch the running flag until it clears. We can only see
   * the boolean, not success/failure, so the message stays status-neutral. */
  const pollRunning = useCallback(() => {
    get<{ running: boolean }>("/sync/backfill-leads/running")
      .then((r) => {
        if (r.running) pollRef.current = setTimeout(() => pollRunningFnRef.current(), 2000);
        else { setRunning(false); setInfo("The in-progress lead backfill has ended — reload to see the latest data."); }
      })
      .catch(() => setRunning(false));
  }, [get]);

  useEffect(() => { pollFnRef.current = poll; pollRunningFnRef.current = pollRunning; }, [poll, pollRunning]);

  // On mount, reflect and actually watch an already-in-progress backfill (so the
  // spinner isn't stuck when a run was started elsewhere).
  useEffect(() => {
    get<{ running: boolean }>("/sync/backfill-leads/running")
      .then((r) => { if (r.running) { setRunning(true); pollRunning(); } })
      .catch(() => { /* ignore */ });
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, [get, pollRunning]);

  const start = async () => {
    setError(null); setInfo(null); setRun(null); setRunning(true);
    try {
      const r = await request<{ run_id: string }>("post", "/sync/backfill-leads");
      poll(r.run_id);
    } catch (e) {
      // A 409 means one is already running — re-check and watch it instead of erroring.
      try {
        const s = await get<{ running: boolean }>("/sync/backfill-leads/running");
        if (s.running) { setInfo("A lead backfill is already in progress — watching it."); pollRunning(); return; }
      } catch { /* fall through */ }
      setError(e instanceof Error ? e.message : "Failed to start backfill");
      setRunning(false);
    }
  };

  const attach = run?.attach_linked
    ? Object.entries(run.attach_linked).map(([k, v]) => `${k}: ${v.toLocaleString()}`).join(" · ")
    : null;

  return (
    <Box>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
        Admin data tasks — safe to re-run; they only fill gaps, never overwrite.
      </Typography>
      <Card variant="outlined">
        <CardContent>
          <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "flex-start" }}
            justifyContent="space-between" spacing={2}>
            <Box>
              <Typography variant="subtitle1" fontWeight={FW.bold}>Canonical Lead Backfill</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 640 }}>
                Resolves existing Salesforce leads and contacts into the canonical{" "}
                <b>leads</b> entity (deduped by email), populates the funnel/journey
                rollup, and links enrichment, campaign, certification, and reo rows to
                the canonical person. Run once after deploying the canonical-leads
                changes; ongoing syncs keep it current. Idempotent.
              </Typography>
            </Box>
            <Button variant="contained" onClick={start} disabled={!isAdmin || running}
              startIcon={running ? <CircularProgress size={16} color="inherit" /> : <AutoFixHighIcon />}
              sx={{ whiteSpace: "nowrap", flexShrink: 0 }}>
              {running ? "Running…" : "Run backfill"}
            </Button>
          </Stack>

          {running && !run && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress />
              <Typography variant="caption" color="text.secondary">
                Resolving leads… this can take a few minutes on a large dataset. You can leave this page.
              </Typography>
            </Box>
          )}
          {info && <Alert severity="info" sx={{ mt: 2 }} onClose={() => setInfo(null)}>{info}</Alert>}
          {error && <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>{error}</Alert>}
          {run?.status === "done" && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Backfill complete — linked {(run.sf_leads ?? 0).toLocaleString()} leads and{" "}
              {(run.contacts ?? 0).toLocaleString()} contacts to canonical persons
              {run.skipped_no_email ? ` (${run.skipped_no_email.toLocaleString()} skipped — no email)` : ""}.
              {attach && (
                <Box component="span" sx={{ display: "block", mt: 0.5 }}>
                  Attach tables linked — {attach}.
                </Box>
              )}
            </Alert>
          )}
          {run?.status === "failed" && (
            <Alert severity="error" sx={{ mt: 2 }}>Backfill failed: {run.error ?? "unknown error"}</Alert>
          )}
        </CardContent>
      </Card>

      <EnrichBackfillCard />
      <StageAlertsCard />
    </Box>
  );
}

/** Status of an enrichment-backfill run (backend spreads its detail dict into
 * the top-level response, so progress counts sit alongside `status`). */
interface EnrichRun {
  status: "running" | "done" | "failed" | string;
  error?: string | null;
  done?: number;
  total?: number;
  ok?: number;
  failed?: number;
  ineligible?: number;
  entity?: string;
  sources?: string[];
}

/** Admin: enrich the oldest not-yet-enriched Accounts/Leads (created since
 * 1 Jan 2026) from Apollo and/or ZoomInfo, in fixed batches, as a background
 * job. Skips records already enriched by every selected source, so each click
 * advances to the next batch. Spends provider credits. */
function EnrichBackfillCard() {
  const { get, request } = useApiClient();
  const { isAdmin } = useUserRole();
  const [entity, setEntity] = useState<"accounts" | "leads">("leads");
  const [apollo, setApollo] = useState(true);
  const [zoominfo, setZoominfo] = useState(true);
  const [count, setCount] = useState(100);
  const [run, setRun] = useState<EnrichRun | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // "Run until done": auto-fire the next batch until nothing's left (the whole
  // 34k from one click), plus a cumulative tally and overall enriched/pending.
  const [runUntilDone, setRunUntilDone] = useState(false);
  const [batches, setBatches] = useState(0);
  const [cum, setCum] = useState({ ok: 0, failed: 0, ineligible: 0 });
  const [overall, setOverall] = useState<{ enriched: number; pending: number } | null>(null);
  const runUntilDoneRef = useRef(false);  // read inside the poll chain (no stale closure)
  const stopRef = useRef(false);
  const runIdRef = useRef<string | null>(null);  // current run, for the Stop kill-switch
  const startBatchRef = useRef<() => void>(() => {});
  // The polls re-arm themselves from a timer; the timer reaches them through these refs.
  const pollFnRef = useRef<(runId: string) => void>(() => {});
  const pollRunningFnRef = useRef<() => void>(() => {});

  const sources = [apollo && "apollo", zoominfo && "zoominfo"].filter(Boolean) as string[];
  const safeCount = Math.min(500, Math.max(1, Math.floor(count) || 0));
  const estCredits = safeCount * sources.length;   // ~1 credit per source per record

  /** Refresh the overall enriched / pending totals (leads only) so progress is
   * visible across the whole backlog, not just the current 500-batch. The totals
   * are cleared where the type is switched away from leads. */
  const fetchOverall = useCallback(() => {
    if (entity !== "leads") return;
    Promise.all([
      get<{ total: number }>("/lead-enrichment/status?enrichment_filter=enriched&page_size=1"),
      get<{ total: number }>("/lead-enrichment/status?enrichment_filter=none&page_size=1"),
    ])
      .then(([e, p]) => setOverall({ enriched: e.total ?? 0, pending: p.total ?? 0 }))
      .catch(() => { /* non-fatal — counts are a nicety */ });
  }, [get, entity]);

  /** Poll one run to completion. On finish: accumulate the tally, refresh the
   * overall counts, and — in "run until done" mode — auto-start the next batch. */
  const poll = useCallback((runId: string) => {
    get<EnrichRun>(`/enrichment-backfill/${runId}`)
      .then((s) => {
        setRun(s);
        if (s.status === "running") { pollRef.current = setTimeout(() => pollFnRef.current(runId), 2000); return; }
        setCum((c) => ({ ok: c.ok + (s.ok ?? 0), failed: c.failed + (s.failed ?? 0), ineligible: c.ineligible + (s.ineligible ?? 0) }));
        fetchOverall();
        // Keep going only on a clean 'done' — a 'cancelled'/'failed' batch stops the loop.
        if (s.status === "done" && runUntilDoneRef.current && !stopRef.current) startBatchRef.current();
        else setRunning(false);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Failed to poll enrichment status");
        setRunning(false);
      });
  }, [get, fetchOverall]);

  /** Watch the running flag when there's no run_id to poll (started elsewhere). */
  const pollRunning = useCallback(() => {
    get<{ running: boolean }>("/enrichment-backfill/running")
      .then((r) => {
        if (r.running) pollRef.current = setTimeout(() => pollRunningFnRef.current(), 2000);
        else { setRunning(false); setInfo("The in-progress enrichment run has ended."); fetchOverall(); }
      })
      .catch(() => setRunning(false));
  }, [get, fetchOverall]);

  useEffect(() => { pollFnRef.current = poll; pollRunningFnRef.current = pollRunning; }, [poll, pollRunning]);

  /** Fire one backfill batch and poll it. When the server reports nothing left
   * ("empty") the loop ends. Shared by the single-run and run-until-done paths. */
  const startBatch = useCallback(async () => {
    try {
      const r = await request<{ status: string; run_id?: string; selected: number; message?: string }>(
        "post", "/enrichment-backfill/run", { entity, sources, count: safeCount });
      if (r.status === "empty" || !r.run_id) {
        runIdRef.current = null;
        setInfo(r.message ?? "Nothing left to enrich in range — all done.");
        setRunning(false);
        return;
      }
      runIdRef.current = r.run_id;
      setBatches((b) => b + 1);
      setInfo(`Enriching ${r.selected} ${entity}… you can leave this page.`);
      poll(r.run_id);
    } catch (e) {
      // 409 → a run is already going; watch it instead of erroring.
      try {
        const s = await get<{ running: boolean }>("/enrichment-backfill/running");
        if (s.running) { setInfo("An enrichment run is already in progress — watching it."); pollRunning(); return; }
      } catch { /* fall through */ }
      setError(e instanceof Error ? e.message : "Failed to start enrichment");
      setRunning(false);
    }
  }, [request, get, entity, sources, safeCount, poll, pollRunning]);

  useEffect(() => { startBatchRef.current = startBatch; }, [startBatch]);

  useEffect(() => {
    get<{ running: boolean }>("/enrichment-backfill/running")
      .then((r) => { if (r.running) { setRunning(true); pollRunning(); } })
      .catch(() => { /* ignore */ });
    fetchOverall();
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, [get, pollRunning, fetchOverall]);

  /** Start button — reset the tallies and fire the first batch. */
  const start = () => {
    setError(null); setInfo(null); setRun(null);
    if (!sources.length) { setError("Pick at least one source (Apollo or ZoomInfo)."); return; }
    stopRef.current = false;
    setCum({ ok: 0, failed: 0, ineligible: 0 });
    setBatches(0);
    setRunning(true);
    startBatch();
  };

  /** Stop button — the credit kill-switch. Cancels the in-flight run server-side
   * (stops within one record) and prevents the next batch from starting. */
  const stop = async () => {
    stopRef.current = true;
    setInfo("Stopping after the current record…");
    const id = runIdRef.current;
    if (id) { try { await request("post", `/enrichment-backfill/${id}/cancel`); } catch { /* ignore */ } }
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle1" fontWeight={FW.bold}>Enrich from Apollo / ZoomInfo</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2, maxWidth: 720 }}>
          Enriches the oldest not-yet-enriched records created since <b>1 Jan 2026</b>, in batches
          ordered by created date. Skips anything already enriched by every selected source, so
          clicking again picks up the next batch. Spends Apollo/ZoomInfo credits.
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} useFlexGap flexWrap="wrap">
          <TextField select size="small" label="Type" value={entity} disabled={running}
            onChange={(e) => {
              const next = e.target.value as "accounts" | "leads";
              setEntity(next);
              if (next !== "leads") setOverall(null);
            }} sx={{ minWidth: 140 }}>
            <MenuItem value="leads">Leads</MenuItem>
            <MenuItem value="accounts">Accounts</MenuItem>
          </TextField>
          <FormGroup row>
            <FormControlLabel control={<Checkbox size="small" checked={apollo} disabled={running} onChange={(e) => setApollo(e.target.checked)} />} label="Apollo" />
            <FormControlLabel control={<Checkbox size="small" checked={zoominfo} disabled={running} onChange={(e) => setZoominfo(e.target.checked)} />} label="ZoomInfo" />
          </FormGroup>
          <TextField type="number" size="small" label={runUntilDone ? "Batch size" : "How many"} value={count} disabled={running}
            onChange={(e) => setCount(Number(e.target.value))}
            inputProps={{ min: 1, max: 500 }} sx={{ width: 150 }}
            helperText={`Max 500 · ~${estCredits} credits${runUntilDone ? "/batch" : ""}`} />
          <FormControlLabel
            control={<Checkbox size="small" checked={runUntilDone} disabled={running}
              onChange={(e) => { setRunUntilDone(e.target.checked); runUntilDoneRef.current = e.target.checked; }} />}
            label="Run until done" />
          <Button variant="contained" onClick={start} disabled={!isAdmin || running || !sources.length}
            startIcon={running ? <CircularProgress size={16} color="inherit" /> : <AutoFixHighIcon />}
            sx={{ whiteSpace: "nowrap", flexShrink: 0 }}>
            {running ? "Enriching…" : runUntilDone ? "Run until done" : "Run enrichment"}
          </Button>
          {running && (
            <Button variant="outlined" color="error" onClick={stop}
              startIcon={<StopCircleIcon />} sx={{ whiteSpace: "nowrap", flexShrink: 0 }}>
              Stop
            </Button>
          )}
        </Stack>

        {overall && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
            Overall: <b>{overall.enriched.toLocaleString()}</b> enriched · <b>{overall.pending.toLocaleString()}</b> pending
            {overall.enriched + overall.pending > 0
              ? ` (${Math.round((overall.enriched / (overall.enriched + overall.pending)) * 100)}% done)` : ""}
          </Typography>
        )}
        {running && run && (run.total ?? 0) > 0 && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress variant="determinate" value={Math.round(((run.done ?? 0) / (run.total || 1)) * 100)} />
            <Typography variant="caption" color="text.secondary">
              {runUntilDone ? `Batch ${batches} · ` : ""}Enriching {run.done ?? 0} / {run.total ?? 0}… ({run.ok ?? 0} ok{run.ineligible ? `, ${run.ineligible} not eligible` : ""}{run.failed ? `, ${run.failed} failed` : ""})
              {runUntilDone ? ` · ${cum.ok} enriched so far this session` : ""}
            </Typography>
          </Box>
        )}
        {running && !run && <Box sx={{ mt: 2 }}><LinearProgress /></Box>}
        {info && <Alert severity="info" sx={{ mt: 2 }} onClose={() => setInfo(null)}>{info}</Alert>}
        {error && <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        {run?.status === "done" && !running && !runUntilDone && (
          <Alert severity="success" sx={{ mt: 2 }}>
            Enriched {(run.ok ?? 0).toLocaleString()} of {(run.total ?? 0).toLocaleString()} {run.entity ?? entity}
            {run.ineligible ? ` · ${run.ineligible} not eligible (no valid email/identifier — skipped from now on)` : ""}
            {run.failed ? ` · ${run.failed} failed` : ""}. Click again for the next batch.
          </Alert>
        )}
        {run?.status === "failed" && (
          <Alert severity="error" sx={{ mt: 2 }}>Enrichment failed: {run.error ?? "unknown error"}</Alert>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

/** Admin panel — read-only data stats and import history.
 *
 * Destructive data operations were intentionally removed from the product; a
 * genuine data wipe is a deliberate, audited DigiOps/DBA operation done outside ISAC.
 */
/** Admin: account-follow stage alerts — current flags, email-service readiness,
 * recent ledger counts, "send me a test email" and "run alerts now". The flags
 * themselves are environment settings (STAGE_ALERTS_*, EMAIL_SERVICE_*); this
 * card is for proving the connection and for triggering a run outside the
 * daily cycle during rollout. */
function StageAlertsCard() {
  const { get, request } = useApiClient();
  const { isAdmin } = useUserRole();
  const [status, setStatus] = useState<StageAlertsStatus | null>(null);
  const [busy, setBusy] = useState<"test" | "run" | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    get<StageAlertsStatus>("/admin/stage-alerts/status").then(setStatus).catch(() => setStatus(null));
  }, [get]);
  useEffect(() => { load(); }, [load]);

  const sendTest = async () => {
    setBusy("test"); setError(null); setInfo(null);
    try {
      const r = await request<{ ok: boolean; to: string }>("post", "/admin/stage-alerts/test-email", {});
      setInfo(`Test email sent to ${r.to}. Check your inbox — and that the WSO2 mark in the header loads.`);
    } catch (e) {
      setError(errorMessage(e, "Test email failed"));
    } finally { setBusy(null); }
  };

  const runNow = async () => {
    setBusy("run"); setError(null); setInfo(null);
    try {
      const r = await request<StageAlertsRun>("post", "/admin/stage-alerts/run");
      setInfo(`Evaluated ${r.pairs} pending move${r.pairs === 1 ? "" : "s"} — sent ${r.sent}, dry-run ${r.dry_run}, `
        + `skipped ${r.skipped}, failed ${r.failed}${r.dry_run_mode ? " (dry-run mode: nothing was emailed)" : ""}.`);
      load();
    } catch (e) {
      setError(errorMessage(e, "Run failed"));
    } finally { setBusy(null); }
  };

  const flag = (label: string, on: boolean, onText = "on", offText = "off") => (
    <Typography component="span" variant="body2" sx={{ mr: 2 }}>
      {label}: <Box component="b" sx={{ color: on ? "success.main" : "text.secondary" }}>{on ? onText : offText}</Box>
    </Typography>
  );
  const counts = status ? Object.entries(status.counts) : [];

  return (
    <Card variant="outlined" sx={{ mt: 3 }}>
      <CardContent>
        <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "flex-start" }}
          justifyContent="space-between" spacing={2}>
          <Box>
            <Typography variant="subtitle1" fontWeight={FW.bold}>Account-follow stage alerts</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 640 }}>
              After the daily score refresh, followers of a company whose funnel stage moved up are emailed
              once per move through the Email Notifications Service. Roll out with dry run on, then an
              allowlist of your own address, then everyone (settings <b>STAGE_ALERTS_*</b> and <b>EMAIL_SERVICE_*</b>).
            </Typography>
            {status && (
              <Box sx={{ mt: 1.25 }}>
                {flag("Enabled", status.enabled)}
                {flag("Dry run", status.dry_run)}
                {flag("Email service", status.email_configured, "configured", "not configured")}
                <Typography component="span" variant="body2" sx={{ mr: 2 }}>Sender: <b>{status.sender ?? "—"}</b></Typography>
                <Typography component="span" variant="body2" sx={{ mr: 2 }}>
                  Allowlist: <b>{status.allowlist.length ? status.allowlist.join(", ") : "everyone"}</b>
                </Typography>
                <Typography component="span" variant="body2">
                  Last 30 days: <b>{counts.length ? counts.map(([k, v]) => `${v} ${k}`).join(" · ") : "no ledger rows"}</b>
                </Typography>
              </Box>
            )}
          </Box>
          <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
            <Button variant="outlined" onClick={sendTest} disabled={!isAdmin || busy !== null || !status?.email_configured}
              startIcon={busy === "test" ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
              sx={{ whiteSpace: "nowrap" }}>
              Send me a test email
            </Button>
            <Button variant="contained" onClick={runNow} disabled={!isAdmin || busy !== null}
              startIcon={busy === "run" ? <CircularProgress size={16} color="inherit" /> : <NotificationsActiveIcon />}
              sx={{ whiteSpace: "nowrap" }}>
              Run alerts now
            </Button>
          </Stack>
        </Stack>
        {info && <Alert severity="info" sx={{ mt: 2 }} onClose={() => setInfo(null)}>{info}</Alert>}
        {error && <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      </CardContent>
    </Card>
  );
}

export default function Administration() {
  const { get } = useApiClient();
  const { isAdmin, loading: roleLoading } = useUserRole();

  const [tab, setTab] = useState(0);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch stats ──────────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await get<StatsResponse>("/admin/stats");
      setStats(data);
    } catch (e) {
      setError(errorMessage(e, "Failed to load stats"));
    } finally {
      setLoading(false);
    }
  }, [get]);

  // /admin/stats is admin-only server-side: don't request it (and collect a
  // 403) for everyone else — say so instead.
  useEffect(() => { if (isAdmin) fetchStats(); }, [fetchStats, isAdmin]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Box>
      {/* Header row */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Review imported data and upload history.
        </Typography>
        <Tooltip title="Refresh stats">
          <IconButton onClick={fetchStats} disabled={loading || !isAdmin} size="small">
            {loading ? <CircularProgress size={18} /> : <RefreshIcon />}
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Feedback */}
      {!isAdmin && !roleLoading && (
        <Alert severity="info" sx={{ mb: 2 }}>Data Management is available to administrators only.</Alert>
      )}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Paper variant="outlined">
        <Tabs
          // Clamp so the value never points at the admin-only tab when it's hidden.
          value={Math.min(tab, isAdmin ? 2 : 1)}
          onChange={(_: React.SyntheticEvent, v: number) => setTab(v)}
          sx={{ borderBottom: 1, borderColor: "divider", px: 2 }}
        >
          <Tab label="Overview" />
          <Tab label="Import History" />
          {isAdmin && <Tab label="Maintenance" />}
        </Tabs>

        <Box sx={{ p: 3 }}>
          {tab === 0 && (
            stats ? (
              <OverviewTab counts={stats.table_counts} />
            ) : loading ? (
              <CircularProgress size={24} />
            ) : null
          )}

          {tab === 1 && (
            stats ? (
              <ImportHistoryTab imports={stats.imports} />
            ) : loading ? (
              <CircularProgress size={24} />
            ) : null
          )}

          {tab === 2 && isAdmin && <MaintenanceTab />}
        </Box>
      </Paper>
    </Box>
  );
}
