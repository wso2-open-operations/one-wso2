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

// The Procurement rail registry — the information architecture of the purchasing
// app, in One WSO2's MenuApp shape.
//
// Transcribed from the standalone app's lib/nav/navModel.ts, keeping its grouping
// and its gating intent. The `requires` field the rest of the portal uses is
// deliberately ABSENT here: purchasing's roles are its own, so nothing can be
// expressed in the portal's employee/lead/serviceDesk/admin vocabulary.
// useProcurementGate decides visibility, keyed on the ids below — which is why
// they must stay in sync with ITEM_PERMISSION there.
//
// Phase 1 ships the two open items; the rest are registered so the rail's shape
// and gating are right from the start, and each becomes reachable as its screens
// land (see docs/plans/21-one-wso2-port.md, Phases 2–4). Items whose route does
// not exist yet carry no `path`, so the rail renders them as plain, unclickable
// labels rather than links to a 404.
//
// The perspective's own overview (`/procurement`) is deliberately NOT an item
// here. SideRail already renders an "Overview" row for `active.path` on every
// perspective, and registering the same destination again showed the row twice —
// with the nested copy winning the active highlight, since `activeItem` resolves
// sections before the overview.

import {
  ActivityIcon,
  BuildingIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  FileSignatureIcon,
  FileTextIcon,
  PackageCheckIcon,
  ReceiptTextIcon,
  ScrollTextIcon,
  SettingsIcon,
  ShoppingCartIcon,
  StoreIcon,
  UsersIcon,
} from "@wso2/oxygen-ui-icons-react";
import type { MenuApp } from "@constants/appMenu";
import { procurementRoutes } from "@features/procurement/constants/routes";

export const PROCUREMENT_APPS: readonly MenuApp[] = [
  {
    key: "requests",
    name: "Requests",
    icon: ShoppingCartIcon,
    alwaysGroup: true,
    purpose:
      "Raise a purchasing request, track the ones you've submitted, and act on the ones waiting for your approval.",
    items: [
      {
        id: "proc-my-requests",
        label: "My requests",
        desc: "Everything you've submitted, with its status and where it is in the approval chain.",
        path: procurementRoutes.myRequests,
      },
      {
        id: "proc-approvals",
        label: "Approvals",
        desc: "Requests awaiting your decision as a team lead, or a budget, legal, security or compliance approver.",
        path: procurementRoutes.approvals,
      },
    ],
  },
  {
    key: "procurement",
    name: "Procurement",
    icon: ClipboardListIcon,
    purpose:
      "The procurement team's working queue: triage requests, collect quotations, and take an order through to invoicing.",
    items: [
      {
        id: "proc-requests",
        label: "Purchase requests",
        desc: "The full queue, with assignment, priority and the approval state of each request.",
      },
      {
        id: "proc-quotations",
        label: "Quotations",
        desc: "Vendor quotations, their extracted line items, and the comparison that picks one.",
      },
      {
        id: "proc-contracts",
        label: "Contracts",
        desc: "Draft and signed contracts, and the deliveries and invoices raised against them.",
      },
      {
        id: "proc-grns",
        label: "GRNs",
        desc: "Goods received against a contract.",
      },
      {
        id: "proc-invoices",
        label: "Invoices",
        desc: "Invoices received against a contract, and their payment state.",
      },
    ],
  },
  {
    key: "analytics",
    name: "Analytics",
    icon: ActivityIcon,
    purpose: "How long requests actually take, and where they wait.",
    items: [
      {
        id: "proc-analytics-prs",
        label: "Purchase requests",
        desc: "Process timings per request, rendered from the recorded process events.",
      },
    ],
  },
  {
    key: "admin",
    name: "Administration",
    icon: SettingsIcon,
    purpose:
      "The master data the requisition form runs on, the people who may use the app, and the record of what they did.",
    items: [
      { id: "proc-vendors", label: "Vendors", desc: "The vendor master." },
      {
        id: "proc-business-units",
        label: "Business units",
        desc: "Business units and their budget approvers.",
      },
      { id: "proc-users", label: "Users", desc: "Who may use the app, and with which roles." },
      {
        id: "proc-audit",
        label: "Audit log",
        desc: "Every master-data and administrative change, with its actor.",
      },
      {
        id: "proc-settings",
        label: "Settings",
        desc: "The configurable dropdowns the requisition form offers.",
      },
    ],
  },
] as const;

/**
 * Items whose screens are ported AND routed. The rail hides everything else, so
 * a registered-but-unbuilt item is invisible rather than a row that navigates
 * nowhere (the rail's fallback for a pathless item is a canvas-anchor scroll,
 * which from a sub-route bounces the user to the overview instead). A group whose
 * children are all hidden disappears with them, so the Procurement, Analytics and
 * Administration groups appear as their screens land.
 */
export const PROCUREMENT_ROUTED_ITEM_IDS: ReadonlySet<string> = new Set(
  PROCUREMENT_APPS.flatMap((app) => app.items)
    .filter((it) => Boolean(it.path))
    .map((it) => it.id),
);

/** Every item id this perspective owns — the gate fails closed outside it. */
export const PROCUREMENT_ITEM_IDS: ReadonlySet<string> = new Set(
  PROCUREMENT_APPS.flatMap((app) => app.items).map((it) => it.id),
);

// Icons per item, for the rail. Kept beside the registry rather than inside it
// because MenuAppItem has no icon field — the group carries the icon in this
// portal, and these are only used where a leaf is rendered on its own.
export const PROCUREMENT_ITEM_ICONS = {
  "proc-my-requests": ShoppingCartIcon,
  "proc-approvals": ClipboardCheckIcon,
  "proc-requests": ClipboardListIcon,
  "proc-quotations": FileTextIcon,
  "proc-contracts": FileSignatureIcon,
  "proc-grns": PackageCheckIcon,
  "proc-invoices": ReceiptTextIcon,
  "proc-analytics-prs": ActivityIcon,
  "proc-vendors": StoreIcon,
  "proc-business-units": BuildingIcon,
  "proc-users": UsersIcon,
  "proc-audit": ScrollTextIcon,
  "proc-settings": SettingsIcon,
} as const;
