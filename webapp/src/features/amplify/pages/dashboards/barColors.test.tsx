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
import { render } from "@testing-library/react";
import type { ScorecardMeasure } from "../../api/amplifyTypes";
import { Bar } from "../../components/DashboardParts";
import { AMPLIFY_BAR } from "../../config/themeConfig";
import { MeasureBar } from "./ScorecardBoard";

const measure = (status: ScorecardMeasure["status"]): ScorecardMeasure => ({
  key: "connected",
  label: "Connected",
  unit: "PERCENT",
  value: 40,
  target: 50,
  comparison: "AT_LEAST",
  status,
});

/** The first child of a bar's track is its fill. */
function fillColor(container: HTMLElement, selector: string): string {
  const fill = container.querySelector(selector)?.firstElementChild as HTMLElement;
  return getComputedStyle(fill).backgroundColor;
}

function rgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
}

describe("Amplify bar colours", () => {
  it("keeps the two colours the dashboards share", () => {
    expect(AMPLIFY_BAR).toEqual({ positive: "#089c2f", negative: "#d92c16" });
  });

  it("paints an on-track scorecard measure positive", () => {
    const { container } = render(<MeasureBar measure={measure("ON_TRACK")} />);
    expect(fillColor(container, '[role="progressbar"]')).toBe(rgb(AMPLIFY_BAR.positive));
  });

  it("paints a measure below target negative", () => {
    const { container } = render(<MeasureBar measure={measure("WATCH")} />);
    expect(fillColor(container, '[role="progressbar"]')).toBe(rgb(AMPLIFY_BAR.negative));
  });

  it("paints the shared Bar positive unless told otherwise", () => {
    const { container } = render(<Bar fraction={0.5} label="half" />);
    expect(fillColor(container, '[role="img"]')).toBe(rgb(AMPLIFY_BAR.positive));
  });
});
