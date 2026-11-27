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

import { useRef, useState, type DragEvent } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { ArrowRight, Check, FileSpreadsheet, TriangleAlert, Upload, X } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { type EventMeta, useEventNames, useFieldDefs, useMemberStatuses } from "../../api/useEvents";
import type { FieldDef } from "../eventsTypes";
import { normaliseSdr } from "../lib/sdrOwner";
import { optInMethod } from "../rules/validate";
import { checkLeadFile, LeadFileError, MAX_FILE_BYTES, readLeadFile, type RawSheet } from "../lib/leadFile";
import { CampaignUrlField, EventsLoading, Panel, SdrOwnerField } from "./EventsUi";
import LeadMapping from "./LeadMapping";
import SubmissionWorkspace from "./SubmissionWorkspace";
import { fieldHint, fieldInput, fieldLabel, primaryBtn, quietBtn } from "./eventsStyles";

// Lead import: a raw event lead file in, a reviewed submission out — one page, three
// steps.
//
//   1 Set up        the event details, which member status the leads are (it decides
//                   the columns), and the file. Read in the browser, nothing uploaded.
//   2 Map columns   which vendor column went where; the filled button creates the
//                   submission.
//   3 Fix & review  the submission's grid and Review — the same screen My Submissions
//                   opens, here so nobody has to go and find it.
//
// The step bar says where you are and goes back to any step already reached. Steps 1
// and 2 stay mounted while hidden, so going back loses nothing; step 3 reloads from the
// server each time, which is what lets step 2 replace its rows.
//
// Once the submission exists, step 1 is read-only: its details live on the submission
// and are changed in step 3. A different file is a new import.
//
// Leaving the page drops steps 1 and 2. The submission itself stays in My Submissions.

const ACCEPT = ".xlsx,.xlsm,.csv";
const COLUMNS_SHOWN = 8;

const STEPS = [
  { title: "Set up", body: "Event details and file" },
  { title: "Map columns", body: "Check the matches" },
  { title: "Fix & review", body: "Fix flagged rows, then Review" },
];

type Step = 0 | 1 | 2;

interface Opened {
  /** The file as picked, to tell whether it changed since it was read. */
  file: File;
  sheets: RawSheet[];
  status: string;
}

