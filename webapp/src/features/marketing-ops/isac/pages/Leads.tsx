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

import {
  Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, IconButton, InputAdornment, InputBase, LinearProgress, MenuItem, Snackbar, TextField, Tooltip, Typography,
} from "@wso2/oxygen-ui";
import { AutoFixHigh as AutoFixHighIcon } from "../icons";
import { CalendarMonthOutlined as CalendarMonthOutlinedIcon } from "../icons";
import { FlagOutlined as FlagOutlinedIcon } from "../icons";
import { HubOutlined as HubOutlinedIcon } from "../icons";
import { PlaceOutlined as PlaceOutlinedIcon } from "../icons";
import { Search as SearchIcon } from "../icons";
import { TroubleshootOutlined as TroubleshootOutlinedIcon } from "../icons";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { saveBlobAsFile, useApiClient } from "../api/client";
import { useRegionCountryMap, useSubdivisionMap } from "../api/queries";
import EnrichLeadDialog from "../components/EnrichLeadDialog";
import { FacetOption, FilterPill, PillSelect } from "../components/FilterPills";
import { ClampText, ExportMenu, ListFooter, PIPELINE_CARD_H, PipelineHeader, SelectionBar, formatLocation } from "../components/ListKit";
import RegionFilter from "../components/RegionFilter";
import { C, F } from "../theme/pageTokens";
import { allCountries, countriesForRegions, countryInRegions, stateOptionsFor } from "../utils/geo";
import { FS, FW, LABEL, ROW } from "../theme/typeScale";
import { isacPath } from "../paths";

const MAX_BULK = 200;
const PAGE_SIZE = 50;

/**
 * Lead table columns (flex layout). The header row and every data row spread
 * the SAME sizing objects — and share LEAD_ROW_GAP / LEAD_ROW_PX — so header
 * labels can't drift from the cells beneath them. The avatar, enrichment dot
 * and enrich button exist only in rows; the header renders an empty spacer of
 * the same size for each so the labels still line up.
 */
const LEAD_ROW_GAP = 1.25;
const LEAD_ROW_PX = 2;
const LEAD_COL = {
  avatar:   { width: 30, flexShrink: 0 },
  lead:     { flex: 1.4, minWidth: 0 },
  company:  { flex: 1, minWidth: 0, display: { xs: "none", md: "block" } },
  location: { width: 170, minWidth: 0, flexShrink: 0, display: { xs: "none", md: "block" } },
  stage:    { width: 96, flexShrink: 0, display: { xs: "none", sm: "block" } },
  type:     { width: 96, flexShrink: 0, display: { xs: "none", lg: "block" } },
  dot:      { width: 8, flexShrink: 0 },
  action:   { width: 32, flexShrink: 0 },
} as const;

/** Shared palette — identical to the Companies page for cross-page consistency. */

/** A single funnel stage with its lead count. */
export interface FunnelStage { stage: string; label: string; count: number; }
/** A lead row summarised for the list. */
export interface LeadRow {
  id: number; email: string | null; first_name: string | null; last_name: string | null;
  job_title: string | null; seniority: string | null; company_id: number | null;
  raw_company_name: string | null; lead_stage: string | null; lead_type: string | null;
  enrichment_status: string | null;
  country: string | null; state: string | null; city: string | null; region: string | null;
}

const STAGE_ORDER = ["subscriber", "lead", "mql", "sql", "opportunity", "customer"];
const STAGE_COLOR: Record<string, string> = {
  subscriber: C.slate, lead: C.blue, mql: C.amber, get sql() { return C.orange; }, opportunity: C.purple, customer: C.green,
};
/** Per-stage label / action / tooltip for the funnel hero (mirrors the Companies PIPELINE meta). */
const STAGE_META: Record<string, { label: string; action: string; tip: string }> = {
  subscriber:  { label: "Prospect",    action: "Known contact",      tip: "Prospect — a known contact (inbound or outbound) with no qualifying engagement yet (or stage not set)." },
  lead:        { label: "Lead",        action: "Engaged",            tip: "Lead — engaged / graded, beyond a bare prospect." },
  mql:         { label: "MQL",         action: "Marketing qualified", tip: "MQL — marketing-qualified lead." },
  sql:         { label: "SQL",         action: "Sales qualified",    tip: "SQL — sales-qualified lead." },
  opportunity: { label: "Opportunity", action: "In pipeline",        tip: "Opportunity — converted into an active sales opportunity." },
  customer:    { label: "Customer",    action: "Won",                tip: "Customer — the lead's company is already a customer." },
};

