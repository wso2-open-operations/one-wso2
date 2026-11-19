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

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  Alert,
  Box,
  Chip,
  Divider,
  InputAdornment,
  Skeleton,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { SearchIcon } from "@wso2/oxygen-ui-icons-react";
import { HttpError } from "@api/http";
import { formatOffset, type TranscriptLine } from "../api/salesTypes";
import type { LinePlace } from "../util/meetingParts";
import { describeError } from "../util/salesError";

/** One line, and where it falls in the recordings: null when said while nothing recorded. */
export interface PlacedLine {
  line: TranscriptLine;
  place: LinePlace | null;
}

/** One transcript of the call -- a call holds one per time transcription was started. */
export interface TranscriptSection {
  /** Heading above it, when the call has several transcripts. */
  label: string | null;
  lines: PlacedLine[];
  isLoading: boolean;
  error: unknown;
}

/**
 * The conversation, with every line a way into the recording.
 *
 * Clicking a line seeks the video to where it was said. That is the whole reason the player
 * is a native <video> rather than a Drive iframe: an iframe would show the recording but
 * expose no way to set its position, so this interaction would be impossible.
 *
 * A call can hold several transcripts and several recordings, and they need not line up --
 * recording and transcription are stopped and started separately. Every transcript is shown
 * in order, and a line opens whichever recording it was spoken during, switching to it if
 * another is playing. A line said while nothing was recording is marked so.
 */
