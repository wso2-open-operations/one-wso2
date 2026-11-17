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

import { ArrowBack as ArrowBackIcon } from "../icons";
import { Bolt as BoltIcon } from "../icons";
import { CloudUpload as CloudUploadIcon } from "../icons";
import { ExpandMore as ExpandMoreIcon } from "../icons";
import { Launch as LaunchIcon } from "../icons";
import { LinkedIn as LinkedInIcon } from "../icons";
import { GitHub as GitHubIcon } from "../icons";
import { CheckCircle as CheckCircleIcon } from "../icons";
import { SwapHoriz as SwapHorizIcon } from "../icons";
import { AddCircleOutline as AddCircleOutlineIcon } from "../icons";
import { NotificationsActive as NotificationsActiveIcon } from "../icons";
import { NotificationsNone as NotificationsNoneIcon } from "../icons";
import {
  Accordion, AccordionDetails, AccordionSummary,
  Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider,
  IconButton, LinearProgress, Paper, Snackbar,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Tooltip, Typography,
} from "@wso2/oxygen-ui";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { CompanyContactsResponse, CompanyEnrichmentRecord, CompanyEngagement, CompanyProfile, EngagementCampaign, FollowStatus, ReoCompanyData, useApiClient } from "../api/client";
import { isacPath, sfRecordUrl } from "../paths";
import CompanyContactsPanel from "../components/CompanyContactsPanel";
import DataTable, { ColumnDef } from "../components/DataTable";
import { C, F } from "../theme/pageTokens";
import { FS, FW, LABEL } from "../theme/typeScale";

// ── Font ─────────────────────────────────────────────────────────────────────
// ── Palette (matches Companies page) ────────────────────────────────────────

const SOURCE_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  apollo:   { bg: "#6366f110", fg: "#6366f1", label: "Apollo" },
  zoominfo: { bg: "#06b6d410", fg: "#06b6d4", label: "ZoomInfo" },
  ai:       { bg: "#8b5cf610", fg: "#8b5cf6", label: "AI" },
  g2:       { get bg() { return `${C.orange}10`; }, get fg() { return C.orange; }, label: "G2" },
  "reo.dev": { bg: "#6b4fbb10", fg: "#6b4fbb", label: "Reo.dev" },
};

// Hand-built contact/lead tables: header and rows share ONE column template,
// gap and padding so header labels sit exactly over their cells. Chip columns
// (stretched chips, centred label) get centred headers.
const COLS_LEADS = "1fr 1fr 1.2fr 110px 70px";
const COLS_PREVIEW = "36px 130px 1fr 28px 1fr 70px";
const COLS_DISCOVER = "36px 1fr 1fr 80px";
const TABLE_HEAD_ROW = { gap: 1, px: 2, py: 0.6, alignItems: "center" } as const;
const TABLE_ROW = { gap: 1, px: 2, py: 0.7, alignItems: "center" } as const;

