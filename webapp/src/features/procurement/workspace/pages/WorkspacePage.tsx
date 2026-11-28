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

import { Outlet, useLocation } from "react-router";
import { workspacePaths } from "../workspacePaths";
import ProcurementShell from "../../components/ProcurementShell";

const APPROVALS = {
  title: "Approvals",
  subtitle: "Review the purchase requests that name you as an approver, then approve or reject them.",
};
const REQUESTS = {
  title: "Procurement requests",
  subtitle: "Approved purchase requests, to assign and handle.",
};

const SETTINGS = {
  title: "Procurement settings",
  subtitle: "Choose who can be a budget approver, and the options that requesters pick from on the request form.",
};

/** The frame of the Procurement perspective's screens, worded for the screen the person is on. */
export default function WorkspacePage() {
  const { pathname } = useLocation();
  const { title, subtitle } = pathname.startsWith(workspacePaths.approvals)
    ? APPROVALS
    : pathname.startsWith(workspacePaths.settings)
      ? SETTINGS
      : REQUESTS;
  return (
    <ProcurementShell title={title} subtitle={subtitle}>
      <Outlet />
    </ProcurementShell>
  );
}
