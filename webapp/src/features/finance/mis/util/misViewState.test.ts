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
import {
  MIS_PERIODS,
  MIS_SCALES,
  MIS_TABLES,
  MIS_WINDOWS,
  type MisAppliedFilters,
  type MisDateRange,
  type MisTable,
  type MisWindow,
} from "./misViewVocabulary";
import {
  allowedTypeValues,
  applyWindow,
  type ApplyWindowContext,
  defaultAppliedFilters,
  defaultYearsBack,
  hydrateAppliedFilters,
  parseViewState,
  searchWithWindow,
  serializeViewState,
  windowFromSearch,
} from "./misViewState";

// The promise this file protects: a view of a Build screen is fully described
// by its URL. Change a filter, copy the address, send it to someone else, and
// they see what you saw. Reload and nothing is lost. A link with a typo in it
// degrades to the default view rather than erroring.
//
// The rules come over from the source app verbatim — digiops-finance
// apps/mis/webapp/src/components/arrDashboard/utils/viewState.js — because the
// two apps run side by side during the parallel period and bookmarked links
// have to keep working against both. Two apps, one URL shape. Where this port
// deliberately departs, the test says so and names the reason.

const { ANNUALLY, QUARTERLY, MONTHLY } = MIS_PERIODS;
const { SUBSCRIPTION, SOFTWARE_CLOUD_CUSTOMERS, EXIT_ARR_BY_REGION, EXIT_ARR_BY_BU } = MIS_TABLES;

/** The query string as a plain object, so an assertion reads as the URL does. */
const params = (search: string) => Object.fromEntries(new URLSearchParams(search));

describe("a default view", () => {
  // Spec §10.1. The rule the whole contract rests on: if a default view wrote
  // parameters, no link could be told from any other and "did this carry a
  // view?" would have no answer.
  it("serialises to an empty query string on each of the three Periods", () => {
    for (const period of [ANNUALLY, QUARTERLY, MONTHLY]) {
      const filters = defaultAppliedFilters(period, SUBSCRIPTION);
      expect(serializeViewState({ period, table: SUBSCRIPTION, filters })).toBe("");
    }
  });

  it("still serialises to nothing when Scale is explicitly at units", () => {
    const filters = defaultAppliedFilters(ANNUALLY, SUBSCRIPTION);
    expect(serializeViewState({ period: ANNUALLY, table: SUBSCRIPTION, scale: MIS_SCALES.UNITS, filters })).toBe("");
  });

  it("holds for every Table, whose own Years Back default is what counts", () => {
    for (const table of [SUBSCRIPTION, SOFTWARE_CLOUD_CUSTOMERS, EXIT_ARR_BY_REGION, EXIT_ARR_BY_BU]) {
      const filters = defaultAppliedFilters(ANNUALLY, table);
      // Only `table` itself is written — Subscription is the implicit default.
      const written = params(serializeViewState({ period: ANNUALLY, table, filters }));
      expect(Object.keys(written).filter((key) => key !== "table")).toEqual([]);
    }
  });
});

describe("Years Back defaults", () => {
  // Region Summary opens on two years where every other Annually table opens on
  // five, so "is this the default?" is a per-Table question. Get it wrong and
  // Region Summary writes `years=2` into every link it produces.
  it("is 5 on Annually, except Region Summary at 2", () => {
    expect(defaultYearsBack(ANNUALLY, SUBSCRIPTION)).toBe(5);
    expect(defaultYearsBack(ANNUALLY, SOFTWARE_CLOUD_CUSTOMERS)).toBe(5);
    expect(defaultYearsBack(ANNUALLY, EXIT_ARR_BY_BU)).toBe(5);
    expect(defaultYearsBack(ANNUALLY, EXIT_ARR_BY_REGION)).toBe(2);
  });

  it("is 1 on Quarterly and Monthly", () => {
    expect(defaultYearsBack(QUARTERLY, SUBSCRIPTION)).toBe(1);
    expect(defaultYearsBack(MONTHLY, EXIT_ARR_BY_REGION)).toBe(1);
  });

  it("makes Region Summary's 2 the omitted value and 5 the written one", () => {
    const base = defaultAppliedFilters(ANNUALLY, EXIT_ARR_BY_REGION);
    expect(params(serializeViewState({ period: ANNUALLY, table: EXIT_ARR_BY_REGION, filters: base })))
      .toEqual({ table: "region-summary" });
    expect(params(serializeViewState({ period: ANNUALLY, table: EXIT_ARR_BY_REGION, filters: { ...base, yearsBack: 5 } })))
      .toEqual({ table: "region-summary", years: "5" });
  });
});

