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

import { describe, expect, it } from "vitest";
import {
  ANALYSIS_INDUSTRIES,
  industrySeries,
  partnerModelSlices,
} from "./analysisBreakdowns";

// What the two breakdowns above the account table are made of.
//
// Ported from digiops-finance `arrAnalysis/analysisFormat.js`
// (`partnerModelSlices`) and the `industrySeries` memo in
// `ArrAnalysisDashboard.js:863-883`.
//
// The thing both of these are really about is **the difference between a zero
// and an absence**, which the source does not draw anywhere. `POST
// /exit-arr/search` is asked once per industry, but only for industries the
// backend actually offers — the rest are reported as `revenue: 0` with no
// request made (`arrAnalysisApi.js:266-299`). So a zero bar in the source can
// mean "this industry holds no ARR" or "nobody asked", and the chart states the
// first either way.

/** Both models asked about — the ordinary case, and the default below. */
const BOTH: ReadonlySet<string> = new Set(["Channel", "Direct"]);

describe("partnerModelSlices", () => {
  it("splits the book between the two partner models", () => {
    const slices = partnerModelSlices({ channel: 300, direct: 700, asked: BOTH });
    expect(slices.map((slice) => slice.label)).toEqual(["Channel", "Direct"]);
    expect(slices.map((slice) => slice.share)).toEqual([30, 70]);
    expect(slices.map((slice) => slice.amount)).toEqual([300, 700]);
  });

  // The source's behaviour, and worth keeping: a view narrowed to one partner
  // model should read "all of it is Channel", not "Channel 100%, Direct 0%"
  // with a segment too thin to see and a legend entry for nothing.
  it("drops a model holding no ARR, so a one-model view is one segment", () => {
    const slices = partnerModelSlices({ channel: 0, direct: 1234, asked: BOTH });
    expect(slices).toHaveLength(1);
    expect(slices[0]).toMatchObject({ label: "Direct", share: 100, amount: 1234 });
  });

  it("has no segments at all when there is no ARR", () => {
    expect(partnerModelSlices({ channel: 0, direct: 0, asked: BOTH })).toEqual([]);
  });

  // Each model keeps its own colour slot whatever its size — the whole point of
  // assigning colour by entity. A view where Direct overtakes Channel must not
  // repaint either of them.
  it("gives each model a fixed slot, not one based on which is larger", () => {
    const channelLed = partnerModelSlices({ channel: 900, direct: 100, asked: BOTH });
    const directLed = partnerModelSlices({ channel: 100, direct: 900, asked: BOTH });
    const slotOf = (slices: ReturnType<typeof partnerModelSlices>, label: string) =>
      slices.find((slice) => slice.label === label)?.slot;
    expect(slotOf(channelLed, "Channel")).toBe(slotOf(directLed, "Channel"));
    expect(slotOf(channelLed, "Direct")).toBe(slotOf(directLed, "Direct"));
    expect(slotOf(channelLed, "Channel")).not.toBe(slotOf(channelLed, "Direct"));
  });

  // A negative amount is not a share of anything, and would make the other
  // model's share exceed 100. The source floors at zero for the same reason.
  it("floors a negative or unreadable amount rather than inverting a share", () => {
    expect(partnerModelSlices({ channel: -50, direct: 100, asked: BOTH })).toEqual([
      expect.objectContaining({ label: "Direct", share: 100 }),
    ]);
    expect(partnerModelSlices({ channel: undefined, direct: 100, asked: new Set(["Direct"]) })).toHaveLength(1);
  });

  // "We could not ask" is not "there is none". A failed read leaves the whole
  // split unknowable, because a share needs both halves.
  it("reports nothing when either half never arrived", () => {
    expect(partnerModelSlices({ channel: undefined, direct: undefined, asked: BOTH })).toEqual([]);
  });

  // The case that separates "not asked" from "asked and failed", and the one
  // this whole module is supposed to be about. Both arrive as an absent amount,
  // and drawing the survivor at 100% is a confident claim about a book half of
  // which never answered.
  it("draws no split at all when a model was asked and did not answer", () => {
    expect(partnerModelSlices({ channel: undefined, direct: 700, asked: BOTH })).toEqual([]);
    expect(partnerModelSlices({ channel: 300, direct: undefined, asked: BOTH })).toEqual([]);
  });

  // Where a model was never asked about, the absence is a FACT — the reader
  // narrowed to the other one — so the survivor really is the whole of the view.
  it("draws one segment when the other model was never asked about", () => {
    const slices = partnerModelSlices({ direct: 700, asked: new Set(["Direct"]) });
    expect(slices).toEqual([expect.objectContaining({ label: "Direct", share: 100 })]);
  });
});