/** Display name for a lead (name → email local-part → id). */
function leadName(l: LeadRow): string {
  return [l.first_name, l.last_name].filter(Boolean).join(" ") || (l.email ? l.email.split("@")[0] : "") || `Lead #${l.id}`;
}
/** Two-letter initials for the avatar. */
function initials(l: LeadRow): string {
  const n = [l.first_name, l.last_name].filter(Boolean).join(" ") || l.email || "?";
  const parts = n.replace(/@.*/, "").split(/[.\s_]+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || n[0]?.toUpperCase() || "?";
}

/** A funnel-stage card — count + label + action, selectable (mirrors the Companies StageCard). */
function StageCard({ stage, count, sel, onClick }: { stage: string; count: number; sel: boolean; onClick: () => void }) {
  const color = STAGE_COLOR[stage] ?? C.slate;
  const meta = STAGE_META[stage] ?? { label: stage, action: "", tip: "" };
  return (
    <Tooltip title={meta.tip} arrow placement="bottom">
      <Box onClick={onClick} sx={{
        // Same card size as the Companies pipeline (PIPELINE_CARD_H), centred in
        // the shared band so both headers are the same height.
        width: "100%", height: PIPELINE_CARD_H, minWidth: 0, cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        px: 0.85, borderRadius: "9px",
        bgcolor: sel ? `${color}0c` : `${color}03`,
        border: `1.5px solid ${sel ? color : `${color}18`}`,
        transition: "all 0.15s ease",
        "&:hover": { borderColor: `${color}60`, bgcolor: `${color}06`, transform: "translateY(-1px)", boxShadow: `0 2px 8px ${color}12` },
        textAlign: "center",
      }}>
        <Typography sx={{ fontFamily: F, fontSize: FS.title, fontWeight: FW.bold, color: sel ? color : C.text, lineHeight: 1 }}>
          {count.toLocaleString()}
        </Typography>
        <Typography noWrap sx={{ fontFamily: F, ...LABEL, color: sel ? color : C.textMd, mt: 0.4 }}>
          {meta.label}
        </Typography>
        <Typography noWrap sx={{ fontFamily: F, fontSize: FS.micro, color: sel ? color : C.sub, mt: 0.15 }}>{meta.action}</Typography>
      </Box>
    </Tooltip>
  );
}

/** Arrow connector with an optional conversion label — mirrors the Companies FlowArrow. */
function FlowArrow({ label }: { label?: string }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", px: 0.5, flexShrink: 0, minWidth: 36 }}>
      {label && <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.orange, lineHeight: 1, mb: 0.2 }}>{label}</Typography>}
      <Box sx={{ display: "flex", alignItems: "center" }}>
        <Box sx={{ width: 14, height: 1.5, bgcolor: `${C.dim}30`, borderRadius: 1 }} />
        <Box sx={{ width: 0, height: 0, borderTop: "3.5px solid transparent", borderBottom: "3.5px solid transparent", borderLeft: `6px solid ${C.dim}40` }} />
      </Box>
    </Box>
  );
}

/** Progress + tally of a running/finished bulk enrichment job. */
interface BulkRun {
  runId: string; status: string; done: number; total: number;
  counts: { applied?: number; no_data?: number; ineligible?: number; skipped_optout?: number; failed?: number };
}

/**
 * Leads — browse/search/enrich leads. Uses the same single-card shell as the
 * Companies page: a funnel hero, a search/filter bar, a scrolling row table, and
 * a footer — all inside one bordered container with internally-divided sections.
 */