describe("parameter names", () => {
  // Spec §4 lists the contract. A parameter silently renamed or dropped breaks
  // every bookmark someone already holds, and nothing else in the suite would
  // notice — the round-trip tests below would pass on the new name just as
  // happily. So the names themselves are asserted, as a set.
  //
  // No single view writes them all: `window` is Annually-only and `cumulative`
  // is Quarterly/Monthly-only, and `ytd` is suppressed while `window=ttm`. So
  // this is the union over the two Periods it takes to reach every one.
  //
  // The count is 23, where ticket 02 says 22. The difference is `scale`, which
  // §8.2 deliberately does not count as view state — see the test for that
  // below. Nothing is missing; the two counts are counting different things.
  it("are the ones spec §4 documents, and no others", () => {
    const listFilters = {
      salesRegion: ["EMEA"],
      subRegion: ["UK"],
      billingCountry: ["Sri Lanka"],
      shippingCountry: ["France"],
      industry: ["Utilities"],
      subIndustry: ["Water"],
      accountOwner: ["Jane Doe"],
      technicalOwner: ["A B"],
      channelManager: ["E F"],
    };
    const annually = params(serializeViewState({
      period: ANNUALLY,
      table: SOFTWARE_CLOUD_CUSTOMERS,
      scale: MIS_SCALES.THOUSANDS,
      filters: {
        ...defaultAppliedFilters(ANNUALLY, SOFTWARE_CLOUD_CUSTOMERS),
        ...listFilters,
        buProductSelection: "CUSTOM",
        customBusinessUnits: ["APIM_BU"],
        customProductUnits: ["IAM_CLOUD"],
        yearsBack: 3,
        isYtd: false,
        endingMonth: "March",
        arrType: "Closed Won ARR",
        viewType: "Sales Region",
        confidenceLevel: "GM",
        channelDirect: "Direct",
      },
    }));
    const quarterlyTtm = params(serializeViewState({
      period: QUARTERLY,
      table: SUBSCRIPTION,
      filters: { ...defaultAppliedFilters(QUARTERLY, SUBSCRIPTION), cumulativeQuarterly: true },
    }));
    const annuallyTtm = params(serializeViewState({
      period: ANNUALLY,
      table: SUBSCRIPTION,
      viewWindow: MIS_WINDOWS.TTM,
      filters: defaultAppliedFilters(ANNUALLY, SUBSCRIPTION),
    }));

    const written = new Set([
      ...Object.keys(annually),
      ...Object.keys(quarterlyTtm),
      ...Object.keys(annuallyTtm),
    ]);
    expect([...written].sort()).toEqual([
      "billingCountry",
      "channel",
      "channelMgr",
      "confidence",
      "cumulative",
      "customBu",
      "customProduct",
      "endingMonth",
      "industry",
      "owner",
      "region",
      "scale",
      "shippingCountry",
      "subIndustry",
      "subRegion",
      "table",
      "techOwner",
      "type",
      "unit",
      "view",
      "window",
      "years",
      "ytd",
    ]);
  });

  it("are readable words, not the internal filter keys", () => {
    const filters = {
      ...defaultAppliedFilters(ANNUALLY, SUBSCRIPTION),
      salesRegion: ["EMEA"],
      accountOwner: ["Jane Doe"],
      buProductSelection: "SW_APIM",
    };
    // `salesRegion` reaches the URL as `region`, `accountOwner` as `owner`, and
    // the BU/product selection as `unit` — lower-kebab, not the SCREAMING code.
    expect(params(serializeViewState({ period: ANNUALLY, table: SUBSCRIPTION, filters })))
      .toEqual({ region: "EMEA", owner: "Jane Doe", unit: "sw-apim" });
  });
});

describe("the Table parameter", () => {
  it("is a readable slug, and Subscription is never written", () => {
    const at = (table: MisTable) =>
      params(serializeViewState({ period: ANNUALLY, table, filters: defaultAppliedFilters(ANNUALLY, table) }));
    expect(at(SOFTWARE_CLOUD_CUSTOMERS)).toEqual({ table: "customers" });
    expect(at(EXIT_ARR_BY_REGION)).toEqual({ table: "region-summary" });
    expect(at(EXIT_ARR_BY_BU)).toEqual({ table: "bu-summary" });
    expect(at(SUBSCRIPTION)).toEqual({});
  });

  // Subscription is the implicit default, so `table=subscription` is a value
  // this app never wrote. It is read as unknown, exactly like any other slug it
  // does not have — which is what keeps a hand-written one from counting as
  // view state.
  it("reads table=subscription as no Table at all", () => {
    expect(parseViewState("?table=subscription", { period: ANNUALLY })).toMatchObject({
      table: undefined,
      hasViewState: false,
    });
  });
});

