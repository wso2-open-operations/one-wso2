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

import { FlagOutlined as FlagOutlinedIcon } from "../icons";
import { PlaceOutlined as PlaceOutlinedIcon } from "../icons";
import { Sort as SortIcon } from "../icons";
import { Search as SearchIcon } from "../icons";
import { NotificationsActive as NotificationsActiveIcon } from "../icons";
import { NotificationsNone as NotificationsNoneIcon } from "../icons";
import { Verified as VerifiedIcon } from "../icons";
import { AutoFixHigh as AutoFixHighIcon } from "../icons";
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  InputAdornment,
  MenuItem,
  Snackbar,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Company, PaginatedResponse, saveBlobAsFile, useApiClient } from "../api/client";
import { useCompanyCounts, useCompanyList, useRegionCountryMap, useSubdivisionMap } from "../api/queries";
import { FilterPill, PillSelect, pillItemSx } from "../components/FilterPills";
import { ExportMenu, ListFooter, PIPELINE_CARD_H, PIPELINE_STACK_GAP_PX, PipelineHeader, SelectionBar } from "../components/ListKit";
import RegionFilter from "../components/RegionFilter";
import { C, F } from "../theme/pageTokens";
import { allCountries, countriesForRegions, countryInRegions, stateOptionsFor } from "../utils/geo";
import { FS, FW, LABEL, ROW } from "../theme/typeScale";
import { isacPath } from "../paths";

// ── Font ─────────────────────────────────────────────────────────────────────
// ── Palette ──────────────────────────────────────────────────────────────────

// ── Company table columns ───────────────────────────────────────────────────
// Select · Company · Stage · Intent · Awareness · Sources. The header row and
// every data row share this template (and the same gap / px) so the uppercase
// labels can't drift away from the cells beneath them.
const COMPANY_COLS = "32px 1fr 92px 130px 120px 84px";
const COMPANY_GAP = 0.5;
const COMPANY_PX = 2;


// ── Priority pipeline stages ────────────────────────────────────────────────
type PriorityStage = "activate" | "pursue" | "research" | "engage" | "known" | "unqualified" | "restricted";
const PIPELINE: Record<PriorityStage, { label: string; color: string; action: string; tip: string }> = {
  activate:    { label: "Activate",    color: C.red,    action: "Assign to SDR",          tip: "Sales-ready. Requires ALL of: recent G2 intent (decision/consideration within 90 days) + 1st-party engagement (ad clicks, leads, or certs) + Salesforce account + 3+ signal sources." },
  pursue:      { label: "Pursue",      get color() { return C.orange; }, action: "Personalized outreach",  tip: "Multi-source qualified. Has G2 intent OR 1st-party signals, from 2+ sources, with CRM or direct engagement. Missing one condition to reach Activate." },
  research:    { label: "Research",    color: C.amber,  action: "Targeted ads",           tip: "3rd-party intent only. G2 buying stage is decision or consideration (last 90 days), but no 1st-party engagement yet. Run targeted LinkedIn ads to convert." },
  engage:      { label: "Engage",      color: C.blue,   action: "Nurture content",        tip: "1st-party signals only. Clicking LinkedIn ads, has Pardot leads, or earning certifications — but no recent G2 buying intent. Nurture with content." },
  known:       { label: "Known",       color: C.slate,  action: "Brand presence",         tip: "In our ecosystem but not actively buying. Has a Salesforce account, LinkedIn impressions, or firmographic data, but no buying signals." },
  unqualified: { label: "Unqualified", get color() { return C.dim; },    action: "Exclude",                tip: "No signals and no firmographic data. Not enough information to act on." },
  restricted:  { label: "Restricted",  get color() { return C.sub; }, action: "Lost / churned",        tip: "Previously lost or churned account. Excluded from all pipeline activity." },
};
// Backward compat alias
type FunnelStage = PriorityStage;
const FUNNEL = PIPELINE;

// ── Qualified ────────────────────────────────────────────────────────────────

// ── Helpers ──────────────────────────────────────────────────────────────────



// ═══════════════════════════════════════════════════════════════════════════════
// ── COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Signal dots (shows which sources have data) ─────────────────────────────

// ── List item ────────────────────────────────────────────────────────────────

/** Sort keys → [pill label, menu label]. The pill reads "Sort: Intent" so it is
 * clearly a sort, not another filter. */
const SORT_OPTIONS: Record<string, [string, string]> = {
  intent_score: ["Intent", "Intent score (high → low)"],
  awareness_score: ["Awareness", "Awareness score (high → low)"],
  canonical_name: ["Name", "Company name (A → Z)"],
};