describe("industrySeries", () => {
  const asked = new Set(ANALYSIS_INDUSTRIES);

  /**
   * What the backend actually sends: a figure for every industry that was
   * asked about, zero included. An asked industry with NO figure means the read
   * failed, which is a different case and has its own tests below — so a
   * fixture that left one out was quietly testing that case by accident.
   */
  const answers = (over: Record<string, number> = {}) =>
    Object.fromEntries(ANALYSIS_INDUSTRIES.map((industry) => [industry, over[industry] ?? 0]));

  it("keeps the source's six industries in the source's order", () => {
    const rows = industrySeries({ byIndustry: answers(), asked, totalArr: 0 });
    expect(rows.slice(0, 6).map((row) => row.industry)).toEqual([...ANALYSIS_INDUSTRIES]);
  });

  // "Other" is not a seventh industry the backend reports — it is whatever the
  // total holds that the six do not, which is why it needs the summary figure.
  it("makes Other the total less the six named industries", () => {
    const rows = industrySeries({
      byIndustry: answers({ Information: 400, Utilities: 100 }),
      asked,
      totalArr: 1000,
    });
    expect(rows.at(-1)).toMatchObject({ industry: "Other", amount: 500 });
  });

  // The shares are of what the CHART SHOWS, not of the summary figure — which
  // are the same number whenever the six fit inside the total, and are not when
  // they do not. Dividing by `totalArr` gave 90/90/0 summing to 180%: seven
  // bars whose shares do not add up, on a chart whose whole job is composition.
  // The source divides by `topTotal + other` for this reason
  // (`ArrAnalysisDashboard.js:878-882`).
  it("takes shares of the rows shown, so they always add to 100%", () => {
    const rows = industrySeries({
      byIndustry: answers({ Information: 900, Utilities: 900 }),
      asked,
      totalArr: 1000,
    });
    expect(rows.find((row) => row.industry === "Information")?.share).toBe(50);
    expect(rows.find((row) => row.industry === "Utilities")?.share).toBe(50);
    expect(rows.reduce((sum, row) => sum + (row.share ?? 0), 0)).toBeCloseTo(100);
  });

  // The six are asked for separately and the total is asked for once, so they
  // can disagree — a filter that moved between calls, or a backend rounding.
  // A negative Other would draw a bar pointing the wrong way.
  it("floors Other at zero when the six exceed the total", () => {
    const rows = industrySeries({
      byIndustry: answers({ Information: 9_000 }),
      asked,
      totalArr: 1_000,
    });
    expect(rows.at(-1)).toMatchObject({ industry: "Other", amount: 0 });
  });

  it("reads each industry's share of the whole", () => {
    const rows = industrySeries({
      byIndustry: answers({ Information: 250, Utilities: 250 }),
      asked,
      totalArr: 1000,
    });
    expect(rows.find((row) => row.industry === "Information")?.share).toBe(25);
    expect(rows.at(-1)?.share).toBe(50);
  });

  // THE finding this module exists for. The source reports an industry the
  // backend does not offer as `revenue: 0` without ever asking, so its chart
  // states "this industry holds no ARR" on the strength of a question nobody
  // put. Here an un-asked industry has no amount at all.
  it("tells an industry that holds nothing from one that was never asked about", () => {
    const rows = industrySeries({
      byIndustry: { Information: 0 },
      asked: new Set(["Information"]),
      totalArr: 1000,
    });
    expect(rows.find((row) => row.industry === "Information")).toMatchObject({
      amount: 0,
      asked: true,
    });
    expect(rows.find((row) => row.industry === "Utilities")).toMatchObject({
      amount: undefined,
      asked: false,
    });
  });

  // An un-asked industry cannot be counted against the total either, so Other
  // would silently absorb it and overstate itself. Better to have no Other.
  it("has no Other while any of the six went unasked", () => {
    const rows = industrySeries({
      byIndustry: { Information: 400 },
      asked: new Set(["Information"]),
      totalArr: 1000,
    });
    expect(rows.some((row) => row.industry === "Other")).toBe(false);
  });

  // Ticket 13's rule, one chart along: a figure that never arrived is not zero.
  // Without the total there is no whole to take a share of, and no Other.
  it("reports amounts but no shares when the total never arrived", () => {
    const rows = industrySeries({
      byIndustry: answers({ Information: 400 }),
      asked,
      totalArr: undefined,
    });
    expect(rows.find((row) => row.industry === "Information")?.amount).toBe(400);
    expect(rows.every((row) => row.share === undefined)).toBe(true);
    expect(rows.some((row) => row.industry === "Other")).toBe(false);
  });

  // Same family as the partner split's, and the same trap: `asked` was carried
  // to separate "never asked" from "answered zero", and an industry that WAS
  // asked and whose read FAILED fell into neither — coercing to a confident 0.
  it("tells an industry that answered zero from one whose read failed", () => {
    const rows = industrySeries({
      byIndustry: { ...answers({ Information: 0 }), Utilities: undefined },
      asked,
      totalArr: 1000,
    });
    expect(rows.find((row) => row.industry === "Information")).toMatchObject({
      amount: 0,
      asked: true,
      answered: true,
    });
    expect(rows.find((row) => row.industry === "Utilities")).toMatchObject({
      amount: undefined,
      asked: true,
      answered: false,
    });
  });

  // Other is the total less the six, so a six that is missing one of its
  // members would hand the shortfall to Other and overstate it — the same
  // reason an un-asked industry suppresses it.
  it("has no Other while an asked industry has not answered", () => {
    const rows = industrySeries({
      byIndustry: { ...answers({ Information: 400 }), Utilities: undefined },
      asked,
      totalArr: 1000,
    });
    expect(rows.some((row) => row.industry === "Other")).toBe(false);
  });

  it("has no shares rather than dividing by a total of zero", () => {
    const rows = industrySeries({ byIndustry: answers(), asked, totalArr: 0 });
    expect(rows.every((row) => row.share === undefined)).toBe(true);
  });
});
