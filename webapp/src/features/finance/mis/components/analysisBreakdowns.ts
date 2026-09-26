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

// What the two breakdowns above the account table are made of, as data.
//
// Ported from digiops-finance `arrAnalysis/analysisFormat.js`
// (`partnerModelSlices`, which that app already has under test) and the
// `industrySeries` memo in `ArrAnalysisDashboard.js:857-877`.
//
// Shaping only — no colours, no marks, no components. The charts read these,
// and so do the companion tables beneath them, which is what keeps the picture
// and the figures beside it from being computed two different ways.
//
// ---- the distinction the source does not draw ------------------------------
//
// **A zero and an absence are different answers, and this module keeps them
// apart.** `POST /exit-arr/search` is asked once per industry, but only for
// industries `GET /app-configs` actually offers; the rest are reported as
// `revenue: 0` with no request made (`arrAnalysisApi.js:266-299`). So a zero bar
// in the source can mean "this industry holds no ARR" or "nobody asked", and the
// chart asserts the first either way. Ticket 14's checklist calls this out as
// the thing that decides what the charts can honestly claim.
//
// Here an industry that was never asked about has `amount: undefined` and
// `asked: false`, and the chart draws no bar for it. It also suppresses
// **Other** — see `industrySeries`.

/**
 * The six industries the source charts, in its order
 * (`ArrAnalysisDashboard.js:64-71`, `INDUSTRY_CHART_ORDER`).
 *
 * Written down rather than read from `GET /app-configs`, because the chart's
 * shape is fixed: six named bars plus Other. The backend's industry list is
 * longer and varies, and is what the Industry FILTER offers.
 *
 * The order is the source's and is kept deliberately, where sorting by amount
 * would arguably read better as a ranking. A fixed order is stable across
 * filter changes, so a reader comparing two narrowings is comparing bars in the
 * same places rather than re-finding each industry; and it is what the running
 * app shows during the parallel period.
 */
export const ANALYSIS_INDUSTRIES = [
  "Finance and Insurance",
  "Public Administration",
  "Information",
  "Health Care and Social Assistance",
  "Retail Trade",
  "Utilities",
] as const;

/** What the tail of the book is called once the six are accounted for. */
export const ANALYSIS_OTHER_INDUSTRY = "Other";

/**
 * Which colour slot a series takes. An ENTITY's slot, fixed for its lifetime —
 * a view where Direct overtakes Channel must not repaint either of them.
 */
export type ChartSlot = 1 | 2;

/** One partner model's share of the book. */
export interface PartnerModelSlice {
  id: string;
  label: string;
  amount: number;
  /** Percentage of the two models' total. */
  share: number;
  slot: ChartSlot;
}

/** The two figures `POST /exit-arr/search` answers, one call per model. */
export interface PartnerModelAmounts {
  channel?: number;
  direct?: number;
  /**
   * Which models were actually asked about — `"Channel"`, `"Direct"`, or both.
   *
   * Carried for the same reason `industrySeries` carries its own: an absent
   * amount has two meanings and only one of them is a fact. The reader narrowed
   * to Direct, so Channel was never asked → the survivor IS the whole view.
   * Both were asked and one read failed → the split is unknowable, and drawing
   * the survivor at 100% would state something about a book half of which never
   * answered.
   */
  asked: ReadonlySet<string>;
}

/**
 * The partner models that hold ARR, each with its share.
 *
 * A model with none is left out, so a view narrowed to one model yields ONE
 * segment reading "all of it is Direct" rather than a second segment too thin
 * to see beside a legend entry for nothing. That is the source's behaviour, and
 * it is also what lets the chart degrade to the single labelled bar the source
 * special-cases by hand.
 *
 * A model that was ASKED about and did not answer yields no segments at all,
 * because a share needs both halves and half a split is not a smaller split, it
 * is a wrong one. A model that was never asked about is simply not part of this
 * view, and the other model's 100% is then true.
 */
export function partnerModelSlices({
  channel,
  direct,
  asked,
}: PartnerModelAmounts): PartnerModelSlice[] {
  // An asked model with no figure is a failed read, and there is no honest
  // chart to draw from half a split.
  if (asked.has("Channel") && channel == null) return [];
  if (asked.has("Direct") && direct == null) return [];

  // Annotated per entry rather than on the array, because an array LITERAL
  // infers `slot: number` from `1` and `2` before anything else happens — it is
  // the inference, not the `.filter`, that widens them.
  const channelSlice: PartnerModelSlice = {
    id: "channel",
    label: "Channel",
    amount: floored(channel),
    share: 0,
    slot: 1,
  };
  const directSlice: PartnerModelSlice = {
    id: "direct",
    label: "Direct",
    amount: floored(direct),
    share: 0,
    slot: 2,
  };
  const models = [channelSlice, directSlice].filter((model) => model.amount > 0);

  const total = models.reduce((sum, model) => sum + model.amount, 0);
  return models.map((model) => ({ ...model, share: (model.amount / total) * 100 }));
}

