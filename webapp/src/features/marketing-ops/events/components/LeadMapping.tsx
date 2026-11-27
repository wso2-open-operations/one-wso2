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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { ArrowRight, Download, RefreshCw, RotateCcw } from "@wso2/oxygen-ui-icons-react";
import { leadImportError, useSuggestLeadMapping } from "../../api/useLeadImport";
import { type EventMeta, useCreateSubmission, useSaveSubmission } from "../../api/useEvents";
import type { FieldDef } from "../eventsTypes";
import type { ClaudeStep, MappingEntry } from "../leadImportTypes";
import { saveBlob } from "../lib/download";
import { defaultSheet, headerRowOf, MAX_HEADING_CHARS, sourceColumns, type RawSheet } from "../lib/leadFile";
import {
  applyMapping,
  attentionOf,
  buildPayload,
  buildWorkbook,
  choose,
  decodeChoice,
  namePair,
  outputFileName,
  rowLabel,
  sourceLabel,
} from "../lib/leadMapping";
import { ConfirmDialog, Count, Panel, WorkspaceHead } from "./EventsUi";
import LeadMappingTable from "./LeadMappingTable";
import { fieldLabel, primaryBtn, quietBtn } from "./eventsStyles";

// The mapping, and everything it did, on one screen.
//
// Top to bottom: what the file is and which rows hold the headings; four numbers that
// say how far the mapping got; the mapping itself; the file's columns that went nowhere;
// and the rows exactly as they download. This is step 2 of Lead Import: the filled
// button creates the submission and moves on to step 3, where its rows are fixed and
// reviewed. Coming back here after that, a changed mapping can replace the rows.

const PREVIEW_ROWS = 20;
/** How far down the heading row may be. Vendor exports put titles above it. */
const HEADER_ROW_CHOICES = 20;

function unmapped(defs: FieldDef[]): MappingEntry[] {
  return defs
    .filter((d) => !d.computed)
    .map((d) => ({
      field_name: d.field_name,
      source_index: null,
      split: null,
      how: "none",
      confidence: null,
      reason: null,
    }));
}