describe("the Unit parameter", () => {
  it("writes the selection code as a slug", () => {
    const base = defaultAppliedFilters(ANNUALLY, SUBSCRIPTION);
    expect(params(serializeViewState({ period: ANNUALLY, table: SUBSCRIPTION, filters: { ...base, buProductSelection: "SW_APIM" } })))
      .toEqual({ unit: "sw-apim" });
  });

  // The custom lists are meaningless beside any other selection — they are what
  // "custom" means. Reading them regardless would let `?unit=bu-all&customBu=X`
  // produce a view no control in the app can express.
  it("writes and reads the custom lists only when the Unit is custom", () => {
    const base = defaultAppliedFilters(ANNUALLY, SUBSCRIPTION);
    expect(params(serializeViewState({
      period: ANNUALLY,
      table: SUBSCRIPTION,
      filters: { ...base, buProductSelection: "CUSTOM", customBusinessUnits: ["APIM_BU", "IAM_BU"] },
    }))).toEqual({ unit: "custom", customBu: "APIM_BU,IAM_BU" });

    expect(params(serializeViewState({
      period: ANNUALLY,
      table: SUBSCRIPTION,
      filters: { ...base, buProductSelection: "BU_ALL", customBusinessUnits: ["APIM_BU"] },
    }))).toEqual({});

    expect(parseViewState("?unit=custom&customBu=APIM_BU&customProduct=IAM_CLOUD", { period: ANNUALLY }).filters)
      .toEqual({
        buProductSelection: "CUSTOM",
        customBusinessUnits: ["APIM_BU"],
        customProductUnits: ["IAM_CLOUD"],
      });
    expect(parseViewState("?unit=bu-all&customBu=APIM_BU", { period: ANNUALLY }).filters)
      .toEqual({ buProductSelection: "BU_ALL" });
  });
});

describe("the Type parameter", () => {
  // The Table decides which types exist, so validating against a single global
  // list would restore a view the filter bar cannot show — a Renewal column on
  // a summary table that has no Renewal option.
  it("offers Total and Closed Won only on the summary tables", () => {
    expect(allowedTypeValues(ANNUALLY, EXIT_ARR_BY_REGION)).toEqual(["Total ARR", "Closed Won ARR"]);
    expect(allowedTypeValues(ANNUALLY, EXIT_ARR_BY_BU)).toEqual(["Total ARR", "Closed Won ARR"]);
  });

  it("drops Renewal on Customers and Delayed on the Build", () => {
    expect(allowedTypeValues(ANNUALLY, SOFTWARE_CLOUD_CUSTOMERS))
      .toEqual(["Total ARR", "Closed Won ARR", "Delayed ARR", "Forecasted ARR"]);
    expect(allowedTypeValues(ANNUALLY, SUBSCRIPTION))
      .toEqual(["Total ARR", "Closed Won ARR", "Forecasted ARR", "Renewal ARR"]);
  });

  it("accepts from the URL only what the Table offers", () => {
    const at = (table: string, type: string) =>
      parseViewState(`?table=${table}&type=${type}`, { period: ANNUALLY }).filters.arrType;
    expect(at("region-summary", "Closed+Won+ARR")).toBe("Closed Won ARR");
    expect(at("region-summary", "Renewal+ARR")).toBeUndefined();
    expect(at("bu-summary", "Delayed+ARR")).toBeUndefined();
    expect(at("customers", "Delayed+ARR")).toBe("Delayed ARR");
    expect(at("customers", "Renewal+ARR")).toBeUndefined();
    expect(parseViewState("?type=Renewal+ARR", { period: ANNUALLY }).filters.arrType).toBe("Renewal ARR");
    expect(parseViewState("?type=Delayed+ARR", { period: ANNUALLY }).filters.arrType).toBeUndefined();
  });

  it("uses the Period's own type key and vocabulary", () => {
    expect(parseViewState("?type=Forecasted+QRR", { period: QUARTERLY }).filters)
      .toEqual({ qrrType: "Forecasted QRR" });
    expect(parseViewState("?type=Total+MRR", { period: MONTHLY }).filters)
      .toEqual({ mrrType: "Total MRR" });
    // A QRR value on the Annually screen is a value that Period does not have.
    expect(parseViewState("?type=Total+QRR", { period: ANNUALLY }).filters).toEqual({});
  });

  it("writes the Period's type key back to the same `type` parameter", () => {
    const quarterly = { ...defaultAppliedFilters(QUARTERLY, SUBSCRIPTION), qrrType: "Renewal QRR", cumulativeQuarterly: true };
    expect(params(serializeViewState({ period: QUARTERLY, table: SUBSCRIPTION, filters: quarterly })))
      .toEqual({ type: "Renewal QRR", cumulative: "1" });
    const monthly = { ...defaultAppliedFilters(MONTHLY, SUBSCRIPTION), mrrType: "Delayed MRR", cumulativeMonthly: true };
    expect(params(serializeViewState({ period: MONTHLY, table: SUBSCRIPTION, filters: monthly })))
      .toEqual({ type: "Delayed MRR", cumulative: "1" });
  });
});

