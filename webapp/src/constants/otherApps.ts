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

import { otherAppUrls } from "@config/apiConfig";
import {
  AppWindowIcon,
  BookUserIcon,
  CalendarRangeIcon,
  ChartLineIcon,
  ClipboardListIcon,
  CloudIcon,
  CodeIcon,
  CompassIcon,
  DraftingCompassIcon,
  FileTextIcon,
  GaugeIcon,
  GitBranchIcon,
  GlobeIcon,
  HammerIcon,
  HeadsetIcon,
  KeyRoundIcon,
  LandmarkIcon,
  PackageIcon,
  PackagePlusIcon,
  PlaneIcon,
  PlugIcon,
  PrinterIcon,
  QrCodeIcon,
  ReceiptTextIcon,
  ServerCogIcon,
  StoreIcon,
  WifiIcon,
  UsersIcon,
  WrenchIcon,
  type LucideIcon,
} from "@wso2/oxygen-ui-icons-react";
import type { PerspectiveSection } from "@constants/perspectives";

/** The perspectives whose rail ends with an "Other apps" group. */
export type OtherAppPerspective =
  | "people"
  | "finance"
  | "sales"
  | "knowledge"
  | "engineering"
  | "infra"
  | "security"
  | "me";

/** A WSO2 tool One WSO2 links to but does not host. */
export interface OtherApp {
  /** Key of the app's address in `ONE_WSO2_OTHER_APP_URLS`. */
  id: string;
  label: string;
  /** The app's name in the App Marketplace, which people still search by. */
  marketplaceName: string;
  /** What the app is for, shown on its Ask Novera search result. */
  hint: string;
  /** More words Ask Novera search matches, lower case. */
  keywords: readonly string[];
  perspective: OtherAppPerspective;
  icon: LucideIcon;
  /** Reachable only on the WSO2 VPN; the rail and the search result say so. */
  vpnOnly?: boolean;
  /**
   * Linked from a group the rail already has for this app (see `otherAppRow`),
   * so it is left out of the "Other apps" group.
   */
  inOwnGroup?: boolean;
}

/** Label of the rail group that holds a perspective's other apps. */
export const OTHER_APPS_GROUP_LABEL = "Other apps";

/** Text appended to the label of an app reachable only on the VPN. */
export const VPN_ONLY_SUFFIX = " (VPN)";

/** The Ask Novera search category of each perspective's other apps. */
export const OTHER_APP_CATEGORY: Readonly<Record<OtherAppPerspective, string>> = {
  people: "People Ops",
  finance: "Finance",
  sales: "Sales",
  knowledge: "Knowledge",
  engineering: "Engineering",
  infra: "Infrastructure",
  security: "Security",
  me: "Me",
};

