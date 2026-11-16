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

import { ArrowRight, ChevronDown, FilterX, ListPlus, Plus, Search, Sparkles } from "@wso2/oxygen-ui-icons-react";
import {
  Autocomplete, Box, Button, Checkbox, Chip, CircularProgress, Collapse,
  Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, InputAdornment, MenuItem, Select, Snackbar, Switch, TextField,
  ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from "@wso2/oxygen-ui";
import {
  LinearProgress, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from "@wso2/oxygen-ui";
import { type KeyboardEvent, type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { saveBlobAsFile, useApiClient } from "../api/client";
import { useRegionCountryMap, useSubdivisionMap } from "../api/queries";
import { ActiveFilterChips, ClampText, ExportMenu, ListFooter, formatLocation } from "../components/ListKit";
import { C, F } from "../theme/pageTokens";
import { allCountries, countriesForRegions, pruneCountries, pruneStates, splitRegions, statesForCountries } from "../utils/geo";
import { FS, FW, LABEL, ROW } from "../theme/typeScale";
import { isacPath } from "../paths";


// ── Static combo options (free entry stays possible on every combo) ─────────
const EMPLOYEE_RANGES = [
  { label: "1–10", value: "1,10" }, { label: "11–50", value: "11,50" },
  { label: "51–200", value: "51,200" }, { label: "201–1,000", value: "201,1000" },
  { label: "1,001–5,000", value: "1001,5000" }, { label: "5,001–10,000", value: "5001,10000" },
  { label: "10,001+", value: "10001,10000000" },
];
const SENIORITIES = ["c_suite", "vp", "head", "director", "manager", "senior", "entry", "owner", "founder", "partner", "intern"];
const EMAIL_STATUSES = ["verified", "unverified", "likely to engage", "unavailable"];
// ISAC intent vocabulary — mirrors the Companies page pipeline + heat tiers.
const FUNNEL_STAGES = [
  { value: "activate", label: "Activate", color: C.red },
  { value: "pursue", label: "Pursue", get color() { return C.orange; } },
  { value: "research", label: "Research", color: C.amber },
  { value: "engage", label: "Engage", color: C.blue },
  { value: "known", label: "Known", color: C.slate },
  { value: "unqualified", label: "Unqualified", get color() { return C.dim; } },
  { value: "restricted", label: "Restricted", get color() { return C.sub; } },
];
const BUYING_STAGES = ["awareness", "consideration", "decision"];
// Apollo's "Market Segments" UI filter has no API param — it is employee-count
// sugar, so these expand into employee ranges on both sources.
const MARKET_SEGMENTS = [
  { label: "SMB (1\u2013200)", ranges: ["1,10", "11,50", "51,200"] },
  { label: "Mid-market (201\u20131,000)", ranges: ["201,1000"] },
  { label: "Enterprise (1,001+)", ranges: ["1001,5000", "5001,10000", "10001,10000000"] },
];
const LEAD_STAGES = ["subscriber", "lead", "mql", "sql", "opportunity"];
// Canonical WSO2 regions — the ISAC lead region filter matches these exactly, so
// the options are hardcoded rather than sourced from the facets endpoint (whose
// list comes from Company.region and can carry non-canonical values like "EMEA").
const WSO2_REGIONS = ["APAC", "Europe", "North America", "Latin America", "Middle East", "Africa"];
// Fallback only, while /countries/region-map loads — the canonical list replaces it.
const COUNTRIES = [
  "United States", "Canada", "United Kingdom", "Germany", "France", "Netherlands", "Switzerland",
  "Sweden", "Norway", "Denmark", "Finland", "Ireland", "Spain", "Italy", "Portugal", "Belgium",
  "Austria", "Poland", "Australia", "New Zealand", "India", "Singapore", "Japan", "South Korea",
  "Malaysia", "Indonesia", "Thailand", "Vietnam", "Philippines", "Sri Lanka", "United Arab Emirates",
  "Saudi Arabia", "Qatar", "Israel", "Turkey", "South Africa", "Nigeria", "Kenya", "Egypt",
  "Brazil", "Mexico", "Argentina", "Chile", "Colombia",
];
const INDUSTRY_OPTIONS = [
  "Information Technology & Services", "Computer Software", "Financial Services", "Banking",
  "Insurance", "Telecommunications", "Hospital & Health Care", "Pharmaceuticals", "Retail",
  "E-commerce", "Manufacturing", "Automotive", "Energy", "Oil & Gas", "Utilities",
  "Government Administration", "Education", "Higher Education", "Logistics & Supply Chain",
  "Transportation", "Airlines/Aviation", "Media", "Entertainment", "Marketing & Advertising",
  "Real Estate", "Construction", "Consumer Goods", "Food & Beverages", "Hospitality",
  "Legal Services", "Management Consulting", "Nonprofit",
];
const TECHNOLOGY_OPTIONS = [
  "kong", "apigee", "mulesoft", "boomi", "tibco", "software_ag", "okta", "auth0", "ping_identity",
  "forgerock", "keycloak", "amazon_aws", "microsoft_azure", "google_cloud", "kubernetes", "docker",
  "salesforce", "sap", "oracle", "workday", "servicenow", "snowflake", "databricks", "kafka",
  "rabbitmq", "redis", "mongodb", "postgresql", "graphql", "terraform",
];
const TITLE_OPTIONS = [
  "CTO", "CIO", "Chief Digital Officer", "VP Engineering", "VP IT", "VP Platform",
  "Head of Engineering", "Head of Platform", "Head of Integration", "Head of Identity",
  "Director of Engineering", "Director of IT", "Enterprise Architect", "Solution Architect",
  "Integration Architect", "Platform Engineer", "DevOps Lead", "Engineering Manager",
  "Product Manager", "IT Manager",
];
const REVENUE_BUCKETS = [
  { label: "Any", value: 0 }, { label: "$1M", value: 1_000_000 }, { label: "$10M", value: 10_000_000 },
  { label: "$50M", value: 50_000_000 }, { label: "$100M", value: 100_000_000 },
  { label: "$500M", value: 500_000_000 }, { label: "$1B", value: 1_000_000_000 },
  { label: "$5B", value: 5_000_000_000 },
];

/** One company row from POST /prospect-search/companies (either source). */
interface CompanyRow {
  id?: number; name: string; domain: string | null; city: string | null;
  state: string | null; country: string | null; employees: number | null;
  industry: string | null; linkedin_url: string | null; source: string;
  intent_score?: number; funnel_stage?: string | null;
}

/** One person row from POST /prospect-search/people (either source). */
interface PersonRow {
  id?: number; first_name: string | null; last_name: string | null;
  email?: string | null; job_title: string | null; seniority: string | null;
  company_name: string | null; company_id?: number | null; company_domain?: string | null;
  company_employees?: number | null;
  city: string | null; state: string | null; country: string | null;
  linkedin_url?: string | null; external_id?: string | null; source: string;
}

/** People "Created" range works at year+month granularity (native month picker).
 *  It defaults to the last 2 years so a People search is scoped to recent leads. */
const _monthStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const DEFAULT_CREATED_TO = _monthStr(new Date());
const DEFAULT_CREATED_FROM = (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 2); return _monthStr(d); })();
/** True for a well-formed year-month string (guards against AI/garbage values). */
const isMonth = (m: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
/** YYYY-MM → first day of that month (inclusive lower bound for the API). */
const monthToFromDate = (m: string) => (isMonth(m) ? `${m}-01` : undefined);
/** YYYY-MM → last day of that month (inclusive upper bound; the API adds +1 day). */
const monthToToDate = (m: string) => {
  if (!isMonth(m)) return undefined;
  const [y, mo] = m.split("-").map(Number);
  const last = new Date(y, mo, 0).getDate();   // day 0 of next month = last day of this one
  return `${m}-${String(last).padStart(2, "0")}`;
};

/** Search response envelope shared by both tabs. */
interface SearchResult<T> { source: string; total: number; page: number; per_page: number; items: T[]; }

/** Distinct filter values from our own data (feeds the ISAC-aware combos). */
interface Facets { regions: string[]; industries: string[]; lead_sources: string[]; naics: string[]; }

/** Collapsible filter group in the left rail (Apollo-style). */
function FilterGroup({ title, active, children }: { title: string; active: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Box sx={{ borderBottom: `1px solid ${C.border}` }}>
      <Box component="button" type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        sx={{ width: "100%", display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 1.25, border: 0, bgcolor: "transparent", cursor: "pointer", "&:hover": { bgcolor: C.card } }}>
        <Typography sx={{ fontFamily: F, fontSize: FS.body, fontWeight: FW.semibold, color: C.text, flex: 1, textAlign: "left" }}>{title}</Typography>
        {active && <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: C.orange }} />}
        <ChevronDown size={16} color={C.dim} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </Box>
      <Collapse in={open}><Box sx={{ px: 1.5, pb: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>{children}</Box></Collapse>
    </Box>
  );
}

/** Multi-select dropdown: opens on click with a checkbox option list (type to
 * filter, or enter a custom value); selections collapse to "+N" chips.
 * `label` stays visible above the field after values are picked (the
 * placeholder is gone by then); `helper` is a one-line hint under it. */
function ComboMulti({ values, onChange, options, placeholder, label, helper }: {
  values: string[]; onChange: (v: string[]) => void; options: string[]; placeholder: string;
  label?: string; helper?: string;
}) {
  const id = useId();
  const field = (
    <Autocomplete multiple freeSolo disableCloseOnSelect openOnFocus size="small" id={label ? id : undefined}
      forcePopupIcon popupIcon={<ChevronDown size={17} color={C.sub} />}
      options={options} value={values} limitTags={3}
      onChange={(_, v) => onChange(v as string[])}
      slotProps={{
        paper: {
          sx: {
            borderRadius: "9px", border: `1px solid ${C.border}`, mt: 0.5,
            boxShadow: "0 10px 28px rgba(22,23,43,0.10)",
            "& .MuiAutocomplete-listbox": { py: 0.5, maxHeight: 280 },
            "& .MuiAutocomplete-option": { minHeight: 32, borderRadius: "6px", mx: 0.5 },
            "& .MuiAutocomplete-option:hover": { bgcolor: `${C.orange}0c` },
            "& .MuiAutocomplete-option[aria-selected='true']": { bgcolor: `${C.orange}10` },
            "& .MuiAutocomplete-noOptions": { fontFamily: F, fontSize: FS.small },
          },
        },
      }}
      renderOption={(props, option, { selected }) => (
        <li {...props} style={{ padding: "0 6px" }}>
          <Checkbox size="small" checked={selected}
            sx={{ p: 0.5, color: C.dim, "&.Mui-checked": { color: C.orange } }} />
          <Typography sx={{ fontFamily: F, fontSize: FS.small }}>{option}</Typography>
        </li>
      )}
      renderTags={(value, getTagProps) =>
        value.map((option, index) => (
          <Chip {...getTagProps({ index })} key={option} label={option} size="small"
            sx={{ fontFamily: F, fontSize: FS.caption, height: 20, bgcolor: `${C.orange}10`, color: C.text,
                  "& .MuiChip-deleteIcon": { fontSize: 13, color: C.sub } }} />
        ))
      }
      getLimitTagsText={(more) => (
        <Typography component="span" sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub, fontWeight: FW.semibold, px: 0.5 }}>+{more}</Typography>
      )}
      renderInput={(params) => (
        <TextField {...params} placeholder={values.length ? "" : placeholder}
          sx={{
            "& .MuiInputBase-root": {
              fontFamily: F, fontSize: FS.small, borderRadius: "7px", py: 0.25, bgcolor: C.panel,
              "&:hover fieldset": { borderColor: `${C.orange}55` },
              "&.Mui-focused fieldset": { borderColor: C.orange },
            },
            "& .MuiInputBase-input::placeholder": { color: C.dim, opacity: 1 },
          }} />
      )}
    />
  );
  if (!label && !helper) return field;
  return (
    <Box>
      {label && (
        <Typography component="label" htmlFor={id} sx={{ display: "block", fontFamily: F, ...LABEL, color: C.sub, mb: 0.5 }}>
          {label}
        </Typography>
      )}
      {field}
      {helper && <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.dim, mt: 0.5 }}>{helper}</Typography>}
    </Box>
  );
}

