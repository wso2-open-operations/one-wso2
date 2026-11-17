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

import React, { useEffect, useRef, useState } from "react";
import {
  Box, Button, Checkbox, Chip, CircularProgress, Collapse,
  FormControlLabel, Stack, Switch, Tab, Tabs, TextField, Tooltip, Typography,
} from "@wso2/oxygen-ui";
import { WarningAmber as WarningAmberIcon } from "../icons";
import { AutoAwesome as AutoAwesomeIcon } from "../icons";
import { ExpandMore as ExpandMoreIcon } from "../icons";
import { ExpandLess as ExpandLessIcon } from "../icons";
import { OpenInNew as OpenInNewIcon } from "../icons";
import { CheckCircle as CheckCircleIcon } from "../icons";
import { Tune as TuneIcon } from "../icons";
import { FileDownload as FileDownloadIcon } from "../icons";
import { Add as AddIcon } from "../icons";
import { SmartToy as SmartToyIcon } from "../icons";
import { Hub as HubIcon } from "../icons";
import { Api as ApiIcon } from "../icons";
import { IntegrationInstructions as IntegrationInstructionsIcon } from "../icons";
import { Fingerprint as FingerprintIcon } from "../icons";
import { Build as BuildIcon } from "../icons";
import { PeopleOutline as PeopleOutlineIcon } from "../icons";
import { Campaign as CampaignIcon } from "../icons";
import { Phone as PhoneIcon } from "../icons";
import { Email as EmailIcon } from "../icons";
import { LinkedIn as LinkedInIcon } from "../icons";
import { useNavigate } from "react-router";
import { useApiClient } from "../api/client";
import AdAudiencesPanel from "../components/AdAudiencesPanel";
import { C, F } from "../theme/pageTokens";
import { FS, FW, LABEL } from "../theme/typeScale";
import { isacPath } from "../paths";

// ── Design tokens ────────────────────────────────────────────────────────────
// ── Platform icons ──────────────────────────────────────────────────────────
const PLATFORM_ICONS: Record<string, React.ReactElement> = {
  "Agent Platform": <SmartToyIcon sx={{ fontSize: 15 }} />,
  "API Platform": <ApiIcon sx={{ fontSize: 15 }} />,
  "Integration Platform": <IntegrationInstructionsIcon sx={{ fontSize: 15 }} />,
  "Identity Platform": <FingerprintIcon sx={{ fontSize: 15 }} />,
  "Engineering Platform": <BuildIcon sx={{ fontSize: 15 }} />,
};

// ── Product hierarchy ────────────────────────────────────────────────────────
const PLATFORMS = [
  { name: "Agent Platform", products: ["Agent Manager", "AI Gateway", "Agent ID"] },
  { name: "API Platform", products: ["API Manager", "API Gateway", "AI Gateway", "AI Workspace", "API Control Plane", "API Portal & MCP Hub", "Monetization"] },
  { name: "Integration Platform", products: ["Integrator"] },
  { name: "Identity Platform", products: ["Access Manager", "Agent ID", "Security Token Service"] },
  { name: "Engineering Platform", products: ["Developer Platform", "OpenChoreo"] },
];

// ── Channel config ──────────────────────────────────────────────────────────
interface ChannelState {
  enabled: boolean;
  status: string;
}
interface ChannelsMap {
  linkedin: ChannelState;
  email: ChannelState;
  phone: ChannelState;
}
const DEFAULT_CHANNELS: ChannelsMap = {
  linkedin: { enabled: false, status: "draft" },
  email: { enabled: false, status: "no_contacts" },
  phone: { enabled: false, status: "no_contacts" },
};

// ── Types ────────────────────────────────────────────────────────────────────
interface ProductTemplate { id: number; product_name: string; display_name: string; }
interface ICPCriteria { industries: string[]; min_employees: number; min_fit_score: number; regions: string[]; buying_stages: string[]; keywords: string[]; pain_points: string[]; buyer_titles: string[]; reasoning: string; inherited_from: string | null; }
interface FitBreakdown {
  industry_match: number; industry_detail: string;
  employee_match: number; employee_detail: string;
  region_match: number; region_detail: string;
  buying_stage_match: number; buying_stage_detail: string;
  domain_match: number; intent_bonus: number; intent_detail: string;
}
interface MatchedCompany {
  id: number; canonical_name: string; domain?: string; industry?: string;
  employees?: number; region?: string; country?: string; buying_stage?: string;
  fit_score: number; intent_score: number; awareness_score: number;
  heat_tier?: string; is_qualified: boolean;
  fit_breakdown?: FitBreakdown; source_signals?: string[];
}
interface CampaignContact {
  id: number; contact_id?: number; email?: string; first_name?: string;
  last_name?: string; job_title?: string; company_name?: string;
  company_domain?: string; linkedin_url?: string; source?: string;
  revealed?: boolean;
}
/** The fields a contact reveal fills in. */
type RevealedContact = Pick<CampaignContact, "id" | "email" | "last_name" | "linkedin_url"> & { phone?: string };
interface EmailDraft {
  id: number; campaign_id: number; contact_id: number; subject: string;
  body: string; status: string; channel?: string; contact_name?: string; contact_title?: string;
  company_name?: string;
}
interface LinkedInAudienceCompany {
  company_name: string; domain?: string; employees?: number; country?: string;
  industry?: string; region?: string;
}

// ── Channel preview tables ──────────────────────────────────────────────────
// Header and rows of each hand-built table share ONE column layout (template,
// gap, padding) so header labels sit exactly over their column content.
const AUDIENCE_COLS = "1.2fr 1fr 80px 1fr 1fr";
const EMAIL_CONTACT_COLS = "28px 1fr 1fr 1.2fr 1fr 65px";
const PHONE_CONTACT_COLS = "28px 1fr 1fr 1fr 65px";
const PREVIEW_ROW = { display: "grid", gap: 0.5, px: 0.5, alignItems: "center" } as const;
// A function, not a constant: C.* re-derives per render (theme / dark mode),
// so a module-level object would freeze the colour it read at load time.
const previewHead = () => ({ ...LABEL, fontFamily: F, color: C.dim });

// ── Section label ────────────────────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.dim, textTransform: "uppercase", letterSpacing: "0.09em", mb: 0.75 }}>{children}</Typography>;
}

// ── Status chip helper ──────────────────────────────────────────────────────
function StatusChip({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    draft: { bg: `${C.amber}0c`, color: C.amber, label: "Draft" },
    no_contacts: { bg: `${C.dim}0c`, color: C.dim, label: "No Contacts" },
    contacts_found: { bg: `${C.blue}0c`, color: C.blue, label: "Contacts Found" },
    drafts_ready: { bg: `${C.green}0c`, color: C.green, label: "Drafts Ready" },
    scripts_ready: { bg: `${C.green}0c`, color: C.green, label: "Scripts Ready" },
    audience_ready: { bg: `${C.linkedin}0c`, color: C.linkedin, label: "Audience Ready" },
  };
  const s = map[status] || map.draft;
  return <Chip label={s.label} size="small" sx={{ fontFamily: F, fontSize: FS.micro, height: 18, bgcolor: s.bg, color: s.color, fontWeight: FW.semibold }} />;
}

