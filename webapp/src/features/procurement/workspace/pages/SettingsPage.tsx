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

import { Link as RouterLink, Outlet, useLocation } from "react-router";
import { Tab, Tabs } from "@wso2/oxygen-ui";
import { workspacePaths } from "../workspacePaths";

const SECTIONS = [
  { path: workspacePaths.settingsBudgetApprovers, label: "Budget approvers" },
  { path: workspacePaths.settingsOptions, label: "Form options" },
] as const;

/** What a Procurement admin keeps for the request form: who the budget approvers are, and the options of its lists. Each section is its own route. */
export default function SettingsPage() {
  const { pathname } = useLocation();
  const current = SECTIONS.find((s) => pathname.startsWith(s.path))?.path ?? false;
  return (
    <>
      <Tabs value={current} aria-label="Settings" sx={{ mb: 2.5, borderBottom: 1, borderColor: "divider" }}>
        {SECTIONS.map((s) => (
          <Tab key={s.path} value={s.path} label={s.label} component={RouterLink} to={s.path} />
        ))}
      </Tabs>
      <Outlet />
    </>
  );
}
