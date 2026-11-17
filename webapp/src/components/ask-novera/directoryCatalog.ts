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

import {
  BookOpenIcon,
  CarIcon,
  ChartNoAxesCombinedIcon,
  ClipboardCheckIcon,
  CreditCardIcon,
  DatabaseIcon,
  FileTextIcon,
  MailsIcon,
  MegaphoneIcon,
  NetworkIcon,
  PaletteIcon,
  ScaleIcon,
  SettingsIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  SignatureIcon,
  TicketIcon,
  TreePalmIcon,
  UserRoundIcon,
  UserRoundMinusIcon,
  UsersIcon,
  UtensilsIcon,
  VideoIcon,
  WalletIcon,
  WrenchIcon,
} from "@wso2/oxygen-ui-icons-react";
import type { Capability } from "@constants/appMenu";

export const LEAVE_BUCKET = "LEAVE_STANDARD";

/** Represents a searchable directory destination within the One-WSO2 suite. */
export interface DirectoryEntry {
  /** Unique directory identifier */
  id: string;
  /** Section heading title displayed on the result card */
  title: string;
  /** Action button label (defined when hasWebApp is true) */
  label?: string;
  /** Contextual guidance hint */
  hint: string;
  /** In-app destination route (defined when hasWebApp is true) */
  href?: string;
  /** Section icon */
  icon: typeof TreePalmIcon;
  /** Associated Agent Orchestrator domain bucket if AI tool execution is backed */
  mcpBucket?: string;
  /**
   * Whether an active MCP capability is connected.
   * When false, the Novera AI Overview card is suppressed and only the direct action button displays.
   */
  hasMcpCapability: boolean;
  /**
   * Whether a dedicated frontend web app exists in One-WSO2.
   * If false, no navigation button is shown, and only the Novera AI Overview result is displayed.
   */
  hasWebApp: boolean;
  /** Required user capabilities to see and access this directory entry in search */
  requires?: Capability[];
  /** Search keywords and synonyms */
  keywords: string[];
}

/**
 * Central catalog of One-WSO2 directories and apps searchable via TopBar Ask Novera.
 * Adding a new portal app here enables instant search navigation.
 */
