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
import { cellText, toBarModel, toGridModel } from "./format";
import type { ResultColumn, WidgetResult } from "./dashboardAgentApi";

const dim = (id: string, label = id, kind = "text"): ResultColumn => ({ id, role: "dimension", kind, label });
const measure = (id: string, label = id, kind = "int"): ResultColumn => ({ id, role: "measure", kind, label });
const result = (columns: ResultColumn[], rows: WidgetResult["rows"]): WidgetResult => ({ columns, rows, truncated: false });

describe("cellText", () => {
  it("shows a dash for a missing value", () => {
    expect(cellText(measure("risk_count"), null)).toBe("—");
    expect(cellText(dim("team"), "")).toBe("—");
  });
  it("formats rates as percentages and other numbers plainly", () => {
    expect(cellText(measure("acceptance_rate", "Rate", "number"), 0.4567)).toBe("45.7%");
    expect(cellText(measure("avg_residual_rating", "Avg", "number"), 2.456)).toBe("2.46");
    expect(cellText(measure("risk_count"), 1200)).toBe((1200).toLocaleString());
  });
});

describe("toBarModel", () => {
  it("makes one bar per value with a series per measure", () => {
    const m = toBarModel(
      result(
        [dim("team", "Team"), measure("risk_count", "Risks"), measure("avg", "Average", "number")],
        [["Choreo", 3, 2.5], [null, 1, 1]],
      ),
    )!;
    expect(m.xKey).toBe("team");
    expect(m.series).toEqual([{ key: "risk_count", name: "Risks" }, { key: "avg", name: "Average" }]);
    expect(m.data).toEqual([{ team: "Choreo", risk_count: 3, avg: 2.5 }, { team: "—", risk_count: 1, avg: 1 }]);
  });

  it("makes a series per value of the second dimension", () => {
    const m = toBarModel(
      result(
        [dim("team"), dim("quarter"), measure("risk_count")],
        [["A", "Q1", 2], ["A", "Q2", 3], ["B", "Q1", 1]],
      ),
    )!;
    expect(m.series.map((s) => s.key)).toEqual(["Q1", "Q2"]);
    expect(m.data).toEqual([{ team: "A", Q1: 2, Q2: 3 }, { team: "B", Q1: 1 }]);
  });

  it("is not a bar chart without rows or without a dimension", () => {
    expect(toBarModel(result([dim("team"), measure("risk_count")], []))).toBeNull();
    expect(toBarModel(result([measure("risk_count")], [[3]]))).toBeNull();
  });
});

describe("toGridModel", () => {
  const r = result(
    [dim("likelihood", "Likelihood", "int"), dim("impact", "Impact", "int"), measure("risk_count", "Risks")],
    [[1, 1, 4], [3, 3, 2], [3, 1, 1]],
  );

  it("puts the highest number at the top and the lowest on the left", () => {
    const g = toGridModel(r)!;
    expect(g.rows).toEqual(["3", "1"]);
    expect(g.cols).toEqual(["1", "3"]);
    expect(g.rowTitle).toBe("Likelihood");
    expect(g.colTitle).toBe("Impact");
  });

  it("reads each cell and scales its colour against the largest", () => {
    const g = toGridModel(r)!;
    expect(g.text("1", "1")).toBe("4");
    expect(g.text("3", "3")).toBe("2");
    expect(g.text("1", "3")).toBe("—"); // no risks there
    expect(g.intensity("1", "1")).toBe(1);
    expect(g.intensity("3", "3")).toBe(0.5);
    expect(g.intensity("1", "3")).toBe(0);
  });

  it("is not a grid unless there are two dimensions and one measure", () => {
    expect(toGridModel(result([dim("a"), measure("m")], [["x", 1]]))).toBeNull();
    expect(toGridModel(result([dim("a"), dim("b"), measure("m"), measure("n")], []))).toBeNull();
  });
});