// ── In-app confirm dialog ───────────────────────────────────────────────────
function UnsavedDialog({ open, onConfirm, onCancel }: { open: boolean; onConfirm: () => void; onCancel: () => void }) {
  if (!open) return null;
  return (
    <Box sx={{
      position: "fixed", inset: 0, zIndex: 1300,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <Box onClick={onCancel} sx={{ position: "absolute", inset: 0, bgcolor: "rgba(0,0,0,0.25)", backdropFilter: "blur(2px)" }} />
      <Box sx={{
        position: "relative", width: 380, bgcolor: C.panel, borderRadius: "12px",
        border: `1px solid ${C.border}`, boxShadow: "0 12px 40px rgba(0,0,0,0.12)",
        overflow: "hidden",
      }}>
        <Box sx={{ height: 3, bgcolor: C.amber }} />
        <Box sx={{ p: 2.5 }}>
          <Stack direction="row" alignItems="center" gap={1} mb={1.5}>
            <Box sx={{
              width: 32, height: 32, borderRadius: "8px", display: "flex",
              alignItems: "center", justifyContent: "center",
              bgcolor: `${C.amber}10`, border: `1px solid ${C.amber}20`,
            }}>
              <WarningAmberIcon sx={{ fontSize: 18, color: C.amber }} />
            </Box>
            <Typography sx={{ fontFamily: F, fontSize: FS.reading, fontWeight: FW.semibold, color: C.text }}>
              Unsaved Campaign
            </Typography>
          </Stack>
          <Typography sx={{ fontFamily: F, fontSize: FS.body, color: C.sub, lineHeight: 1.6, mb: 2.5 }}>
            Your conversation and matched companies haven't been saved yet. If you leave now, these results will be lost.
          </Typography>
          <Stack direction="row" gap={0.75} justifyContent="flex-end">
            <Button size="small" onClick={onCancel}
              sx={{ fontFamily: F, fontSize: FS.small, textTransform: "none", color: C.sub, borderRadius: "7px", px: 2 }}>
              Stay &amp; Save
            </Button>
            <Button size="small" variant="contained" disableElevation onClick={onConfirm}
              sx={{ fontFamily: F, fontSize: FS.small, textTransform: "none", borderRadius: "7px", px: 2, bgcolor: C.amber, "&:hover": { bgcolor: "#8a5f06" } }}>
              Leave Anyway
            </Button>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
/** ICP campaign builder — score companies against templates and build targeted account lists. */
export default function Campaigns() {
  const { get, request } = useApiClient();
  const navigate = useNavigate();

  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [description, setDescription] = useState("");
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [icp, setIcp] = useState<ICPCriteria | null>(null);
  const [companies, setCompanies] = useState<MatchedCompany[]>([]);
  const [totalMatched, setTotalMatched] = useState(0);
  const [error, setError] = useState("");
  const [showIcp, setShowIcp] = useState(false);
  const [pageView, setPageView] = useState<"builder" | "audiences">("builder");
  const [savedCampaigns, setSavedCampaigns] = useState<{ id: number; name: string; campaign_type: string; products: string[]; total_matched: number; active_channels?: string[]; created_at: string | null }[]>([]);
  const [saving, setSaving] = useState(false);
  const [productTemplates, setProductTemplates] = useState<ProductTemplate[]>([]);
  const [saveName, setSaveName] = useState("");
  const [expandedCompany, setExpandedCompany] = useState<number | null>(null);
  const [selectedCompanies, setSelectedCompanies] = useState<Set<number>>(new Set());
  const [conversationHistory, setConversationHistory] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [currentSavedId, setCurrentSavedId] = useState<number | null>(null);
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  // Channel state
  const [channels, setChannels] = useState<ChannelsMap>({ ...DEFAULT_CHANNELS });
  const [expandedChannel, setExpandedChannel] = useState<string | null>(null);

  // Outreach pipeline state
  const [outreachContacts, setOutreachContacts] = useState<CampaignContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [revealLoading, setRevealLoading] = useState(false);
  const [emailDrafts, setEmailDrafts] = useState<EmailDraft[]>([]);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [callScripts, setCallScripts] = useState<EmailDraft[]>([]);
  const [callScriptsLoading, setCallScriptsLoading] = useState(false);
  const [linkedInAudience, setLinkedInAudience] = useState<LinkedInAudienceCompany[]>([]);
  const [linkedInLoading, setLinkedInLoading] = useState(false);
  const [emailSelectedContacts, setEmailSelectedContacts] = useState<Set<number>>(new Set());
  const [phoneSelectedContacts, setPhoneSelectedContacts] = useState<Set<number>>(new Set());

  const toggleChannel = (ch: keyof ChannelsMap) => {
    setChannels((prev) => ({
      ...prev,
      [ch]: { ...prev[ch], enabled: !prev[ch].enabled },
    }));
    if (!channels[ch].enabled) {
      setExpandedChannel(ch);
    }
  };

  const guardUnsaved = (action: () => void) => {
    if (!currentSavedId && conversationHistory.length > 0) {
      pendingActionRef.current = action;
      setUnsavedDialogOpen(true);
    } else {
      action();
    }
  };

  // Load saved campaigns and product templates
  useEffect(() => {
    get<typeof savedCampaigns>("/campaigns/saved").then(setSavedCampaigns).catch(() => {});
    get<ProductTemplate[]>("/campaigns/product-templates").then(setProductTemplates).catch(() => {});
  }, [get]);

  const handleSave = async () => {
    if (!saveName.trim() || !icp) return;
    setSaving(true);
    const payload = {
      name: saveName.trim(),
      campaign_type: "",
      products: [...selectedProducts],
      description,
      icp_criteria: icp,
      matched_company_ids: companies.map((c) => c.id),
      total_matched: totalMatched,
      conversation_history: conversationHistory,
      channels,
    };
    try {
      if (currentSavedId) {
        await request("put", `/campaigns/saved/${currentSavedId}`, payload);
      } else {
        const res = await request<{ id: number }>("post", "/campaigns/saved", payload);
        setCurrentSavedId(res.id);
      }
      get<typeof savedCampaigns>("/campaigns/saved").then(setSavedCampaigns).catch(() => {});
    } catch { /* a failed save leaves the campaign unsaved */ } finally { setSaving(false); }
  };

  const handleLoadSaved = async (id: number) => {
    try {
      const data = await get<{
        name: string; campaign_type: string; products: string[]; description: string;
        icp_criteria: ICPCriteria; matched_company_ids: number[]; total_matched: number;
        conversation_history: { role: string; content: string }[];
        channels?: ChannelsMap;
      }>(`/campaigns/saved/${id}`);
      // Restore state
      setSelectedProducts(new Set(data.products || []));
      setDescription(data.description || "");
      setSaveName(data.name);
      setCurrentSavedId(id);
      setConversationHistory(data.conversation_history || []);
      // Restore channels — legacy campaigns default to all disabled
      if (data.channels && typeof data.channels === "object" && Object.keys(data.channels).length > 0) {
        setChannels({
          linkedin: data.channels.linkedin || { enabled: false, status: "draft" },
          email: data.channels.email || { enabled: false, status: "no_contacts" },
          phone: data.channels.phone || { enabled: false, status: "no_contacts" },
        });
      } else {
        setChannels({ ...DEFAULT_CHANNELS });
      }
      if (data.icp_criteria && data.icp_criteria.industries) {
        setIcp(data.icp_criteria);
        // Re-match companies with the saved criteria
        setLoading(true);
        try {
          const matchR = await request<{ companies: MatchedCompany[]; total_matched: number }>("post", "/campaigns/match-companies", {
            industries: data.icp_criteria.industries, min_employees: data.icp_criteria.min_employees || 0,
            min_fit_score: data.icp_criteria.min_fit_score || 0,
            regions: data.icp_criteria.regions || [], buying_stages: data.icp_criteria.buying_stages || [],
            keywords: data.icp_criteria.keywords || [], limit: 30,
          });
          setCompanies(matchR.companies || []); setTotalMatched(matchR.total_matched || 0);
        } catch { /* keep the restored criteria; the company list stays as it was */ } finally { setLoading(false); }
      }
    } catch { /* the saved campaign could not be loaded; leave the current one untouched */ }
  };

  const handleDeleteSaved = async (id: number) => {
    if (!window.confirm("Delete this saved campaign?")) return;
    try { await request("delete", `/campaigns/saved/${id}`); setSavedCampaigns((prev) => prev.filter((c) => c.id !== id)); } catch { /* not deleted; it stays in the list */ }
  };

  const toggleProduct = (p: string) => { const n = new Set(selectedProducts); if (n.has(p)) n.delete(p); else n.add(p); setSelectedProducts(n); };
  const togglePlatform = (pl: typeof PLATFORMS[0]) => { const n = new Set(selectedProducts); const all = pl.products.every((p) => n.has(p)); pl.products.forEach((p) => all ? n.delete(p) : n.add(p)); setSelectedProducts(n); };

  const buildPrompt = () => {
    const p: string[] = [];
    if (selectedProducts.size > 0) p.push(`Products: ${[...selectedProducts].join(", ")}.`);
    if (description.trim()) p.push(description.trim());
    return p.join(" ");
  };

  const handleGo = async () => {
    const prompt = buildPrompt();
    if (!prompt) return;
    setLoading(true); setError(""); setIcp(null); setCompanies([]); setTotalMatched(0); setConversationHistory([]); setCurrentSavedId(null); setChannels({ ...DEFAULT_CHANNELS });
    try {
      const selectedArr = [...selectedProducts];
      let templateId: number | undefined;
      if (selectedArr.length > 0 && productTemplates.length > 0) {
        const tpl = productTemplates.find((t) =>
          selectedArr.some((p) => t.display_name.toLowerCase().includes(p.toLowerCase().split(" ")[0]))
        );
        if (tpl) templateId = tpl.id;
      }
      const icpR = await request<ICPCriteria>("post", "/campaigns/build-icp", {
        description: prompt,
        product_template_id: templateId,
      });
      setIcp(icpR);
      setConversationHistory([
        { role: "user", content: prompt },
        { role: "assistant", content: `ICP generated: ${icpR.reasoning || "Criteria set based on your description."}` },
      ]);
      const matchR = await request<{ companies: MatchedCompany[]; total_matched: number }>("post", "/campaigns/match-companies", {
        industries: icpR.industries, min_employees: icpR.min_employees, min_fit_score: icpR.min_fit_score || 0, regions: icpR.regions, buying_stages: icpR.buying_stages, keywords: icpR.keywords, limit: 30,
      });
      setCompanies(matchR.companies || []); setTotalMatched(matchR.total_matched || 0);
    } catch (err) { setError((err instanceof Error && err.message) || "Something went wrong"); }
    finally { setLoading(false); }
  };

  const handleRefine = async () => {
    const msg = chatInput.trim();
    if (!msg || !icp || chatLoading) return;
    setChatInput("");
    setChatLoading(true);
    setError("");
    const updatedHistory = [...conversationHistory, { role: "user", content: msg }];
    setConversationHistory(updatedHistory);
    try {
      const refined = await request<ICPCriteria>("post", "/campaigns/refine-icp", {
        current_icp: icp,
        prompt: msg,
        conversation_history: updatedHistory,
      });
      setIcp(refined);
      const changes: string[] = [];
      if (JSON.stringify(refined.industries) !== JSON.stringify(icp.industries)) changes.push(`Industries: ${refined.industries.length} (was ${icp.industries.length})`);
      if (JSON.stringify(refined.regions) !== JSON.stringify(icp.regions)) changes.push(`Regions: ${refined.regions.join(", ")}`);
      if (JSON.stringify(refined.buyer_titles) !== JSON.stringify(icp.buyer_titles)) changes.push(`Buyer Titles: ${refined.buyer_titles.length} (was ${icp.buyer_titles.length})`);
      if (JSON.stringify(refined.keywords) !== JSON.stringify(icp.keywords)) changes.push(`Keywords: ${refined.keywords.length}`);
      if (refined.min_employees !== icp.min_employees) changes.push(`Min Employees: ${refined.min_employees}`);
      const changeSummary = changes.length > 0 ? `\n\nChanges applied:\n${changes.map(c => `• ${c}`).join("\n")}` : "";
      setConversationHistory([...updatedHistory, { role: "assistant", content: (refined.reasoning || "Criteria updated.") + changeSummary }]);
      const matchR = await request<{ companies: MatchedCompany[]; total_matched: number }>("post", "/campaigns/match-companies", {
        industries: refined.industries, min_employees: refined.min_employees, min_fit_score: refined.min_fit_score || 0, regions: refined.regions, buying_stages: refined.buying_stages, keywords: refined.keywords, limit: 30,
      });
      setCompanies(matchR.companies || []); setTotalMatched(matchR.total_matched || 0);
    } catch (err) { setError((err instanceof Error && err.message) || "Refinement failed"); }
    finally { setChatLoading(false); }
  };

  const toggleCompanySelect = (id: number) => {
    setSelectedCompanies((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const selectAllCompanies = () => { setSelectedCompanies(new Set(companies.map((c) => c.id))); };
  const deselectAllCompanies = () => { setSelectedCompanies(new Set()); };

  const handleReset = () => { setSelectedProducts(new Set()); setDescription(""); setIcp(null); setCompanies([]); setTotalMatched(0); setError(""); setShowIcp(false); setConversationHistory([]); setChatInput(""); setCurrentSavedId(null); setSaveName(""); setSelectedCompanies(new Set()); setOutreachContacts([]); setEmailDrafts([]); setCallScripts([]); setLinkedInAudience([]); setEmailSelectedContacts(new Set()); setPhoneSelectedContacts(new Set()); setChannels({ ...DEFAULT_CHANNELS }); setExpandedChannel(null); };
  const canSubmit = (selectedProducts.size > 0 || description.trim()) && !loading;

  // ── Outreach handlers ───────────────────────────────────────────────────
  const handleFindContacts = async () => {
    if (!currentSavedId || selectedCompanies.size === 0) {
      setError("Save the campaign and select companies first.");
      return;
    }
    setContactsLoading(true); setError("");
    try {
      const buyerTitles = icp?.buyer_titles || ["CTO", "VP Engineering", "Director of IT"];
      const res = await request<{ contacts: CampaignContact[]; total_found: number }>(
        "post", "/outreach/find-contacts",
        { campaign_id: currentSavedId, company_ids: [...selectedCompanies], buyer_titles: buyerTitles },
      );
      setOutreachContacts(res.contacts || []);
      // Update channel statuses
      if ((res.contacts || []).length > 0) {
        setChannels((prev) => ({
          ...prev,
          email: { ...prev.email, status: "contacts_found" },
          phone: { ...prev.phone, status: "contacts_found" },
        }));
      }
    } catch (err) { setError((err instanceof Error && err.message) || "Contact discovery failed"); }
    finally { setContactsLoading(false); }
  };

  const handleRevealContacts = async () => {
    const allSelected = new Set([...emailSelectedContacts, ...phoneSelectedContacts]);
    if (allSelected.size === 0) { setError("Select contacts to reveal."); return; }
    setRevealLoading(true); setError("");
    try {
      const res = await request<{ revealed: RevealedContact[]; credits_used: number; errors: string[] }>(
        "post", "/outreach/reveal-contacts",
        { campaign_id: currentSavedId, contact_ids: [...allSelected] },
      );
      setOutreachContacts((prev) => prev.map((c) => {
        const rev = res.revealed.find((r) => r.id === c.id);
        if (rev) return { ...c, email: rev.email, last_name: rev.last_name, phone: rev.phone, linkedin_url: rev.linkedin_url, revealed: true };
        return c;
      }));
      if (res.errors?.length) setError(res.errors.join("; "));
    } catch (err) { setError((err instanceof Error && err.message) || "Contact reveal failed"); }
    finally { setRevealLoading(false); }
  };

  const handleBuildEmailSequence = async () => {
    if (!currentSavedId || emailSelectedContacts.size === 0) {
      setError("Select contacts for email outreach first.");
      return;
    }
    setEmailsLoading(true); setError("");
    try {
      const productName = [...selectedProducts][0] || "WSO2 Platform";
      const res = await request<{ drafts: EmailDraft[]; total_generated: number }>(
        "post", "/outreach/build-email-sequence",
        { campaign_id: currentSavedId, contact_ids: [...emailSelectedContacts], campaign_description: description, product_name: productName },
      );
      setEmailDrafts(res.drafts || []);
      if ((res.drafts || []).length > 0) {
        setChannels((prev) => ({ ...prev, email: { ...prev.email, status: "drafts_ready" } }));
      }
    } catch (err) { setError((err instanceof Error && err.message) || "Email generation failed"); }
    finally { setEmailsLoading(false); }
  };

  const handleLinkedInAudience = async () => {
    if (!currentSavedId || selectedCompanies.size === 0) {
      setError("Save the campaign and select companies first.");
      return;
    }
    setLinkedInLoading(true); setError("");
    try {
      const res = await request<{ audience: LinkedInAudienceCompany[]; total_companies: number }>(
        "post", "/outreach/linkedin-audience",
        { campaign_id: currentSavedId, company_ids: [...selectedCompanies] },
      );
      setLinkedInAudience(res.audience || []);
      if ((res.audience || []).length > 0) {
        setChannels((prev) => ({ ...prev, linkedin: { ...prev.linkedin, status: "audience_ready" } }));
      }
    } catch (err) { setError((err instanceof Error && err.message) || "LinkedIn audience preview failed"); }
    finally { setLinkedInLoading(false); }
  };

  const handleSaveEmailDraft = async (draft: EmailDraft) => {
    try {
      await request("put", `/outreach/email-drafts/${draft.id}`, { subject: draft.subject, body: draft.body, status: draft.status });
    } catch (err) { setError((err instanceof Error && err.message) || "Failed to save draft"); }
  };

  const handleBuildCallScript = async () => {
    if (!currentSavedId || phoneSelectedContacts.size === 0) {
      setError("Select contacts for phone campaign first.");
      return;
    }
    setCallScriptsLoading(true); setError("");
    try {
      const productName = [...selectedProducts][0] || "WSO2 Platform";
      const res = await request<{ drafts: EmailDraft[]; total_generated: number }>(
        "post", "/outreach/build-call-script",
        { campaign_id: currentSavedId, contact_ids: [...phoneSelectedContacts], campaign_description: description, product_name: productName },
      );
      setCallScripts(res.drafts || []);
      if ((res.drafts || []).length > 0) {
        setChannels((prev) => ({ ...prev, phone: { ...prev.phone, status: "scripts_ready" } }));
      }
    } catch (err) { setError((err instanceof Error && err.message) || "Call script generation failed"); }
    finally { setCallScriptsLoading(false); }
  };

  const toggleEmailContact = (id: number) => {
    setEmailSelectedContacts((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const togglePhoneContact = (id: number) => {
    setPhoneSelectedContacts((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  // Count active channels for display
  const activeChannelCount = [channels.linkedin.enabled, channels.email.enabled, channels.phone.enabled].filter(Boolean).length;

  return (
    <Box sx={{ bgcolor: C.bg, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* == View switcher: Builder | Ad Audiences (Oxygen Tabs) == */}
      <Tabs
        value={pageView}
        onChange={(_, v) => setPageView(v)}
        sx={{ px: 2, borderBottom: `1px solid ${C.border}`, minHeight: 40,
              "& .MuiTab-root": { minHeight: 40, textTransform: "none", fontFamily: F, fontWeight: FW.semibold, fontSize: FS.body } }}
      >
        <Tab value="builder" label="Campaign Builder" />
        <Tab value="audiences" label="Ad Audiences" />
      </Tabs>

      {pageView === "audiences" && (
        <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}><AdAudiencesPanel /></Box>
      )}

      {/* == INPUT == */}
      {pageView === "builder" && !icp && (
        <Box sx={{ display: "flex", flex: 1, minHeight: 0 }}>

          {/* -- Left: Side panel -- */}
          <Box sx={{
            width: 300, flexShrink: 0, borderRight: `1px solid ${C.border}`,
            bgcolor: C.panel, display: "flex", flexDirection: "column", overflowY: "auto",
          }}>
            <Box sx={{ px: 2, pt: 2, pb: 1.5 }}>
              <Stack direction="row" alignItems="center" gap={0.75}>
                <HubIcon sx={{ fontSize: 16, color: C.orange }} />
                <Typography sx={{ fontFamily: F, fontSize: FS.body, fontWeight: FW.semibold, color: C.text }}>Campaign Setup</Typography>
              </Stack>
            </Box>

            {/* Products */}
            <Box sx={{ px: 2, pt: 1, pb: 1, flex: 1 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={0.75}>
                <Label>Products</Label>
                {selectedProducts.size > 0 && (
                  <Box sx={{
                    px: 0.75, py: 0.1, borderRadius: "10px", bgcolor: `${C.blue}10`,
                  }}>
                    <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.blue }}>{selectedProducts.size} selected</Typography>
                  </Box>
                )}
              </Stack>
              <Stack spacing={0.25}>
                {PLATFORMS.map((pl) => {
                  const exp = expandedPlatform === pl.name;
                  const allSel = pl.products.every((p) => selectedProducts.has(p));
                  const someSel = pl.products.some((p) => selectedProducts.has(p));
                  const selCount = pl.products.filter((p) => selectedProducts.has(p)).length;
                  return (
                    <Box key={pl.name} sx={{
                      borderRadius: "7px",
                      border: `1px solid ${someSel ? `${C.blue}20` : "transparent"}`,
                      bgcolor: someSel ? `${C.blue}03` : "transparent",
                      transition: "all 0.15s",
                    }}>
                      <Box onClick={() => setExpandedPlatform(exp ? null : pl.name)} sx={{
                        display: "flex", alignItems: "center", py: 0.65, px: 1, cursor: "pointer",
                        borderRadius: "7px",
                        "&:hover": { bgcolor: `${C.blue}05` },
                      }}>
                        <Checkbox size="small" checked={allSel} indeterminate={someSel && !allSel}
                          onClick={(e) => { e.stopPropagation(); togglePlatform(pl); }}
                          sx={{ p: 0, mr: 0.75, color: C.dim, "&.Mui-checked": { color: C.blue }, "&.MuiCheckbox-indeterminate": { color: C.blue }, "& .MuiSvgIcon-root": { fontSize: 15 } }} />
                        <Box sx={{ color: someSel ? C.blue : C.dim, display: "flex", mr: 0.6 }}>
                          {PLATFORM_ICONS[pl.name]}
                        </Box>
                        <Typography sx={{ fontFamily: F, fontSize: FS.body, fontWeight: FW.semibold, color: someSel ? C.text : C.textMd, flex: 1 }}>{pl.name.replace(" Platform", "")}</Typography>
                        {selCount > 0 && !exp && (
                          <Typography sx={{ fontFamily: F, fontSize: FS.micro, fontWeight: FW.semibold, color: C.blue, mr: 0.5 }}>{selCount}</Typography>
                        )}
                        {exp ? <ExpandLessIcon sx={{ fontSize: 13, color: C.dim }} /> : <ExpandMoreIcon sx={{ fontSize: 13, color: C.dim }} />}
                      </Box>
                      <Collapse in={exp}>
                        <Box sx={{ pl: 3.8, pr: 1, pb: 0.5 }}>
                          {pl.products.map((pr) => (
                            <FormControlLabel key={`${pl.name}-${pr}`}
                              control={<Checkbox size="small" checked={selectedProducts.has(pr)} onChange={() => toggleProduct(pr)}
                                sx={{ p: 0, mr: 0.5, color: C.dim, "&.Mui-checked": { color: C.blue }, "& .MuiSvgIcon-root": { fontSize: 13 } }} />}
                              label={<Typography sx={{ fontFamily: F, fontSize: FS.body, color: selectedProducts.has(pr) ? C.text : C.sub }}>{pr}</Typography>}
                              sx={{ mb: 0.15, mr: 0, ml: 0, display: "flex" }} />
                          ))}
                        </Box>
                      </Collapse>
                    </Box>
                  );
                })}
              </Stack>
            </Box>

            {/* Saved campaigns in side panel */}
            {savedCampaigns.length > 0 && (
              <Box sx={{ borderTop: `1px solid ${C.border}`, px: 2, pt: 1.5, pb: 2 }}>
                <Label>Saved</Label>
                <Stack spacing={0.4}>
                  {savedCampaigns.slice(0, 4).map((sc) => (
                    <Box key={sc.id} onClick={() => handleLoadSaved(sc.id)} sx={{
                      display: "flex", alignItems: "center", gap: 0.75, px: 1, py: 0.6,
                      borderRadius: "5px", cursor: "pointer", transition: "all 0.12s",
                      "&:hover": { bgcolor: `${C.blue}05` },
                    }}>
                      <Box sx={{
                        width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                        bgcolor: C.blue, opacity: 0.4,
                      }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography noWrap sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: C.text }}>{sc.name}</Typography>
                        <Typography noWrap sx={{ fontFamily: F, fontSize: FS.micro, color: C.sub }}>
                          {sc.total_matched} cos{sc.active_channels && sc.active_channels.length > 0 ? ` · ${sc.active_channels.join(", ")}` : ""}
                        </Typography>
                      </Box>
                      <Typography onClick={(e) => { e.stopPropagation(); handleDeleteSaved(sc.id); }}
                        sx={{ fontFamily: F, fontSize: FS.micro, color: C.dim, cursor: "pointer", flexShrink: 0, "&:hover": { color: C.red } }}>x</Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}
          </Box>

          {/* -- Right: description + action -- */}
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", px: 5, py: 4 }}>

            {/* Selection summary */}
            {selectedProducts.size > 0 && (
              <Box sx={{ mb: 2.5, display: "flex", flexWrap: "wrap", gap: 0.5, alignItems: "center" }}>
                {[...selectedProducts].map((p) => <Chip key={p} label={p} size="small" onDelete={() => toggleProduct(p)}
                  sx={{ fontFamily: F, fontSize: FS.caption, height: 22, bgcolor: `${C.blue}0c`, color: C.blue, "& .MuiChip-deleteIcon": { color: `${C.blue}80`, fontSize: FS.reading } }} />)}
                <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.dim, ml: 0.5 }}>
                  {`${selectedProducts.size} product${selectedProducts.size > 1 ? "s" : ""}`}
                </Typography>
              </Box>
            )}

            <Typography sx={{ fontFamily: F, fontSize: FS.display, fontWeight: FW.bold, color: C.text, mb: 0.4, letterSpacing: "-0.01em" }}>
              Describe your campaign
            </Typography>
            <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.sub, mb: 2.5, lineHeight: 1.5 }}>
              Tell the AI about your target audience, region, or goals. It combines this with your product selections to find the best-fit companies. You'll configure channels (LinkedIn, Email, Phone) after matching.
            </Typography>

            <TextField multiline minRows={3} maxRows={6} fullWidth
              placeholder="e.g. Targeting healthcare CTOs in North America who need HIPAA-compliant API management..."
              value={description} onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && canSubmit) { e.preventDefault(); handleGo(); } }}
              sx={{
                mb: 2,
                "& .MuiOutlinedInput-root": {
                  fontFamily: F, fontSize: FS.reading, borderRadius: "10px", bgcolor: C.panel, color: C.text,
                  "& fieldset": { borderColor: C.border }, "&:hover fieldset": { borderColor: `${C.orange}40` }, "&.Mui-focused fieldset": { borderColor: C.orange, borderWidth: 1.5 },
                },
                "& .MuiInputBase-input::placeholder": { color: C.dim },
              }} />

            <Button fullWidth variant="contained" size="large" disabled={!canSubmit} onClick={handleGo}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon sx={{ fontSize: 18 }} />}
              disableElevation
              sx={{
                fontFamily: F, fontWeight: FW.semibold, fontSize: FS.reading, borderRadius: "10px", py: 1.25, textTransform: "none",
                bgcolor: C.orange, "&:hover": { bgcolor: C.orangeDark },
                "&.Mui-disabled": { bgcolor: `${C.dim}18`, color: C.dim },
              }}>
              {loading ? "Finding target companies..." : "Find Target Companies"}
            </Button>
            {error && <Typography sx={{ fontFamily: F, fontSize: FS.body, color: C.red, mt: 1.5, textAlign: "center" }}>{error}</Typography>}
          </Box>
        </Box>
      )}

      {/* == RESULTS == */}
      {pageView === "builder" && icp && (
        <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          {/* Accent line */}
          <Box sx={{ height: 3, background: `linear-gradient(90deg, ${C.orange}, ${C.orange}60 40%, ${C.blue}40 70%, ${C.blue}20)` }} />

          {/* Header */}
          <Box sx={{ px: 2.5, pt: 1.5, pb: 1.25, borderBottom: `1px solid ${C.border}`, bgcolor: C.panel }}>
            <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              {/* Left: metric + context */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box sx={{ textAlign: "center" }}>
                  <Typography sx={{ fontFamily: F, fontSize: FS.kpi, fontWeight: FW.bold, color: C.text, lineHeight: 1 }}>{totalMatched}</Typography>
                  <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.sub, textTransform: "uppercase", letterSpacing: "0.06em" }}>total matches</Typography>
                  {totalMatched > companies.length && (
                    <Typography sx={{ fontFamily: F, fontSize: FS.micro, color: C.dim }}>showing top {companies.length}</Typography>
                  )}
                </Box>
                <Box sx={{ height: 36, width: "1px", bgcolor: C.border }} />
                <Box>
                  <Stack direction="row" gap={1.5} mb={0.5}>
                    {companies.length > 0 && (
                      <>
                        <Stack direction="row" alignItems="center" gap={0.35}>
                          <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: C.green }} />
                          <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.green }}>
                            {companies.filter((c) => c.fit_score >= 50).length} high-fit
                          </Typography>
                        </Stack>
                        <Stack direction="row" alignItems="center" gap={0.35}>
                          <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: C.red }} />
                          <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.red }}>
                            {companies.filter((c) => c.heat_tier === "hot").length} hot
                          </Typography>
                        </Stack>
                        <Stack direction="row" alignItems="center" gap={0.35}>
                          <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: C.blue }} />
                          <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.blue }}>
                            {companies.filter((c) => c.is_qualified).length} qualified
                          </Typography>
                        </Stack>
                      </>
                    )}
                  </Stack>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.3 }}>
                    {activeChannelCount > 0 && (
                      <Chip label={`${activeChannelCount} channel${activeChannelCount > 1 ? "s" : ""}`} size="small"
                        sx={{ fontFamily: F, fontSize: FS.micro, height: 17, bgcolor: `${C.orange}08`, color: C.orange }} />
                    )}
                    {[...selectedProducts].slice(0, 3).map((p) => <Chip key={p} label={p} size="small" sx={{ fontFamily: F, fontSize: FS.micro, height: 17, bgcolor: `${C.blue}08`, color: C.blue }} />)}
                    {selectedProducts.size > 3 && <Typography sx={{ fontFamily: F, fontSize: FS.micro, color: C.dim }}>+{selectedProducts.size - 3}</Typography>}
                  </Box>
                </Box>
              </Box>

              {/* Right: actions */}
              <Stack direction="row" gap={0.5}>
                <Button size="small" onClick={() => setShowIcp(!showIcp)}
                  startIcon={<TuneIcon sx={{ fontSize: 13 }} />}
                  sx={{
                    fontFamily: F, fontSize: FS.caption, textTransform: "none", color: showIcp ? C.orange : C.sub,
                    borderRadius: "6px", px: 1.25, minWidth: 0,
                    bgcolor: showIcp ? `${C.orange}08` : "transparent",
                    "&:hover": { bgcolor: `${C.orange}0c` },
                  }}>Criteria</Button>
                <Button size="small" variant="outlined" onClick={() => guardUnsaved(handleReset)}
                  startIcon={<AddIcon sx={{ fontSize: 13 }} />}
                  sx={{ fontFamily: F, fontSize: FS.caption, textTransform: "none", borderColor: C.border, color: C.sub, borderRadius: "6px", px: 1.25, minWidth: 0 }}>New</Button>
              </Stack>
            </Box>
          </Box>

          <Collapse in={showIcp}>
            <Box sx={{ px: 2.5, py: 1.5, bgcolor: C.card, borderBottom: `1px solid ${C.border}` }}>
              {/* Row 1: Industries, Buyer Titles, Regions */}
              <Stack direction="row" flexWrap="wrap" gap={2}>
                {(["industries", "buyer_titles", "regions"] as const).map((key) => (
                  <Box key={key} sx={{ flex: 1, minWidth: key === "regions" ? 100 : 160 }}>
                    <Label>{key === "industries" ? "Industries" : key === "buyer_titles" ? "Buyer Titles" : "Regions"}</Label>
                    <Stack direction="row" flexWrap="wrap" gap={0.4} alignItems="center">
                      {(icp[key] as string[]).map((v) => (
                        <Chip key={v} label={v} size="small" onDelete={() => setIcp({ ...icp, [key]: (icp[key] as string[]).filter((x) => x !== v) })}
                          variant={key === "regions" ? "outlined" : "filled"} sx={{ fontFamily: F, fontSize: FS.caption, height: 20 }} />
                      ))}
                      <TextField size="small" placeholder="+"
                        onKeyDown={(e) => { if (e.key === "Enter") { const v = (e.target as HTMLInputElement).value.trim(); if (v && !(icp[key] as string[]).includes(v)) { setIcp({ ...icp, [key]: [...(icp[key] as string[]), v] }); (e.target as HTMLInputElement).value = ""; } } }}
                        sx={{ width: 55, "& .MuiInputBase-root": { fontFamily: F, fontSize: FS.caption, height: 20, borderRadius: "3px", "& fieldset": { borderColor: C.border } }, "& .MuiInputBase-input": { py: 0, px: 0.4 } }} />
                    </Stack>
                  </Box>
                ))}
              </Stack>
              {/* Row 2: Buying Stages, Keywords, Pain Points */}
              <Stack direction="row" flexWrap="wrap" gap={2} mt={1.5}>
                {(["buying_stages", "keywords", "pain_points"] as const).map((key) => {
                  const label = key === "buying_stages" ? "Buying Stages" : key === "keywords" ? "Keywords" : "Pain Points";
                  const chipColor = key === "buying_stages" ? C.green : key === "keywords" ? C.blue : C.orange;
                  return (
                    <Box key={key} sx={{ flex: 1, minWidth: key === "buying_stages" ? 120 : 160 }}>
                      <Label>{label}</Label>
                      <Stack direction="row" flexWrap="wrap" gap={0.4} alignItems="center">
                        {(icp[key] as string[]).map((v) => (
                          <Chip key={v} label={v} size="small" onDelete={() => setIcp({ ...icp, [key]: (icp[key] as string[]).filter((x) => x !== v) })}
                            sx={{ fontFamily: F, fontSize: FS.caption, height: 20, bgcolor: `${chipColor}0c`, color: chipColor, "& .MuiChip-deleteIcon": { color: `${chipColor}60`, fontSize: FS.small } }} />
                        ))}
                        <TextField size="small" placeholder="+"
                          onKeyDown={(e) => { if (e.key === "Enter") { const v = (e.target as HTMLInputElement).value.trim(); if (v && !(icp[key] as string[]).includes(v)) { setIcp({ ...icp, [key]: [...(icp[key] as string[]), v] }); (e.target as HTMLInputElement).value = ""; } } }}
                          sx={{ width: 55, "& .MuiInputBase-root": { fontFamily: F, fontSize: FS.caption, height: 20, borderRadius: "3px", "& fieldset": { borderColor: C.border } }, "& .MuiInputBase-input": { py: 0, px: 0.4 } }} />
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
              {/* Row 3: Min Employees, Min Fit Score */}
              <Stack direction="row" flexWrap="wrap" gap={2} mt={1.5}>
                <Box sx={{ minWidth: 140 }}>
                  <Label>Min Employees</Label>
                  <TextField size="small" type="number" value={icp.min_employees || ""}
                    onChange={(e) => setIcp({ ...icp, min_employees: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                    sx={{ width: 120, "& .MuiInputBase-root": { fontFamily: F, fontSize: FS.small, height: 28, borderRadius: "5px", "& fieldset": { borderColor: C.border } }, "& .MuiInputBase-input": { py: 0.25, px: 0.75 } }} />
                </Box>
                <Box sx={{ minWidth: 140 }}>
                  <Label>Min Fit Score</Label>
                  <TextField size="small" type="number" value={icp.min_fit_score || ""}
                    onChange={(e) => setIcp({ ...icp, min_fit_score: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                    inputProps={{ min: 0, max: 100 }}
                    sx={{ width: 120, "& .MuiInputBase-root": { fontFamily: F, fontSize: FS.small, height: 28, borderRadius: "5px", "& fieldset": { borderColor: C.border } }, "& .MuiInputBase-input": { py: 0.25, px: 0.75 } }} />
                </Box>
              </Stack>
              {/* AI Reasoning */}
              {icp.reasoning && (
                <Box sx={{ mt: 1.5, px: 1.5, py: 1, borderRadius: "6px", bgcolor: `${C.orange}04`, border: `1px solid ${C.orange}12` }}>
                  <Label>AI Reasoning</Label>
                  <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.textMd, lineHeight: 1.5 }}>{icp.reasoning}</Typography>
                </Box>
              )}
              <Stack direction="row" justifyContent="flex-end" mt={1}>
                <Button size="small" variant="contained" disableElevation disabled={loading}
                  startIcon={loading ? <CircularProgress size={11} color="inherit" /> : <AutoAwesomeIcon sx={{ fontSize: 12 }} />}
                  onClick={async () => {
                    setLoading(true);
                    try { const r = await request<{ companies: MatchedCompany[]; total_matched: number }>("post", "/campaigns/match-companies", { industries: icp.industries, min_employees: icp.min_employees, min_fit_score: icp.min_fit_score || 0, regions: icp.regions, buying_stages: icp.buying_stages, keywords: icp.keywords, limit: 30 }); setCompanies(r.companies || []); setTotalMatched(r.total_matched || 0); } catch { /* keep the previous matches */ } finally { setLoading(false); }
                  }}
                  sx={{ fontFamily: F, fontSize: FS.caption, textTransform: "none", borderRadius: "5px", py: 0.3 }}>Re-match</Button>
              </Stack>
            </Box>
          </Collapse>

          <Box sx={{ px: 2.5, py: 1.5 }}>
            {companies.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 5 }}><Typography sx={{ fontFamily: F, fontSize: FS.body, color: C.dim }}>No companies match. Try adjusting criteria.</Typography></Box>
            ) : (
              <>
                {/* Selection bar */}
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.75, px: 0.25 }}>
                  <Stack direction="row" alignItems="center" gap={0.75}>
                    <Checkbox size="small"
                      checked={selectedCompanies.size === companies.length && companies.length > 0}
                      indeterminate={selectedCompanies.size > 0 && selectedCompanies.size < companies.length}
                      onChange={() => selectedCompanies.size === companies.length ? deselectAllCompanies() : selectAllCompanies()}
                      sx={{ p: 0, color: C.dim, "&.Mui-checked": { color: C.orange }, "&.MuiCheckbox-indeterminate": { color: C.orange }, "& .MuiSvgIcon-root": { fontSize: 16 } }} />
                    <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub }}>
                      {selectedCompanies.size > 0 ? `${selectedCompanies.size} of ${companies.length} selected` : "Select companies for channels below"}
                    </Typography>
                  </Stack>
                  {selectedCompanies.size > 0 && (
                    <Button size="small" onClick={deselectAllCompanies}
                      sx={{ fontFamily: F, fontSize: FS.caption, textTransform: "none", color: C.dim, minWidth: 0, py: 0 }}>Clear</Button>
                  )}
                </Box>

                <Stack spacing={0.4}>
                  {companies.map((co) => {
                    const isExpanded = expandedCompany === co.id;
                    const fb = co.fit_breakdown;
                    const isSelected = selectedCompanies.has(co.id);
                    return (
                    <Box key={co.id} sx={{
                      borderRadius: "7px",
                      border: `1px solid ${isSelected ? `${C.orange}40` : co.is_qualified ? `${C.green}30` : C.border}`,
                      bgcolor: isSelected ? `${C.orange}03` : C.panel, transition: "all 0.1s",
                      "&:hover": { borderColor: `${C.orange}35` },
                    }}>
                      <Box onClick={() => setExpandedCompany(isExpanded ? null : co.id)} sx={{
                        px: 1.5, py: 1, cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 1.25,
                      }}>
                        <Checkbox size="small" checked={isSelected}
                          onClick={(e) => { e.stopPropagation(); toggleCompanySelect(co.id); }}
                          sx={{ p: 0, flexShrink: 0, color: C.dim, "&.Mui-checked": { color: C.orange }, "& .MuiSvgIcon-root": { fontSize: 16 } }} />

                        <Tooltip title="Fit Score — How well this company matches the campaign's ICP criteria (industry, region, size, buying stage)." arrow placement="left">
                          <Box sx={{
                            width: 28, height: 28, borderRadius: "6px", flexShrink: 0, cursor: "help",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            bgcolor: co.fit_score >= 60 ? `${C.green}0c` : co.fit_score >= 30 ? `${C.orange}0c` : `${C.dim}08`,
                            border: `1.5px solid ${co.fit_score >= 60 ? `${C.green}20` : co.fit_score >= 30 ? `${C.orange}20` : `${C.dim}12`}`,
                          }}>
                            <Typography sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: co.fit_score >= 60 ? C.green : co.fit_score >= 30 ? C.orange : C.dim }}>{co.fit_score}</Typography>
                          </Box>
                        </Tooltip>

                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Stack direction="row" alignItems="center" gap={0.5}>
                            <Typography noWrap sx={{ fontFamily: F, fontSize: FS.body, fontWeight: FW.semibold, color: C.text }}>{co.canonical_name}</Typography>
                            {co.is_qualified && (
                              <Chip label="Qualified" size="small" sx={{ fontFamily: F, fontSize: FS.micro, height: 16, fontWeight: FW.semibold, bgcolor: `${C.green}0c`, color: C.green, border: "none" }} />
                            )}
                          </Stack>
                          <Typography noWrap sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub }}>{[co.domain, co.industry, co.region || co.country].filter(Boolean).join(" · ")}</Typography>
                        </Box>

                        <Stack direction="row" gap={0.5} flexShrink={0}>
                          <Tooltip title="Intent Score — How likely to buy. Based on G2 pricing/comparison views, ad clicks, and certifications." arrow placement="top">
                            <Box sx={{ textAlign: "center", px: 0.4, py: 0.15, borderRadius: "4px", border: `1px solid ${C.border}`, minWidth: 28, cursor: "help" }}>
                              <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: co.intent_score >= 30 ? C.red : C.dim, lineHeight: 1 }}>{co.intent_score}</Typography>
                              <Typography sx={{ fontFamily: F, fontSize: FS.micro, color: C.dim }}>INT</Typography>
                            </Box>
                          </Tooltip>
                          <Tooltip title="Awareness Score — How well they know WSO2. Based on SF accounts, Pardot leads, LinkedIn impressions, and cross-source presence." arrow placement="top">
                            <Box sx={{ textAlign: "center", px: 0.4, py: 0.15, borderRadius: "4px", border: `1px solid ${C.border}`, minWidth: 28, cursor: "help" }}>
                              <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: co.awareness_score >= 30 ? C.blue : C.dim, lineHeight: 1 }}>{co.awareness_score}</Typography>
                              <Typography sx={{ fontFamily: F, fontSize: FS.micro, color: C.dim }}>AWR</Typography>
                            </Box>
                          </Tooltip>
                        </Stack>

                        {co.buying_stage && (
                          <Typography sx={{
                            fontFamily: F, fontSize: FS.micro, fontWeight: FW.semibold, textTransform: "capitalize", flexShrink: 0,
                            px: 0.5, py: 0.1, borderRadius: "3px",
                            color: co.buying_stage === "decision" ? C.green : co.buying_stage === "consideration" ? C.blue : C.dim,
                            bgcolor: co.buying_stage === "decision" ? `${C.green}08` : co.buying_stage === "consideration" ? `${C.blue}08` : `${C.dim}05`,
                          }}>{co.buying_stage}</Typography>
                        )}

                        {co.heat_tier === "hot" && (
                          <Typography sx={{ fontFamily: F, fontSize: FS.micro, fontWeight: FW.semibold, color: C.red, bgcolor: `${C.red}08`, px: 0.4, py: 0.1, borderRadius: "3px" }}>HOT</Typography>
                        )}

                        {isExpanded ? <ExpandLessIcon sx={{ fontSize: 14, color: C.dim, flexShrink: 0 }} /> : <ExpandMoreIcon sx={{ fontSize: 14, color: C.dim, flexShrink: 0 }} />}
                      </Box>

                      <Collapse in={isExpanded}>
                        <Box sx={{ px: 1.5, pb: 1.25, pt: 0.5, borderTop: `1px solid ${C.border}` }}>
                          {fb && (
                            <Box sx={{ mb: 1.25 }}>
                              <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.dim, mb: 0.5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Fit Score Breakdown</Typography>
                              <Stack spacing={0.5}>
                                {([
                                  { label: "Industry", pts: fb.industry_match, max: 30, detail: fb.industry_detail, color: C.blue },
                                  { label: "Region", pts: fb.region_match, max: 20, detail: fb.region_detail, color: C.green },
                                  { label: "Employees", pts: fb.employee_match, max: 20, detail: fb.employee_detail, color: C.orange },
                                  { label: "Buying Stage", pts: fb.buying_stage_match, max: 30, detail: fb.buying_stage_detail, color: C.blue },
                                  { label: "Domain", pts: fb.domain_match, max: 5, detail: co.domain ? `Has domain: ${co.domain}` : "No domain", color: C.dim },
                                  { label: "Intent Bonus", pts: fb.intent_bonus, max: 15, detail: fb.intent_detail, color: C.red },
                                ] as const).map((row) => (
                                  <Box key={row.label} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                    <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.textMd, width: 72, flexShrink: 0 }}>{row.label}</Typography>
                                    <Box sx={{ flex: 1, height: 6, bgcolor: `${C.dim}10`, borderRadius: "3px", overflow: "hidden", position: "relative" }}>
                                      <Box sx={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${(row.pts / row.max) * 100}%`, bgcolor: row.pts > 0 ? row.color : "transparent", borderRadius: "3px", transition: "width 0.3s" }} />
                                    </Box>
                                    <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: row.pts > 0 ? row.color : C.dim, width: 30, textAlign: "right", flexShrink: 0 }}>+{row.pts}</Typography>
                                    <Typography noWrap sx={{ fontFamily: F, fontSize: FS.micro, color: C.sub, flex: 1.5, minWidth: 0 }}>{row.detail}</Typography>
                                  </Box>
                                ))}
                              </Stack>
                            </Box>
                          )}

                          {co.source_signals && co.source_signals.length > 0 && (
                            <Box sx={{ mb: 1 }}>
                              <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.dim, mb: 0.4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Active Signals</Typography>
                              <Stack direction="row" flexWrap="wrap" gap={0.4}>
                                {co.source_signals.map((sig, i) => (
                                  <Chip key={i} label={sig} size="small" sx={{ fontFamily: F, fontSize: FS.micro, height: 18, bgcolor: `${C.blue}08`, color: C.blue }} />
                                ))}
                              </Stack>
                            </Box>
                          )}

                          {icp?.reasoning && (
                            <Box sx={{ px: 1.25, py: 0.75, borderRadius: "5px", bgcolor: `${C.orange}04`, border: `1px solid ${C.orange}08` }}>
                              <Typography sx={{ fontFamily: F, fontSize: FS.micro, fontWeight: FW.semibold, color: C.orange, mb: 0.25 }}>Why this company</Typography>
                              <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.textMd, lineHeight: 1.45 }}>
                                {co.industry && icp.industries.some((ind) => co.industry!.toLowerCase().includes(ind.toLowerCase().split(" ")[0])) ? `Industry match in ${co.industry}. ` : ""}
                                {co.buying_stage ? `Currently in ${co.buying_stage} stage. ` : ""}
                                {co.intent_score > 0 ? `Active intent signals (score: ${co.intent_score}). ` : ""}
                                {co.is_qualified ? "Qualified account — signals from 2+ sources." : ""}
                              </Typography>
                            </Box>
                          )}

                          <Box sx={{ mt: 1, textAlign: "right" }}>
                            <Button size="small" onClick={(e) => {
                              e.stopPropagation();
                              guardUnsaved(() => navigate(isacPath(`/companies/${co.id}`)));
                            }}
                              endIcon={<OpenInNewIcon sx={{ fontSize: 11 }} />}
                              sx={{ fontFamily: F, fontSize: FS.caption, textTransform: "none", color: C.blue, minWidth: 0, py: 0.2 }}>View Full Profile</Button>
                          </Box>
                        </Box>
                      </Collapse>
                    </Box>
                    );
                  })}
                </Stack>

                {/* Conversation + Refine */}
                {pageView === "builder" && icp && (
                  <Box sx={{ mt: 2, p: 1.25, borderRadius: "8px", border: `1px solid ${C.border}`, bgcolor: C.card }}>
                    <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.dim, textTransform: "uppercase", letterSpacing: "0.08em", mb: 0.75 }}>
                      {conversationHistory.length > 0 ? "Conversation" : "Refine with AI"}
                    </Typography>
                    {conversationHistory.length > 0 && (
                      <Box sx={{ maxHeight: 260, overflowY: "auto", mb: 1.25, pr: 0.5 }}>
                        {conversationHistory.map((turn, i) => (
                          <Box key={i} sx={{
                            mb: 1, p: 1, borderRadius: "6px",
                            bgcolor: turn.role === "user" ? `${C.blue}05` : `${C.orange}04`,
                            border: `1px solid ${turn.role === "user" ? `${C.blue}12` : `${C.orange}10`}`,
                          }}>
                            <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: turn.role === "user" ? C.blue : C.orange, mb: 0.3, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              {turn.role === "user" ? "You" : "AI Response"}
                            </Typography>
                            <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.textMd, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                              {turn.content}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    )}
                    <Stack direction="row" gap={0.5} alignItems="center">
                      <TextField size="small" fullWidth placeholder="Ask to refine: e.g. 'Remove all Directors' or 'Focus on APAC'..."
                        value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleRefine(); } }}
                        disabled={chatLoading}
                        sx={{ "& .MuiInputBase-root": { fontFamily: F, fontSize: FS.small, height: 32, borderRadius: "7px", bgcolor: C.panel, "& fieldset": { borderColor: C.border }, "&:hover fieldset": { borderColor: `${C.orange}40` }, "&.Mui-focused fieldset": { borderColor: C.orange } } }} />
                      <Button size="small" variant="contained" disableElevation disabled={!chatInput.trim() || chatLoading}
                        onClick={handleRefine}
                        startIcon={chatLoading ? <CircularProgress size={11} color="inherit" /> : <AutoAwesomeIcon sx={{ fontSize: 13 }} />}
                        sx={{ fontFamily: F, fontSize: FS.caption, textTransform: "none", borderRadius: "7px", flexShrink: 0, px: 1.5, bgcolor: C.orange, "&:hover": { bgcolor: C.orangeDark } }}>
                        {chatLoading ? "Refining..." : "Refine"}
                      </Button>
                    </Stack>
                  </Box>
                )}
                {error && <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.red, mt: 1, textAlign: "center" }}>{error}</Typography>}

                {/* Unsaved warning */}
                {!currentSavedId && conversationHistory.length > 0 && (
                  <Box sx={{ mt: 1.5, px: 1.25, py: 0.75, borderRadius: "6px", bgcolor: `${C.amber}08`, border: `1px solid ${C.amber}20`, display: "flex", alignItems: "center", gap: 0.75 }}>
                    <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.amber, fontWeight: FW.semibold }}>
                      Unsaved — save your campaign before navigating away or your results will be lost.
                    </Typography>
                  </Box>
                )}

                {/* Save + Actions */}
                <Box sx={{ mt: 1, p: 1.5, borderRadius: "8px", border: `1px solid ${!currentSavedId && conversationHistory.length > 0 ? C.amber + "40" : C.border}`, bgcolor: C.panel }}>
                  <Stack direction="row" gap={0.75} alignItems="center">
                    <TextField size="small" placeholder="Campaign name..." value={saveName} onChange={(e) => setSaveName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && saveName.trim()) handleSave(); }}
                      sx={{ flex: 1, "& .MuiInputBase-root": { fontFamily: F, fontSize: FS.body, height: 34, borderRadius: "7px", "& fieldset": { borderColor: C.border }, "&:hover fieldset": { borderColor: `${C.orange}40` }, "&.Mui-focused fieldset": { borderColor: C.orange } } }} />
                    <Button size="small" variant="contained" disableElevation disabled={!saveName.trim() || saving}
                      onClick={handleSave}
                      startIcon={saving ? <CircularProgress size={12} color="inherit" /> : <CheckCircleIcon sx={{ fontSize: 13 }} />}
                      sx={{ fontFamily: F, fontSize: FS.small, textTransform: "none", borderRadius: "7px", flexShrink: 0, px: 1.75, bgcolor: C.orange, "&:hover": { bgcolor: C.orangeDark } }}>
                      {saving ? "Saving..." : currentSavedId ? "Update" : "Save"}
                    </Button>
                    <Button size="small" variant="outlined"
                      startIcon={<FileDownloadIcon sx={{ fontSize: 13 }} />}
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!icp) return;
                        // Fetch ALL matched companies (limit: 0 = no limit) for CSV export
                        const allR = await request<{ companies: MatchedCompany[]; total_matched: number }>("post", "/campaigns/match-companies", {
                          industries: icp.industries, min_employees: icp.min_employees, min_fit_score: icp.min_fit_score || 0,
                          regions: icp.regions, buying_stages: icp.buying_stages, keywords: icp.keywords, limit: 0,
                        });
                        const allMatched = allR.companies || [];
                        const header = "Company,Domain,Industry,Region,Country,Employees,Fit Score,Intent Score,Awareness Score,Buying Stage,Qualified";
                        const rows = allMatched.map((c) => [c.canonical_name, c.domain || "", c.industry || "", c.region || "", c.country || "", c.employees || "", c.fit_score, c.intent_score, c.awareness_score, c.buying_stage || "", c.is_qualified ? "Yes" : "No"].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
                        const csv = [header, ...rows].join("\n");
                        const blob = new Blob([csv], { type: "text/csv" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a"); a.href = url; a.download = `campaign-${saveName || "export"}-all-${allMatched.length}.csv`; a.click();
                        URL.revokeObjectURL(url);
                      }}
                      sx={{ fontFamily: F, fontSize: FS.caption, textTransform: "none", borderRadius: "7px", borderColor: C.border, color: C.sub, px: 1.25, minWidth: 0, flexShrink: 0, "&:hover": { borderColor: `${C.blue}40` } }}>
                      CSV ({totalMatched})
                    </Button>
                  </Stack>
                </Box>

                {/* ════════════════════════════════════════════════════════════ */}
                {/* CHANNELS SECTION                                            */}
                {/* ════════════════════════════════════════════════════════════ */}
                <Box sx={{ mt: 2.5 }}>
                  <Stack direction="row" alignItems="center" gap={1} mb={1}>
                    <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.dim, textTransform: "uppercase", letterSpacing: "0.08em" }}>Channels</Typography>
                    {activeChannelCount > 0 && (
                      <Chip label={`${activeChannelCount} active`} size="small"
                        sx={{ fontFamily: F, fontSize: FS.micro, height: 18, bgcolor: `${C.orange}0c`, color: C.orange, fontWeight: FW.semibold }} />
                    )}
                    {selectedCompanies.size > 0 && (
                      <Chip label={`${selectedCompanies.size} companies selected`} size="small"
                        sx={{ fontFamily: F, fontSize: FS.micro, height: 18, bgcolor: `${C.blue}0c`, color: C.blue, fontWeight: FW.semibold }} />
                    )}
                    {!currentSavedId && companies.length > 0 && (
                      <Chip label="Save campaign first" size="small"
                        sx={{ fontFamily: F, fontSize: FS.micro, height: 18, bgcolor: `${C.amber}0c`, color: C.amber, fontWeight: FW.semibold }} />
                    )}
                  </Stack>

                  <Stack spacing={1}>

                    {/* ── LinkedIn Ads Channel ─────────────────────────────── */}
                    <Box sx={{
                      borderRadius: "10px",
                      border: `1.5px solid ${channels.linkedin.enabled ? `${C.linkedin}30` : C.border}`,
                      bgcolor: C.panel,
                      overflow: "hidden",
                      transition: "border-color 0.15s",
                    }}>
                      {/* Channel header */}
                      <Box sx={{
                        px: 1.5, py: 1,
                        display: "flex", alignItems: "center", gap: 1,
                        cursor: "pointer",
                        borderBottom: expandedChannel === "linkedin" && channels.linkedin.enabled ? `1px solid ${C.border}` : "none",
                      }}
                        onClick={() => setExpandedChannel(expandedChannel === "linkedin" ? null : "linkedin")}
                      >
                        <Box sx={{
                          width: 28, height: 28, borderRadius: "7px", flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          bgcolor: channels.linkedin.enabled ? `${C.linkedin}10` : `${C.dim}08`,
                          border: `1px solid ${channels.linkedin.enabled ? `${C.linkedin}25` : `${C.dim}12`}`,
                        }}>
                          <LinkedInIcon sx={{ fontSize: 16, color: channels.linkedin.enabled ? C.linkedin : C.dim }} />
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography sx={{ fontFamily: F, fontSize: FS.body, fontWeight: FW.semibold, color: C.text }}>LinkedIn Ads</Typography>
                          <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub }}>Matched audience targeting on LinkedIn</Typography>
                        </Box>
                        <StatusChip status={channels.linkedin.status} />
                        <Switch size="small" checked={channels.linkedin.enabled}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleChannel("linkedin")}
                          sx={{
                            "& .MuiSwitch-switchBase.Mui-checked": { color: C.linkedin },
                            "& .MuiSwitch-switchBase.Mui-checked+.MuiSwitch-track": { bgcolor: C.linkedin },
                          }} />
                        {channels.linkedin.enabled && (expandedChannel === "linkedin" ? <ExpandLessIcon sx={{ fontSize: 14, color: C.dim }} /> : <ExpandMoreIcon sx={{ fontSize: 14, color: C.dim }} />)}
                      </Box>

                      <Collapse in={channels.linkedin.enabled && expandedChannel === "linkedin"}>
                        <Box sx={{ px: 1.5, py: 1.25 }}>
                          {/* Audience criteria summary from ICP */}
                          {pageView === "builder" && icp && (
                            <Box sx={{ mb: 1.25, px: 1.25, py: 0.75, borderRadius: "6px", bgcolor: `${C.linkedin}06`, border: `1px solid ${C.linkedin}15` }}>
                              <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.linkedin, mb: 0.4 }}>Audience Criteria (from ICP)</Typography>
                              <Stack direction="row" flexWrap="wrap" gap={0.4}>
                                {icp.industries.slice(0, 4).map((ind) => (
                                  <Chip key={ind} label={ind} size="small" sx={{ fontFamily: F, fontSize: FS.micro, height: 17, bgcolor: `${C.linkedin}0c`, color: C.linkedin }} />
                                ))}
                                {icp.regions.map((r) => (
                                  <Chip key={r} label={r} size="small" variant="outlined" sx={{ fontFamily: F, fontSize: FS.micro, height: 17, borderColor: `${C.linkedin}40`, color: C.linkedin }} />
                                ))}
                                {icp.min_employees > 0 && (
                                  <Chip label={`${icp.min_employees}+ employees`} size="small" sx={{ fontFamily: F, fontSize: FS.micro, height: 17, bgcolor: `${C.linkedin}0c`, color: C.linkedin }} />
                                )}
                              </Stack>
                              <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub, mt: 0.5 }}>
                                This audience covers ~{selectedCompanies.size > 0 ? selectedCompanies.size : companies.length} of your matched companies
                              </Typography>
                            </Box>
                          )}
                          <Button size="small" variant="contained" disableElevation
                            onClick={handleLinkedInAudience}
                            disabled={!currentSavedId || selectedCompanies.size === 0 || linkedInLoading}
                            startIcon={linkedInLoading ? <CircularProgress size={12} color="inherit" /> : <CampaignIcon sx={{ fontSize: 14 }} />}
                            sx={{ fontFamily: F, fontSize: FS.small, textTransform: "none", borderRadius: "7px", bgcolor: C.linkedin, "&:hover": { bgcolor: "#084e96" }, mb: 1 }}>
                            {linkedInLoading ? "Loading..." : "Preview Audience"}
                          </Button>

                          {/* LinkedIn audience table inline */}
                          {linkedInAudience.length > 0 && (
                            <Box sx={{ mt: 1 }}>
                              <Box sx={{ mb: 1, px: 1, py: 0.5, borderRadius: "5px", bgcolor: `${C.linkedin}06`, border: `1px solid ${C.linkedin}15` }}>
                                <Stack direction="row" alignItems="center" gap={0.75}>
                                  <CampaignIcon sx={{ fontSize: 14, color: C.linkedin }} />
                                  <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.linkedin }}>
                                    Preview Only — {linkedInAudience.length} companies would be included
                                  </Typography>
                                </Stack>
                              </Box>
                              <Box sx={{ ...PREVIEW_ROW, gridTemplateColumns: AUDIENCE_COLS, pb: 0.5, borderBottom: `1px solid ${C.border}` }}>
                                {["Company", "Domain", "Employees", "Country", "Industry"].map((h) => (
                                  <Typography key={h} sx={{ ...previewHead(), textAlign: h === "Employees" ? "right" : "left" }}>{h}</Typography>
                                ))}
                              </Box>
                              {linkedInAudience.map((co, i) => (
                                <Box key={i} sx={{
                                  ...PREVIEW_ROW, gridTemplateColumns: AUDIENCE_COLS, py: 0.5,
                                  borderBottom: `1px solid ${C.border}08`,
                                  "&:hover": { bgcolor: `${C.linkedin}04` },
                                }}>
                                  <Typography noWrap sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: C.text }}>{co.company_name}</Typography>
                                  <Typography noWrap sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub }}>{co.domain || "-"}</Typography>
                                  <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{co.employees?.toLocaleString() || "-"}</Typography>
                                  <Typography noWrap sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub }}>{co.country || "-"}</Typography>
                                  <Typography noWrap sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub }}>{co.industry || "-"}</Typography>
                                </Box>
                              ))}
                            </Box>
                          )}
                        </Box>
                      </Collapse>
                    </Box>

                    {/* ── Email Outreach Channel ───────────────────────────── */}
                    <Box sx={{
                      borderRadius: "10px",
                      border: `1.5px solid ${channels.email.enabled ? `${C.orange}30` : C.border}`,
                      bgcolor: C.panel,
                      overflow: "hidden",
                      transition: "border-color 0.15s",
                    }}>
                      <Box sx={{
                        px: 1.5, py: 1,
                        display: "flex", alignItems: "center", gap: 1,
                        cursor: "pointer",
                        borderBottom: expandedChannel === "email" && channels.email.enabled ? `1px solid ${C.border}` : "none",
                      }}
                        onClick={() => setExpandedChannel(expandedChannel === "email" ? null : "email")}
                      >
                        <Box sx={{
                          width: 28, height: 28, borderRadius: "7px", flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          bgcolor: channels.email.enabled ? `${C.orange}10` : `${C.dim}08`,
                          border: `1px solid ${channels.email.enabled ? `${C.orange}25` : `${C.dim}12`}`,
                        }}>
                          <EmailIcon sx={{ fontSize: 16, color: channels.email.enabled ? C.orange : C.dim }} />
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography sx={{ fontFamily: F, fontSize: FS.body, fontWeight: FW.semibold, color: C.text }}>Email Outreach</Typography>
                          <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub }}>AI-generated personalized email sequences</Typography>
                        </Box>
                        <StatusChip status={channels.email.status} />
                        <Switch size="small" checked={channels.email.enabled}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleChannel("email")}
                          sx={{
                            "& .MuiSwitch-switchBase.Mui-checked": { color: C.orange },
                            "& .MuiSwitch-switchBase.Mui-checked+.MuiSwitch-track": { bgcolor: C.orange },
                          }} />
                        {channels.email.enabled && (expandedChannel === "email" ? <ExpandLessIcon sx={{ fontSize: 14, color: C.dim }} /> : <ExpandMoreIcon sx={{ fontSize: 14, color: C.dim }} />)}
                      </Box>

                      <Collapse in={channels.email.enabled && expandedChannel === "email"}>
                        <Box sx={{ px: 1.5, py: 1.25 }}>
                          {/* No contacts yet */}
                          {outreachContacts.length === 0 && (
                            <Box sx={{ textAlign: "center", py: 1.5 }}>
                              <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.sub, mb: 1 }}>
                                No contacts discovered yet. Find decision-makers at your matched companies.
                              </Typography>
                              <Button size="small" variant="contained" disableElevation
                                onClick={handleFindContacts}
                                disabled={!currentSavedId || selectedCompanies.size === 0 || contactsLoading}
                                startIcon={contactsLoading ? <CircularProgress size={12} color="inherit" /> : <PeopleOutlineIcon sx={{ fontSize: 14 }} />}
                                sx={{ fontFamily: F, fontSize: FS.small, textTransform: "none", borderRadius: "7px", bgcolor: C.blue, "&:hover": { bgcolor: "#3d44a8" } }}>
                                {contactsLoading ? "Discovering..." : "Discover Contacts"}
                              </Button>
                            </Box>
                          )}

                          {/* Contacts found — show table */}
                          {outreachContacts.length > 0 && (
                            <>
                              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                                <Stack direction="row" alignItems="center" gap={0.75}>
                                  <PeopleOutlineIcon sx={{ fontSize: 14, color: C.orange }} />
                                  <Typography sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: C.text }}>
                                    Contacts ({outreachContacts.length})
                                  </Typography>
                                  <Chip label={`${outreachContacts.filter(c => c.revealed).length} revealed`} size="small"
                                    sx={{ fontFamily: F, fontSize: FS.micro, height: 17, bgcolor: `${C.green}0c`, color: C.green, fontWeight: FW.semibold }} />
                                </Stack>
                                <Stack direction="row" gap={0.5} alignItems="center">
                                  <Button size="small" onClick={() => setEmailSelectedContacts(new Set(outreachContacts.map(c => c.id)))}
                                    sx={{ fontFamily: F, fontSize: FS.caption, textTransform: "none", color: C.orange, minWidth: 0 }}>Select All</Button>
                                  <Button size="small" onClick={() => setEmailSelectedContacts(new Set())}
                                    sx={{ fontFamily: F, fontSize: FS.caption, textTransform: "none", color: C.dim, minWidth: 0 }}>Clear</Button>
                                  {emailSelectedContacts.size > 0 && outreachContacts.some(c => !c.revealed && emailSelectedContacts.has(c.id)) && (
                                    <Button size="small" variant="contained" disableElevation
                                      onClick={handleRevealContacts} disabled={revealLoading}
                                      startIcon={revealLoading ? <CircularProgress size={10} color="inherit" /> : <OpenInNewIcon sx={{ fontSize: 11 }} />}
                                      sx={{ fontFamily: F, fontSize: FS.caption, textTransform: "none", borderRadius: "5px",
                                        bgcolor: C.green, "&:hover": { bgcolor: "#0a6a48" } }}>
                                      Reveal ({outreachContacts.filter(c => !c.revealed && emailSelectedContacts.has(c.id)).length})
                                    </Button>
                                  )}
                                </Stack>
                              </Stack>

                              {/* Contact rows */}
                              <Box sx={{ ...PREVIEW_ROW, gridTemplateColumns: EMAIL_CONTACT_COLS, pb: 0.5, borderBottom: `1px solid ${C.border}` }}>
                                {["", "Name", "Title", "Email", "Company", "Status"].map((h) => (
                                  <Typography key={h} sx={{ ...previewHead(), textAlign: h === "Status" ? "center" : "left" }}>{h}</Typography>
                                ))}
                              </Box>
                              {outreachContacts.map((c) => (
                                <Box key={c.id} sx={{
                                  ...PREVIEW_ROW, gridTemplateColumns: EMAIL_CONTACT_COLS, py: 0.4,
                                  borderBottom: `1px solid ${C.border}08`,
                                  bgcolor: emailSelectedContacts.has(c.id) ? `${C.orange}04` : "transparent",
                                  "&:hover": { bgcolor: `${C.orange}04` },
                                }}>
                                  <Checkbox size="small" checked={emailSelectedContacts.has(c.id)}
                                    onChange={() => toggleEmailContact(c.id)}
                                    sx={{ p: 0, color: C.dim, "&.Mui-checked": { color: C.orange }, "& .MuiSvgIcon-root": { fontSize: 14 } }} />
                                  <Typography noWrap sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: C.text }}>
                                    {c.first_name} {c.revealed ? c.last_name : (c.last_name || "").replace(/[a-z]/g, "*")}
                                  </Typography>
                                  <Typography noWrap sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub }}>{c.job_title || "-"}</Typography>
                                  <Typography noWrap sx={{ fontFamily: F, fontSize: FS.caption, color: c.email ? C.text : C.dim }}>
                                    {c.email || (c.revealed ? "-" : "Hidden")}
                                  </Typography>
                                  <Typography noWrap sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub }}>{c.company_name || "-"}</Typography>
                                  <Chip label={c.revealed ? "Revealed" : "Discovered"} size="small"
                                    sx={{ fontFamily: F, fontSize: FS.micro, height: 15,
                                      bgcolor: c.revealed ? `${C.green}0c` : `${C.amber}0c`,
                                      color: c.revealed ? C.green : C.amber }} />
                                </Box>
                              ))}

                              {/* Build emails button */}
                              <Box sx={{ mt: 1.25 }}>
                                <Button size="small" variant="contained" disableElevation
                                  onClick={handleBuildEmailSequence}
                                  disabled={emailSelectedContacts.size === 0 || emailsLoading}
                                  startIcon={emailsLoading ? <CircularProgress size={12} color="inherit" /> : <AutoAwesomeIcon sx={{ fontSize: 14 }} />}
                                  sx={{ fontFamily: F, fontSize: FS.small, textTransform: "none", borderRadius: "7px", bgcolor: C.orange, "&:hover": { bgcolor: C.orangeDark } }}>
                                  {emailsLoading ? "Generating..." : `Build Email Drafts (${emailSelectedContacts.size})`}
                                </Button>
                              </Box>
                            </>
                          )}

                          {/* Email drafts inline */}
                          {emailDrafts.length > 0 && (
                            <Box sx={{ mt: 1.5 }}>
                              <Box sx={{ mb: 1, px: 1, py: 0.5, borderRadius: "5px", bgcolor: `${C.amber}0a`, border: `1px solid ${C.amber}25` }}>
                                <Stack direction="row" alignItems="center" gap={0.5}>
                                  <WarningAmberIcon sx={{ fontSize: 14, color: C.amber }} />
                                  <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.amber }}>
                                    DRAFT ONLY — Review each email before use. No emails will be sent.
                                  </Typography>
                                </Stack>
                              </Box>
                              <Stack spacing={1.25}>
                                {emailDrafts.map((draft, idx) => (
                                  <Box key={draft.id} sx={{ p: 1.25, borderRadius: "7px", border: `1px solid ${C.border}`, bgcolor: C.card }}>
                                    <Stack direction="row" alignItems="center" justifyContent="space-between" mb={0.75}>
                                      <Stack direction="row" alignItems="center" gap={0.5}>
                                        <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.dim }}>#{idx + 1}</Typography>
                                        <Typography sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: C.text }}>{draft.contact_name || "Contact"}</Typography>
                                        <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub }}>({draft.contact_title || "Unknown"})</Typography>
                                        {draft.company_name && <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub }}>@ {draft.company_name}</Typography>}
                                      </Stack>
                                      <Chip label={draft.status} size="small" sx={{ fontFamily: F, fontSize: FS.micro, height: 17,
                                        bgcolor: draft.status === "draft" ? `${C.amber}0c` : `${C.green}0c`,
                                        color: draft.status === "draft" ? C.amber : C.green }} />
                                    </Stack>
                                    <TextField size="small" fullWidth label="Subject" value={draft.subject}
                                      onChange={(e) => { const updated = [...emailDrafts]; updated[idx] = { ...draft, subject: e.target.value }; setEmailDrafts(updated); }}
                                      sx={{ mb: 0.75, "& .MuiInputBase-root": { fontFamily: F, fontSize: FS.small, borderRadius: "6px", "& fieldset": { borderColor: C.border } }, "& .MuiInputLabel-root": { fontFamily: F, fontSize: FS.small } }} />
                                    <TextField size="small" fullWidth multiline minRows={4} maxRows={10} label="Body" value={draft.body}
                                      onChange={(e) => { const updated = [...emailDrafts]; updated[idx] = { ...draft, body: e.target.value }; setEmailDrafts(updated); }}
                                      sx={{ mb: 0.75, "& .MuiInputBase-root": { fontFamily: F, fontSize: FS.small, borderRadius: "6px", "& fieldset": { borderColor: C.border } }, "& .MuiInputLabel-root": { fontFamily: F, fontSize: FS.small } }} />
                                    <Box sx={{ textAlign: "right" }}>
                                      <Button size="small" variant="outlined" onClick={() => handleSaveEmailDraft(draft)}
                                        startIcon={<CheckCircleIcon sx={{ fontSize: 11 }} />}
                                        sx={{ fontFamily: F, fontSize: FS.caption, textTransform: "none", borderRadius: "5px", borderColor: C.border, color: C.green, "&:hover": { borderColor: C.green } }}>
                                        Save Draft
                                      </Button>
                                    </Box>
                                  </Box>
                                ))}
                              </Stack>
                            </Box>
                          )}
                        </Box>
                      </Collapse>
                    </Box>

                    {/* ── Phone Campaign Channel ──────────────────────────── */}
                    <Box sx={{
                      borderRadius: "10px",
                      border: `1.5px solid ${channels.phone.enabled ? `${C.green}30` : C.border}`,
                      bgcolor: C.panel,
                      overflow: "hidden",
                      transition: "border-color 0.15s",
                    }}>
                      <Box sx={{
                        px: 1.5, py: 1,
                        display: "flex", alignItems: "center", gap: 1,
                        cursor: "pointer",
                        borderBottom: expandedChannel === "phone" && channels.phone.enabled ? `1px solid ${C.border}` : "none",
                      }}
                        onClick={() => setExpandedChannel(expandedChannel === "phone" ? null : "phone")}
                      >
                        <Box sx={{
                          width: 28, height: 28, borderRadius: "7px", flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          bgcolor: channels.phone.enabled ? `${C.green}10` : `${C.dim}08`,
                          border: `1px solid ${channels.phone.enabled ? `${C.green}25` : `${C.dim}12`}`,
                        }}>
                          <PhoneIcon sx={{ fontSize: 16, color: channels.phone.enabled ? C.green : C.dim }} />
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography sx={{ fontFamily: F, fontSize: FS.body, fontWeight: FW.semibold, color: C.text }}>Phone Campaign</Typography>
                          <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub }}>AI-generated call scripts for SDR outreach</Typography>
                        </Box>
                        <StatusChip status={channels.phone.status} />
                        <Switch size="small" checked={channels.phone.enabled}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleChannel("phone")}
                          sx={{
                            "& .MuiSwitch-switchBase.Mui-checked": { color: C.green },
                            "& .MuiSwitch-switchBase.Mui-checked+.MuiSwitch-track": { bgcolor: C.green },
                          }} />
                        {channels.phone.enabled && (expandedChannel === "phone" ? <ExpandLessIcon sx={{ fontSize: 14, color: C.dim }} /> : <ExpandMoreIcon sx={{ fontSize: 14, color: C.dim }} />)}
                      </Box>

                      <Collapse in={channels.phone.enabled && expandedChannel === "phone"}>
                        <Box sx={{ px: 1.5, py: 1.25 }}>
                          {/* No contacts yet — shared with email */}
                          {outreachContacts.length === 0 && (
                            <Box sx={{ textAlign: "center", py: 1.5 }}>
                              <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.sub, mb: 1 }}>
                                No contacts discovered yet. Find decision-makers at your matched companies.
                              </Typography>
                              <Button size="small" variant="contained" disableElevation
                                onClick={handleFindContacts}
                                disabled={!currentSavedId || selectedCompanies.size === 0 || contactsLoading}
                                startIcon={contactsLoading ? <CircularProgress size={12} color="inherit" /> : <PeopleOutlineIcon sx={{ fontSize: 14 }} />}
                                sx={{ fontFamily: F, fontSize: FS.small, textTransform: "none", borderRadius: "7px", bgcolor: C.blue, "&:hover": { bgcolor: "#3d44a8" } }}>
                                {contactsLoading ? "Discovering..." : "Discover Contacts"}
                              </Button>
                            </Box>
                          )}

                          {/* Contacts found — show table with phone selection */}
                          {outreachContacts.length > 0 && (
                            <>
                              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                                <Stack direction="row" alignItems="center" gap={0.75}>
                                  <PhoneIcon sx={{ fontSize: 14, color: C.green }} />
                                  <Typography sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: C.text }}>
                                    Contacts ({outreachContacts.length})
                                  </Typography>
                                </Stack>
                                <Stack direction="row" gap={0.5} alignItems="center">
                                  <Button size="small" onClick={() => setPhoneSelectedContacts(new Set(outreachContacts.map(c => c.id)))}
                                    sx={{ fontFamily: F, fontSize: FS.caption, textTransform: "none", color: C.green, minWidth: 0 }}>Select All</Button>
                                  <Button size="small" onClick={() => setPhoneSelectedContacts(new Set())}
                                    sx={{ fontFamily: F, fontSize: FS.caption, textTransform: "none", color: C.dim, minWidth: 0 }}>Clear</Button>
                                </Stack>
                              </Stack>

                              <Box sx={{ ...PREVIEW_ROW, gridTemplateColumns: PHONE_CONTACT_COLS, pb: 0.5, borderBottom: `1px solid ${C.border}` }}>
                                {["", "Name", "Title", "Company", "Status"].map((h) => (
                                  <Typography key={h} sx={{ ...previewHead(), textAlign: h === "Status" ? "center" : "left" }}>{h}</Typography>
                                ))}
                              </Box>
                              {outreachContacts.map((c) => (
                                <Box key={c.id} sx={{
                                  ...PREVIEW_ROW, gridTemplateColumns: PHONE_CONTACT_COLS, py: 0.4,
                                  borderBottom: `1px solid ${C.border}08`,
                                  bgcolor: phoneSelectedContacts.has(c.id) ? `${C.green}04` : "transparent",
                                  "&:hover": { bgcolor: `${C.green}04` },
                                }}>
                                  <Checkbox size="small" checked={phoneSelectedContacts.has(c.id)}
                                    onChange={() => togglePhoneContact(c.id)}
                                    sx={{ p: 0, color: C.dim, "&.Mui-checked": { color: C.green }, "& .MuiSvgIcon-root": { fontSize: 14 } }} />
                                  <Typography noWrap sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: C.text }}>
                                    {c.first_name} {c.revealed ? c.last_name : (c.last_name || "").replace(/[a-z]/g, "*")}
                                  </Typography>
                                  <Typography noWrap sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub }}>{c.job_title || "-"}</Typography>
                                  <Typography noWrap sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub }}>{c.company_name || "-"}</Typography>
                                  <Chip label={c.revealed ? "Revealed" : "Discovered"} size="small"
                                    sx={{ fontFamily: F, fontSize: FS.micro, height: 15,
                                      bgcolor: c.revealed ? `${C.green}0c` : `${C.amber}0c`,
                                      color: c.revealed ? C.green : C.amber }} />
                                </Box>
                              ))}

                              {/* Build call scripts button */}
                              <Box sx={{ mt: 1.25 }}>
                                <Button size="small" variant="contained" disableElevation
                                  onClick={handleBuildCallScript}
                                  disabled={phoneSelectedContacts.size === 0 || callScriptsLoading}
                                  startIcon={callScriptsLoading ? <CircularProgress size={12} color="inherit" /> : <PhoneIcon sx={{ fontSize: 14 }} />}
                                  sx={{ fontFamily: F, fontSize: FS.small, textTransform: "none", borderRadius: "7px", bgcolor: C.green, "&:hover": { bgcolor: "#0a6a48" } }}>
                                  {callScriptsLoading ? "Generating..." : `Build Call Scripts (${phoneSelectedContacts.size})`}
                                </Button>
                              </Box>
                            </>
                          )}

                          {/* Call scripts inline */}
                          {callScripts.length > 0 && (
                            <Box sx={{ mt: 1.5 }}>
                              <Box sx={{ mb: 1, px: 1, py: 0.5, borderRadius: "5px", bgcolor: `${C.amber}0a`, border: `1px solid ${C.amber}25` }}>
                                <Stack direction="row" alignItems="center" gap={0.5}>
                                  <WarningAmberIcon sx={{ fontSize: 14, color: C.amber }} />
                                  <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.amber }}>
                                    SCRIPT ONLY — Review and customize each script before use.
                                  </Typography>
                                </Stack>
                              </Box>
                              <Stack spacing={1.25}>
                                {callScripts.map((script, idx) => (
                                  <Box key={script.id} sx={{ p: 1.25, borderRadius: "7px", border: `1px solid ${C.border}`, bgcolor: C.card }}>
                                    <Stack direction="row" alignItems="center" justifyContent="space-between" mb={0.75}>
                                      <Stack direction="row" alignItems="center" gap={0.5}>
                                        <Typography sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.dim }}>#{idx + 1}</Typography>
                                        <Typography sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: C.text }}>{script.contact_name || "Contact"}</Typography>
                                        <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub }}>({script.contact_title || "Unknown"})</Typography>
                                        {script.company_name && <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub }}>@ {script.company_name}</Typography>}
                                      </Stack>
                                      <Chip label={script.status} size="small" sx={{ fontFamily: F, fontSize: FS.micro, height: 17,
                                        bgcolor: script.status === "draft" ? `${C.amber}0c` : `${C.green}0c`,
                                        color: script.status === "draft" ? C.amber : C.green }} />
                                    </Stack>
                                    <TextField size="small" fullWidth label="Opening / Objective" value={script.subject}
                                      onChange={(e) => { const updated = [...callScripts]; updated[idx] = { ...script, subject: e.target.value }; setCallScripts(updated); }}
                                      sx={{ mb: 0.75, "& .MuiInputBase-root": { fontFamily: F, fontSize: FS.small, borderRadius: "6px", "& fieldset": { borderColor: C.border } }, "& .MuiInputLabel-root": { fontFamily: F, fontSize: FS.small } }} />
                                    <TextField size="small" fullWidth multiline minRows={6} maxRows={12} label="Call Script" value={script.body}
                                      onChange={(e) => { const updated = [...callScripts]; updated[idx] = { ...script, body: e.target.value }; setCallScripts(updated); }}
                                      sx={{ mb: 0.75, "& .MuiInputBase-root": { fontFamily: F, fontSize: FS.small, borderRadius: "6px", "& fieldset": { borderColor: C.border } }, "& .MuiInputLabel-root": { fontFamily: F, fontSize: FS.small } }} />
                                    <Box sx={{ textAlign: "right" }}>
                                      <Button size="small" variant="outlined" onClick={() => handleSaveEmailDraft(script)}
                                        startIcon={<CheckCircleIcon sx={{ fontSize: 11 }} />}
                                        sx={{ fontFamily: F, fontSize: FS.caption, textTransform: "none", borderRadius: "5px", borderColor: C.border, color: C.green, "&:hover": { borderColor: C.green } }}>
                                        Save Script
                                      </Button>
                                    </Box>
                                  </Box>
                                ))}
                              </Stack>
                            </Box>
                          )}
                        </Box>
                      </Collapse>
                    </Box>

                  </Stack>
                </Box>
              </>
            )}
          </Box>
        </Box>
      )}

      {/* Unsaved dialog */}
      <UnsavedDialog
        open={unsavedDialogOpen}
        onCancel={() => { setUnsavedDialogOpen(false); pendingActionRef.current = null; }}
        onConfirm={() => { setUnsavedDialogOpen(false); pendingActionRef.current?.(); pendingActionRef.current = null; }}
      />
    </Box>
  );
}
