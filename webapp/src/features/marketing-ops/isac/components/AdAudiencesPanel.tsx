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

import { Add as AddIcon } from "../icons";
import { DeleteOutline as DeleteOutlineIcon } from "../icons";
import { FileDownload as FileDownloadIcon } from "../icons";
import { Campaign as CampaignIcon } from "../icons";
import { PauseCircleOutline as PauseCircleOutlineIcon } from "../icons";
import { PlayCircleOutline as PlayCircleOutlineIcon } from "../icons";
import { Sync as SyncIcon } from "../icons";
import {
  Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControlLabel, MenuItem, Select, Snackbar,
  TextField, Tooltip, Typography,
} from "@wso2/oxygen-ui";
import { useCallback, useEffect, useState } from "react";
import { useApiClient } from "../api/client";
import { C, F } from "../theme/pageTokens";
import { FS, FW } from "../theme/typeScale";
import { isacPath } from "../paths";

const REGIONS = ["APAC", "Europe", "North America", "Latin America", "Africa", "Middle East"];
const LEAD_STAGES = ["subscriber", "lead", "mql", "sql", "opportunity"];
const PRODUCTS = ["WSO2 API Platform", "WSO2 Identity Platform", "WSO2 Integration Platform"];

/** One LinkedIn ad audience as served by GET /ad-audiences. */
interface AdAudience {
  id: number; name: string; source: string; status: string;
  li_segment_id: string | null; company_count: number;
  matched_count: number | null; last_pushed_at: string | null;
  last_error: string | null; created_at: string | null;
  eligible_now?: number; filter?: Record<string, unknown> | null;
}

/** Response of GET /ad-audiences. */
interface AudiencesResponse {
  items: AdAudience[];
  pipeline_eligible_now: number;
  entity_service_enabled: boolean;
}

/** One company row from GET /ad-audiences/{id}/companies. */
interface AudienceCompanyRow {
  id: number; name: string; domain: string | null; region: string | null;
  country: string | null; linkedin_url: string | null; industry: string | null;
  employees: number | null; city: string | null; state: string | null;
}

/** Stat block inside an audience card. */
function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Box>
      <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.sub, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</Typography>
      <Typography sx={{ fontFamily: F, fontSize: FS.title, fontWeight: FW.bold, color: C.text }}>{value}</Typography>
    </Box>
  );
}

/** Human-readable summary of a saved audience filter. */
function filterSummary(a: AdAudience): string {
  if (a.source === "pipeline") return "SF pipeline: lifecycle = Prospect, not lost (auto rule)";
  const f = a.filter ?? {};
  const parts: string[] = [a.source === "leads" ? "Leads" : "Companies"];
  if (f.product) parts.push(String(f.product).replace("WSO2 ", ""));
  if (f.lead_stage) parts.push(`stage ${String(f.lead_stage).toUpperCase()}`);
  if (f.lead_source) parts.push(`source ${String(f.lead_source)}`);
  if (f.lifecycle) parts.push(`lifecycle ${String(f.lifecycle)}`);
  if (f.net_new) parts.push("net-new only");
  if (f.region) parts.push(String(f.region));
  if (f.country) parts.push(String(f.country));
  if (f.created_from || f.created_to) parts.push(`created ${String(f.created_from ?? "…")} – ${String(f.created_to ?? "…")}`);
  return parts.join(" · ");
}

/**
 * LinkedIn Ad Audiences — filter-defined audiences mirrored into LinkedIn DMP
 * segments: per-audience eligible/pushed/matched counts, push, pause/resume,
 * and a create dialog (BU/region/stage-style filters on leads or companies).
 */
