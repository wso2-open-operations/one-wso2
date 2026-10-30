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
import { render, screen } from "@testing-library/react";

vi.mock("@features/amplify/components/MyConnectionsSection", () => ({ default: () => <div>connections card</div> }));
vi.mock("@config/previewFeatures", () => ({ isPreviewEnabled: () => true }));
vi.mock("@config/apiConfig", () => ({ isAmplifyBackendConfigured: () => true }));
vi.mock("@components/perspective-header/PerspectiveHeader", () => ({ default: () => <div /> }));
vi.mock("@config/landingConfig", () => ({
  landingOptions: () => [],
  landingPreference: () => null,
  setLandingPreference: () => {},
}));

import SettingsPage from "./pages/SettingsPage";
import { availableSettingsSections, type SettingsSection } from "./settingsSections";

describe("Settings sections", () => {
  it("lists only the sections whose feature is available", () => {
    const on: SettingsSection = { id: "a", title: "A", isAvailable: () => true, render: () => null };
    const off: SettingsSection = { id: "b", title: "B", isAvailable: () => false, render: () => null };
    expect(availableSettingsSections([on, off]).map((s) => s.id)).toEqual(["a"]);
  });

  it("shows My Connections on the Settings page under its own heading", () => {
    render(<SettingsPage />);
    expect(screen.getByRole("heading", { name: "My Connections" })).toBeTruthy();
    expect(screen.getByText("connections card")).toBeTruthy();
  });
});