/** Every linked app, in rail order within each perspective. */
export const OTHER_APPS: readonly OtherApp[] = [
  {
    id: "people-app",
    label: "People App",
    marketplaceName: "People App",
    hint: "Onboarding, the employee directory and the Master Data screens not yet in One WSO2",
    keywords: ["onboarding", "employee directory", "hris", "people admin"],
    perspective: "people",
    icon: UsersIcon,
  },

  {
    id: "allocations",
    label: "Allocations",
    marketplaceName: "Allocations App",
    hint: "The Allocations App",
    keywords: ["allocation", "allocations app"],
    perspective: "finance",
    icon: CalendarRangeIcon,
  },
  {
    id: "netsuite",
    label: "NetSuite",
    marketplaceName: "NetSuite",
    hint: "The finance system",
    keywords: ["netsuite", "erp"],
    perspective: "finance",
    icon: LandmarkIcon,
  },

  {
    id: "salesforce",
    label: "Salesforce",
    marketplaceName: "Salesforce",
    hint: "Accounts, opportunities and contacts",
    keywords: ["salesforce", "sfdc", "crm"],
    perspective: "sales",
    icon: CloudIcon,
  },
  {
    id: "sales-pitstop",
    label: "Open Sales Pitstop",
    marketplaceName: "Sales Pitstop",
    hint: "The Sales Pitstop hub",
    keywords: ["pitstop", "sales pitstop", "sales hub"],
    perspective: "sales",
    icon: StoreIcon,
    inOwnGroup: true,
  },
  {
    id: "sales-insights-dashboard",
    label: "Sales Insights Dashboard",
    marketplaceName: "Sales Insights Dashboard",
    hint: "A Looker Studio report of sales insights",
    keywords: ["sales insights", "looker", "sales dashboard"],
    perspective: "sales",
    icon: ChartLineIcon,
  },

  {
    id: "explorecs",
    label: "ExploreCS",
    marketplaceName: "ExploreCS - Internal CS Site",
    hint: "The internal Customer Success site",
    keywords: ["explorecs", "explore cs", "cs site"],
    perspective: "knowledge",
    icon: CompassIcon,
  },
  {
    id: "cs-tools",
    label: "CS Tools",
    marketplaceName: "CS Tools",
    hint: "The Customer Success tools site",
    keywords: ["cs tools", "customer success tools"],
    perspective: "knowledge",
    icon: WrenchIcon,
  },
  {
    id: "cs-tooling-site",
    label: "CS Tooling Development Site",
    marketplaceName: "CS Tooling Development Site",
    hint: "The CS tooling team's site",
    keywords: ["cs tooling", "tooling site"],
    perspective: "knowledge",
    icon: CodeIcon,
  },
  {
    id: "sa-site",
    label: "Solutions Architecture Site",
    marketplaceName: "Solutions Architecture Site",
    hint: "The Solutions Architecture team's site",
    keywords: ["solutions architecture", "sa site", "solution architects"],
    perspective: "knowledge",
    icon: DraftingCompassIcon,
  },

  {
    id: "wso2-github",
    label: "WSO2 GitHub",
    marketplaceName: "WSO2 GitHub",
    hint: "The WSO2 GitHub organisation",
    keywords: ["github", "wso2 github", "repositories"],
    perspective: "engineering",
    icon: GitBranchIcon,
  },
  {
    id: "support-github",
    label: "Support GitHub",
    marketplaceName: "Support GitHub",
    hint: "The WSO2 Support GitHub organisation",
    keywords: ["support github", "support repositories"],
    perspective: "engineering",
    icon: GitBranchIcon,
  },
  {
    id: "nexus",
    label: "WSO2 Nexus Repository",
    marketplaceName: "WSO2 Nexus Repository",
    hint: "WSO2's Maven artifact repository",
    keywords: ["nexus", "maven", "artifacts"],
    perspective: "engineering",
    icon: PackageIcon,
  },
  {
    id: "public-jenkins",
    label: "Public Jenkins",
    marketplaceName: "Public Jenkins",
    hint: "The public build server",
    keywords: ["jenkins", "public jenkins", "builds"],
    perspective: "engineering",
    icon: HammerIcon,
    vpnOnly: true,
  },
  {
    id: "support-jenkins",
    label: "Support Jenkins",
    marketplaceName: "Support Jenkins",
    hint: "The Support build server",
    keywords: ["jenkins", "support jenkins"],
    perspective: "engineering",
    icon: HammerIcon,
    vpnOnly: true,
  },
  {
    id: "github-committership-form",
    label: "GitHub Committership Request",
    marketplaceName: "GitHub Committership Request Form",
    hint: "Request committer access to a WSO2 GitHub repository",
    keywords: ["committership", "committer", "commit access"],
    perspective: "engineering",
    icon: ClipboardListIcon,
  },
  {
    id: "connector-store-docs",
    label: "Connector Store Documentation",
    marketplaceName: "Connector Store Documentation",
    hint: "Documentation for the Connector Store",
    keywords: ["connector store", "connectors"],
    perspective: "engineering",
    icon: PlugIcon,
  },
  {
    id: "apim-site",
    label: "APIM Site",
    marketplaceName: "APIM Site",
    hint: "The API Manager team's site",
    keywords: ["apim", "api manager"],
    perspective: "engineering",
    icon: GlobeIcon,
  },
  {
    id: "support-portal-lite",
    label: "Support Portal Lite",
    marketplaceName: "Support Portal Lite",
    hint: "The Support Portal Lite app",
    keywords: ["support portal lite", "spl"],
    perspective: "engineering",
    icon: HeadsetIcon,
  },

  {
    id: "vpn-setup-guide",
    label: "VPN Setup Guide",
    marketplaceName: "VPN Setup Guide",
    hint: "How to set up the WSO2 VPN",
    keywords: ["vpn", "vpn setup"],
    perspective: "infra",
    icon: KeyRoundIcon,
  },
  {
    id: "vpn-qr-code",
    label: "My VPN QR Code",
    marketplaceName: "My VPN QR Code",
    hint: "Your VPN QR code",
    keywords: ["vpn qr", "vpn code"],
    perspective: "infra",
    icon: QrCodeIcon,
  },
  {
    id: "guest-wifi",
    label: "Guest WiFi",
    marketplaceName: "Guest WiFi",
    hint: "The Guest WiFi app",
    keywords: ["wifi", "guest wifi", "wi-fi"],
    perspective: "infra",
    icon: WifiIcon,
    vpnOnly: true,
  },
  {
    id: "network-printer-guide",
    label: "Network Printer Setup Guide",
    marketplaceName: "Network Printer Setup Guide",
    hint: "How to set up the office printers",
    keywords: ["printer", "printing"],
    perspective: "infra",
    icon: PrinterIcon,
  },
  {
    id: "diy-infra-portal",
    label: "DIY Infra Portal",
    marketplaceName: "DIY Infra Portal",
    hint: "The DIY Infra Portal",
    keywords: ["diy infra", "self-service infra"],
    perspective: "infra",
    icon: ServerCogIcon,
    vpnOnly: true,
  },
  {
    id: "new-software-request",
    label: "Request Approval for New Software",
    marketplaceName: "Request Approval for New Software",
    hint: "Ask for approval to use new software",
    keywords: ["software approval", "new software", "software request"],
    perspective: "infra",
    icon: PackagePlusIcon,
  },

  {
    // Named for its host, not "Security & Compliance Portal" as in the
    // marketplace: this perspective already is the Security and Compliance
    // area, and that name on a link to a different site would mean two things.
    id: "security-compliance-site",
    label: "Security & Compliance Google Site",
    marketplaceName: "Security & Compliance Portal",
    hint: "The Security and Compliance team's Google Site",
    keywords: ["security site", "compliance site", "security policies"],
    perspective: "security",
    icon: FileTextIcon,
  },
  {
    id: "security-self-service-dashboard",
    label: "Security Self-Service Dashboard",
    marketplaceName: "Security Self-Service Dashboard",
    hint: "A Looker Studio report for security self-service",
    keywords: ["security dashboard", "self-service dashboard", "looker"],
    perspective: "security",
    icon: GaugeIcon,
  },

  {
    id: "travel",
    label: "Travel",
    marketplaceName: "Travel App",
    hint: "The Travel App",
    keywords: ["travel", "trip", "travel request"],
    perspective: "me",
    icon: PlaneIcon,
  },
  {
    id: "msl-payslip",
    label: "MSL Payslip Viewer",
    marketplaceName: "MSL Payslip Viewer",
    hint: "Your payslips, from the payroll provider",
    keywords: ["payslip", "salary slip", "pay slip", "payroll"],
    perspective: "me",
    icon: ReceiptTextIcon,
  },
  {
    id: "hr-site",
    label: "HR Site",
    marketplaceName: "HR Site",
    hint: "The HR team's site",
    keywords: ["hr", "human resources", "hr policies"],
    perspective: "me",
    icon: BookUserIcon,
  },
];