// ── Stage card (reusable) ────────────────────────────────────────────────────
function StageCard({ stage, count, label, sel, onClick }: {
  stage: PriorityStage; count: number; label?: string; sel: boolean; onClick: () => void;
}) {
  const p = PIPELINE[stage];
  return (
    <Tooltip title={p.tip} arrow placement="bottom">
      {/* Every card the same size (PIPELINE_CARD_H, equal column widths) —
          Research and Engage are full cards too, stacked. */}
      <Box onClick={onClick} sx={{
        width: "100%", height: PIPELINE_CARD_H, flexShrink: 0, minWidth: 0, cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        px: 1, borderRadius: "9px",
        bgcolor: sel ? `${p.color}0c` : `${p.color}03`,
        border: `1.5px solid ${sel ? p.color : `${p.color}18`}`,
        transition: "all 0.15s ease",
        "&:hover": { borderColor: `${p.color}60`, bgcolor: `${p.color}06`, transform: "translateY(-1px)", boxShadow: `0 3px 12px ${p.color}12` },
        textAlign: "center",
      }}>
        {label && (
          <Typography noWrap sx={{ fontFamily: F, fontSize: FS.micro, fontWeight: FW.semibold, color: p.color, textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.3 }}>
            {label}
          </Typography>
        )}
        <Typography sx={{ fontFamily: F, fontSize: FS.title, fontWeight: FW.bold, color: sel ? p.color : C.text, lineHeight: 1 }}>
          {count.toLocaleString()}
        </Typography>
        <Typography noWrap sx={{ fontFamily: F, ...LABEL, color: sel ? p.color : C.textMd, mt: 0.35 }}>
          {p.label}
        </Typography>
        {!label && (
          <Typography noWrap sx={{ fontFamily: F, fontSize: FS.micro, color: sel ? p.color : C.sub, mt: 0.15 }}>
            {p.action}
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
}

// ── Arrow connector ─────────────────────────────────────────────────────────
function FlowArrow({ label, vertical }: { label?: string; vertical?: boolean }) {
  if (vertical) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 0.15, flexShrink: 0 }}>
        <Box sx={{ width: 1.5, height: 6, bgcolor: `${C.dim}30` }} />
      </Box>
    );
  }
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