describe("a link that does not parse", () => {
  // Spec §10.3. Every one of these is a link somebody can actually produce: a
  // typo, a stale bookmark from before a value was renamed, a chat client that
  // truncated the address.
  it("degrades to the default view rather than erroring", () => {
    const view = parseViewState(
      "?table=pivot&unit=nonsense&scale=millions&years=12&ytd=maybe&type=Bogus+ARR"
        + "&view=Galaxy&channel=Both&region=,,&endingMonth=Smarch&window=rolling&confidence=Certain",
      { period: ANNUALLY },
    );
    expect(view.table).toBeUndefined();
    expect(view.scale).toBeUndefined();
    expect(view.viewWindow).toBeUndefined();
    expect(view.filters).toEqual({});
    expect(view.hasViewState).toBe(false);
  });

  it("refuses Years Back outside 1-10 and anything that is not a number", () => {
    for (const years of ["0", "11", "x", "-1", "2.5", ""]) {
      expect(parseViewState(`?years=${years}`, { period: ANNUALLY }).filters.yearsBack).toBeUndefined();
    }
    expect(parseViewState("?years=1", { period: ANNUALLY }).filters.yearsBack).toBe(1);
    expect(parseViewState("?years=10", { period: ANNUALLY }).filters.yearsBack).toBe(10);
  });

  it("keeps the parameters it does recognise beside the ones it does not", () => {
    const view = parseViewState("?years=3&type=Nonsense&view=Sales+Region", { period: ANNUALLY });
    expect(view.filters).toEqual({ yearsBack: 3, viewType: "Sales Region" });
    expect(view.hasViewState).toBe(true);
  });

  it("ignores a query that is entirely somebody else's", () => {
    expect(parseViewState("", { period: ANNUALLY }).hasViewState).toBe(false);
    expect(parseViewState("?utm_source=mail&fbclid=abc", { period: ANNUALLY }).hasViewState).toBe(false);
  });
});

describe("the YTD parameter", () => {
  // Spec §10.4.
  it("reads both the compact and the spelled-out form", () => {
    expect(parseViewState("?ytd=0", { period: ANNUALLY }).filters.isYtd).toBe(false);
    expect(parseViewState("?ytd=false", { period: ANNUALLY }).filters.isYtd).toBe(false);
    expect(parseViewState("?ytd=1", { period: ANNUALLY }).filters.isYtd).toBe(true);
    expect(parseViewState("?ytd=true", { period: ANNUALLY }).filters.isYtd).toBe(true);
  });

  // A TTM window runs twelve months back from its end date, so year-to-date has
  // nothing to say about it. The parameter is neither written nor read there —
  // written, it would be a promise the screen cannot keep.
  it("is neither written nor read while the Window is TTM", () => {
    const filters = { ...defaultAppliedFilters(ANNUALLY, SUBSCRIPTION), isYtd: false };
    expect(params(serializeViewState({ period: ANNUALLY, table: SUBSCRIPTION, viewWindow: MIS_WINDOWS.TTM, filters })))
      .toEqual({ window: "ttm" });
    expect(parseViewState("?window=ttm&ytd=0", { period: ANNUALLY }).filters.isYtd).toBeUndefined();
  });
});