export default function LeadMapping({
  fileName,
  sheets,
  status,
  defs,
  meta,
  submissionId,
  onBack,
  onCreated,
  onNext,
}: {
  fileName: string;
  sheets: RawSheet[];
  /** The member status the leads belong to. */
  status: string;
  /** The columns of `status`, in template order (Settings → Events). */
  defs: FieldDef[];
  /** Event details collected on the setup screen. */
  meta: EventMeta;
  /** The submission this mapping already created, if it has. */
  submissionId: string | null;
  /** Back to step 1. */
  onBack: () => void;
  /** The submission was created from this mapping. */
  onCreated: (id: string) => void;
  /** On to step 3. `replaced`: the rows were just written again, so reload them. */
  onNext: (replaced: boolean) => void;
}) {
  const { mutateAsync } = useSuggestLeadMapping();
  const createSubmission = useCreateSubmission();
  const saveSubmission = useSaveSubmission();
  const [sheetIndex, setSheetIndex] = useState(() => defaultSheet(sheets, status));
  const rows = sheets[sheetIndex].rows;
  const [headerRow, setHeaderRow] = useState(() => headerRowOf(rows));
  const [mapping, setMapping] = useState<MappingEntry[] | null>(null);
  /** The mapping as suggested, for "Reset to suggestion". */
  const [suggested, setSuggested] = useState<MappingEntry[] | null>(null);
  const [claude, setClaude] = useState<ClaudeStep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  /** The mapping the submission's rows were last written from, to tell whether they're
   *  out of date. */
  const [written, setWritten] = useState<string | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  /** The mapping on screen, for a download that finishes after the person changed it. */
  const current = useRef<MappingEntry[] | null>(null);
  useEffect(() => {
    current.current = mapping;
  }, [mapping]);

  const sources = useMemo(() => sourceColumns(rows, headerRow), [rows, headerRow]);
  const pair = useMemo(() => namePair(defs), [defs]);

  // Only the newest request may set the mapping: a slow answer for the previous sheet or
  // heading row must not replace the current one.
  const latest = useRef(0);
  const ask = useCallback(async () => {
    const request = ++latest.current;
    setMapping(null);
    setSuggested(null);
    setClaude(null);
    setError(null);
    setExportError(null);
    setSaved(null);
    try {
      const response = await mutateAsync({
        status,
        columns: sources.map(({ index, heading, samples }) => ({
          index,
          heading: heading.slice(0, MAX_HEADING_CHARS),
          samples,
        })),
      });
      if (request !== latest.current) return;
      if (!response) throw new Error("The server sent an empty answer.");
      setMapping(response.mapping);
      setSuggested(response.mapping);
      setClaude(response.claude);
    } catch (e) {
      if (request !== latest.current) return;
      setError(leadImportError(e));
      setMapping(unmapped(defs));
      setSuggested(null);
    }
  }, [mutateAsync, status, sources, defs]);

  useEffect(() => {
    void ask();
  }, [ask]);

  const output = useMemo(
    () => (mapping ? applyMapping(rows, headerRow, defs, mapping) : null),
    [rows, headerRow, defs, mapping],
  );

  function onChoose(field: string, value: string) {
    setSaved(null);
    setMapping((current) => (current ? choose(current, field, decodeChoice(value), pair) : current));
  }

  async function download() {
    if (!output) return;
    const exported = mapping;
    setSaving(true);
    setExportError(null);
    try {
      const name = outputFileName(fileName, status);
      saveBlob(await buildWorkbook(status, output), name);
      // The note says what was saved, so it only shows while the mapping still matches.
      if (current.current === exported) setSaved(name);
    } catch (e) {
      setExportError(`The workbook could not be written. ${leadImportError(e)}`);
    } finally {
      setSaving(false);
    }
  }

  /** Write the mapped rows: into a new submission the first time, over the existing
   *  one's rows after that. */
  async function submit() {
    if (!output || output.rows.length === 0) return;
    setConfirmReplace(false);
    setSubmitting(true);
    setSubmitError(null);
    try {
      const replacing = written !== null;
      let id = submissionId;
      if (!id) {
        const created = await createSubmission.mutateAsync(meta);
        if (!created?.id) throw new Error("The server did not return the new submission.");
        id = created.id;
        // Handed up at once, so if saving the rows fails, trying again saves into this
        // submission instead of creating another.
        onCreated(id);
      }
      await saveSubmission.mutateAsync({
        id,
        payload: buildPayload(defs, output, status),
        rowCount: output.rows.length,
        sourceFilename: fileName,
      });
      setWritten(signature);
      onNext(replacing);
    } catch (e) {
      setSubmitError(leadImportError(e));
    } finally {
      setSubmitting(false);
    }
  }

  const loading = mapping === null;
  const byField = new Map((mapping ?? []).map((entry) => [entry.field_name, entry]));
  const targets = defs.filter((d) => !d.computed);
  const mappedCount = targets.filter((d) => byField.get(d.field_name)?.source_index != null).length;
  const attentionCount = targets.filter((d) => attentionOf(d, byField.get(d.field_name))).length;
  const used = new Set((mapping ?? []).map((e) => e.source_index).filter((i): i is number => i !== null));
  const unused = sources.filter((s) => !used.has(s.index));
  const changed = Boolean(suggested && mapping && JSON.stringify(suggested) !== JSON.stringify(mapping));
  const noRows = output !== null && output.rows.length === 0;
  // What the rows were written from: the sheet, its heading row and the mapping. Changing
  // any of them makes the written rows out of date, even with the same mapping.
  const signature = JSON.stringify([sheetIndex, headerRow, mapping]);
  // Nothing written yet — no submission, or one whose rows failed to save — is a first
  // write. After that: unchanged, Next just moves on; changed, it offers to replace.
  const firstWrite = written === null;
  const stale = Boolean(!firstWrite && mapping && written !== signature);
  const nextLabel = submitting
    ? firstWrite
      ? "Creating submission…"
      : "Replacing the rows…"
    : firstWrite
      ? "Create submission"
      : stale
        ? "Replace the rows"
        : "Next: fix & review";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <WorkspaceHead
        title={fileName}
        caption={`${status} leads${sheets.length > 1 ? ` · sheet ${sheets[sheetIndex].name}` : ""}`}
        onBack={onBack}
        backLabel="Back: set up"
      >
        {changed && (
          <Button
            sx={quietBtn}
            startIcon={<RotateCcw size={16} />}
            onClick={() => {
              if (!suggested) return;
              setSaved(null);
              setMapping(suggested);
            }}
          >
            Reset to suggestion
          </Button>
        )}
        <Tooltip title={noRows ? "No row has a value in a mapped column yet." : ""} arrow>
          <span>
            <Button
              sx={quietBtn}
              disabled={loading || noRows || saving}
              onClick={() => void download()}
              startIcon={saving ? <CircularProgress size={15} color="inherit" /> : <Download size={16} />}
            >
              {saving ? "Saving…" : "Download workbook"}
            </Button>
          </span>
        </Tooltip>
        <Tooltip title={noRows ? "No row has a value in a mapped column yet." : ""} arrow>
          <span>
            <Button
              variant="contained"
              sx={primaryBtn}
              disabled={loading || noRows || submitting}
              onClick={() => {
                if (firstWrite) void submit();
                else if (stale) setConfirmReplace(true);
                else onNext(false);
              }}
              startIcon={submitting ? <CircularProgress size={15} color="inherit" /> : undefined}
              endIcon={submitting ? undefined : <ArrowRight size={16} />}
            >
              {nextLabel}
            </Button>
          </span>
        </Tooltip>
      </WorkspaceHead>

      {exportError && (
        <Alert
          severity="error"
          sx={{ fontSize: 13 }}
          action={
            <Button size="small" startIcon={<RefreshCw size={14} />} onClick={() => void download()}>
              Try again
            </Button>
          }
        >
          {exportError}
        </Alert>
      )}

      {submitError && (
        <Alert
          severity="error"
          sx={{ fontSize: 13 }}
          action={
            <Button size="small" startIcon={<RefreshCw size={14} />} onClick={() => void submit()}>
              Try again
            </Button>
          }
        >
          {submitError}
        </Alert>
      )}

      {saved ? (
        <Alert severity="success" sx={{ fontSize: 13 }}>
          Saved <b>{saved}</b>.
        </Alert>
      ) : (
        <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>
          Values are copied exactly as they are in the file. Check the mapping, then{" "}
          {firstWrite ? "create the submission." : "go on to fix and review the rows."}
        </Typography>
      )}

      <ConfirmDialog
        open={confirmReplace}
        title="Replace the rows?"
        confirmLabel="Replace the rows"
        tone="danger"
        busy={submitting}
        body={
          <>
            The mapping changed since the rows were created. Writing them again replaces every row in the
            submission, <b>including any fixes made in step 3</b>.
          </>
        }
        onCancel={() => setConfirmReplace(false)}
        onConfirm={() => void submit()}
      />

      <Box role="group" aria-label="Mapping summary">
        <Panel sx={{ display: "flex", flexWrap: "wrap", alignItems: "stretch" }}>
          <SourcePicker
            sheets={sheets}
            sheetIndex={sheetIndex}
            headerRow={headerRow}
            onSheet={(next) => {
              setSheetIndex(next);
              setHeaderRow(headerRowOf(sheets[next].rows));
            }}
            onHeaderRow={setHeaderRow}
          />
          <Stat label="Columns mapped" value={loading ? "…" : `${mappedCount} of ${targets.length}`} />
          <Stat label="Rows" value={output ? output.rows.length.toLocaleString() : "…"} />
          <Stat
            label="Rows left out"
            value={output ? output.skipped.toLocaleString() : "…"}
            hint="Rows with values only in columns that aren't mapped"
          />
          <Stat
            label="Needs a look"
            value={loading ? "…" : String(attentionCount)}
            color={!loading && attentionCount ? "warning.main" : undefined}
            hint="Required columns with no source, and sources Claude was unsure of"
          />
        </Panel>
      </Box>

      <SuggestionNotice step={claude} error={error} loading={loading} onRetry={() => void ask()} />

      <LeadMappingTable
        defs={defs}
        mapping={mapping}
        sources={sources}
        pair={pair}
        loading={loading}
        onChoose={onChoose}
      />

      {!loading && unused.length > 0 && (
        <Box>
          <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Columns of the file not used ({unused.length})</Typography>
          <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 1 }}>
            These stay out of the workbook. Pick one in the table above if it belongs in a template column.
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
            {unused.map((s) => (
              <Tooltip
                key={s.index}
                title={s.samples.length ? `e.g. ${s.samples.slice(0, 3).join(", ")}` : "No values"}
                arrow
              >
                <Box
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.75,
                    fontSize: 12,
                    px: 1,
                    py: 0.4,
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                    color: "text.secondary",
                  }}
                >
                  {sourceLabel(s)}
                  <Count n={s.filled} />
                </Box>
              </Tooltip>
            ))}
          </Box>
        </Box>
      )}

      {output && output.rows.length > 0 && <Preview header={output.header} rows={output.rows} />}
    </Box>
  );
}