// ── Header: Buying Journey — Convergence Diagram ────────────────────────────
function HeaderPanel({ activeFunnel, funnelCounts, onFunnelSelect }: {
  activeFunnel: string | null;
  funnelCounts: Record<string, number>;
  onFunnelSelect: (k: string) => void;
}) {
  const known = funnelCounts.known ?? 0;
  const research = funnelCounts.research ?? 0;
  const engage = funnelCounts.engage ?? 0;
  const pursue = funnelCounts.pursue ?? 0;
  const activate = funnelCounts.activate ?? 0;
  const unqualified = funnelCounts.unqualified ?? 0;
  const restricted = funnelCounts.restricted ?? 0;

  const convToSignals = known > 0 ? `${(((research + engage) / known) * 100).toFixed(0)}%` : "—";
  const convToPursue = (research + engage) > 0 ? `${((pursue / (research + engage)) * 100).toFixed(0)}%` : "—";
  const convToActivate = pursue > 0 ? `${((activate / pursue) * 100).toFixed(0)}%` : "—";

  // Legend: its own column on the right, one item per line.
  const legend = [
    { color: C.amber, text: "3rd party intent — G2 buyer signals" },
    { color: C.blue,  text: "1st party — LinkedIn ads, Pardot leads, Certs" },
    { color: C.red,   text: "Sales ready — CRM presence + multi-signal" },
  ];

  return (
    <PipelineHeader title="Buying Journey Pipeline" right={<>
          {unqualified > 0 && (
            <Typography onClick={() => onFunnelSelect("unqualified")} sx={{
              fontFamily: F, fontSize: FS.caption, color: activeFunnel === "unqualified" ? C.sub : C.dim,
              cursor: "pointer", "&:hover": { color: C.dim, textDecoration: "underline" },
            }}>
              + {unqualified.toLocaleString()} unqualified
            </Typography>
          )}
          {restricted > 0 && (
            <Typography onClick={() => onFunnelSelect("restricted")} sx={{
              fontFamily: F, fontSize: FS.caption, color: activeFunnel === "restricted" ? C.sub : C.dim,
              cursor: "pointer", "&:hover": { color: C.sub, textDecoration: "underline" },
            }}>
              + {restricted.toLocaleString()} restricted
            </Typography>
          )}
    </>}>
      {/* ── Convergence diagram ──────────────────────────────────────── */}
      <Box sx={{ flex: 1, minWidth: 0, height: "100%", display: "flex", alignItems: "center", gap: 0 }}>

        {/* Col 1: Known */}
        <Box sx={{ flex: "1 1 0", minWidth: 0, display: "flex" }}>
          <StageCard stage="known" count={known} sel={activeFunnel === "known"} onClick={() => onFunnelSelect("known")} />
        </Box>

        <Tooltip title="Conversion to signals — % of Known companies that show active buying behavior (G2 intent or 1st-party engagement)" arrow placement="top">
          <Box sx={{ alignSelf: "center" }}><FlowArrow label={convToSignals} /></Box>
        </Tooltip>

        {/* Col 2: Signal streams (stacked) */}
        <Box sx={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", gap: `${PIPELINE_STACK_GAP_PX}px` }}>
          <StageCard stage="research" count={research} label="3rd Party · G2 Intent" sel={activeFunnel === "research"} onClick={() => onFunnelSelect("research")} />
          <StageCard stage="engage" count={engage} label="1st Party · Ads & Leads" sel={activeFunnel === "engage"} onClick={() => onFunnelSelect("engage")} />
        </Box>

        {/* Merge arrow (SVG) */}
        <Tooltip title="Conversion to Pursue — % of Research + Engage companies that qualify with multi-source signals" arrow placement="top">
          <Box sx={{ alignSelf: "center", position: "relative", px: 0.4, flexShrink: 0 }}>
            {/* Overlaid just above the merge point, so the column stays exactly
                band-height and the arrow tip lines up with Pursue's centre. */}
            <Typography sx={{
              fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.orange,
              position: "absolute", left: 0, right: 0, textAlign: "center",
              top: (PIPELINE_CARD_H * 2 + PIPELINE_STACK_GAP_PX) / 2 - 18,
            }}>{convToPursue}</Typography>
            {/* Branches start at the centres of the stacked Research / Engage cards
                (each PIPELINE_CARD_H tall, PIPELINE_STACK_GAP_PX apart) and meet
                at the band's middle, where the Pursue card sits. */}
            {(() => {
              const h = PIPELINE_CARD_H * 2 + PIPELINE_STACK_GAP_PX;
              const top = PIPELINE_CARD_H / 2, bottom = h - PIPELINE_CARD_H / 2, mid = h / 2;
              return (
                <svg width="28" height={h} viewBox={`0 0 28 ${h}`} style={{ display: "block" }}>
                  <path d={`M 2 ${top} Q 14 ${top} 16 ${mid}`} stroke={`${C.amber}60`} strokeWidth="1.5" fill="none" />
                  <path d={`M 2 ${bottom} Q 14 ${bottom} 16 ${mid}`} stroke={`${C.blue}60`} strokeWidth="1.5" fill="none" />
                  <path d={`M 16 ${mid} L 23 ${mid}`} stroke={`${C.dim}40`} strokeWidth="1.5" fill="none" />
                  <polygon points={`23,${mid - 3} 28,${mid} 23,${mid + 3}`} fill={`${C.dim}45`} />
                </svg>
              );
            })()}
          </Box>
        </Tooltip>

        {/* Col 3: Pursue */}
        <Box sx={{ flex: "1 1 0", minWidth: 0, display: "flex" }}>
          <StageCard stage="pursue" count={pursue} sel={activeFunnel === "pursue"} onClick={() => onFunnelSelect("pursue")} />
        </Box>

        <Tooltip title="Conversion to Activate — % of Pursue companies that also have G2 intent + 1st-party signals + Salesforce account + 3+ sources" arrow placement="top">
          <Box sx={{ alignSelf: "center" }}><FlowArrow label={convToActivate} /></Box>
        </Tooltip>

        {/* Col 4: Activate */}
        <Box sx={{ flex: "1 1 0", minWidth: 0, display: "flex" }}>
          <StageCard stage="activate" count={activate} sel={activeFunnel === "activate"} onClick={() => onFunnelSelect("activate")} />
        </Box>
      </Box>

      <Box sx={{
        flexShrink: 0, width: 230, ml: 2, pl: 2, borderLeft: `1px solid ${C.borderSoft}`,
        display: "flex", flexDirection: "column", justifyContent: "center", gap: 0.75,
      }}>
        {legend.map((l) => (
          <Box key={l.text} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: "2px", bgcolor: l.color, flexShrink: 0 }} />
            <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.textMd, lineHeight: 1.3 }}>{l.text}</Typography>
          </Box>
        ))}
      </Box>
    </PipelineHeader>
  );
}