describe("the Window parameter", () => {
  it("is written only for TTM, never for Calendar", () => {
    const filters = defaultAppliedFilters(ANNUALLY, SUBSCRIPTION);
    expect(serializeViewState({ period: ANNUALLY, table: SUBSCRIPTION, filters })).toBe("");
    expect(serializeViewState({ period: ANNUALLY, table: SUBSCRIPTION, viewWindow: MIS_WINDOWS.CALENDAR, filters })).toBe("");
    expect(params(serializeViewState({ period: ANNUALLY, table: SUBSCRIPTION, viewWindow: MIS_WINDOWS.TTM, filters })))
      .toEqual({ window: "ttm" });
  });

  // Spec §10.5. TTM is a way of cutting an Annually column; Quarterly and
  // Monthly have no such cut, so the parameter is dropped on both sides rather
  // than half-honoured.
  it("is ignored on Quarterly and Monthly", () => {
    expect(parseViewState("?window=ttm", { period: QUARTERLY }).viewWindow).toBeUndefined();
    expect(parseViewState("?window=ttm", { period: MONTHLY }).viewWindow).toBeUndefined();
    expect(parseViewState("?window=ttm", { period: QUARTERLY }).hasViewState).toBe(false);
    expect(serializeViewState({
      period: QUARTERLY,
      table: SUBSCRIPTION,
      viewWindow: MIS_WINDOWS.TTM,
      filters: defaultAppliedFilters(QUARTERLY, SUBSCRIPTION),
    })).toBe("");
  });

  it("reads Calendar as the absence of a Window", () => {
    expect(parseViewState("", { period: ANNUALLY }).viewWindow).toBeUndefined();
    expect(parseViewState("?window=calendar", { period: ANNUALLY }).viewWindow).toBeUndefined();
    expect(parseViewState("?window=ttm", { period: ANNUALLY })).toMatchObject({
      viewWindow: MIS_WINDOWS.TTM,
      hasViewState: true,
    });
  });

  it("keeps the Ending Month across a TTM link", () => {
    const view = parseViewState("?window=ttm&endingMonth=December&years=3", { period: ANNUALLY });
    expect(view.viewWindow).toBe(MIS_WINDOWS.TTM);
    expect(view.filters).toEqual({ yearsBack: 3, endingMonth: "December" });
  });

  describe("read and written on a query string directly", () => {
    // The Period row switches between the Annually Builds and TTM by editing
    // the address, so it needs the Window alone without going through a whole
    // view — and must not drop the filters already in the link while doing it.
    it("reads TTM only from window=ttm", () => {
      expect(windowFromSearch("?window=ttm")).toBe(MIS_WINDOWS.TTM);
      expect(windowFromSearch("window=ttm&endingMonth=June")).toBe(MIS_WINDOWS.TTM);
      expect(windowFromSearch("?endingMonth=June")).toBe(MIS_WINDOWS.CALENDAR);
      expect(windowFromSearch("")).toBe(MIS_WINDOWS.CALENDAR);
    });

    it("sets or clears the Window without dropping the other parameters", () => {
      expect(params(searchWithWindow("?endingMonth=June&years=3", MIS_WINDOWS.TTM)))
        .toEqual({ endingMonth: "June", years: "3", window: "ttm" });
      expect(params(searchWithWindow("?window=ttm&endingMonth=June", MIS_WINDOWS.CALENDAR)))
        .toEqual({ endingMonth: "June" });
      expect(searchWithWindow("", MIS_WINDOWS.CALENDAR)).toBe("");
    });
  });
});

describe("Scale", () => {
  it("is written only at thousands", () => {
    const filters = defaultAppliedFilters(ANNUALLY, SUBSCRIPTION);
    expect(params(serializeViewState({ period: ANNUALLY, table: SUBSCRIPTION, scale: MIS_SCALES.THOUSANDS, filters })))
      .toEqual({ scale: "k" });
    expect(serializeViewState({ period: ANNUALLY, table: SUBSCRIPTION, scale: MIS_SCALES.UNITS, filters })).toBe("");
  });

  // Spec §8.2, reproduced deliberately. The source's own comment is the reason:
  // "Scale is session state, not filter hydration." Scale says how to show the
  // figures, not which figures to show, so a link carrying only `?scale=k` is a
  // link carrying no view — and the screen keeps its own defaults rather than
  // hydrating an empty filter set over them.
  it("is read from the URL but does not make a link count as view state", () => {
    const view = parseViewState("?scale=k", { period: ANNUALLY });
    expect(view.scale).toBe(MIS_SCALES.THOUSANDS);
    expect(view.hasViewState).toBe(false);
    expect(view.table).toBeUndefined();
    expect(view.filters).toEqual({});
  });

  it("does not suppress the view state a link carries alongside it", () => {
    const view = parseViewState("?scale=k&years=3", { period: ANNUALLY });
    expect(view.scale).toBe(MIS_SCALES.THOUSANDS);
    expect(view.hasViewState).toBe(true);
  });
});

