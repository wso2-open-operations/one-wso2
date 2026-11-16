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
import { Check as CheckIcon } from "../icons";
import { LinkedIn as LinkedInIcon } from "../icons";
import {
  Box, Button, Checkbox, Chip, CircularProgress, IconButton, Snackbar, Tooltip, Typography,
} from "@wso2/oxygen-ui";
import { useState } from "react";
import { CompanyContactsResponse, ContactRow } from "../api/client";
import { C, F } from "../theme/pageTokens";
import { FS, FW, LABEL } from "../theme/typeScale";
import RevealContactsDialog, { DoNotCallChip, ProviderChip } from "./RevealContactsDialog";

/** Rows shown before the "Show all" toggle. */
const TOP_N = 10;
/** Selection cap until the estimate endpoint tells us the real `max_per_run`. */
const DEFAULT_MAX_PER_RUN = 10;
// checkbox | Name | Title | Quality | Email | Direct | Mobile | Source — header and rows share
// one template so labels sit exactly over their cells.
const COLS_CONTACTS = "32px 1.2fr 1.2fr 56px 1.4fr 120px 120px 76px";
const HEAD_ROW = { gap: 1, px: 1.5, py: 0.6, alignItems: "center" } as const;
const BODY_ROW = { gap: 1, px: 1.5, py: 0.7, alignItems: "center" } as const;

/** Display name for a contact ("First Last", falling back to whichever part exists). */
export function contactName(c: Pick<ContactRow, "first_name" | "last_name">): string {
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "(unnamed)";
}
/** A row is revealed once any paid field (email / direct / mobile) is present. */
function isRevealed(c: ContactRow): boolean { return !!(c.email || c.phone || c.mobile_phone); }
/** A row is revealable when a provider reports at least one field we could buy. */
function isRevealable(c: ContactRow): boolean { return !!(c.has_email || c.has_direct_phone || c.has_mobile_phone); }

/** Em-dash placeholder for an empty cell. */
function Dash() {
  return <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.dim }}>—</Typography>;
}

/** Match-quality chip: ≥80 green, 60–79 amber, below 60 dim; null → "—". */
function QualityChip({ value }: { value: number | null }) {
  if (value == null) return <Dash />;
  const v = Math.round(value);
  const color = v >= 80 ? C.green : v >= 60 ? C.amber : C.sub;
  return (
    <Tooltip title={`Match confidence ${v}`} arrow placement="top">
      <Chip label={v} size="small"
        sx={{ fontFamily: F, fontSize: FS.micro, height: 18, minWidth: 30, fontWeight: FW.semibold, bgcolor: `${color}12`, color, border: `1px solid ${color}30`, fontVariantNumeric: "tabular-nums" }} />
    </Tooltip>
  );
}

/** Email cell: the address once revealed, "Available" when a provider has one, else "—". */
function EmailCell({ value, available }: { value: string | null; available: boolean }) {
  if (value) return <Typography noWrap title={value} sx={{ fontFamily: F, fontSize: FS.small, color: C.text, fontWeight: FW.medium }}>{value}</Typography>;
  if (available) return (
    <Chip label="Available" size="small"
      sx={{ fontFamily: F, fontSize: FS.micro, height: 18, fontWeight: FW.semibold, bgcolor: `${C.green}10`, color: C.green, border: `1px solid ${C.green}25`, justifySelf: "start" }} />
  );
  return <Dash />;
}

/** Phone cell (direct or mobile): the number once revealed, a green tick when available, else "—";
 * a red "Do not call" marker is appended when the provider flags the number. */
function PhoneCell({ value, available, doNotCall }: { value: string | null; available: boolean; doNotCall: boolean | null }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap", minWidth: 0 }}>
      {value
        ? <Typography noWrap title={value} sx={{ fontFamily: F, fontSize: FS.small, color: C.text, fontWeight: FW.medium }}>{value}</Typography>
        : available
          ? <Tooltip title="Available from the provider" arrow placement="top"><CheckIcon sx={{ fontSize: 15, color: C.green }} /></Tooltip>
          : <Dash />}
      {doNotCall && <DoNotCallChip />}
    </Box>
  );
}

