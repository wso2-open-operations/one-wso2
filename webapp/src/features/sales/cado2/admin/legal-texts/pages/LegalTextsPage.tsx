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

import { useState, type JSX } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { FileTextIcon, PencilIcon, PlusIcon, ScaleIcon, Trash2Icon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import PageHeader from "@features/sales/cado2/components/page-header/PageHeader";
import SectionCard from "@features/sales/cado2/components/section-card/SectionCard";
import { useCado2Toast } from "@features/sales/cado2/components/toast/toastContext";
import { messageOf } from "@features/sales/cado2/quotes/api/errors";
import { visuallyHidden } from "@features/sales/cado2/utils/visuallyHidden";
import { textHint } from "./textHint";
import LegalRichTextField from "@features/sales/cado2/components/legal-rich-text/LegalRichTextField";
import { cleanLegalText, isEmptyLegalText, legalPlainText, sameLegalText } from "@features/sales/cado2/utils/legalRichText";
import { useLegalAdmin, useLegalAdminChange } from "@features/sales/cado2/admin/legal-texts/api/useLegalAdmin";
import type { LegalNoticeInput, LegalNoticeRow } from "@features/sales/cado2/admin/legal-texts/api/legalAdminTypes";

const TEXT_LABEL: Record<string, string> = {
  TERMS_ONPREM_DIRECT: "On-premises products · direct deals",
  TERMS_ONPREM_PARTNER: "On-premises products · partner deals",
  TERMS_SAAS_DIRECT: "SaaS products · direct deals",
  TERMS_SAAS_PARTNER: "SaaS products · partner deals",
};
const CHANNELS = [
  { value: "DIRECT", label: "Direct" },
  { value: "PARTNER", label: "Partner" },
];
const REGIONS = ["NA", "LATAM", "EU", "ME", "AFRICA", "APAC"];
const KINDS = [
  { value: "FIRST_SALE", label: "First sale" },
  { value: "RENEWAL", label: "Renewal" },
  { value: "EXPANSION", label: "Expansion" },
];
/** One standard text, edited in place. */
function TextEditor({ textKey, body, hint }: { textKey: string; body: string; hint: string }): JSX.Element {
  const change = useLegalAdminChange();
  const notify = useCado2Toast();
  const [draft, setDraft] = useState(body);
  return (
    <Stack spacing={1}>
      <LegalRichTextField
        label={TEXT_LABEL[textKey] ?? textKey}
        value={draft}
        onChange={setDraft}
        minHeight={140}
        helperText={hint || undefined}
      />
      {change.error ? <Alert severity="error">{messageOf(change.error) ?? "Couldn't save the text."}</Alert> : null}
      <Box>
        <Button
          size="small"
          variant="outlined"
          disabled={sameLegalText(draft, body) || isEmptyLegalText(draft) || change.isPending}
          onClick={() => change.mutate({ kind: "text", key: textKey, body: cleanLegalText(draft) }, { onSuccess: () => notify("Text saved") })}
        >
          Save
        </Button>
      </Box>
    </Stack>
  );
}

/** Add or change a notice and when it applies. */
function NoticeDialog({ notice, onClose }: { notice: LegalNoticeRow | null; onClose: () => void }): JSX.Element {
  const change = useLegalAdminChange();
  const notify = useCado2Toast();
  const [n, setN] = useState<LegalNoticeInput>(
    notice ?? { title: "", body: "", showTitle: true, finePrint: false, channels: [], regions: [], dealKinds: [] },
  );
  const multi = (label: string, value: readonly string[], options: readonly { value: string; label: string }[], set: (v: string[]) => void) => (
    <TextField
      select
      size="small"
      label={label}
      value={[...value]}
      onChange={(e) => set(typeof e.target.value === "string" ? e.target.value.split(",") : (e.target.value as string[]))}
      SelectProps={{ multiple: true, renderValue: (v) => ((v as string[]).length ? (v as string[]).map((x) => options.find((o) => o.value === x)?.label ?? x).join(", ") : "Any") }}
      InputLabelProps={{ shrink: true }}
      helperText="None chosen: any"
      fullWidth
    >
      {options.map((o) => (
        <MenuItem key={o.value} value={o.value}>
          {o.label}
        </MenuItem>
      ))}
    </TextField>
  );
  return (
    <Dialog open onClose={(_, reason) => reason !== "backdropClick" && onClose()} fullWidth maxWidth="md">
      <DialogTitle>{notice ? "Edit notice" : "New notice"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Title" size="small" value={n.title} onChange={(e) => setN({ ...n, title: e.target.value })} required />
          <LegalRichTextField label="Text" value={n.body} onChange={(html) => setN({ ...n, body: html })} minHeight={140} required />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <FormControlLabel control={<Switch checked={n.showTitle} onChange={(_, v) => setN({ ...n, showTitle: v })} />} label="Print the title as a heading" />
            <FormControlLabel control={<Switch checked={n.finePrint} onChange={(_, v) => setN({ ...n, finePrint: v })} />} label="Small print (*)" />
          </Stack>
          <Typography variant="subtitle2">Shown when</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            {multi("Deal type", n.channels, CHANNELS, (v) => setN({ ...n, channels: v }))}
            {multi("Account region", n.regions, REGIONS.map((r) => ({ value: r, label: r })), (v) => setN({ ...n, regions: v }))}
            {multi("Deal kind", n.dealKinds, KINDS, (v) => setN({ ...n, dealKinds: v }))}
          </Stack>
          {change.error ? <Alert severity="error">{messageOf(change.error) ?? "Couldn't save the notice."}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!n.title.trim() || isEmptyLegalText(n.body) || change.isPending}
          onClick={() =>
            change.mutate({ kind: "notice", id: notice?.id ?? null, notice: { ...n, body: cleanLegalText(n.body) } }, {
              onSuccess: () => {
                notify("Notice saved");
                onClose();
              },
            })
          }
        >
          Save notice
        </Button>
      </DialogActions>
    </Dialog>
  );
}

const conditionChips = (n: LegalNoticeRow) => [
  n.channels.length ? n.channels.map((c) => CHANNELS.find((x) => x.value === c)?.label ?? c).join(" + ") : "Any deal",
  ...(n.regions.length ? [n.regions.join(", ")] : []),
  ...(n.dealKinds.length ? [n.dealKinds.map((k) => KINDS.find((x) => x.value === k)?.label ?? k).join(", ")] : []),
];

/**
 * Admin › Legal Texts (2026-10-24): what the order form's
 * legal sections say, kept here so a change needs no release. Draft quotes
 * use the texts as they are now; a submitted quote keeps the ones it was
 * submitted with.
 */
export default function LegalTextsPage(): JSX.Element {
  const admin = useLegalAdmin();
  const change = useLegalAdminChange();
  const notify = useCado2Toast();
  const [editing, setEditing] = useState<{ notice: LegalNoticeRow | null } | null>(null);

  if (admin.error) {
    return (
      <Stack spacing={2.5}>
        <PageHeader title="Legal Texts" />
        <ErrorNotice error={admin.error} onRetry={() => void admin.refetch()} retrying={admin.isFetching}>
          Couldn&apos;t load the legal texts.
        </ErrorNotice>
      </Stack>
    );
  }
  if (admin.isPending) {
    return (
      <Stack spacing={2.5}>
        <PageHeader title="Legal Texts" />
        <Skeleton variant="rounded" height={320} aria-label="Loading the legal texts" />
      </Stack>
    );
  }
  const a = admin.data;

  return (
    <Stack spacing={2.5}>
      <PageHeader title="Legal Texts" />
      {change.error && !editing ? <Alert severity="error">{messageOf(change.error) ?? "Couldn't save the change."}</Alert> : null}

      <SectionCard title="Standard Governing Terms" icon={<ScaleIcon size={16} />}>
        <Stack spacing={3}>
          {a.texts.map((t) => (
            <TextEditor
              key={`${t.key}|${t.updatedAt}`}
              textKey={t.key}
              body={t.body}
              hint={textHint(t.key, t.updatedAt, t.updatedByEmail, a.placeholders)}
            />
          ))}
        </Stack>
      </SectionCard>

      <SectionCard
        title="Legal Terms and Notices"
        icon={<FileTextIcon size={16} />}
        aside={
          <Button size="small" startIcon={<PlusIcon size={14} />} onClick={() => setEditing({ notice: null })}>
            New notice
          </Button>
        }
      >
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5 }}>
          <Table size="small" aria-label="Notices">
            <TableHead>
              <TableRow>
                <TableCell>Notice</TableCell>
                <TableCell>Shown when</TableCell>
                <TableCell align="right">
                  <Box component="span" sx={visuallyHidden}>
                    Actions
                  </Box>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {a.notices.map((n) => (
                <TableRow key={n.id}>
                  <TableCell sx={{ verticalAlign: "top" }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {n.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {legalPlainText(n.body)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ verticalAlign: "top" }}>
                    <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", rowGap: 0.5 }}>
                      {conditionChips(n).map((c) => (
                        <Chip key={c} size="small" variant="outlined" label={c} />
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell align="right" sx={{ verticalAlign: "top", whiteSpace: "nowrap" }}>
                    <Tooltip title="Edit">
                      <IconButton size="small" aria-label={`Edit ${n.title}`} onClick={() => setEditing({ notice: n })}>
                        <PencilIcon size={16} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Remove">
                      <IconButton
                        size="small"
                        aria-label={`Remove ${n.title}`}
                        onClick={() => change.mutate({ kind: "deleteNotice", id: n.id }, { onSuccess: () => notify("Notice removed") })}
                      >
                        <Trash2Icon size={16} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
          A new regional clause is one more notice: its text and when it applies.
        </Typography>
      </SectionCard>

      {editing ? <NoticeDialog notice={editing.notice} onClose={() => setEditing(null)} /> : null}
    </Stack>
  );
}
