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

import type { Capability } from "@constants/appMenu";
import { isPreviewEnabled } from "@config/previewFeatures";
import { ENGINEERING_ADMIN_ITEM_ID } from "@constants/downloadStatsApps";
import { DUE_DILIGENCE_ITEM_IDS } from "@constants/dueDiligenceApps";
import { FINANCE_ITEM_IDS } from "@constants/financeApps";
import { MIS_ITEM_IDS } from "@constants/misApps";
import { INFRA_ITEM_IDS } from "@constants/infraApps";
import { BANKING_ITEM_IDS, LEAVE_ITEM_IDS } from "@constants/meApps";
import { PAR_EMPLOYEE_ITEM_ID } from "@constants/parApps";
import { PROMOTION_EMPLOYEE_ITEM_ID } from "@constants/promotionApps";
import {
  AMPLIFY_DASHBOARD_ITEM_IDS,
  AMPLIFY_EDITOR_ITEM_IDS,
  BANKING_ADMIN_ITEM_ID,
  PAR_ADMIN_PORTAL_ITEM_ID,
  PAR_LEAD_PORTAL_ITEM_ID,
  PROMOTION_ADMIN_PORTAL_ITEM_ID,
  PROMOTION_BOARD_PORTAL_ITEM_ID,
  PROMOTION_CYCLE_HISTORY_ITEM_ID,
  PROMOTION_FUNCTIONAL_LEAD_PORTAL_ITEM_ID,
  PROMOTION_LEAD_PORTAL_ITEM_ID,
  PROMOTION_TEAM_HISTORY_ITEM_ID,
  SALES_ITEM_IDS,
  SUBSCRIPTION_ITEM_IDS,
  UMT_ITEM_IDS,
  type PerspectiveSection,
} from "@constants/perspectives";
import { SECURITY_ITEM_IDS } from "@constants/securityApps";
import { CADO2_ITEM_IDS } from "@constants/cado2Apps";

/**
 * The four facts every feature presents to the fold.
 * Anything else about that feature stays in the feature.
 */
export interface VisibilityAnswer {
  canSee: (sectionId: string) => boolean;
  resolving: boolean;
  /**
   * Whether THIS item's own answer is final, if different from `resolving`.
   * Optional — most adapters ask one backend for everything they claim, so
   * `!resolving` already means "every item I claim has answered", and
   * `sectionAnswered` falls back to exactly that when this is omitted.
   *
   * Only an adapter whose items can depend on DIFFERENT SUBSETS of what it
   * fetches needs to override this — finance is the one case today: it asks
   * four backends, but `finance-overview` needs three of them and
   * `claim-approval` needs two, so `resolving` (all four) can stay true long
   * after a given item's own answer is already known. Without this, a
   * finance item that was already decided still blocked `firstVisibleLeaf`
   * behind an unrelated backend — see useFinanceGate's `itemAnswered`.
   */
  answered?: (sectionId: string) => boolean;
  /**
   * A failed read the landing should retry.
   * Omitted when a failed read means the section is not allowed.
   */
  error?: unknown;
  retry: () => void;
}

/** One feature's answer, plus which sections it claims. */
export interface VisibilityAdapter extends VisibilityAnswer {
  name: AdapterName;
  claim: SectionClaim;
}

export type AdapterName =
  | "par"
  | "marketing"
  | "due-diligence"
  | "finance"
  | "mis"
  | "leave"
  | "banking"
  | "banking-admin"
  | "infra"
  | "sales"
  | "cado2"
  | "promotion"
  | "security"
  | "umt"
  | "subscriptions"
  | "engineering"
  | "amplify";

const ADAPTER_NAMES: readonly AdapterName[] = [
  "par",
  "marketing",
  "due-diligence",
  "finance",
  "mis",
  "leave",
  "banking",
  "banking-admin",
  "infra",
  "sales",
  "cado2",
  "promotion",
  "security",
  "umt",
  "subscriptions",
  "engineering",
  "amplify",
];

/** Which sections this adapter answers. A perspective claim answers every section of that perspective. */
export type SectionClaim =
  | { kind: "sections"; ids: ReadonlySet<string> }
  | { kind: "perspective"; key: string };

export interface VisibilitySection {
  id: string;
  requires?: readonly Capability[];
}

/**
 * Facts the shell knows that are not a feature's own backend:
 * Sri Lanka, the employee record, and people-app capabilities.
 */
export interface VisibilityShell {
  perspectiveKey: string;
  /** Every section id in the active perspective, groups included. */
  sectionIds: ReadonlySet<string>;
  sriLankaOnlyIds: ReadonlySet<string>;
  isSriLankaEmployee: boolean;
  employeeRecordResolving: boolean;
  employeeRecordFailed: boolean;
  employeeRecordError?: unknown;
  retryEmployeeRecord: () => void;
  capabilities: ReadonlySet<Capability>;
}

