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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TranscriptPanel, { type TranscriptSection } from "./TranscriptPanel";
import type { TranscriptLine } from "../api/salesTypes";
import type { LinePlace } from "../util/meetingParts";

const line = (text: string, offsetSeconds = 0): TranscriptLine => ({
  speaker: "Asha",
  text,
  offsetSeconds,
  startTime: "2026-10-25T10:00:00Z",
  endTime: "2026-10-25T10:00:05Z",
});

const section = (lines: { text: string; place: LinePlace | null }[], overrides: Partial<TranscriptSection> = {}) => ({
  label: null,
  lines: lines.map(({ text, place }) => ({ line: line(text, place?.offsetSeconds ?? 0), place })),
  isLoading: false,
  error: null,
  ...overrides,
});

describe("TranscriptPanel", () => {
  // A meeting listed without recording parts still has one default recording: its lines must
  // stay clickable and seek the player, as before parts existed.
  it("keeps every line playable when the meeting lists no recording parts", async () => {
    const onSeek = vi.fn();
    render(
      <TranscriptPanel
        sections={[section([{ text: "Hello there", place: { recordingId: -1, offsetSeconds: 42 } }])]}
        selectedRecordingId={-1}
        currentTime={0}
        onSeek={onSeek}
      />,
    );
    expect(screen.queryByText("Not recorded")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Hello there/ }));
    expect(onSeek).toHaveBeenCalledWith({ recordingId: -1, offsetSeconds: 42 });
  });

  // Recording stopped while transcription went on: the line is shown, but there is nothing to play.
  it("marks a line said while nothing was recording, and does not play it", () => {
    render(
      <TranscriptPanel
        sections={[section([{ text: "After the recording stopped", place: null }])]}
        selectedRecordingId={1}
        currentTime={0}
        onSeek={() => {}}
      />,
    );
    expect(screen.getByText("Not recorded")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /After the recording stopped/ })).toBeDisabled();
  });

  it("does not say nothing matches while a transcript is still loading", async () => {
    render(
      <TranscriptPanel
        sections={[
          section([{ text: "Hello there", place: { recordingId: 1, offsetSeconds: 0 } }]),
          section([], { isLoading: true }),
        ]}
        selectedRecordingId={1}
        currentTime={0}
        onSeek={() => {}}
      />,
    );
    await userEvent.type(screen.getByRole("searchbox", { name: "Search in transcript" }), "budget");
    expect(screen.queryByText(/Nothing matches/)).not.toBeInTheDocument();
  });
});

// jsdom lays nothing out, so the list and its lines are given a geometry: a 300px-tall
// list (the element holding the line buttons), lines 40px apart, each line's position
// taken from a data-line index set on it, or from `placed` by its text for a line that is
// rendered afresh and cannot be tagged in time.
const geometry = (proto: object, name: string, get: (el: HTMLElement) => number) =>
  Object.defineProperty(proto, name, { configurable: true, get() { return get(this as HTMLElement); } });
const placed = new Map<string, number>();
const lineIndex = (el: HTMLElement) =>
  Number(el.dataset.line ?? [...placed].find(([text]) => el.textContent?.includes(text))?.[1] ?? -1);

describe("TranscriptPanel follows the recording", () => {
  const mocked = ["clientHeight", "offsetHeight", "offsetTop"];
  let originals: Array<PropertyDescriptor | undefined> = [];
  beforeEach(() => {
    originals = mocked.map((name) => Object.getOwnPropertyDescriptor(HTMLElement.prototype, name));
    geometry(HTMLElement.prototype, "clientHeight", (el) => (el.querySelector("button") ? 300 : 40));
    geometry(HTMLElement.prototype, "offsetHeight", () => 40);
    geometry(HTMLElement.prototype, "offsetTop", (el) => (lineIndex(el) >= 0 ? lineIndex(el) * 40 : 0));
  });
  // jsdom's own accessors come back, so a later test reads its values and not undefined.
  afterEach(() => {
    mocked.forEach((name, i) => {
      const original = originals[i];
      if (original) Object.defineProperty(HTMLElement.prototype, name, original);
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[name];
    });
    placed.clear();
  });

  const spoken = [
    { text: "Thanks for joining.", place: { recordingId: 1, offsetSeconds: 0 } },
    { text: "Budget is signed off.", place: { recordingId: 1, offsetSeconds: 760 } },
    { text: "Great news.", place: { recordingId: 1, offsetSeconds: 770 } },
  ];
  const panel = (currentTime: number) => (
    <TranscriptPanel sections={[section(spoken)]} selectedRecordingId={1} currentTime={currentTime} onSeek={() => {}} />
  );
  /** The scrolling list: the panel's second child, after the search box. */
  const listOf = (container: HTMLElement) => container.firstElementChild?.lastElementChild as HTMLElement;
  /** The list and its lines, tagged by index. */
  const tag = (container: HTMLElement) => {
    const lines = screen.getAllByRole("button");
    lines.forEach((line, i) => line.setAttribute("data-line", String(i)));
    return { list: listOf(container), lines };
  };

  it("marks the line being spoken, and leaves the list alone while it is in view", () => {
    const { container, rerender } = render(panel(0));
    const { list } = tag(container);
    expect(screen.getByRole("button", { name: /Thanks for joining/ })).toHaveAttribute("aria-current", "true");
    // The second line sits at 40px, inside the 300px window: no scroll.
    rerender(panel(765));
    expect(screen.getByRole("button", { name: /Budget is signed off/ })).toHaveAttribute("aria-current", "true");
    expect(list.scrollTop).toBe(0);
  });

  it("scrolls the list, not the page, to a line out of view", () => {
    const { container, rerender } = render(panel(0));
    const { list, lines } = tag(container);
    // Put the third line well below the window.
    lines[2].setAttribute("data-line", "20");
    rerender(panel(770));
    // 20 * 40 = 800px down; centred in a 300px window holding a 40px line.
    expect(list.scrollTop).toBe(800 - (300 - 40) / 2);
  });

  it("brings the line being spoken back into view once a search is cleared", async () => {
    // The third line sits well below the window, wherever it is rendered.
    placed.set("Great news.", 20);
    const { container } = render(panel(770));
    expect(listOf(container).scrollTop).toBe(800 - (300 - 40) / 2);

    // A search matching nothing replaces the list; clearing it gives a fresh one, at the top.
    const search = screen.getByRole("searchbox", { name: "Search in transcript" });
    await userEvent.type(search, "zzz");
    expect(screen.getByText(/Nothing matches/)).toBeInTheDocument();
    await userEvent.clear(search);
    expect(listOf(container).scrollTop).toBe(800 - (300 - 40) / 2);
  });
});
