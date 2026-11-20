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

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

// Everything around the tabs is stubbed: these tests are about which pane opens, and
// what the URL says about it.
type Part = { id: number; startTime: string | null; endTime: string | null; state: "ATTACHED" };
const state: { echoConfigured: boolean; recordings: Part[]; smartNotes: Part[] } = {
  echoConfigured: true,
  recordings: [],
  smartNotes: [],
};
vi.mock("../components/SalesShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("../api/useSalesData", () => ({
  isSalesBackendConfigured: () => true,
  useMeeting: () => ({
    data: {
      meetingId: 7, title: "Budget sign-off", googleEventId: "e", host: "ravi@wso2.com",
      startTime: "2026-09-24 07:30:00", endTime: "2026-09-24 08:30:00",
      internalParticipants: "ravi@wso2.com", externalParticipants: null,
      meetingStatus: "ACTIVE", isRecurring: false,
      recordings: state.recordings, transcripts: [], smartNotes: state.smartNotes,
    },
    isLoading: false,
    error: null,
  }),
  useTranscripts: () => [],
}));
vi.mock("../meddpicc/api/useCallMeddpicc", () => ({
  useCallMeddpicc: () => ({ configured: state.echoConfigured, opportunityId: "006X", insight: { markers: [] } }),
}));
// Who the caller is to the sales backend, and the re-analysis request, as the page wires them.
const caller = { isAdmin: false, workEmail: null as string | null, isPending: false };
const mutateAsync = vi.fn(async () => ({}));
const showSuccess = vi.fn();
const showError = vi.fn();
vi.mock("../meddpicc/api/useMeddpiccMutations", () => ({
  useReanalyseMeeting: () => ({ mutateAsync, isPending: caller.isPending }),
}));
vi.mock("../api/useSalesGate", () => ({
  useSalesGate: () => ({ isResolved: true, isAdmin: caller.isAdmin, workEmail: caller.workEmail }),
}));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess, showError }),
}));
vi.mock("../components/RecordingPlayer", () => ({
  default: ({ recordingId, startAt }: { recordingId?: number; startAt?: number }) => (
    <div>player {recordingId ?? "default"}{startAt ? ` at ${startAt}` : ""}</div>
  ),
}));
vi.mock("../components/SpeakerTimeline", () => ({ default: () => <div>timeline</div> }));
vi.mock("../components/SmartNotesPanel", () => ({
  default: ({ smartNoteId }: { smartNoteId?: number }) => <div>smart notes {smartNoteId ?? "default"}</div>,
}));
vi.mock("../components/TranscriptPanel", () => ({ default: () => <div>transcript pane</div> }));
vi.mock("../meddpicc/components/CallMeddpiccStrip", () => ({ default: () => <div>strip</div> }));
vi.mock("../meddpicc/components/CallMeddpiccTab", () => ({
  default: ({
    focusLetter,
    reanalysis,
  }: {
    focusLetter: string | null;
    reanalysis?: { allowed: boolean; inFlight: boolean; request: () => void };
  }) => (
    <div>
      meddpicc pane, letter {focusLetter ?? "none"}
      {reanalysis?.allowed && (
        <button type="button" onClick={reanalysis.request}>
          {reanalysis.inFlight ? "analysing" : "analyse again"}
        </button>
      )}
    </div>
  ),
}));

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import MeetingDetailPage from "./MeetingDetailPage";

function Where() {
  const { pathname, search } = useLocation();
  return <div data-testid="where">{pathname + search}</div>;
}

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Where />
      <Routes>
        <Route path="/sales/meetings/:meetingId" element={<MeetingDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  state.echoConfigured = true;
  state.recordings = [];
  state.smartNotes = [];
  caller.isAdmin = false;
  caller.workEmail = null;
  caller.isPending = false;
  mutateAsync.mockClear();
  showSuccess.mockClear();
  showError.mockClear();
});

const part = (id: number): Part => ({ id, startTime: null, endTime: null, state: "ATTACHED" });