export default function AdAudiencesPanel() {
  const { get, request } = useApiClient();
  const [data, setData] = useState<AudiencesResponse | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<number | "pipeline" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdAudience | null>(null);
  const [companiesFor, setCompaniesFor] = useState<number | null>(null);
  const [companiesWhich, setCompaniesWhich] = useState<"eligible" | "pushed">("eligible");
  const [companies, setCompanies] = useState<{ total: number; items: AudienceCompanyRow[] } | null>(null);
  const [companiesError, setCompaniesError] = useState(false);
  const [draft, setDraft] = useState<{ name: string; source: "companies" | "leads";
    region: string; country: string; lifecycle: string; lead_stage: string;
    lead_source: string; net_new: boolean; created_from: string; created_to: string;
    product: string }>({
    name: "", source: "companies", region: "", country: "", lifecycle: "",
    lead_stage: "", lead_source: "", net_new: false, created_from: "", created_to: "",
    product: "",
  });

  const load = useCallback(() => {
    get<AudiencesResponse>("/ad-audiences")
      .then((d) => { setData(d); setLoadError(false); })
      .catch(() => setLoadError(true));
  }, [get]);
  useEffect(() => { load(); }, [load]);

  const createSegment = async (a: AdAudience) => {
    setBusyId(a.id);
    try {
      await request("post", `/ad-audiences/${a.id}/segment`);
      setMsg("LinkedIn segment created — now click 'Push members' to send the company list.");
    } catch {
      setMsg("Segment creation failed — see the audience's error line.");
    } finally { setBusyId(null); load(); }
  };

  const pushAudience = async (a: AdAudience | null) => {
    setBusyId(a ? a.id : "pipeline");
    const path = a ? `/ad-audiences/${a.id}/push` : "/ad-audiences/pipeline/push";
    try {
      const r = await request<{ status: string; added?: number; removed?: number; companies?: number }>("post", path);
      setMsg(r.status === "paused"
        ? "Audience is paused — resume it first."
        : `Pushed to LinkedIn — ${r.companies ?? 0} companies (+${r.added ?? 0} / −${r.removed ?? 0}).`);
    } catch {
      setMsg("Push failed — see the audience's error line.");
    } finally { setBusyId(null); load(); }
  };

  const toggleStatus = async (a: AdAudience) => {
    const next = a.status === "paused" ? "active" : "paused";
    try {
      await request("put", `/ad-audiences/${a.id}/status`, { status: next });
      setMsg(next === "paused" ? "Audience paused — the daily sync will skip it." : "Audience resumed.");
    } catch { setMsg("Could not change the audience status."); }
    load();
  };

  const createAudience = async () => {
    const filter: Record<string, unknown> = {};
    if (draft.region) filter.region = draft.region;
    if (draft.country) filter.country = draft.country;
    if (draft.product) filter.product = draft.product;
    if (draft.source === "companies") {
      if (draft.lifecycle) filter.lifecycle = draft.lifecycle;
      if (draft.net_new) filter.net_new = true;
    } else {
      if (draft.lead_stage) filter.lead_stage = draft.lead_stage;
      if (draft.lead_source) filter.lead_source = draft.lead_source;
      if (draft.created_from) filter.created_from = draft.created_from;
      if (draft.created_to) filter.created_to = draft.created_to;
    }
    try {
      const r = await request<AdAudience>("post", "/ad-audiences",
        { name: draft.name, source: draft.source, filter });
      setMsg(`Audience created — ${r.eligible_now ?? 0} companies eligible. Push it to create the LinkedIn segment.`);
      setCreateOpen(false);
      setDraft({ ...draft, name: "" });
    } catch { setMsg("Could not create the audience (name in use, or invalid filter)."); }
    load();
  };

  const showCompanies = (a: AdAudience, which: "eligible" | "pushed") => {
    if (companiesFor === a.id && companiesWhich === which) { setCompaniesFor(null); return; }
    setCompaniesFor(a.id); setCompaniesWhich(which); setCompanies(null); setCompaniesError(false);
    get<NonNullable<typeof companies>>(`/ad-audiences/${a.id}/companies?which=${which}&limit=100`)
      .then(setCompanies).catch(() => setCompaniesError(true));
  };

  const downloadCsv = async (a: AdAudience, which: "eligible" | "pushed", format: "isac" | "linkedin") => {
    try {
      const r = await get<{ total: number; items: AudienceCompanyRow[] }>(`/ad-audiences/${a.id}/companies?which=${which}&limit=0`);
      const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      let header: string;
      let rows: string[];
      if (format === "linkedin") {
        // LinkedIn Campaign Manager company match template (exact header row) — this
        // file can be uploaded manually as a Matched Audience (Plan > Audiences > Upload a list).
        header = "companyname,companywebsite,companyemaildomain,linkedincompanypageurl,stocksymbol,industry,city,state,companycountry,zipcode";
        rows = r.items.map((c) => [c.name, c.domain, c.domain, c.linkedin_url, "", c.industry, c.city, c.state, c.country, ""].map(cell).join(","));
      } else {
        header = "Company,Domain,LinkedIn Page,Industry,Employees,City,State,Country,Region";
        rows = r.items.map((c) => [c.name, c.domain, c.linkedin_url, c.industry, c.employees, c.city, c.state, c.country, c.region].map(cell).join(","));
      }
      const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const el = document.createElement("a");
      const slug = a.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "audience";
      el.href = url;
      el.download = `${slug}-${which}${format === "linkedin" ? "-linkedin-upload" : ""}-${r.items.length}.csv`;
      el.click();
      // revoking immediately can abort the download in some browsers
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setMsg(`Downloaded ${r.items.length} companies as CSV.`);
    } catch { setMsg("CSV export failed — try again."); }
  };

  const deleteAudience = async () => {
    if (!deleteTarget) return;
    try {
      await request("delete", `/ad-audiences/${deleteTarget.id}`);
      setMsg(`Audience "${deleteTarget.name}" deleted${deleteTarget.li_segment_id ? " (LinkedIn segment removed)" : ""}.`);
    } catch {
      setMsg("Delete failed — if the segment is attached to a campaign, detach it in Campaign Manager first.");
    }
    setDeleteTarget(null);
    load();
  };

  const fmtWhen = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "never");
  const fieldSx = { "& .MuiInputBase-root": { fontFamily: F, fontSize: FS.body }, "& .MuiInputLabel-root": { fontFamily: F, fontSize: FS.body } };
  const itemSx = { fontFamily: F, fontSize: FS.body };

  return (
    <Box sx={{ p: 2.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
        <CampaignIcon sx={{ fontSize: 18, color: C.linkedin }} />
        <Typography sx={{ fontFamily: F, fontSize: FS.reading, fontWeight: FW.semibold, color: C.text }}>
          LinkedIn Ad Audiences
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button size="small" variant="outlined" startIcon={<AddIcon sx={{ fontSize: 15 }} />}
          onClick={() => setCreateOpen(true)}
          sx={{ textTransform: "none", fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, borderRadius: "7px", borderColor: C.border, color: C.text, "&:hover": { borderColor: C.orange, color: C.orange } }}>
          New audience
        </Button>
      </Box>

      {loadError && !data ? (
        <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.red, py: 2 }}>
          Could not load ad audiences — retry from the browser or check the backend.
        </Typography>
      ) : !data ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={22} sx={{ color: C.orange }} /></Box>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {data.items.length === 0 && (
            <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.sub }}>
              No audiences yet — create one from a leads/companies filter, or push the pipeline audience below.
            </Typography>
          )}
          {data.items.map((a) => (
            <Box key={a.id} sx={{ p: 2, borderRadius: "10px", border: `1px solid ${C.border}`, bgcolor: C.panel }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <SyncIcon sx={{ fontSize: 15, color: C.orange }} />
                <Typography sx={{ fontFamily: F, fontSize: FS.body, fontWeight: FW.semibold, color: C.text }}>{a.name}</Typography>
                <Chip size="small" label={a.status === "paused" ? "PAUSED" : "ACTIVE"}
                  sx={{ fontFamily: F, height: 20, fontSize: FS.caption, fontWeight: FW.semibold,
                        bgcolor: a.status === "paused" ? `${C.amber}14` : `${C.green}14`,
                        color: a.status === "paused" ? C.amber : C.green }} />
                {(a.eligible_now ?? 0) > 0 && (a.eligible_now ?? 0) < 300 && (
                  <Tooltip title="LinkedIn will not serve audiences under ~300 matched companies" arrow>
                    <Chip size="small" label="BELOW 300 FLOOR"
                      sx={{ fontFamily: F, height: 20, fontSize: FS.micro, fontWeight: FW.semibold, bgcolor: `${C.amber}14`, color: C.amber }} />
                  </Tooltip>
                )}
                <Box sx={{ flex: 1 }} />
                <Tooltip title={a.status === "paused" ? "Resume — daily sync updates it again" : "Pause — daily sync will skip it"} arrow>
                  <Button size="small" onClick={() => toggleStatus(a)}
                    startIcon={a.status === "paused" ? <PlayCircleOutlineIcon sx={{ fontSize: 15 }} /> : <PauseCircleOutlineIcon sx={{ fontSize: 15 }} />}
                    sx={{ textTransform: "none", fontFamily: F, fontSize: FS.small, color: C.sub }}>
                    {a.status === "paused" ? "Resume" : "Pause"}
                  </Button>
                </Tooltip>
                {!a.li_segment_id ? (
                  <Tooltip title="Step 1: create the (empty) Matched Audience segment on LinkedIn" arrow>
                    <Button variant="outlined" size="small"
                      disabled={busyId !== null || !data.entity_service_enabled}
                      startIcon={busyId === a.id ? <CircularProgress size={13} /> : <AddIcon sx={{ fontSize: 14 }} />}
                      onClick={() => createSegment(a)}
                      sx={{ textTransform: "none", fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, borderRadius: "7px", borderColor: C.linkedin, color: C.linkedin }}>
                      Create segment
                    </Button>
                  </Tooltip>
                ) : (
                  <Tooltip title="Step 2: push the current company list (diff) into the segment" arrow>
                    <Button variant="contained" size="small" disableElevation
                      disabled={busyId !== null || !data.entity_service_enabled}
                      startIcon={busyId === a.id ? <CircularProgress size={13} sx={{ color: "#fff" }} /> : <SyncIcon sx={{ fontSize: 14 }} />}
                      onClick={() => pushAudience(a)}
                      sx={{ textTransform: "none", fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, borderRadius: "7px", bgcolor: C.linkedin, "&:hover": { bgcolor: "#004182" } }}>
                      Push members
                    </Button>
                  </Tooltip>
                )}
                <Tooltip title="Delete this audience (removes the LinkedIn segment too)" arrow>
                  <Button size="small" onClick={() => setDeleteTarget(a)} aria-label={`Delete audience ${a.name}`}
                    sx={{ textTransform: "none", fontFamily: F, minWidth: 0, px: 0.75, color: C.dim, "&:hover": { color: C.red } }}>
                    <DeleteOutlineIcon sx={{ fontSize: 17 }} />
                  </Button>
                </Tooltip>
              </Box>
              <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.sub, mt: 0.5 }}>{filterSummary(a)}</Typography>
              <Box sx={{ display: "flex", gap: 4, mt: 1.25 }}>
                <Box component="button" type="button" onClick={() => showCompanies(a, "eligible")}
                  aria-label="Show companies matching the filter"
                  sx={{ cursor: "pointer", border: 0, bgcolor: "transparent", p: 0, textAlign: "left", "&:hover": { opacity: 0.7 }, "&:focus-visible": { outline: `2px solid ${C.orange}` } }}>
                  <Stat label="Eligible now ▾" value={a.eligible_now ?? "—"} />
                </Box>
                <Box component="button" type="button" onClick={() => showCompanies(a, "pushed")}
                  aria-label="Show companies pushed to LinkedIn"
                  sx={{ cursor: "pointer", border: 0, bgcolor: "transparent", p: 0, textAlign: "left", "&:hover": { opacity: 0.7 }, "&:focus-visible": { outline: `2px solid ${C.orange}` } }}>
                  <Stat label="Pushed ▾" value={a.company_count ?? 0} />
                </Box>
                <Stat label="Matched by LinkedIn" value={a.matched_count ?? "—"} />
                <Stat label="Last push" value={fmtWhen(a.last_pushed_at)} />
              </Box>
              {companiesFor === a.id && (
                <Box sx={{ mt: 1.25, p: 1.25, borderRadius: "8px", bgcolor: C.card, border: `1px solid ${C.border}` }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.75 }}>
                    <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.sub, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {companiesWhich === "eligible" ? "Companies matching the filter now" : "Companies currently pushed to LinkedIn"}
                      {companies ? ` — ${companies.total}` : ""}
                    </Typography>
                    <Box sx={{ flex: 1 }} />
                    <Tooltip title="Download the full company list as CSV" arrow>
                      <span>
                        <Button size="small" disabled={!companies || companies.total === 0}
                          startIcon={<FileDownloadIcon sx={{ fontSize: 13 }} />}
                          onClick={() => downloadCsv(a, companiesWhich, "isac")}
                          sx={{ textTransform: "none", fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.sub, minWidth: 0, px: 0.75 }}>
                          CSV
                        </Button>
                      </span>
                    </Tooltip>
                    <Tooltip title="LinkedIn Campaign Manager upload template — add it manually as a Matched Audience company list (no API push needed)" arrow>
                      <span>
                        <Button size="small" disabled={!companies || companies.total === 0}
                          startIcon={<FileDownloadIcon sx={{ fontSize: 13 }} />}
                          onClick={() => downloadCsv(a, companiesWhich, "linkedin")}
                          sx={{ textTransform: "none", fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.linkedin, minWidth: 0, px: 0.75 }}>
                          LinkedIn CSV
                        </Button>
                      </span>
                    </Tooltip>
                  </Box>
                  {companiesError ? (
                    <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.red }}>
                      Could not load the company list — try again.
                    </Typography>
                  ) : !companies ? (
                    <CircularProgress size={16} sx={{ color: C.orange }} />
                  ) : companies.items.length === 0 ? (
                    <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.dim }}>
                      {companiesWhich === "eligible"
                        ? "Nothing matches this filter in the current data — widen the filter (note: this environment may hold only a subset of leads)."
                        : "Nothing pushed yet — click Create & push first."}
                    </Typography>
                  ) : (
                    <Box sx={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 0.25 }}>
                      {companies.items.map((c) => (
                        <Box key={c.id} component="a" href={isacPath(`/companies/${c.id}`)} target="_blank" rel="noopener noreferrer"
                          sx={{ display: "flex", gap: 1, textDecoration: "none", fontFamily: F, fontSize: FS.small, py: 0.25, "&:hover": { bgcolor: `${C.orange}08` } }}>
                          <Typography sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: C.text, minWidth: 220 }} noWrap>{c.name}</Typography>
                          <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.sub }} noWrap>{c.domain ?? ""}</Typography>
                          <Box sx={{ flex: 1 }} />
                          <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.dim }} noWrap>{c.region ?? c.country ?? ""}</Typography>
                        </Box>
                      ))}
                      {companies.total > companies.items.length && (
                        <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.dim, mt: 0.5 }}>
                          Showing first {companies.items.length} of {companies.total}.
                        </Typography>
                      )}
                    </Box>
                  )}
                </Box>
              )}
              {a.last_error && (
                <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.red, mt: 1 }}>Last error: {a.last_error}</Typography>
              )}
            </Box>
          ))}

          {!data.items.some((a) => a.source === "pipeline") && (
            <Box sx={{ p: 2, borderRadius: "10px", border: `1px dashed ${C.border}`, bgcolor: C.card }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography sx={{ fontFamily: F, fontSize: FS.body, color: C.sub, flex: 1 }}>
                  Rolling <b>SF pipeline</b> audience (lifecycle = Prospect) — {data.pipeline_eligible_now} companies eligible
                </Typography>
                <Button variant="outlined" size="small" disabled={busyId !== null || !data.entity_service_enabled}
                  startIcon={busyId === "pipeline" ? <CircularProgress size={13} /> : <SyncIcon sx={{ fontSize: 14 }} />}
                  onClick={() => pushAudience(null)}
                  sx={{ textTransform: "none", fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, borderRadius: "7px", borderColor: C.linkedin, color: C.linkedin }}>
                  Create & push
                </Button>
              </Box>
            </Box>
          )}

          {!data.entity_service_enabled && (
            <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.amber }}>
              Entity service is not configured — pushes are disabled in this environment.
            </Typography>
          )}
        </Box>
      )}

      {/* ── Create dialog ── */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontFamily: F, fontSize: FS.reading, fontWeight: FW.semibold }}>New ad audience</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 1.5, pt: "8px !important" }}>
          <TextField size="small" label="Name" value={draft.name} sx={fieldSx}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <Select size="small" value={draft.source} sx={{ fontFamily: F, fontSize: FS.body }}
            onChange={(e) => setDraft({ ...draft, source: e.target.value as "companies" | "leads" })}>
            <MenuItem value="companies" sx={itemSx}>Companies (filter accounts directly)</MenuItem>
            <MenuItem value="leads" sx={itemSx}>Leads (their companies enter the audience)</MenuItem>
          </Select>
          <Select size="small" value={draft.region} displayEmpty sx={{ fontFamily: F, fontSize: FS.body }}
            onChange={(e) => setDraft({ ...draft, region: e.target.value })}>
            <MenuItem value="" sx={itemSx}>Any region</MenuItem>
            {REGIONS.map((r) => <MenuItem key={r} value={r} sx={itemSx}>{r}</MenuItem>)}
          </Select>
          <Select size="small" value={draft.product} displayEmpty sx={{ fontFamily: F, fontSize: FS.body }}
            onChange={(e) => setDraft({ ...draft, product: e.target.value })}>
            <MenuItem value="" sx={itemSx}>Any business unit</MenuItem>
            {PRODUCTS.map((pr) => <MenuItem key={pr} value={pr} sx={itemSx}>{pr.replace("WSO2 ", "")} — G2 intent</MenuItem>)}
          </Select>
          {draft.source === "companies" ? (<>
            <Select size="small" value={draft.lifecycle} displayEmpty sx={{ fontFamily: F, fontSize: FS.body }}
              onChange={(e) => setDraft({ ...draft, lifecycle: e.target.value })}>
              <MenuItem value="" sx={itemSx}>Any lifecycle</MenuItem>
              <MenuItem value="Prospect" sx={itemSx}>Prospect (pipeline)</MenuItem>
              <MenuItem value="Customer" sx={itemSx}>Customer</MenuItem>
            </Select>
            <FormControlLabel control={<Checkbox size="small" checked={draft.net_new}
              onChange={(e) => setDraft({ ...draft, net_new: e.target.checked })} />}
              label={<Typography sx={{ fontFamily: F, fontSize: FS.body }}>Net-new companies only</Typography>} />
          </>) : (<>
            <Select size="small" value={draft.lead_stage} displayEmpty sx={{ fontFamily: F, fontSize: FS.body }}
              onChange={(e) => setDraft({ ...draft, lead_stage: e.target.value })}>
              <MenuItem value="" sx={itemSx}>Any stage</MenuItem>
              {LEAD_STAGES.map((s) => <MenuItem key={s} value={s} sx={itemSx}>{s.toUpperCase()}</MenuItem>)}
            </Select>
            <TextField size="small" label="Lead source (e.g. reo.dev)" value={draft.lead_source} sx={fieldSx}
              onChange={(e) => setDraft({ ...draft, lead_source: e.target.value })} />
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <TextField size="small" type="date" value={draft.created_from} sx={{ ...fieldSx, flex: 1 }}
                inputProps={{ "aria-label": "Created from" }}
                onChange={(e) => setDraft({ ...draft, created_from: e.target.value })} />
              <Typography sx={{ fontFamily: F, color: C.dim }}>–</Typography>
              <TextField size="small" type="date" value={draft.created_to} sx={{ ...fieldSx, flex: 1 }}
                inputProps={{ "aria-label": "Created to" }}
                onChange={(e) => setDraft({ ...draft, created_to: e.target.value })} />
            </Box>
          </>)}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} sx={{ textTransform: "none", fontFamily: F }}>Cancel</Button>
          <Button variant="contained" disableElevation disabled={!draft.name.trim()} onClick={createAudience}
            sx={{ textTransform: "none", fontFamily: F, fontWeight: FW.semibold, bgcolor: C.orange, "&:hover": { bgcolor: C.orangeDark } }}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontFamily: F, fontSize: FS.reading, fontWeight: FW.semibold }}>Delete audience?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontFamily: F, fontSize: FS.body, color: C.text }}>
            "{deleteTarget?.name}" will be removed from ISAC
            {deleteTarget?.li_segment_id ? " and its Matched Audience segment will be deleted on LinkedIn" : ""}.
            Ads using the segment stop targeting it. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} sx={{ textTransform: "none", fontFamily: F }}>Cancel</Button>
          <Button variant="contained" disableElevation onClick={deleteAudience}
            sx={{ textTransform: "none", fontFamily: F, fontWeight: FW.semibold, bgcolor: C.red, "&:hover": { bgcolor: C.red } }}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!msg} autoHideDuration={6000} onClose={() => setMsg(null)} message={msg}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }} />
    </Box>
  );
}