export const DIRECTORY_CATALOG: readonly DirectoryEntry[] = [
  // 1. Leave Management (MCP: yes, WebApp: yes)
  {
    id: "me-leave",
    title: "Leave Management",
    label: "Open Leave App",
    hint: "Apply for leave and view leave history",
    href: "/me/leave",
    icon: TreePalmIcon,
    mcpBucket: LEAVE_BUCKET,
    hasMcpCapability: true,
    hasWebApp: true,
    keywords: [
      "leave",
      "leaves",
      "vacation",
      "annual",
      "casual",
      "sick",
      "time off",
      "holiday",
      "apply",
      "balance",
    ],
  },
  // 2. Cafeteria Menu (MCP: yes, WebApp: yes)
  {
    id: "me-menu",
    title: "Cafeteria",
    label: "Open Cafeteria App",
    hint: "Check today's breakfast, lunch, and snack menu",
    href: "/me/menu",
    icon: UtensilsIcon,
    mcpBucket: "PO_MENU",
    hasMcpCapability: true,
    hasWebApp: true,
    keywords: [
      "cafeteria",
      "menu",
      "lunch",
      "food",
      "breakfast",
      "meals",
      "order",
      "eat",
      "canteen",
    ],
  },
  // 3. Vehicles (MCP: yes, WebApp: NO) 
  {
    id: "po-vehicles",
    title: "Vehicle Parking",
    hint: "Manage office parking passes and registered vehicles",
    icon: CarIcon,
    mcpBucket: "PO_VEHICLES",
    hasMcpCapability: true,
    hasWebApp: false,
    keywords: [
      "vehicle",
      "vehicles",
      "parking",
      "car",
      "bike",
      "pass",
      "sticker",
    ],
  },
  // 4. Employee & Seating (MCP: yes, WebApp: NO)
  {
    id: "po-employee",
    title: "Desk & Seating",
    hint: "Look up assigned desks, seating, and office floor locations",
    icon: UsersIcon,
    mcpBucket: "PO_EMPLOYEE",
    hasMcpCapability: true,
    hasWebApp: false,
    keywords: [
      "desk",
      "seat",
      "seating",
      "assigned seat",
      "floor",
    ],
  },
  // 5. Letters & Certificates (MCP: yes, WebApp: NO)
  {
    id: "po-letters",
    title: "Letters & Certificates",
    hint: "Request visa support, embassy, and service confirmation letters",
    icon: FileTextIcon,
    mcpBucket: "PO_LETTERS",
    hasMcpCapability: true,
    hasWebApp: false,
    keywords: [
      "letter",
      "letters",
      "visa letter",
      "service letter",
      "embassy",
      "employment letter",
    ],
  },
  // 6. Subscriptions (LaaS & Commute) (MCP: yes, WebApp: yes)
  {
    id: "me-subscriptions",
    title: "Subscriptions",
    label: "Open Subscriptions App",
    hint: "Manage lunch (LaaS) and PickMe commute subscriptions",
    href: "/me/subscriptions",
    icon: UtensilsIcon,
    mcpBucket: "PO_SUBSCRIPTIONS",
    hasMcpCapability: true,
    hasWebApp: true,
    keywords: [
      "subscription",
      "subscriptions",
      "lunch subscription",
      "meal subscription",
      "laas",
      "cancel lunch",
      "opt in lunch",
      "commute",
      "pickme",
      "transport",
      "cab",
      "commute subscription",
      "pickme commute",
    ],
  },
  // 7. Company Policies (MCP: yes, WebApp: NO)
  {
    id: "po-policies",
    title: "Company Policies",
    hint: "Browse WSO2 workplace guidelines, benefits, and HR policies",
    icon: BookOpenIcon,
    mcpBucket: "PO_POLICIES",
    hasMcpCapability: true,
    hasWebApp: false,
    keywords: [
      "policy",
      "policies",
      "handbook",
      "sabbatical rules",
      "wfh",
      "guidelines",
    ],
  },
  // 8. My Team (MCP: no, WebApp: yes)
  {
    id: "me-team",
    title: "My Team",
    label: "Open My Team App",
    hint: "View team members, reporting structure, and employee details",
    href: "/me/my-team",
    icon: UsersIcon,
    hasMcpCapability: false,
    hasWebApp: true,
    keywords: [
      "team",
      "colleagues",
      "members",
      "manager",
      "lead",
      "reporting",
      "my team",
    ],
  },
  // 9. Expense Claims (MCP: no, WebApp: yes)
  {
    id: "me-claims",
    title: "Expense Claims",
    label: "Open Expenses App",
    hint: "Submit and track expense reimbursements and claims",
    href: "/me/claims",
    icon: WalletIcon,
    hasMcpCapability: false,
    hasWebApp: true,
    keywords: [
      "expense",
      "expenses",
      "claim",
      "claims",
      "reimbursement",
      "receipt",
      "finance",
      "opd",
    ],
  },
  // 10. Approvals (MCP: no, WebApp: yes)
  {
    id: "finance-approvals",
    title: "Approvals",
    label: "Open Approvals App",
    hint: "Review and approve pending team expense claims and requests",
    href: "/finance/claim-approval",
    icon: ClipboardCheckIcon,
    hasMcpCapability: false,
    hasWebApp: true,
    requires: ["admin", "lead"],
    keywords: [
      "approve",
      "approvals",
      "pending",
      "review",
      "sign off",
    ],
  },
  // 11. Email Groups (MCP: no, WebApp: yes)
  {
    id: "me-email-groups",
    title: "Email Groups",
    label: "Open Email Groups",
    hint: "Browse group directory and manage Google Groups mailing list subscriptions",
    href: "/me/email-groups",
    icon: MailsIcon,
    hasMcpCapability: false,
    hasWebApp: true,
    keywords: [
      "email groups",
      "email group",
      "mailing list",
      "mailing lists",
      "google groups",
      "distribution list",
      "dl",
      "groups",
    ],
  },
  // 12. Email Signature (MCP: no, WebApp: yes)
  {
    id: "me-email-signature",
    title: "Email Signature",
    label: "Open Email Signature",
    hint: "Generate and copy an official WSO2 email signature into your mail client",
    href: "/me/email-signature",
    icon: SignatureIcon,
    hasMcpCapability: false,
    hasWebApp: true,
    keywords: [
      "signature",
      "email signature",
      "signature generator",
      "mail signature",
      "wso2 signature",
      "outlook signature",
    ],
  },
  // 13. Performance Appraisal Review (PAR) (MCP: no, WebApp: yes)
  {
    id: "me-par",
    title: "Performance (PAR)",
    label: "Open PAR",
    hint: "Complete, track, and share your Performance Appraisal Review (PAR)",
    href: "/me/performance",
    icon: ClipboardCheckIcon,
    hasMcpCapability: false,
    hasWebApp: true,
    keywords: [
      "par",
      "performance",
      "appraisal",
      "self evaluation",
      "annual review",
      "goals",
      "feedback",
      "f2f",
    ],
  },
  // 14. Settings (MCP: no, WebApp: yes)
  {
    id: "settings",
    title: "Settings",
    label: "Open Settings",
    hint: "Configure portal preferences, default landing page, theme, and preview features",
    href: "/settings",
    icon: SettingsIcon,
    hasMcpCapability: false,
    hasWebApp: true,
    keywords: [
      "settings",
      "preferences",
      "landing page",
      "dark mode",
      "theme",
      "color scheme",
      "preview features",
      "appearance",
    ],
  },
  // 15. Org Chart (MCP: no, WebApp: yes)
  {
    id: "people-org-chart",
    title: "Org Chart",
    label: "Open Org Chart",
    hint: "Explore the organizational structure, lead hierarchy, and team chains",
    href: "/people-ops/org-chart",
    icon: NetworkIcon,
    hasMcpCapability: false,
    hasWebApp: true,
    keywords: [
      "org chart",
      "organization",
      "hierarchy",
      "reporting line",
      "chain of command",
      "reporting structure",
      "who reports to whom",
    ],
  },
  // 16. Manage Subscriptions (People Ops) (MCP: no, WebApp: yes)
  {
    id: "people-subscriptions-manage",
    title: "Manage Subscriptions",
    label: "Manage Subscriptions",
    hint: "Administer employee lunch (LaaS) and PickMe commute subscriptions",
    href: "/people-ops/subscriptions/manage",
    icon: TicketIcon,
    hasMcpCapability: false,
    hasWebApp: true,
    requires: ["admin"],
    keywords: [
      "manage subscriptions",
      "commute admin",
      "lunch admin",
      "subscriptions report",
      "employee transport",
      "subscription management",
    ],
  },
  // 17. PAR Lead Review (MCP: no, WebApp: yes)
  {
    id: "people-par-lead",
    title: "PAR — Lead View",
    label: "Open PAR Lead View",
    hint: "Review and rate performance appraisals for your direct and additional reports",
    href: "/people-ops/performance/lead",
    icon: ClipboardCheckIcon,
    hasMcpCapability: false,
    hasWebApp: true,
    requires: ["admin", "lead"],
    keywords: [
      "lead par",
      "team appraisal",
      "direct reports par",
      "rate team",
      "lead evaluation",
      "par review",
    ],
  },
  // 18. Active Employees Report (MCP: no, WebApp: yes)
  {
    id: "people-reports-active-employees",
    title: "Active Employees Report",
    label: "View Employee Report",
    hint: "Generate and download active employee headcount and roster reports",
    href: "/people-ops/reports/active-employees",
    icon: UserRoundIcon,
    hasMcpCapability: false,
    hasWebApp: true,
    requires: ["admin", "lead"],
    keywords: [
      "active employees",
      "employee report",
      "headcount",
      "staff list",
      "employee roster",
      "active staff",
    ],
  },
  // 19. Resignations Report (MCP: no, WebApp: yes)
  {
    id: "people-reports-resignations",
    title: "Resignations Report",
    label: "View Resignations",
    hint: "View employee turnover, resignation notices, and departure history",
    href: "/people-ops/reports/resignations",
    icon: UserRoundMinusIcon,
    hasMcpCapability: false,
    hasWebApp: true,
    requires: ["admin", "lead"],
    keywords: [
      "resignations",
      "resignation report",
      "attrition",
      "turnover",
      "left employees",
      "exit report",
    ],
  },
  // 20. Org Structure (Master Data) (MCP: no, WebApp: yes)
  {
    id: "people-master-data-org-structure",
    title: "Org Structure",
    label: "Open Org Structure",
    hint: "Manage departments, business units, cost centers, and entity mappings",
    href: "/people-ops/master-data/org-structure",
    icon: DatabaseIcon,
    hasMcpCapability: false,
    hasWebApp: true,
    requires: ["admin"],
    keywords: [
      "org structure",
      "master data",
      "business units",
      "departments",
      "cost centers",
      "entity hierarchy",
    ],
  },
  // 21. Credit Card Expenses (MCP: no, WebApp: yes)
  {
    id: "finance-cc",
    title: "Credit Card Expenses",
    label: "Open Credit Card App",
    hint: "Categorize, reconcile, and submit corporate credit card transactions",
    href: "/finance/cc/new",
    icon: CreditCardIcon,
    hasMcpCapability: false,
    hasWebApp: true,
    keywords: [
      "credit card",
      "corporate card",
      "cc expenses",
      "card transactions",
      "reconcile card",
      "amex",
      "bank statements",
    ],
  },
  // 22. Finance Overview (MCP: no, WebApp: yes)
  {
    id: "finance-overview",
    title: "Finance Overview",
    label: "Open Finance Overview",
    hint: "View unsubmitted corporate card transactions and OPD claim allowance usage",
    href: "/finance/overview",
    icon: WalletIcon,
    hasMcpCapability: false,
    hasWebApp: true,
    keywords: [
      "finance overview",
      "spend analytics",
      "card spend dashboard",
      "opd utilization",
      "finance dashboard",
    ],
  },
  // 23. Sales Recorded Meetings (MCP: no, WebApp: yes)
  {
    id: "sales-meetings",
    title: "Sales Meetings",
    label: "Open Sales Meetings",
    hint: "Browse recorded customer meetings, call recordings, and AI transcripts",
    href: "/sales",
    icon: VideoIcon,
    hasMcpCapability: false,
    hasWebApp: true,
    keywords: [
      "sales",
      "sales meetings",
      "recorded calls",
      "meeting recordings",
      "customer calls",
      "call transcripts",
      "gong",
    ],
  },
  // 24. Due Diligence (MCP: no, WebApp: yes)
  {
    id: "due-diligence",
    title: "Partner Due Diligence",
    label: "Open Due Diligence",
    hint: "Review partner vetting applications, credit scoring, and legal compliance",
    href: "/due-diligence/partners",
    icon: ScaleIcon,
    hasMcpCapability: false,
    hasWebApp: true,
    keywords: [
      "due diligence",
      "partners",
      "resellers",
      "partner vetting",
      "credit score",
      "partner compliance",
      "legal vetting",
    ],
  },
  // 25. Audit Hub (Security & Compliance) (MCP: no, WebApp: yes)
  {
    id: "security-audit",
    title: "Audit Hub",
    label: "Open Audit Hub",
    hint: "Manage compliance controls, evidence collection, and audit validations",
    href: "/security/audit/dashboard",
    icon: ShieldCheckIcon,
    hasMcpCapability: false,
    hasWebApp: true,
    keywords: [
      "audit",
      "audit hub",
      "soc2",
      "iso27001",
      "compliance controls",
      "audit evidence",
      "internal audit",
      "security audit",
    ],
  },
  // 26. Risk Hub (Security & Compliance) (MCP: no, WebApp: yes)
  {
    id: "security-risk",
    title: "Risk Hub",
    label: "Open Risk Hub",
    hint: "Track company risks, mitigation action plans, and residual risk heatmaps",
    href: "/security/risk/dashboard",
    icon: ShieldAlertIcon,
    hasMcpCapability: false,
    hasWebApp: true,
    keywords: [
      "risk",
      "risk hub",
      "risk register",
      "raise risk",
      "risk assessment",
      "residual risk",
      "risk heatmap",
      "compliance risk",
    ],
  },
  // 27. UTM Link Generator (Marketing Ops) (MCP: no, WebApp: yes)
  {
    id: "mops-utm",
    title: "UTM Link Generator",
    label: "Open UTM Generator",
    hint: "Build tagged campaign tracking URLs with approved marketing parameters",
    href: "/marketing-ops/utilities/utm",
    icon: WrenchIcon,
    hasMcpCapability: false,
    hasWebApp: true,
    keywords: [
      "utm",
      "utm generator",
      "campaign link",
      "tracking link",
      "tracking url",
      "marketing link",
      "campaign url",
    ],
  },
  // 28. Asset Name Generator (Marketing Ops) (MCP: no, WebApp: yes)
  {
    id: "mops-asset-name",
    title: "Asset Name Generator",
    label: "Open Asset Generator",
    hint: "Compose standardized asset names for marketing collaterals and campaigns",
    href: "/marketing-ops/utilities/asset-name",
    icon: WrenchIcon,
    hasMcpCapability: false,
    hasWebApp: true,
    keywords: [
      "asset name",
      "marketing asset",
      "asset generator",
      "naming convention",
      "asset naming",
    ],
  },
  // 29. Email Workbench (Marketing Ops) (MCP: no, WebApp: yes)
  {
    id: "mops-email-workbench",
    title: "Email Workbench",
    label: "Open Email Workbench",
    hint: "Design responsive marketing emails and sync them to Pardot",
    href: "/marketing-ops/email-workbench/create",
    icon: MegaphoneIcon,
    hasMcpCapability: false,
    hasWebApp: true,
    keywords: [
      "email workbench",
      "pardot email",
      "marketing email",
      "newsletter",
      "email campaign",
      "email template",
    ],
  },
  // 30. Ad Campaigns (Marketing Ops) (MCP: no, WebApp: yes)
  {
    id: "mops-ad-campaigns",
    title: "Ad Campaigns",
    label: "Open Ad Campaigns",
    hint: "Analyze cross-channel performance, spend, reach, and conversion for Google & LinkedIn Ads",
    href: "/marketing-ops/ad-campaigns/analytics",
    icon: ChartNoAxesCombinedIcon,
    hasMcpCapability: false,
    hasWebApp: true,
    keywords: [
      "ad campaigns",
      "google ads",
      "linkedin ads",
      "ad spend",
      "paid ads",
      "campaign tracker",
      "ad analytics",
    ],
  },
  // 31. Design Studio (Marketing Ops) (MCP: no, WebApp: yes)
  {
    id: "mops-design-studio",
    title: "Design Studio",
    label: "Open Design Studio",
    hint: "Create branded social media posts, banners, and marketing graphics",
    href: "/marketing-ops/design-studio/post-builder",
    icon: PaletteIcon,
    hasMcpCapability: false,
    hasWebApp: true,
    keywords: [
      "design studio",
      "post builder",
      "social banner",
      "marketing design",
      "linkedin post",
      "graphics",
    ],
  },
];