export interface FoldedVisibility {
  canSee: (section: VisibilitySection) => boolean;
  /**
   * Whether `canSee`'s answer for this ONE section is final — the employee
   * record it may read capabilities/Sri-Lanka from has resolved, and so has
   * whichever adapter owns it, if any. A caller choosing the first VISIBLE
   * section in rail order needs this alongside `canSee`: a later section
   * answering `true` before an earlier one has answered at all is not "the
   * first visible one" yet, only the first one checked so far — see
   * `firstVisibleLeaf` in `railActive.ts`, the one place this is for.
   */
  sectionAnswered: (section: VisibilitySection) => boolean;
  resolving: boolean;
  failed: boolean;
  error?: unknown;
  retry: () => void;
}

const PROMOTION_SECTION_IDS: ReadonlySet<string> = new Set([
  PROMOTION_EMPLOYEE_ITEM_ID,
  PROMOTION_LEAD_PORTAL_ITEM_ID,
  PROMOTION_TEAM_HISTORY_ITEM_ID,
  PROMOTION_FUNCTIONAL_LEAD_PORTAL_ITEM_ID,
  PROMOTION_BOARD_PORTAL_ITEM_ID,
  PROMOTION_ADMIN_PORTAL_ITEM_ID,
  PROMOTION_CYCLE_HISTORY_ITEM_ID,
]);

const ids = (values: readonly string[]): SectionClaim => ({ kind: "sections", ids: new Set(values) });

/** The sections each adapter answers. Independent of whether that adapter is in play. */
export function claimOf(name: AdapterName): SectionClaim {
  switch (name) {
    case "par":
      return ids([PAR_ADMIN_PORTAL_ITEM_ID, PAR_LEAD_PORTAL_ITEM_ID, PAR_EMPLOYEE_ITEM_ID]);
    case "marketing":
      // People-app capabilities must not answer these sections. `requires: ["admin"]`
      // on a Marketing Ops section means "restricted", and this adapter decides who.
      return { kind: "perspective", key: "marketing" };
    case "due-diligence":
      return { kind: "sections", ids: DUE_DILIGENCE_ITEM_IDS };
    case "finance":
      return { kind: "sections", ids: FINANCE_ITEM_IDS };
    case "mis":
      return { kind: "sections", ids: MIS_ITEM_IDS };
    case "leave":
      return { kind: "sections", ids: LEAVE_ITEM_IDS };
    case "banking":
      return { kind: "sections", ids: BANKING_ITEM_IDS };
    case "banking-admin":
      return ids([BANKING_ADMIN_ITEM_ID]);
    case "infra":
      return { kind: "sections", ids: INFRA_ITEM_IDS };
    case "sales":
      return { kind: "sections", ids: SALES_ITEM_IDS };
    case "cado2":
      return { kind: "sections", ids: CADO2_ITEM_IDS };
    case "promotion":
      return { kind: "sections", ids: PROMOTION_SECTION_IDS };
    case "security":
      return { kind: "sections", ids: SECURITY_ITEM_IDS };
    case "umt":
      return { kind: "sections", ids: UMT_ITEM_IDS };
    case "subscriptions":
      return { kind: "sections", ids: SUBSCRIPTION_ITEM_IDS };
    case "engineering":
      return ids([ENGINEERING_ADMIN_ITEM_ID]);
    case "amplify":
      return { kind: "sections", ids: new Set([...AMPLIFY_EDITOR_ITEM_IDS, ...AMPLIFY_DASHBOARD_ITEM_IDS]) };
    default: {
      const neverName: never = name;
      return neverName;
    }
  }
}

/**
 * Adapters in play for a perspective, in the order a failure is reported.
 *
 * An adapter whose perspective is not active is left off, so it cannot keep
 * the landing waiting. Two exceptions stay on every perspective because their
 * failure or wait is not confined to one perspective today: PAR admin (its
 * check is not switched off per perspective) and subscriptions (a token-decode
 * failure is reported wherever the landing asks).
 */
