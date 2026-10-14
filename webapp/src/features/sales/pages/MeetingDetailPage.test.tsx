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
const state = { echoConfigured: true };
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
    },
    isLoading: false,
    error: null,
  }),
}));
vi.mock("../meddpicc/api/useCallMeddpicc", () => ({
  useCallMeddpicc: () => ({ configured: state.echoConfigured, opportunityId: "006X", insight: { markers: [] } }),
}));
vi.mock("../components/RecordingPlayer", () => ({ default: () => <div>player</div> }));
vi.mock("../components/SpeakerTimeline", () => ({ default: () => <div>timeline</div> }));
vi.mock("../components/SmartNotesPanel", () => ({ default: () => <div>smart notes</div> }));
vi.mock("../components/TranscriptPanel", () => ({ default: () => <div>transcript pane</div> }));
vi.mock("../meddpicc/components/CallMeddpiccStrip", () => ({ default: () => <div>strip</div> }));
vi.mock("../meddpicc/components/CallMeddpiccTab", () => ({
  default: ({ focusLetter }: { focusLetter: string | null }) => <div>meddpicc pane, letter {focusLetter ?? "none"}</div>,
}));

import { render, screen } from "@testing-library/react";
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
});

describe("MeetingDetailPage tabs", () => {
  it("opens on Summary by default", () => {
    renderAt("/sales/meetings/7");
    expect(screen.getByRole("tab", { name: "Summary" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("smart notes")).toBeInTheDocument();
  });

  // The meetings table sends a row here: the call's analysis, at a Letter from a circle.
  it("opens on the MEDDPICC analysis at the Letter the URL names", () => {
    renderAt("/sales/meetings/7?tab=meddpicc&letter=E");
    expect(screen.getByRole("tab", { name: "MEDDPICC" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("meddpicc pane, letter E")).toBeInTheDocument();
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
