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

import type { ReactNode } from "react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { MIS_PERIODS, MIS_SCALES, MIS_TABLES, MIS_WINDOWS, type MisPeriod } from "./misViewVocabulary";
import { useMisViewState, type UseMisViewStateOptions } from "./useMisViewState";

// The URL contract, from the screen's side of it: the Period comes from the
// route, everything else comes from the query string, and what the reader
// changes goes straight back into the address so the link they copy is the view
// they are looking at.

const { ANNUALLY, QUARTERLY } = MIS_PERIODS;

const PERIOD_PATHS: Record<MisPeriod, string> = {
  [ANNUALLY]: "/finance/mis/arr-build",
  [QUARTERLY]: "/finance/mis/qrr-build",
  [MIS_PERIODS.MONTHLY]: "/finance/mis/mrr-build",
};

function renderAt(period: MisPeriod, search: string, options?: UseMisViewStateOptions) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[`${PERIOD_PATHS[period]}${search}`]}>{children}</MemoryRouter>
  );
  return renderHook(
    () => ({ state: useMisViewState(period, options), location: useLocation() }),
    { wrapper },
  );
}

describe("arriving with no query string", () => {
  it("shows the Subscription table on a Calendar Window", () => {
    const { result } = renderAt(ANNUALLY, "");
    expect(result.current.state.table).toBe(MIS_TABLES.SUBSCRIPTION);
    expect(result.current.state.viewWindow).toBe(MIS_WINDOWS.CALENDAR);
  });

  it("hands over a complete Applied set, not the empty one the URL carried", () => {
    const { result } = renderAt(ANNUALLY, "");
    expect(result.current.state.filters).toMatchObject({
      arrType: "Total ARR",
      yearsBack: 5,
      isYtd: true,
      buProductSelection: "BU_ALL",
      forecast: "Disable",
    });
  });

  // What the screen uses to choose between hydrating from the link and keeping
  // whatever the reader last had.
  it("says the link carried no view", () => {
    expect(renderAt(ANNUALLY, "").result.current.state.hasViewState).toBe(false);
    expect(renderAt(ANNUALLY, "?scale=k").result.current.state.hasViewState).toBe(false);
    expect(renderAt(ANNUALLY, "?years=3").result.current.state.hasViewState).toBe(true);
  });
});

describe("arriving on a link", () => {
  it("restores the Table, the Scale and the Applied filters", () => {
    const { result } = renderAt(ANNUALLY, "?table=bu-summary&scale=k&years=3&ytd=0&type=Closed+Won+ARR&region=EMEA,APAC");
    expect(result.current.state.table).toBe(MIS_TABLES.EXIT_ARR_BY_BU);
    expect(result.current.state.scale).toBe(MIS_SCALES.THOUSANDS);
    expect(result.current.state.filters).toMatchObject({
      yearsBack: 3,
      isYtd: false,
      arrType: "Closed Won ARR",
      salesRegion: ["EMEA", "APAC"],
    });
  });

  // The Period is the route, not a parameter, so the same query string means
  // different things on the three Build screens — and a Window that only
  // Annually has is ignored on the other two.
  it("takes the Period from the caller and reads the query against it", () => {
    const annually = renderAt(ANNUALLY, "?window=ttm&type=Total+ARR").result.current.state;
    expect(annually.viewWindow).toBe(MIS_WINDOWS.TTM);

    const quarterly = renderAt(QUARTERLY, "?window=ttm&type=Closed+Won+QRR").result.current.state;
    expect(quarterly.viewWindow).toBe(MIS_WINDOWS.CALENDAR);
    expect(quarterly.filters.qrrType).toBe("Closed Won QRR");
  });

  it("degrades a link it cannot read to the default view", () => {
    const { result } = renderAt(ANNUALLY, "?table=pivot&years=99&type=Nonsense");
    expect(result.current.state.table).toBe(MIS_TABLES.SUBSCRIPTION);
    expect(result.current.state.filters.yearsBack).toBe(5);
    expect(result.current.state.hasViewState).toBe(false);
  });
});

