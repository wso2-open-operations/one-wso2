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

// The Procurement perspective's routes, as one fragment for App.tsx, which mounts it
// only while the `procurement` preview flag is on.

import { Navigate, Route } from "react-router";
import PerspectiveLanding from "@components/perspective-landing/PerspectiveLanding";
import TeamOnlyRoute from "./components/TeamOnlyRoute";
import ApprovalReviewPage from "./pages/ApprovalReviewPage";
import ApprovalsPage from "./pages/ApprovalsPage";
import BudgetApproversSettings from "./components/BudgetApproversSettings";
import ReferenceOptionsSettings from "./components/ReferenceOptionsSettings";
import SettingsPage from "./pages/SettingsPage";
import TeamQueuePage from "./pages/TeamQueuePage";
import TeamRequestPage from "./pages/TeamRequestPage";
import WorkspacePage from "./pages/WorkspacePage";
import { WORKSPACE_PATH } from "./workspacePaths";

// Approvals is open to everyone: the backend lists only the requests that name the caller, and
// checks again on every decision. The queue and the handling page are for the Procurement team,
// whose role TeamOnlyRoute checks; the backend checks it again on every call. Settings is
// for the team's admins.
export const procurementWorkspaceRoutes = (
  <Route path={WORKSPACE_PATH.replace(/^\//, "")} element={<WorkspacePage />}>
    <Route index element={<PerspectiveLanding />} />
    <Route path="approvals" element={<ApprovalsPage />} />
    <Route path="approvals/:requestId" element={<ApprovalReviewPage />} />
    <Route element={<TeamOnlyRoute />}>
      <Route path="requests" element={<TeamQueuePage />} />
      <Route path="requests/:requestId" element={<TeamRequestPage />} />
    </Route>
    <Route element={<TeamOnlyRoute adminOnly />}>
      <Route path="settings" element={<SettingsPage />}>
        <Route index element={<Navigate to="budget-approvers" replace />} />
        <Route path="budget-approvers" element={<BudgetApproversSettings />} />
        <Route path="options" element={<ReferenceOptionsSettings />} />
      </Route>
    </Route>
    <Route path="*" element={<Navigate to={WORKSPACE_PATH} replace />} />
  </Route>
);
