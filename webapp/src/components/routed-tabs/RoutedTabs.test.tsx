/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import RoutedTabs, { type RoutedTabDef } from "./RoutedTabs";

/** Longer, in ms, than MUI waits before opening a tooltip on hover. */
const TOOLTIP_SETTLE_MS = 300;

function renderTabs(tabs: RoutedTabDef[]) {
  return render(
    <MemoryRouter initialEntries={["/app/one"]}>
      <RoutedTabs basePath="/app" tabs={tabs} ariaLabel="App screens" />
    </MemoryRouter>,
  );
}

describe("RoutedTabs badges", () => {
  it("shows a tab's badge beside its label, with its reason for screen readers", () => {
    renderTabs([
      { segment: "one", label: "One" },
      { segment: "two", label: "Two", badge: { label: "Set up", reason: "A rule needs setting up." } },
    ]);

    const tab = screen.getByRole("tab", { name: "Two Set up A rule needs setting up." });
    expect(within(tab).getByText("Set up")).toBeTruthy();
  });

  it("shows a badge without a reason with no hover text", async () => {
    renderTabs([{ segment: "one", label: "One", badge: { label: "5" } }]);
    await userEvent.hover(screen.getByText("5"));
    // Past MUI's delay before a tooltip opens, so an absent tooltip means there is none.
    await new Promise((resolve) => setTimeout(resolve, TOOLTIP_SETTLE_MS));

    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(screen.getByRole("tab", { name: "One 5" })).toBeTruthy();
  });

  it("leaves a tab without a badge as its label alone", () => {
    renderTabs([{ segment: "one", label: "One" }]);
    expect(screen.getByRole("tab", { name: "One" })).toBeTruthy();
  });
});