// ── Key-value row ────────────────────────────────────────────────────────────

// ── Section card ─────────────────────────────────────────────────────────────

// ── Detail panel ─────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════════
// ── MAIN
// ═══════════════════════════════════════════════════════════════════════════════

/** Filterable, sortable company list with heat tier and funnel stage scoring. */
export default function Companies() {
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  // Every filter persists in the URL query so it survives navigating into a
  // company and back — the back button restores /companies?… and re-inits
  // from it (people were re-selecting everything on every return).
  const [q, setQ] = useState(sp.get("q") || "");
  const [debouncedQ, setDebouncedQ] = useState(sp.get("q") || "");
  const [country, setCountry] = useState(sp.get("country") || "");
  const [state, setState] = useState(sp.get("state") || "");
  const [dimension] = useState(sp.get("filter") || "all");
  const [heatFilter] = useState<string | null>(sp.get("heat") || null);
  const [funnelFilter, setFunnelFilter] = useState<string | null>(sp.get("funnel") || null);
  // "Following" narrows the list to accounts the user subscribed to (emailed on stage-up).
  const [following, setFollowing] = useState<boolean>(sp.get("following") === "1");
  const [region, setRegion] = useState(sp.get("region") || "");

  /** Write one filter's value into the URL query (removed when empty). */
  const setParam = (key: string, value: string | null) => {
    setSp((prev) => {
      const p = new URLSearchParams(prev);
      if (value) p.set(key, value); else p.delete(key);
      return p;
    }, { replace: true });
  };
  const [sort, setSort] = useState("intent_score");
  const [pg, setPg] = useState(1);

  // Bulk enrichment selection + job
  const { get, request, download } = useApiClient();
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [enriching, setEnriching] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);
  const toggleSel = (id: number) => setSel((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  /** Download the filtered companies list as CSV — ISAC columns or LinkedIn's company match template. */
  const exportCsv = async (format: "isac" | "linkedin") => {
    setExporting(true);
    try {
      const r = await download("/companies/export", {
        search: debouncedQ || undefined,
        heat_filter: effectiveFilter,
        funnel_filter: funnelFilter || undefined,
        following: following || undefined,
        region: region || undefined,
        country: country || undefined,
        state: state || undefined,
        format,
      });
      saveBlobAsFile(r.blob, r.filename ?? "companies-export.csv");
      setBulkMsg(r.truncated
        ? `Downloaded the first 50,000 of ${r.total} companies — narrow the filters for the rest.`
        : `Downloaded ${r.total ?? "the"} companies as CSV.`);
    } catch {
      setBulkMsg("CSV export failed — try again.");
    } finally { setExporting(false); }
  };

  /** Bulk-enrich the selected companies (company-enrichment progressive job), then poll to completion. */
  const handleBulkEnrich = async () => {
    if (enriching || sel.size === 0) return;
    setEnriching(true);
    const company_ids = Array.from(sel);
    try {
      const start = await request<{ run_id: string }>("post", "/company-enrichment/progressive", { company_ids });
      const poll = async (): Promise<void> => {
        const s = await get<{ status: string; done?: number; total?: number }>(`/company-enrichment/progressive/${start.run_id}`);
        if (s.status === "running") { setTimeout(poll, 1500); return; }
        setBulkMsg(s.status === "failed"
          ? "Bulk enrichment failed."
          : `Enrichment complete — ${s.done ?? company_ids.length}/${s.total ?? company_ids.length} companies processed.`);
        setEnriching(false);
        setSel(new Set());
      };
      poll();
    } catch {
      setBulkMsg("Could not start enrichment.");
      setEnriching(false);
    }
  };

  /** Commit the typed search term (Search button / Enter). */
  const commitSearch = () => { setDebouncedQ(q.trim()); setParam("q", q.trim()); setPg(1); };
  useEffect(() => { setPg(1); }, [dimension, heatFilter, funnelFilter, following, region, country, state]);

  // Region → country drill-down. The grouped mapping is static (no facet query),
  // so the Country pill offers every canonical country until a Region is
  // picked and only that region's members afterwards.
  const { data: regionMap } = useRegionCountryMap();
  const countryOptions = useMemo(
    () => countriesForRegions(regionMap, region ? [region] : [], allCountries(regionMap)),
    [regionMap, region],
  );
  // Country → State drill-down: offered once the picked country (or region) has a
  // state list. Fixed options; the server matches every stored spelling ("CA").
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

  // Combine dimension + heat into the backend filter param
  const effectiveFilter = (() => {
    const parts: string[] = [];
    if (dimension && dimension !== "all") parts.push(dimension);
    if (heatFilter) parts.push(heatFilter);
    return parts.length > 0 ? parts.join("+") : undefined;
  })();

  // ── Queries ─────────────────────────────────────────────────────────────
  const { data: scopedCounts = { all: 0, qualified: 0, intent: 0, awareness: 0, hot: 0, warm: 0, cold: 0, heat_by_dimension: {} } as Record<string, unknown> } = useCompanyCounts({
    // Deliberately NOT scoped by the text search: typing a name is a record
    // lookup, and rescaling the funnel to the matching handful is noise.
    region: region || undefined,
    country: country || undefined,
    state: state || undefined,
  });

  const { data: cos = { items: [], total: 0, page: 1, page_size: 60, pages: 1 } as PaginatedResponse<Company>, isLoading: loading } = useCompanyList({
    page: pg,
    sort_by: sort,
    sort_dir: sort === "canonical_name" ? "asc" : "desc",
    search: debouncedQ || undefined,
    heat_filter: effectiveFilter,
    funnel_filter: funnelFilter || undefined,
    following: following || undefined,
    region: region || undefined,
    country: country || undefined,
    state: state || undefined,
  });


  const items = cos.items;
  // Derive heat counts from the active dimension

  const funnelCounts = (scopedCounts.funnel || { hot: 0, engaged: 0, in_market: 0, universe: 0 }) as Record<string, number>;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, overflow: "hidden", bgcolor: C.bg }}>

      {/* ── HERO: Funnel visualization (full width) ──────────────────── */}
      <HeaderPanel activeFunnel={funnelFilter}
        funnelCounts={funnelCounts}
        onFunnelSelect={(k: string) => { const v = funnelFilter === k ? null : k; setFunnelFilter(v); setParam("funnel", v); }} />

      {/* ── Search + Sort bar ────────────────────────────────────────── */}
      {/* ── Toolbar: find (search + geo + sort) · count · export ─────────
           One row that wraps cleanly on narrow screens; every label is
           nowrap so nothing breaks onto two lines. Row actions live in the
           selection bar below, shown only while rows are selected. */}
      <Box sx={{
        px: 2, py: 1, display: "flex", flexWrap: "wrap", columnGap: 1, rowGap: 0.75,
        alignItems: "center", borderBottom: `1px solid ${C.border}`, bgcolor: C.panel,
        "& .MuiButton-root": { whiteSpace: "nowrap" },
      }}>
        <Box sx={{ display: "flex", gap: 0.75, flex: "1 1 260px", maxWidth: 380, minWidth: 220 }}>
          <TextField size="small" placeholder="Search company name or domain…" fullWidth
            inputProps={{ name: "search-companies", id: "search-companies" }} value={q}
            onChange={(e) => {
              setQ(e.target.value);
              // Emptying the box clears the committed search immediately.
              if (e.target.value === "" && debouncedQ) { setDebouncedQ(""); setParam("q", null); setPg(1); }
            }}
            onKeyDown={(e) => { if (e.key === "Enter") commitSearch(); }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 14, color: C.dim }} /></InputAdornment> }}
            sx={{
              "& .MuiInputBase-root": { fontFamily: F, fontSize: FS.body, borderRadius: "7px", height: 32, bgcolor: C.cardBg, color: C.text, "& fieldset": { borderColor: C.borderSoft }, "&:hover fieldset": { borderColor: C.border }, "&.Mui-focused fieldset": { borderColor: C.orange } },
              "& .MuiInputBase-input::placeholder": { color: C.dim, opacity: 1 },
            }} />
          <Button size="small" variant="contained" disableElevation onClick={commitSearch}
            sx={{ textTransform: "none", fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, borderRadius: "7px", height: 32, minWidth: 64, flexShrink: 0, bgcolor: C.orange, "&:hover": { bgcolor: C.orangeDark } }}>
            Search
          </Button>
        </Box>
        <RegionFilter value={region} onChange={(r) => {
          setRegion(r); setParam("region", r || null); setPg(1);
          // A country outside the new region matches nothing — drop it with the region.
          const keepCountry = country && r && !countryInRegions(regionMap, [r], country) ? "" : country;
          if (keepCountry !== country) { setCountry(""); setParam("country", null); }
          pruneState(r, keepCountry);
        }} />
        <FilterPill icon={FlagOutlinedIcon} active={!!country}>
          <PillSelect value={country} onChange={(v) => {
            setCountry(v); setParam("country", v || null); setPg(1); pruneState(region, v);
          }} placeholder="Country">
            <MenuItem value="" sx={pillItemSx}>Any country</MenuItem>
            {countryOptions.map((c) => <MenuItem key={c} value={c} sx={pillItemSx}>{c}</MenuItem>)}
          </PillSelect>
        </FilterPill>
        {(stateOptions.length > 0 || state) && (
          <FilterPill icon={PlaceOutlinedIcon} active={!!state}>
            <PillSelect value={state} onChange={(v) => { setState(v); setParam("state", v || null); setPg(1); }} placeholder="State">
              <MenuItem value="" sx={pillItemSx}>Any state</MenuItem>
              {stateOptions.map((s) => <MenuItem key={s} value={s} sx={pillItemSx}>{s}</MenuItem>)}
            </PillSelect>
          </FilterPill>
        )}
        <Tooltip title={following ? "Showing only accounts you follow — click to show all" : "Show only accounts you follow (you're emailed when their stage moves up)"} arrow>
          <Button size="small" variant={following ? "contained" : "outlined"} disableElevation
            onClick={() => { const v = !following; setFollowing(v); setParam("following", v ? "1" : null); setPg(1); }}
            startIcon={following ? <NotificationsActiveIcon sx={{ fontSize: 15 }} /> : <NotificationsNoneIcon sx={{ fontSize: 15 }} />}
            sx={{
              textTransform: "none", fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, borderRadius: "7px", height: 32, px: 1.2, flexShrink: 0,
              ...(following
                ? { bgcolor: C.orange, color: "#fff", "&:hover": { bgcolor: C.orangeDark } }
                : { color: C.sub, borderColor: C.border, bgcolor: C.cardBg, "&:hover": { borderColor: C.orange, bgcolor: C.cardBg } }),
            }}>
            Following
          </Button>
        </Tooltip>
        <FilterPill icon={SortIcon} active={false}>
          <PillSelect value={sort} onChange={(v) => { setSort(v); setPg(1); }} placeholder="Sort"
            renderLabel={(v) => `Sort: ${SORT_OPTIONS[v]?.[0] ?? v}`}>
            {Object.entries(SORT_OPTIONS).map(([v, [, menu]]) => <MenuItem key={v} value={v} sx={pillItemSx}>{menu}</MenuItem>)}
          </PillSelect>
        </FilterPill>
        <Box sx={{ flex: 1 }} />
        <Typography noWrap sx={{ fontFamily: F, fontSize: FS.small, color: C.sub }}>
          <Box component="span" sx={{ color: C.text, fontWeight: FW.semibold }}>{cos.total.toLocaleString()}</Box> companies
          {funnelFilter && <> · <Box component="span" sx={{ color: FUNNEL[funnelFilter as FunnelStage]?.color || C.text, fontWeight: FW.semibold }}>{FUNNEL[funnelFilter as FunnelStage]?.label}</Box></>}
          {following && <> · <Box component="span" sx={{ color: C.orange, fontWeight: FW.semibold }}>Following</Box></>}
        </Typography>
        <ExportMenu disabled={cos.total === 0} busy={exporting} options={[
          { label: "CSV", hint: "All matching rows, not just this page", onClick: () => exportCsv("isac") },
          { label: "LinkedIn CSV", hint: "Campaign Manager company match template", color: "#0A66C2", onClick: () => exportCsv("linkedin") },
        ]} />
      </Box>

      {/* ── Selection bar — only while rows are selected ─────────────── */}
      <SelectionBar count={sel.size} onClear={() => setSel(new Set())}>
        <Button size="small" variant="contained" disableElevation disabled={enriching}
          startIcon={enriching ? <CircularProgress size={13} sx={{ color: "#fff" }} /> : <AutoFixHighIcon sx={{ fontSize: 15 }} />}
          onClick={handleBulkEnrich}
          sx={{ textTransform: "none", whiteSpace: "nowrap", fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, borderRadius: "7px", height: 28, bgcolor: C.orange, "&:hover": { bgcolor: C.orangeDark } }}>
          {enriching ? "Enriching…" : "Enrich selected"}
        </Button>
      </SelectionBar>

      {/* ── Table header ─────────────────────────────────────────────── */}
      <Box sx={{
        display: "grid", gridTemplateColumns: COMPANY_COLS,
        gap: COMPANY_GAP, px: COMPANY_PX, py: 0.6, bgcolor: C.cardBg, borderBottom: `1px solid ${C.border}`, alignItems: "center",
      }}>
        <Checkbox size="small" sx={{ p: 0, color: C.dim, "&.Mui-checked,&.MuiCheckbox-indeterminate": { color: C.orange } }}
          checked={items.length > 0 && items.every((c) => sel.has(c.id))}
          indeterminate={sel.size > 0 && !items.every((c) => sel.has(c.id))}
          onChange={(e) => setSel(e.target.checked ? new Set(items.map((c) => c.id)) : new Set())} />
        {/* `align` mirrors each column's cells: the Stage badge and Source dots
            are centred in their column, the Intent/Awareness numbers lead their bar. */}
        {([
          { label: "Company", tip: "" },
          { label: "Stage", align: "center", tip: "Pipeline stage — where this company is in their buying journey (Activate → Pursue → Research → Engage → Known)" },
          { label: "Intent", tip: "Intent Score (0–100) — Purchase likelihood based on G2 pricing/comparison views, LinkedIn ad clicks, and certifications" },
          { label: "Awareness", tip: "Awareness Score (0–100) — Brand familiarity based on Salesforce accounts, Pardot leads, LinkedIn impressions, and cross-source presence" },
          { label: "Sources", align: "center", tip: "Number of data sources with signals: G2, LinkedIn, Pardot, Salesforce, Certifications" },
        ] as { label: string; tip: string; align?: "center" }[]).map((h) => (
          h.tip ? (
            <Tooltip key={h.label} title={h.tip} arrow placement="top">
              <Typography sx={{ fontFamily: F, ...LABEL, color: C.dim, textAlign: h.align ?? "left", cursor: "help" }}>{h.label}</Typography>
            </Tooltip>
          ) : (
            <Typography key={h.label || "blank"} sx={{ fontFamily: F, ...LABEL, color: C.dim, textAlign: h.align ?? "left" }}>{h.label}</Typography>
          )
        ))}
      </Box>

      {/* ── Company rows (full width table) ───────────────────────── */}
      <Box sx={{ flex: 1, overflowY: "auto", bgcolor: C.panel }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", pt: 6 }}><CircularProgress size={22} sx={{ color: C.orange }} /></Box>
        ) : items.length === 0 ? (
          <Box sx={{ display: "flex", justifyContent: "center", pt: 6 }}>
            <Typography sx={{ fontFamily: F, fontSize: FS.body, color: C.dim }}>No companies found</Typography>
          </Box>
        ) : items.map((c) => {
          const fs = (c.funnel_stage as PriorityStage) || "known";
          const f = FUNNEL[fs];

          return (
            <Box key={c.id} onClick={() => nav(isacPath(`/companies/${c.id}`))} sx={{
              display: "grid", gridTemplateColumns: COMPANY_COLS,
              gap: COMPANY_GAP, px: COMPANY_PX, py: 0.85, cursor: "pointer", alignItems: "center",
              borderBottom: `1px solid ${C.borderSoft}`,
              transition: "background 0.08s",
              "&:hover": { bgcolor: `${f.color}04` },
              ...(sel.has(c.id) ? { bgcolor: `${C.orange}08` } : {}),
            }}>
              {/* Select */}
              <Checkbox size="small" sx={{ p: 0, color: C.dim, "&.Mui-checked": { color: C.orange } }}
                checked={sel.has(c.id)} onChange={() => toggleSel(c.id)} onClick={(e) => e.stopPropagation()} />

              {/* Company name + insight */}
              <Box sx={{ minWidth: 0 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Typography noWrap sx={{ fontFamily: F, ...ROW.primary, color: C.text, lineHeight: 1.2 }}>
                    {c.canonical_name}
                  </Typography>
                  {c.enrichment_status === "enriched" && (
                    <Tooltip title="Enriched" placement="top">
                      <VerifiedIcon sx={{ fontSize: 12, color: C.green }} />
                    </Tooltip>
                  )}
                  {c.enrichment_status === "partial" && (
                    <Tooltip title="Partially enriched" placement="top">
                      <VerifiedIcon sx={{ fontSize: 12, color: C.amber }} />
                    </Tooltip>
                  )}
                </Box>
                <Typography noWrap sx={{ fontFamily: F, ...ROW.secondary, color: C.sub, mt: 0.1 }}>
                  {[c.domain, c.industry, c.region].filter(Boolean).join(" · ") || "—"}
                </Typography>
              </Box>

              {/* Stage badge */}
              <Tooltip title={f.tip} arrow placement="top">
                <Typography noWrap sx={{
                  fontFamily: F, fontSize: FS.micro, fontWeight: FW.semibold, cursor: "help",
                  color: f.color, bgcolor: `${f.color}0a`, border: `1px solid ${f.color}15`,
                  px: 0.6, py: 0.2, borderRadius: "4px", textAlign: "center",
                }}>{f.label}</Typography>
              </Tooltip>

              {/* Intent — number FIRST so it sits under its own heading (it used to
                  trail the bar and read as the Awareness value), then the 7-day
                  trend, then the bar. The separate score box that repeated this
                  number is gone; its trend arrow lives here now. */}
              <Tooltip title={`Intent: ${c.intent_score ?? 0}/100 — Purchase likelihood from G2, LinkedIn clicks, certifications${c.score_trend && c.score_trend !== "flat" ? ` · ${c.score_trend === "up" ? "up" : "down"} ${Math.abs(c.intent_delta ?? 0)} pts in 7 days` : ""}`} arrow placement="top">
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, pr: 1.5 }}>
                  <Typography sx={{ fontFamily: F, ...ROW.number, color: f.color, minWidth: 20 }}>{c.intent_score ?? 0}</Typography>
                  <Typography component="span" sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, lineHeight: 1, width: 8,
                    color: c.score_trend === "up" ? "#10b981" : "#ef4444" }}>
                    {c.score_trend === "up" ? "▲" : c.score_trend === "down" ? "▼" : ""}
                  </Typography>
                  <Box sx={{ flex: 1, height: 5, borderRadius: 3, bgcolor: C.borderSoft, overflow: "hidden" }}>
                    <Box sx={{ width: `${Math.min(c.intent_score ?? 0, 100)}%`, height: "100%", bgcolor: C.red, borderRadius: 3 }} />
                  </Box>
                </Box>
              </Tooltip>

              {/* Awareness score bar */}
              <Tooltip title={`Awareness: ${c.awareness_score ?? 0}/100 — Brand familiarity from SF accounts, Pardot leads, LinkedIn impressions`} arrow placement="top">
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, pr: 1.5 }}>
                  <Typography sx={{ fontFamily: F, ...ROW.number, color: C.textMd, minWidth: 20 }}>{c.awareness_score ?? 0}</Typography>
                  <Box sx={{ flex: 1, height: 5, borderRadius: 3, bgcolor: C.borderSoft, overflow: "hidden" }}>
                    <Box sx={{ width: `${Math.min(c.awareness_score ?? 0, 100)}%`, height: "100%", bgcolor: C.orange, borderRadius: 3 }} />
                  </Box>
                </Box>
              </Tooltip>

              {/* Source dots — one tooltip for the group (7px dots were too small to
                  hover individually), naming each source and whether it has signal. */}
              {(() => {
                const srcs = [
                  { active: (c.g2_pageviews ?? 0) > 0, color: C.orange, label: "G2" },
                  { active: (c.li_clicks ?? 0) > 0 || (c.li_impressions ?? 0) > 0, color: "#0A66C2", label: "LinkedIn" },
                  { active: (c.pardot_lead_count ?? 0) > 0, color: C.pink, label: "Pardot" },
                  { active: (c.sf_account_count ?? 0) > 0, color: C.purple, label: "Salesforce" },
                  { active: (c.cert_count ?? 0) > 0, color: C.green, label: "Certifications" },
                ];
                return (
                  <Tooltip arrow placement="top" title={srcs.map((x) => `${x.active ? "●" : "○"} ${x.label}`).join("   ")}>
                    <Box sx={{ display: "flex", gap: "3px", justifyContent: "center", py: 0.5, cursor: "help" }}>
                      {srcs.map((x) => (
                        <Box key={x.label} sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: x.active ? x.color : `${C.dim}20` }} />
                      ))}
                    </Box>
                  </Tooltip>
                );
              })()}
            </Box>
          );
        })}
      </Box>

      {/* ── Pagination ───────────────────────────────────────────────── */}
      {cos.total > 0 && (
        <ListFooter page={pg} totalPages={cos.pages} total={cos.total} noun="companies" onPage={setPg} disabled={loading} />
      )}

      <Snackbar open={!!bulkMsg} autoHideDuration={6000} onClose={() => setBulkMsg(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }} message={bulkMsg ?? ""} />
    </Box>
  );
}
