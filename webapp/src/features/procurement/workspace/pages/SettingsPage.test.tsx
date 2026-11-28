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
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Navigate, Route, Routes } from "react-router";
import SettingsPage from "./SettingsPage";
import { workspacePaths } from "../workspacePaths";

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/procurement/settings" element={<SettingsPage />}>
          <Route index element={<Navigate to="budget-approvers" replace />} />
          <Route path="budget-approvers" element={<p>Approvers section</p>} />
          <Route path="options" element={<p>Options section</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

describe("SettingsPage", () => {
  it("opens the budget approvers when no section is in the address", () => {
    renderAt(workspacePaths.settings);
    expect(screen.getByText("Approvers section")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Budget approvers" })).toHaveAttribute("aria-selected", "true");
  });

  it("makes each tab a link to its own address, and shows the section that address names", async () => {
    const user = userEvent.setup();
    renderAt(workspacePaths.settingsOptions);
    expect(screen.getByText("Options section")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Form options" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Budget approvers" })).toHaveAttribute("href", workspacePaths.settingsBudgetApprovers);
    await user.click(screen.getByRole("tab", { name: "Budget approvers" }));
    expect(screen.getByText("Approvers section")).toBeInTheDocument();
  });
});
