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
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CallMeddpicc } from "../api/useCallMeddpicc";
import type { DealDetail, MeetingCoverage } from "../types";
import { callInsight } from "../util/callInsight";
import { coverage as makeCoverage, detail as makeDetail } from "../util/callInsight.fixtures";
import CallMeddpiccStrip from "./CallMeddpiccStrip";
import CallMeddpiccTab from "./CallMeddpiccTab";

function callOf(coverage: MeetingCoverage | undefined, deal: DealDetail | undefined): CallMeddpicc {
  return {
    configured: true,
    coverage,
    coverageLoading: false,
    coverageError: null,
    retryCoverage: () => {},
    opportunityId: coverage?.opportunityId ?? null,
    deal,
    dealLoading: false,
    dealError: null,
    retryDeal: () => {},
    insight: callInsight(22, coverage, deal),
  };
}

describe("CallMeddpiccStrip", () => {
  it("says in one line what the call did: stage, what was new, what was missed, what waits", () => {
    render(
      <CallMeddpiccStrip
        call={callOf(makeCoverage(), makeDetail())}
        meetingTitle="Budget sign-off"
        onLetterClick={() => {}}
        onOpenDeal={() => {}}
      />,
    );
    const strip = screen.getByRole("region", { name: "MEDDPICC for this call" });
    expect(within(strip).getByText("Business Proof")).toBeInTheDocument();
    expect(strip).toHaveTextContent("New for this deal: Economic Buyer, Paper Process");
    expect(strip).toHaveTextContent("Missed: Decision Criteria");
    expect(strip).toHaveTextContent("1 awaiting review");
  });

  it("opens the tab at a Letter from its circle, and the deal from its button", async () => {
    const onLetterClick = vi.fn();
    const onOpenDeal = vi.fn();
    render(
      <CallMeddpiccStrip
        call={callOf(makeCoverage(), makeDetail())}
        meetingTitle="Budget sign-off"
        onLetterClick={onLetterClick}
        onOpenDeal={onOpenDeal}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /^Economic Buyer/ }));
    expect(onLetterClick).toHaveBeenCalledWith("E");
    await userEvent.click(screen.getByRole("button", { name: "Open deal" }));
    expect(onOpenDeal).toHaveBeenCalled();
  });

  it("says so when the call has no transcript yet", () => {
    render(
      <CallMeddpiccStrip
        call={callOf(makeCoverage({ status: "NONE", coverage: null }), undefined)}
        meetingTitle="x"
        onLetterClick={() => {}}
        onOpenDeal={() => {}}
      />,
    );
    expect(screen.getByText(/this call has no transcript to analyse/)).toBeInTheDocument();
  });

  it("is left out when the MEDDPICC backend is not configured", () => {
    const { container } = render(
      <CallMeddpiccStrip
        call={{ ...callOf(undefined, undefined), configured: false }}
        meetingTitle="x"
        onLetterClick={() => {}}
        onOpenDeal={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("CallMeddpiccTab", () => {
  it("shows the quote, who said it, and the proposal it backs, and plays it", async () => {
    const onSeek = vi.fn();
    render(
      <CallMeddpiccTab call={callOf(makeCoverage(), makeDetail())} focusLetter={null} onSeek={onSeek} onOpenDeal={() => {}} />,
    );
    const section = screen.getByRole("region", { name: "Economic Buyer" });
    expect(section).toHaveTextContent("Anything over 200k goes to Ingrid.");
    expect(section).toHaveTextContent("Lars Haugen");
    expect(section).toHaveTextContent("Proposes Economic buyer: Ingrid Solberg");
    expect(section).toHaveTextContent("awaiting review");
    await userEvent.click(within(section).getByRole("button", { name: "Play from 12:40, Lars Haugen" }));
    expect(onSeek).toHaveBeenCalledWith(760);
  });

  it("lists what was missed and what to ask next", () => {
    render(
      <CallMeddpiccTab call={callOf(makeCoverage(), makeDetail())} focusLetter={null} onSeek={() => {}} onOpenDeal={() => {}} />,
    );
    const next = screen.getByRole("region", { name: "Next steps" });
    expect(next).toHaveTextContent("Missed: Decision Criteria");
    expect(next).toHaveTextContent("How will you score the shortlist?");
  });

  it("offers the review to someone who can approve", async () => {
    const onOpenDeal = vi.fn();
    render(
      <CallMeddpiccTab call={callOf(makeCoverage(), makeDetail())} focusLetter={null} onSeek={() => {}} onOpenDeal={onOpenDeal} />,
    );
    expect(screen.getByText("1 proposal from this call waits for your review.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Review in deal" }));
    expect(onOpenDeal).toHaveBeenCalled();
  });

  it("shows the same fact as a status line to someone who can't", () => {
    render(
      <CallMeddpiccTab
        call={callOf(makeCoverage(), makeDetail({ canEdit: false }))}
        focusLetter={null}
        onSeek={() => {}}
        onOpenDeal={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { name: "Review in deal" })).not.toBeInTheDocument();
    expect(screen.getByText("1 proposal from this call waits for the account manager's review.")).toBeInTheDocument();
  });

  it("says when the Letter a circle was clicked for has no quote from this call", () => {
    render(
      <CallMeddpiccTab call={callOf(makeCoverage(), makeDetail())} focusLetter="P" onSeek={() => {}} onOpenDeal={() => {}} />,
    );
    expect(screen.getByText(/No quote was kept for Paper Process from this call \(answered\)/)).toBeInTheDocument();
  });
});