/** Labeled min/max pair of revenue-bucket selects. */
function RevenueRange({ min, max, onMin, onMax }: { min: number; max: number; onMin: (v: number) => void; onMax: (v: number) => void }) {
  const sel = (value: number, onChange: (v: number) => void, label: string) => (
    <Select size="small" value={value} onChange={(e) => onChange(Number(e.target.value))} displayEmpty
      sx={{ flex: 1, fontFamily: F, fontSize: FS.small, borderRadius: "7px" }} aria-label={label}>
      {REVENUE_BUCKETS.map((b) => <MenuItem key={b.value} value={b.value} sx={{ fontFamily: F, fontSize: FS.small }}>{b.label}</MenuItem>)}
    </Select>
  );
  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
      {sel(min, onMin, "Minimum revenue")}
      <Typography sx={{ fontFamily: F, color: C.dim }}>–</Typography>
      {sel(max, onMax, "Maximum revenue")}
    </Box>
  );
}

/**
 * Prospect Search — the "Find companies / Find people" view with two sources
 * that filter on DIFFERENT things by design: ISAC on our intent data (funnel
 * stage, heat, lifecycle, lead journey), Apollo on its full firmographic
 * search surface. Apollo company rows import into ISAC as net-new companies.
 */
export default function ProspectSearch() {
  const { get, request } = useApiClient();
  const nav = useNavigate();
  const [tab, setTab] = useState<"companies" | "people">("companies");
  const [source, setSource] = useState<"isac" | "apollo">("isac");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [companies, setCompanies] = useState<SearchResult<CompanyRow> | null>(null);
  const [people, setPeople] = useState<SearchResult<PersonRow> | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  // key → ISAC company id, for the "✓ In ISAC / View" state after an import.
  const [imported, setImported] = useState<Map<string, number>>(new Map());
  const [promoting, setPromoting] = useState<string | null>(null);
  // personKey → canonical leads.id (null when no email match), for "✓ In ISAC / View".
  const [promoted, setPromoted] = useState<Map<string, number | null>>(new Map());
  // Bulk enrich: selected row keys (companies: domain??name, people: personKey) +
  // the live run tally. Selection is cleared on every new search / tab / source change.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<{ done: number; total: number; note: string; running: boolean } | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  // Guard the self-scheduling poll so it stops (and doesn't setState) after unmount.
  const mounted = useRef(true);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { mounted.current = false; if (pollTimer.current) clearTimeout(pollTimer.current); }, []);
  const [exporting, setExporting] = useState(false);
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [listName, setListName] = useState("");
  const [savingList, setSavingList] = useState(false);
  // Live progress line for the long-running export/save flows ("Fetching page
  // 3…", "Saving 150 / 600…") — these span many requests and would otherwise
  // look frozen (or get mistaken for a timeout) on big Apollo result sets.
  const [progress, setProgress] = useState<string | null>(null);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPending, setAiPending] = useState(false);
  const [aiSummary, setAiSummary] = useState<{ explanation: string | null; tab: string; source: string; filters: Record<string, unknown> } | null>(null);

  useEffect(() => {
    get<Facets>("/prospect-search/facets").then(setFacets).catch(() => setFacets(null));
  }, [get]);

  const industryOptions = Array.from(new Set([...(facets?.industries ?? []), ...INDUSTRY_OPTIONS]));
  const leadSourceOptions = facets?.lead_sources ?? [];

  // shared firmographic filters
  const [name, setName] = useState("");
  const [locations, setLocations] = useState<string[]>([]);
  const [notLocations, setNotLocations] = useState<string[]>([]);
  const [ranges, setRanges] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [technologies, setTechnologies] = useState<string[]>([]);
  const [keywords, setKeywords] = useState("");
  const [revenueMin, setRevenueMin] = useState(0);
  const [revenueMax, setRevenueMax] = useState(0);
  // ISAC intent filters
  const [funnelStages, setFunnelStages] = useState<string[]>([]);
  const [buyingStages, setBuyingStages] = useState<string[]>([]);
  const [naics, setNaics] = useState<string[]>([]);
  const [marketSegments, setMarketSegments] = useState<string[]>([]);
  // Pipeline buckets by Salesforce-account presence: "net_new" | "in_salesforce".
  const [pipeline, setPipeline] = useState<string[]>([]);
  const [leadStages, setLeadStages] = useState<string[]>([]);
  const [leadSources, setLeadSources] = useState<string[]>([]);
  const [personRegions, setPersonRegions] = useState<string[]>([]);
  // ── Region → country drill-down ─────────────────────────────────────────
  // Regions and countries share one "Location" combo on the company rails and sit
  // in two combos on the people rail; either way, picking a region narrows the
  // countries on offer to that region's members (an unpicked region offers all).
  // Countries come from the canonical region map — one entry per country — not from
  // raw DISTINCT values, which offered alias spellings ("USA", "United States of
  // America") as extra countries that matched almost nothing. The server
  // expands a picked country to all its stored spellings.
  const { data: regionMap } = useRegionCountryMap();
  const allCountryOptions = useMemo(
    () => (regionMap ? allCountries(regionMap) : COUNTRIES), [regionMap]);
  const locationRegions = useMemo(
    () => splitRegions(regionMap, locations).regions, [regionMap, locations]);
  const locationOptions = useMemo(() => Array.from(new Set([
    ...(facets?.regions ?? []), ...Object.keys(regionMap ?? {}),
    ...countriesForRegions(regionMap, locationRegions, allCountryOptions),
  ])), [facets, regionMap, locationRegions, allCountryOptions]);
  // Country → State drill-down (ISAC rails): the State combo appears once a
  // picked country has a state list, offering only that country's states.
  const { data: subdivisionMap } = useSubdivisionMap();
  const [states, setStates] = useState<string[]>([]);
  const stateOptions = useMemo(
    () => statesForCountries(subdivisionMap, splitRegions(regionMap, locations).countries),
    [subdivisionMap, regionMap, locations]);
  /** Setter that also drops countries left outside a newly picked region, and
   * states left outside the remaining countries. */
  const changeLocations = (v: string[]) => {
    const { regions, countries } = splitRegions(regionMap, v);
    const kept = pruneCountries(regionMap, regions, countries);
    setLocations([...regions, ...kept]);
    setStates((prev) => pruneStates(subdivisionMap, kept, prev));
  };

  const [createdFrom, setCreatedFrom] = useState(DEFAULT_CREATED_FROM);
  const [createdTo, setCreatedTo] = useState(DEFAULT_CREATED_TO);
  const [enrichment, setEnrichment] = useState("");
  // Apollo-only filters
  const [fundingLatestMin, setFundingLatestMin] = useState(0);
  const [fundingDateMin, setFundingDateMin] = useState("");
  const [jobTitles, setJobTitles] = useState<string[]>([]);
  const [jobsMin, setJobsMin] = useState("");
  const [titles, setTitles] = useState<string[]>([]);
  const [similarTitles, setSimilarTitles] = useState(true);
  const [seniorities, setSeniorities] = useState<string[]>([]);
  const [personLocations, setPersonLocations] = useState<string[]>([]);
  const [personStates, setPersonStates] = useState<string[]>([]);
  const [companyFilter, setCompanyFilter] = useState("");
  const [personName, setPersonName] = useState("");   // People: search by contact name
  const [emailStatus, setEmailStatus] = useState<string[]>([]);

  // People rail: the Location combo lists only the picked Region's countries.
  const personLocationOptions = useMemo(
    () => countriesForRegions(regionMap, personRegions, allCountryOptions),
    [regionMap, personRegions, allCountryOptions],
  );
  /** Setter that also drops countries left outside a newly picked region. */
  const changePersonRegions = (v: string[]) => {
    setPersonRegions(v);
    const kept = pruneCountries(regionMap, v, personLocations);
    setPersonLocations(kept);
    setPersonStates((prev) => pruneStates(subdivisionMap, kept, prev));
  };
  /** Setter that also drops states left outside the remaining countries. */
  const changePersonLocations = (v: string[]) => {
    setPersonLocations(v);
    setPersonStates((prev) => pruneStates(subdivisionMap, v, prev));
  };
  const personStateOptions = useMemo(
    () => statesForCountries(subdivisionMap, personLocations), [subdivisionMap, personLocations]);

  const hasFilters = tab === "companies"
    ? !!(name.trim() || locations.length || notLocations.length || states.length || ranges.length || industries.length
      || technologies.length || keywords.trim() || revenueMin || revenueMax
      || funnelStages.length || buyingStages.length || naics.length || marketSegments.length || pipeline.length
      || fundingLatestMin || fundingDateMin || jobTitles.length || jobsMin)
    : !!(personName.trim() || titles.length || seniorities.length || personLocations.length || personStates.length || personRegions.length || companyFilter.trim()
      || keywords.trim() || technologies.length || ranges.length || emailStatus.length
      || revenueMin || revenueMax || leadStages.length || leadSources.length
      || createdFrom || createdTo || enrichment);

  // AI-applied filters land in state first; the search fires on the NEXT render
  // so runSearch reads the applied values, not the stale ones.
  useEffect(() => {
    if (aiPending) { setAiPending(false); runSearch(1); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiPending]);

  /** Reset every filter to its default before applying an AI-derived set. */
  const resetAllFilters = () => {
    setName(""); setLocations([]); setNotLocations([]); setStates([]); setRanges([]); setIndustries([]);
    setTechnologies([]); setKeywords(""); setRevenueMin(0); setRevenueMax(0);
    setFunnelStages([]); setBuyingStages([]); setNaics([]); setMarketSegments([]);
    setPipeline([]); setLeadStages([]); setLeadSources([]);
    setCreatedFrom(DEFAULT_CREATED_FROM); setCreatedTo(DEFAULT_CREATED_TO); setEnrichment(""); setFundingLatestMin(0);
    setFundingDateMin(""); setJobTitles([]); setJobsMin(""); setTitles([]);
    setSimilarTitles(true); setSeniorities([]); setPersonLocations([]); setPersonStates([]); setPersonRegions([]);
    setCompanyFilter(""); setEmailStatus([]); setPersonName("");
  };

  /** User-facing reset: clear every filter plus the AI summary/prompt and any
   * current results, returning the rail and results pane to a clean slate. */
  const resetFilters = () => {
    resetAllFilters();
    // Cancel any pending AI-triggered search so the effect below can't repopulate
    // results right after the reset — reset must land on a truly clean slate.
    setAiPending(false);
    setAiSummary(null); setAiPrompt("");
    setCompanies(null); setPeople(null); setPage(1); setMsg(null);
    setSelected(new Set()); setBulk(null);
  };

  /** Ask the AI to fill the rail from a natural-language request, then search. */
  const askAi = async () => {
    const prompt = aiPrompt.trim();
    if (!prompt || aiLoading) return;
    setAiLoading(true);
    try {
      // Pass the user's current selection so Ask AI fills filters WITHIN the chosen
      // Companies|People + ISAC|Apollo scope instead of picking the tab/source itself.
      const r = await request<{ tab: "companies" | "people"; source: "isac" | "apollo"; filters: Record<string, unknown>; explanation: string | null }>(
        "post", "/prospect-search/ai-parse", { prompt, tab, source });
      resetAllFilters();
      setAiSummary({ explanation: r.explanation, tab: r.tab, source: r.source, filters: r.filters });
      setTab(r.tab); setSource(r.source); setCompanies(null); setPeople(null);
      const f = r.filters;
      const strs = (k: string) => (Array.isArray(f[k]) ? (f[k] as string[]) : []);
      const str = (k: string) => (typeof f[k] === "string" ? (f[k] as string) : "");
      const num = (k: string) => (typeof f[k] === "number" ? (f[k] as number) : 0);
      if (r.tab === "companies") {
        setName(str("name")); setLocations(strs("locations")); setNotLocations(strs("not_locations"));
        setStates(strs("states"));
        setRanges(strs("employee_ranges")); setIndustries(strs("industries"));
        setTechnologies(strs("technologies")); setKeywords(str("keywords"));
        setRevenueMin(num("revenue_min")); setRevenueMax(num("revenue_max"));
        setFunnelStages(strs("funnel_stages"));
        setBuyingStages(strs("buying_stages")); setNaics(strs("naics"));
        // Map the AI's net_new / lifecycle onto the Pipeline buckets: net_new=true →
        // Net New; net_new=false or any lifecycle (Prospect/Customer) → In Salesforce.
        { const pl = new Set<string>();
          if (f.net_new === true) pl.add("net_new");
          if (f.net_new === false || str("lifecycle")) pl.add("in_salesforce");
          if (pl.size) setPipeline([...pl]); }
        setFundingLatestMin(num("funding_latest_min"));
        setFundingDateMin(str("funding_date_min")); setJobTitles(strs("job_titles"));
        if (num("jobs_min")) setJobsMin(String(num("jobs_min")));
      } else {
        setTitles(strs("titles"));
        if (typeof f.include_similar_titles === "boolean") setSimilarTitles(f.include_similar_titles);
        setSeniorities(strs("seniorities")); setPersonLocations(strs("person_locations"));
        setPersonStates(strs("person_states"));
        setCompanyFilter(str("company")); setKeywords(str("keywords")); setPersonName(str("name"));
        setLeadStages(strs("lead_stages")); setLeadSources(strs("lead_sources"));
        setPersonRegions(strs("regions"));
        // AI dates may be full YYYY-MM-DD; the month picker wants YYYY-MM. Only
        // override the last-2-years default when the AI supplied a valid month.
        { const cf = str("created_from").slice(0, 7); if (isMonth(cf)) setCreatedFrom(cf); }
        { const ct = str("created_to").slice(0, 7); if (isMonth(ct)) setCreatedTo(ct); }
        setEnrichment(str("enrichment")); setRanges(strs("employee_ranges"));
        setTechnologies(strs("technologies")); setEmailStatus(strs("email_status"));
        setRevenueMin(num("revenue_min")); setRevenueMax(num("revenue_max"));
      }
      setAiPending(true);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "AI couldn't parse that — try rephrasing.");
    } finally { setAiLoading(false); }
  };

  // The company-search payload for the current filters — shared by search,
  // CSV export, and the Apollo list save so all three see identical results.
  const companyPayload = (p: number, perPage: number) => ({
    source, page: p, per_page: perPage,
    name: name.trim() || undefined, locations, not_locations: notLocations,
    // ISAC-only, like its control — never sent hidden on an Apollo search.
    states: source === "isac" ? states : [],
    employee_ranges: Array.from(new Set([...ranges,
      ...MARKET_SEGMENTS.filter((m) => marketSegments.includes(m.label)).flatMap((m) => m.ranges)])),
    industries, technologies, buying_stages: buyingStages, naics,
    keywords: keywords.trim() || undefined,
    revenue_min: revenueMin, revenue_max: revenueMax,
    funnel_stages: funnelStages, pipeline,
    funding_latest_min: fundingLatestMin,
    funding_date_min: fundingDateMin || undefined,
    job_titles: jobTitles, jobs_min: Number(jobsMin) || 0,
  });

  // The people-search payload for the current filters — shared by search and CSV
  // export so both see identical results. `nameOverride` is the live input value.
  const peoplePayload = (p: number, perPage: number, nameOverride?: string) => {
    const nameArg = nameOverride ?? personName.trim();
    return {
      source, page: p, per_page: perPage,
      titles, include_similar_titles: titles.length ? similarTitles : undefined,
      seniorities, person_locations: personLocations,
      person_states: source === "isac" ? personStates : [],
      company: companyFilter.trim() || undefined, keywords: keywords.trim() || undefined,
      name: nameArg || undefined,
      employee_ranges: ranges, technologies, email_status: emailStatus,
      revenue_min: revenueMin, revenue_max: revenueMax,
      lead_stages: leadStages, lead_sources: leadSources, regions: personRegions,
      // Created range is an ISAC-only concept (lead created_date) and its control
      // only shows in the ISAC rail — don't send it (hidden) for Apollo searches.
      created_from: source === "isac" ? monthToFromDate(createdFrom) : undefined,
      created_to: source === "isac" ? monthToToDate(createdTo) : undefined,
      enrichment: enrichment || undefined,
    };
  };

  // `overrides.name` lets the People name field pass the live input value on Enter,
  // so a not-yet-committed keystroke (paste / IME composition) can't send a blank
  // name and trip the backend's "select a filter" guard.
  const runSearch = async (p = 1, overrides?: { name?: string }) => {
    setLoading(true);
    setPage(p);
    setSelected(new Set());   // selection is per result page — reset on every fetch
    try {
      if (tab === "companies") {
        const r = await request<SearchResult<CompanyRow>>("post", "/prospect-search/companies", companyPayload(p, 25));
        setCompanies(r);
      } else {
        const r = await request<SearchResult<PersonRow>>("post", "/prospect-search/people",
          peoplePayload(p, 25, overrides?.name));
        setPeople(r);
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Search failed — try again.");
    } finally { setLoading(false); }
  };

  // Both export paths pull every result page (100/page) up to this cap — it
  // matches the entity service's per-request company limit for list saves.
  const EXPORT_CAP = 1000;

  const fetchAllCompanies = async (): Promise<CompanyRow[]> => {
    const rows: CompanyRow[] = [];
    for (let p = 1; rows.length < EXPORT_CAP; p++) {
      setProgress(`Fetching companies… ${rows.length.toLocaleString()} so far`);
      const r = await request<SearchResult<CompanyRow>>("post", "/prospect-search/companies", companyPayload(p, 100));
      rows.push(...r.items);
      if (r.items.length < 100 || rows.length >= r.total) break;
    }
    return rows.slice(0, EXPORT_CAP);
  };

  const csvEscape = (v: unknown): string => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const exportCsv = async () => {
    if (!companies) return;
    setExporting(true);
    try {
      const rows = await fetchAllCompanies();
      const cols = ["name", "domain", "city", "state", "country", "employees", "industry", "linkedin_url",
        ...(companies.source === "isac" ? ["intent_score", "funnel_stage"] : [])] as (keyof CompanyRow)[];
      const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => csvEscape(r[c])).join(","))].join("\n");
      saveBlobAsFile(new Blob([csv], { type: "text/csv;charset=utf-8" }),
        `companies-${companies.source}-${new Date().toISOString().slice(0, 10)}.csv`);
      setMsg(`Exported ${rows.length.toLocaleString()} companies to CSV.`);
    } catch (e) { setMsg(e instanceof Error ? e.message : "Export failed — try again."); }
    finally { setExporting(false); setProgress(null); }
  };

  /** People CSV — the People tab had no export at all. */
  const exportPeopleCsv = async () => {
    if (!people) return;
    setExporting(true);
    try {
      const rows: PersonRow[] = [];
      for (let p = 1; rows.length < EXPORT_CAP; p++) {
        setProgress(`Fetching people… ${rows.length.toLocaleString()} so far`);
        const r = await request<SearchResult<PersonRow>>("post", "/prospect-search/people", peoplePayload(p, 100));
        rows.push(...r.items);
        if (r.items.length < 100 || rows.length >= r.total) break;
      }
      const cols = ["first_name", "last_name", "job_title", "seniority", "company_name", "city", "state",
        "country", "email", "linkedin_url"] as (keyof PersonRow)[];
      const out = rows.slice(0, EXPORT_CAP);
      const csv = [cols.join(","), ...out.map((r) => cols.map((c) => csvEscape(r[c])).join(","))].join("\n");
      saveBlobAsFile(new Blob([csv], { type: "text/csv;charset=utf-8" }),
        `people-${people.source}-${new Date().toISOString().slice(0, 10)}.csv`);
      setMsg(`Exported ${out.length.toLocaleString()} people to CSV.`);
    } catch (e) { setMsg(e instanceof Error ? e.message : "Export failed — try again."); }
    finally { setExporting(false); setProgress(null); }
  };

  const saveApolloList = async () => {
    const trimmed = listName.trim();
    if (!trimmed) return;
    setSavingList(true);
    try {
      const rows = await fetchAllCompanies();
      // The entity service makes one Apollo call per company, so a single big
      // request would outlive the proxy/backend timeouts. Send small chunks —
      // each stays comfortably inside every hop's budget — and keep a running
      // tally so partial progress survives a mid-run failure.
      const CHUNK = 10;   // the entity service makes ~1 Apollo call per company; keep a chunk well under the 120s hop budget
      let created = 0;
      let failed = 0;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        setProgress(`Saving to Apollo… ${Math.min(i + chunk.length, rows.length).toLocaleString()} / ${rows.length.toLocaleString()}`);
        try {
          const r = await request<{ list_name: string; created: number; failed: { name?: string }[] }>(
            "post", "/prospect-search/save-apollo-list",
            { name: trimmed, companies: chunk.map((c) => ({ name: c.name, domain: c.domain || undefined })) });
          created += r.created;
          failed += r.failed.length;
        } catch (e) {
          // Scope/auth/rate-limit errors won't fix themselves mid-run — stop
          // and report what made it through instead of hammering on.
          const detail = e instanceof Error ? e.message : "Saving the Apollo list failed.";
          setMsg(created > 0
            ? `Saved ${created.toLocaleString()} of ${rows.length.toLocaleString()} companies to "${trimmed}" before failing: ${detail}`
            : detail);
          return;
        }
      }
      setListDialogOpen(false);
      setMsg(`Saved ${created.toLocaleString()} companies to Apollo list "${trimmed}"${failed ? ` (${failed.toLocaleString()} failed)` : ""}.`);
    } finally { setSavingList(false); setProgress(null); }
  };

  const importCompany = async (row: CompanyRow) => {
    const key = row.domain ?? row.name;
    setImporting(key);
    try {
      const r = await request<{ imported: boolean; company_id: number; name: string; enriching?: boolean }>(
        "post", "/prospect-search/import-company", {
          name: row.name, domain: row.domain, city: row.city, state: row.state,
          country: row.country, employees: row.employees, industry: row.industry,
          linkedin_url: row.linkedin_url,
        });
      // Remember the ISAC company id so the row flips to "✓ In ISAC" with a View link.
      setImported((m) => new Map(m).set(key, r.company_id));
      // Enrichment now runs in the background (kept out of the request to avoid gateway timeouts).
      setMsg(r.imported
        ? `Imported "${r.name}" — enriching in the background.`
        : `"${r.name}" is already in ISAC — refreshing enrichment in the background.`);
    } catch { setMsg("Import failed — try again."); } finally { setImporting(null); }
  };

  /** Stable key for an Apollo person row (drives per-row promote spinner + done state). */
  const personKey = (row: PersonRow) =>
    row.external_id ?? row.linkedin_url ?? `${row.first_name ?? ""}-${row.last_name ?? ""}-${row.company_name ?? ""}`;

  /**
   * Promote an Apollo person into ISAC as a prospect: reveal (Apollo) + enrich
   * (Apollo + ZoomInfo), save with source=Apollo, fold into the canonical lead.
   */
  const promotePerson = async (row: PersonRow) => {
    const key = personKey(row);
    setPromoting(key);
    try {
      const r = await request<{ created: boolean; lead_id: number | null; sf_lead_id: number; name: string; email: string; company_id: number | null; enriching?: boolean }>(
        "post", "/prospect-search/promote-person", {
          external_id: row.external_id, first_name: row.first_name, last_name: row.last_name,
          job_title: row.job_title, company_name: row.company_name, company_domain: row.company_domain,
          company_employees: row.company_employees, linkedin_url: row.linkedin_url,
          city: row.city, state: row.state, country: row.country,
        });
      // Store the sf_leads id — that's what /leads/:id (LeadDetail) resolves, NOT the
      // canonical lead id — so the row flips to "✓ In ISAC" with a correct View link.
      setPromoted((m) => new Map(m).set(key, r.sf_lead_id ?? null));
      // Enrichment (company + ZoomInfo) now runs in the background after the reveal.
      setMsg(r.created
        ? `Added "${r.name}" to ISAC as a prospect (Apollo) — enriching in the background.`
        : `"${r.name}" is already in ISAC — linked; enriching in the background.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't add to ISAC — try again.");
    } finally { setPromoting(null); }
  };

  const result = tab === "companies" ? companies : people;

  // Removing a chip re-runs the search (when results are showing), like the
  // Companies/Leads pills — on the NEXT render, so it reads the cleared state.
  const [rerun, setRerun] = useState(false);
  useEffect(() => {
    if (rerun) { setRerun(false); if (result) runSearch(1); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rerun]);
  const activeChips = useMemo(() => {
    const out: { key: string; label: string; onRemove: () => void }[] = [];
    const list = (key: string, group: string, values: string[], clear: () => void, fmt?: (v: string) => string) => {
      if (values.length) out.push({ key, label: `${group}: ${values.map(fmt ?? ((v) => v)).join(", ")}`, onRemove: () => { clear(); setRerun(true); } });
    };
    const one = (key: string, group: string, value: string | number | null | undefined, clear: () => void) => {
      if (value !== null && value !== undefined && value !== "" && value !== 0) out.push({ key, label: `${group}: ${value}`, onRemove: () => { clear(); setRerun(true); } });
    };
    const rangeLabel = (v: string) => EMPLOYEE_RANGES.find((r) => r.value === v)?.label ?? v;
    const pretty = (v: string) => v.replace(/_/g, " ");
    if (tab === "companies") {
      one("name", "Name", name.trim(), () => setName(""));
      list("loc", "Location", locations, () => { setLocations([]); setStates([]); });
      list("state", "State", states, () => setStates([]));
      list("notloc", "Exclude", notLocations, () => setNotLocations([]));
      list("funnel", "Funnel", funnelStages, () => setFunnelStages([]), (v) => FUNNEL_STAGES.find((f) => f.value === v)?.label ?? v);
      list("buying", "Buying stage", buyingStages, () => setBuyingStages([]));
      list("pipeline", "Pipeline", pipeline, () => setPipeline([]), (v) => (v === "net_new" ? "Net new" : "In Salesforce"));
      list("seg", "Segment", marketSegments, () => setMarketSegments([]));
      list("emp", "Employees", ranges, () => setRanges([]), rangeLabel);
      list("ind", "Industry", industries, () => setIndustries([]));
      list("naics", "NAICS", naics, () => setNaics([]));
      list("tech", "Tech", technologies, () => setTechnologies([]));
      one("kw", "Keywords", keywords.trim(), () => setKeywords(""));
      one("rmin", "Revenue ≥", revenueMin ? `$${revenueMin.toLocaleString()}` : "", () => setRevenueMin(0));
      one("rmax", "Revenue ≤", revenueMax ? `$${revenueMax.toLocaleString()}` : "", () => setRevenueMax(0));
      one("fund", "Funding ≥", fundingLatestMin ? `$${fundingLatestMin.toLocaleString()}` : "", () => setFundingLatestMin(0));
      one("fdate", "Funded since", fundingDateMin, () => setFundingDateMin(""));
      list("jobs", "Hiring", jobTitles, () => setJobTitles([]));
      one("jobsmin", "Min postings", jobsMin, () => setJobsMin(""));
    } else {
      one("pname", "Name", personName.trim(), () => setPersonName(""));
      list("titles", "Title", titles, () => setTitles([]));
      list("sen", "Seniority", seniorities, () => setSeniorities([]), pretty);
      list("preg", "Region", personRegions, () => setPersonRegions([]));
      list("ploc", "Country", personLocations, () => { setPersonLocations([]); setPersonStates([]); });
      list("pstate", "State", personStates, () => setPersonStates([]));
      one("company", "Company", companyFilter.trim(), () => setCompanyFilter(""));
      list("lstage", "Lead stage", leadStages, () => setLeadStages([]), (v) => v.toUpperCase());
      list("lsrc", "Lead source", leadSources, () => setLeadSources([]));
      if (source === "isac" && (createdFrom !== DEFAULT_CREATED_FROM || createdTo !== DEFAULT_CREATED_TO)) {
        out.push({
          key: "created", label: `Created: ${createdFrom || "any"} – ${createdTo || "now"}`,
          onRemove: () => { setCreatedFrom(DEFAULT_CREATED_FROM); setCreatedTo(DEFAULT_CREATED_TO); setRerun(true); },
        });
      }
      one("enr", "Enrichment", enrichment, () => setEnrichment(""));
      one("kw", "Keywords", keywords.trim(), () => setKeywords(""));
      list("emp", "Company size", ranges, () => setRanges([]), rangeLabel);
      list("tech", "Tech", technologies, () => setTechnologies([]));
      list("email", "Email", emailStatus, () => setEmailStatus([]));
    }
    return out;
  }, [tab, source, name, locations, states, notLocations, funnelStages, buyingStages, pipeline, marketSegments,
      ranges, industries, naics, technologies, keywords, revenueMin, revenueMax, fundingLatestMin, fundingDateMin,
      jobTitles, jobsMin, personName, titles, seniorities, personRegions, personLocations, personStates,
      companyFilter, leadStages, leadSources, createdFrom, createdTo, enrichment, emailStatus]);
  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.per_page)) : 1;
  const isIsacCompanies = tab === "companies" && result?.source === "isac";

  // ── Bulk enrich ────────────────────────────────────────────────────────────
  // Apollo bulk spends reveal/enrich credits per row → tighter cap + confirm.
  // ISAC bulk re-uses the background jobs (30-day cooldown makes it cheap).
  const BULK_APOLLO_CAP = 100;
  const BULK_ISAC_CAP = 200;
  const bulkCap = source === "apollo" ? BULK_APOLLO_CAP : BULK_ISAC_CAP;
  const selectableItems = (result?.items ?? []) as (CompanyRow | PersonRow)[];
  /** Stable per-row selection key. Prefer the numeric ISAC id (unique + stable);
   *  fall back to the computed key only for Apollo rows, which have no id. The
   *  composite person fallback can collide, so id must win when present. */
  const rowKey = (row: CompanyRow | PersonRow) =>
    row.id != null ? `id:${row.id}`
      : tab === "companies" ? ((row as CompanyRow).domain ?? (row as CompanyRow).name)
      : personKey(row as PersonRow);
  const allSelectedOnPage = selectableItems.length > 0 && selectableItems.every((r) => selected.has(rowKey(r)));
  const runCount = Math.min(selected.size, bulkCap);
  // Rough upper bound: Apollo(+ZoomInfo) enrich ≈ 2 credits/company; people also
  // spend a reveal + company enrich ≈ 3. Shown in the confirm dialog only.
  const estCredits = runCount * (tab === "companies" ? 2 : 3);

  const toggleSel = (key: string) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(key)) n.delete(key); else n.add(key);
    return n;
  });
  const toggleSelectAll = () => setSelected((s) =>
    selectableItems.every((r) => s.has(rowKey(r))) ? new Set() : new Set(selectableItems.map(rowKey)));
  const clearSel = () => setSelected(new Set());

  /** ISAC rows already live in ISAC → drive the existing background bulk jobs. */
  const startIsacBulk = async (ids: number[]) => {
    const capped = ids.slice(0, BULK_ISAC_CAP);
    if (!capped.length) { setMsg("These rows aren't in ISAC yet — use the Apollo source to add them first."); return; }
    setBulk({ done: 0, total: capped.length, note: "Starting…", running: true });
    const isCompanies = tab === "companies";
    const endpoint = isCompanies ? "/company-enrichment/progressive" : "/lead-enrichment/bulk";
    const body = isCompanies ? { company_ids: capped, sources: ["auto"] } : { lead_ids: capped };
    try {
      const r = await request<{ run_id: string }>("post", endpoint, body);
      const poll = async () => {
        if (!mounted.current) return;
        try {
          const s = await get<{ status: string; done?: number; total?: number; counts?: Record<string, number> }>(`${endpoint}/${r.run_id}`);
          if (!mounted.current) return;
          const done = s.done ?? 0;
          const total = s.total ?? capped.length;
          if (s.status === "running") {
            setBulk({ done, total, note: `Enriching ${done} / ${total}…`, running: true });
            pollTimer.current = setTimeout(poll, 1500);
            return;
          }
          const c = s.counts ?? {};
          const note = s.status === "failed" ? "Bulk enrich failed."
            : isCompanies ? `Enriched ${done || total} companies.`
            : `Done — ${c.applied ?? 0} enriched, ${c.no_data ?? 0} no data${c.skipped_optout ? `, ${c.skipped_optout} opted-out` : ""}${c.failed ? `, ${c.failed} failed` : ""}.`;
          setBulk({ done: done || total, total, note, running: false });
          clearSel();
        } catch { setBulk((b) => (b ? { ...b, note: "Lost the run — it may still finish in the background.", running: false } : b)); }
      };
      poll();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't start bulk enrich.");
      setBulk(null);
    }
  };

  /** Apollo rows are net-new → import/promote each (spends credits), row by row. */
  const startApolloBulk = async (rows: (CompanyRow | PersonRow)[]) => {
    const capped = rows.slice(0, BULK_APOLLO_CAP);
    setBulk({ done: 0, total: capped.length, note: "Adding to ISAC…", running: true });
    let ok = 0; let failed = 0;
    for (let i = 0; i < capped.length; i++) {
      if (!mounted.current) return;   // page unmounted mid-run — stop touching state
      try {
        if (tab === "companies") {
          const c = capped[i] as CompanyRow;
          const rr = await request<{ company_id: number }>("post", "/prospect-search/import-company", {
            name: c.name, domain: c.domain, city: c.city, state: c.state,
            country: c.country, employees: c.employees, industry: c.industry, linkedin_url: c.linkedin_url,
          });
          setImported((m) => new Map(m).set(c.domain ?? c.name, rr.company_id));
        } else {
          const p = capped[i] as PersonRow;
          const rr = await request<{ lead_id: number | null; sf_lead_id: number }>("post", "/prospect-search/promote-person", {
            external_id: p.external_id, first_name: p.first_name, last_name: p.last_name,
            job_title: p.job_title, company_name: p.company_name, company_domain: p.company_domain,
            company_employees: p.company_employees, linkedin_url: p.linkedin_url,
            city: p.city, state: p.state, country: p.country,
          });
          setPromoted((m) => new Map(m).set(personKey(p), rr.sf_lead_id ?? null));
        }
        ok += 1;
      } catch { failed += 1; }
      const last = i + 1 >= capped.length;
      setBulk({ done: i + 1, total: capped.length,
        note: last ? `Added ${ok} to ISAC${failed ? `, ${failed} failed` : ""}.` : `Adding ${i + 1} / ${capped.length}… (${ok} ok${failed ? `, ${failed} failed` : ""})`,
        running: !last });
    }
    clearSel();
  };

  /** Entry point for the "Enrich N selected" button. */
  const runBulkEnrich = () => {
    if (bulk?.running || selected.size === 0) return;
    if (source === "apollo") { setBulkConfirm(true); return; }   // credit spend → confirm first
    const ids = selectableItems.filter((r) => selected.has(rowKey(r)))
      .map((r) => r.id).filter((x): x is number => typeof x === "number");
    startIsacBulk(ids);
  };
  const confirmApolloBulk = () => {
    setBulkConfirm(false);
    startApolloBulk(selectableItems.filter((r) => selected.has(rowKey(r))));
  };

  /** Up to two letters for an avatar tile ("Acme Corp"→"AC", "Apple"→"A"). */
  const rowInitials = (s: string) => {
    const parts = (s || "").replace(/[^A-Za-z ]/g, "").split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || (s?.[0] ?? "?").toUpperCase();
  };
  /** Intent score → heat tier color + label (drives the row's score pill). */
  const intentTier = (n: number) => (n >= 80 ? { c: C.red, label: "Hot" } : n >= 50 ? { c: C.amber, label: "Warm" } : { c: C.slate, label: "Cold" });
  /** Keyboard-accessible click props for a row name that navigates to `path`
   * (Enter/Space activate); returns {} when there's no destination. */
  const linkProps = (path: string | null | undefined) => (path ? {
    role: "link" as const, tabIndex: 0,
    onClick: () => nav(path),
    onKeyDown: (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); nav(path); } },
  } : {});
  /** "✓ In ISAC" done-state shown after an add, with a button that opens the
   * item's ISAC detail page (`detailPath` is null when we have no id to link to). */
  const inIsacCell = (detailPath: string | null) => (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
      <Typography component="span" sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.green, whiteSpace: "nowrap" }}>
        ✓ In ISAC
      </Typography>
      {detailPath && (
        <Tooltip title="Open this record in ISAC" arrow>
          <span>
            <Button size="small" variant="outlined" endIcon={<ArrowRight size={12} />}
              onClick={() => nav(detailPath)}
              sx={{ textTransform: "none", fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, borderRadius: "6px", py: 0.25 }}>
              View in ISAC
            </Button>
          </span>
        </Tooltip>
      )}
    </Box>
  );
  const fieldSx = { "& .MuiInputBase-root": { fontFamily: F, fontSize: FS.small, borderRadius: "7px" } };
  const checkbox = (checked: boolean, onChange: (on: boolean) => void, label: string, color?: string) => (
    <FormControlLabel key={label} sx={{ m: 0 }}
      control={<Checkbox size="small" checked={checked} onChange={(e) => onChange(e.target.checked)}
        sx={color ? { color, "&.Mui-checked": { color } } : undefined} />}
      label={<Typography sx={{ fontFamily: F, fontSize: FS.small, textTransform: "capitalize" }}>{label}</Typography>} />
  );
  const toggleIn = (list: string[], set: (v: string[]) => void) => (v: string) => (on: boolean) =>
    set(on ? [...list, v] : list.filter((x) => x !== v));

  /** Human labels for AI-applied filter chips in the explanation banner. */
  const FILTER_LABELS: Record<string, string> = {
    name: "Name", locations: "Location", not_locations: "Exclude", employee_ranges: "Employees",
    industries: "Industry", technologies: "Tech", keywords: "Keywords", revenue_min: "Revenue \u2265",
    revenue_max: "Revenue \u2264", funnel_stages: "Funnel", buying_stages: "Buying stage",
    naics: "NAICS", net_new: "Net-new", lifecycle: "Lifecycle", funding_latest_min: "Funding \u2265",
    funding_date_min: "Funded since", job_titles: "Hiring", jobs_min: "Min postings", titles: "Titles",
    include_similar_titles: "Similar titles", seniorities: "Seniority", person_locations: "Location",
    states: "State", person_states: "State",
    company: "Company", lead_stages: "Lead stage", lead_sources: "Lead source", regions: "Region", created_from: "From",
    created_to: "To", enrichment: "Enrichment", email_status: "Email status",
  };
  const chipText = (k: string, v: unknown) =>
    `${FILTER_LABELS[k] ?? k}: ${Array.isArray(v) ? v.join(", ") : typeof v === "boolean" ? (v ? "yes" : "no") : String(v)}`;

  return (
    <Box sx={{ display: "flex", height: "100%", minHeight: 0, bgcolor: C.bg, overflow: "hidden" }}>
      {/* ── Filter rail ── */}
      <Box sx={{ width: 280, flexShrink: 0, bgcolor: C.panel, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", overflowY: "auto" }}>
        <Box sx={{ p: 1.5, borderBottom: `1px solid ${C.border}` }}>
          <ToggleButtonGroup exclusive size="small" fullWidth value={tab}
            onChange={(_, v) => { if (v) { setTab(v); setPage(1); setSelected(new Set()); } }}>
            <ToggleButton value="companies" sx={{ fontFamily: F, fontSize: FS.small, textTransform: "none", fontWeight: FW.semibold }}>Companies</ToggleButton>
            <ToggleButton value="people" sx={{ fontFamily: F, fontSize: FS.small, textTransform: "none", fontWeight: FW.semibold }}>People</ToggleButton>
          </ToggleButtonGroup>
          <ToggleButtonGroup exclusive size="small" fullWidth value={source} sx={{ mt: 1 }}
            onChange={(_, v) => {
              if (v) {
                setSource(v); setPage(1); setAiSummary(null); setSelected(new Set());
                // results from the other source would render under the wrong chip
                setCompanies(null); setPeople(null);
              }
            }}>
            <ToggleButton value="isac" sx={{ fontFamily: F, fontSize: FS.small, textTransform: "none", fontWeight: FW.semibold, "&.Mui-selected": { color: C.orange } }}>ISAC data</ToggleButton>
            <ToggleButton value="apollo" sx={{ fontFamily: F, fontSize: FS.small, textTransform: "none", fontWeight: FW.semibold, "&.Mui-selected": { color: C.apollo } }}>Apollo (live)</ToggleButton>
          </ToggleButtonGroup>
          <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.dim, mt: 0.75 }}>
            {source === "isac"
              ? "Our data — filter on intent: funnel stage, buying stage, lifecycle, lead journey."
              : "Live Apollo database — full firmographic search; free, only enrichment spends credits."}
          </Typography>
        </Box>

        {/* ── ISAC rail: intent-first ── */}
        {tab === "companies" && source === "isac" && (<>
          <FilterGroup title="Company name" active={!!name.trim()}>
            <TextField size="small" fullWidth placeholder="e.g. Acme" value={name} onChange={(e) => setName(e.target.value)} sx={fieldSx} />
          </FilterGroup>
          <FilterGroup title="Funnel stage" active={funnelStages.length > 0}>
            {FUNNEL_STAGES.map((s) => checkbox(funnelStages.includes(s.value),
              toggleIn(funnelStages, setFunnelStages)(s.value), s.label, s.color))}
          </FilterGroup>
          <FilterGroup title="Buying stage (G2)" active={buyingStages.length > 0}>
            {BUYING_STAGES.map((b) => checkbox(buyingStages.includes(b), toggleIn(buyingStages, setBuyingStages)(b), b))}
          </FilterGroup>
          <FilterGroup title="Pipeline" active={pipeline.length > 0}>
            {checkbox(pipeline.includes("net_new"), toggleIn(pipeline, setPipeline)("net_new"), "Net New (not in Salesforce)")}
            {checkbox(pipeline.includes("in_salesforce"), toggleIn(pipeline, setPipeline)("in_salesforce"), "In Salesforce")}
          </FilterGroup>
          <FilterGroup title="Location" active={locations.length > 0 || notLocations.length > 0 || states.length > 0}>
            <ComboMulti values={locations} onChange={changeLocations} options={locationOptions} label="Include locations"
              placeholder="Regions or countries to include" />
            <ComboMulti values={notLocations} onChange={setNotLocations} options={locationOptions} label="Exclude locations"
              placeholder="Regions or countries to exclude" helper="Leave out these countries or regions" />
            {(stateOptions.length > 0 || states.length > 0) && (
              <ComboMulti values={states} onChange={setStates} options={stateOptions} label="States / provinces" placeholder="Narrow to states or provinces" />
            )}
          </FilterGroup>
          <FilterGroup title="Employees" active={ranges.length > 0}>
            {EMPLOYEE_RANGES.map((r) => checkbox(ranges.includes(r.value), toggleIn(ranges, setRanges)(r.value), r.label))}
          </FilterGroup>
          <FilterGroup title="Industry & keywords" active={industries.length > 0 || naics.length > 0 || !!keywords.trim()}>
            <ComboMulti values={industries} onChange={setIndustries} options={industryOptions} placeholder="Industries" />
            <ComboMulti values={naics} onChange={setNaics} options={facets?.naics ?? []} placeholder="NAICS industry (from enrichment)" />
            <TextField size="small" fullWidth placeholder="Keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)} sx={fieldSx} />
          </FilterGroup>
          <FilterGroup title="Technologies" active={technologies.length > 0}>
            <ComboMulti values={technologies} onChange={setTechnologies} options={TECHNOLOGY_OPTIONS} placeholder="Enriched tech stack" />
          </FilterGroup>
          <FilterGroup title="Revenue" active={revenueMin > 0 || revenueMax > 0}>
            <RevenueRange min={revenueMin} max={revenueMax} onMin={setRevenueMin} onMax={setRevenueMax} />
          </FilterGroup>
        </>)}

        {/* ── Apollo rail: full firmographic surface ── */}
        {tab === "companies" && source === "apollo" && (<>
          <FilterGroup title="Company name" active={!!name.trim()}>
            <TextField size="small" fullWidth placeholder="e.g. Acme" value={name} onChange={(e) => setName(e.target.value)} sx={fieldSx} />
          </FilterGroup>
          <FilterGroup title="Account location" active={locations.length > 0 || notLocations.length > 0}>
            <ComboMulti values={locations} onChange={changeLocations} options={locationOptions} label="Include locations"
              placeholder="Regions or countries to include" />
            <ComboMulti values={notLocations} onChange={setNotLocations} options={locationOptions} label="Exclude locations"
              placeholder="Regions or countries to exclude" helper="Leave out these countries or regions" />
          </FilterGroup>
          <FilterGroup title="Market segment" active={marketSegments.length > 0}>
            {MARKET_SEGMENTS.map((m) => checkbox(marketSegments.includes(m.label),
              toggleIn(marketSegments, setMarketSegments)(m.label), m.label))}
            <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.dim }}>
              Shortcut for employee-count ranges (Apollo has no direct segment filter).
            </Typography>
          </FilterGroup>
          <FilterGroup title="Employees" active={ranges.length > 0}>
            {EMPLOYEE_RANGES.map((r) => checkbox(ranges.includes(r.value), toggleIn(ranges, setRanges)(r.value), r.label))}
          </FilterGroup>
          <FilterGroup title="Industry & keywords" active={industries.length > 0 || !!keywords.trim()}>
            <ComboMulti values={industries} onChange={setIndustries} options={industryOptions} placeholder="Industries" />
            <TextField size="small" fullWidth placeholder="Keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)} sx={fieldSx} />
          </FilterGroup>
          <FilterGroup title="Technologies" active={technologies.length > 0}>
            <ComboMulti values={technologies} onChange={setTechnologies} options={TECHNOLOGY_OPTIONS} placeholder="Employer tech stack" />
          </FilterGroup>
          <FilterGroup title="Revenue" active={revenueMin > 0 || revenueMax > 0}>
            <RevenueRange min={revenueMin} max={revenueMax} onMin={setRevenueMin} onMax={setRevenueMax} />
          </FilterGroup>
          <FilterGroup title="Funding" active={fundingLatestMin > 0 || !!fundingDateMin}>
            <Select size="small" value={fundingLatestMin} onChange={(e) => setFundingLatestMin(Number(e.target.value))}
              sx={{ fontFamily: F, fontSize: FS.small, borderRadius: "7px" }} aria-label="Minimum latest funding round">
              {REVENUE_BUCKETS.map((b) => <MenuItem key={b.value} value={b.value} sx={{ fontFamily: F, fontSize: FS.small }}>{b.value === 0 ? "Any round size" : `Latest round ≥ ${b.label}`}</MenuItem>)}
            </Select>
            <TextField size="small" type="date" value={fundingDateMin} onChange={(e) => setFundingDateMin(e.target.value)}
              inputProps={{ "aria-label": "Funded since" }} helperText="Funded since" sx={fieldSx}
              FormHelperTextProps={{ sx: { fontFamily: F, fontSize: FS.caption, m: 0 } }} />
          </FilterGroup>
          <FilterGroup title="Job postings" active={jobTitles.length > 0 || !!jobsMin}>
            <ComboMulti values={jobTitles} onChange={setJobTitles} options={TITLE_OPTIONS} placeholder="Hiring for titles" />
            <TextField size="small" type="number" placeholder="Min active postings" value={jobsMin}
              onChange={(e) => setJobsMin(e.target.value)} sx={fieldSx} />
          </FilterGroup>
        </>)}

        {/* ── People: search by contact name (both sources) ── */}
        {tab === "people" && (
          <Box sx={{ px: 1.5, py: 1.25, borderBottom: `1px solid ${C.border}` }}>
            <TextField size="small" fullWidth value={personName} inputProps={{ name: "person-name", "aria-label": source === "isac" ? "Search by name or email" : "Search by name", autoComplete: "off" }}
              onChange={(e) => setPersonName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || loading) return;
                // Read the live input value so a just-typed/pasted name searches even
                // if React hasn't committed `personName` yet (the intermittent bug).
                const v = (e.currentTarget as HTMLInputElement).value.trim();
                if (v) { setPersonName(v); runSearch(1, { name: v }); }
                else if (hasFilters) runSearch(1);
              }}
              placeholder={source === "isac" ? "Search by name or email…" : "Search by name…"}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search size={14} color={C.dim} /></InputAdornment> }}
              sx={fieldSx} />
          </Box>
        )}

        {/* ── ISAC people rail: lead journey ── */}
        {tab === "people" && source === "isac" && (<>
          <FilterGroup title="Job titles" active={titles.length > 0}>
            <ComboMulti values={titles} onChange={setTitles} options={TITLE_OPTIONS} placeholder="Pick or type titles" />
          </FilterGroup>
          <FilterGroup title="Lead stage" active={leadStages.length > 0}>
            {LEAD_STAGES.map((s) => checkbox(leadStages.includes(s), toggleIn(leadStages, setLeadStages)(s), s.toUpperCase()))}
          </FilterGroup>
          <FilterGroup title="Lead source" active={leadSources.length > 0}>
            <ComboMulti values={leadSources} onChange={setLeadSources} options={leadSourceOptions} placeholder="e.g. Webinar, reo.dev" />
          </FilterGroup>
          <FilterGroup title="Seniority" active={seniorities.length > 0}>
            {SENIORITIES.slice(0, 7).map((s) => checkbox(seniorities.includes(s), toggleIn(seniorities, setSeniorities)(s), s.replace("_", "-")))}
          </FilterGroup>
          {/* Region sits above Location: picking one narrows the country list below it. */}
          <FilterGroup title="Region" active={personRegions.length > 0}>
            <ComboMulti values={personRegions} onChange={changePersonRegions} options={WSO2_REGIONS} placeholder="e.g. APAC, Europe" />
          </FilterGroup>
          <FilterGroup title="Location" active={personLocations.length > 0 || personStates.length > 0}>
            <ComboMulti values={personLocations} onChange={changePersonLocations} options={personLocationOptions}
              placeholder={personRegions.length ? `Countries in ${personRegions.join(", ")}` : "Countries"} />
            {(personStateOptions.length > 0 || personStates.length > 0) && (
              <ComboMulti values={personStates} onChange={setPersonStates} options={personStateOptions} placeholder="States / provinces" />
            )}
          </FilterGroup>
          <FilterGroup title="Created (month range)" active={!!(createdFrom || createdTo)}>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <TextField size="small" type="month" value={createdFrom} inputProps={{ "aria-label": "Created from month", max: DEFAULT_CREATED_TO }}
                onChange={(e) => setCreatedFrom(e.target.value)} sx={{ ...fieldSx, flex: 1 }} />
              <Typography sx={{ fontFamily: F, color: C.dim }}>–</Typography>
              <TextField size="small" type="month" value={createdTo} inputProps={{ "aria-label": "Created to month", max: DEFAULT_CREATED_TO }}
                onChange={(e) => setCreatedTo(e.target.value)} sx={{ ...fieldSx, flex: 1 }} />
            </Box>
            <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.dim, mt: 0.5 }}>
              Defaults to the last 2 years. Clear both to search all-time.
            </Typography>
          </FilterGroup>
          <FilterGroup title="Enrichment & company" active={!!enrichment || !!companyFilter.trim()}>
            <Select size="small" value={enrichment} onChange={(e) => setEnrichment(e.target.value)} displayEmpty
              sx={{ fontFamily: F, fontSize: FS.small, borderRadius: "7px" }} aria-label="Enrichment status">
              <MenuItem value="" sx={{ fontFamily: F, fontSize: FS.small }}>Any enrichment status</MenuItem>
              <MenuItem value="none" sx={{ fontFamily: F, fontSize: FS.small }}>Not enriched</MenuItem>
              <MenuItem value="enriched" sx={{ fontFamily: F, fontSize: FS.small }}>Enriched</MenuItem>
            </Select>
            <TextField size="small" fullWidth placeholder="Company name" value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} sx={fieldSx} />
          </FilterGroup>
        </>)}

        {/* ── Apollo people rail ── */}
        {tab === "people" && source === "apollo" && (<>
          <FilterGroup title="Job titles" active={titles.length > 0}>
            <ComboMulti values={titles} onChange={setTitles} options={TITLE_OPTIONS} placeholder="Pick or type titles" />
            <FormControlLabel sx={{ m: 0 }}
              control={<Switch size="small" checked={similarTitles} onChange={(e) => setSimilarTitles(e.target.checked)} />}
              label={<Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.sub }}>Include similar titles</Typography>} />
          </FilterGroup>
          <FilterGroup title="Seniority" active={seniorities.length > 0}>
            {SENIORITIES.map((s) => checkbox(seniorities.includes(s), toggleIn(seniorities, setSeniorities)(s), s.replace("_", "-")))}
          </FilterGroup>
          <FilterGroup title="Person location" active={personLocations.length > 0}>
            <ComboMulti values={personLocations} onChange={setPersonLocations} options={personLocationOptions} placeholder="Countries" />
          </FilterGroup>
          <FilterGroup title="Company" active={!!companyFilter.trim() || !!keywords.trim()}>
            <TextField size="small" fullWidth placeholder="Company name or domain" value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} sx={fieldSx} />
            <TextField size="small" fullWidth placeholder="Keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)} sx={fieldSx} />
          </FilterGroup>
          <FilterGroup title="Company size" active={ranges.length > 0}>
            {EMPLOYEE_RANGES.map((r) => checkbox(ranges.includes(r.value), toggleIn(ranges, setRanges)(r.value), r.label))}
          </FilterGroup>
          <FilterGroup title="Technologies" active={technologies.length > 0}>
            <ComboMulti values={technologies} onChange={setTechnologies} options={TECHNOLOGY_OPTIONS} placeholder="Employer tech stack" />
          </FilterGroup>
          <FilterGroup title="Email status" active={emailStatus.length > 0}>
            {EMAIL_STATUSES.map((s) => checkbox(emailStatus.includes(s), toggleIn(emailStatus, setEmailStatus)(s), s))}
          </FilterGroup>
          <FilterGroup title="Company revenue" active={revenueMin > 0 || revenueMax > 0}>
            <RevenueRange min={revenueMin} max={revenueMax} onMin={setRevenueMin} onMax={setRevenueMax} />
          </FilterGroup>
        </>)}

        <Box sx={{ p: 1.5, mt: "auto", borderTop: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 0.75 }}>
          <Button fullWidth variant="contained" disableElevation disabled={loading || !hasFilters}
            startIcon={loading ? <CircularProgress size={13} sx={{ color: "#fff" }} /> : <Search size={15} />}
            onClick={() => runSearch(1)}
            sx={{ textTransform: "none", fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, borderRadius: "7px", bgcolor: source === "apollo" ? C.apollo : C.orange, "&:hover": { bgcolor: source === "apollo" ? "#57389e" : C.orangeDark } }}>
            Search {source === "apollo" ? "Apollo" : "ISAC"}
          </Button>
          {(hasFilters || aiSummary || result) && (
            <Button fullWidth variant="text" disabled={loading} onClick={resetFilters}
              startIcon={<FilterX size={14} />}
              sx={{ textTransform: "none", fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, borderRadius: "7px", color: C.sub, "&:hover": { bgcolor: `${C.text}0a`, color: C.text } }}>
              Reset filters
            </Button>
          )}
        </Box>
      </Box>

      {/* ── Results ── */}
      <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* ── AI bar: natural language → filters ── */}
        <Box sx={{ px: 2, py: 1.25, borderBottom: `1px solid ${C.border}`, bgcolor: C.panel, display: "flex", alignItems: "center", gap: 1 }}>
          <Sparkles size={18} color={C.apollo} />
          <TextField fullWidth size="small" value={aiPrompt} disabled={aiLoading}
            placeholder={'Describe who you need — e.g. "hot EMEA banks in our pipeline" or "CTOs at 1000+ employee German companies using Kong"'}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); askAi(); } }}
            sx={{ "& .MuiInputBase-root": { fontFamily: F, fontSize: FS.body, borderRadius: "8px", bgcolor: C.bg,
                  "&:hover fieldset": { borderColor: `${C.apollo}55` }, "&.Mui-focused fieldset": { borderColor: C.apollo } },
                  "& .MuiInputBase-input::placeholder": { color: C.dim, opacity: 1 } }} />
          <Button variant="contained" disableElevation disabled={aiLoading || !aiPrompt.trim()} onClick={askAi}
            startIcon={aiLoading ? <CircularProgress size={13} sx={{ color: "#fff" }} /> : <Sparkles size={14} />}
            sx={{ textTransform: "none", fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, borderRadius: "8px", px: 2, flexShrink: 0, bgcolor: C.apollo, "&:hover": { bgcolor: "#57389e" } }}>
            Ask AI
          </Button>
        </Box>

        {aiSummary && (
          <Box sx={{ px: 2, py: 1.25, borderBottom: `1px solid ${C.border}`, bgcolor: `${C.apollo}08`, display: "flex", gap: 1.25, alignItems: "flex-start" }}>
            <Sparkles size={15} color={C.apollo} style={{ marginTop: 2, flexShrink: 0 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {aiSummary.explanation && (
                <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.text, mb: 0.75 }}>
                  {aiSummary.explanation}
                </Typography>
              )}
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, alignItems: "center" }}>
                <Chip size="small" label={`${aiSummary.source === "apollo" ? "Apollo (live)" : "ISAC data"} \u00b7 ${aiSummary.tab}`}
                  sx={{ fontFamily: F, height: 20, fontSize: FS.caption, fontWeight: FW.semibold, bgcolor: aiSummary.source === "apollo" ? `${C.apollo}18` : `${C.orange}18`, color: aiSummary.source === "apollo" ? C.apollo : C.orange }} />
                {Object.entries(aiSummary.filters).map(([k, v]) => (
                  <Chip key={k} size="small" label={chipText(k, v)}
                    sx={{ fontFamily: F, height: 20, fontSize: FS.caption, bgcolor: C.panel, border: `1px solid ${C.border}`, color: C.sub }} />
                ))}
                <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.dim, ml: 0.5 }}>
                  Adjust any filter on the left and search again.
                </Typography>
              </Box>
            </Box>
            <Box component="button" type="button" aria-label="Dismiss AI summary" onClick={() => setAiSummary(null)}
              sx={{ border: 0, bgcolor: "transparent", cursor: "pointer", color: C.dim, fontFamily: F, fontSize: FS.body, lineHeight: 1, p: 0.5, "&:hover": { color: C.text } }}>
              {"\u2715"}
            </Box>
          </Box>
        )}

        <Box sx={{ px: 2, py: 1.25, borderBottom: `1px solid ${C.border}`, bgcolor: C.panel, display: "flex", alignItems: "center", gap: 1 }}>
          <Typography sx={{ fontFamily: F, fontSize: FS.body, fontWeight: FW.semibold, color: C.text }}>
            {result ? `${result.total.toLocaleString()} ${tab}` : `Find ${tab}`}
          </Typography>
          {result && (
            <Chip size="small" label={result.source === "apollo" ? "Apollo (live)" : "ISAC data"}
              sx={{ fontFamily: F, height: 20, fontSize: FS.caption, fontWeight: FW.semibold, bgcolor: result.source === "apollo" ? `${C.apollo}14` : `${C.orange}14`, color: result.source === "apollo" ? C.apollo : C.orange }} />
          )}
          <Box sx={{ flex: 1 }} />
          {result && result.items.length > 0 && (
            <ExportMenu disabled={loading || savingList} busy={exporting} busyLabel={progress}
              options={tab === "companies" ? [
                { label: "CSV", hint: `Every match, up to ${EXPORT_CAP.toLocaleString()} rows`, onClick: exportCsv },
                { label: "Save to Apollo list", hint: "Add these companies to an Apollo account list", color: C.apollo,
                  onClick: () => { setListName(""); setListDialogOpen(true); } },
              ] : [
                { label: "CSV", hint: `Every match, up to ${EXPORT_CAP.toLocaleString()} rows`, onClick: exportPeopleCsv },
              ]} />
          )}
        </Box>

        <ActiveFilterChips chips={activeChips} onClearAll={resetFilters} />

        {result && result.items.length > 0 && (selected.size > 0 || bulk) && (
          <Box sx={{ px: 2, py: 1, borderBottom: `1px solid ${C.border}`, bgcolor: `${source === "apollo" ? C.apollo : C.orange}0a`, display: "flex", alignItems: "center", gap: 1.5 }}>
            {bulk ? (
              <>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: C.text }}>{bulk.note}</Typography>
                  <LinearProgress variant="determinate" value={bulk.total ? Math.round((bulk.done / bulk.total) * 100) : 0}
                    sx={{ mt: 0.5, height: 5, borderRadius: 3 }} />
                </Box>
                {!bulk.running && (
                  <Button size="small" onClick={() => setBulk(null)}
                    sx={{ textTransform: "none", fontFamily: F, fontSize: FS.small, color: C.sub }}>Dismiss</Button>
                )}
              </>
            ) : (
              <>
                <Typography sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: C.text }}>{selected.size} selected</Typography>
                {selected.size > bulkCap && (
                  <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.amber }}>· only the first {bulkCap} will run</Typography>
                )}
                <Box sx={{ flex: 1 }} />
                <Button size="small" variant="contained" disableElevation onClick={runBulkEnrich}
                  startIcon={<Sparkles size={13} />}
                  sx={{ textTransform: "none", fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, borderRadius: "7px",
                    bgcolor: source === "apollo" ? C.apollo : C.orange, "&:hover": { bgcolor: source === "apollo" ? "#57389e" : C.orangeDark } }}>
                  {source === "apollo" ? `Add & enrich ${runCount} in ISAC` : `Enrich ${runCount} selected`}
                </Button>
                <Button size="small" onClick={clearSel} sx={{ textTransform: "none", fontFamily: F, fontSize: FS.small, color: C.sub }}>Clear</Button>
              </>
            )}
          </Box>
        )}

        <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", p: 1.5, pb: 0.75 }}>
          {!result ? (
            <Typography sx={{ fontFamily: F, fontSize: FS.body, color: C.dim, textAlign: "center", py: 8 }}>
              Pick filters on the left and hit Search — ISAC filters on our intent data; Apollo searches its live database (28M+ companies, free).
            </Typography>
          ) : result.items.length === 0 ? (
            <Typography sx={{ fontFamily: F, fontSize: FS.body, color: C.dim, textAlign: "center", py: 8 }}>
              Nothing matches these filters{result.source === "isac" ? " in ISAC — try the Apollo source for net-new prospects." : "."}
            </Typography>
          ) : tab === "companies" ? (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 0, flex: 1, overflow: "auto" }}>
              <Table stickyHeader size="small" sx={{ tableLayout: "fixed", "& .MuiTableCell-root": { fontFamily: F, fontSize: FS.small } }}>
                <TableHead>
                  <TableRow sx={{ "& th": { ...LABEL, color: C.sub, bgcolor: C.card } }}>
                    <TableCell padding="checkbox" sx={{ bgcolor: C.card }}>
                      <Checkbox size="small" checked={allSelectedOnPage}
                        indeterminate={selected.size > 0 && !allSelectedOnPage} onChange={toggleSelectAll} />
                    </TableCell>
                    <TableCell sx={{ width: "28%" }}>Company</TableCell>
                    {isIsacCompanies && <TableCell sx={{ width: 130 }}>Intent</TableCell>}
                    <TableCell sx={{ width: "22%" }}>Location</TableCell>
                    <TableCell align="right" sx={{ width: 96 }}>Employees</TableCell>
                    <TableCell>Industry</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(result.items as CompanyRow[]).map((row, i) => {
                    const stage = FUNNEL_STAGES.find((s) => s.value === row.funnel_stage);
                    const tier = intentTier(row.intent_score ?? 0);
                    const accent = isIsacCompanies ? tier.c : C.apollo;
                    const cKey = row.domain ?? row.name;
                    return (
                      <TableRow key={`${row.domain ?? row.name}-${i}`} hover selected={selected.has(rowKey(row))}>
                        <TableCell padding="checkbox">
                          <Checkbox size="small" checked={selected.has(rowKey(row))} onChange={() => toggleSel(rowKey(row))} />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                            <Box sx={{ width: 30, height: 30, borderRadius: "8px", flexShrink: 0, bgcolor: `${accent}14`, color: accent,
                              display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold }}>
                              {rowInitials(row.name)}
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography noWrap {...linkProps(row.id ? isacPath(`/companies/${row.id}`) : null)}
                                sx={{ fontFamily: F, ...ROW.primary, color: row.id ? C.orange : C.text,
                                cursor: row.id ? "pointer" : "default", "&:hover": row.id ? { textDecoration: "underline" } : {},
                                "&:focus-visible": { outline: `2px solid ${C.orange}`, outlineOffset: 2, borderRadius: "2px" } }}>{row.name}</Typography>
                              <Typography noWrap sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub }}>{row.domain ?? ""}</Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        {isIsacCompanies && (
                          <TableCell>
                            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 0.9, py: 0.3, borderRadius: "6px", bgcolor: `${tier.c}12` }}>
                              <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: tier.c }} />
                              <Typography sx={{ fontFamily: F, ...ROW.number, fontSize: FS.caption, color: tier.c }}>{row.intent_score ?? 0}</Typography>
                              {stage && <Typography noWrap sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: tier.c, opacity: 0.85 }}>· {stage.label}</Typography>}
                            </Box>
                          </TableCell>
                        )}
                        <TableCell sx={{ color: C.sub }}><ClampText text={formatLocation(row.city, row.state, row.country)} /></TableCell>
                        <TableCell align="right">{row.employees?.toLocaleString() ?? "—"}</TableCell>
                        <TableCell sx={{ color: C.sub }}><ClampText text={row.industry} /></TableCell>
                        <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                          {row.source === "apollo" && (imported.has(cKey) ? (
                            inIsacCell(isacPath(`/companies/${imported.get(cKey)}`))
                          ) : (
                            <Tooltip title="Import as a net-new ISAC company (flows into scoring, audiences, enrichment)" arrow>
                              <span>
                                <Button size="small" variant="outlined" disabled={importing !== null}
                                  startIcon={importing === cKey ? <CircularProgress size={11} /> : <Plus size={13} />}
                                  onClick={() => importCompany(row)}
                                  sx={{ textTransform: "none", fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, borderRadius: "6px", py: 0.25 }}>
                                  Add to ISAC
                                </Button>
                              </span>
                            </Tooltip>
                          ))}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 0, flex: 1, overflow: "auto" }}>
              <Table stickyHeader size="small" sx={{ tableLayout: "fixed", "& .MuiTableCell-root": { fontFamily: F, fontSize: FS.small } }}>
                <TableHead>
                  <TableRow sx={{ "& th": { ...LABEL, color: C.sub, bgcolor: C.card } }}>
                    <TableCell padding="checkbox" sx={{ bgcolor: C.card }}>
                      <Checkbox size="small" checked={allSelectedOnPage}
                        indeterminate={selected.size > 0 && !allSelectedOnPage} onChange={toggleSelectAll} />
                    </TableCell>
                    <TableCell sx={{ width: "20%" }}>Name</TableCell>
                    <TableCell sx={{ width: "20%" }}>Title</TableCell>
                    <TableCell sx={{ width: "17%" }}>Company</TableCell>
                    <TableCell sx={{ width: "17%" }}>Location</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(result.items as PersonRow[]).map((row, i) => {
                    const name = [row.first_name, row.last_name].filter(Boolean).join(" ");
                    const pKey = personKey(row);
                    return (
                      <TableRow key={`${row.id ?? pKey ?? i}`} hover selected={selected.has(rowKey(row))}>
                        <TableCell padding="checkbox">
                          <Checkbox size="small" checked={selected.has(rowKey(row))} onChange={() => toggleSel(rowKey(row))} />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                            <Box sx={{ width: 30, height: 30, borderRadius: "8px", flexShrink: 0, bgcolor: `${C.blue}14`, color: C.blue,
                              display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold }}>
                              {rowInitials(name || (row.email ?? "?"))}
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography noWrap {...linkProps(row.id ? isacPath(`/leads/${row.id}`) : null)}
                                sx={{ fontFamily: F, ...ROW.primary, color: row.id ? C.orange : C.text,
                                cursor: row.id ? "pointer" : "default", "&:hover": row.id ? { textDecoration: "underline" } : {},
                                "&:focus-visible": { outline: `2px solid ${C.orange}`, outlineOffset: 2, borderRadius: "2px" } }}>{name || "—"}</Typography>
                              {row.seniority && <Typography noWrap sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub, textTransform: "capitalize" }}>{row.seniority.replace("_", "-")}</Typography>}
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell><ClampText text={row.job_title} lines={2} /></TableCell>
                        <TableCell sx={{ color: C.sub }}><ClampText text={row.company_name} /></TableCell>
                        <TableCell sx={{ color: C.sub }}><ClampText text={formatLocation(row.city, row.state, row.country)} /></TableCell>
                        <TableCell sx={{ color: C.sub }}><ClampText text={row.email ?? (row.source === "apollo" ? "via reveal" : null)} /></TableCell>
                        <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                          {row.source === "apollo" && (promoted.has(pKey) ? (
                            inIsacCell(promoted.get(pKey) ? isacPath(`/leads/${promoted.get(pKey)}`) : null)
                          ) : (
                            <Tooltip title="Reveal + enrich (Apollo + ZoomInfo) and add to ISAC as a prospect — spends credits" arrow>
                              <span>
                                <Button size="small" variant="outlined" disabled={promoting !== null}
                                  startIcon={promoting === pKey ? <CircularProgress size={11} /> : <Plus size={13} />}
                                  onClick={() => promotePerson(row)}
                                  sx={{ textTransform: "none", fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, borderRadius: "6px", py: 0.25 }}>
                                  Add to ISAC
                                </Button>
                              </span>
                            </Tooltip>
                          ))}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
        {result && result.items.length > 0 && (
          <ListFooter page={page} totalPages={totalPages} total={result.total} noun={tab}
            onPage={(p) => runSearch(p)} disabled={loading} />
        )}
      </Box>

      {/* Save-to-Apollo list name prompt */}
      <Dialog open={listDialogOpen} onClose={() => !savingList && setListDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontFamily: F, fontSize: FS.reading, fontWeight: FW.semibold }}>Save to Apollo list</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.sub, mb: 1.5 }}>
            Saves every company matching the current filters (up to 1,000) into a named
            Apollo account list. Free — no credits consumed.
          </Typography>
          <TextField autoFocus fullWidth size="small" label="List name" value={listName}
            onChange={(e) => setListName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && listName.trim() && !savingList) saveApolloList(); }}
            placeholder="e.g. APAC integration prospects — Aug 2026"
            slotProps={{ htmlInput: { maxLength: 120 } }} />
          {savingList && progress && (
            <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.apollo, fontWeight: FW.semibold, mt: 1.5 }}>
              {progress}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button size="small" disabled={savingList} onClick={() => setListDialogOpen(false)}
            sx={{ textTransform: "none", fontFamily: F }}>Cancel</Button>
          <Button size="small" variant="contained" disabled={!listName.trim() || savingList} onClick={saveApolloList}
            startIcon={savingList ? <CircularProgress size={12} sx={{ color: "#fff" }} /> : <ListPlus size={13} />}
            sx={{ textTransform: "none", fontFamily: F, fontWeight: FW.semibold, bgcolor: C.apollo, "&:hover": { bgcolor: "#57389e" } }}>
            {savingList ? "Saving…" : "Save list"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Add & enrich from Apollo — spends credits, so confirm first */}
      <Dialog open={bulkConfirm} onClose={() => setBulkConfirm(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontFamily: F, fontSize: FS.reading, fontWeight: FW.semibold }}>Add &amp; enrich in ISAC?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontFamily: F, fontSize: FS.body, color: C.text }}>
            This will {tab === "companies" ? "import + enrich" : "reveal + enrich + add"} <b>{runCount}</b> {tab === "companies" ? "companies" : "people"} into
            ISAC via Apollo/ZoomInfo — spending roughly <b>up to {estCredits} credits</b>.
            {selected.size > BULK_APOLLO_CAP && ` Only the first ${BULK_APOLLO_CAP} selected will run.`}
          </Typography>
          <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.sub, mt: 1 }}>
            Already-fresh records are skipped by the 30-day cooldown and won't be re-charged. Keep this tab open until it finishes.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button size="small" onClick={() => setBulkConfirm(false)} sx={{ textTransform: "none", fontFamily: F }}>Cancel</Button>
          <Button size="small" variant="contained" disableElevation onClick={confirmApolloBulk}
            sx={{ textTransform: "none", fontFamily: F, fontWeight: FW.semibold, bgcolor: C.apollo, "&:hover": { bgcolor: "#57389e" } }}>
            Add &amp; enrich {runCount}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!msg} autoHideDuration={6000} onClose={() => setMsg(null)} message={msg}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }} />
    </Box>
  );
}