describe("a round trip", () => {
  // Spec §10.2. Serialise, parse, hydrate — and land on the same Applied
  // filters. This is the criterion the whole ticket exists for: it is what
  // "send someone the address and they see what you saw" reduces to.
  it("returns identical Applied filters for every parameter of an Annually view", () => {
    const changed = {
      yearsBack: 7,
      arrType: "Closed Won ARR",
      isYtd: false,
      endingMonth: "June",
      viewType: "Sales Region",
      confidenceLevel: "GM",
      channelDirect: "Direct",
      salesRegion: ["EMEA"],
      subRegion: ["UK", "Nordics"],
      billingCountry: ["Sri Lanka", "United States"],
      shippingCountry: ["France"],
      industry: ["Utilities"],
      subIndustry: ["Water"],
      accountOwner: ["Jane Doe"],
      technicalOwner: ["A B", "C D"],
      channelManager: ["E F"],
    } satisfies Partial<MisAppliedFilters>;
    const filters = { ...defaultAppliedFilters(ANNUALLY, EXIT_ARR_BY_BU), ...changed };

    const search = serializeViewState({
      period: ANNUALLY,
      table: EXIT_ARR_BY_BU,
      scale: MIS_SCALES.THOUSANDS,
      filters,
    });
    const view = parseViewState(`?${search}`, { period: ANNUALLY });

    expect(view.table).toBe(EXIT_ARR_BY_BU);
    expect(view.scale).toBe(MIS_SCALES.THOUSANDS);
    expect(hydrateAppliedFilters(view.filters, ANNUALLY, EXIT_ARR_BY_BU)).toEqual(filters);
  });

  it("returns identical Applied filters for a Quarterly view, custom Unit and all", () => {
    const filters = {
      ...defaultAppliedFilters(QUARTERLY, EXIT_ARR_BY_REGION),
      buProductSelection: "CUSTOM",
      customBusinessUnits: ["APIM_BU"],
      customProductUnits: ["APIM_SOFTWARE", "IAM_CLOUD"],
      qrrType: "Closed Won QRR",
      cumulativeQuarterly: true,
      yearsBack: 4,
    };
    const search = serializeViewState({ period: QUARTERLY, table: EXIT_ARR_BY_REGION, filters });
    const view = parseViewState(`?${search}`, { period: QUARTERLY });

    expect(view.table).toBe(EXIT_ARR_BY_REGION);
    expect(hydrateAppliedFilters(view.filters, QUARTERLY, EXIT_ARR_BY_REGION)).toEqual({
      ...filters,
      // The summary tables fetch by `arrType` whatever the Period, so the
      // Period's own type is mirrored there — a derived field, never a
      // parameter.
      arrType: "Closed Won QRR",
    });
  });

  it("returns identical Applied filters for a TTM view", () => {
    const filters = {
      ...defaultAppliedFilters(ANNUALLY, SUBSCRIPTION),
      yearsBack: 3,
      arrType: "Closed Won ARR",
      endingMonth: "June",
    };
    const search = serializeViewState({
      period: ANNUALLY,
      table: SUBSCRIPTION,
      viewWindow: MIS_WINDOWS.TTM,
      filters,
    });
    expect(params(search)).toEqual({ window: "ttm", years: "3", type: "Closed Won ARR", endingMonth: "June" });

    const view = parseViewState(`?${search}`, { period: ANNUALLY });
    expect(view.viewWindow).toBe(MIS_WINDOWS.TTM);
    expect(hydrateAppliedFilters(view.filters, ANNUALLY, SUBSCRIPTION, { viewWindow: view.viewWindow }))
      .toEqual(filters);
  });

  // Derived state is what the filter bar computed on Apply, not what the user
  // chose. In the URL it would be noise at best and a contradiction at worst —
  // a link asserting a forecast mode that disagrees with its own type.
  it("never writes derived or internal fields into the URL", () => {
    const filters = {
      ...defaultAppliedFilters(ANNUALLY, SUBSCRIPTION),
      yearsBack: 3,
      forecast: "Enable",
      annuallyDateRanges: [{ start: "2021/01/01", end: "2021/09/02" }] as MisDateRange[],
    };
    expect(params(serializeViewState({ period: ANNUALLY, table: SUBSCRIPTION, filters }))).toEqual({ years: "3" });
  });
});

