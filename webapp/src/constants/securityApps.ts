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

// Rail registry for the Security perspective.
//
// This file and the gate beside it are the only navigation code written for
// this port — the screens themselves are the GRC source, lifted. The source's
// own sidebar tables (modules/{risk,admin}/nav.ts) are NOT carried: they speak
// this app's rail's vocabulary badly, and the labels, ids, ordering and
// privileges below are transcribed from them so the two can be diffed.
//
// ORDER IS THE SOURCE'S, not a preference: components/side-nav-bar/sections.ts
// is `[auditNav, riskNav, adminNav]`, and its comment notes the order is both
// the sidebar's top-to-bottom order and the order LandingRedirect walks to pick
// the first tab a user can actually see. Keep these three in that order.
//
// THREE APPS, not one: the source has three sidebar sections serving different
// people — a named Action Owner with no grant at all reaches Risk Hub and never
// the Admin Console, and an audit team reaches Audit Hub and neither of the
// others.
//
// No `requires` on any item, deliberately. That vocabulary is people-app
// privilege NUMBERS, which say nothing about GRC grants — and an Action Owner
// may hold neither. The real decision is useSecurityGate, asked by id.
//
// A FOURTH APP, Evidence Portal, sits after Risk Hub — a separate lift from a
// separate source (grc-tools/apps/evidence-app, not grc-platform), added by
// this port rather than transcribed from anything upstream. Its item order
// here is the port's own screenshot order (Dashboard, Evidence, Submit
// Evidence, Agent Runner, then the admin-only Catalogue and Cost), not a rule
// borrowed from the GRC source.

import {
  ClipboardCheckIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
} from "@wso2/oxygen-ui-icons-react";
import type { MenuApp } from "@constants/appMenu";

export const SECURITY_APPS: readonly MenuApp[] = [
  {
    key: "audit-hub",
    name: "Audit Hub",
    icon: ShieldCheckIcon,
    purpose:
      "Compliance audits — the control set under each audit, the evidence collected against it, and its review and validation.",
    alwaysGroup: true,
    items: [
      // Two items only, matching the source's nav.ts. Create Audit, the audit
      // activity log and the control drawer are all reached from inside these
      // two rather than from the rail, so they get no entry here either.
      { id: "security-audit-dashboard", label: "Dashboard", desc: "Audit progress at a glance — the work queue, phase breakdown and team completion.", path: "/security/audit/dashboard" },
      { id: "security-audit-audits", label: "Audits", desc: "Every audit you can see, with its controls, evidence and validation state.", path: "/security/audit/audits" },
    ],
  },
  {
    key: "risk-hub",
    name: "Risk Hub",
    icon: ShieldAlertIcon,
    purpose:
      "Risk register, assessment and treatment — raise a risk, take it through owner, management and compliance approval, and track its action plans to completion.",
    alwaysGroup: true,
    items: [
      { id: "security-risk-dashboard", label: "Dashboard", desc: "Risk posture at a glance — heatmap, residual matrix and distribution.", path: "/security/risk/dashboard" },
      { id: "security-risk-registers", label: "Risk Registers", desc: "Every risk you can see, across the approval workflow.", path: "/security/risk/registers" },
      { id: "security-risk-add", label: "Add Risk", desc: "Raise a new risk: basic information, assessment scoring, and its action plan.", path: "/security/risk/add" },
      { id: "security-risk-analytics", label: "Analytics", desc: "Trends, workflow funnel and compliance coverage, with CSV export.", path: "/security/risk/analytics" },
    ],
  },
  {
    key: "evidence-portal",
    name: "Evidence Portal",
    icon: ClipboardCheckIcon,
    purpose:
      "Compliance evidence — collect, review and hand off the evidence an audit needs, whether an agent captured it or someone submitted it by hand.",
    alwaysGroup: true,
    items: [
      // Dashboard, Evidence, Submit Evidence and Agent Runner are
      // engineer-visible; Cost and Catalogue are admin-only, like Admin
      // Console above (see EVIDENCE_ADMIN_ONLY_ITEM_IDS).
      { id: "security-evidence-dashboard", label: "Dashboard", desc: "Evidence status at a glance — coverage, pending review and recent activity.", path: "/security/evidence/dashboard" },
      { id: "security-evidence-evidence", label: "Evidence", desc: "Every Evidence item, with filters, screenshots, and approve, reject and download.", path: "/security/evidence/evidence" },
      { id: "security-evidence-submit", label: "Submit Evidence", desc: "Upload up to four files by hand and link them to a compliance control.", path: "/security/evidence/submit" },
      { id: "security-evidence-agent", label: "Agent Runner", desc: "Start an automated run and watch its progress stream live.", path: "/security/evidence/agent" },
      { id: "security-evidence-cost", label: "Cost", desc: "Agent run spend over time, with a Reset that filters the view without deleting anything.", path: "/security/evidence/cost" },
      { id: "security-evidence-catalogue", label: "Catalogue", desc: "Frameworks, Products and Controls, including CSV import of Controls.", path: "/security/evidence/catalogue" },
    ],
  },
  {
    key: "admin-console",
    name: "Admin Console",
    icon: SlidersHorizontalIcon,
    purpose:
      "Who holds which role in the GRC platform, and the reference data the Risk and Audit hubs are built from.",
    alwaysGroup: true,
    items: [
      // Order follows the source's nav.ts — Users, Audit Hub, Risk Hub. Note
      // its own index redirect tries Users -> Risk Hub -> Audit Hub while its
      // comment claims it follows this list; both are reproduced as they are.
      { id: "security-admin-users", label: "Users", desc: "Provision people, grant and revoke roles, and read the activity log.", path: "/security/admin/users" },
      { id: "security-admin-audit-hub", label: "Manage Audit Hub", desc: "Audit teams — who a control's evidence can be assigned to.", path: "/security/admin/audit-hub" },
      { id: "security-admin-risk-hub", label: "Manage Risk Hub", desc: "Risk teams, categories, compliance references and risk scores.", path: "/security/admin/risk-hub" },
    ],
  },
];