export default function LeadImport() {
  const statuses = useMemberStatuses();
  const fields = useFieldDefs();
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [campaignUrl, setCampaignUrl] = useState("");
  const [sdrOwner, setSdrOwner] = useState("");
  const names = useEventNames(eventName);
  const [status, setStatus] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<Opened | null>(null);
  /** Bumped on each read, so a new file gets a fresh mapping. */
  const [readCount, setReadCount] = useState(0);
  const [step, setStep] = useState<Step>(0);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  /** Bumped when step 2 rewrites the rows, so step 3 loads them again. */
  const [rowsVersion, setRowsVersion] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  /** The current read. A create or save started for an earlier read may still finish
   *  after a new file was read; its callbacks are ignored. */
  const currentRead = useRef(0);

  const created = Boolean(submissionId);
  const locked = reading || created;
  const meta: EventMeta = {
    event_name: eventName.trim(),
    event_date: eventDate || null,
    sf_campaign_url: campaignUrl.trim() || null,
    sdr_owner_email: normaliseSdr(sdrOwner) || null,
  };
  // The file and lead type step 2 was built from are still the chosen ones.
  const sameRead = Boolean(opened && opened.file === file && opened.status === status);
  // Map columns is reachable only for the file and lead type it was read from: after
  // choosing another file, the step bar must not reopen the old one's mapping.
  const reached: Step = created ? 2 : sameRead ? 1 : 0;
  // The read this render's mapping callbacks belong to (see currentRead).
  const thisRead = readCount;

  function startOver() {
    setEventName("");
    setEventDate("");
    setCampaignUrl("");
    setSdrOwner("");
    setStatus("");
    setFile(null);
    setError(null);
    setOpened(null);
    setSubmissionId(null);
    setStep(0);
    // A create still running for the old file must not land on the fresh start.
    currentRead.current = -1;
  }

  // The checks that need no reading (type, size) run on pick, so a PDF is refused before
  // anyone presses a button.
  function pick(candidate: File | undefined) {
    // The lead type and file are fixed while a read is running, so it opens what was chosen,
    // and once the submission exists.
    if (locked) return;
    setError(null);
    if (!candidate) return;
    try {
      checkLeadFile(candidate);
      setFile(candidate);
    } catch (e) {
      setFile(null);
      setError(e instanceof LeadFileError ? e.message : describeError(e));
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files?.[0]);
  }

  async function open() {
    if (!file || !status || !eventName.trim()) return;
    // Nothing changed that the mapping depends on: go back to it as it was left.
    if (sameRead) {
      setStep(1);
      return;
    }
    setError(null);
    setReading(true);
    try {
      setOpened({ file, sheets: await readLeadFile(file), status });
      currentRead.current = readCount + 1;
      setReadCount(readCount + 1);
      setStep(1);
    } catch (e) {
      setError(e instanceof LeadFileError ? e.message : `The file could not be read. ${describeError(e)}`);
    } finally {
      setReading(false);
    }
  }

  if (statuses.isError || fields.isError) {
    return (
      <Alert severity="error" sx={{ fontSize: 13 }}>
        Could not load the lead types and their columns. {describeError(statuses.error ?? fields.error)}
      </Alert>
    );
  }
  if (!statuses.data || !fields.data) {
    return <EventsLoading messages={["Loading the lead types…"]} />;
  }
  const live = statuses.data.filter((s) => s.enabled);
  const columns = status ? (fields.data[status] ?? []) : [];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      <Steps current={step} reached={reached} onGo={setStep} />

      <Panel sx={{ p: 2.5, display: step === 0 ? "flex" : "none", flexDirection: "column", gap: 2.5 }}>
        {created && (
          <Alert
            severity="info"
            sx={{ fontSize: 13 }}
            action={
              <Button size="small" onClick={startOver}>
                Start a new import
              </Button>
            }
          >
            The submission for <b>{meta.event_name}</b> is created, so these are fixed here. Change the event details
            in step 3. For a different file, start a new import — this one stays in My Submissions.
          </Alert>
        )}
        {live.length === 0 && (
          <Alert severity="warning" sx={{ fontSize: 13 }}>
            No lead types are in use, so there are no columns to map to. An admin sets them under Marketing Admin →
            Events Statuses &amp; Columns.
          </Alert>
        )}

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
          <Box sx={{ gridColumn: { sm: "1 / -1" } }}>
            <Typography sx={fieldLabel}>Event name</Typography>
            <Autocomplete
              freeSolo
              options={names.data ?? []}
              inputValue={eventName}
              onInputChange={(_, v) => setEventName(v)}
              disabled={locked}
              renderInput={(p) => (
                <TextField
                  {...p}
                  size="small"
                  sx={fieldInput}
                  placeholder="e.g. Exito BFSI Summit Philippines"
                />
              )}
            />
            {/* The name isn't just a label here: it becomes every lead's Opt-in method in
                Salesforce (rules/validate.ts optInMethod), so a nickname or a file name
                would land on every row. Show exactly what will be written. */}
            <Box sx={{ ...fieldHint, display: "flex", alignItems: "flex-start", gap: 0.5, color: "warning.main" }}>
              <TriangleAlert size={13} style={{ flexShrink: 0, marginTop: 2 }} />
              <Typography component="span" sx={{ fontSize: "inherit", color: "inherit" }}>
                This becomes every lead's <b>Opt-in method</b> in Salesforce
                {eventName.trim() ? (
                  <>
                    : <b>“{optInMethod({ name: eventName, date: eventDate, campaignUrl })}”</b>
                  </>
                ) : (
                  ", with the event's year"
                )}
                . Use the event's full, official name, not a short name or the file's name.
              </Typography>
            </Box>
          </Box>
          <Box>
            <Typography sx={fieldLabel}>Event date</Typography>
            <TextField
              type="date"
              size="small"
              fullWidth
              sx={fieldInput}
              disabled={locked}
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </Box>
          <Box>
            <Typography sx={fieldLabel}>Salesforce campaign URL</Typography>
            <CampaignUrlField value={campaignUrl} onChange={setCampaignUrl} disabled={locked} />
          </Box>
          <Box>
            <Typography sx={fieldLabel}>SDR owner</Typography>
            <SdrOwnerField value={sdrOwner} onChange={setSdrOwner} disabled={locked} />
          </Box>
        </Box>

        <Box>
          <Typography sx={fieldLabel}>Which leads are these?</Typography>
          <Select
            size="small"
            displayEmpty
            value={status}
            disabled={locked}
            onChange={(e) => setStatus(e.target.value as string)}
            inputProps={{ "aria-label": "Lead type" }}
            sx={{ minWidth: 280, fontSize: 13 }}
          >
            <MenuItem value="" disabled sx={{ fontSize: 13 }}>
              Choose a lead type
            </MenuItem>
            {live.map((s) => (
              <MenuItem key={s.name} value={s.name} sx={{ fontSize: 13 }}>
                {s.name}
              </MenuItem>
            ))}
          </Select>
          {status ? (
            <ColumnsHint columns={columns} />
          ) : (
            <Typography sx={fieldHint}>It decides which template columns the file is mapped to.</Typography>
          )}
        </Box>

        <Box>
          <Typography sx={fieldLabel}>The raw lead file</Typography>
          <Box
            role="button"
            tabIndex={0}
            aria-label="Choose a lead file"
            aria-disabled={locked}
            onClick={() => !locked && input.current?.click()}
            onKeyDown={(e) => {
              // Keys pressed on the Remove button inside belong to that button.
              if (e.target !== e.currentTarget || locked) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                input.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            sx={{
              border: 1.5,
              borderStyle: file ? "solid" : "dashed",
              borderColor: dragging ? "primary.main" : "divider",
              bgcolor: dragging ? "action.hover" : "transparent",
              borderRadius: 1.25,
              py: file ? 2 : 4,
              px: 2,
              textAlign: "center",
              cursor: locked ? "default" : "pointer",
              opacity: locked ? 0.6 : 1,
              transition: "all .12s",
              "&:hover, &:focus-visible": { borderColor: "primary.main", outline: "none" },
            }}
          >
            <input
              ref={input}
              type="file"
              hidden
              accept={ACCEPT}
              onChange={(e) => {
                pick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {file ? (
              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1.25 }}>
                <FileSpreadsheet size={20} />
                <Box sx={{ textAlign: "left" }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{file.name}</Typography>
                  <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
                    {(file.size / 1024).toFixed(0)} KB · click or drop to choose a different file
                  </Typography>
                </Box>
                <Button
                  aria-label="Remove the file"
                  disabled={locked}
                  sx={{ ...quietBtn, minWidth: 0, p: 0.5 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                >
                  <X size={16} />
                </Button>
              </Box>
            ) : (
              <>
                <Box sx={{ color: "text.secondary" }}>
                  <Upload size={22} />
                </Box>
                <Typography sx={{ fontSize: 14, fontWeight: 700, mt: 1 }}>
                  Drop the raw lead file here, or click to choose it
                </Typography>
                <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.5 }}>
                  Badge scans, booth captures, delegate lists, webinar reports, in any layout or language. .xlsx or
                  .csv, up to {MAX_FILE_BYTES / (1024 * 1024)} MB.
                </Typography>
              </>
            )}
          </Box>
          <Typography sx={fieldHint}>The file is read in your browser and isn't uploaded.</Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ fontSize: 13 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Button
            variant="contained"
            sx={primaryBtn}
            disabled={!file || !status || !eventName.trim() || reading}
            onClick={() => void open()}
            startIcon={reading ? <CircularProgress size={15} color="inherit" /> : undefined}
            endIcon={reading ? undefined : <ArrowRight size={16} />}
          >
            {reading ? "Reading the file…" : "Next: map columns"}
          </Button>
        </Box>
      </Panel>

      {opened && fields.data && (
        <Box sx={{ display: step === 1 ? "block" : "none" }}>
          <LeadMapping
            key={readCount}
            fileName={opened.file.name}
            sheets={opened.sheets}
            status={opened.status}
            defs={fields.data[opened.status] ?? []}
            meta={meta}
            submissionId={submissionId}
            onBack={() => setStep(0)}
            onCreated={(id) => {
              if (thisRead === currentRead.current) setSubmissionId(id);
            }}
            onNext={(replaced) => {
              if (thisRead !== currentRead.current) return;
              if (replaced) setRowsVersion((n) => n + 1);
              setStep(2);
            }}
          />
        </Box>
      )}

      {step === 2 && submissionId && (
        <SubmissionWorkspace
          key={rowsVersion}
          id={submissionId}
          onBack={() => setStep(1)}
          backLabel="Back: map columns"
        />
      )}
    </Box>
  );
}

/** The three steps, with the current one marked. A step already reached is a button
 *  back (or forward) to it; one not reached yet is plain text. */
function Steps({ current, reached, onGo }: { current: Step; reached: Step; onGo: (step: Step) => void }) {
  return (
    <Box
      component="ol"
      aria-label="Lead import steps"
      sx={{ display: "flex", gap: 1, flexWrap: "wrap", m: 0, p: 0, listStyle: "none" }}
    >
      {STEPS.map((step, i) => {
        const n = i as Step;
        const here = n === current;
        // Done once the step after it is reached: set up when the file is read, the mapping
        // when the submission exists. The last step is finished by Review, not here.
        const done = !here && n < reached;
        const open = n <= reached && !here;
        return (
          <Box component="li" key={step.title} sx={{ flex: "1 1 200px", minWidth: 0 }}>
            <Box
              component={open ? "button" : "div"}
              type={open ? "button" : undefined}
              aria-current={here ? "step" : undefined}
              onClick={open ? () => onGo(n) : undefined}
              sx={{
                width: "100%",
                display: "flex",
                gap: 1.25,
                alignItems: "flex-start",
                textAlign: "left",
                font: "inherit",
                p: 1.25,
                borderRadius: 1,
                border: 1,
                borderColor: here ? "primary.main" : "divider",
                bgcolor: here ? "action.selected" : "transparent",
                cursor: open ? "pointer" : "default",
                opacity: n > reached ? 0.55 : 1,
                "&:hover": open ? { borderColor: "primary.main" } : undefined,
              }}
            >
              <Box
                sx={{
                  flexShrink: 0,
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  border: 1,
                  borderColor: here ? "primary.main" : done ? "success.main" : "divider",
                  bgcolor: here ? "primary.main" : "transparent",
                  color: here ? "primary.contrastText" : done ? "success.main" : "text.secondary",
                }}
              >
                {done ? <Check size={13} /> : i + 1}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: here ? "text.primary" : "text.secondary" }}>
                  {step.title}
                </Typography>
                <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{step.body}</Typography>
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

/** The template columns of the chosen lead type, so the person can see what they map to. */
function ColumnsHint({ columns }: { columns: FieldDef[] }) {
  const mappable = columns.filter((c) => !c.computed);
  if (!mappable.length) {
    return (
      <Typography sx={{ ...fieldHint, color: "warning.main" }}>
        This lead type has no columns yet. An admin adds them under Marketing Admin → Events Statuses &amp; Columns.
      </Typography>
    );
  }
  const required = mappable.filter((c) => c.mandatory).length;
  const names = mappable
    .slice(0, COLUMNS_SHOWN)
    .map((c) => c.field_name)
    .join(", ");
  const more = mappable.length > COLUMNS_SHOWN ? ` and ${mappable.length - COLUMNS_SHOWN} more` : "";
  return (
    <Typography sx={{ ...fieldHint, color: "text.secondary" }}>
      {mappable.length} columns{required ? `, ${required} required` : ""}: {names}
      {more}.
    </Typography>
  );
}