/**
 * Verifies whether the caller's capabilities allow viewing and accessing a directory entry.
 *
 * @param entry - The directory entry to check
 * @param userCaps - The caller's capability set
 * @returns True if the entry is permitted for the given capabilities
 */
export function isDirectoryEntryPermitted(
  entry: DirectoryEntry,
  userCaps?: Set<Capability>,
): boolean {
  if (!entry.requires || entry.requires.length === 0) {
    return true;
  }
  const caps = userCaps ?? new Set<Capability>(["employee"]);
  return entry.requires.some((r) => caps.has(r));
}

/**
 * Matches a directory entry from the user query text or from a resolved Agent Orchestrator bucket.
 * Bucket match takes precedence when provided. Entries requiring elevated capabilities are filtered
 * out if the caller lacks the required role.
 *
 * @param query - The user query string.
 * @param bucket - Optional Agent Orchestrator domain bucket.
 * @param userCaps - Optional caller capability set for role-based access filtering.
 * @returns The matched directory entry, or undefined if no match found.
 */
export function matchDirectory(
  query: string,
  bucket?: string | null,
  userCaps?: Set<Capability>,
): DirectoryEntry | undefined {
  if (bucket) {
    const bucketMatch = DIRECTORY_CATALOG.find(
      (entry) => entry.mcpBucket === bucket && isDirectoryEntryPermitted(entry, userCaps),
    );
    if (bucketMatch) {
      return bucketMatch;
    }
  }

  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  const words = normalized.split(/[^a-z0-9_-]+/);

  for (const entry of DIRECTORY_CATALOG) {
    if (entry.title.toLowerCase() === normalized && isDirectoryEntryPermitted(entry, userCaps)) {
      return entry;
    }
  }

  let bestEntry: DirectoryEntry | undefined;
  let bestScore = 0;

  for (const entry of DIRECTORY_CATALOG) {
    if (!isDirectoryEntryPermitted(entry, userCaps)) {
      continue;
    }

    for (const kw of entry.keywords) {
      let matched = false;
      if (kw === normalized) {
        matched = true;
      } else if (kw.includes(" ")) {
        matched = normalized.includes(kw);
      } else {
        matched = words.includes(kw);
      }

      if (matched && kw.length > bestScore) {
        bestScore = kw.length;
        bestEntry = entry;
      }
    }
  }

  return bestEntry;
}
