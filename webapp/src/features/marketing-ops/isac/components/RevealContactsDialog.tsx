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
import { WarningAmber as WarningAmberIcon } from "../icons";
import {
  Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, LinearProgress, Tooltip, Typography,
} from "@wso2/oxygen-ui";
import { useEffect, useState } from "react";
import { RevealBulkResult, RevealEstimate, RevealEstimateItem, RevealResultItem, useApiClient } from "../api/client";
import { C, F } from "../theme/pageTokens";
import { FS, FW, LABEL } from "../theme/typeScale";

/** Provider chip colours shared by the Contacts panel and this dialog (same hues as CompanyDetail's source tags). */
export const PROVIDER_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  apollo:   { bg: "#6366f110", fg: "#6366f1", label: "Apollo" },
  zoominfo: { bg: "#06b6d410", fg: "#06b6d4", label: "ZoomInfo" },
  ai:       { bg: "#8b5cf610", fg: "#8b5cf6", label: "AI" },
};

/** Small provider chip (Apollo / ZoomInfo / …); unknown or missing providers get a grey chip. */
export function ProviderChip({ provider }: { provider: string | null | undefined }) {
  const s = (provider && PROVIDER_COLORS[provider]) || { bg: `${C.dim}10`, fg: C.dim, label: provider || "—" };
  return (
    <Chip label={s.label} size="small"
      sx={{ fontFamily: F, fontSize: FS.micro, height: 18, fontWeight: FW.semibold, bgcolor: s.bg, color: s.fg, border: `1px solid ${s.fg}25` }} />
  );
}

/** Tiny red "Do not call" marker shown next to phone numbers flagged by the provider. */
export function DoNotCallChip() {
  return (
    <Tooltip title="Flagged as do-not-call by the provider" arrow placement="top">
      <Chip label="Do not call" size="small"
        sx={{ fontFamily: F, fontSize: FS.micro, height: 16, fontWeight: FW.semibold, bgcolor: `${C.red}12`, color: C.red, border: `1px solid ${C.red}30`, "& .MuiChip-label": { px: 0.6 } }} />
    </Tooltip>
  );
}

/** Compact status chip: coloured text on a tinted background. */
function StatusChip({ label, color }: { label: string; color: string }) {
  return (
    <Chip label={label} size="small"
      sx={{ fontFamily: F, fontSize: FS.micro, height: 18, fontWeight: FW.semibold, bgcolor: `${color}12`, color, border: `1px solid ${color}30` }} />
  );
}

/** Label + colour for an estimate line status (string-typed so unexpected backend values still render). */
function estimateStatus(status: string): { label: string; color: string } {
  switch (status) {
    case "ready": return { label: "Ready", color: C.green };
    case "already_revealed": return { label: "Already revealed", color: C.sub };
    case "opted_out": return { label: "Opted out", color: C.red };
    case "no_provider": return { label: "No provider", color: C.amber };
    case "over_limit": return { label: "Over limit", color: C.amber };
    default: return { label: status.replace(/_/g, " "), color: C.sub };
  }
}

/** Label + colour for a bulk-run result status. */
function resultStatus(status: string): { label: string; color: string } {
  switch (status) {
    case "revealed": return { label: "Revealed", color: C.green };
    case "no_match": return { label: "No match", color: C.amber };
    case "no_data": return { label: "No data", color: C.amber };
    case "opted_out": return { label: "Opted out", color: C.red };
    case "already_revealed": return { label: "Already revealed", color: C.sub };
    case "failed": return { label: "Failed", color: C.red };
    case "skipped": return { label: "Skipped", color: C.sub };
    default: return { label: status.replace(/_/g, " "), color: C.sub };
  }
}

/** Error → user-facing message (the API client throws Error(detail) on non-2xx). */
function errMsg(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/** "Email ✓ · Direct ✓ · Mobile ✓" tags for what a reveal is expected to return. */
function ExpectTags({ expect }: { expect: RevealEstimateItem["expect"] }) {
  const parts = [expect.email && "Email", expect.direct_phone && "Direct", expect.mobile_phone && "Mobile"].filter(Boolean) as string[];
  if (parts.length === 0) return <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.dim }}>—</Typography>;
  return (
    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
      {parts.map((p) => (
        <Box key={p} component="span" sx={{ fontFamily: F, fontSize: FS.micro, fontWeight: FW.semibold, color: C.green, bgcolor: `${C.green}10`, px: 0.6, py: 0.1, borderRadius: "3px", whiteSpace: "nowrap" }}>
          {p} ✓
        </Box>
      ))}
    </Box>
  );
}

