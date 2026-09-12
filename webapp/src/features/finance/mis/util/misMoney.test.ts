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
import { MIS_SCALES } from "./misViewVocabulary";
import {
  MIS_ROW_LABELS,
  MIS_VALUE_TYPES,
  amountUnitCaption,
  formatMisValue,
  misValueTypeForRow,
} from "./misMoney";

// Spec §3: "Scale never scales counts. The units/thousands control divides
// currency rows only. Enforce this in the formatter, not at call sites."
//
// The Build shows all three kinds of number in the same column, so the rule
// cannot be a caller's responsibility — a rule applied at call sites is a rule
// that will be missed at one.

const { UNITS, THOUSANDS } = MIS_SCALES;
const { CURRENCY, COUNT, PERCENTAGE } = MIS_VALUE_TYPES;

describe("Scale", () => {
  it("divides a currency figure by a thousand", () => {
    expect(formatMisValue(1_234_567.5, CURRENCY, { scale: UNITS })).toBe("1,234,567.50");
    expect(formatMisValue(1_234_567.5, CURRENCY, { scale: THOUSANDS })).toBe("1,234.57");
  });

  it("leaves a headcount alone", () => {
    // 1,234 customers are 1,234 customers whichever way the control is set.
    expect(formatMisValue(1234, COUNT, { scale: UNITS })).toBe("1,234");
    expect(formatMisValue(1234, COUNT, { scale: THOUSANDS })).toBe("1,234");
  });

  it("leaves a percentage alone", () => {
    expect(formatMisValue(87.5, PERCENTAGE, { scale: UNITS })).toBe("87.50");
    expect(formatMisValue(87.5, PERCENTAGE, { scale: THOUSANDS })).toBe("87.50");
  });

  it("carries a negative figure through", () => {
    expect(formatMisValue(-1_234_567.5, CURRENCY, { scale: THOUSANDS })).toBe("-1,234.57");
  });
});

describe("how each kind of number is written", () => {
  it("gives a currency figure two decimal places, or as many as asked for", () => {
    expect(formatMisValue(1_234_567.5, CURRENCY)).toBe("1,234,567.50");
    expect(formatMisValue(1_234_567.5, CURRENCY, { fractionDigits: 0 })).toBe("1,234,568");
  });

  it("gives a count no decimal places at all", () => {
    expect(formatMisValue(1234.6, COUNT)).toBe("1,235");
  });

  it("ignores fractionDigits on anything but currency", () => {
    // It is a currency-precision control. A count asked for two decimals would
    // be a headcount of 1,234.00 people.
    expect(formatMisValue(1234, COUNT, { fractionDigits: 2 })).toBe("1,234");
    expect(formatMisValue(87.5, PERCENTAGE, { fractionDigits: 0 })).toBe("87.50");
  });
});

describe("what is not a number", () => {
  it("shows nothing for a missing figure", () => {
    expect(formatMisValue(null, CURRENCY)).toBe("");
    expect(formatMisValue(undefined, CURRENCY)).toBe("");
  });

  it("passes a string through as the backend wrote it", () => {
    // The ARR backend answers "N/A" and "%" in cells it cannot compute.
    expect(formatMisValue("N/A", CURRENCY, { scale: THOUSANDS })).toBe("N/A");
  });

  it("shows nothing rather than NaN", () => {
    expect(formatMisValue(Number.NaN, CURRENCY)).toBe("");
  });
});

describe("which kind of number a Build row holds", () => {
  it("calls the customer lines counts", () => {
    expect(misValueTypeForRow(MIS_ROW_LABELS.OPENING_CUSTOMERS)).toBe(COUNT);
    expect(misValueTypeForRow(MIS_ROW_LABELS.CLOSING_CUSTOMERS)).toBe(COUNT);
  });

  it("calls the retention and share lines percentages", () => {
    expect(misValueTypeForRow(MIS_ROW_LABELS.YOY_GROWTH)).toBe(PERCENTAGE);
    expect(misValueTypeForRow(MIS_ROW_LABELS.NET_DOLLAR_RETENTION)).toBe(PERCENTAGE);
    expect(misValueTypeForRow(MIS_ROW_LABELS.PERCENT_LOST_LOGOS)).toBe(PERCENTAGE);
  });

  it("calls the movement lines currency", () => {
    expect(misValueTypeForRow(MIS_ROW_LABELS.OPENING_ARR)).toBe(CURRENCY);
    expect(misValueTypeForRow(MIS_ROW_LABELS.LOST)).toBe(CURRENCY);
  });

  it("calls an unknown row currency", () => {
    // Region names, business units and account names are all rows, and all of
    // them hold money.
    expect(misValueTypeForRow("Acme Corporation")).toBe(CURRENCY);
  });
});

describe("the caption above a grid", () => {
  it("states the currency, and the Scale when one applies", () => {
    expect(amountUnitCaption(UNITS)).toBe("All amounts in USD");
    expect(amountUnitCaption(THOUSANDS)).toBe("All amounts in USD '000");
  });
});