/**
 * The privilege each rail item is gated on, transcribed from the source's nav
 * files so the mapping stays checkable against them.
 *
 * Registers maps to RISK_VIEW_RISKS, which a grant-less Action Owner receives
 * synthetically — see the source's mergeRiskPrivileges.
 *
 * Evidence Portal items are deliberately ABSENT here — there is no GRC
 * privilege for them to map to. useSecurityGate special-cases
 * EVIDENCE_ITEM_IDS before it ever looks in this map; see that gate's
 * Evidence visibility rule and the comment on EVIDENCE_ITEM_IDS below.
 */
export const SECURITY_ITEM_PRIVILEGE: Readonly<Record<string, string>> = {
  "security-audit-dashboard": "AUDIT_VIEW_AUDITS",
  "security-audit-audits": "AUDIT_VIEW_AUDITS",
  "security-risk-dashboard": "RISK_VIEW_DASHBOARD",
  "security-risk-registers": "RISK_VIEW_RISKS",
  "security-risk-add": "RISK_CREATE",
  "security-risk-analytics": "RISK_VIEW_ANALYTICS",
  "security-admin-users": "MANAGE_USERS",
  "security-admin-audit-hub": "MANAGE_AUDIT_HUB",
  "security-admin-risk-hub": "MANAGE_RISK_HUB",
};

/**
 * Catalogue and Cost's own ids, admin-only like the Admin Console items
 * above. useSecurityGate's admin-only rule dispatches on this set.
 */
export const EVIDENCE_CATALOGUE_ITEM_ID = "security-evidence-catalogue";
export const EVIDENCE_COST_ITEM_ID = "security-evidence-cost";

export const EVIDENCE_ADMIN_ONLY_ITEM_IDS: ReadonlySet<string> = new Set([
  EVIDENCE_CATALOGUE_ITEM_ID,
  EVIDENCE_COST_ITEM_ID,
]);

/**
 * Evidence Portal's own item ids, kept apart from SECURITY_ITEM_PRIVILEGE's
 * privilege map because there is nothing GRC-shaped to put in it: the
 * Evidence backend has no /me/privileges of its own to ask. useSecurityGate
 * special-cases these ids before it ever looks in that map, and answers them
 * from the Evidence backend's own /api/me — its role decides engineer vs
 * admin, and EVIDENCE_ADMIN_ONLY_ITEM_IDS above decides which ids need the
 * admin role specifically. See that gate for the full rule.
 */
export const EVIDENCE_ITEM_IDS: ReadonlySet<string> = new Set([
  ...(SECURITY_APPS.find((app) => app.key === "evidence-portal")?.items.map((it) => it.id) ?? []),
  ...EVIDENCE_ADMIN_ONLY_ITEM_IDS,
]);

/** Ids the rail must route through useSecurityGate rather than `requires`. */
export const SECURITY_ITEM_IDS: ReadonlySet<string> = new Set(
  SECURITY_APPS.flatMap((app) => app.items.map((it) => it.id)),
);
