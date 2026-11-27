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
  BookUserIcon,
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
  KeyRoundIcon,
  LifeBuoyIcon,
  LandmarkIcon,
  PackageIcon,
  PackagePlusIcon,
  PlugIcon,
  PrinterIcon,
  ReceiptTextIcon,
  ServerCogIcon,
  StoreIcon,
  WifiIcon,
  UsersIcon,
  WrenchIcon,
  type LucideIcon,
} from "@wso2/oxygen-ui-icons-react";
import type { PerspectiveSection } from "@constants/perspectives";

/**
 * The perspectives that link to other apps. Customer Success holds nothing but
 * these links. "infra" is the Digital Operations perspective (its key predates
 * the name).
 */
export type OtherAppPerspective =
  | "people"
  | "finance"
  | "sales"
  | "engineering"
  | "security"
  | "infra"
  | "customer-success";

/** A rail group that holds related linked apps within a perspective. */
export type OtherAppGroupId = "source-code" | "builds-artifacts" | "product-sites" | "network-vpn" | "requests";

/** The rail groups, in the order they appear in a perspective's rail. */
export const OTHER_APP_GROUPS: readonly { id: OtherAppGroupId; label: string; icon: LucideIcon }[] = [
  { id: "source-code", label: "Source Code", icon: GitBranchIcon },
  { id: "builds-artifacts", label: "Builds & Artifacts", icon: HammerIcon },
  { id: "product-sites", label: "Product Sites", icon: GlobeIcon },
  { id: "network-vpn", label: "Network & VPN", icon: WifiIcon },
  { id: "requests", label: "Requests", icon: ClipboardListIcon },
];

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
   * The rail group of related apps it sits in. Without one, it is an item of
   * its own in the perspective's rail.
   */
  group?: OtherAppGroupId;
  /**
   * Linked from a group the rail already has for this app (see `otherAppRow`),
   * so `otherAppsSections` leaves it out.
   */
  inOwnGroup?: boolean;
  /**
   * Ask Novera search already has its own entry for this app (the CSM portal's
   * "Customer Success Management (CSM)"), so `otherAppDirectoryEntries` adds none.
   */
  ownSearchEntry?: boolean;
}

/** Text appended to the label of an app reachable only on the VPN. */
export const VPN_ONLY_SUFFIX = " (VPN)";

/** The Ask Novera search category of each perspective's other apps. */
export const OTHER_APP_CATEGORY: Readonly<Record<OtherAppPerspective, string>> = {
  people: "People Ops",
  finance: "Finance",
  sales: "Sales",
  engineering: "Engineering",
  security: "Security",
  infra: "Digital Operations",
  "customer-success": "Customer Success",
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
    id: "netsuite",
    label: "NetSuite",
    marketplaceName: "NetSuite",
    hint: "The finance system",
    keywords: ["netsuite", "erp"],
    perspective: "finance",
    icon: LandmarkIcon,
  },
  {
    id: "msl-payslip",
    label: "MSL Payslip Viewer",
    marketplaceName: "MSL Payslip Viewer",
    hint: "Your payslips, from the payroll provider",
    keywords: ["payslip", "salary slip", "pay slip", "payroll"],
    perspective: "finance",
    icon: ReceiptTextIcon,
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
    label: "Sales Pitstop App",
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
    // Its address is ONE_WSO2_CSM_URL (see otherAppUrls), not an entry of
    // ONE_WSO2_OTHER_APP_URLS. It used to be a launcher tile of its own.
    id: "csm",
    label: "CSM Portal",
    marketplaceName: "CSM",
    hint: "The Customer Success Management portal",
    keywords: ["csm", "csm portal", "customer success management"],
    perspective: "customer-success",
    icon: LifeBuoyIcon,
    ownSearchEntry: true,
  },
  {
    id: "explorecs",
    label: "ExploreCS",
    marketplaceName: "ExploreCS - Internal CS Site",
    hint: "The internal Customer Success site",
    keywords: ["explorecs", "explore cs", "cs site"],
    perspective: "customer-success",
    icon: CompassIcon,
  },
  {
    id: "cs-tools",
    label: "CS Tools",
    marketplaceName: "CS Tools",
    hint: "The Customer Success tools site",
    keywords: ["cs tools", "customer success tools"],
    perspective: "customer-success",
    icon: WrenchIcon,
  },
  {
    id: "cs-tooling-site",
    label: "CS Tooling Development Site",
    marketplaceName: "CS Tooling Development Site",
    hint: "The CS tooling team's site",
    keywords: ["cs tooling", "tooling site"],
    perspective: "customer-success",
    icon: CodeIcon,
  },
  {
    id: "sa-site",
    label: "Solutions Architecture Site",
    marketplaceName: "Solutions Architecture Site",
    hint: "The Solutions Architecture team's site",
    keywords: ["solutions architecture", "sa site", "solution architects"],
    perspective: "engineering",
    group: "product-sites",
    icon: DraftingCompassIcon,
  },

  {
    id: "wso2-github",
    label: "WSO2 GitHub",
    marketplaceName: "WSO2 GitHub",
    hint: "The WSO2 GitHub organisation",
    keywords: ["github", "wso2 github", "repositories"],
    perspective: "engineering",
    group: "source-code",
    icon: GitBranchIcon,
  },
  {
    id: "support-github",
    label: "Support GitHub",
    marketplaceName: "Support GitHub",
    hint: "The WSO2 Support GitHub organisation",
    keywords: ["support github", "support repositories"],
    perspective: "engineering",
    group: "source-code",
    icon: GitBranchIcon,
  },
  {
    id: "nexus",
    label: "WSO2 Nexus Repository",
    marketplaceName: "WSO2 Nexus Repository",
    hint: "WSO2's Maven artifact repository",
    keywords: ["nexus", "maven", "artifacts"],
    perspective: "engineering",
    group: "builds-artifacts",
    icon: PackageIcon,
  },
  {
    id: "public-jenkins",
    label: "Public Jenkins",
    marketplaceName: "Public Jenkins",
    hint: "The public build server",
    keywords: ["jenkins", "public jenkins", "builds"],
    perspective: "engineering",
    group: "builds-artifacts",
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
    group: "builds-artifacts",
    icon: HammerIcon,
    vpnOnly: true,
  },
  {
    id: "connector-store-docs",
    label: "Connector Store Documentation",
    marketplaceName: "Connector Store Documentation",
    hint: "Documentation for the Connector Store",
    keywords: ["connector store", "connectors"],
    perspective: "engineering",
    group: "product-sites",
    icon: PlugIcon,
  },
  {
    id: "apim-site",
    label: "APIM Site",
    marketplaceName: "APIM Site",
    hint: "The API Manager team's site",
    keywords: ["apim", "api manager"],
    perspective: "engineering",
    group: "product-sites",
    icon: GlobeIcon,
  },

  {
    id: "vpn-setup-guide",
    label: "VPN Setup Guide",
    marketplaceName: "VPN Setup Guide",
    hint: "How to set up the WSO2 VPN",
    keywords: ["vpn", "vpn setup"],
    perspective: "infra",
    group: "network-vpn",
    icon: KeyRoundIcon,
  },
  {
    id: "guest-wifi",
    label: "Guest WiFi",
    marketplaceName: "Guest WiFi",
    hint: "The Guest WiFi app",
    keywords: ["wifi", "guest wifi", "wi-fi"],
    perspective: "infra",
    group: "network-vpn",
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
    group: "network-vpn",
    icon: PrinterIcon,
  },
  {
    id: "diy-infra-portal",
    label: "DIY Infra Portal",
    marketplaceName: "DIY Infra Portal",
    hint: "The DIY Infra Portal",
    keywords: ["diy infra", "self-service infra"],
    perspective: "infra",
    group: "requests",
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
    group: "requests",
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
    id: "hr-site",
    label: "HR Site",
    marketplaceName: "HR Site",
    hint: "The HR team's site",
    keywords: ["hr", "human resources", "hr policies"],
    perspective: "people",
    icon: BookUserIcon,
  },
];