export default function TranscriptPanel({
  sections,
  selectedRecordingId,
  onSeek,
  currentTime,
}: {
  sections: TranscriptSection[];
  /** The recording being played, so the line being spoken can be marked. */
  selectedRecordingId: number | null;
  onSeek: (place: LinePlace) => void;
  /** Player position, in the selected recording. */
  currentTime: number;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections.map((section) => ({
      ...section,
      lines: section.lines.filter(
        ({ line }) => line.text.toLowerCase().includes(q) || line.speaker.toLowerCase().includes(q),
      ),
    }));
  }, [sections, query]);

  // The line being spoken now: the last one placed on the playing recording at or before
  // the playhead. Keyed by section and line, since lines from different transcripts mix.
  const activeKey = useMemo(() => {
    let key: string | null = null;
    sections.forEach((section, s) =>
      section.lines.forEach(({ place }, i) => {
        if (place && place.recordingId === selectedRecordingId && place.offsetSeconds <= currentTime) {
          key = `${s}-${i}`;
        }
      }),
    );
    return key;
  }, [sections, selectedRecordingId, currentTime]);

  const noTimedTranscript = sections.every(
    (section) => section.error instanceof HttpError && section.error.status === 404,
  );
  // The line being spoken is kept inside the list's visible part: when it leaves it, by
  // playback reaching the bottom edge or by a seek to somewhere else entirely (a quote on a
  // deal opens the recording at the second it was said), the list moves to centre it.
  // Only the list's own scroll is moved. scrollIntoView would also pull the page about,
  // on every line, under someone reading something else.
  const listRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const list = listRef.current;
    const line = activeRef.current;
    if (!list || !line) return;
    const above = line.offsetTop < list.scrollTop;
    const below = line.offsetTop + line.offsetHeight > list.scrollTop + list.clientHeight;
    if (above || below) list.scrollTop = line.offsetTop - (list.clientHeight - line.offsetHeight) / 2;
    // On the query too: a search that matches nothing replaces the list, and clearing it
    // gives a fresh one back at the top, with the line being spoken unchanged.
  }, [activeKey, query]);

  // 404 means this meeting has no TIMED transcript — it predates the resource name being
  // stored, so only the Drive document exists. Said plainly rather than as an error,
  // because nothing is broken.
  if (noTimedTranscript) {
    return (
      <Alert severity="info">
        No synchronised transcript for this meeting. Older recordings only have the
        transcript document, which is linked under Files.
      </Alert>
    );
  }
  if (sections.every((section) => section.isLoading)) {
    return (
      <Box>
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} variant="text" height={28} />
        ))}
      </Box>
    );
  }
  if (sections.every((section) => !section.isLoading && !section.error && section.lines.length === 0)) {
    return <Alert severity="info">This transcript is empty.</Alert>;
  }

  // Only once every transcript has loaded: one still loading, or that failed, has no lines to
  // match yet, and saying "nothing matches" would hide its loading or its error.
  const nothingMatches =
    query.trim() !== "" &&
    filtered.every((section) => !section.isLoading && !section.error && section.lines.length === 0);

  return (
    <Box>
      <TextField
        fullWidth
        size="small"
        type="search"
        placeholder="Search in transcript"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        sx={{ mb: 1.5 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon size={16} />
              </InputAdornment>
            ),
          },
          // A placeholder is not an accessible name -- screen readers may skip it, and it
          // disappears once typing starts -- so the field is named explicitly.
          htmlInput: { "aria-label": "Search in transcript" },
        }}
      />

      {/* Filtering happens here rather than on the server: the whole transcript is already
          loaded, so a round trip would be slower and would lose the scroll position. */}
      {nothingMatches ? (
        <Typography variant="body2" color="text.secondary">
          Nothing matches “{query}”.
        </Typography>
      ) : (
        // Positioned, so a line's offsetTop is measured from this list and not the page.
        <Box ref={listRef} sx={{ maxHeight: "60vh", overflowY: "auto", pr: 1, position: "relative" }}>
          {filtered.map((section, s) => (
            <Box key={s}>
              {section.label && (
                <Divider textAlign="left" sx={{ my: 1.5, "&:first-of-type": { mt: 0 } }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    {section.label}
                  </Typography>
                </Divider>
              )}
              <SectionBody
                section={section}
                sectionIndex={s}
                activeKey={query ? null : activeKey}
                activeRef={activeRef}
                onSeek={onSeek}
              />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

/** One transcript's lines, or why there are none. */
function SectionBody({
  section,
  sectionIndex,
  activeKey,
  activeRef,
  onSeek,
}: {
  section: TranscriptSection;
  sectionIndex: number;
  activeKey: string | null;
  /** Set on the line being spoken, so the list can keep it in view. */
  activeRef: RefObject<HTMLButtonElement | null>;
  onSeek: (place: LinePlace) => void;
}) {
  if (section.isLoading) {
    return <Skeleton variant="text" height={28} />;
  }
  if (section.error instanceof HttpError && section.error.status === 404) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ px: 1.5, py: 1 }}>
        No synchronised transcript for this part; its document is linked under Files.
      </Typography>
    );
  }
  if (section.error) {
    return <Alert severity="error">{describeError(section.error)}</Alert>;
  }

  return section.lines.map(({ line, place }, i) => {
    const isActive = activeKey === `${sectionIndex}-${i}`;
    return (
      <Box
        key={`${line.startTime}-${i}`}
        ref={isActive ? activeRef : undefined}
        aria-current={isActive ? "true" : undefined}
        onClick={place ? () => onSeek(place) : undefined}
        // A button, not a div with a click: this is an action, and it has to be
        // reachable and operable from the keyboard like any other. Disabled when the
        // line was said while nothing was recording -- there is nowhere to seek to.
        component="button"
        type="button"
        disabled={!place}
        sx={{
          display: "block",
          width: "100%",
          textAlign: "left",
          border: 0,
          borderLeft: 2,
          borderColor: isActive ? "primary.main" : "transparent",
          bgcolor: isActive ? "action.selected" : "transparent",
          cursor: place ? "pointer" : "default",
          px: 1.5,
          py: 1,
          font: "inherit",
          borderRadius: 1,
          "&:hover": place ? { bgcolor: "action.hover" } : undefined,
        }}
      >
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "baseline", mb: 0.25 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontVariantNumeric: "tabular-nums", flexShrink: 0 }}
          >
            {formatOffset(place ? place.offsetSeconds : line.offsetSeconds)}
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            {line.speaker}
          </Typography>
          {!place && <Chip label="Not recorded" size="small" variant="outlined" sx={{ height: 18 }} />}
        </Box>
        <Typography variant="body2" color={place ? "text.primary" : "text.secondary"}>
          {line.text}
        </Typography>
      </Box>
    );
  });
}