export function claimsForPerspective(perspectiveKey: string): AdapterName[] {
  const names: AdapterName[] = ["par"];
  if (perspectiveKey === "marketing") names.push("marketing");
  if (perspectiveKey === "finance" || perspectiveKey === "legal") names.push("due-diligence");
  if (perspectiveKey === "finance" || perspectiveKey === "me") names.push("finance");
  // Finance MIS is shipped. Its rows are always in Finance, so the ARR
  // service is asked there and a failed read stops Finance with the other checks.
  if (perspectiveKey === "finance") names.push("mis");
  if (perspectiveKey === "me") names.push("leave", "banking");
  if (perspectiveKey === "people" || perspectiveKey === "finance") names.push("banking-admin");
  if (perspectiveKey === "infra") names.push("infra");
  if (perspectiveKey === "sales") names.push("sales");
  // CadO2's rows exist only while its preview flag is on. Asking its /me when
  // they are absent would hold the Sales landing on a backend with nothing to show.
  if (perspectiveKey === "sales" && isPreviewEnabled("cado2")) names.push("cado2");
  if (perspectiveKey === "people" || perspectiveKey === "me") names.push("promotion");
  if (perspectiveKey === "security") names.push("security");
  if (perspectiveKey === "engineering") names.push("engineering", "umt");
  if (perspectiveKey === "amplify") names.push("amplify");
  names.push("subscriptions");
  return names;
}

export function sectionIdsIn(sections: readonly PerspectiveSection[]): Set<string> {
  const ids = new Set<string>();
  const visit = (section: PerspectiveSection) => {
    ids.add(section.id);
    section.children?.forEach(visit);
  };
  sections.forEach(visit);
  return ids;
}

/**
 * Sections claimed by more than one adapter. The test of the real perspective
 * list fails when this is non-empty.
 */
export function claimConflicts(adapters: readonly VisibilityAdapter[], shell: VisibilityShell): string[] {
  const owner = new Map<string, string>();
  const conflicts: string[] = [];
  for (const adapter of adapters) {
    for (const sectionId of claimedIds(adapter, shell)) {
      const previous = owner.get(sectionId);
      if (previous) conflicts.push(`${sectionId} is claimed by ${previous} and ${adapter.name}`);
      else owner.set(sectionId, adapter.name);
    }
  }
  return conflicts;
}

export function foldVisibility(
  adapters: readonly VisibilityAdapter[],
  shell: VisibilityShell,
): FoldedVisibility {
  const canSee = (section: VisibilitySection): boolean => {
    if (shell.sriLankaOnlyIds.has(section.id) && !shell.isSriLankaEmployee) return false;
    const owner = adapters.find((adapter) => claimedIds(adapter, shell).has(section.id));
    if (owner) return owner.canSee(section.id);
    // An id some adapter claims, asked while that adapter is not in play,
    // stays hidden. Falling through to people-app capabilities would show a
    // lead or admin section to everyone when it has no `requires`.
    if (ADAPTER_NAMES.some((name) => claimCovers(name, section.id, shell))) return false;
    return allowedByCapabilities(section.requires, shell.capabilities);
  };

  const sectionAnswered = (section: VisibilitySection): boolean => {
    // Capabilities and the Sri-Lanka check both read off the employee record,
    // which `canSee` consults before it even looks for an owning adapter — so
    // nothing is answered while that is still resolving, adapter or not.
    if (shell.employeeRecordResolving) return false;
    const owner = adapters.find((adapter) => claimedIds(adapter, shell).has(section.id));
    if (!owner) return true;
    // Per-item, where the adapter provides it (finance); the aggregate
    // `resolving` otherwise, which is correct for everyone else, since they
    // each ask one backend for everything they claim.
    return owner.answered ? owner.answered(section.id) : !owner.resolving;
  };

  const failedAdapters = adapters.filter((adapter) => adapter.error !== undefined);
  const failed = shell.employeeRecordFailed || failedAdapters.length > 0;
  const error = shell.employeeRecordFailed ? shell.employeeRecordError : failedAdapters[0]?.error;

  const retry = (): void => {
    if (shell.employeeRecordFailed) shell.retryEmployeeRecord();
    for (const adapter of failedAdapters) adapter.retry();
  };

  return {
    canSee,
    sectionAnswered,
    resolving: shell.employeeRecordResolving || adapters.some((adapter) => adapter.resolving),
    failed,
    error,
    retry,
  };
}

function claimedIds(adapter: VisibilityAdapter, shell: VisibilityShell): ReadonlySet<string> {
  return idsCoveredBy(adapter.claim, shell);
}

function claimCovers(
  name: AdapterName,
  sectionId: string,
  shell: Pick<VisibilityShell, "perspectiveKey" | "sectionIds">,
): boolean {
  return idsCoveredBy(claimOf(name), shell).has(sectionId);
}

function idsCoveredBy(
  claim: SectionClaim,
  shell: Pick<VisibilityShell, "perspectiveKey" | "sectionIds">,
): ReadonlySet<string> {
  if (claim.kind === "sections") return claim.ids;
  return claim.key === shell.perspectiveKey ? shell.sectionIds : new Set();
}

function allowedByCapabilities(
  requires: readonly Capability[] | undefined,
  capabilities: ReadonlySet<Capability>,
): boolean {
  if (!requires || requires.length === 0) return true;
  return requires.some((required) => capabilities.has(required));
}