/**
 * The "Other apps" rail group for a perspective: one row per linked app that has
 * an address, each opening it in a new tab.
 *
 * @param perspective - The perspective whose apps to list.
 * @param urls - App id → address; defaults to `ONE_WSO2_OTHER_APP_URLS`.
 * @returns The group as the only element, or no elements when none of the
 *   perspective's apps has an address.
 */
export function otherAppsSections(
  perspective: OtherAppPerspective,
  urls: Readonly<Record<string, string>> = otherAppUrls,
): PerspectiveSection[] {
  const rows = OTHER_APPS.filter((app) => app.perspective === perspective && !app.inOwnGroup).flatMap((app) =>
    rowFor(app, urls),
  );
  if (rows.length === 0) return [];
  return [
    {
      id: `${perspective}-other-apps`,
      label: OTHER_APPS_GROUP_LABEL,
      icon: AppWindowIcon,
      alwaysGroup: true,
      children: rows,
    },
  ];
}

/**
 * The rail row for one linked app, for a group the rail already has for it.
 *
 * @param id - The app's id in `OTHER_APPS`.
 * @param urls - App id → address; defaults to `ONE_WSO2_OTHER_APP_URLS`.
 * @returns The row as the only element, or no elements when the app has no address.
 */
export function otherAppRow(
  id: string,
  urls: Readonly<Record<string, string>> = otherAppUrls,
): PerspectiveSection[] {
  const app = OTHER_APPS.find((candidate) => candidate.id === id);
  return app ? rowFor(app, urls) : [];
}

/** The row that opens `app` in a new tab, or none when it has no address. */
function rowFor(app: OtherApp, urls: Readonly<Record<string, string>>): PerspectiveSection[] {
  const url = urls[app.id] ?? "";
  if (!url) return [];
  return [
    {
      id: `other-app-${app.id}`,
      label: app.vpnOnly ? `${app.label}${VPN_ONLY_SUFFIX}` : app.label,
      icon: app.icon,
      onSelect: () => {
        window.open(url, "_blank", "noopener,noreferrer");
      },
      opensInNewTab: true,
    },
  ];
}