/**
 * A perspective's linked apps, for the end of its rail. Apps that share a group
 * (`OTHER_APP_GROUPS`, in that order) sit inside it, each opening in a new tab;
 * every other app is an item of its own, a link that leaves One WSO2. Only apps
 * with an address are listed, so a group or item with none is left out.
 *
 * @param perspective - The perspective whose apps to list.
 * @param urls - App id → address; defaults to `ONE_WSO2_OTHER_APP_URLS`.
 * @returns The groups, then the items of their own.
 */
export function otherAppsSections(
  perspective: OtherAppPerspective,
  urls: Readonly<Record<string, string>> = otherAppUrls,
): PerspectiveSection[] {
  const apps = OTHER_APPS.filter((app) => app.perspective === perspective && !app.inOwnGroup);
  const groups = OTHER_APP_GROUPS.flatMap((group): PerspectiveSection[] => {
    const rows = apps.filter((app) => app.group === group.id).flatMap((app) => rowFor(app, urls));
    if (rows.length === 0) return [];
    return [{ id: `${perspective}-${group.id}`, label: group.label, icon: group.icon, alwaysGroup: true, children: rows }];
  });
  const items = apps.filter((app) => !app.group).flatMap((app) => itemFor(app, urls));
  return [...groups, ...items];
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

/** An app's own rail item, a link to it, or none when it has no address. */
function itemFor(app: OtherApp, urls: Readonly<Record<string, string>>): PerspectiveSection[] {
  const url = urls[app.id] ?? "";
  if (!url) return [];
  return [{ id: `other-app-${app.id}`, label: railLabel(app), icon: app.icon, externalUrl: url }];
}

/** The label an app shows in the rail: its name, and " (VPN)" when only the VPN reaches it. */
function railLabel(app: OtherApp): string {
  return app.vpnOnly ? `${app.label}${VPN_ONLY_SUFFIX}` : app.label;
}

/** The row in a group that opens `app` in a new tab, or none when it has no address. */
function rowFor(app: OtherApp, urls: Readonly<Record<string, string>>): PerspectiveSection[] {
  const url = urls[app.id] ?? "";
  if (!url) return [];
  return [
    {
      id: `other-app-${app.id}`,
      label: railLabel(app),
      icon: app.icon,
      onSelect: () => {
        window.open(url, "_blank", "noopener,noreferrer");
      },
      opensInNewTab: true,
      outboundUrl: url,
    },
  ];
}
