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

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { STACKED_MONTHS_MARGIN } from "./chartLayout";
import { HBars, InfoHint, Kpi, StackedMonths } from "./dashboardParts";
import { notConvertedText, USD_RATE_HINT } from "./travelCostText";

const chart = vi.hoisted(() => ({ props: undefined as Record<string, unknown> | undefined }));
vi.mock("@wso2/oxygen-ui-charts-react", () => ({
  BarChart: (props: Record<string, unknown>) => {
    chart.props = props;
    return null;
  },
}));

const rows = [
  { label: "Acme Corp", count: 14 },
  { label: "Example Ltd", count: 1 },
  { label: "Contoso", count: 1 },
];

describe("HBars", () => {
  // The count and its share are separate words, so copy-paste and screen readers read "14 88%", not "1488%".
  it("separates the count from its percentage with a real space", () => {
    const { getByTitle } = render(<HBars rows={rows} percent />);
    const row = getByTitle("Acme Corp").parentElement!;
    expect(row.textContent).toContain("14 88%");
    expect(row.textContent).not.toContain("1488%");
  });

  it("shows the count alone without percent", () => {
    const { getByTitle } = render(<HBars rows={rows} />);
    const row = getByTitle("Acme Corp").parentElement!;
    expect(row.textContent?.endsWith("14")).toBe(true);
    expect(row.textContent).not.toContain("%");
  });
});

describe("notConvertedText", () => {
  it("is empty when everything converted", () => {
    expect(notConvertedText([])).toBe("");
  });

  it("names each amount, its currency and its source", () => {
    const text = notConvertedText([
      { source: "invoice", currency: "LKR", amount: 1234500 },
      { source: "card", currency: "EUR", amount: 2300 },
      { source: "claim", currency: "", amount: 15 },
    ]);
    expect(text).toBe("Not converted, left out of the totals: LKR 1,234,500 (Travel Invoices), EUR 2,300.00 (Credit Card Expenses), Unknown currency 15.00 (Expense Claims)");
    expect(text).not.toContain(";");
  });
});

describe("StackedMonths", () => {
  // jsdom can't measure clipping, so check the chart gets the roomy left margin and a six-figure total.
  it("passes the six-figure Y axis margin to the chart", () => {
    expect(STACKED_MONTHS_MARGIN.left).toBeGreaterThanOrEqual(20);
    render(<StackedMonths rows={[{ month: "Jan", a: 800000 }]} series={[{ key: "a", name: "Invoices" }]} />);
    expect(chart.props?.margin).toBe(STACKED_MONTHS_MARGIN);
    expect(chart.props?.data).toEqual([{ month: "Jan", a: 800000 }]);
  });
});

describe("InfoHint", () => {
  it("is a button with an accessible name, so the hint opens on focus", () => {
    const { getByRole } = render(<InfoHint label="How USD is calculated">{USD_RATE_HINT}</InfoHint>);
    expect(getByRole("button", { name: "How USD is calculated" })).toBeTruthy();
  });
});

describe("Kpi", () => {
  it("keeps its label while loading, with a placeholder for the figure and for the note it will have", () => {
    const { getByText, container } = render(<Kpi label="Travels" value="" note=" " loading />);
    expect(getByText("Travels")).toBeTruthy();
    expect(container.querySelectorAll(".MuiSkeleton-root")).toHaveLength(2);
  });
});
