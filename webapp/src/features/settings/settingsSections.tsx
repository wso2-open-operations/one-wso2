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

import type { ReactNode } from "react";
import { isPreviewEnabled } from "@config/previewFeatures";
import { isAmplifyBackendConfigured } from "@config/apiConfig";
import MyConnectionsSection from "@features/amplify/components/MyConnectionsSection";

/** A block a feature adds to the Settings page. */
export interface SettingsSection {
  /** Stable key, also the anchor id. */
  id: string;
  title: string;
  /** Hidden when false (feature flag off, backend not configured). */
  isAvailable: () => boolean;
  render: () => ReactNode;
}

/**
 * Sections features contribute to Settings, in the order shown. A feature adds one entry here and keeps
 * its UI in its own folder; SettingsPage doesn't know what is inside.
 */
export const settingsSections: readonly SettingsSection[] = [
  {
    id: "my-connections",
    title: "My Connections",
    isAvailable: () => isPreviewEnabled("amplify") && isAmplifyBackendConfigured(),
    render: () => <MyConnectionsSection />,
  },
];

/** The sections to show right now. */
export const availableSettingsSections = (all: readonly SettingsSection[] = settingsSections): SettingsSection[] =>
  all.filter((s) => s.isAvailable());