/** Reo developer-adoption funnel stage → color (Exploring → Evaluating → Building → Deployed). */
const REO_FUNNEL_COLORS: Record<string, string> = {
  exploring: C.slate, evaluating: C.amber, get building() { return C.orange; }, deployed: C.green,
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtRev(v?: number | null) {
  if (!v) return null;
  return v >= 1e9 ? `$${(v/1e9).toFixed(1)}B` : v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v/1e3).toFixed(0)}K` : `$${v}`;
}
function fmtEmp(v?: number | null, r?: string | null) { return v ? v.toLocaleString() : r || null; }

// Which enrichment source provided a field?
function fieldSource(enrichments: CompanyEnrichmentRecord[], fieldName: string): string | null {
  // Return the source that provided this field, by a fixed provider priority
  // (not the stored confidence value): apollo > zoominfo > ai > reo.dev.
  const order = ["apollo", "zoominfo", "ai", "reo.dev"];
  for (const src of order) {
    const e = enrichments.find(r => r.source === src && r.status === "success" && r.provided_fields.includes(fieldName));
    if (e) return src;
  }
  return null;
}

// ── Source badge (tiny inline tag showing where data came from) ─────────────
function SourceTag({ source }: { source: string | null }) {
  if (!source) return null;
  const s = SOURCE_COLORS[source] || { bg: `${C.dim}15`, fg: C.dim, label: source };
  return (
    <Tooltip title={`Enriched from ${s.label}`} placement="top" arrow>
      <Box component="span" sx={{
        display: "inline-flex", px: 0.5, py: 0.05, borderRadius: "3px", ml: 0.5,
        bgcolor: s.bg, border: `1px solid ${s.fg}20`,
        fontFamily: F, fontSize: FS.micro, fontWeight: FW.semibold, color: s.fg,
        letterSpacing: "0.02em", verticalAlign: "middle", cursor: "help",
      }}>
        {s.label}
      </Box>
    </Tooltip>
  );
}

// ── Data row with optional source attribution ───────────────────────────────
function DataRow({ label, value, source }: { label: string; value?: string | number | null; source?: string | null }) {
  if (!value && value !== 0) return null;
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, py: 0.4, "&:not(:last-child)": { borderBottom: `1px solid ${C.borderSoft}` } }}>
      <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.sub, minWidth: 110, fontWeight: FW.medium }}>
        {label}
      </Typography>
      <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.text, fontWeight: FW.medium, flex: 1 }}>
        {String(value)}
      </Typography>
      {source && <SourceTag source={source} />}
    </Box>
  );
}

// ── Metric card ─────────────────────────────────────────────────────────────
function MetricCard({ label, value, color, sub: subtitle }: { label: string; value: string | number; color: string; sub?: string }) {
  return (
    <Box sx={{
      p: 1.5, borderRadius: "10px", bgcolor: C.panel,
      border: `1px solid ${C.border}`, minWidth: 0,
    }}>
      <Typography sx={{ fontFamily: F, fontSize: FS.title, fontWeight: FW.bold, color, lineHeight: 1.2 }}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </Typography>
      <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.sub, textTransform: "uppercase", letterSpacing: "0.04em", mt: 0.25 }}>
        {label}
      </Typography>
      {subtitle && (
        <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.dim, mt: 0.15 }}>{subtitle}</Typography>
      )}
    </Box>
  );
}

// ── Section wrapper ─────────────────────────────────────────────────────────
function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Box sx={{ p: 2, borderRadius: "10px", border: `1px solid ${C.border}`, bgcolor: C.panel }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
        <Typography sx={{ fontFamily: F, fontSize: FS.body, fontWeight: FW.semibold, color: C.text }}>
          {title}
        </Typography>
        {action}
      </Box>
      {children}
    </Box>
  );
}

// ── Description with See more ───────────────────────────────────────────────
function DescriptionBlock({ text, source }: { text: string; source?: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 150;
  const display = isLong && !expanded ? text.slice(0, 150) + "..." : text;
  return (
    <Box sx={{ mb: 1 }}>
      <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.textMd, lineHeight: 1.6 }}>
        {display}
        {isLong && (
          <Box component="span" onClick={() => setExpanded(!expanded)} sx={{
            color: C.orange, fontWeight: FW.semibold, cursor: "pointer", ml: 0.5,
            "&:hover": { textDecoration: "underline" },
          }}>
            {expanded ? "See less" : "See more"}
          </Box>
        )}
        {source && <SourceTag source={source} />}
      </Typography>
    </Box>
  );
}

// ── Column defs for source data tab ─────────────────────────────────────────
const SF_COLS: ColumnDef<CompanyProfile["sf_accounts"][0]>[] = [
  { key: "sf_account_id", header: "SF ID" }, { key: "account_owner", header: "Owner" },
  { key: "account_record_type", header: "Type" }, { key: "account_life_cycle", header: "Lifecycle" },
  { key: "rating", header: "Rating" }, { key: "billing_state", header: "State" },
  { key: "last_activity", header: "Last Activity" },
];
const CERT_COLS: ColumnDef<CompanyProfile["certifications"][0]>[] = [
  { key: "token", header: "Token" }, { key: "cert_type", header: "Type" },
  { key: "contact_email", header: "Email" },
  { key: "is_awarded", header: "Awarded", render: (r) => r.is_awarded ? "Yes" : "No" },
  { key: "awarded_date", header: "Date" },
];
const LEAD_COLS: ColumnDef<CompanyProfile["pardot_leads"][0]>[] = [
  { key: "email", header: "Email" }, { key: "job_title", header: "Title" },
  { key: "country", header: "Country" }, { key: "source", header: "Source" },
  { key: "grade", header: "Grade" }, { key: "last_activity_at", header: "Last Activity" },
];
const SNAP_COLS: ColumnDef<CompanyProfile["pardot_snapshots"][0]>[] = [
  { key: "snapshot_date", header: "Date" }, { key: "prospects_count", header: "Prospects" },
  { key: "integration_total", header: "Integration" }, { key: "choreo_total", header: "Choreo" },
  { key: "asgardeo_total", header: "Asgardeo" }, { key: "high_intent_page_visit_total", header: "High Intent" },
];
const LI_COLS: ColumnDef<CompanyProfile["linkedin_stats"][0]>[] = [
  { key: "report_date", header: "Date" }, { key: "impressions", header: "Impressions" },
  { key: "clicks", header: "Clicks" }, { key: "total_spent", header: "Spent" },
  { key: "cpc", header: "CPC" }, { key: "ctr", header: "CTR" },
];
const VISIT_COLS: ColumnDef<CompanyProfile["g2_visits"][0]>[] = [
  { key: "visit_date", header: "Date" }, { key: "visit_title", header: "Page" },
  { key: "visit_type", header: "Type" }, { key: "total_pageviews", header: "Views" },
  { key: "visitor_country", header: "Country" },
];
const INTENT_COLS: ColumnDef<CompanyProfile["g2_intent"][0]>[] = [
  { key: "last_seen", header: "Last Seen" }, { key: "buying_stage", header: "Stage" },
  { key: "activity_level", header: "Activity" }, { key: "total_pageviews", header: "Views" },
  { key: "pricing_pageviews", header: "Pricing" }, { key: "comparison_pageviews", header: "Compare" },
];

// ── Engagement tab column defs (rows are given a synthetic `id` index) ───────
type EngProductRow = CompanyEngagement["g2"]["products"][number] & { id: number };
type EngPageRow = CompanyEngagement["g2"]["top_pages"][number] & { id: number };

const ENG_PRODUCT_COLS: ColumnDef<EngProductRow>[] = [
  { key: "product", header: "Product" },
  { key: "pageviews", header: "Views" },
  { key: "buying_stage", header: "Stage", render: (r) => r.buying_stage || "—" },
];
const ENG_PAGE_COLS: ColumnDef<EngPageRow>[] = [
  { key: "date", header: "Date" },
  { key: "title", header: "Page", render: (r) => r.title || "—" },
  { key: "type", header: "Type", render: (r) => r.type || "—" },
  { key: "views", header: "Views" },
];
/** "SPONSORED_UPDATE" → "Sponsored Update" (LinkedIn enum → readable label). */
function prettyAdFormat(v: string | null): string {
  if (!v) return "—";
  return v.toLowerCase().split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/** One expandable table: campaign rows expand in place to show each currently
 * running ad's per-company numbers on their own indented rows. */
function CampaignAdsTable({ campaigns }: { campaigns: EngagementCampaign[] }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [q, setQ] = useState("");
  const [liveOnly, setLiveOnly] = useState(false);
  const toggle = (i: number) => setOpen((cur) => {
    const next = new Set(cur);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });

  // Client-side filter: match the campaign name OR any of its ads' names; the
  // "live ads" toggle keeps only campaigns with running ads. Rows are tracked
  // by their ORIGINAL index so expansion state survives filtering.
  const norm = q.trim().toLowerCase();
  const adMatch = (c: EngagementCampaign) =>
    norm !== "" && c.ads.some((a) => (a.name || "").toLowerCase().includes(norm));
  const visible = campaigns
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => {
      if (liveOnly && c.ads.length === 0) return false;
      if (!norm) return true;
      return (c.campaign_name || "").toLowerCase().includes(norm) || adMatch(c);
    });
  const liveCount = campaigns.filter((c) => c.ads.length > 0).length;
  const cellSx = {
    fontFamily: F, fontSize: FS.small, py: 0.4, px: 1,
    borderBottom: `1px solid ${C.borderSoft}`, whiteSpace: "nowrap" as const,
  };
  const headSx = { ...cellSx, fontWeight: FW.semibold, fontSize: FS.caption, textTransform: "uppercase" as const, letterSpacing: "0.04em", color: C.sub, bgcolor: C.cardBg };
  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <TextField
          size="small" placeholder="Filter campaigns or ads…" value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ width: 260, "& .MuiInputBase-root": { fontFamily: F, fontSize: FS.small, height: 30, borderRadius: "7px", bgcolor: C.cardBg, "& fieldset": { borderColor: C.borderSoft }, "&:hover fieldset": { borderColor: C.border }, "&.Mui-focused fieldset": { borderColor: C.orange } } }}
        />
        <Chip
          label={`With live ads (${liveCount})`} size="small" clickable
          onClick={() => setLiveOnly((v) => !v)}
          sx={{ fontFamily: F, height: 24, fontSize: FS.caption, fontWeight: FW.semibold,
                bgcolor: liveOnly ? `${C.green}14` : C.cardBg,
                color: liveOnly ? C.green : C.sub,
                border: `1px solid ${liveOnly ? `${C.green}40` : C.borderSoft}` }}
        />
        {(norm || liveOnly) && (
          <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.dim }}>
            {visible.length} of {campaigns.length} campaigns
          </Typography>
        )}
      </Box>
      {visible.length === 0 ? (
        <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.dim, py: 2, textAlign: "center" }}>
          No campaigns match the filter.
        </Typography>
      ) : (
    <TableContainer component={Paper} elevation={0} sx={{ border: `1px solid ${C.border}`, borderRadius: "6px" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ ...headSx, width: 30, px: 0.5 }} />
            <TableCell sx={headSx}>Campaign / Ad</TableCell>
            <TableCell sx={headSx}>Ad type</TableCell>
            <TableCell sx={headSx} align="right">Impressions</TableCell>
            <TableCell sx={headSx} align="right">Clicks</TableCell>
            <TableCell sx={headSx} align="right">CTR %</TableCell>
            <TableCell sx={headSx} align="right">Spent</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {visible.map(({ c, i }) => (
            <React.Fragment key={i}>
              <TableRow hover sx={{ cursor: c.ads.length ? "pointer" : "default" }}
                onClick={() => c.ads.length && toggle(i)}>
                <TableCell sx={{ ...cellSx, px: 0.5 }}>
                  {c.ads.length > 0 && (
                    <IconButton size="small" sx={{ p: 0.25 }} aria-label={(open.has(i) || adMatch(c)) ? "Collapse ads" : "Expand ads"}
                      onClick={(e) => { e.stopPropagation(); toggle(i); }}>
                      <ExpandMoreIcon sx={{ fontSize: 16, color: C.sub, transform: (open.has(i) || adMatch(c)) ? "none" : "rotate(-90deg)", transition: "transform .15s" }} />
                    </IconButton>
                  )}
                </TableCell>
                <TableCell sx={{ ...cellSx, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {c.campaign_url ? (
                    <Tooltip title="Open this campaign in LinkedIn Campaign Manager" arrow>
                      <Typography component="a" href={c.campaign_url} target="_blank" rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        sx={{ fontFamily: F, fontSize: "inherit", fontWeight: FW.semibold, color: "#0A66C2", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
                        {c.campaign_name || "(unnamed)"} <LaunchIcon sx={{ fontSize: 11, verticalAlign: "middle" }} />
                      </Typography>
                    </Tooltip>
                  ) : <Typography component="span" sx={{ fontFamily: F, fontSize: "inherit", fontWeight: FW.semibold }}>{c.campaign_name || "(unnamed)"}</Typography>}
                  {c.ads.length > 0 && (
                    <Chip label={`${c.ads.length} ad${c.ads.length > 1 ? "s" : ""} live`} size="small"
                      sx={{ ml: 0.75, height: 16, fontSize: FS.micro, fontWeight: FW.semibold, bgcolor: `${C.green}10`, color: C.green }} />
                  )}
                </TableCell>
                <TableCell sx={cellSx}>
                  {c.objective_type ? (
                    <Tooltip title={`Objective: ${prettyAdFormat(c.objective_type)}`} arrow>
                      <span>{prettyAdFormat(c.ad_format)}</span>
                    </Tooltip>
                  ) : <span>{prettyAdFormat(c.ad_format)}</span>}
                </TableCell>
                <TableCell sx={cellSx} align="right">{c.impressions.toLocaleString()}</TableCell>
                <TableCell sx={cellSx} align="right">{c.clicks.toLocaleString()}</TableCell>
                <TableCell sx={cellSx} align="right">{c.ctr}%</TableCell>
                <TableCell sx={cellSx} align="right">{c.spent.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
              </TableRow>
              {(open.has(i) || adMatch(c)) && c.ads.map((a, ai) => (
                <TableRow key={`${i}-${ai}`} sx={{ bgcolor: `${C.cardBg}80` }}>
                  <TableCell sx={{ ...cellSx, px: 0.5 }} />
                  <TableCell sx={{ ...cellSx, pl: 3.5, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis" }}>
                    <Typography component="span" sx={{ fontFamily: F, fontSize: FS.small, color: C.text }}>
                      ↳ {a.name || "(unnamed ad)"}
                    </Typography>
                    {a.ad_url && (
                      <Tooltip title="View this ad's post on LinkedIn" arrow>
                        <IconButton size="small" component="a" href={a.ad_url} target="_blank" rel="noopener noreferrer"
                          aria-label="View ad on LinkedIn" sx={{ p: 0.25, ml: 0.25, color: "#0A66C2" }}>
                          <LaunchIcon sx={{ fontSize: 12 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell sx={cellSx}>
                    {a.status && <Chip label={a.status} size="small" sx={{ height: 16, fontSize: FS.micro, fontWeight: FW.semibold, bgcolor: a.status === "ACTIVE" ? `${C.green}10` : C.cardBg, color: a.status === "ACTIVE" ? C.green : C.sub }} />}
                  </TableCell>
                  <TableCell sx={cellSx} align="right">{a.impressions.toLocaleString()}</TableCell>
                  <TableCell sx={cellSx} align="right">{a.clicks.toLocaleString()}</TableCell>
                  <TableCell sx={cellSx} align="right">{a.ctr}%</TableCell>
                  <TableCell sx={cellSx} align="right">{a.spent.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                </TableRow>
              ))}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
      )}
    </Box>
  );
}

function SourceTable<T extends { id: number }>({ columns, rows }: { columns: ColumnDef<T>[]; rows: T[] }) {
  if (rows.length === 0) return (
    <Typography sx={{ fontFamily: F, fontSize: FS.body, color: C.dim, py: 2, textAlign: "center" }}>No records</Typography>
  );
  return <DataTable spreadsheet columns={columns} rows={rows} total={rows.length} page={1} pageSize={rows.length} pages={1} onPageChange={() => {}} getRowKey={(r) => r.id} />;
}

/**
 * One collapsible source-data section. `count` is the true total from
 * `source_counts`; `rows` is capped by the backend at the newest `limit` rows
 * (`section_limit`), so a truncated section says so instead of looking complete.
 */
function SourceAccordion<T extends { id: number }>({ title, count, columns, rows, limit }: {
  title: string; count: number; columns: ColumnDef<T>[]; rows: T[]; limit?: number;
}) {
  const truncated = !!limit && limit > 0 && rows.length === limit && count > rows.length;
  return (
    <Accordion defaultExpanded={count > 0} disableGutters elevation={0} sx={{ border: `1px solid ${C.border}`, borderRadius: "8px !important", mb: 1, "&:before": { display: "none" } }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: C.dim }} />} sx={{ minHeight: 40, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
        <Typography sx={{ fontFamily: F, fontSize: FS.body, fontWeight: FW.semibold, color: C.text }}>{title}</Typography>
        <Chip label={count} size="small" sx={{ ml: 1, height: 18, fontSize: FS.caption, fontWeight: FW.semibold }} />
      </AccordionSummary>
      <AccordionDetails sx={{ p: 0 }}>
        {truncated && (
          <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub, px: 1.5, py: 0.75, borderBottom: `1px solid ${C.borderSoft}` }}>
            Showing the newest {rows.length.toLocaleString()} of {count.toLocaleString()}
          </Typography>
        )}
        <SourceTable columns={columns} rows={rows} />
      </AccordionDetails>
    </Accordion>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ── Main Component
// ═════════════════════════════════════════════════════════════════════════════

/** Single company deep-dive showing source signals, enrichment data, and associated contacts. */
const COMPANY_TABS = ["overview", "engagement", "contacts", "sources", "reo"] as const;
type CompanyTab = (typeof COMPANY_TABS)[number];

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { get, request } = useApiClient();
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  // `?tab=contacts` (etc.) opens a tab directly — Ask AI links to the Contacts tab
  // for the full details of contacts it revealed but shows masked.
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<CompanyTab>(() => {
    const t = searchParams.get("tab");
    return COMPANY_TABS.includes(t as CompanyTab) ? (t as CompanyTab) : "overview";
  });
  const [engagement, setEngagement] = useState<CompanyEngagement | null>(null);
  const [reoData, setReoData] = useState<ReoCompanyData | null>(null);

  // Leads & journey for this account (funnel-ordered)
  interface JourneyLead {
    id: number; email: string | null; first_name: string | null; last_name: string | null;
    job_title: string | null; lead_stage: string | null; lead_type: string | null;
  }
  const [journeyLeads, setJourneyLeads] = useState<JourneyLead[]>([]);
  const FUNNEL_ORDER = ["subscriber", "lead", "mql", "sql", "opportunity", "customer"];
  // Display labels — internal key "subscriber" shows as "Prospect" (covers outbound too).
  const STAGE_LABEL: Record<string, string> = {
    subscriber: "Prospect", lead: "Lead", mql: "MQL", sql: "SQL", opportunity: "Opportunity", customer: "Customer",
  };
  const STAGE_COLOR: Record<string, string> = {
    subscriber: "#8891a0", lead: C.blue, mql: C.green, sql: C.amber, opportunity: C.purple, customer: C.green,
  };
  useEffect(() => {
    if (!id) return;
    get<{ items: JourneyLead[] }>("/lead-enrichment/status", { company_id: id, page_size: 200 })
      .then((d) => setJourneyLeads(d.items))
      .catch(() => setJourneyLeads([]));
  }, [id, get]);
  const [enriching, setEnriching] = useState(false);
  const [enrichDetail, setEnrichDetail] = useState<{
    enrichments: CompanyEnrichmentRecord[];
    fields_filled: number; fields_total: number; missing_fields: string[];
  } | null>(null);

  // Salesforce sync (push enriched account to CRM Upload)
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  // Account follow ("subscribe"): followers are emailed when the funnel stage moves up.
  const [follow, setFollow] = useState<FollowStatus | null>(null);
  const [followBusy, setFollowBusy] = useState(false);

  /** Push this company to Salesforce via CRM Upload, then poll the run to completion. */
  const handleSyncToSf = async () => {
    if (!id || syncing) return;
    setSyncing(true);
    try {
      const start = await request<{ run_id: string }>("post", "/crm-sync/accounts", { company_ids: [Number(id)] });
      const poll = async (): Promise<void> => {
        const s = await get<{ status: string; counts?: { queued?: number; deduplicated?: number; failed?: number } }>(`/crm-sync/${start.run_id}`);
        if (s.status === "running") { setTimeout(poll, 1500); return; }
        const c = s.counts ?? {};
        setSyncMsg(s.status === "failed"
          ? "Salesforce sync failed."
          : `Queued to Salesforce — ${c.queued ?? 0} record(s)${c.deduplicated ? `, ${c.deduplicated} deduped` : ""}${c.failed ? `, ${c.failed} failed` : ""}.`);
        setSyncing(false);
      };
      poll();
    } catch {
      setSyncMsg("Could not start Salesforce sync (CRM upload may be disabled).");
      setSyncing(false);
    }
  };

  // Preview/review dialog state
  interface PreviewField {
    field: string; label: string;
    current_value: unknown; new_value: unknown; new_display: unknown;
    source: string | null; confidence: string | null;
    has_current: boolean; has_new: boolean; is_conflict: boolean; is_new_only: boolean;
    all_proposals: { source: string; value: unknown; confidence: string }[];
  }
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFields, setPreviewFields] = useState<PreviewField[]>([]);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);

  // Contacts tab state — the ranked table + reveal flow live in CompanyContactsPanel;
  // this page owns the fetch so the Enrich flow can refresh it after saving.
  interface DiscoveredContact {
    first_name: string; last_name?: string; job_title?: string;
    email?: string; phone?: string; linkedin_url?: string;
    source: string; external_id?: string; saved?: boolean; id?: number;
    has_email?: boolean; has_phone?: boolean; seniority?: string;
    has_direct_phone?: boolean; has_mobile_phone?: boolean; match_confidence?: number | null;
    direct_phone_do_not_call?: boolean | null; mobile_phone_do_not_call?: boolean | null;
    last_refreshed_at?: string | null; email_status?: string | null;
  }
  const [contactsData, setContactsData] = useState<CompanyContactsResponse | null>(null);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [discoveredContacts] = useState<DiscoveredContact[]>([]);
  /** Shape of POST /contact-enrichment/discover — rows plus the providers' overall match counts. */
  type DiscoverResponse = {
    status: string; contacts: DiscoveredContact[];
    total_available?: number | null; provider_totals?: Record<string, number>;
  };
  /** Provider totals from the last discovery, echoed to /save so the Contacts tab can
   * say "N more available at providers". */
  const [discoverMeta] = useState<{ total_available: number | null; provider_totals: Record<string, number> }>(
    { total_available: null, provider_totals: {} });
  const metaOf = (d: DiscoverResponse) => ({ total_available: d.total_available ?? null, provider_totals: d.provider_totals ?? {} });
  const [discoverDialogOpen, setDiscoverDialogOpen] = useState(false);
  const [selectedContactIdxs, setSelectedContactIdxs] = useState<Set<number>>(new Set());
  const [savingContacts, setSavingContacts] = useState(false);
  /** Map a discovered contact to the /contact-enrichment/save payload, passing through the
   * provider availability flags and quality signals the ranked Contacts table needs. */
  const toSavePayload = (c: DiscoveredContact) => ({
    first_name: c.first_name, last_name: c.last_name,
    job_title: c.job_title, source: c.source, external_id: c.external_id,
    has_email: c.has_email || false, has_phone: c.has_phone || false,
    has_direct_phone: c.has_direct_phone, has_mobile_phone: c.has_mobile_phone,
    match_confidence: c.match_confidence,
    direct_phone_do_not_call: c.direct_phone_do_not_call, mobile_phone_do_not_call: c.mobile_phone_do_not_call,
    last_refreshed_at: c.last_refreshed_at, email_status: c.email_status,
    seniority: c.seniority,
  });

  const loadFollow = () => { if (!id) return; get<FollowStatus>(`/companies/${id}/follow`).then(setFollow).catch(() => setFollow(null)); };
  const toggleFollow = async () => {
    if (!id || !follow) return;
    setFollowBusy(true);
    try {
      const r = await request<FollowStatus>(follow.following ? "delete" : "post", `/companies/${id}/follow`);
      setFollow(r);
      setSyncMsg(r.following ? "Following — you'll get an email when this account's stage moves up." : "Unfollowed.");
    } catch { setSyncMsg("Could not update the follow."); }
    finally { setFollowBusy(false); }
  };
  const loadProfile = () => { if (!id) return; setLoading(true); get<CompanyProfile>(`/companies/${id}/profile`).then(setProfile).finally(() => setLoading(false)); };
  const loadEnrichment = () => { if (!id) return; get<{ enrichments: CompanyEnrichmentRecord[]; fields_filled: number; fields_total: number; missing_fields: string[] }>(`/company-enrichment/company/${id}`).then(setEnrichDetail).catch(() => {}); };
  const loadContacts = () => {
    if (!id) return;
    setContactsLoading(true);
    get<CompanyContactsResponse>(`/contact-enrichment/company/${id}`)
      .then(setContactsData)
      .catch(() => {})
      .finally(() => setContactsLoading(false));
  };
  // LinkedIn date range for the Engagement tab — server-side filter so campaign
  // sums, ad sums, and the totals cards all recompute for the chosen period.
  const [liFrom, setLiFrom] = useState("");
  const [liTo, setLiTo] = useState("");
  const loadEngagement = (from = liFrom, to = liTo) => {
    if (!id) return;
    const qs = new URLSearchParams();
    if (from) qs.set("li_from", from);
    if (to) qs.set("li_to", to);
    get<CompanyEngagement>(`/companies/${id}/engagement${qs.toString() ? `?${qs}` : ""}`)
      .then(setEngagement).catch(() => setEngagement(null));
  };
  // One effect owns the engagement fetch: on a company change it resets the
  // range first (the reset re-fires the effect, which then fetches once); on a
  // range change it just refetches. Old data stays on screen until the new
  // payload lands so the table doesn't flash back to the loading state.
  const engCompanyRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (engCompanyRef.current !== id) {
      engCompanyRef.current = id;
      setEngagement(null);
      if (liFrom || liTo) { setLiFrom(""); setLiTo(""); return; } // fetch fires from the reset
    }
    loadEngagement();
  }, [id, liFrom, liTo]); // eslint-disable-line react-hooks/exhaustive-deps
  const loadReo = () => { if (!id) return; get<ReoCompanyData>(`/reo/company/${id}`).then(setReoData).catch(() => setReoData(null)); };
  const promoteReoLead = async (leadId: number) => {
    try {
      const r = await request<{ status: string; created: boolean }>("post", `/reo/leads/${leadId}/promote`);
      setSyncMsg(r.status === "already_promoted" ? "Reo lead already promoted."
        : r.created ? "Promoted — created a first-party lead." : "Promoted — linked to an existing lead.");
      loadReo();
    } catch {
      setSyncMsg("Could not promote the Reo lead.");
    }
  };
  useEffect(() => { loadProfile(); loadEnrichment(); loadContacts(); loadReo(); loadFollow(); }, [id]);

  // The Reo ("Developer Intent") tab only exists when the company has Reo data.
  // If we're on it and the data goes away (e.g. navigating to a company without
  // Reo), fall back to Overview so we don't strand the selection on a hidden tab.
  useEffect(() => {
    const reoCount = (reoData?.accounts?.length ?? 0) + (reoData?.leads?.length ?? 0);
    // Only once Reo has loaded, so a `?tab=reo` link isn't reset while loading.
    if (tab === "reo" && reoData && reoCount === 0) setTab("overview");
  }, [reoData, tab]);

  // Step 1: Enrich button → company preview + contact discovery in parallel
  const handleEnrich = async () => {
    if (!id) return;
    setEnriching(true);
    try {
      // Run company preview + contact discovery in parallel
      const [companyData, contactData] = await Promise.all([
        request<{ fields: PreviewField[] }>("post", `/company-enrichment/preview?company_id=${id}`, undefined),
        profile?.domain
          ? request<DiscoverResponse>("post", `/contact-enrichment/discover?company_id=${id}`, undefined)
          : Promise.resolve(null),
      ]);

      // Filter to only fields with actual differences (new value != current value)
      const fieldsWithDiff = companyData.fields.filter((f: PreviewField) =>
        f.has_new && (f.is_new_only || f.is_conflict)
      );

      // Auto-save discovered contacts (all of them, no preview needed for contacts)
      if (contactData && contactData.contacts && contactData.contacts.length > 0) {
        await request("post", "/contact-enrichment/save", {
          company_id: Number(id),
          contacts: contactData.contacts.map(toSavePayload),
          ...metaOf(contactData),
        });
      }
      // Always reload contacts (whether cached, discovered, or empty)
      loadContacts();

      if (fieldsWithDiff.length === 0) {
        // No company data differences — just reload
        loadProfile(); loadEnrichment(); loadContacts();
        setEnriching(false);
        return;
      }

      setPreviewFields(fieldsWithDiff);
      const autoSelected = new Set<string>();
      for (const f of fieldsWithDiff) {
        if (f.is_new_only) autoSelected.add(f.field);
      }
      setSelectedFields(autoSelected);
      setPreviewOpen(true);
    } catch (err) {
      console.error("Enrich failed:", err);
    } finally {
      setEnriching(false);
    }
  };

  // Step 2: User confirms → apply selected company fields
  const handleApply = async () => {
    if (!id) return;
    setApplying(true);
    try {
      const selections = previewFields
        .filter(f => selectedFields.has(f.field))
        .map(f => ({ field: f.field, value: f.new_value, source: f.source || "unknown" }));
      await request("post", "/company-enrichment/apply", { company_id: Number(id), selections });
      setPreviewOpen(false);
      loadProfile();
      loadEnrichment();
    } catch (err) {
      console.error("Apply failed:", err);
    } finally {
      setApplying(false);
    }
  };

  const toggleField = (field: string) => {
    setSelectedFields(prev => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field); else next.add(field);
      return next;
    });
  };
  const selectAll = () => setSelectedFields(new Set(previewFields.map(f => f.field)));
  const selectNone = () => setSelectedFields(new Set());

  // ── Contact handlers ─────────────────────────────────────────────────────

  const handleSaveContacts = async () => {
    if (!id) return;
    setSavingContacts(true);
    try {
      const selected = discoveredContacts
        .filter((_: DiscoveredContact, i: number) => selectedContactIdxs.has(i))
        .map(toSavePayload);
      await request("post", "/contact-enrichment/save", { company_id: Number(id), contacts: selected, ...discoverMeta });
      setDiscoverDialogOpen(false);
      loadContacts();
    } catch (err) { console.error("Save contacts failed:", err); }
    finally { setSavingContacts(false); }
  };

  const toggleContact = (idx: number) => {
    setSelectedContactIdxs(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", pt: 10 }}><CircularProgress size={24} sx={{ color: C.orange }} /></Box>;
  if (!profile) return <Box sx={{ pt: 6, textAlign: "center" }}><Typography sx={{ fontFamily: F, color: C.dim }}>Company not found.</Typography></Box>;

  const enrichments = enrichDetail?.enrichments.filter(e => e.status === "success") || [];
  const src = (field: string) => fieldSource(enrichments, field);

  const { source_counts: sc } = profile;
  const latestIntent = profile.g2_intent.slice().sort((a, b) => (b.last_seen ?? "").localeCompare(a.last_seen ?? ""))[0];
  const latestG2Visit = profile.g2_visits.slice().sort((a, b) => (b.last_seen ?? "").localeCompare(a.last_seen ?? ""))[0];
  const latestSnap = profile.pardot_snapshots.slice().sort((a, b) => (b.snapshot_date ?? "").localeCompare(a.snapshot_date ?? ""))[0];
  const totalLiImpressions = profile.linkedin_stats.reduce((s, r) => s + (r.impressions ?? 0), 0);
  const totalLiClicks = profile.linkedin_stats.reduce((s, r) => s + (r.clicks ?? 0), 0);
  const totalG2Views = profile.g2_visits.reduce((s, r) => s + (r.total_pageviews ?? 0), 0);

  const displayEmployees = profile.employees ?? latestG2Visit?.company_employees ?? latestIntent?.company_employees ?? null;
  const displayRevenue = profile.annual_revenue ?? latestG2Visit?.annual_revenue ?? latestIntent?.annual_revenue ?? null;
  const displayIndustry = profile.industry ?? latestG2Visit?.company_industry ?? null;
  const location = [profile.city, profile.state, profile.country].filter(Boolean).join(", ");

  const stageColor = latestIntent?.buying_stage === "decision" ? C.red : latestIntent?.buying_stage === "consideration" ? C.amber : C.blue;

  return (
    <Box sx={{ fontFamily: F, bgcolor: C.bg, minHeight: "100%", overflow: "hidden" }}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <Box sx={{ px: 2.5, py: 2, bgcolor: C.panel, borderBottom: `1px solid ${C.border}` }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
          <IconButton size="small" onClick={() => navigate(-1)} sx={{ color: C.sub }}><ArrowBackIcon fontSize="small" /></IconButton>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography sx={{ fontFamily: F, fontSize: FS.display, fontWeight: FW.bold, color: C.text }}>
                {profile.canonical_name}
              </Typography>
              {profile.enrichment_status === "enriched" && (
                <Chip label="Enriched" size="small" sx={{ height: 18, fontSize: FS.micro, fontWeight: FW.semibold, bgcolor: `${C.green}12`, color: C.green, border: `1px solid ${C.green}30` }} />
              )}
              {profile.enrichment_status === "partial" && (
                <Chip label="Partial" size="small" sx={{ height: 18, fontSize: FS.micro, fontWeight: FW.semibold, bgcolor: `${C.amber}12`, color: C.amber, border: `1px solid ${C.amber}30` }} />
              )}
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.25 }}>
              {profile.domain && (
                <Typography component="a" href={`https://${profile.domain}`} target="_blank" rel="noopener noreferrer"
                  sx={{ fontFamily: F, fontSize: FS.small, color: C.orange, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
                  {profile.domain} <LaunchIcon sx={{ fontSize: 10, verticalAlign: "middle" }} />
                </Typography>
              )}
              {location && <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.sub }}>{location}</Typography>}
              {profile.linkedin_url && (
                <Tooltip title="LinkedIn Company Page" arrow>
                  <IconButton size="small" component="a" href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" sx={{ color: "#0A66C2", p: 0.25 }}>
                    <LinkedInIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.5 }}>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Tooltip title={follow?.following
                ? "You follow this account — you're emailed when its stage moves up. Click to unfollow."
                : "Follow this account to be emailed when its stage moves up."} arrow>
                <span>
                  <Button size="small" variant={follow?.following ? "outlined" : "contained"} disableElevation
                    onClick={toggleFollow} disabled={!follow || followBusy}
                    startIcon={follow?.following ? <NotificationsActiveIcon sx={{ fontSize: 14 }} /> : <NotificationsNoneIcon sx={{ fontSize: 14 }} />}
                    sx={{
                      fontFamily: F, textTransform: "none", fontSize: FS.body, fontWeight: FW.semibold, borderRadius: "8px", px: 2, py: 0.75,
                      ...(follow?.following
                        ? { borderColor: C.orange, color: C.orange, "&:hover": { borderColor: C.orangeDark, bgcolor: `${C.orange}0a` } }
                        : { bgcolor: C.orange, color: "#fff", "&:hover": { bgcolor: C.orangeDark } }),
                    }}>
                    {follow?.following ? "Following" : "Follow"}
                    {!!follow?.follower_count && (
                      <Box component="span" sx={{ ml: 0.75, fontSize: FS.micro, fontWeight: FW.semibold, opacity: 0.85 }}>· {follow.follower_count}</Box>
                    )}
                  </Button>
                </span>
              </Tooltip>
              {(() => {
                // Deep link to the SF Account record when this company is in Salesforce.
                const sfUrl = sfRecordUrl("Account", profile.sf_accounts?.[0]?.sf_account_id);
                return sfUrl && (
                  <Button size="small" variant="outlined" component="a" href={sfUrl} target="_blank" rel="noopener noreferrer"
                    startIcon={<LaunchIcon sx={{ fontSize: 14 }} />}
                    sx={{ fontFamily: F, textTransform: "none", fontSize: FS.body, fontWeight: FW.semibold, borderRadius: "8px", px: 2, py: 0.75, borderColor: "#0176d3", color: "#0176d3", "&:hover": { borderColor: "#0176d3", bgcolor: "#0176d30a" } }}>
                    Open in Salesforce
                  </Button>
                );
              })()}
              <Tooltip title={profile.exclude_from_ads
                ? "Excluded from LinkedIn ad audiences — click to include again"
                : "Exclude this account from all LinkedIn ad audiences (takes effect on the next audience push)"} arrow>
                <Button size="small" variant="outlined"
                  onClick={async () => {
                    try {
                      const r = await request<{ exclude_from_ads: boolean }>(
                        "put", `/ad-audiences/companies/${id}/exclusion`,
                        { exclude: !profile.exclude_from_ads });
                      setProfile((cur) => (cur ? { ...cur, exclude_from_ads: r.exclude_from_ads } : cur));
                      setSyncMsg(r.exclude_from_ads
                        ? "Excluded from ad audiences — removed on the next push."
                        : "Included in ad audiences again.");
                    } catch { setSyncMsg("Could not update the ad-audience exclusion."); }
                  }}
                  sx={{
                    fontFamily: F, textTransform: "none", fontSize: FS.body, fontWeight: FW.semibold,
                    borderRadius: "8px", px: 2, py: 0.75,
                    borderColor: profile.exclude_from_ads ? C.red : C.border,
                    color: profile.exclude_from_ads ? C.red : C.textMd,
                    "&:hover": { borderColor: C.red, color: C.red, bgcolor: `${C.red}06` },
                  }}>
                  {profile.exclude_from_ads ? "Ads: excluded" : "Exclude from ads"}
                </Button>
              </Tooltip>
              {(profile.enrichment_status === "enriched" || profile.enrichment_status === "partial") && (
                <Tooltip title="Push this enriched account to Salesforce via CRM Upload" arrow>
                  <Button size="small" variant="outlined"
                    startIcon={syncing ? <CircularProgress size={14} sx={{ color: C.orange }} /> : <CloudUploadIcon sx={{ fontSize: 17 }} />}
                    disabled={syncing} onClick={handleSyncToSf}
                    sx={{
                      fontFamily: F, textTransform: "none", fontSize: FS.body, fontWeight: FW.semibold,
                      borderRadius: "8px", px: 2, py: 0.75,
                      borderColor: C.border, color: C.textMd,
                      "&:hover": { borderColor: C.orange, color: C.orange, bgcolor: `${C.orange}06` },
                    }}>
                    {syncing ? "Syncing..." : "Sync to Salesforce"}
                  </Button>
                </Tooltip>
              )}
              <Button size="small" variant="contained" disableElevation
                startIcon={enriching ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : <BoltIcon sx={{ fontSize: 18 }} />}
                disabled={enriching} onClick={handleEnrich}
                sx={{
                  fontFamily: F, textTransform: "none", fontSize: FS.body, fontWeight: FW.semibold,
                  borderRadius: "8px", px: 2.5, py: 0.75,
                  bgcolor: C.orange, color: "#fff",
                  "&:hover": { bgcolor: C.orangeDark },
                  "&.Mui-disabled": { bgcolor: `${C.orange}60`, color: "#fff" },
                }}>
                {enriching ? "Enriching..." : "Enrich Company"}
              </Button>
            </Box>
            {profile.updated_at && (
              <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.dim }}>
                Last updated: {profile.updated_at.split("T")[0]}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Description */}
        {profile.description && <DescriptionBlock text={profile.description} source={src("description")} />}

        {/* Tags row */}
        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.5 }}>
          {displayIndustry && <Chip label={displayIndustry} size="small" sx={{ fontFamily: F, fontSize: FS.caption, height: 22, bgcolor: C.cardBg, color: C.textMd }} />}
          {profile.sector && profile.sector !== displayIndustry && <Chip label={profile.sector} size="small" sx={{ fontFamily: F, fontSize: FS.caption, height: 22, bgcolor: C.cardBg, color: C.textMd }} />}
          {profile.funding_stage && <Chip label={profile.funding_stage} size="small" sx={{ fontFamily: F, fontSize: FS.caption, height: 22, bgcolor: `${C.purple}10`, color: C.purple }} />}
          {profile.founded_year && <Chip label={`Est. ${profile.founded_year}`} size="small" sx={{ fontFamily: F, fontSize: FS.caption, height: 22, bgcolor: C.cardBg, color: C.sub }} />}
        </Box>
      </Box>

      {/* ── Tab switcher ──────────────────────────────────────────────── */}
      <Box role="tablist" aria-label="Company detail sections" sx={{ px: 2.5, py: 0.75, bgcolor: C.panel, borderBottom: `1px solid ${C.border}`, display: "flex", gap: 0.5 }}>
        {(() => {
          // "Developer Intent" (Reo.dev) shows as its own tab only when the company
          // has Reo data — same top-level treatment as Contacts / Source Data.
          const reoCount = (reoData?.accounts?.length ?? 0) + (reoData?.leads?.length ?? 0);
          const tabs: Array<typeof tab> = ["overview", "engagement", "contacts", "sources"];
          if (reoCount > 0) tabs.push("reo");
          return tabs.map(t => (
            <Box key={t} role="tab" tabIndex={0} aria-selected={tab === t}
              onClick={() => setTab(t)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setTab(t); } }}
              sx={{
              px: 1.5, py: 0.5, borderRadius: "6px", cursor: "pointer", outline: "none",
              fontFamily: F, fontSize: FS.small, fontWeight: tab === t ? FW.semibold : FW.medium,
              color: tab === t ? C.orange : C.sub, bgcolor: tab === t ? `${C.orange}08` : "transparent",
              transition: "all 0.1s", "&:hover": { bgcolor: `${C.orange}05` },
              "&:focus-visible": { boxShadow: `0 0 0 2px ${C.orange}55` },
            }}>
              {t === "overview" ? "Overview"
                : t === "engagement" ? "Engagement"
                : t === "contacts" ? `Contacts (${sc.contacts + sc.pardot_leads})`
                : t === "reo" ? `Developer Intent (${reoData?.leads?.length ?? 0})`
                : `Source Data (${sc.sf_accounts + sc.certifications + sc.pardot_leads + sc.linkedin + sc.g2_visits + sc.g2_intent})`}
            </Box>
          ));
        })()}
      </Box>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <Box sx={{ p: 2.5 }}>

        {tab === "overview" && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>

            {/* ── Key metrics ──────────────────────────────────────────── */}
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 1.5 }}>
              <MetricCard label="Intent Score" value={profile.intent_score ?? 0} color={C.red} sub={(profile.intent_score ?? 0) >= 40 ? "High" : (profile.intent_score ?? 0) >= 15 ? "Medium" : "Low"} />
              <MetricCard label="Awareness" value={profile.awareness_score ?? 0} color={C.orange} />
              <MetricCard label="Revenue" value={fmtRev(displayRevenue) || "--"} color={C.green} />
              <MetricCard label="Employees" value={fmtEmp(displayEmployees, profile.employees_range) || "--"} color={C.blue} />
              <MetricCard label="LinkedIn Impressions" value={totalLiImpressions || (profile.li_impressions ?? 0)} color="#0A66C2" sub={`${totalLiClicks || (profile.li_clicks ?? 0)} clicks`} />
              <MetricCard label="G2 Views" value={totalG2Views || (profile.g2_pageviews ?? 0)} color={C.orange} />
            </Box>

            {/* ── Two-column layout ────────────────────────────────────── */}
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>

              {/* Left: Company details */}
              <Section title="Company Details">
                <DataRow label="Revenue" value={fmtRev(displayRevenue)} source={src("annual_revenue")} />
                <DataRow label="Employees" value={fmtEmp(displayEmployees, profile.employees_range)} source={src("employees") || src("employees_range")} />
                <DataRow label="Industry" value={displayIndustry} source={src("industry")} />
                <DataRow label="Industry Group" value={profile.industry_group} source={src("industry_group")} />
                <DataRow label="Sub-Industry" value={profile.sub_industry} source={src("sub_industry")} />
                <DataRow label="Sector" value={profile.sector} source={src("sector")} />
                <DataRow label="NAICS" value={profile.naics_industry} source={src("naics_industry")} />
                <DataRow label="Founded" value={profile.founded_year} source={src("founded_year")} />
                <DataRow label="Funding" value={profile.funding_stage} source={src("funding_stage")} />
                <DataRow label="Region" value={profile.region} />

                {/* Tech stack */}
                {profile.tech_stack && profile.tech_stack.length > 0 && (
                  <Box sx={{ mt: 1, pt: 0.75, borderTop: `1px solid ${C.borderSoft}` }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                      <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.sub, fontWeight: FW.medium }}>Tech Stack</Typography>
                      <SourceTag source={src("tech_stack")} />
                    </Box>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.4 }}>
                      {profile.tech_stack.slice(0, 12).map(t => (
                        <Chip key={t} label={t} size="small" variant="outlined" sx={{ fontFamily: F, fontSize: FS.caption, height: 20, borderColor: C.borderSoft }} />
                      ))}
                      {profile.tech_stack.length > 12 && (
                        <Chip label={`+${profile.tech_stack.length - 12}`} size="small" sx={{ fontFamily: F, fontSize: FS.caption, height: 20, bgcolor: C.cardBg }} />
                      )}
                    </Box>
                  </Box>
                )}
              </Section>

              {/* Right: Intent signals */}
              <Section title="Buying Signals">
                {latestIntent ? (
                  <Box>
                    <Box sx={{ display: "flex", gap: 0.5, mb: 1, flexWrap: "wrap" }}>
                      {latestIntent.buying_stage && (
                        <Chip label={latestIntent.buying_stage} size="small" sx={{ fontFamily: F, fontSize: FS.caption, height: 22, fontWeight: FW.semibold, bgcolor: `${stageColor}10`, color: stageColor, border: `1px solid ${stageColor}25` }} />
                      )}
                      {latestIntent.activity_level && (
                        <Chip label={`Activity: ${latestIntent.activity_level}`} size="small" sx={{ fontFamily: F, fontSize: FS.caption, height: 22, bgcolor: C.cardBg, color: C.textMd }} />
                      )}
                    </Box>
                    <DataRow label="Last Seen" value={latestIntent.last_seen?.split("T")[0]} />
                    <DataRow label="Total Views" value={latestIntent.total_pageviews} />
                    <DataRow label="Pricing Views" value={latestIntent.pricing_pageviews} />
                    <DataRow label="Compare Views" value={latestIntent.comparison_pageviews} />
                    <DataRow label="Competitive" value={latestIntent.competitive_signals} />
                  </Box>
                ) : (
                  <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.dim, py: 1 }}>No G2 intent data</Typography>
                )}

                <Divider sx={{ my: 1.5 }} />

                <Typography sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: C.sub, textTransform: "uppercase", letterSpacing: "0.04em", mb: 0.75 }}>
                  Engagement
                </Typography>
                <DataRow label="LinkedIn Impr." value={totalLiImpressions > 0 ? totalLiImpressions.toLocaleString() : null} />
                <DataRow label="LinkedIn Clicks" value={totalLiClicks > 0 ? totalLiClicks.toLocaleString() : null} />
                <DataRow label="Pardot Leads" value={sc.pardot_leads > 0 ? sc.pardot_leads : null} />
                <DataRow label="Certifications" value={sc.certifications > 0 ? sc.certifications : null} />
                {latestSnap && <DataRow label="Prospects" value={latestSnap.prospects_count} />}
                {sc.sf_accounts > 0 && profile.sf_accounts[0] && (
                  <>
                    <Divider sx={{ my: 1 }} />
                    <Typography sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: C.sub, textTransform: "uppercase", letterSpacing: "0.04em", mb: 0.75 }}>Salesforce</Typography>
                    <DataRow label="Lifecycle" value={profile.sf_accounts[0].account_life_cycle} />
                    <DataRow label="Rating" value={profile.sf_accounts[0].rating} />
                    <DataRow label="Region" value={profile.sf_accounts[0].region_bucket} />
                  </>
                )}
              </Section>
            </Box>

            {/* ── Enrichment audit ─────────────────────────────────────── */}
            {enrichDetail && enrichments.length > 0 && (
              <Section title="Enrichment History" action={
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <LinearProgress variant="determinate"
                    value={enrichDetail.fields_total > 0 ? (enrichDetail.fields_filled / enrichDetail.fields_total) * 100 : 0}
                    sx={{ width: 60, height: 4, borderRadius: 2 }} />
                  <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub }}>
                    {enrichDetail.fields_filled}/{enrichDetail.fields_total}
                  </Typography>
                </Box>
              }>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                  {enrichments.map(e => {
                    const sc2 = SOURCE_COLORS[e.source] || { bg: `${C.dim}10`, fg: C.dim, label: e.source };
                    return (
                      <Box key={e.source} sx={{ display: "flex", alignItems: "flex-start", gap: 1, py: 0.5, "&:not(:last-child)": { borderBottom: `1px solid ${C.borderSoft}` } }}>
                        <Chip label={sc2.label} size="small" sx={{ fontFamily: F, fontSize: FS.caption, height: 20, fontWeight: FW.semibold, bgcolor: sc2.bg, color: sc2.fg, border: `1px solid ${sc2.fg}25`, minWidth: 60 }} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.3 }}>
                            {e.provided_fields.map(f => (
                              <Typography key={f} sx={{ fontFamily: F, fontSize: FS.caption, color: C.textMd, bgcolor: C.cardBg, px: 0.5, py: 0.1, borderRadius: "3px" }}>
                                {f.replace(/_/g, " ")}
                              </Typography>
                            ))}
                          </Box>
                        </Box>
                        <Typography sx={{ fontFamily: F, fontSize: FS.micro, color: C.dim, whiteSpace: "nowrap" }}>
                          {e.confidence} · {e.enriched_at?.split("T")[0]}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              </Section>
            )}

            {/* Source aliases */}
            {profile.source_mappings.length > 0 && (
              <Section title="Source Aliases">
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {/* Dedupe by source + name: several source records can share a display
                      name (the unique key is source_company_id), so collapse repeats and
                      show a ×N count instead of identical chips. */}
                  {(() => {
                    const seen = new Map<string, { source_system: string; name: string | null; count: number }>();
                    for (const m of profile.source_mappings) {
                      const name = m.source_company_name ?? null;
                      // Key preserves null vs the literal string "--" so a real "--" name
                      // isn't merged with a missing one; reused as the (stable) Chip key.
                      const key = `${m.source_system}::${name === null ? "null" : name}`;
                      const e = seen.get(key);
                      if (e) e.count += 1;
                      else seen.set(key, { source_system: m.source_system, name, count: 1 });
                    }
                    return Array.from(seen.entries()).map(([key, u]) => (
                      <Chip key={key}
                        label={`${u.source_system}: ${u.name ?? "--"}${u.count > 1 ? ` ×${u.count}` : ""}`}
                        size="small" variant="outlined" sx={{ fontFamily: F, fontSize: FS.caption, height: 22, borderColor: C.borderSoft }} />
                    ));
                  })()}
                </Box>
              </Section>
            )}

            {/* Leads & journey — this account's leads in marketing-funnel order */}
            {journeyLeads.length > 0 && (
              <Section title="Leads & Journey">
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {FUNNEL_ORDER.filter((stage) => journeyLeads.some((l) => l.lead_stage === stage)).map((stage) => {
                    const inStage = journeyLeads.filter((l) => l.lead_stage === stage);
                    return (
                      <Box key={stage}>
                        <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: STAGE_COLOR[stage], textTransform: "uppercase", mb: 0.3 }}>
                          {STAGE_LABEL[stage] ?? stage} · {inStage.length}
                        </Typography>
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                          {inStage.map((l) => (
                            <Chip key={l.id}
                              label={[l.first_name, l.last_name].filter(Boolean).join(" ") || l.email || `#${l.id}`}
                              size="small" variant="outlined"
                              sx={{ fontFamily: F, fontSize: FS.caption, height: 22, borderColor: `${STAGE_COLOR[stage]}55` }} />
                          ))}
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </Section>
            )}
          </Box>
        )}

        {/* ── Contacts tab ────────────────────────────────────────────── */}
        {tab === "contacts" && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <CompanyContactsPanel hasDomain={!!profile.domain} data={contactsData} loading={contactsLoading} onReload={loadContacts} />

            {/* ── Leads (from Pardot) — distinct from contacts, tagged "Lead" ── */}
            {profile.pardot_leads.length > 0 && (
              <Box>
                <Section title={`Leads (${profile.pardot_leads.length})`}
                  action={<Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub }}>From Pardot — open in the lead pipeline</Typography>}>
                  <Box sx={{ borderRadius: "8px", border: `1px solid ${C.border}`, overflow: "hidden" }}>
                    <Box sx={{ display: "grid", gridTemplateColumns: COLS_LEADS, ...TABLE_HEAD_ROW, bgcolor: C.cardBg, borderBottom: `1px solid ${C.border}` }}>
                      {["Name", "Title", "Email", "Stage", ""].map((h, i) => (
                        <Typography key={h || `act${i}`} sx={{ ...LABEL, fontFamily: F, color: C.dim, textAlign: h === "Stage" ? "center" : "left" }}>{h}</Typography>
                      ))}
                    </Box>
                    {profile.pardot_leads.map(l => {
                      const stageColor = (l.lead_stage && STAGE_COLOR[l.lead_stage]) || C.dim;
                      const name = [l.first_name, l.last_name].filter(Boolean).join(" ") || l.email || `Lead #${l.id}`;
                      return (
                        <Box key={l.id} onClick={() => navigate(isacPath(`/leads/${l.id}`))} sx={{
                          display: "grid", gridTemplateColumns: COLS_LEADS, ...TABLE_ROW,
                          cursor: "pointer", borderBottom: `1px solid ${C.borderSoft}`, "&:hover": { bgcolor: `${C.orange}03` },
                        }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
                            <Typography noWrap sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: C.text }}>{name}</Typography>
                            <Chip label="Lead" size="small" sx={{ fontFamily: F, fontSize: FS.micro, height: 16, fontWeight: FW.semibold, bgcolor: `${C.orange}12`, color: C.orange, border: `1px solid ${C.orange}30` }} />
                          </Box>
                          <Typography noWrap sx={{ fontFamily: F, fontSize: FS.small, color: C.textMd }}>{l.job_title || "--"}</Typography>
                          <Typography noWrap sx={{ fontFamily: F, fontSize: FS.small, color: C.text }}>{l.email || "--"}</Typography>
                          {l.lead_stage
                            ? <Chip label={l.lead_stage} size="small" sx={{ fontFamily: F, fontSize: FS.micro, height: 18, fontWeight: FW.semibold, color: "#fff", bgcolor: stageColor }} />
                            : <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.dim, textAlign: "center" }}>--</Typography>}
                          <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.orange }}>View</Typography>
                        </Box>
                      );
                    })}
                  </Box>
                </Section>
              </Box>
            )}
          </Box>
        )}

        {/* ── Source Data tab ──────────────────────────────────────────── */}
        {tab === "engagement" && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {(() => {
              const g2 = engagement?.g2;
              const li = engagement?.linkedin;
              const hasG2 = !!g2 && (g2.total_pageviews > 0 || g2.products.length > 0 || g2.top_pages.length > 0 || g2.signals.length > 0);
              const hasLi = !!li && (li.total_impressions > 0 || li.campaigns.length > 0 || liFrom !== "" || liTo !== "");
              if (!engagement || (!hasG2 && !hasLi)) {
                return (
                  <Typography sx={{ fontFamily: F, fontSize: FS.body, color: C.dim, py: 4, textAlign: "center" }}>
                    No G2 or LinkedIn engagement recorded for this company yet.
                  </Typography>
                );
              }
              const maxSignal = hasG2 ? Math.max(...g2!.signals.map(s => s.views), 1) : 1;
              return (
                <>
                  {/* ── G2 — Product interest & intent ─────────────────────── */}
                  {hasG2 && (
                    <Section title="G2 — What they're researching">
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 1.5 }}>
                        {g2!.buying_stage && <Chip label={`Stage: ${g2!.buying_stage}`} size="small" sx={{ fontFamily: F, fontSize: FS.caption, height: 22, bgcolor: `${C.red}10`, color: C.red, fontWeight: FW.semibold }} />}
                        {g2!.activity_level && <Chip label={`Activity: ${g2!.activity_level}`} size="small" sx={{ fontFamily: F, fontSize: FS.caption, height: 22, bgcolor: `${C.amber}10`, color: C.amber, fontWeight: FW.semibold }} />}
                        <Chip label={`${g2!.total_pageviews.toLocaleString()} total views`} size="small" sx={{ fontFamily: F, fontSize: FS.caption, height: 22, bgcolor: C.cardBg, color: C.textMd }} />
                        {g2!.last_seen && <Chip label={`Last seen ${g2!.last_seen.split("T")[0]}`} size="small" sx={{ fontFamily: F, fontSize: FS.caption, height: 22, bgcolor: C.cardBg, color: C.sub }} />}
                      </Box>

                      {/* Intent-signal breakdown as proportional bars */}
                      {g2!.signals.length > 0 && (
                        <Box sx={{ mb: 1.5 }}>
                          <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.sub, textTransform: "uppercase", letterSpacing: "0.04em", mb: 0.75 }}>Intent signals</Typography>
                          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                            {g2!.signals.map(s => (
                              <Box key={s.key} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.text, minWidth: 120 }}>{s.label}</Typography>
                                <Box sx={{ flex: 1, height: 8, borderRadius: 4, bgcolor: C.cardBg, overflow: "hidden" }}>
                                  <Box sx={{ width: `${Math.round((s.views / maxSignal) * 100)}%`, height: "100%", bgcolor: s.key === "pricing" || s.key === "comparison" || s.key === "competitors" ? C.red : C.orange }} />
                                </Box>
                                <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.sub, minWidth: 36, textAlign: "right" }}>{s.views.toLocaleString()}</Typography>
                              </Box>
                            ))}
                          </Box>
                        </Box>
                      )}

                      {/* Products researched */}
                      {g2!.products.length > 0 && (
                        <Box sx={{ mb: g2!.top_pages.length > 0 || g2!.intent_topics.length > 0 ? 1.5 : 0 }}>
                          <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.sub, textTransform: "uppercase", letterSpacing: "0.04em", mb: 0.75 }}>Products of interest</Typography>
                          <SourceTable columns={ENG_PRODUCT_COLS} rows={g2!.products.map((p, i) => ({ ...p, id: i }))} />
                        </Box>
                      )}

                      {/* Intent topics (Bombora) */}
                      {g2!.intent_topics.length > 0 && (
                        <Box sx={{ mb: g2!.top_pages.length > 0 ? 1.5 : 0 }}>
                          <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.sub, textTransform: "uppercase", letterSpacing: "0.04em", mb: 0.75 }}>Intent topics</Typography>
                          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                            {g2!.intent_topics.map((t, i) => (
                              <Chip key={i} label={t} size="small" sx={{ fontFamily: F, fontSize: FS.caption, height: 20, bgcolor: `${C.purple}10`, color: C.purple }} />
                            ))}
                          </Box>
                        </Box>
                      )}

                      {/* Pages viewed */}
                      {g2!.top_pages.length > 0 && (
                        <Box>
                          <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.sub, textTransform: "uppercase", letterSpacing: "0.04em", mb: 0.75 }}>Pages viewed</Typography>
                          <SourceTable columns={ENG_PAGE_COLS} rows={g2!.top_pages.map((p, i) => ({ ...p, id: i }))} />
                        </Box>
                      )}
                    </Section>
                  )}

                  {/* ── LinkedIn — campaigns reached ───────────────────────── */}
                  {hasLi && (
                    <Section
                      title="LinkedIn — Campaigns that reached them"
                      action={
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                          <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.sub, textTransform: "uppercase", letterSpacing: "0.04em" }}>Period</Typography>
                          <TextField
                            size="small" type="date" value={liFrom} inputProps={{ max: liTo || undefined, "aria-label": "LinkedIn stats period start" }}
                            onChange={(e) => setLiFrom(e.target.value)}
                            sx={{ "& .MuiInputBase-root": { fontFamily: F, fontSize: FS.small, height: 28, borderRadius: "7px", bgcolor: C.cardBg, "& fieldset": { borderColor: C.borderSoft } } }}
                          />
                          <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.dim }}>–</Typography>
                          <TextField
                            size="small" type="date" value={liTo} inputProps={{ min: liFrom || undefined, "aria-label": "LinkedIn stats period end" }}
                            onChange={(e) => setLiTo(e.target.value)}
                            sx={{ "& .MuiInputBase-root": { fontFamily: F, fontSize: FS.small, height: 28, borderRadius: "7px", bgcolor: C.cardBg, "& fieldset": { borderColor: C.borderSoft } } }}
                          />
                          {(liFrom || liTo) && (
                            <Chip
                              label="All time" size="small" clickable
                              onClick={() => { setLiFrom(""); setLiTo(""); }}
                              sx={{ fontFamily: F, height: 22, fontSize: FS.caption, fontWeight: FW.semibold, bgcolor: C.cardBg, color: C.sub, border: `1px solid ${C.borderSoft}` }}
                            />
                          )}
                        </Box>
                      }
                    >
                      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 1.5, mb: 1.5 }}>
                        <MetricCard label="Impressions" value={li!.total_impressions} color="#0A66C2" />
                        <MetricCard label="Clicks" value={li!.total_clicks} color="#0A66C2" />
                        <MetricCard label="CTR" value={`${li!.ctr}%`} color="#0A66C2" />
                      </Box>
                      {li!.campaigns.length > 0
                        ? <CampaignAdsTable campaigns={li!.campaigns} />
                        : <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.dim, py: 1 }}>
                            {liFrom || liTo ? "No LinkedIn activity for this company in the selected period." : "Impressions recorded but no per-campaign breakdown available."}
                          </Typography>}
                      {li!.campaigns.some((c) => c.ads.length > 0) && (
                        <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.dim, mt: 0.75 }}>
                          Expand a campaign (▸) to see the currently running ads that reached this company. Stats follow the selected period (all-time by default); ad-level history only reaches back to the start of the ad-stats window.
                        </Typography>
                      )}
                    </Section>
                  )}

                </>
              );
            })()}
          </Box>
        )}

        {tab === "reo" && (() => {
          const reoAccts = reoData?.accounts ?? [];
          const reoLeads = reoData?.leads ?? [];
          const reoSegments = [...new Set(reoAccts.map((a) => a.segment_name).filter((s): s is string => !!s))];
          if (reoAccts.length === 0 && reoLeads.length === 0) {
            return (
              <Typography sx={{ fontFamily: F, fontSize: FS.body, color: C.dim, py: 4, textAlign: "center" }}>
                No Reo.dev developer intent recorded for this company yet.
              </Typography>
            );
          }
          return (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Section title="Reo.dev — Developer intent" action={<SourceTag source="reo.dev" />}>
                {[...reoAccts].sort((x, y) => (y.reo_score ?? 0) - (x.reo_score ?? 0)).map((a) => {
                  const funnelColor = REO_FUNNEL_COLORS[(a.developer_funnel || "").toLowerCase()] || C.slate;
                  // Dedupe so chips are unique (stable React keys) even if Reo repeats a technology.
                  const techs = [...new Set((a.preferred_technology || "").split(",").map((t) => t.trim()).filter(Boolean))];
                  return (
                    <Box key={a.id} sx={{ mb: 1.5 }}>
                      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75 }}>
                        {/* A company can match several distinct Reo account records (e.g. consumer
                            mail-domain residue like live.se) — label each row so it's clear which
                            Reo account the chips describe. */}
                        <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.textMd, mr: 0.25 }}>
                          {a.account_domain || a.raw_company_name || a.reo_account_id}
                        </Typography>
                        {a.developer_funnel && (
                          <Tooltip title="Reo developer-adoption funnel: Exploring → Evaluating → Building → Deployed" arrow>
                            <Chip label={`Funnel: ${a.developer_funnel}`} size="small" sx={{ fontFamily: F, fontSize: FS.caption, height: 22, bgcolor: `${funnelColor}14`, color: funnelColor, fontWeight: FW.semibold }} />
                          </Tooltip>
                        )}
                        {a.reo_score != null && <Chip label={`Reo score: ${a.reo_score}`} size="small" sx={{ fontFamily: F, fontSize: FS.caption, height: 22, bgcolor: `${C.purple}12`, color: C.purple, fontWeight: FW.semibold }} />}
                        {a.developer_activity && <Chip label={`Dev activity: ${a.developer_activity}`} size="small" sx={{ fontFamily: F, fontSize: FS.caption, height: 22, bgcolor: C.cardBg, color: C.textMd }} />}
                        {a.customer_fit && <Chip label={`Fit: ${a.customer_fit}`} size="small" sx={{ fontFamily: F, fontSize: FS.caption, height: 22, bgcolor: C.cardBg, color: C.textMd }} />}
                        {a.active_developers_count != null && <Chip label={`${a.active_developers_count} active devs`} size="small" sx={{ fontFamily: F, fontSize: FS.caption, height: 22, bgcolor: C.cardBg, color: C.textMd }} />}
                        {a.reo_account_link && (
                          <Tooltip title="View this account in Reo.dev" arrow>
                            <IconButton size="small" component="a" href={a.reo_account_link} target="_blank" rel="noopener noreferrer" aria-label="View in Reo.dev" sx={{ p: 0.25, color: C.purple }}><LaunchIcon sx={{ fontSize: 13 }} /></IconButton>
                          </Tooltip>
                        )}
                      </Box>
                      {techs.length > 0 && (
                        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.5, mt: 0.75 }}>
                          <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.dim, textTransform: "uppercase", letterSpacing: "0.04em", mr: 0.25 }}>Engaged technologies</Typography>
                          {techs.map((t) => {
                            const isWso2 = /wso2/i.test(t);
                            return <Chip key={t} label={t} size="small" sx={{ fontFamily: F, fontSize: FS.caption, height: 20, fontWeight: isWso2 ? FW.semibold : FW.regular, bgcolor: isWso2 ? `${C.orange}14` : C.cardBg, color: isWso2 ? C.orange : C.textMd }} />;
                          })}
                        </Box>
                      )}
                    </Box>
                  );
                })}
                {reoSegments.length > 0 && (
                  <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.5, mb: 1.5 }}>
                    <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.dim, textTransform: "uppercase", letterSpacing: "0.04em", mr: 0.25 }}>Reo segments</Typography>
                    {reoSegments.map((s) => <Chip key={s} label={s} size="small" sx={{ fontFamily: F, fontSize: FS.caption, height: 20, bgcolor: `${C.purple}10`, color: C.purple }} />)}
                  </Box>
                )}
                <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.sub, textTransform: "uppercase", letterSpacing: "0.04em", mb: 0.75 }}>
                  Contacts — developers &amp; buyers ({reoLeads.length})
                </Typography>
                {reoLeads.length === 0 ? (
                  <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.dim }}>No Reo contacts captured for this company.</Typography>
                ) : (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                    {reoLeads.map((l) => (
                      <Box key={l.id} sx={{ display: "flex", alignItems: "center", gap: 0.75, py: 0.5, borderBottom: `1px solid ${C.borderSoft}` }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography noWrap sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: C.text }}>
                            {[l.first_name, l.last_name].filter(Boolean).join(" ") || l.email || "—"}
                          </Typography>
                          <Typography noWrap sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub }}>
                            {[l.job_title, l.email, l.activity_score && `Activity: ${l.activity_score}`].filter(Boolean).join(" · ")}
                          </Typography>
                        </Box>
                        {l.linkedin_url && <IconButton size="small" component="a" href={l.linkedin_url} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn profile" sx={{ p: 0.25, color: "#0077b5" }}><LinkedInIcon sx={{ fontSize: 15 }} /></IconButton>}
                        {l.github_url && <IconButton size="small" component="a" href={l.github_url} target="_blank" rel="noopener noreferrer" aria-label="GitHub profile" sx={{ p: 0.25, color: C.textMd }}><GitHubIcon sx={{ fontSize: 14 }} /></IconButton>}
                        {l.reo_developer_link && <IconButton size="small" component="a" href={l.reo_developer_link} target="_blank" rel="noopener noreferrer" aria-label="View in Reo.dev" sx={{ p: 0.25, color: C.purple }}><LaunchIcon sx={{ fontSize: 13 }} /></IconButton>}
                        {l.reo_score != null && <Chip label={l.reo_score} size="small" sx={{ height: 20, fontSize: FS.caption, fontWeight: FW.semibold, color: C.purple, bgcolor: `${C.purple}12` }} />}
                        {l.status === "promoted"
                          ? <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.green, fontWeight: FW.semibold }}>Promoted</Typography>
                          : <Button size="small" variant="outlined" onClick={() => promoteReoLead(l.id)} sx={{ textTransform: "none", fontSize: FS.caption, py: 0.1, minWidth: 0, px: 1, borderColor: C.border, color: C.textMd }}>Promote</Button>}
                      </Box>
                    ))}
                  </Box>
                )}
              </Section>
            </Box>
          );
        })()}

        {tab === "sources" && (
          <Box>
            {/* Counts are the true totals; each list holds at most `section_limit` newest rows. */}
            <SourceAccordion title="Salesforce Accounts" count={sc.sf_accounts} columns={SF_COLS} rows={profile.sf_accounts} limit={profile.section_limit} />
            <SourceAccordion title="Certifications" count={sc.certifications} columns={CERT_COLS} rows={profile.certifications} limit={profile.section_limit} />
            <SourceAccordion title="Pardot Leads" count={sc.pardot_leads} columns={LEAD_COLS} rows={profile.pardot_leads} limit={profile.section_limit} />
            <SourceAccordion title="Pardot Snapshots" count={sc.pardot_snapshots} columns={SNAP_COLS} rows={profile.pardot_snapshots} limit={profile.section_limit} />
            <SourceAccordion title="LinkedIn Analytics" count={sc.linkedin} columns={LI_COLS} rows={profile.linkedin_stats} limit={profile.section_limit} />
            <SourceAccordion title="G2 Visits" count={sc.g2_visits} columns={VISIT_COLS} rows={profile.g2_visits} limit={profile.section_limit} />
            <SourceAccordion title="G2 Intent" count={sc.g2_intent} columns={INTENT_COLS} rows={profile.g2_intent} limit={profile.section_limit} />
          </Box>
        )}
      </Box>

      {/* ── Enrichment Review Dialog ──────────────────────────────────── */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth
        PaperProps={{ sx: { fontFamily: F, borderRadius: "12px", border: `1px solid ${C.border}` } }}>
        <DialogTitle sx={{ fontFamily: F, fontWeight: FW.bold, fontSize: FS.title, pb: 0.5, display: "flex", alignItems: "center", gap: 1 }}>
          <BoltIcon sx={{ color: C.orange, fontSize: 20 }} />
          Review Enrichment — {profile.canonical_name}
        </DialogTitle>
        <Box sx={{ px: 3, pb: 1, display: "flex", gap: 1, alignItems: "center" }}>
          <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.sub }}>
            {selectedFields.size} of {previewFields.length} fields selected
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Typography onClick={selectAll} sx={{ fontFamily: F, fontSize: FS.caption, color: C.orange, cursor: "pointer", fontWeight: FW.semibold, "&:hover": { textDecoration: "underline" } }}>
            Select all
          </Typography>
          <Typography onClick={selectNone} sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub, cursor: "pointer", "&:hover": { textDecoration: "underline" } }}>
            Deselect all
          </Typography>
        </Box>
        <DialogContent sx={{ pt: 0, px: 3 }}>
          {/* Column headers */}
          <Box sx={{ display: "grid", gridTemplateColumns: COLS_PREVIEW, gap: 1, mb: 0.5, px: 0.5, alignItems: "center" }}>
            <Box />
            <Typography sx={{ ...LABEL, fontFamily: F, color: C.dim }}>Field</Typography>
            <Typography sx={{ ...LABEL, fontFamily: F, color: C.dim }}>Current Value</Typography>
            <Box />
            <Typography sx={{ ...LABEL, fontFamily: F, color: C.dim }}>New Value</Typography>
            <Typography sx={{ ...LABEL, fontFamily: F, color: C.dim, textAlign: "center" }}>Source</Typography>
          </Box>
          <Divider sx={{ mb: 0.5 }} />

          {previewFields.map(f => {
            const checked = selectedFields.has(f.field);
            const sc2 = SOURCE_COLORS[f.source || ""] || { bg: `${C.dim}10`, fg: C.dim, label: f.source || "" };
            const currentStr = f.current_value != null ? String(f.current_value) : "--";
            const newStr = f.new_display != null ? String(f.new_display) : "--";

            return (
              <Box key={f.field} onClick={() => toggleField(f.field)} sx={{
                display: "grid", gridTemplateColumns: COLS_PREVIEW, gap: 1,
                py: 0.75, px: 0.5, alignItems: "center", cursor: "pointer",
                borderRadius: "6px", transition: "background 0.1s",
                bgcolor: checked ? `${C.orange}04` : "transparent",
                "&:hover": { bgcolor: checked ? `${C.orange}08` : `${C.cardBg}` },
                "&:not(:last-child)": { borderBottom: `1px solid ${C.borderSoft}` },
              }}>
                <Checkbox size="small" checked={checked} sx={{ p: 0, color: C.dim, "&.Mui-checked": { color: C.orange } }} />

                {/* Field name */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Typography sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: C.text }}>
                    {f.label}
                  </Typography>
                  {f.is_conflict && (
                    <Tooltip title="This will overwrite existing data" arrow>
                      <SwapHorizIcon sx={{ fontSize: 14, color: C.amber }} />
                    </Tooltip>
                  )}
                  {f.is_new_only && (
                    <Tooltip title="New field — no existing data" arrow>
                      <AddCircleOutlineIcon sx={{ fontSize: 12, color: C.green }} />
                    </Tooltip>
                  )}
                </Box>

                {/* Current value */}
                <Typography noWrap sx={{
                  fontFamily: F, fontSize: FS.small,
                  color: f.has_current ? C.textMd : C.dim,
                  fontStyle: f.has_current ? "normal" : "italic",
                }}>
                  {currentStr}
                </Typography>

                {/* Arrow */}
                <Typography sx={{ fontFamily: F, fontSize: FS.body, color: C.dim, textAlign: "center" }}>
                  {f.has_new ? "\u2192" : ""}
                </Typography>

                {/* New value */}
                <Typography noWrap sx={{
                  fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold,
                  color: f.is_conflict ? C.amber : C.green,
                }}>
                  {newStr}
                </Typography>

                {/* Source badge */}
                {f.source && (
                  <Chip label={sc2.label} size="small" sx={{
                    fontFamily: F, fontSize: FS.micro, height: 18, fontWeight: FW.semibold,
                    bgcolor: sc2.bg, color: sc2.fg, border: `1px solid ${sc2.fg}25`,
                  }} />
                )}
              </Box>
            );
          })}

          {previewFields.length === 0 && (
            <Typography sx={{ fontFamily: F, fontSize: FS.body, color: C.dim, py: 3, textAlign: "center" }}>
              No new enrichment data found.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 1, gap: 1 }}>
          <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: 0.5 }}>
            {previewFields.some(f => f.is_conflict && selectedFields.has(f.field)) && (
              <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.amber, fontWeight: FW.medium }}>
                {previewFields.filter(f => f.is_conflict && selectedFields.has(f.field)).length} field(s) will overwrite existing data
              </Typography>
            )}
          </Box>
          <Button onClick={() => setPreviewOpen(false)} sx={{ fontFamily: F, textTransform: "none", fontSize: FS.small, color: C.sub }}>
            Cancel
          </Button>
          <Button variant="contained" disabled={selectedFields.size === 0 || applying}
            onClick={handleApply}
            startIcon={applying ? <CircularProgress size={14} /> : <CheckCircleIcon sx={{ fontSize: 16 }} />}
            sx={{
              fontFamily: F, textTransform: "none", fontSize: FS.small, borderRadius: "8px",
              bgcolor: C.orange, "&:hover": { bgcolor: C.orangeDark },
            }}>
            {applying ? "Applying..." : `Apply ${selectedFields.size} field${selectedFields.size !== 1 ? "s" : ""}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Contact Discovery Dialog ─────────────────────────────────── */}
      <Dialog open={discoverDialogOpen} onClose={() => setDiscoverDialogOpen(false)} maxWidth="md" fullWidth
        PaperProps={{ sx: { fontFamily: F, borderRadius: "12px", border: `1px solid ${C.border}` } }}>
        <DialogTitle sx={{ fontFamily: F, fontWeight: FW.bold, fontSize: FS.title, pb: 0.5 }}>
          Discovered Contacts — {profile.canonical_name}
        </DialogTitle>
        <Box sx={{ px: 3, pb: 1, display: "flex", gap: 1, alignItems: "center" }}>
          <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.sub }}>
            {selectedContactIdxs.size} of {discoveredContacts.length} contacts selected
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Typography onClick={() => setSelectedContactIdxs(new Set(discoveredContacts.map((_: DiscoveredContact, i: number) => i)))}
            sx={{ fontFamily: F, fontSize: FS.caption, color: C.orange, cursor: "pointer", fontWeight: FW.semibold, "&:hover": { textDecoration: "underline" } }}>
            Select all
          </Typography>
          <Typography onClick={() => setSelectedContactIdxs(new Set())}
            sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub, cursor: "pointer", "&:hover": { textDecoration: "underline" } }}>
            Deselect all
          </Typography>
        </Box>
        <DialogContent sx={{ pt: 0, px: 3 }}>
          {/* Header */}
          <Box sx={{ display: "grid", gridTemplateColumns: COLS_DISCOVER, gap: 1, mb: 0.5, px: 0.5, alignItems: "center" }}>
            <Box />
            <Typography sx={{ ...LABEL, fontFamily: F, color: C.dim }}>Name</Typography>
            <Typography sx={{ ...LABEL, fontFamily: F, color: C.dim }}>Title</Typography>
            <Typography sx={{ ...LABEL, fontFamily: F, color: C.dim, textAlign: "center" }}>Source</Typography>
          </Box>
          <Divider sx={{ mb: 0.5 }} />
          {discoveredContacts.map((c, i) => {
            const checked = selectedContactIdxs.has(i);
            const s = SOURCE_COLORS[c.source] || { bg: `${C.dim}10`, fg: C.dim, label: c.source };
            return (
              <Box key={i} onClick={() => toggleContact(i)} sx={{
                display: "grid", gridTemplateColumns: COLS_DISCOVER, gap: 1,
                py: 0.75, px: 0.5, alignItems: "center", cursor: "pointer", borderRadius: "6px",
                bgcolor: checked ? `${C.orange}04` : "transparent",
                "&:hover": { bgcolor: checked ? `${C.orange}08` : C.cardBg },
                "&:not(:last-child)": { borderBottom: `1px solid ${C.borderSoft}` },
              }}>
                <Checkbox size="small" checked={checked} sx={{ p: 0, color: C.dim, "&.Mui-checked": { color: C.orange } }} />
                <Typography sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: C.text }}>
                  {c.first_name} {c.last_name || ""}
                </Typography>
                <Typography noWrap sx={{ fontFamily: F, fontSize: FS.small, color: C.textMd }}>
                  {c.job_title || "--"}
                </Typography>
                <Chip label={s.label} size="small" sx={{ fontFamily: F, fontSize: FS.micro, height: 18, fontWeight: FW.semibold, bgcolor: s.bg, color: s.fg, border: `1px solid ${s.fg}25` }} />
              </Box>
            );
          })}
          {discoveredContacts.length === 0 && (
            <Typography sx={{ fontFamily: F, fontSize: FS.body, color: C.dim, py: 3, textAlign: "center" }}>
              No contacts found for this company.
            </Typography>
          )}
          <Box sx={{ mt: 1.5, px: 0.5 }}>
            <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub }}>
              Provider discovery is free. Revealing email / direct / mobile costs credits — select contacts in the Contacts tab to see the exact cost before confirming.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 1, gap: 1 }}>
          <Box sx={{ flex: 1 }} />
          <Button onClick={() => setDiscoverDialogOpen(false)} sx={{ fontFamily: F, textTransform: "none", fontSize: FS.small, color: C.sub }}>
            Cancel
          </Button>
          <Button variant="contained" disabled={selectedContactIdxs.size === 0 || savingContacts}
            onClick={handleSaveContacts}
            startIcon={savingContacts ? <CircularProgress size={14} /> : <CheckCircleIcon sx={{ fontSize: 16 }} />}
            sx={{ fontFamily: F, textTransform: "none", fontSize: FS.small, borderRadius: "8px", bgcolor: C.orange, "&:hover": { bgcolor: C.orangeDark } }}>
            {savingContacts ? "Saving..." : `Save ${selectedContactIdxs.size} contact${selectedContactIdxs.size !== 1 ? "s" : ""}`}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!syncMsg} autoHideDuration={6000} onClose={() => setSyncMsg(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }} message={syncMsg ?? ""} />
    </Box>
  );
}