const COLS_ESTIMATE = "1.4fr 90px 1.4fr 60px 130px";
const COLS_RESULT = "1.4fr 90px 130px 60px 1.4fr";
// Layout only — colours are applied inline so they follow the live theme tokens.
const HEAD_ROW = { display: "grid", gap: 1, px: 1, py: 0.6, alignItems: "center" } as const;
const BODY_ROW = { display: "grid", gap: 1, px: 1, py: 0.7, alignItems: "center" } as const;

/** Props for the reveal estimate → confirm → run dialog. */
export interface RevealContactsDialogProps {
  open: boolean;
  /** Saved contact ids to estimate; read when the dialog opens (later changes while open are ignored). */
  contactIds: number[];
  onClose: () => void;
  /** Fired with the estimate so the parent can adopt `max_per_run` as its selection cap. */
  onEstimate?: (estimate: RevealEstimate) => void;
  /** Fired once a bulk run completes; the parent reloads its contacts list. */
  onRevealed: (result: RevealBulkResult) => void;
  /** Fired for estimate / run failures so the parent can show a Snackbar. */
  onError: (message: string) => void;
}

type Phase = "estimating" | "ready" | "running" | "done" | "error";

/** Reveal flow for saved contacts: shows the per-contact provider, expected fields and credit
 * cost from `/reveal/estimate`, then runs `/reveal/bulk` on confirmation and shows the outcome.
 * Only contacts the estimate marks "ready" are sent to the bulk endpoint. */