/** The sheet (when the file has several) and the row that holds the headings. */
function SourcePicker({
  sheets,
  sheetIndex,
  headerRow,
  onSheet,
  onHeaderRow,
}: {
  sheets: RawSheet[];
  sheetIndex: number;
  headerRow: number;
  onSheet: (index: number) => void;
  onHeaderRow: (row: number) => void;
}) {
  const rows = sheets[sheetIndex].rows;
  const choices = Math.min(HEADER_ROW_CHOICES, rows.length);
  return (
    <Box
      sx={{
        display: "flex",
        gap: 2,
        flexWrap: "wrap",
        p: 1.5,
        flex: "2 1 360px",
        borderRight: 1,
        borderColor: "divider",
      }}
    >
      {sheets.length > 1 && (
        <Box sx={{ minWidth: 150 }}>
          <Typography sx={fieldLabel}>Sheet</Typography>
          <Select
            size="small"
            fullWidth
            value={sheetIndex}
            onChange={(e) => onSheet(Number(e.target.value))}
            inputProps={{ "aria-label": "Sheet" }}
            sx={{ fontSize: 13 }}
          >
            {sheets.map((sheet, i) => (
              <MenuItem key={sheet.name} value={i} sx={{ fontSize: 13 }}>
                {sheet.name}
              </MenuItem>
            ))}
          </Select>
        </Box>
      )}
      <Box sx={{ flex: 1, minWidth: 220 }}>
        <Typography sx={fieldLabel}>Headings are in</Typography>
        <Select
          size="small"
          fullWidth
          value={headerRow}
          onChange={(e) => onHeaderRow(Number(e.target.value))}
          inputProps={{ "aria-label": "Heading row" }}
          renderValue={(value) => `Row ${Number(value) + 1}: ${rowLabel(rows[Number(value)], 3)}`}
          sx={{ fontSize: 13 }}
        >
          {Array.from({ length: choices }, (_, i) => (
            <MenuItem key={i} value={i} sx={{ fontSize: 13, maxWidth: 520 }}>
              <Box component="span" sx={{ fontWeight: 700, mr: 1, fontVariantNumeric: "tabular-nums" }}>
                Row {i + 1}
              </Box>
              <Box component="span" sx={{ color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis" }}>
                {rowLabel(rows[i])}
              </Box>
            </MenuItem>
          ))}
        </Select>
      </Box>
    </Box>
  );
}

function Stat({ label, value, hint, color }: { label: string; value: string; hint?: string; color?: string }) {
  const body = (
    <Box
      sx={{ p: 1.5, flex: "1 1 120px", borderRight: 1, borderColor: "divider", "&:last-of-type": { borderRight: 0 } }}
    >
      <Typography sx={fieldLabel}>{label}</Typography>
      <Typography
        sx={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: color ?? "text.primary" }}
      >
        {value}
      </Typography>
    </Box>
  );
  return hint ? (
    <Tooltip title={hint} arrow placement="top">
      {body}
    </Tooltip>
  ) : (
    body
  );
}

/** What the suggestion step came to, when it is anything other than a plain success. */
function SuggestionNotice({
  step,
  error,
  loading,
  onRetry,
}: {
  step: ClaudeStep | null;
  error: string | null;
  loading: boolean;
  onRetry: () => void;
}) {
  const retry = (
    <Button size="small" startIcon={<RefreshCw size={14} />} onClick={onRetry}>
      Try again
    </Button>
  );
  if (loading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <CircularProgress size={14} />
        <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
          Matching headings, then asking Claude about the rest…
        </Typography>
      </Box>
    );
  }
  if (error) {
    return (
      <Alert severity="error" sx={{ fontSize: 13 }} action={retry}>
        Couldn't get a suggestion: {error} You can still map the columns by hand.
      </Alert>
    );
  }
  if (step === "failed") {
    return (
      <Alert severity="warning" sx={{ fontSize: 13 }} action={retry}>
        Claude couldn't suggest a mapping this time, so only headings that match exactly are filled in. Map the rest by
        hand, or try again.
      </Alert>
    );
  }
  if (step === "not_configured") {
    return (
      <Alert severity="info" sx={{ fontSize: 13 }}>
        Claude isn't set up on this server, so only headings that match the template exactly were mapped. Map the rest
        by hand.
      </Alert>
    );
  }
  return null;
}

function Preview({ header, rows }: { header: string[]; rows: string[][] }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Preview</Typography>
      <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 1 }}>
        {rows.length > PREVIEW_ROWS
          ? `The first ${PREVIEW_ROWS} of ${rows.length.toLocaleString()} rows, exactly as they download.`
          : `All ${rows.length.toLocaleString()} rows, exactly as they download.`}
      </Typography>
      <Panel sx={{ overflow: "auto", maxHeight: 480 }}>
        <Table size="small" stickyHeader aria-label="Preview">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontSize: 11, fontWeight: 700, color: "text.secondary", width: 40 }}>#</TableCell>
              {header.map((h, i) => (
                <TableCell key={i} sx={{ fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                  {h.trim()}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.slice(0, PREVIEW_ROWS).map((cells, r) => (
              <TableRow key={r} hover>
                <TableCell sx={{ fontSize: 11.5, color: "text.disabled", fontVariantNumeric: "tabular-nums" }}>
                  {r + 2}
                </TableCell>
                {cells.map((value, c) => (
                  <TableCell
                    key={c}
                    title={value}
                    sx={{
                      fontSize: 12,
                      whiteSpace: "nowrap",
                      maxWidth: 220,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {value}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </Box>
  );
}