describe("changing the view", () => {
  it("writes the change into the address", () => {
    const { result } = renderAt(ANNUALLY, "");
    act(() => result.current.state.setView({
      filters: { ...result.current.state.filters, yearsBack: 3, viewType: "Sales Region" },
    }));
    expect(result.current.location.search).toBe("?years=3&view=Sales+Region");
    expect(result.current.state.filters.yearsBack).toBe(3);
  });

  it("takes a view back to the defaults by clearing the address entirely", () => {
    const { result } = renderAt(ANNUALLY, "?years=3&view=Sales+Region");
    act(() => result.current.state.setView({ filters: result.current.state.filters }));
    // Hydrated filters that were never changed serialise back to nothing, which
    // is the same rule from the other side: a default view has no query string.
    expect(result.current.location.search).toBe("?years=3&view=Sales+Region");

    act(() => result.current.state.setView({
      filters: { ...result.current.state.filters, yearsBack: 5, viewType: "Global" },
    }));
    expect(result.current.location.search).toBe("");
  });

  // A patch says what changed. Everything it does not mention — the Table the
  // reader is on, the Scale the link arrived with — has to survive, or changing
  // one filter silently resets the rest of the view.
  it("carries over what the patch does not mention", () => {
    const { result } = renderAt(ANNUALLY, "?table=customers&scale=k");
    act(() => result.current.state.setView({
      filters: { ...result.current.state.filters, yearsBack: 3 },
    }));
    expect(result.current.location.search).toBe("?table=customers&years=3&scale=k");
    expect(result.current.state.table).toBe(MIS_TABLES.SOFTWARE_CLOUD_CUSTOMERS);
    expect(result.current.state.scale).toBe(MIS_SCALES.THOUSANDS);
  });

  it("moves between Tables, carrying the Applied set with it", () => {
    const { result } = renderAt(ANNUALLY, "");
    act(() => result.current.state.setView({ table: MIS_TABLES.EXIT_ARR_BY_REGION }));
    expect(result.current.state.table).toBe(MIS_TABLES.EXIT_ARR_BY_REGION);
    // Five years was Subscription's default and is not Region Summary's, so it
    // stops being implicit and gets written down. The filters the reader had do
    // not change under them just because the grid did — which is what the
    // source does too. Whether a Table switch should instead re-default the
    // Applied set is ticket 10's question, not this one's.
    expect(result.current.location.search).toBe("?table=region-summary&years=5");
    expect(result.current.state.filters.yearsBack).toBe(5);
  });
});

describe("switching the Window", () => {
  // Spec §10.6, end to end through the address bar.
  it("coerces a Forecasted type and resets YTD on the way to TTM, and restores YTD on the way back", () => {
    const { result } = renderAt(ANNUALLY, "?ytd=0&type=Forecasted+ARR");
    expect(result.current.state.filters.forecast).toBe("Enable");

    act(() => result.current.state.setWindow(MIS_WINDOWS.TTM));
    expect(result.current.location.search).toBe("?window=ttm");
    expect(result.current.state.viewWindow).toBe(MIS_WINDOWS.TTM);
    expect(result.current.state.filters.arrType).toBe("Total ARR");
    expect(result.current.state.filters.forecast).toBe("Disable");
    expect(result.current.state.filters.isYtd).toBe(true);

    act(() => result.current.state.setWindow(MIS_WINDOWS.CALENDAR));
    expect(result.current.location.search).toBe("?ytd=0");
    expect(result.current.state.viewWindow).toBe(MIS_WINDOWS.CALENDAR);
    expect(result.current.state.filters.isYtd).toBe(false);
  });

  it("keeps the rest of the view across the switch", () => {
    const { result } = renderAt(ANNUALLY, "?table=customers&years=3&region=EMEA&scale=k");
    act(() => result.current.state.setWindow(MIS_WINDOWS.TTM));
    expect(result.current.state.table).toBe(MIS_TABLES.SOFTWARE_CLOUD_CUSTOMERS);
    expect(result.current.state.scale).toBe(MIS_SCALES.THOUSANDS);
    expect(result.current.state.filters).toMatchObject({ yearsBack: 3, salesRegion: ["EMEA"] });
  });

  it("does nothing on a Period that has no Window", () => {
    const { result } = renderAt(QUARTERLY, "?years=3");
    act(() => result.current.state.setWindow(MIS_WINDOWS.TTM));
    expect(result.current.state.viewWindow).toBe(MIS_WINDOWS.CALENDAR);
    expect(result.current.location.search).toBe("?years=3");
  });
});

describe("the Annually column ranges", () => {
  // Computed in Pacific Time, which is ticket 05's. The hook only passes the
  // computer through, so the contract ships without a timezone in it.
  it("are computed by the function the caller supplies", () => {
    const annualRangesFor = vi.fn(() => [{ start: "2026/01/01", end: "2026/09/12" }]);
    const { result } = renderAt(ANNUALLY, "?years=3", { annualRangesFor });
    expect(annualRangesFor).toHaveBeenCalledWith(MIS_WINDOWS.CALENDAR, expect.objectContaining({ yearsBack: 3 }));
    expect(result.current.state.filters.annuallyDateRanges).toEqual([{ start: "2026/01/01", end: "2026/09/12" }]);
  });

  it("are left uncomputed when no computer is supplied", () => {
    expect(renderAt(ANNUALLY, "?years=3").result.current.state.filters.annuallyDateRanges).toBeUndefined();
  });
});
