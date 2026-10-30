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

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HowWinnersAreChosen from "./HowWinnersAreChosen";

describe("HowWinnersAreChosen", () => {
  it("states the minimum, the top spots and the tie-break note", () => {
    render(<HowWinnersAreChosen minPoints={100} topN={3} />);
    const section = screen.getByRole("region", { name: "How monthly winners are chosen" });
    expect(within(section).getByText("Minimum to qualify.")).toBeTruthy();
    expect(within(section).getByText("Earn at least 100 points in the month.")).toBeTruthy();
    expect(within(section).getByText("Recognized every month.")).toBeTruthy();
    expect(within(section).getByText("The top 3 advocates are celebrated.")).toBeTruthy();
    expect(within(section).getByText(/further evaluation will be conducted based on post reach/)).toBeTruthy();
  });

  it("follows the configured minimum", () => {
    render(<HowWinnersAreChosen minPoints={250} topN={3} />);
    expect(screen.getByText("Earn at least 250 points in the month.")).toBeTruthy();
  });
});
