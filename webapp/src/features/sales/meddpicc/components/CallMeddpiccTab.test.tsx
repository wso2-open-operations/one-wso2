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

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import CallMeddpiccTab from "./CallMeddpiccTab";
import type { CallMeddpicc } from "../api/useCallMeddpicc";
import type { MeetingCoverage } from "../types";
import { callInsight } from "../util/callInsight";

const coverageOf = (status: MeetingCoverage["status"]): MeetingCoverage => ({
  meetingId: 7,
  status,
  coverage: { M: 0, E: 0, DC: 0, DP: 0, P: 0, I: 0, CH: 0, CO: 0 },
  missed: [],
  stageAtCall: null,
  quotes: {},
  opportunityId: null,
});

const callWith = (coverage: MeetingCoverage | undefined): CallMeddpicc => ({
  configured: true,
  coverage,
  coverageLoading: false,
  coverageError: null,
  retryCoverage: () => {},
  opportunityId: null,
  deal: undefined,
  dealLoading: false,
  dealError: null,
  retryDeal: () => {},
  insight: callInsight(7, coverage, undefined),
});

const renderTab = (call: CallMeddpicc, reanalysis?: { allowed: boolean; inFlight: boolean; request: () => void }) =>
  render(
    <MemoryRouter>
      <CallMeddpiccTab call={call} focusLetter={null} onSeek={() => {}} onOpenDeal={() => {}} reanalysis={reanalysis} />
    </MemoryRouter>,
  );

// The calls table lists the recordings alone, so asking for another analysis happens here.
describe("CallMeddpiccTab's Analyse again", () => {
  it("is offered to whoever may ask, on a failed analysis and on a finished one", async () => {
    const request = vi.fn();
    const { unmount } = renderTab(callWith(coverageOf("FAILED")), { allowed: true, inFlight: false, request });
    expect(screen.getByText("MEDDPICC analysis failed for this call.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Analyse again" }));
    expect(request).toHaveBeenCalledTimes(1);
    unmount();

    renderTab(callWith(coverageOf("DONE")), { allowed: true, inFlight: false, request });
    expect(screen.getByText("What this call evidenced")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyse again" })).toBeEnabled();
  });

  it("waits while a request is in flight, and is not offered while an analysis runs", () => {
    const { unmount } = renderTab(callWith(coverageOf("DONE")), { allowed: true, inFlight: true, request: () => {} });
    expect(screen.getByRole("button", { name: "Analyse again" })).toBeDisabled();
    unmount();

    for (const status of ["PENDING", "RUNNING"] as const) {
      const { unmount: done } = renderTab(callWith(coverageOf(status)), { allowed: true, inFlight: false, request: () => {} });
      expect(screen.queryByRole("button", { name: "Analyse again" })).not.toBeInTheDocument();
      done();
    }
  });

  // Nothing to analyse again: no transcript, an empty one, or no answer about the call yet.
  it("is not offered for a call with nothing to analyse", () => {
    for (const coverage of [coverageOf("NONE"), coverageOf("EMPTY"), undefined]) {
      const { unmount } = renderTab(callWith(coverage), { allowed: true, inFlight: false, request: () => {} });
      expect(screen.queryByRole("button", { name: "Analyse again" })).not.toBeInTheDocument();
      unmount();
    }
  });

  it("is left out for anyone else, and when nobody can ask", () => {
    const { unmount } = renderTab(callWith(coverageOf("FAILED")), { allowed: false, inFlight: false, request: () => {} });
    expect(screen.queryByRole("button", { name: "Analyse again" })).not.toBeInTheDocument();
    unmount();

    renderTab(callWith(coverageOf("FAILED")));
    expect(screen.queryByRole("button", { name: "Analyse again" })).not.toBeInTheDocument();
  });
});
