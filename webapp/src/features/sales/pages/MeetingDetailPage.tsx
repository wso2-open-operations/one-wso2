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

import { useMemo, useRef, useState } from "react";
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from "react-router";
import {
  Alert,
  Box,
  Breadcrumbs,
  Chip,
  Divider,
  Link,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@wso2/oxygen-ui";
import { isSalesBackendConfigured, useMeeting, useTranscripts } from "../api/useSalesData";
import {
  meetingCustomer,
  meetingTypeLabel,
  parseOpportunityDetails,
} from "../api/salesTypes";
import SalesShell from "../components/SalesShell";
import RecordingPlayer, { type RecordingPlayerHandle } from "../components/RecordingPlayer";
import TranscriptPanel, { type TranscriptSection } from "../components/TranscriptPanel";
import { attachedParts, partLabel, placeLine, placeSecond, type LinePlace } from "../util/meetingParts";
import SmartNotesPanel from "../components/SmartNotesPanel";
import SpeakerTimeline from "../components/SpeakerTimeline";
import { describeError, isForbidden } from "../util/salesError";
import { useCallMeddpicc } from "../meddpicc/api/useCallMeddpicc";
import CallMeddpiccStrip from "../meddpicc/components/CallMeddpiccStrip";
import CallMeddpiccTab from "../meddpicc/components/CallMeddpiccTab";
import { dealPath, MEETING_TABS, startSecondOf, type MeetingTab } from "../util/salesPaths";
import { LETTER_KEYS } from "../meddpicc/util/meddpiccFormat";
import type { LetterKey } from "../meddpicc/types";
import { formatDateTime, splitParticipants } from "../util/salesTime";

/** Stands in for the recording of a meeting listed without recording parts. Never a real part id. */
const DEFAULT_RECORDING = -1;

/**
 * One meeting: the recording, and the context around it.
 *
 * A ROUTE rather than a dialog, which is the whole point of moving it here. A recording is
 * something people send each other -- "watch the first ten minutes of this" -- and a dialog
 * has no address. This does: /sales/meetings/42 survives a refresh, a bookmark and a
 * paste into Slack, because the page resolves itself from the id rather than from whatever
 * the list happened to be holding.
 *
 * TWO COLUMNS because the left one drives the right: clicking a transcript line seeks the
 * recording. That interaction is the reason the player is a native <video> and not a Drive
 * iframe — an iframe would show the recording but expose no way to set its position.
 */
export default function MeetingDetailPage() {
  const { meetingId: rawId } = useParams();
  const meetingId = Number(rawId);
  const validId = Number.isInteger(meetingId) && meetingId > 0;

  const configured = isSalesBackendConfigured();
  const playerRef = useRef<RecordingPlayerHandle>(null);
  // Held here rather than inside the transcript: the player owns the position, and the
  // transcript is one of possibly several things that want to know it.
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Reset the clock when the route moves to a different meeting.
  //
  // Changing `:meetingId` does NOT unmount this page -- React Router swaps the param and
  // re-renders -- so without this, meeting A's position survives into meeting B: the
  // timeline draws a playhead partway through a recording that has not started, and the
  // transcript highlights whatever line that instant lands on, until B's video happens to
  // emit its first event.
  //
  // Done during render rather than in an effect. This is React's documented way to adjust
  // state when a prop changes: the re-render happens before anything is painted, so the
  // wrong position is never on screen, and an effect would both paint it first and trip
  // the set-state-in-effect rule.
  // A call holds a recording for each time recording was started. The one being played,
  // by part id; null means the first. And where to start it, when a transcript line from
  // another recording asked to switch to it.
  const [chosenRecordingId, setChosenRecordingId] = useState<number | null>(null);
  const [startAt, setStartAt] = useState(0);

  const [clockOwner, setClockOwner] = useState(meetingId);
  if (clockOwner !== meetingId) {
    setClockOwner(meetingId);
    setCurrentTime(0);
    setDuration(0);
    setChosenRecordingId(null);
    setStartAt(0);
  }
  const { data: meeting, isLoading, error } = useMeeting(validId ? meetingId : null);
  // The tab, the Letter and the moment to open at all live in the URL; read below.
  const [searchParams, setSearchParams] = useSearchParams();

  // Every part that can be opened, in the order they happened.
  const recordings = useMemo(() => attachedParts(meeting?.recordings), [meeting]);
  const transcripts = useMemo(() => attachedParts(meeting?.transcripts), [meeting]);
  const notes = useMemo(() => attachedParts(meeting?.smartNotes), [meeting]);
  // A quote on a deal links here with ?t=, the second it was said counted from the call's
  // start: the recording that moment falls in opens there, until a part is picked by hand.
  const openingSecond = startSecondOf(searchParams);
  const opening = useMemo(
    () => (openingSecond === null ? null : placeSecond(openingSecond, recordings, DEFAULT_RECORDING, meeting?.recordings)),
    [openingSecond, recordings, meeting?.recordings],
  );
  const selected =
    recordings.find((r) => r.id === (chosenRecordingId ?? opening?.recordingId)) ?? recordings[0] ?? null;
  // Where the player starts: the moment the URL asked for, or where a transcript line from
  // another part sent it (playRecording). The player reads it once, when it mounts.
  const playerStartAt = chosenRecordingId === null && opening ? opening.offsetSeconds : startAt;
  // The recording transcript lines are placed on and highlighted against. A meeting listed
  // without recording parts (a meet-app from before parts, or no recording at all) still has
  // one default recording, so its lines stay clickable and seek the player, as before parts.
  const playingId = selected?.id ?? DEFAULT_RECORDING;

  // Every transcript, each line placed on the recording it was spoken during. Shared by the
  // Transcript tab and the timeline, from one set of cached queries.
  const transcriptQueries = useTranscripts(
    meeting ? meetingId : null,
    transcripts.map((t) => t.id),
  );
  const sections: TranscriptSection[] = useMemo(
    () =>
      transcriptQueries.map((query, i) => ({
        label: transcripts.length > 1 ? partLabel(transcripts[i], i, "Transcript") : null,
        lines: (query.data?.lines ?? []).map((line) => ({
          line,
          place: placeLine(line, recordings, DEFAULT_RECORDING),
        })),
        isLoading: query.isLoading,
        error: query.error,
      })),
    [transcriptQueries, transcripts, recordings],
  );
  // The timeline draws the lines spoken during the recording being played, timed from its
  // start. Without parts (a meeting from before they were listed) it reads the transcript
  // itself, as it always did.
  const timelineLines = useMemo(
    () =>
      recordings.length === 0
        ? undefined
        : sections.flatMap((section) =>
            section.lines
              .filter(({ place }) => place?.recordingId === selected?.id)
              .map(({ line, place }) => ({ ...line, offsetSeconds: (place as LinePlace).offsetSeconds })),
          ),
    [recordings, sections, selected],
  );

  // Switch to another recording, starting it at a position (0 for its start).
  const playRecording = (recordingId: number, seconds: number) => {
    setChosenRecordingId(recordingId);
    setStartAt(seconds);
    setCurrentTime(0);
    setDuration(0);
  };
  // A transcript line: seek within the recording being played, or switch to the one the
  // line was spoken during.
  const seekLine = (place: LinePlace) => {
    if (selected === null || place.recordingId === selected.id) {
      playerRef.current?.seekTo(place.offsetSeconds);
    } else {
      playRecording(place.recordingId, place.offsetSeconds);
    }
  };

  // The call's MEDDPICC: the strip above the columns, the MEDDPICC tab, and the evidence
  // markers on the timeline all read this one answer.
  const call = useCallMeddpicc(meeting);

  // The tab, and the Letter marked in the MEDDPICC tab, live in the URL (?tab=&letter=):
  // a click in the meetings table opens a call straight on its analysis, and a refresh or
  // a pasted link lands on the same pane. Replaced rather than pushed when changed here,
  // so Back still leaves the meeting instead of stepping through its tabs.
  // Summary is the default: someone opening a call wants to know what it was about
  // before they want to read it word for word.
  const requestedTab = searchParams.get("tab");
  const asked: MeetingTab = (MEETING_TABS as readonly string[]).includes(requestedTab ?? "")
    ? (requestedTab as MeetingTab)
    : "summary";
  // Without the MEDDPICC backend there is no MEDDPICC tab to open.
  const tab: MeetingTab = asked === "meddpicc" && !call.configured ? "summary" : asked;
  const rawLetter = searchParams.get("letter");
  const focusLetter =
    tab === "meddpicc" && rawLetter && (LETTER_KEYS as readonly string[]).includes(rawLetter)
      ? (rawLetter as LetterKey)
      : null;
  const show = (next: MeetingTab, letter: LetterKey | null = null) => {
    const params = new URLSearchParams();
    if (next !== "summary") params.set("tab", next);
    if (next === "meddpicc" && letter) params.set("letter", letter);
    // The moment stays: the link still says where the recording is, and the player keeps
    // the part it opened.
    const t = searchParams.get("t");
    if (t !== null) params.set("t", t);
    setSearchParams(params, { replace: true });
  };
  const navigate = useNavigate();
  const openDeal = () => {
    if (call.opportunityId) void navigate(dealPath(call.opportunityId));
  };
  // A circle in the strip opens the MEDDPICC tab at its Letter.
  const openLetter = (letter: LetterKey) => show("meddpicc", letter);
  const seek = (seconds: number) => playerRef.current?.seekTo(seconds);

  const forbidden = isForbidden(error);
  const participants = splitParticipants(meeting?.internalParticipants);
  const externals = splitParticipants(meeting?.externalParticipants);
  const customer = meeting ? meetingCustomer(meeting) : null;
  const typeLabel = meetingTypeLabel(meeting?.meetingType);
  const deal = parseOpportunityDetails(meeting?.opportunityDetails);

  return (
    <SalesShell
      title={meeting?.title ?? "Meeting"}
      configured={configured}
      configKey="ONE_WSO2_REVOPS_BACKEND_URL"
      forbidden={forbidden}
    >
      <Breadcrumbs sx={{ mb: 2 }}>
        {/* Echo is the group the screen sits in, not a destination -- the rail
            treats it the same way -- so it is a label here, not a link. */}
        <Typography color="text.secondary" variant="body2">
          Echo
        </Typography>
        <Link component={RouterLink} to="/sales/meetings" underline="hover" color="inherit">
          Meetings
        </Link>
        <Typography color="text.primary" variant="body2">
          {meeting?.title ?? "…"}
        </Typography>
      </Breadcrumbs>

      {!validId ? (
        <Alert severity="error">That is not a valid meeting reference.</Alert>
      ) : isLoading ? (
        <Skeleton variant="rectangular" sx={{ width: "100%", height: 420, borderRadius: 1 }} />
      ) : error && !forbidden ? (
        <Alert severity="error">{describeError(error)}</Alert>
      ) : meeting ? (
        <>
          <CallMeddpiccStrip
            call={call}
            meetingTitle={meeting.title}
            onLetterClick={openLetter}
            onOpenDeal={openDeal}
          />
          <Box
            sx={{
              display: "grid",
              // One column until there is room for two. The video is the thing worth the
              // width, so it takes the larger share once the split happens.
              gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) minmax(0, 1.4fr)" },
              gap: 3,
              alignItems: "start",
            }}
          >
            {/* LEFT — the summary, and the conversation behind it. */}
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Tabs
                value={tab}
                // Chosen from the tab bar, not from a circle: no Letter to mark.
                onChange={(_, next: MeetingTab) => show(next)}
                // Styled like the deal page's tabs, so the two Echo screens read as one product.
                sx={{
                  mb: 2,
                  minHeight: 40,
                  borderBottom: 1,
                  borderColor: "divider",
                  "& .MuiTab-root": { minHeight: 40, textTransform: "none" },
                }}
              >
                <Tab value="summary" label="Summary" />
                {/* Between the summary and the raw transcript: the analysis of the call sits
                    next to the account of it, and the word-for-word record comes last. Left
                    out when the MEDDPICC backend is not configured. */}
                {call.configured && <Tab value="meddpicc" label="MEDDPICC" />}
                <Tab value="transcript" label="Transcript" />
              </Tabs>

              {/* Each panel is mounted only while selected, so opening a meeting does not
                  fetch a transcript of thousands of lines for someone who came to check the
                  account name. The queries are keyed per meeting, so switching back is a
                  cache hit rather than a refetch. */}
              {tab === "summary" && (
                // ONE scroll region for the whole tab — the details and the notes are one
                // continuous read, and they are long together. The notes panel deliberately
                // has no scroll of its own, so this is the only scrollbar. Matches the
                // height the Transcript tab uses, so switching tabs doesn't resize the page.
                <Box sx={{ maxHeight: "60vh", overflowY: "auto", pr: 1 }}>
                  {/* The call's own facts lead, because they frame everything under them:
                      Gemini's notes read very differently once you know this was a renewal
                      with the customer's own team in the room. Previously these sat in a
                      third tab, which meant the reader had to go and get the context
                      before the summary meant anything. */}
                  <Stack spacing={2}>
                    <Detail label="Account" value={customer} />
                    <Detail label="Call type" value={typeLabel} />
                    <Detail label="Account owner" value={meeting.host} />
                    <Detail label="Started" value={formatDateTime(meeting.startTime)} />
                    <Detail label="Ended" value={formatDateTime(meeting.endTime)} />

                    {deal && (
                      <>
                        <Divider />
                        <Typography variant="subtitle2">Opportunity</Typography>
                        <Detail label="Stage" value={deal.stage ?? null} />
                        <Detail
                          label="Amount"
                          value={
                            deal.amount != null
                              ? `${deal.currency ?? ""} ${deal.amount.toLocaleString()}`.trim()
                              : null
                          }
                        />
                        <Detail label="Close date" value={deal.closeDate ?? null} />
                      </>
                    )}

                    <Divider />
                    <ParticipantList label="WSO2 participants" emails={participants} />
                    {/* Separated from the internal list rather than merged: on a sales call
                        the question is usually "who was there from the customer", and one
                        combined list of a dozen addresses answers it slowly. */}
                    <ParticipantList
                      label="External participants"
                      emails={externals}
                      // Null means the meeting predates external attendees being captured —
                      // not that nobody external attended.
                      unknown={meeting.externalParticipants == null}
                    />
                  </Stack>

                  <Divider sx={{ my: 2.5 }} />

                  {/* Every smart notes of the call, one after another; a call that had
                      Gemini notes started more than once has one for each. */}
                  {notes.length <= 1 ? (
                    <SmartNotesPanel meetingId={meeting.meetingId} smartNoteId={notes[0]?.id} />
                  ) : (
                    <Stack spacing={2.5} divider={<Divider />}>
                      {notes.map((note, i) => (
                        <Box key={note.id}>
                          <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1 }}>
                            {partLabel(note, i, "Notes")}
                          </Typography>
                          <SmartNotesPanel meetingId={meeting.meetingId} smartNoteId={note.id} />
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Box>
              )}

              {tab === "meddpicc" && call.configured && (
                <CallMeddpiccTab
                  call={call}
                  focusLetter={focusLetter}
                  onSeek={seek}
                  onOpenDeal={openDeal}
                />
              )}

              {tab === "transcript" && (
                <TranscriptPanel
                  sections={sections}
                  selectedRecordingId={playingId}
                  currentTime={currentTime}
                  onSeek={seekLine}
                />
              )}
            </Paper>

            {/* RIGHT — the recording. */}
            <Box>
              {/* A call recorded in several parts -- stopped and started again -- gets a tab
                  per part above the player, styled like the deal page's tabs so the Echo
                  screens match. Nothing extra for the usual one part. */}
              {recordings.length > 1 && (
                <Box sx={{ mb: 1.5 }}>
                  <Tabs
                    value={selected?.id ?? false}
                    onChange={(_, id: number) => playRecording(id, 0)}
                    variant="scrollable"
                    scrollButtons="auto"
                    aria-label="Recording part"
                    sx={{
                      minHeight: 40,
                      borderBottom: 1,
                      borderColor: "divider",
                      "& .MuiTab-root": { minHeight: 40, textTransform: "none" },
                    }}
                  >
                    {recordings.map((recording, i) => (
                      <Tab key={recording.id} value={recording.id} label={partLabel(recording, i)} />
                    ))}
                  </Tabs>
                </Box>
              )}

              <RecordingPlayer
                // Remount per meeting and per recording: the player keeps its own retry
                // latch and failure flag, and a <video> reused across a src change can
                // carry the old element's buffered state with it.
                key={`${meeting.meetingId}-${selected?.id ?? "first"}`}
                ref={playerRef}
                meetingId={meeting.meetingId}
                recordingId={selected?.id}
                startAt={playerStartAt}
                onTimeUpdate={setCurrentTime}
                onDurationChange={setDuration}
              />

              {/* Under the recording, sharing its clock: who spoke and when, during the
                  part being played. */}
              <SpeakerTimeline
                meetingId={meeting.meetingId}
                lines={timelineLines}
                linesLoading={transcriptQueries.some((q) => q.isLoading)}
                durationSeconds={duration}
                currentTime={currentTime}
                onSeek={seek}
                // MEDDPICC evidence is timed from the start of the call, which is where the
                // only recording starts but not where a later part does: drawn on a call
                // with one recording only, rather than in the wrong place on the others.
                markers={recordings.length > 1 ? [] : call.insight.markers}
              />
            </Box>
          </Box>

        </>
      ) : null}
    </SalesShell>
  );
}

/** A labelled set of attendees, as chips. */
function ParticipantList({
  label,
  emails,
  unknown,
}: {
  label: string;
  emails: string[];
  /** True when the absence is missing data rather than an empty guest list. */
  unknown?: boolean;
}) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>
        {label}
      </Typography>
      {unknown ? (
        <Typography variant="body2" color="text.secondary">
          Not recorded for this meeting
        </Typography>
      ) : emails.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          None
        </Typography>
      ) : (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
          {emails.map((email) => (
            <Chip key={email} label={email} size="small" variant="outlined" />
          ))}
        </Box>
      )}
    </Box>
  );
}

/** One labelled value. Renders an em dash rather than nothing, so the rows stay aligned. */
function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="body2">{value?.trim() ? value : "—"}</Typography>
    </Box>
  );
}