/** One bar of the industry chart. */
export interface IndustryRow {
  industry: string;
  /**
   * Absent when this industry was never asked about, AND when it was asked and
   * the read failed — neither of which is zero. `asked` and `answered` say
   * which. See the note at the top of this file.
   */
  amount?: number;
  /** Percentage of the whole book. Absent when the total is unknown. */
  share?: number;
  /** False for an industry `GET /app-configs` did not offer. */
  asked: boolean;
  /**
   * False when the question WAS put and no figure came back.
   *
   * The third state, and the one that is easy to miss: `asked` alone separates
   * "nobody asked" from "answered zero" and leaves "asked and failed" filed
   * under whichever branch the coercion happens to take. Both of the absent
   * cases must stay absent; only the reason a reader is given differs.
   */
  answered: boolean;
}

export interface IndustrySeriesInput {
  /** Amount per industry, for the industries that were actually asked about. */
  byIndustry: Readonly<Record<string, number | undefined>>;
  /** Which of the six reached the backend at all. */
  asked: ReadonlySet<string>;
  /** The whole book, from the summary read. Absent when that read failed. */
  totalArr?: number;
}

/**
 * The six industries and Other, in the chart's fixed order.
 *
 * **Other is the total less the six**, not a figure the backend reports — which
 * is why it needs the summary read and vanishes without it. Floored at zero,
 * because the six and the total are seven separate calls and can disagree; a
 * negative Other would draw a bar pointing the wrong way.
 *
 * Other is also suppressed while any of the six is MISSING A FIGURE — whether
 * because it was never asked about or because its read failed. Either way that
 * industry's ARR is still inside the total, so Other would quietly absorb it
 * and overstate itself: a bar claiming to be "everything else" while holding
 * something the chart has a name for.
 */
export function industrySeries({
  byIndustry,
  asked,
  totalArr,
}: IndustrySeriesInput): IndustryRow[] {
  const named: IndustryRow[] = ANALYSIS_INDUSTRIES.map((industry) => {
    const amount = asked.has(industry) ? readAmount(byIndustry[industry]) : undefined;
    return {
      industry,
      amount,
      asked: asked.has(industry),
      // Asked and got a number back. A zero counts; an absence does not.
      answered: asked.has(industry) && amount != null,
    };
  });

  // Every one of the six has a figure. `answered` implies `asked`, so this is
  // the single condition: a member missing for EITHER reason would hand its ARR
  // to Other, which is still inside the total.
  const allAnswered = named.every((row) => row.answered);
  const namedTotal = named.reduce((sum, row) => sum + (row.amount ?? 0), 0);

  const rows =
    allAnswered && totalArr != null
      ? [
          ...named,
          {
            industry: ANALYSIS_OTHER_INDUSTRY,
            amount: Math.max(0, totalArr - namedTotal),
            asked: true,
            answered: true,
          },
        ]
      : named;

  // No total, no whole — so no share. A percentage of the industries that
  // happened to answer would be a different statistic wearing the same label.
  if (totalArr == null || totalArr <= 0) return rows;

  // The denominator is what the CHART SHOWS, not the summary figure. The two
  // are the same number whenever the six fit inside the total — Other is
  // exactly the difference — and they part company when the six EXCEED it,
  // because Other floors at zero. Dividing by `totalArr` there gave shares
  // summing to 180%: seven bars that do not add up, on a chart whose whole job
  // is composition. The source divides by the rows for the same reason
  // (`ArrAnalysisDashboard.js:878-882`).
  const shown = rows.reduce((sum, row) => sum + (row.amount ?? 0), 0);
  if (shown <= 0) return rows;

  return rows.map((row) => ({
    ...row,
    share: row.amount == null ? undefined : (row.amount / shown) * 100,
  }));
}

/**
 * An amount that can be shown as a share: never negative, never `NaN`.
 *
 * The source's `toAmount`. A negative here would make the other model's share
 * exceed 100, which is not a smaller problem than a missing bar.
 */
const floored = (value: number | undefined): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

/**
 * A figure, or nothing — never a zero standing in for one.
 *
 * `undefined` reaches here when a per-industry read FAILED, and coercing that
 * to `0` is exactly the claim this module exists to refuse: a bar saying an
 * industry holds no ARR because the request for it fell over.
 */
const readAmount = (value: number | undefined): number | undefined => {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};
