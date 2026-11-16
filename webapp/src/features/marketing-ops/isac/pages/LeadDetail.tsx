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
  Box, Button, Chip, CircularProgress, IconButton, LinearProgress, Tooltip, Typography,
} from "@wso2/oxygen-ui";
import { ArrowBack as ArrowBackIcon } from "../icons";
import { Bolt as BoltIcon } from "../icons";
import { Business as BusinessIcon } from "../icons";
import { Launch as LaunchIcon } from "../icons";
import { LinkedIn as LinkedInIcon } from "../icons";
import { OpenInNew as OpenInNewIcon } from "../icons";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useApiClient } from "../api/client";
import EnrichLeadDialog from "../components/EnrichLeadDialog";
import { DoNotCallChip } from "../components/RevealContactsDialog";
import { isacPath, sfRecordUrl } from "../paths";
import { C, F } from "../theme/pageTokens";
import { FS, FW } from "../theme/typeScale";

/** Shared palette — identical to Companies / CompanyDetail for cross-page consistency. */
const STAGE_ORDER = ["subscriber", "lead", "mql", "sql", "opportunity", "customer"];
const STAGE_LABEL: Record<string, string> = {
  subscriber: "Prospect", lead: "Lead", mql: "MQL", sql: "SQL", opportunity: "Opportunity", customer: "Customer",
};
const STAGE_COLOR: Record<string, string> = {
  subscriber: C.slate, lead: C.blue, mql: C.amber, get sql() { return C.orange; }, opportunity: C.purple, customer: C.green,
};
const SOURCE_COLORS: Record<string, { bg: string; fg: string }> = {
  apollo: { bg: `${C.blue}12`, fg: C.blue }, zoominfo: { bg: `${C.purple}12`, fg: C.purple }, ai: { bg: `${C.green}12`, fg: C.green },
};
/** Fields enrichment can fill — drives the completeness bar (mirrors the lead orchestrator). */
const ENRICHABLE = ["first_name", "last_name", "job_title", "seniority", "department", "linkedin_url", "phone", "mobile_phone", "city", "state", "country"] as const;

/** Enrichment audit entry attached to a lead. */
interface LeadEnrichmentRecord { source: string; status: string; fields: string[] | null; enriched_at: string | null; }
/** Full lead-detail payload from GET /lead-enrichment/lead/{id}. */
interface LeadDetailData {
  id: number; email: string | null; first_name: string | null; last_name: string | null;
  job_title: string | null; seniority: string | null; department: string | null;
  phone: string | null; mobile_phone: string | null; city: string | null; state: string | null; country: string | null;
  region: string | null;
  match_confidence: number | null; email_status: string | null;
  direct_phone_do_not_call: boolean | null; mobile_phone_do_not_call: boolean | null;
  crm_lead_fid: string | null; crm_contact_fid: string | null;
  linkedin_url: string | null; company_id: number | null; company_name: string | null;
  raw_company_name: string | null; lead_stage: string | null; lead_type: string | null;
  lead_status: string | null; grade: string | null; campaign: string | null; source: string | null;
  enrichment_status: string | null; do_not_email: boolean; do_not_call: boolean; opted_out: boolean;
  last_activity_at: string | null; created_date: string | null; is_converted: boolean | null;
  rating: string | null; website_consent_status: string | null; choreo_consent_status: string | null; asgardeo_consent_status: string | null;
  industry: string | null; employees: number | null; website: string | null; annual_revenue: number | null;
  enrichments: LeadEnrichmentRecord[];
}

