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
  DialogContent, DialogTitle, Stack, Typography,
} from "@wso2/oxygen-ui";
import { CheckCircle as CheckCircleIcon } from "../icons";
import { ErrorOutline as ErrorOutlineIcon } from "../icons";
import { RemoveCircleOutline as RemoveCircleOutlineIcon } from "../icons";
import { useEffect, useState } from "react";
import { useApiClient } from "../api/client";
import { FS, FW } from "../theme/typeScale";

const F = "'Inter', system-ui, sans-serif";
const SOURCES = ["apollo", "zoominfo", "ai"] as const;

/** One enrichment field proposal returned by /preview. */
export interface PreviewField {
  field: string; label: string; current_value: unknown; new_value: unknown;
  source: string | null; has_new: boolean; is_conflict: boolean;
  all_proposals?: { source: string; value: unknown }[];
}
/** Shape of POST /lead-enrichment/preview. */
interface PreviewResponse {
  fields: PreviewField[];
  source_errors: { source: string; status: string }[];
}
/** Per-provider outcome derived for the status strip. */
interface ProviderStatus { source: string; kind: "ok" | "warn" | "none"; text: string; }

/** Props for the single-lead enrich dialog. */
export interface EnrichLeadDialogProps {
  open: boolean;
  leadId: number | null;
  leadName: string;
  onClose: () => void;
  onApplied: () => void;
}

/** Friendly per-provider status from the preview response (errors → "unavailable"). */
function deriveProviderStatus(preview: PreviewResponse): ProviderStatus[] {
  const errors = new Map(preview.source_errors.map((e) => [e.source, e.status]));
  return SOURCES.map((src) => {
    const err = errors.get(src);
    if (err) {
      return { source: src, kind: "warn", text: err === "rate_limited" ? "rate limited" : "unavailable" };
    }
    const count = preview.fields.filter((f) => (f.all_proposals ?? []).some((p) => p.source === src)).length;
    return count > 0
      ? { source: src, kind: "ok", text: `${count} field${count === 1 ? "" : "s"}` }
      : { source: src, kind: "none", text: "no new data" };
  });
}

/** Icon for a provider-status kind. */
function statusIcon(kind: ProviderStatus["kind"]) {
  if (kind === "ok") return <CheckCircleIcon sx={{ fontSize: 14, color: "success.main" }} />;
  if (kind === "warn") return <ErrorOutlineIcon sx={{ fontSize: 14, color: "warning.main" }} />;
  return <RemoveCircleOutlineIcon sx={{ fontSize: 14, color: "text.disabled" }} />;
}

/**
 * Preview-and-apply enrichment for a single lead. Shows each provider's outcome
 * (Apollo / ZoomInfo / AI), then the proposed field values with checkboxes.
 * Calls POST /preview (paid provider lookup) on open and POST /apply on confirm.
 */
export default function EnrichLeadDialog({ open, leadId, leadName, onClose, onApplied }: EnrichLeadDialogProps) {
  const { request } = useApiClient();
  const [fields, setFields] = useState<PreviewField[]>([]);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || leadId == null) return;
    let cancelled = false;
    setBusy(true); setFields([]); setProviders([]);
    (async () => {
      try {
        const preview = await request<PreviewResponse>("post", `/lead-enrichment/preview?lead_id=${leadId}`);
        if (cancelled) return;
        const newFields = preview.fields.filter((f) => f.has_new);
        setFields(newFields);
        setProviders(deriveProviderStatus(preview));
        setSelected(Object.fromEntries(newFields.map((f) => [f.field, !f.is_conflict])));
      } catch {
        if (!cancelled) { setFields([]); setProviders([]); }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, leadId, request]);

  const selectedCount = fields.filter((f) => selected[f.field]).length;

  const apply = async () => {
    if (leadId == null) return;
    setBusy(true);
    try {
      const selections = fields
        .filter((f) => selected[f.field])
        .map((f) => ({ field: f.field, value: f.new_value, source: f.source }));
      await request("post", "/lead-enrichment/apply", { lead_id: leadId, selections });
      onApplied();
      onClose();
    } catch { /* surfaced by the global error handler */ } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontFamily: F, fontSize: FS.reading, fontWeight: FW.semibold }}>Enrich {leadName}</DialogTitle>
      <DialogContent dividers>
        {/* Provider status strip — always shown so an empty result is self-explanatory. */}
        {providers.length > 0 && (
          <Stack direction="row" spacing={1.5} sx={{ mb: 1.5, flexWrap: "wrap" }}>
            {providers.map((p) => (
              <Box key={p.source} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                {statusIcon(p.kind)}
                <Typography sx={{ fontFamily: F, fontSize: FS.small }}>
                  <b style={{ textTransform: "capitalize" }}>{p.source}</b> · {p.text}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
        {busy && fields.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 3 }}><CircularProgress size={20} /></Box>
        ) : fields.length === 0 ? (
          <Typography sx={{ fontFamily: F, fontSize: FS.body, color: "text.secondary" }}>
            No new data found from Apollo, ZoomInfo or AI.
          </Typography>
        ) : (
          <Stack spacing={0.5}>
            {fields.map((f) => (
              <Box key={f.field} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Checkbox size="small" checked={!!selected[f.field]}
                  onChange={(e) => setSelected((s) => ({ ...s, [f.field]: e.target.checked }))} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontFamily: F, fontSize: FS.small, fontWeight: FW.semibold }}>
                    {f.label} <Chip label={f.source ?? "?"} size="small" sx={{ height: 15, fontSize: FS.micro, ml: 0.5 }} />
                  </Typography>
                  <Typography sx={{ fontFamily: F, fontSize: FS.small, color: "text.secondary" }} noWrap>
                    {f.is_conflict ? `${String(f.current_value)} → ` : ""}{String(f.new_value)}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: "none", fontFamily: F }}>Cancel</Button>
        <Button onClick={apply} variant="contained" disabled={busy || selectedCount === 0}
          sx={{ textTransform: "none", fontFamily: F }}>
          Apply selected{selectedCount > 0 ? ` (${selectedCount})` : ""}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
