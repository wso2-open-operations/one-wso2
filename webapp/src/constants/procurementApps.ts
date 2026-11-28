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

// Registry of Procurement, surfaced as a group inside the Me perspective.
// Phase 1 rows are things any employee does for themself, so none carries
// `requires`: they stay open the way Credit Card's per-user rows do. The rows
// for approving and assigning join the registry with their own gate when those
// screens land.

import { CheckCheckIcon, ClipboardListIcon, SettingsIcon, ShoppingCartIcon } from "@wso2/oxygen-ui-icons-react";
import type { MenuApp } from "@constants/appMenu";
import { PROCUREMENT_PATH } from "@features/procurement/procurementPaths";
import { workspacePaths } from "@features/procurement/workspace/workspacePaths";

export const PROCUREMENT_ITEM = {
  home: "procurement-home",
} as const;

export const PROCUREMENT_APPS: readonly MenuApp[] = [
  {
    key: "procurement",
    name: "Procurement",
    icon: ShoppingCartIcon,
    purpose: "Raise purchase requests and follow them through approval to Procurement.",
    items: [
      {
        id: PROCUREMENT_ITEM.home,
        label: "Procurement",
        icon: ShoppingCartIcon,
        desc: "Raise purchase requests and follow them through approval to Procurement.",
        path: PROCUREMENT_PATH,
      },
    ],
  },
];

export const PROCUREMENT_WORKSPACE_ITEM = {
  approvals: "procurement-approvals",
  queue: "procurement-team-queue",
  settings: "procurement-settings",
} as const;

/** The rail rows only the Procurement team sees, and Settings only for its admins. Approvals is open to everyone, so the team's role check does not claim it. */
export const PROCUREMENT_TEAM_ITEM_IDS: ReadonlySet<string> = new Set([PROCUREMENT_WORKSPACE_ITEM.queue, PROCUREMENT_WORKSPACE_ITEM.settings]);

/**
 * The Procurement perspective: approvals for anyone a request names as an
 * approver, then the approved requests the team assigns and handles.
 */
export const PROCUREMENT_TEAM_APPS: readonly MenuApp[] = [
  {
    key: "procurement-requests",
    name: "Requests",
    icon: ClipboardListIcon,
    purpose: "Approved purchase requests, to assign and handle.",
    items: [
      {
        id: PROCUREMENT_WORKSPACE_ITEM.queue,
        label: "Requests",
        icon: ClipboardListIcon,
        desc: "Approved purchase requests, to assign and handle.",
        path: workspacePaths.queue,
      },
    ],
  },
  {
    key: "procurement-approvals",
    name: "Approvals",
    icon: CheckCheckIcon,
    purpose: "Approve or reject the purchase requests that name you as an approver.",
    items: [
      {
        id: PROCUREMENT_WORKSPACE_ITEM.approvals,
        label: "Approvals",
        icon: CheckCheckIcon,
        desc: "Approve or reject the purchase requests that name you as an approver.",
        path: workspacePaths.approvals,
      },
    ],
  },
  {
    key: "procurement-settings",
    name: "Settings",
    icon: SettingsIcon,
    purpose: "Choose who can be a budget approver, and the options of the request form.",
    items: [
      {
        id: PROCUREMENT_WORKSPACE_ITEM.settings,
        label: "Settings",
        icon: SettingsIcon,
        desc: "Choose who can be a budget approver, and the options of the request form.",
        path: workspacePaths.settings,
      },
    ],
  },
];