/** Display name for a lead (name → email local-part → id). */
function leadName(l: LeadDetailData): string {
  return [l.first_name, l.last_name].filter(Boolean).join(" ") || (l.email ? l.email.split("@")[0] : "") || `Lead #${l.id}`;
}
/** Pretty date (date only) from an ISO string. */
function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Compact KPI card — matches CompanyDetail's MetricCard. */
function MetricCard({ label, value, color, sub }: { label: string; value: string | number; color: string; sub?: string }) {
  return (
    <Box sx={{ p: 1.5, borderRadius: "10px", bgcolor: C.panel, border: `1px solid ${C.border}`, minWidth: 0 }}>
      <Typography noWrap sx={{ fontFamily: F, fontSize: FS.title, fontWeight: FW.bold, color, lineHeight: 1.2, textTransform: "capitalize" }}>
        {value === "" || value == null ? "--" : value}
      </Typography>
      <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.sub, textTransform: "uppercase", letterSpacing: "0.04em", mt: 0.25 }}>{label}</Typography>
      {sub && <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.dim, mt: 0.15 }}>{sub}</Typography>}
    </Box>
  );
}
/** Titled panel — matches CompanyDetail's Section. */
function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Box sx={{ p: 2, borderRadius: "10px", border: `1px solid ${C.border}`, bgcolor: C.panel }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
        <Typography sx={{ fontFamily: F, fontSize: FS.body, fontWeight: FW.semibold, color: C.text }}>{title}</Typography>
        {action}
      </Box>
      {children}
    </Box>
  );
}
/** Width of the key column in key/value rows. DataRow and the hand-built
 *  LinkedIn row share it so every value starts on the same vertical line. */
const KV_LABEL_W = 110;
/** Key/value row — matches CompanyDetail's DataRow. */
function DataRow({ label, value, emptyText, adornment }: { label: string; value?: string | number | null; emptyText?: string; adornment?: React.ReactNode }) {
  const isEmpty = !value && value !== 0;
  // Hidden when empty by default; pass emptyText to keep the row and show an
  // explicit "not there" placeholder (e.g. Phone → "Not available").
  if (isEmpty && !emptyText) return null;
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, py: 0.4, "&:not(:last-child)": { borderBottom: `1px solid ${C.borderSoft}` } }}>
      <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.sub, minWidth: KV_LABEL_W, fontWeight: FW.medium }}>{label}</Typography>
      <Typography sx={{ fontFamily: F, fontSize: FS.small, color: isEmpty ? C.sub : C.text, fontStyle: isEmpty ? "italic" : "normal", fontWeight: FW.medium, flex: 1, wordBreak: "break-word" }}>{isEmpty ? emptyText : String(value)}</Typography>
      {!isEmpty && adornment}
    </Box>
  );
}

