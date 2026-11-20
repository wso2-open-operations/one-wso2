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

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WidgetPreview from "./WidgetPreview";
import type { ResultColumn, Widget, WidgetResult } from "./dashboardAgentApi";

// The chart library needs a real layout engine; what matters here is the data
// handed to it.
vi.mock("@wso2/oxygen-ui-charts-react", () => ({
  BarChart: ({ data, bars }: { data: unknown[]; bars: { name: string }[] }) => (
    <div data-testid="bar-chart">
      {data.length} bars / {bars.map((b) => b.name).join(",")}
    </div>
  ),
}));

const dim = (id: string, label: string, kind = "text"): ResultColumn => ({ id, role: "dimension", kind, label });
const measure = (id: string, label: string, kind = "int"): ResultColumn => ({ id, role: "measure", kind, label });
const widget = (visual: Widget["visual"]): Widget => ({
  title: "t",
  visual,
  spec: { dataset: "risks", measures: ["risk_count"], dimensions: [], filters: [], limit: 100 },
});
const res = (columns: ResultColumn[], rows: WidgetResult["rows"], truncated = false): WidgetResult => ({
  columns,
  rows,
  truncated,
});

describe("WidgetPreview", () => {
  it("says nothing matches, without hinting why, when there are no rows", () => {
    render(<WidgetPreview widget={widget("bar")} result={res([dim("team", "Team"), measure("risk_count", "Risks")], [])} />);
    expect(screen.getByText(/no data matches this view for the access you have/i)).toBeInTheDocument();
  });

  it("draws a number tile", () => {
    render(<WidgetPreview widget={widget("kpi")} result={res([measure("risk_count", "Number of risks")], [[42]])} />);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Number of risks")).toBeInTheDocument();
  });

  it("draws a bar chart from one dimension", () => {
    render(
      <WidgetPreview
        widget={widget("bar")}
        result={res([dim("team", "Team"), measure("risk_count", "Risks")], [["A", 2], ["B", 5]])}
      />,
    );
    expect(screen.getByTestId("bar-chart")).toHaveTextContent("2 bars / Risks");
  });

  it("draws a heat map grid with the counts in the cells", () => {
    render(
      <WidgetPreview
        widget={widget("heatmap")}
        result={res(
          [dim("l", "Likelihood", "int"), dim("i", "Impact", "int"), measure("risk_count", "Risks")],
          [[1, 1, 4], [3, 3, 2]],
        )}
      />,
    );
    expect(screen.getByTestId("cell-1-1")).toHaveTextContent("4");
    expect(screen.getByTestId("cell-3-3")).toHaveTextContent("2");
    expect(screen.getByTestId("cell-3-1")).toHaveTextContent("—");
  });

  it("draws a table and formats rates as percentages", () => {
    render(
      <WidgetPreview
        widget={widget("table")}
        result={res(
          [dim("feature", "Suggestion type"), measure("acceptance_rate", "Acceptance rate", "number")],
          [["CATEGORY", 0.5]],
        )}
      />,
    );
    expect(screen.getByRole("columnheader", { name: "Suggestion type" })).toBeInTheDocument();
    expect(screen.getByText("50.0%")).toBeInTheDocument();
  });

  it("falls back to a table when the data does not fit the visual", () => {
    render(<WidgetPreview widget={widget("bar")} result={res([measure("risk_count", "Risks")], [[7]])} />);
    expect(screen.queryByTestId("bar-chart")).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Risks" })).toBeInTheDocument();
  });

  it("says when only the first rows are shown", () => {
    render(
      <WidgetPreview widget={widget("table")} result={res([dim("team", "Team"), measure("risk_count", "Risks")], [["A", 1]], true)} />,
    );
    expect(screen.getByText(/showing the first 1 rows/i)).toBeInTheDocument();
  });

  it("draws a list of risks as a table with the catalog's column names", () => {
    render(
      <WidgetPreview
        widget={widget("table")}
        result={res(
          [
            { id: "risk_code", role: "column", kind: "text", label: "Risk code" },
            { id: "risk_title", role: "column", kind: "text", label: "Title" },
          ],
          [["2026-ASG-Q4-0001", "Weak TLS"], ["2026-ASG-Q4-0002", null]],
        )}
      />,
    );
    expect(screen.getByRole("columnheader", { name: "Risk code" })).toBeInTheDocument();
    expect(screen.getByText("2026-ASG-Q4-0001")).toBeInTheDocument();
    expect(screen.getByText("Weak TLS")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("leaves out its own truncation note when told a summary already says it", () => {
    render(
      <WidgetPreview
        widget={widget("table")}
        hideTruncatedNote
        result={res([dim("team", "Team"), measure("risk_count", "Risks")], [["A", 1]], true)}
      />,
    );
    expect(screen.queryByText(/showing the first/i)).not.toBeInTheDocument();
  });
});
