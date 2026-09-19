// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy at
// http://www.apache.org/licenses/LICENSE-2.0

import { localIsoDate } from "@utils/localDate";
import type { UmtMetadataProduct } from "../api/umtTypes";
import type { UmtCreateUpdateRequest } from "../api/umtUpdates";

export type UmtCreateUpdateType = "regular" | "security" | "cloud-support";
export type UmtCreateIssueType = "bug" | "improvement" | "new-feature";

const NOT_APPLICABLE = "N/A";

const LIFECYCLE_BY_UPDATE_TYPE: Record<UmtCreateUpdateType, string> = {
  regular: "UpdateLifecycle",
  security: "SecurityUpdateLifecycle",
  "cloud-support": "CloudSupportLifecycle",
};

const ISSUE_TYPE_LABEL: Record<UmtCreateIssueType, string> = {
  bug: "Bug",
  improvement: "Improvement",
  "new-feature": "New Feature",
};

// Regular updates are planned on Thursdays in the source workflow. "Next"
// means a future Thursday even when today is Thursday; the three estimates
// start one week apart and hotfixes may then select any date.
export function nextThursday(): Date {
  const date = new Date();
  const days = (4 - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + days);
  return date;
}

export function laterDate(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// A format check only — the backend does the authoritative existence check
// via a real GitHub API call.
const GITHUB_ISSUE_URL_REGEX =
  /^https:\/\/github\.com\/[^/]*wso2[^/]*\/[A-Za-z0-9-]+\/issues\/[0-9]+\/?$/;

export function isValidGithubIssueUrl(value: string): boolean {
  return GITHUB_ISSUE_URL_REGEX.test(value.trim());
}

// A case id must match this format whenever one is present (required
// unless the update is proactive).
const CASE_ID_REGEX = /^CS[0-9]+/;

export function isValidCaseId(value: string): boolean {
  return CASE_ID_REGEX.test(value.trim());
}

// Every estimate must land on a Thursday unless the update is a hotfix, in
// which case any date is allowed.
export function isValidEstimateDate(date: Date, isHotfix: boolean): boolean {
  return isHotfix || date.getDay() === 4;
}

// Cloud Support has no version selection (its Version field is disabled), so
// unlike every other update type it can't resolve productId by matching a
// version string. Instead it resolves from the selected product's
// single/first metadata row.
export function resolveCreateUpdateProductId(
  products: Record<string, UmtMetadataProduct[]>,
  productName: string | null,
  version: string | null,
  showAllVersions: boolean,
  isCloudSupport: boolean,
): number | null {
  if (!productName) return null;
  const rows = products[productName] ?? [];
  if (rows.length === 0) return null;

  if (isCloudSupport) return rows[0].id;
  if (!version) return null;

  const match = rows.find((row) => (showAllVersions ? row.version : row.latestVersion) === version);
  return match?.id ?? null;
}

export interface UmtCreateUpdateFormValues {
  isProactive: boolean;
  isHotfix: boolean;
  updateType: UmtCreateUpdateType;
  issueType: UmtCreateIssueType;
  caseId: string;
  internalGitIssue: string;
  publicOrSecurityGitIssue: string;
  productId: number | null;
  bestCaseEstimate: Date | null;
  mostLikelyEstimate: Date | null;
  worstCaseEstimate: Date | null;
}

function isValidDate(date: Date | null): boolean {
  return date !== null && !Number.isNaN(date.getTime());
}

// Strict day-after check on calendar dates (not 24h, so it's DST-safe):
// `after` must fall on a later calendar day than `before`. Exported so the
// dialog's inline per-field messages use the exact same rule as the submit
// gate.
export function isAfterDay(before: Date, after: Date): boolean {
  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return startOfDay(after) > startOfDay(before);
}

export function isCreateUpdateFormValid(values: UmtCreateUpdateFormValues): boolean {
  const hasCaseId = values.isProactive || isValidCaseId(values.caseId);
  // DatePicker reports a truthy but Invalid Date while the user is mid-typing
  // an unparseable value, so a plain null-check isn't enough here.
  const hasValidDates =
    isValidDate(values.bestCaseEstimate) &&
    isValidDate(values.mostLikelyEstimate) &&
    isValidDate(values.worstCaseEstimate);

  // The picker's minDate/shouldDisableDate props only stop a *pick* out of
  // order or off-Thursday — a typed date bypasses both, so the ordering and
  // Thursday rules must also be enforced here at submit time.
  const hasOrderedDates =
    hasValidDates &&
    isAfterDay(values.bestCaseEstimate!, values.mostLikelyEstimate!) &&
    isAfterDay(values.mostLikelyEstimate!, values.worstCaseEstimate!);

  const hasThursdayDates =
    hasValidDates &&
    isValidEstimateDate(values.bestCaseEstimate!, values.isHotfix) &&
    isValidEstimateDate(values.mostLikelyEstimate!, values.isHotfix) &&
    isValidEstimateDate(values.worstCaseEstimate!, values.isHotfix);

  return (
    hasCaseId &&
    values.productId !== null &&
    hasValidDates &&
    hasOrderedDates &&
    hasThursdayDates &&
    isValidGithubIssueUrl(values.internalGitIssue) &&
    isValidGithubIssueUrl(values.publicOrSecurityGitIssue)
  );
}

export function buildUmtCreateUpdateRequest(values: UmtCreateUpdateFormValues): UmtCreateUpdateRequest {
  const isSecurityUpdate = values.updateType === "security";

  return {
    caseId: values.isProactive ? NOT_APPLICABLE : values.caseId.trim(),
    internalGitIssue: values.internalGitIssue.trim(),
    securityInternalGitIssue: isSecurityUpdate ? values.publicOrSecurityGitIssue.trim() : NOT_APPLICABLE,
    publicGitIssue: isSecurityUpdate ? NOT_APPLICABLE : values.publicOrSecurityGitIssue.trim(),
    bestCaseEstimate: localIsoDate(values.bestCaseEstimate!),
    mostLikelyEstimate: localIsoDate(values.mostLikelyEstimate!),
    worstCaseEstimate: localIsoDate(values.worstCaseEstimate!),
    issueType: ISSUE_TYPE_LABEL[values.issueType],
    lifecycle: LIFECYCLE_BY_UPDATE_TYPE[values.updateType],
    productId: values.productId!,
    hotfixRequired: values.isHotfix,
  };
}
