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

import { Outlet } from "react-router";
import type { JSX } from "react";
import DashboardAgentLauncher from "../dashboard-agent/DashboardAgentLauncher";

// Wraps every Risk Hub page. The layout stays mounted while the user moves
// between risk pages, so the dashboard agent's launcher checks once whether it
// is available and then follows the user around the module.
export default function RiskLayout(): JSX.Element {
  return (
    <>
      <Outlet />
      <DashboardAgentLauncher />
    </>
  );
}