/** Lead profile — full detail for one lead, visually aligned with the Company detail page. */
export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { get } = useApiClient();
  const [lead, setLead] = useState<LeadDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrichOpen, setEnrichOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try { setLead(await get<LeadDetailData>(`/lead-enrichment/lead/${id}`)); }
    catch { setLead(null); } finally { setLoading(false); }
  }, [get, id]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", pt: 10 }}><CircularProgress size={24} sx={{ color: C.orange }} /></Box>;
  if (!lead) return (
    <Box sx={{ p: 3, fontFamily: F }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(isacPath("/leads"))} sx={{ textTransform: "none", fontFamily: F, color: C.textMd }}>Back to Leads</Button>
      <Typography sx={{ fontFamily: F, mt: 2 }}>Lead not found.</Typography>
    </Box>
  );

  const sc = (lead.lead_stage && STAGE_COLOR[lead.lead_stage]) || C.slate;
  const stageIdx = lead.lead_stage ? STAGE_ORDER.indexOf(lead.lead_stage) : -1;
  const location = [lead.city, lead.state, lead.country].filter(Boolean).join(", ");
  const optOuts = [lead.do_not_email && "Do not email", lead.do_not_call && "Do not call", lead.opted_out && "Opted out"].filter(Boolean) as string[];
  const filled = ENRICHABLE.filter((f) => !!(lead as unknown as Record<string, unknown>)[f]).length;
  const lastDate = fmtDate(lead.last_activity_at) || fmtDate(lead.created_date);
  const ratingColor = lead.rating === "Hot" ? C.orange : lead.rating === "Warm" ? C.amber : lead.rating === "Cold" ? C.blue : C.text;

  return (
    <Box sx={{ fontFamily: F, bgcolor: C.bg, minHeight: "100%", overflow: "hidden" }}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <Box sx={{ px: 2.5, py: 2, bgcolor: C.panel, borderBottom: `1px solid ${C.border}` }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
          <IconButton size="small" onClick={() => navigate(isacPath("/leads"))} sx={{ color: C.sub }}><ArrowBackIcon fontSize="small" /></IconButton>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Typography sx={{ fontFamily: F, fontSize: FS.display, fontWeight: FW.bold, color: C.text }}>{leadName(lead)}</Typography>
              {lead.lead_stage && (
                <Chip label={STAGE_LABEL[lead.lead_stage] ?? lead.lead_stage} size="small"
                  sx={{ height: 18, fontSize: FS.micro, fontWeight: FW.semibold, bgcolor: `${sc}14`, color: sc, border: `1px solid ${sc}30` }} />
              )}
              {lead.enrichment_status === "enriched" && (
                <Chip label="Enriched" size="small" sx={{ height: 18, fontSize: FS.micro, fontWeight: FW.semibold, bgcolor: `${C.green}12`, color: C.green, border: `1px solid ${C.green}30` }} />
              )}
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.25, flexWrap: "wrap" }}>
              {lead.email && (
                <Typography component="a" href={`mailto:${lead.email}`}
                  sx={{ fontFamily: F, fontSize: FS.small, color: C.orange, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
                  {lead.email} <LaunchIcon sx={{ fontSize: 10, verticalAlign: "middle" }} />
                </Typography>
              )}
              {location && <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.sub }}>{location}</Typography>}
              {lead.linkedin_url && (
                <Tooltip title="LinkedIn profile" arrow>
                  <IconButton size="small" component="a" href={lead.linkedin_url} target="_blank" rel="noopener noreferrer" sx={{ color: "#0A66C2", p: 0.25 }}>
                    <LinkedInIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.5 }}>
            <Box sx={{ display: "flex", gap: 0.75 }}>
              {(() => {
                // Deep link to the SF record — Lead id first, else the converted Contact id.
                const sfUrl = sfRecordUrl("Lead", lead.crm_lead_fid) || sfRecordUrl("Contact", lead.crm_contact_fid);
                return sfUrl && (
                  <Button size="small" variant="outlined" component="a" href={sfUrl} target="_blank" rel="noopener noreferrer"
                    startIcon={<LaunchIcon sx={{ fontSize: 14 }} />}
                    sx={{ fontFamily: F, textTransform: "none", fontSize: FS.small, fontWeight: FW.semibold, borderRadius: "8px", px: 1.5, py: 0.7, borderColor: "#0176d3", color: "#0176d3", "&:hover": { borderColor: "#0176d3", bgcolor: "#0176d30a" } }}>
                    Open in Salesforce
                  </Button>
                );
              })()}
              <Button size="small" variant="contained" disableElevation startIcon={<BoltIcon sx={{ fontSize: 18 }} />} onClick={() => setEnrichOpen(true)}
                sx={{ fontFamily: F, textTransform: "none", fontSize: FS.body, fontWeight: FW.semibold, borderRadius: "8px", px: 2.5, py: 0.75, bgcolor: C.orange, color: "#fff", "&:hover": { bgcolor: C.orangeDark } }}>
                Enrich Lead
              </Button>
            </Box>
            {lastDate && <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.dim }}>Last activity: {lastDate}</Typography>}
          </Box>
        </Box>

        {/* Tags row */}
        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.5 }}>
          {lead.lead_type && <Chip label={lead.lead_type} size="small" sx={{ fontFamily: F, fontSize: FS.caption, height: 22, bgcolor: C.cardBg, color: C.textMd }} />}
          {lead.grade && <Chip label={`Grade ${lead.grade}`} size="small" sx={{ fontFamily: F, fontSize: FS.caption, height: 22, bgcolor: `${C.purple}10`, color: C.purple }} />}
          {lead.source && <Chip label={lead.source} size="small" sx={{ fontFamily: F, fontSize: FS.caption, height: 22, bgcolor: C.cardBg, color: C.sub }} />}
          {optOuts.map((o) => <Chip key={o} label={o} size="small" sx={{ fontFamily: F, fontSize: FS.caption, height: 22, bgcolor: `${C.amber}12`, color: C.amber, fontWeight: FW.semibold }} />)}
        </Box>
      </Box>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <Box sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 2 }}>

        {/* Key metrics */}
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 1.5 }}>
          <MetricCard label="Stage" value={lead.lead_stage ? STAGE_LABEL[lead.lead_stage] ?? lead.lead_stage : "--"} color={sc} />
          <MetricCard label="Lead Type" value={lead.lead_type || "--"} color={C.text} />
          <MetricCard label="Grade" value={lead.grade || "--"} color={C.blue} />
          <MetricCard label="Rating" value={lead.rating || "--"} color={ratingColor} />
          <MetricCard label="Seniority" value={lead.seniority || "--"} color={C.text} />
          <MetricCard label="Profile" value={`${filled}/${ENRICHABLE.length}`} color={C.orange} sub={filled >= 7 ? "Rich" : filled >= 3 ? "Partial" : "Sparse"} />
          <MetricCard label="Enriched By" value={lead.enrichments.length || "--"} color={lead.enrichments.length ? C.green : C.dim} sub={lead.enrichments.length ? "sources" : undefined} />
        </Box>

        {/* Funnel position */}
        {stageIdx >= 0 && (
          <Section title="Funnel Position">
            <Box sx={{ display: "flex", gap: 0.5 }}>
              {STAGE_ORDER.map((s, i) => {
                const reached = i <= stageIdx; const current = i === stageIdx; const col = STAGE_COLOR[s];
                return (
                  <Tooltip key={s} title={STAGE_LABEL[s]} arrow>
                    <Box sx={{ flex: 1, textAlign: "center" }}>
                      <Box sx={{ height: 6, borderRadius: 3, bgcolor: reached ? col : C.cardBg, opacity: reached && !current ? 0.5 : 1 }} />
                      <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: current ? FW.bold : FW.medium, color: current ? col : reached ? C.textMd : C.dim, mt: 0.5, textTransform: "uppercase", letterSpacing: "0.02em" }}>
                        {STAGE_LABEL[s]}
                      </Typography>
                    </Box>
                  </Tooltip>
                );
              })}
            </Box>
          </Section>
        )}

        {/* Two-column layout */}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
          {/* Left: lead details */}
          <Section title="Lead Details">
            <DataRow label="Email" value={lead.email} />
            <DataRow label="Phone" value={lead.phone} emptyText="Not available" adornment={lead.direct_phone_do_not_call ? <DoNotCallChip /> : undefined} />
            <DataRow label="Mobile" value={lead.mobile_phone} emptyText="Not available" adornment={lead.mobile_phone_do_not_call ? <DoNotCallChip /> : undefined} />
            <DataRow label="Match quality" value={lead.match_confidence != null ? `${Math.round(lead.match_confidence)} / 100` : null} />
            <DataRow label="Title" value={lead.job_title} />
            <DataRow label="Seniority" value={lead.seniority} />
            <DataRow label="Department" value={lead.department} />
            <DataRow label="Region" value={lead.region} />
            <DataRow label="Location" value={location} />
            <DataRow label="Industry" value={lead.industry} />
            <DataRow label="Employees" value={lead.employees} />
            <DataRow label="Annual Revenue" value={lead.annual_revenue} />
            <DataRow label="Website" value={lead.website} />
            {lead.linkedin_url && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, py: 0.4 }}>
                <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.sub, minWidth: KV_LABEL_W, fontWeight: FW.medium }}>LinkedIn</Typography>
                <Typography component="a" href={lead.linkedin_url} target="_blank" rel="noopener noreferrer"
                  sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: "#0A66C2", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
                  <LinkedInIcon sx={{ fontSize: 14 }} /> View profile <LaunchIcon sx={{ fontSize: 11 }} />
                </Typography>
              </Box>
            )}
          </Section>

          {/* Right: engagement + company */}
          <Section title="Engagement & Company">
            {/* Company link card */}
            {lead.company_id ? (
              <Box onClick={() => navigate(isacPath(`/companies/${lead.company_id}`))} sx={{
                display: "flex", alignItems: "center", gap: 1, p: 1.25, mb: 1.25, borderRadius: "8px", cursor: "pointer",
                border: `1px solid ${C.border}`, bgcolor: C.cardBg, transition: "all .15s", "&:hover": { borderColor: C.orange, bgcolor: `${C.orange}06` },
              }}>
                <Box sx={{ width: 30, height: 30, borderRadius: "8px", bgcolor: `${C.orange}14`, color: C.orange, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <BusinessIcon sx={{ fontSize: 17 }} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontFamily: F, fontSize: FS.body, fontWeight: FW.semibold, color: C.text }}>
                    {lead.company_name || lead.raw_company_name || `Company #${lead.company_id}`}
                  </Typography>
                  <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub }}>View company profile</Typography>
                </Box>
                <OpenInNewIcon sx={{ fontSize: 14, color: C.dim }} />
              </Box>
            ) : (
              <Box sx={{ p: 1.25, mb: 1.25, borderRadius: "8px", border: `1px dashed ${C.border}`, bgcolor: C.cardBg }}>
                <Typography sx={{ fontFamily: F, fontSize: FS.body, color: C.textMd, fontWeight: FW.medium }}>{lead.raw_company_name || "No company"}</Typography>
                <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.dim, mt: 0.25 }}>Not linked to a company record yet.</Typography>
              </Box>
            )}
            <DataRow label="Lead Status" value={lead.lead_status} />
            <DataRow label="Lead Type" value={lead.lead_type} />
            <DataRow label="Grade" value={lead.grade} />
            <DataRow label="Campaign" value={lead.campaign} />
            <DataRow label="Source" value={lead.source} />
            <DataRow label="Converted" value={lead.is_converted ? "Yes" : null} />
            <DataRow label="Created" value={fmtDate(lead.created_date)} />
            <DataRow label="Last Activity" value={fmtDate(lead.last_activity_at)} />
          </Section>
        </Box>

        {/* Marketing consent */}
        <Section title="Marketing Consent">
          <DataRow label="Website" value={lead.website_consent_status} />
          <DataRow label="Choreo" value={lead.choreo_consent_status} />
          <DataRow label="Asgardeo" value={lead.asgardeo_consent_status} />
        </Section>

        {/* Enrichment history */}
        {lead.enrichments.length > 0 && (
          <Section title="Enrichment History" action={
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <LinearProgress variant="determinate" value={(filled / ENRICHABLE.length) * 100} sx={{ width: 60, height: 4, borderRadius: 2, bgcolor: C.cardBg, "& .MuiLinearProgress-bar": { bgcolor: C.orange } }} />
              <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub }}>{filled}/{ENRICHABLE.length}</Typography>
            </Box>
          }>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
              {lead.enrichments.map((e, i) => {
                const s2 = SOURCE_COLORS[e.source] || { bg: `${C.dim}10`, fg: C.dim };
                return (
                  <Box key={i} sx={{ display: "flex", alignItems: "flex-start", gap: 1, py: 0.5, "&:not(:last-child)": { borderBottom: `1px solid ${C.borderSoft}` } }}>
                    <Chip label={e.source} size="small" sx={{ fontFamily: F, fontSize: FS.caption, height: 20, fontWeight: FW.semibold, textTransform: "capitalize", bgcolor: s2.bg, color: s2.fg, border: `1px solid ${s2.fg}25`, minWidth: 60 }} />
                    <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexWrap: "wrap", gap: 0.3 }}>
                      {(e.fields || []).map((f) => (
                        <Typography key={f} sx={{ fontFamily: F, fontSize: FS.caption, color: C.textMd, bgcolor: C.cardBg, px: 0.5, py: 0.1, borderRadius: "3px" }}>{f.replace(/_/g, " ")}</Typography>
                      ))}
                    </Box>
                    <Typography sx={{ fontFamily: F, fontSize: FS.micro, color: C.dim, whiteSpace: "nowrap" }}>{e.status}{e.enriched_at ? ` · ${fmtDate(e.enriched_at)}` : ""}</Typography>
                  </Box>
                );
              })}
            </Box>
          </Section>
        )}
      </Box>

      <EnrichLeadDialog open={enrichOpen} leadId={lead.id} leadName={leadName(lead)} onClose={() => setEnrichOpen(false)} onApplied={load} />
    </Box>
  );
}