/** Header chip — quiet tinted pill for counts and balances. */
function InfoChip({ label, color, title }: { label: string; color: string; title?: string }) {
  const chip = (
    <Chip label={label} size="small"
      sx={{ fontFamily: F, fontSize: FS.micro, height: 20, fontWeight: FW.semibold, bgcolor: `${color}10`, color, border: `1px solid ${color}25` }} />
  );
  return title ? <Tooltip title={title} arrow>{chip}</Tooltip> : chip;
}

/** Props for the Company Detail → Contacts tab panel. */
export interface CompanyContactsPanelProps {
  /** Whether the company has a domain (contact discovery needs one); the API's `has_domain` wins when present. */
  hasDomain: boolean;
  data: CompanyContactsResponse | null;
  loading: boolean;
  /** Re-fetch the contacts payload (called after a reveal run). */
  onReload: () => void;
}

/** Contacts tab: one ranked table of saved contacts (best-first as returned by the API) with
 * per-field availability, multi-select up to `max_per_run`, and a reveal flow that shows the exact
 * credit cost before anything is spent. */
export default function CompanyContactsPanel({ hasDomain: hasDomainProp, data, loading, onReload }: CompanyContactsPanelProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [maxPerRun, setMaxPerRun] = useState(DEFAULT_MAX_PER_RUN);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);

  const rows = data?.contacts ?? [];
  const hasDomain = data?.has_domain ?? hasDomainProp;

  // Drop selections that no longer make sense after a reload (revealed, or gone). Done while
  // rendering, against the payload last seen, so the pruned selection is what first paints.
  const [seenData, setSeenData] = useState(data);
  if (seenData !== data) {
    setSeenData(data);
    if (data) {
      const byId = new Map(data.contacts.map((c) => [c.id, c]));
      const next = new Set([...selected].filter((id) => {
        const c = byId.get(id);
        return !!c && !isRevealed(c) && isRevealable(c);
      }));
      if (next.size !== selected.size) setSelected(next);
    }
  }

  const saved = rows.length;
  const totalAvailable = data?.discovery.total_available ?? null;
  const moreAvailable = totalAvailable != null ? Math.max(0, totalAvailable - saved) : 0;
  const ziLeft = data?.credits.zoominfo_remaining ?? null;
  const cooldown = data?.cooldown;
  const visible = showAll ? rows : rows.slice(0, TOP_N);
  const selectable = rows.filter((c) => !isRevealed(c) && isRevealable(c));
  const atCap = selected.size >= maxPerRun;

  const toggle = (id: number) => setSelected((cur) => {
    const next = new Set(cur);
    if (next.has(id)) next.delete(id); else if (next.size < maxPerRun) next.add(id);
    return next;
  });
  const selectTop = () => setSelected(new Set(selectable.slice(0, maxPerRun).map((c) => c.id)));

  const providerTotals = Object.entries(data?.discovery.provider_totals ?? {}).filter(([, n]) => n > 0)
    .map(([p, n]) => `${p === "zoominfo" ? "ZoomInfo" : p === "apollo" ? "Apollo" : p}: ${n.toLocaleString()}`).join(" · ");

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Typography sx={{ fontFamily: F, fontSize: FS.body, fontWeight: FW.semibold, color: C.text }}>Contacts</Typography>
        {saved > 0 && <InfoChip label={`${saved.toLocaleString()} saved`} color={C.textMd} />}
        {moreAvailable > 0 && (
          <InfoChip label={`${moreAvailable.toLocaleString()} more available at providers`} color={C.blue}
            title={providerTotals ? `Provider totals — ${providerTotals}` : undefined} />
        )}
        {cooldown?.cached && cooldown.days_ago != null && (
          <InfoChip label={`Discovered ${cooldown.days_ago}d ago`} color={C.blue}
            title={cooldown.days_remaining != null ? `Rediscovery available in ${cooldown.days_remaining}d` : undefined} />
        )}
        {ziLeft != null && (
          <InfoChip label={`ZoomInfo credits left: ${ziLeft.toLocaleString()}`} color="#06b6d4"
            title={data?.credits.as_of ? `As of ${new Date(data.credits.as_of).toLocaleString()}` : undefined} />
        )}
      </Box>

      {!hasDomain && (
        <Box sx={{ py: 3, textAlign: "center" }}>
          <Typography sx={{ fontFamily: F, fontSize: FS.body, color: C.dim }}>No domain available — cannot search contacts.</Typography>
        </Box>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={22} sx={{ color: C.orange }} />
        </Box>
      ) : rows.length === 0 && hasDomain ? (
        <Box sx={{ py: 4, textAlign: "center", border: `1px dashed ${C.border}`, borderRadius: "10px" }}>
          <Typography sx={{ fontFamily: F, fontSize: FS.body, color: C.dim, mb: 0.5 }}>No contacts discovered yet</Typography>
          <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.sub }}>Click "Enrich Company" in the header to discover decision-makers</Typography>
        </Box>
      ) : rows.length > 0 && (
        <Box sx={{ p: 2, borderRadius: "10px", border: `1px solid ${C.border}`, bgcolor: C.panel }}>
          {/* Toolbar */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
            <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub }}>
              Ranked by match quality · {selected.size} of {maxPerRun} selected
              {atCap && <Box component="span" sx={{ color: C.amber, fontWeight: FW.medium }}> · max {maxPerRun} per run</Box>}
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Button size="small" variant="text" disabled={selectable.length === 0} onClick={selectTop}
              sx={{ fontFamily: F, textTransform: "none", fontSize: FS.caption, fontWeight: FW.semibold, color: C.orange, minWidth: 0, px: 1, "&:hover": { bgcolor: `${C.orange}08` } }}>
              Select top {maxPerRun}
            </Button>
            {selected.size > 0 && (
              <Button size="small" variant="text" onClick={() => setSelected(new Set())}
                sx={{ fontFamily: F, textTransform: "none", fontSize: FS.caption, color: C.sub, minWidth: 0, px: 1 }}>
                Clear
              </Button>
            )}
            <Button size="small" variant="contained" disableElevation disabled={selected.size === 0} onClick={() => setDialogOpen(true)}
              sx={{ fontFamily: F, textTransform: "none", fontSize: FS.small, fontWeight: FW.semibold, borderRadius: "8px", px: 1.75, py: 0.5, bgcolor: C.orange, color: "#fff", "&:hover": { bgcolor: C.orangeDark }, "&.Mui-disabled": { bgcolor: `${C.orange}40`, color: "#fff" } }}>
              Reveal selected ({selected.size})
            </Button>
          </Box>

          {/* Ranked table */}
          <Box sx={{ borderRadius: "8px", border: `1px solid ${C.border}`, overflow: "hidden" }}>
            <Box sx={{ display: "grid", gridTemplateColumns: COLS_CONTACTS, ...HEAD_ROW, bgcolor: C.cardBg, borderBottom: `1px solid ${C.border}` }}>
              <Box />
              {["Name", "Title", "Quality", "Email", "Direct", "Mobile", "Source"].map((h) => (
                <Typography key={h} sx={{ ...LABEL, fontFamily: F, color: C.dim, textAlign: h === "Quality" || h === "Source" ? "center" : "left" }}>{h}</Typography>
              ))}
            </Box>
            {visible.map((c) => {
              const revealed = isRevealed(c);
              const revealable = isRevealable(c);
              const checked = selected.has(c.id);
              const disabled = revealed || !revealable || (!checked && atCap);
              const tip = revealed ? "Revealed" : !revealable ? "Nothing to reveal" : (!checked && atCap) ? `Max ${maxPerRun} per run` : "";
              return (
                <Box key={c.id} onClick={() => { if (!disabled) toggle(c.id); }} sx={{
                  display: "grid", gridTemplateColumns: COLS_CONTACTS, ...BODY_ROW,
                  cursor: disabled ? "default" : "pointer",
                  bgcolor: checked ? `${C.orange}06` : "transparent",
                  boxShadow: revealed ? `inset 3px 0 0 ${C.green}` : "none",
                  borderBottom: `1px solid ${C.borderSoft}`,
                  "&:hover": { bgcolor: checked ? `${C.orange}0a` : `${C.orange}03` },
                }}>
                  {/* Select / revealed marker */}
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {revealed ? (
                      <Tooltip title="Revealed" arrow placement="top"><CheckCircleIcon sx={{ fontSize: 16, color: C.green }} /></Tooltip>
                    ) : (
                      <Tooltip title={tip} arrow placement="top">
                        <span>
                          <Checkbox size="small" checked={checked} disabled={disabled} onChange={() => toggle(c.id)} onClick={(e) => e.stopPropagation()}
                            inputProps={{ "aria-label": `Select ${contactName(c)}` }}
                            sx={{ p: 0, color: C.dim, "&.Mui-checked": { color: C.orange } }} />
                        </span>
                      </Tooltip>
                    )}
                  </Box>
                  {/* Name + LinkedIn */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: revealed || revealable ? C.text : C.sub }}>
                      {contactName(c)}
                    </Typography>
                    {c.linkedin_url && (
                      <Tooltip title="LinkedIn profile" arrow placement="top">
                        <IconButton size="small" component="a" href={c.linkedin_url} target="_blank" rel="noopener noreferrer"
                          aria-label="LinkedIn profile" onClick={(e) => e.stopPropagation()} sx={{ p: 0.1, color: C.linkedin }}>
                          <LinkedInIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                  <Typography noWrap title={c.job_title ?? undefined} sx={{ fontFamily: F, fontSize: FS.small, color: revealed || revealable ? C.textMd : C.dim }}>
                    {c.job_title || "—"}
                  </Typography>
                  <Box sx={{ display: "flex", justifyContent: "center" }}><QualityChip value={c.match_confidence} /></Box>
                  <EmailCell value={c.email} available={c.has_email} />
                  <PhoneCell value={c.phone} available={c.has_direct_phone} doNotCall={c.direct_phone_do_not_call} />
                  <PhoneCell value={c.mobile_phone} available={c.has_mobile_phone} doNotCall={c.mobile_phone_do_not_call} />
                  <Box sx={{ display: "flex", justifyContent: "center" }}><ProviderChip provider={c.source} /></Box>
                </Box>
              );
            })}
            {rows.length > TOP_N && (
              <Box sx={{ display: "flex", justifyContent: "center", py: 0.75, bgcolor: C.cardBg }}>
                <Typography onClick={() => setShowAll((v) => !v)}
                  sx={{ fontFamily: F, fontSize: FS.caption, fontWeight: FW.semibold, color: C.orange, cursor: "pointer", "&:hover": { textDecoration: "underline" } }}>
                  {showAll ? `Show top ${TOP_N}` : `Show all (${rows.length})`}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      )}

      <RevealContactsDialog
        open={dialogOpen}
        contactIds={[...selected]}
        onClose={() => setDialogOpen(false)}
        onEstimate={(e) => { if (e.max_per_run > 0) setMaxPerRun(e.max_per_run); }}
        onRevealed={() => { setSelected(new Set()); onReload(); }}
        onError={setSnack}
      />
      <Snackbar open={!!snack} autoHideDuration={6000} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }} message={snack ?? ""} />
    </Box>
  );
}