describe("MeetingDetailPage tabs", () => {
  it("opens on Summary by default", () => {
    renderAt("/sales/meetings/7");
    expect(screen.getByRole("tab", { name: "Summary" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("smart notes default")).toBeInTheDocument();
  });

  // The meetings table sends a row here: the call's analysis, at a Letter from a circle.
  it("opens on the MEDDPICC analysis at the Letter the URL names", () => {
    renderAt("/sales/meetings/7?tab=meddpicc&letter=E");
    expect(screen.getByRole("tab", { name: "MEDDPICC" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("meddpicc pane, letter E")).toBeInTheDocument();
  });

  // A quote on a deal links here: the transcript, with the recording at the second it was said.
  it("opens the recording at the second the URL names", () => {
    renderAt("/sales/meetings/7?tab=transcript&t=760");
    expect(screen.getByRole("tab", { name: "Transcript" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("player default at 760")).toBeInTheDocument();
  });

  // Recorded in two parts: the second it names falls in the second part, timed from that part's start.
  it("opens the part the second falls in, for a call recorded in parts", () => {
    state.recordings = [
      { id: 11, startTime: "2026-09-24 07:30:00", endTime: "2026-09-24 07:40:00", state: "ATTACHED" },
      { id: 12, startTime: "2026-09-24 07:45:00", endTime: "2026-09-24 08:30:00", state: "ATTACHED" },
    ];
    renderAt("/sales/meetings/7?tab=transcript&t=1200");
    expect(screen.getByRole("tab", { name: /^Part 2/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("player 12 at 300")).toBeInTheDocument();
  });

  it("ignores a second it cannot read", () => {
    renderAt("/sales/meetings/7?t=12:40");
    expect(screen.getByText("player default")).toBeInTheDocument();
  });

  it("writes a tab chosen from the bar back to the URL, without the Letter", async () => {
    renderAt("/sales/meetings/7?tab=meddpicc&letter=E");
    await userEvent.click(screen.getByRole("tab", { name: "Transcript" }));
    expect(screen.getByText("transcript pane")).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent(/^\/sales\/meetings\/7\?tab=transcript$/);
  });

  it("falls back to Summary when MEDDPICC isn't configured, or the tab is unknown", () => {
    state.echoConfigured = false;
    const { unmount } = renderAt("/sales/meetings/7?tab=meddpicc");
    expect(screen.queryByRole("tab", { name: "MEDDPICC" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Summary" })).toHaveAttribute("aria-selected", "true");
    unmount();

    state.echoConfigured = true;
    renderAt("/sales/meetings/7?tab=nonsense");
    expect(screen.getByRole("tab", { name: "Summary" })).toHaveAttribute("aria-selected", "true");
  });
});

// A call stopped and started again has a recording and notes for each part.
describe("MeetingDetailPage parts", () => {
  it("shows no part choice for a call recorded in one go", () => {
    state.recordings = [part(11)];
    renderAt("/sales/meetings/7");
    expect(screen.queryByRole("tab", { name: /^Part / })).not.toBeInTheDocument();
    expect(screen.getByText("player 11")).toBeInTheDocument();
  });

  it("offers every recording and plays the one picked", async () => {
    state.recordings = [part(11), part(12)];
    renderAt("/sales/meetings/7");
    expect(screen.getByRole("tab", { name: "Part 1" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("player 11")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Part 2" }));
    expect(screen.getByText("player 12")).toBeInTheDocument();
  });

  it("shows every smart notes of the call", () => {
    state.smartNotes = [part(21), part(22)];
    renderAt("/sales/meetings/7");
    expect(screen.getByText("Notes 1")).toBeInTheDocument();
    expect(screen.getByText("smart notes 21")).toBeInTheDocument();
    expect(screen.getByText("smart notes 22")).toBeInTheDocument();
  });
});

// The MEDDPICC tab's Analyse again is the page's to wire: who may ask, which meeting, and
// what is said when the request is taken or refused.
describe("MeetingDetailPage's Analyse again", () => {
  const at = () => renderAt("/sales/meetings/7?tab=meddpicc");

  it("is offered to the call's host and to an admin, not to anyone else", () => {
    let view = at();
    expect(screen.queryByRole("button", { name: "analyse again" })).not.toBeInTheDocument();
    view.unmount();

    caller.workEmail = "ravi@wso2.com"; // the host
    view = at();
    expect(screen.getByRole("button", { name: "analyse again" })).toBeInTheDocument();
    view.unmount();

    caller.workEmail = "someone@wso2.com";
    caller.isAdmin = true;
    at();
    expect(screen.getByRole("button", { name: "analyse again" })).toBeInTheDocument();
  });

  it("asks for this meeting and says it will be analysed again, or says what went wrong", async () => {
    caller.workEmail = "ravi@wso2.com";
    const view = at();
    await userEvent.click(screen.getByRole("button", { name: "analyse again" }));
    expect(mutateAsync).toHaveBeenCalledWith(7);
    await waitFor(() => expect(showSuccess).toHaveBeenCalledWith('"Budget sign-off" will be analysed again.'));
    expect(showError).not.toHaveBeenCalled();
    view.unmount();

    mutateAsync.mockRejectedValueOnce(new Error("refused"));
    at();
    await userEvent.click(screen.getByRole("button", { name: "analyse again" }));
    await waitFor(() => expect(showError).toHaveBeenCalledTimes(1));
    expect(showSuccess).toHaveBeenCalledTimes(1);
  });

  it("shows the request in flight", () => {
    caller.workEmail = "ravi@wso2.com";
    caller.isPending = true;
    at();
    expect(screen.getByRole("button", { name: "analysing" })).toBeInTheDocument();
  });
});