export default function RevealContactsDialog({ open, contactIds, onClose, onEstimate, onRevealed, onError }: RevealContactsDialogProps) {
  const { request } = useApiClient();
  const [phase, setPhase] = useState<Phase>("estimating");
  const [estimate, setEstimate] = useState<RevealEstimate | null>(null);
  const [result, setResult] = useState<RevealBulkResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Estimate on open (and on Retry). Deliberately not keyed on contactIds: the parent clears its
  // selection after a successful run while the summary is still showing, and that must not
  // trigger a fresh (empty) estimate.
  // Each new run (the dialog opening, or a Retry while open) starts from a clean slate; the reset
  // happens while rendering, keyed on the run last seen, and the effect below only does the fetch.
  const [seenOpen, setSeenOpen] = useState(open);
  const [seenAttempt, setSeenAttempt] = useState(attempt);
  if (seenOpen !== open || seenAttempt !== attempt) {
    setSeenOpen(open);
    setSeenAttempt(attempt);
    if (open) { setPhase("estimating"); setEstimate(null); setResult(null); setError(null); }
  }
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    request<RevealEstimate>("post", "/contact-enrichment/reveal/estimate", { contact_ids: contactIds })
      .then((e) => { if (cancelled) return; setEstimate(e); setPhase("ready"); onEstimate?.(e); })
      .catch((err) => {
        if (cancelled) return;
        const m = errMsg(err, "Could not estimate the reveal cost.");
        setError(m); setPhase("error"); onError(m);
      });
    return () => { cancelled = true; };
  }, [open, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = estimate?.items ?? [];
  const readyItems = items.filter((i) => i.status === "ready");
  const nameById = new Map(items.map((i) => [i.contact_id, i.name]));

  const handleConfirm = async () => {
    if (!estimate || readyItems.length === 0) return;
    setPhase("running"); setError(null);
    try {
      const r = await request<RevealBulkResult>("post", "/contact-enrichment/reveal/bulk", { contact_ids: readyItems.map((i) => i.contact_id) });
      setResult(r); setPhase("done"); onRevealed(r);
    } catch (err) {
      const m = errMsg(err, "Reveal failed — no contacts were updated.");
      setError(m); setPhase("ready"); onError(m);
    }
  };

  const running = phase === "running";
  const byProvider = Object.entries(estimate?.by_provider ?? {}).filter(([, n]) => n > 0);
  const providerBreakdown = byProvider.map(([p, n]) => `${PROVIDER_COLORS[p]?.label ?? p} ${n}`).join(" · ");
  const ziLeft = (phase === "done" ? result?.credits.zoominfo_remaining : estimate?.credits.zoominfo_remaining) ?? null;

  // Result summary buckets
  const results: RevealResultItem[] = result?.results ?? [];
  const nNoMatch = results.filter((r) => r.status === "no_match" || r.status === "no_data").length;
  const nFailed = results.filter((r) => r.status === "failed").length;
  const nSkippedRun = results.filter((r) => r.status === "skipped" || r.status === "opted_out" || r.status === "already_revealed").length;
  const nSkipped = nSkippedRun + (items.length - readyItems.length);

  const linkSx = { fontFamily: F, fontSize: FS.small, color: C.sub, textTransform: "none" as const };

  return (
    <Dialog open={open} onClose={running ? undefined : onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { fontFamily: F, borderRadius: "12px", border: `1px solid ${C.border}` } }}>
      <DialogTitle sx={{ fontFamily: F, fontWeight: FW.bold, fontSize: FS.title, pb: 0.5 }}>
        {phase === "done" ? "Reveal complete" : "Reveal contacts"}
        <Typography component="span" sx={{ fontFamily: F, fontSize: FS.small, color: C.sub, fontWeight: FW.regular, ml: 1 }}>
          {phase === "done" ? `${result?.revealed ?? 0} of ${readyItems.length} revealed` : `${contactIds.length} selected`}
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pt: 0.5, px: 3 }}>
        {phase === "estimating" && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 4, justifyContent: "center" }}>
            <CircularProgress size={18} sx={{ color: C.orange }} />
            <Typography sx={{ fontFamily: F, fontSize: FS.body, color: C.sub }}>Checking providers and credit cost…</Typography>
          </Box>
        )}

        {phase === "error" && (
          <Box sx={{ py: 3, textAlign: "center" }}>
            <Typography sx={{ fontFamily: F, fontSize: FS.body, color: C.red, mb: 1 }}>{error}</Typography>
            <Button size="small" onClick={() => setAttempt((a) => a + 1)} sx={{ ...linkSx, color: C.orange, fontWeight: FW.semibold }}>Retry</Button>
          </Box>
        )}

        {(phase === "ready" || phase === "running") && estimate && (
          <>
            <Box sx={{ borderRadius: "8px", border: `1px solid ${C.border}`, overflow: "hidden" }}>
              <Box sx={{ ...HEAD_ROW, gridTemplateColumns: COLS_ESTIMATE }}>
                {["Contact", "Provider", "What to expect", "Credits", "Status"].map((h) => (
                  <Typography key={h} sx={{ ...LABEL, fontFamily: F, color: C.dim, textAlign: h === "Credits" ? "right" : "left" }}>{h}</Typography>
                ))}
              </Box>
              {items.map((it) => {
                const st = estimateStatus(it.status);
                const muted = it.status !== "ready";
                return (
                  <Box key={it.contact_id} sx={{ ...BODY_ROW, gridTemplateColumns: COLS_ESTIMATE, opacity: muted ? 0.65 : 1 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
                      <Typography noWrap sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: C.text }}>{it.name}</Typography>
                      {it.do_not_call && <DoNotCallChip />}
                    </Box>
                    <ProviderChip provider={it.provider} />
                    <ExpectTags expect={it.expect} />
                    <Typography sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.medium, color: it.credits > 0 ? C.text : C.dim, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {it.credits}
                    </Typography>
                    <StatusChip label={st.label} color={st.color} />
                  </Box>
                );
              })}
            </Box>

            {running && (
              <Box sx={{ mt: 1.5 }}>
                <LinearProgress sx={{ height: 4, borderRadius: 2, bgcolor: C.cardBg, "& .MuiLinearProgress-bar": { bgcolor: C.orange } }} />
                <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub, mt: 0.5 }}>
                  Revealing {readyItems.length} contact{readyItems.length === 1 ? "" : "s"}… this can take a few seconds per contact.
                </Typography>
              </Box>
            )}

            <Box sx={{ mt: 1.5, display: "flex", flexDirection: "column", gap: 0.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                <Typography sx={{ fontFamily: F, fontSize: FS.body, fontWeight: FW.semibold, color: C.text }}>
                  Total: {estimate.total_credits} credit{estimate.total_credits === 1 ? "" : "s"}
                  {providerBreakdown && <Typography component="span" sx={{ fontFamily: F, fontSize: FS.small, color: C.sub, fontWeight: FW.regular }}> ({providerBreakdown})</Typography>}
                </Typography>
                {ziLeft != null && (
                  <Tooltip title={estimate.credits.as_of ? `As of ${new Date(estimate.credits.as_of).toLocaleString()}` : ""} arrow>
                    <Chip label={`ZoomInfo credits left: ${ziLeft.toLocaleString()}`} size="small"
                      sx={{ fontFamily: F, fontSize: FS.micro, height: 20, fontWeight: FW.semibold, bgcolor: PROVIDER_COLORS.zoominfo.bg, color: PROVIDER_COLORS.zoominfo.fg, border: `1px solid ${PROVIDER_COLORS.zoominfo.fg}25` }} />
                  </Tooltip>
                )}
              </Box>
              <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub }}>
                Apollo reveals return email (and sometimes a phone); mobile numbers come from ZoomInfo.
              </Typography>
              {estimate.warnings.map((w, i) => (
                <Box key={i} sx={{ display: "flex", alignItems: "flex-start", gap: 0.5 }}>
                  <WarningAmberIcon sx={{ fontSize: 13, color: C.amber, mt: "1px" }} />
                  <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.amber }}>{w}</Typography>
                </Box>
              ))}
              {error && <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.red }}>{error}</Typography>}
            </Box>
          </>
        )}

        {phase === "done" && result && (
          <>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap", mb: 1.5 }}>
              <StatusChip label={`Revealed ${result.revealed}`} color={C.green} />
              <StatusChip label={`No match ${nNoMatch}`} color={nNoMatch > 0 ? C.amber : C.sub} />
              <StatusChip label={`Skipped ${nSkipped}`} color={C.sub} />
              {nFailed > 0 && <StatusChip label={`Failed ${nFailed}`} color={C.red} />}
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
              <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.textMd }}>
                Credits used: <Box component="span" sx={{ fontWeight: FW.semibold, color: C.text }}>{result.total_credits_used}</Box>
              </Typography>
              {ziLeft != null && (
                <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.textMd }}>
                  · ZoomInfo credits left: <Box component="span" sx={{ fontWeight: FW.semibold, color: C.text }}>{ziLeft.toLocaleString()}</Box>
                </Typography>
              )}
            </Box>
            <Box sx={{ borderRadius: "8px", border: `1px solid ${C.border}`, overflow: "hidden" }}>
              <Box sx={{ ...HEAD_ROW, gridTemplateColumns: COLS_RESULT }}>
                {["Contact", "Provider", "Outcome", "Credits", "Details"].map((h) => (
                  <Typography key={h} sx={{ ...LABEL, fontFamily: F, color: C.dim, textAlign: h === "Credits" ? "right" : "left" }}>{h}</Typography>
                ))}
              </Box>
              {results.map((r) => {
                const st = resultStatus(r.status);
                const c = r.contact;
                const details = r.message
                  || (c ? [c.email, c.phone, c.mobile_phone].filter(Boolean).join(" · ") : "");
                return (
                  <Box key={r.contact_id} sx={{ ...BODY_ROW, gridTemplateColumns: COLS_RESULT }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
                      {r.status === "revealed" && <CheckCircleIcon sx={{ fontSize: 14, color: C.green }} />}
                      <Typography noWrap sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold, color: C.text }}>
                        {nameById.get(r.contact_id) ?? `Contact #${r.contact_id}`}
                      </Typography>
                    </Box>
                    <ProviderChip provider={r.provider} />
                    <StatusChip label={st.label} color={st.color} />
                    <Typography sx={{ fontFamily: F, fontSize: FS.small, color: r.credits_used > 0 ? C.text : C.dim, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {r.credits_used}
                    </Typography>
                    <Typography noWrap title={details} sx={{ fontFamily: F, fontSize: FS.caption, color: C.textMd }}>{details || "—"}</Typography>
                  </Box>
                );
              })}
              {results.length === 0 && (
                <Typography sx={{ fontFamily: F, fontSize: FS.body, color: C.dim, py: 2, textAlign: "center" }}>No results returned.</Typography>
              )}
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, pt: 1, gap: 1 }}>
        <Box sx={{ flex: 1 }} />
        {phase === "done" ? (
          <Button variant="contained" onClick={onClose}
            sx={{ fontFamily: F, textTransform: "none", fontSize: FS.small, borderRadius: "8px", bgcolor: C.orange, "&:hover": { bgcolor: C.orangeDark } }}>
            Close
          </Button>
        ) : (
          <>
            <Button onClick={onClose} disabled={running} sx={linkSx}>Cancel</Button>
            <Button variant="contained" disabled={phase !== "ready" || readyItems.length === 0}
              onClick={handleConfirm}
              startIcon={running ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : <CheckCircleIcon sx={{ fontSize: 16 }} />}
              sx={{ fontFamily: F, textTransform: "none", fontSize: FS.small, borderRadius: "8px", bgcolor: C.orange, "&:hover": { bgcolor: C.orangeDark }, "&.Mui-disabled": { bgcolor: `${C.orange}60`, color: "#fff" } }}>
              {running
                ? "Revealing…"
                : `Reveal ${readyItems.length} contact${readyItems.length === 1 ? "" : "s"} (${estimate?.total_credits ?? 0} credit${estimate?.total_credits === 1 ? "" : "s"})`}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
