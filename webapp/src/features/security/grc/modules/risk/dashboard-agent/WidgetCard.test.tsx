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
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import WidgetCard from "./WidgetCard";
import type { Widget, WidgetResult } from "./dashboardAgentApi";

vi.mock("@wso2/oxygen-ui-charts-react", () => ({ BarChart: () => <div data-testid="bar-chart" /> }));

const widget: Widget = {
  title: "Approved risks",
  visual: "table",
  spec: { dataset: "risk_list", measures: [], dimensions: [], columns: ["risk_code", "risk_title"], filters: [], limit: 50 },
};
const result: WidgetResult = {
  columns: [
    { id: "risk_code", role: "column", kind: "text", label: "Risk code" },
    { id: "risk_title", role: "column", kind: "text", label: "Title" },
    { id: "risk_id", role: "column", kind: "int", label: "Risk ID" },
  ],
  rows: [["2026-INT-Q4-0002", "Weak TLS", 7], ["2026-INT-Q4-0003", "=1+1", 8]],
  truncated: false,
};

const renderCard = (r: WidgetResult | undefined = result, onNavigate?: () => void) =>
  render(
    <MemoryRouter>
      <WidgetCard widget={widget} result={r} running={false} onNavigate={onNavigate} />
    </MemoryRouter>,
  );

afterEach(() => vi.restoreAllMocks());

describe("WidgetCard", () => {
  it("turns each risk code into a link to that risk and hides the id column", () => {
    renderCard();
    const link = screen.getByRole("link", { name: "2026-INT-Q4-0002" });
    expect(link).toHaveAttribute("href", "/security/risk/registers?riskId=7");
    expect(screen.getByRole("link", { name: "2026-INT-Q4-0003" })).toHaveAttribute("href", "/security/risk/registers?riskId=8");
    expect(screen.queryByRole("columnheader", { name: "Risk ID" })).not.toBeInTheDocument();
    expect(screen.queryByText("7")).not.toBeInTheDocument();
  });

  it("tells the page when a link is followed, so the popup can close", async () => {
    const onNavigate = vi.fn();
    renderCard(result, onNavigate);
    await userEvent.click(screen.getByRole("link", { name: "2026-INT-Q4-0002" }));
    expect(onNavigate).toHaveBeenCalled();
  });




  it("offers no way to copy, export or download the result", () => {
    renderCard();
    for (const name of [/copy/i, /download/i, /export/i, /csv/i]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });

  it("does not show the query behind the widget", () => {
    renderCard();
    expect(screen.queryByText(/"dataset"/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /query/i })).not.toBeInTheDocument();
  });
});