describe("hydrating a parsed view", () => {
  it("fills the gaps from the Table's own defaults", () => {
    const hydrated = hydrateAppliedFilters({ yearsBack: 3 }, ANNUALLY, EXIT_ARR_BY_REGION);
    expect(hydrated).toMatchObject({
      yearsBack: 3,
      arrType: "Total ARR",
      viewType: "Global",
      confidenceLevel: "Commit",
      channelDirect: "All",
      isYtd: true,
      endingMonth: "Today (Default)",
      buProductSelection: "BU_ALL",
    });
  });

  it("turns forecast mode on for a Forecasted or Renewal type and off for anything else", () => {
    expect(hydrateAppliedFilters({ arrType: "Forecasted ARR" }, ANNUALLY, SUBSCRIPTION).forecast).toBe("Enable");
    expect(hydrateAppliedFilters({ arrType: "Renewal ARR" }, ANNUALLY, SUBSCRIPTION).forecast).toBe("Enable");
    expect(hydrateAppliedFilters({ arrType: "Closed Won ARR" }, ANNUALLY, SUBSCRIPTION).forecast).toBe("Disable");
    expect(hydrateAppliedFilters({ qrrType: "Forecasted QRR" }, QUARTERLY, SUBSCRIPTION).forecast).toBe("Enable");
  });

  // Spec §8.3, reproduced deliberately. It looks like a bug and reads like one:
  // asking for Delayed on the Customers table silently throws away the five
  // years the screen was showing. It is what the filter bar does today, so a
  // link opened in either app has to land on the same figures.
  it("resets Customers + Delayed to one year, unless the link said otherwise", () => {
    expect(hydrateAppliedFilters({ arrType: "Delayed ARR" }, ANNUALLY, SOFTWARE_CLOUD_CUSTOMERS).yearsBack).toBe(1);
    expect(hydrateAppliedFilters({ arrType: "Delayed ARR", yearsBack: 5 }, ANNUALLY, SOFTWARE_CLOUD_CUSTOMERS).yearsBack)
      .toBe(5);
    // Only that Table, and only that type.
    expect(hydrateAppliedFilters({ arrType: "Closed Won ARR" }, ANNUALLY, SOFTWARE_CLOUD_CUSTOMERS).yearsBack).toBe(5);
    expect(hydrateAppliedFilters({ arrType: "Delayed ARR" }, ANNUALLY, SUBSCRIPTION).yearsBack).toBe(5);
  });

  // The Period's column ranges are computed in Pacific Time, which ticket 05
  // owns. They are injected here rather than imported so this contract can be
  // tested — and shipped — without a timezone in it.
  it("asks for the Period's column ranges only when one is offered", () => {
    const annualRangesFor = vi.fn(() => [{ start: "2026/01/01", end: "2026/09/12" }]);
    const hydrated = hydrateAppliedFilters({ yearsBack: 3 }, ANNUALLY, SUBSCRIPTION, { annualRangesFor });
    expect(annualRangesFor).toHaveBeenCalledWith(MIS_WINDOWS.CALENDAR, expect.objectContaining({ yearsBack: 3 }));
    expect(hydrated.annuallyDateRanges).toEqual([{ start: "2026/01/01", end: "2026/09/12" }]);

    expect(hydrateAppliedFilters({ yearsBack: 3 }, ANNUALLY, SUBSCRIPTION).annuallyDateRanges).toBeUndefined();
  });

  it("asks for TTM ranges when the Window is TTM", () => {
    const annualRangesFor = vi.fn(() => []);
    hydrateAppliedFilters({}, ANNUALLY, SUBSCRIPTION, { viewWindow: MIS_WINDOWS.TTM, annualRangesFor });
    expect(annualRangesFor).toHaveBeenCalledWith(MIS_WINDOWS.TTM, expect.anything());
  });

  it("has no column ranges to compute on Quarterly or Monthly", () => {
    const annualRangesFor = vi.fn(() => []);
    hydrateAppliedFilters({}, QUARTERLY, SUBSCRIPTION, { annualRangesFor });
    hydrateAppliedFilters({}, MONTHLY, SUBSCRIPTION, { annualRangesFor });
    expect(annualRangesFor).not.toHaveBeenCalled();
  });
});