export default function Leads() {
  const { get, request, download } = useApiClient();
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Every filter persists in the URL query so it survives opening a lead and
  // coming back — the back button restores /leads?… and re-inits from it.
  // What the user is typing vs. the committed term the list is filtered by —
  // committed on Search / Enter so a half-typed name never fires queries.
  const [searchInput, setSearchInput] = useState(sp.get("q") || "");
  const [search, setSearch] = useState(sp.get("q") || "");
  const [stage, setStage] = useState(sp.get("stage") || "");
  const [enriched, setEnriched] = useState(sp.get("enrichment") || "");
  const [region, setRegion] = useState(sp.get("region") || "");
  const [country, setCountry] = useState(sp.get("country") || "");
  const [state, setState] = useState(sp.get("state") || "");
  const [source, setSource] = useState(sp.get("source") || "");
  const [createdFrom, setCreatedFrom] = useState(sp.get("from") || "");
  const [createdTo, setCreatedTo] = useState(sp.get("to") || "");

  /** Write one filter's value into the URL query (removed when empty). */
  const setParam = (key: string, value: string | null) => {
    setSp((prev) => {
      const p = new URLSearchParams(prev);
      if (value) p.set(key, value); else p.delete(key);
      return p;
    }, { replace: true });
  };
  const [facets, setFacets] = useState<{ regions: string[]; sources: FacetOption[] } | null>(null);
  // Region → country drill-down. The grouped mapping is static (no facet query),
  // so the Country pill offers every canonical country until a Region is
  // picked and only that region's members afterwards.
  const { data: regionMap } = useRegionCountryMap();
  const countryOptions = useMemo(
    () => countriesForRegions(regionMap, region ? [region] : [], allCountries(regionMap)),
    [regionMap, region],
  );
  // Country → State drill-down: offered once the picked country (or region) has a
  // state list. Options are the fixed list, never raw values; the server matches
  // every stored spelling ("California" also finds "CA").
  const { data: subdivisionMap } = useSubdivisionMap();
  const stateOptions = useMemo(
    () => stateOptionsFor(subdivisionMap, regionMap, region, country),
    [subdivisionMap, regionMap, region, country],
  );
  /** Drop the picked state when the new geo no longer offers it. */
  const pruneState = (nextRegion: string, nextCountry: string) => {
    if (state && !stateOptionsFor(subdivisionMap, regionMap, nextRegion, nextCountry).includes(state)) {
      setState(""); setParam("state", null);
    }
  };
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [dialogLead, setDialogLead] = useState<LeadRow | null>(null);
  const [bulk, setBulk] = useState<BulkRun | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  /** Download the filtered leads list as CSV — ISAC columns or LinkedIn's contact match template. */
  const exportCsv = async (format: "isac" | "linkedin") => {
    setExporting(true);
    try {
      const params: Record<string, unknown> = { format };
      if (search.trim()) params.search = search.trim();
      if (stage) params.stage = stage;
      if (enriched) params.enrichment_filter = enriched;
      if (region) params.region = region;
      if (country) params.country = country;
      if (state) params.state = state;
      if (source) params.source = source;
      if (createdFrom) params.created_from = createdFrom;
      if (createdTo) params.created_to = createdTo;
      const r = await download("/lead-enrichment/export", params);
      saveBlobAsFile(r.blob, r.filename ?? "leads-export.csv");
      setExportMsg(r.truncated
        ? `Downloaded the first 50,000 of ${r.total?.toLocaleString()} leads — narrow the filters for the rest.`
        : `Downloaded ${r.total?.toLocaleString() ?? "the"} leads as CSV.`);
    } catch {
      setExportMsg("CSV export failed — try again.");
    } finally { setExporting(false); }
  };
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadFunnel = useCallback(async () => {
    try {
      // Same filters as the list, minus stage (the funnel IS the per-stage
      // breakdown) and minus search — a name/email lookup must not rescale
      // the funnel — so it recomputes with the segment filters.
      const params: Record<string, unknown> = {};
      if (enriched) params.enrichment_filter = enriched;
      if (region) params.region = region;
      if (country) params.country = country;
      if (state) params.state = state;
      if (source) params.source = source;
      if (createdFrom) params.created_from = createdFrom;
      if (createdTo) params.created_to = createdTo;
      setFunnel((await get<{ stages: FunnelStage[] }>("/lead-enrichment/funnel", params)).stages);
    } catch { /* ignore */ }
  }, [get, enriched, region, country, state, source, createdFrom, createdTo]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, page_size: PAGE_SIZE };
      if (search.trim()) params.search = search.trim();
      if (stage) params.stage = stage;
      if (enriched) params.enrichment_filter = enriched;
      if (region) params.region = region;
      if (country) params.country = country;
      if (state) params.state = state;
      if (source) params.source = source;
      if (createdFrom) params.created_from = createdFrom;
      if (createdTo) params.created_to = createdTo;
      const data = await get<{ items: LeadRow[]; total: number }>("/lead-enrichment/status", params);
      setRows(data.items); setTotal(data.total); setSel(new Set()); setLoadError(null);
    } catch {
      // Surface the failure — an empty table reads as "no leads match", which is
      // exactly how UAT testers mis-read a failed request.
      setRows([]); setTotal(0);
      setLoadError("Couldn't load leads — the server didn't respond. Try again.");
    } finally { setLoading(false); }
  }, [get, page, search, stage, enriched, region, country, state, source, createdFrom, createdTo]);

  /** Commit the typed search term (Search button / Enter). */
  const commitSearch = () => { setSearch(searchInput.trim()); setParam("q", searchInput.trim()); setPage(1); };

  useEffect(() => { loadFunnel(); }, [loadFunnel]);
  useEffect(() => {
    // A one-shot fetch left the Country/Source dropdowns permanently empty when
    // the single request failed (e.g. backend restarting) — retry with backoff.
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const fetchFacets = (attempt = 0) => {
      if (cancelled) return; // a scheduled retry may fire after unmount — skip the request too
      get<{ regions: string[]; sources: FacetOption[] }>("/lead-enrichment/facets")
        .then((f) => { if (!cancelled) setFacets(f); })
        .catch(() => { if (!cancelled && attempt < 3) timer = setTimeout(() => fetchFacets(attempt + 1), 1500 * (attempt + 1)); });
    };
    fetchFacets();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [get]);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [page, stage, enriched, search, region, country, state, source, createdFrom, createdTo]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current); }, []);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const allOnPage = rows.length > 0 && rows.every((r) => sel.has(r.id));
  const toggleAll = () => setSel(allOnPage ? new Set() : new Set(rows.slice(0, MAX_BULK).map((r) => r.id)));
  const toggle = (id: number) => setSel((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const pickStage = (s: string) => { const v = stage === s ? "" : s; setStage(v); setParam("stage", v || null); setPage(1); };

  // pollBulk's self-scheduling setTimeout chain captures the load() from the
  // render where it started; read the latest one through a ref so a bulk run
  // finishing after a filter change reloads with the CURRENT filters.
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);
  const pollBulk = useCallback(async (runId: string) => {
    try {
      const s = await get<{ status: string; done?: number; total?: number; counts?: BulkRun["counts"] }>(`/lead-enrichment/bulk/${runId}`);
      setBulk({ runId, status: s.status, done: s.done ?? 0, total: s.total ?? 0, counts: s.counts ?? {} });
      if (s.status === "running") pollRef.current = setTimeout(() => pollBulk(runId), 1500);
      else { loadRef.current(); loadFunnel(); }
    } catch { setBulk((b) => (b ? { ...b, status: "failed" } : b)); }
  }, [get, loadFunnel]);

  const startBulk = async () => {
    setConfirmBulk(false);
    const lead_ids = Array.from(sel).slice(0, MAX_BULK);
    try {
      const r = await request<{ run_id: string; total: number }>("post", "/lead-enrichment/bulk", { lead_ids });
      setBulk({ runId: r.run_id, status: "running", done: 0, total: r.total, counts: {} });
      pollBulk(r.run_id);
    } catch { /* surfaced globally */ }
  };

  const orderedFunnel = STAGE_ORDER.map((s) => funnel.find((f) => f.stage === s)).filter(Boolean) as FunnelStage[];
  const grandTotal = orderedFunnel.reduce((a, f) => a + f.count, 0);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, overflow: "hidden", bgcolor: C.bg, fontFamily: F }}>

      {/* ── HERO: Lead Funnel Pipeline — the shared PipelineHeader frame, so it is
             exactly the same height as the Companies Buying-Journey header. ── */}
      <PipelineHeader title="Lead Funnel Pipeline"
        right={<Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.dim }}>{grandTotal.toLocaleString()} leads</Typography>}>
        {orderedFunnel.map((f, i) => (
          <Fragment key={f.stage}>
            {i > 0 && <Box sx={{ alignSelf: "center" }}><FlowArrow /></Box>}
            {/* Every stage card the same size — the larger "Customer" card read as misaligned. */}
            <Box sx={{ flex: "1 1 0", minWidth: 0, display: "flex" }}>
              <StageCard stage={f.stage} count={f.count} sel={stage === f.stage}
                onClick={() => pickStage(f.stage)} />
            </Box>
          </Fragment>
        ))}
      </PipelineHeader>

      {/* ── Search + filter bar: ONE row that wraps cleanly (same layout as the
             Companies page) — search · filters · Clear · count · Export. Row
             actions live in the selection bar below. ── */}
      <Box sx={{ borderBottom: `1px solid ${C.border}`, bgcolor: C.panel }}>
      <Box sx={{ px: 2, py: 1, display: "flex", columnGap: 1, rowGap: 0.75, alignItems: "center", flexWrap: "wrap", "& .MuiButton-root": { whiteSpace: "nowrap" } }}>
        <TextField size="small" placeholder="Search name, email, job title, or company…"
          inputProps={{ name: "search-leads", id: "search-leads" }} value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            // Emptying the box clears the committed search immediately — no
            // stale filter lingering behind a blank field.
            if (e.target.value === "" && search) { setSearch(""); setParam("q", null); setPage(1); }
          }}
          onKeyDown={(e) => { if (e.key === "Enter") commitSearch(); }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 14, color: C.dim }} /></InputAdornment> }}
          sx={{ flex: "1 1 240px", maxWidth: 340, minWidth: 200, "& .MuiInputBase-root": { fontFamily: F, fontSize: FS.body, borderRadius: "7px", height: 32, bgcolor: C.cardBg, color: C.text, "& fieldset": { borderColor: C.borderSoft }, "&:hover fieldset": { borderColor: C.border }, "&.Mui-focused fieldset": { borderColor: C.orange } }, "& .MuiInputBase-input::placeholder": { color: C.dim, opacity: 1 } }} />
        <Button size="small" variant="contained" disableElevation onClick={commitSearch}
          sx={{ textTransform: "none", fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, borderRadius: "7px", height: 32, minWidth: 64, bgcolor: C.orange, "&:hover": { bgcolor: C.orangeDark } }}>
          Search
        </Button>
        {(() => {
          const itemSx = { fontFamily: F, fontSize: FS.small } as const;
          const dateInputSx = { fontFamily: F, fontSize: FS.small, color: C.text, width: 118, "& input": { p: 0, height: "auto", "&::-webkit-calendar-picker-indicator": { opacity: 0.45 } } } as const;
          return (<>
        <FilterPill icon={TroubleshootOutlinedIcon} active={!!enriched}>
          <PillSelect value={enriched} onChange={(v) => { setEnriched(v); setParam("enrichment", v || null); setPage(1); }} placeholder="Status">
            <MenuItem value="" sx={itemSx}>Any status</MenuItem>
            <MenuItem value="none" sx={itemSx}>Not enriched</MenuItem>
            <MenuItem value="enriched" sx={itemSx}>Enriched</MenuItem>
          </PillSelect>
        </FilterPill>
        <RegionFilter value={region} onChange={(r) => {
          setRegion(r); setParam("region", r || null); setPage(1);
          // A country outside the new region matches nothing — drop it with the region.
          const keepCountry = country && r && !countryInRegions(regionMap, [r], country) ? "" : country;
          if (keepCountry !== country) { setCountry(""); setParam("country", null); }
          pruneState(r, keepCountry);
        }} options={facets?.regions} />
        <FilterPill icon={FlagOutlinedIcon} active={!!country}>
          <PillSelect value={country} onChange={(v) => {
            setCountry(v); setParam("country", v || null); setPage(1); pruneState(region, v);
          }} placeholder="Country">
            <MenuItem value="" sx={itemSx}>Any country</MenuItem>
            {countryOptions.map((c) => <MenuItem key={c} value={c} sx={itemSx}>{c}</MenuItem>)}
          </PillSelect>
        </FilterPill>
        {(stateOptions.length > 0 || state) && (
          <FilterPill icon={PlaceOutlinedIcon} active={!!state}>
            <PillSelect value={state} onChange={(v) => { setState(v); setParam("state", v || null); setPage(1); }} placeholder="State">
              <MenuItem value="" sx={itemSx}>Any state</MenuItem>
              {stateOptions.map((s) => <MenuItem key={s} value={s} sx={itemSx}>{s}</MenuItem>)}
            </PillSelect>
          </FilterPill>
        )}
        <FilterPill icon={HubOutlinedIcon} active={!!source}>
          <PillSelect value={source} onChange={(v) => { setSource(v); setParam("source", v || null); setPage(1); }} placeholder="Source">
            <MenuItem value="" sx={itemSx}>Any source</MenuItem>
            {(facets?.sources ?? []).map((c) => <MenuItem key={c.value} value={c.value} sx={itemSx}>{c.value} ({c.count})</MenuItem>)}
          </PillSelect>
        </FilterPill>
        <FilterPill icon={CalendarMonthOutlinedIcon} active={!!(createdFrom || createdTo)}>
          {/* Labelled — two bare "dd/mm/yyyy" boxes didn't say which date they filter. */}
          <Typography sx={{ fontFamily: F, fontSize: FS.small, color: createdFrom || createdTo ? C.text : C.sub, fontWeight: createdFrom || createdTo ? FW.semibold : FW.regular, pr: 0.25 }}>Created</Typography>
          <InputBase type="date" value={createdFrom} inputProps={{ max: createdTo || undefined, "aria-label": "Created from date" }}
            onChange={(e) => { setCreatedFrom(e.target.value); setParam("from", e.target.value || null); setPage(1); }} sx={dateInputSx} />
          <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.dim, px: 0.25 }}>–</Typography>
          <InputBase type="date" value={createdTo} inputProps={{ min: createdFrom || undefined, "aria-label": "Created to date" }}
            onChange={(e) => { setCreatedTo(e.target.value); setParam("to", e.target.value || null); setPage(1); }} sx={dateInputSx} />
        </FilterPill>
        {(region || country || state || source || createdFrom || createdTo || enriched || stage || search) && (
          <Chip label="Clear filters" size="small" clickable
            onClick={() => {
              setSearchInput(""); setSearch(""); setStage(""); setEnriched(""); setRegion(""); setCountry(""); setState("");
              setSource(""); setCreatedFrom(""); setCreatedTo(""); setPage(1);
              setSp(new URLSearchParams(), { replace: true });
            }}
            sx={{ fontFamily: F, height: 24, fontSize: FS.caption, fontWeight: FW.semibold, bgcolor: C.cardBg, color: C.sub, border: `1px solid ${C.border}`, "&:hover": { borderColor: C.orange, color: C.orange } }} />
        )}
          </>);
        })()}
        {stage && <Chip label={stage} size="small" onDelete={() => { setStage(""); setParam("stage", null); setPage(1); }} sx={{ fontFamily: F, height: 22, fontSize: FS.caption, bgcolor: `${STAGE_COLOR[stage]}12`, color: STAGE_COLOR[stage], fontWeight: FW.semibold, textTransform: "capitalize" }} />}
        <Box sx={{ flex: 1 }} />
        <Typography noWrap sx={{ fontFamily: F, fontSize: FS.small, color: C.sub }}>
          <Box component="span" sx={{ color: C.text, fontWeight: FW.semibold }}>{total.toLocaleString()}</Box> leads
        </Typography>
        <ExportMenu disabled={total === 0} busy={exporting} options={[
          { label: "CSV", hint: "All matching rows, not just this page", onClick: () => exportCsv("isac") },
          { label: "LinkedIn CSV", hint: "Campaign Manager contact match template", color: "#0A66C2", onClick: () => exportCsv("linkedin") },
        ]} />
      </Box>
      </Box>

      <SelectionBar count={sel.size} onClear={() => setSel(new Set())}
        note={sel.size > MAX_BULK ? <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.amber }}>· only the first {MAX_BULK} will run</Typography> : undefined}>
        <Button size="small" variant="contained" disableElevation disabled={!!bulk && bulk.status === "running"}
          startIcon={<AutoFixHighIcon sx={{ fontSize: 14 }} />} onClick={() => setConfirmBulk(true)}
          sx={{ textTransform: "none", whiteSpace: "nowrap", fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, borderRadius: "7px", height: 28, bgcolor: C.orange, "&:hover": { bgcolor: C.orangeDark } }}>
          Enrich selected
        </Button>
      </SelectionBar>

      {/* ── Bulk progress / summary ── */}
      {bulk && (
        <Box sx={{ px: 2, py: 1, borderBottom: `1px solid ${C.border}`, bgcolor: C.panel }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
            <Typography sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: C.text }}>
              {bulk.status === "running"
                ? "Enriching…"
                : bulk.status === "done"
                ? `Bulk run complete — ${bulk.counts.applied ?? 0} of ${bulk.total} enriched`
                : bulk.status === "failed"
                ? "Bulk run failed"
                : bulk.status === "interrupted"
                ? "Bulk run interrupted"
                : "Bulk run ended"}
            </Typography>
            <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.sub }}>{bulk.done}/{bulk.total}</Typography>
            <Box sx={{ flex: 1 }} />
            {bulk.status !== "running" && <Button size="small" onClick={() => setBulk(null)} sx={{ textTransform: "none", fontFamily: F, minWidth: 0 }}>Dismiss</Button>}
          </Box>
          <LinearProgress variant="determinate" value={bulk.total ? Math.round((bulk.done / bulk.total) * 100) : 0} sx={{ borderRadius: 3, height: 5, bgcolor: C.cardBg, "& .MuiLinearProgress-bar": { bgcolor: C.orange } }} />
          {bulk.counts.applied != null && (
            <Box sx={{ display: "flex", gap: 0.75, mt: 0.6, flexWrap: "wrap" }}>
              <Chip size="small" label={`${bulk.counts.applied ?? 0} enriched`} sx={{ height: 18, fontSize: FS.caption, bgcolor: `${C.green}12`, color: C.green, fontWeight: FW.semibold }} />
              <Chip size="small" label={`${bulk.counts.no_data ?? 0} no data`} sx={{ height: 18, fontSize: FS.caption, bgcolor: C.cardBg, color: C.sub }} />
              {!!bulk.counts.ineligible && <Chip size="small" label={`${bulk.counts.ineligible} ineligible`} sx={{ height: 18, fontSize: FS.caption, bgcolor: C.cardBg, color: C.sub }} />}
              {!!bulk.counts.skipped_optout && <Chip size="small" label={`${bulk.counts.skipped_optout} skipped`} sx={{ height: 18, fontSize: FS.caption, bgcolor: `${C.amber}12`, color: C.amber, fontWeight: FW.semibold }} />}
              {!!bulk.counts.failed && <Chip size="small" label={`${bulk.counts.failed} failed`} sx={{ height: 18, fontSize: FS.caption, bgcolor: `${C.red}12`, color: C.red, fontWeight: FW.semibold }} />}
            </Box>
          )}
        </Box>
      )}

      {/* ── Table header ── */}
      <Box sx={{ px: LEAD_ROW_PX, py: 0.75, display: "flex", alignItems: "center", gap: LEAD_ROW_GAP, bgcolor: C.cardBg, borderBottom: `1px solid ${C.border}` }}>
        <Checkbox size="small" checked={allOnPage} indeterminate={sel.size > 0 && !allOnPage} onChange={toggleAll} sx={{ p: 0.5, color: C.dim, "&.Mui-checked,&.MuiCheckbox-indeterminate": { color: C.orange } }} />
        {/* Spacer for the row avatar, so "Lead" sits over the name, not the avatar. */}
        <Box sx={LEAD_COL.avatar} />
        <Typography sx={{ fontFamily: F, ...LABEL, color: C.dim, ...LEAD_COL.lead }}>Lead</Typography>
        <Typography sx={{ fontFamily: F, ...LABEL, color: C.dim, ...LEAD_COL.company }}>Company</Typography>
        <Typography sx={{ fontFamily: F, ...LABEL, color: C.dim, ...LEAD_COL.location }}>Region / Location</Typography>
        <Typography sx={{ fontFamily: F, ...LABEL, color: C.dim, ...LEAD_COL.stage }}>Stage</Typography>
        <Typography sx={{ fontFamily: F, ...LABEL, color: C.dim, ...LEAD_COL.type }}>Type</Typography>
        <Box sx={LEAD_COL.dot} />
        <Box sx={LEAD_COL.action} />
      </Box>

      {/* ── Rows (scroll area) ── */}
      <Box sx={{ flex: 1, overflow: "auto", minHeight: 0, bgcolor: C.panel }}>
        {loading && rows.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 5 }}><CircularProgress size={22} sx={{ color: C.orange }} /></Box>
        ) : loadError ? (
          <Box sx={{ py: 5, textAlign: "center" }}>
            <Typography sx={{ fontFamily: F, fontSize: FS.body, color: C.red, fontWeight: FW.semibold }}>{loadError}</Typography>
            <Button size="small" variant="outlined" onClick={load}
              sx={{ mt: 1.25, textTransform: "none", fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, borderRadius: "7px", borderColor: C.border, color: C.textMd, "&:hover": { borderColor: C.orange, color: C.orange } }}>
              Try again
            </Button>
          </Box>
        ) : rows.length === 0 ? (
          <Box sx={{ py: 5, textAlign: "center" }}>
            <Typography sx={{ fontFamily: F, fontSize: FS.body, color: C.sub }}>No leads match</Typography>
            <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.dim, mt: 0.5 }}>Adjust the search, filters, or date range.</Typography>
          </Box>
        ) : rows.map((r) => {
          const sc = (r.lead_stage && STAGE_COLOR[r.lead_stage]) || C.slate; const selected = sel.has(r.id);
          return (
            <Box key={r.id} sx={{ display: "flex", alignItems: "center", gap: LEAD_ROW_GAP, px: LEAD_ROW_PX, py: 0.85, borderBottom: `1px solid ${C.borderSoft}`, bgcolor: selected ? `${C.orange}06` : "transparent", transition: "background .12s", "&:hover": { bgcolor: selected ? `${C.orange}0a` : `${C.orange}03` }, "&:hover .row-enrich, & .row-enrich:focus-visible": { opacity: 1 } }}>
              <Checkbox size="small" checked={selected} onChange={() => toggle(r.id)} onClick={(e) => e.stopPropagation()} sx={{ p: 0.5, color: C.dim, "&.Mui-checked": { color: C.orange } }} />
              <Box sx={{ ...LEAD_COL.avatar, height: 30, borderRadius: "8px", bgcolor: `${sc}14`, color: sc, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold }}>{initials(r)}</Box>
              <Box sx={{ ...LEAD_COL.lead, cursor: "pointer" }} onClick={() => navigate(isacPath(`/leads/${r.id}`))}>
                <Typography noWrap sx={{ fontFamily: F, ...ROW.primary, color: C.text }}>{leadName(r)}</Typography>
                <Typography noWrap sx={{ fontFamily: F, ...ROW.secondary, color: C.sub }}>{r.job_title || r.email || "—"}</Typography>
              </Box>
              <Box sx={LEAD_COL.company}>
                {r.company_id ? (
                  <Typography component="span" onClick={(e) => { e.stopPropagation(); navigate(isacPath(`/companies/${r.company_id}`)); }} sx={{ fontFamily: F, ...ROW.primary, color: C.orange, cursor: "pointer", "&:hover": { textDecoration: "underline" } }} noWrap>{r.raw_company_name || `Company #${r.company_id}`}</Typography>
                ) : <Typography noWrap sx={{ fontFamily: F, ...ROW.cell, color: C.dim }}>{r.raw_company_name || "—"}</Typography>}
              </Box>
              <Box sx={LEAD_COL.location}>
                {r.region && <Typography noWrap sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: C.text }}>{r.region}</Typography>}
                {(r.city || r.state || r.country) && (
                  <Box sx={{ fontSize: FS.caption, color: C.sub }}><ClampText text={formatLocation(r.city, r.state, r.country)} /></Box>
                )}
                {!r.region && !r.city && !r.state && !r.country && <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.dim }}>—</Typography>}
              </Box>
              <Box sx={LEAD_COL.stage}>
                {r.lead_stage && (
                  <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 0.9, py: 0.3, borderRadius: "6px", bgcolor: `${sc}12` }}>
                    <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: sc }} />
                    <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: sc, textTransform: "capitalize" }}>{r.lead_stage}</Typography>
                  </Box>
                )}
              </Box>
              <Box sx={{ ...LEAD_COL.type, fontSize: FS.caption, color: C.textMd }}>
                {/* Was cut to "Raw/ Unqu…" with no way to read it — clamp + full text on hover. */}
                {r.lead_type && <ClampText text={r.lead_type} />}
              </Box>
              <Tooltip title={r.enrichment_status === "enriched" ? "Enriched" : "Not enriched"} arrow>
                <Box sx={{ ...LEAD_COL.dot, height: 8, borderRadius: "50%", bgcolor: r.enrichment_status === "enriched" ? C.green : C.border }} />
              </Tooltip>
              {/* One enrich control per row, revealed on hover/focus — ten identical
                  "Enrich" buttons down the page drowned out the data. */}
              <Tooltip title="Enrich this lead" arrow>
                <IconButton className="row-enrich" size="small" aria-label={`Enrich ${leadName(r)}`}
                  onClick={(e) => { e.stopPropagation(); setDialogLead(r); }}
                  sx={{ ...LEAD_COL.action, height: 32, opacity: 0, transition: "opacity .12s", color: C.orange, "&:hover": { bgcolor: `${C.orange}12` } }}>
                  <AutoFixHighIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>
          );
        })}
      </Box>

      {/* ── Footer / pagination ── */}
      {total > 0 && (
        <ListFooter page={page} totalPages={pages} total={total} noun="leads" onPage={setPage} disabled={loading} />
      )}

      <EnrichLeadDialog open={dialogLead != null} leadId={dialogLead?.id ?? null} leadName={dialogLead ? leadName(dialogLead) : ""} onClose={() => setDialogLead(null)} onApplied={() => { load(); loadFunnel(); }} />

      <Dialog open={confirmBulk} onClose={() => setConfirmBulk(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontFamily: F, fontSize: FS.reading, fontWeight: FW.semibold }}>Enrich {sel.size} leads?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontFamily: F, fontSize: FS.body, color: C.sub }}>
            Found values are applied to <b>empty fields only</b> — existing values are never overwritten.
            Opted-out leads are skipped. This calls Apollo/ZoomInfo and may consume provider credits.
            {sel.size > MAX_BULK ? ` Only the first ${MAX_BULK} will run.` : ""}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmBulk(false)} sx={{ textTransform: "none", fontFamily: F }}>Cancel</Button>
          <Button onClick={startBulk} variant="contained" disableElevation sx={{ textTransform: "none", fontFamily: F, bgcolor: C.orange, "&:hover": { bgcolor: C.orangeDark } }}>Run enrichment</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!exportMsg} autoHideDuration={6000} onClose={() => setExportMsg(null)} message={exportMsg}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }} />
    </Box>
  );
}