describe("switching the Window", () => {
  const calendar = (overrides: Partial<MisAppliedFilters> = {}) => ({
    ...defaultAppliedFilters(ANNUALLY, SUBSCRIPTION),
    ...overrides,
  });
  const switchTo = (applied: MisAppliedFilters, next: MisWindow, extras: Partial<ApplyWindowContext> = {}) => {
    const context: ApplyWindowContext = {
      period: ANNUALLY,
      table: SUBSCRIPTION,
      fromWindow: MIS_WINDOWS.CALENDAR,
      ...extras,
    };
    return applyWindow(applied, next, context);
  };

  // Spec §10.6. A TTM window has no forecast to show, so the type has to come
  // back to Total rather than silently render a column of nothing.
  it("coerces a Forecasted or Renewal type to Total on the way to TTM", () => {
    const applied = calendar({ arrType: "Forecasted ARR", forecast: "Enable" });
    const next = switchTo(applied, MIS_WINDOWS.TTM);
    expect(next.viewWindow).toBe(MIS_WINDOWS.TTM);
    expect(next.filters.arrType).toBe("Total ARR");
    expect(next.filters.forecast).toBe("Disable");
    expect(switchTo(calendar({ arrType: "Renewal ARR", forecast: "Enable" }), MIS_WINDOWS.TTM).filters.arrType)
      .toBe("Total ARR");
  });

  it("leaves a type that TTM can show exactly where it is", () => {
    expect(switchTo(calendar({ arrType: "Closed Won ARR" }), MIS_WINDOWS.TTM).filters.arrType).toBe("Closed Won ARR");
  });

  it("does not mutate the filters it was handed", () => {
    const applied = calendar({ arrType: "Forecasted ARR", forecast: "Enable" });
    switchTo(applied, MIS_WINDOWS.TTM);
    expect(applied.arrType).toBe("Forecasted ARR");
    expect(applied.forecast).toBe("Enable");
  });

  it("resets YTD on the way to TTM and gives the old value back on the way home", () => {
    const toTtm = switchTo(calendar({ isYtd: false, endingMonth: "March" }), MIS_WINDOWS.TTM);
    expect(toTtm.filters.isYtd).toBe(true);
    expect(toTtm.filters.endingMonth).toBe("March");
    expect(toTtm.remembered).toEqual({ isYtd: false });
    expect(params(serializeViewState({
      period: ANNUALLY, table: SUBSCRIPTION, viewWindow: toTtm.viewWindow, filters: toTtm.filters,
    }))).toEqual({ window: "ttm", endingMonth: "March" });

    const back = switchTo(toTtm.filters, MIS_WINDOWS.CALENDAR, {
      fromWindow: MIS_WINDOWS.TTM,
      remembered: toTtm.remembered,
    });
    expect(back.viewWindow).toBe(MIS_WINDOWS.CALENDAR);
    expect(back.filters.isYtd).toBe(false);
    expect(back.filters.endingMonth).toBe("March");
    expect(back.remembered).toEqual({});
    expect(params(serializeViewState({
      period: ANNUALLY, table: SUBSCRIPTION, viewWindow: back.viewWindow, filters: back.filters,
    }))).toEqual({ ytd: "0", endingMonth: "March" });
  });

  // Switching TTM → TTM would otherwise overwrite the remembered Calendar YTD
  // with the reset value, and the way home would restore the reset instead of
  // what the reader had chosen.
  it("does not overwrite what it remembered when it is already on TTM", () => {
    const remembered = { isYtd: false };
    expect(switchTo(calendar({ endingMonth: "June" }), MIS_WINDOWS.TTM, {
      fromWindow: MIS_WINDOWS.TTM,
      remembered,
    }).remembered).toEqual(remembered);
  });

  it("is a no-op on Quarterly and Monthly, which have no Window to switch", () => {
    const applied = defaultAppliedFilters(QUARTERLY, SUBSCRIPTION);
    const next = applyWindow(applied, MIS_WINDOWS.TTM, { period: QUARTERLY, table: SUBSCRIPTION });
    expect(next.viewWindow).toBe(MIS_WINDOWS.CALENDAR);
    expect(next.filters).toEqual(applied);
    expect(next.remembered).toEqual({});
  });

  it("recomputes the column ranges for the Window it switched to", () => {
    const annualRangesFor = vi.fn(() => []);
    const toTtm = switchTo(calendar({ yearsBack: 3 }), MIS_WINDOWS.TTM, { annualRangesFor });
    expect(annualRangesFor).toHaveBeenCalledWith(MIS_WINDOWS.TTM, expect.objectContaining({ yearsBack: 3 }));

    annualRangesFor.mockClear();
    switchTo(toTtm.filters, MIS_WINDOWS.CALENDAR, {
      fromWindow: MIS_WINDOWS.TTM,
      remembered: toTtm.remembered,
      annualRangesFor,
    });
    expect(annualRangesFor).toHaveBeenCalledWith(MIS_WINDOWS.CALENDAR, expect.anything());
  });

  // The source also mirrors the coerced type into the summaries' `arrType`
  // here. That call can never fire — the mirror is a Quarterly/Monthly rule and
  // both have already returned above — so the port leaves it out. On Annually
  // the mirror is a no-op anyway, because `arrType` IS the Period's type key:
  // coercing it is the same write.
  it("coerces the type on a summary table through its own Period key", () => {
    const coerced = applyWindow(
      { ...defaultAppliedFilters(ANNUALLY, EXIT_ARR_BY_BU), arrType: "Forecasted ARR", forecast: "Enable" },
      MIS_WINDOWS.TTM,
      { period: ANNUALLY, table: EXIT_ARR_BY_BU },
    );
    expect(coerced.filters.arrType).toBe("Total ARR");
    expect(coerced.filters.forecast).toBe("Disable");
  });
});
