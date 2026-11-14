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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

export interface UmtUpdateProduct {
  productId?: string | number | null;
  product?: {
    id?: string | number | null;
    name?: string | null;
    version?: string | null;
  } | null;
  description?: string | null;
  instruction?: string | null;
  testPr?: string | null;
  ignoreTestReason?: string | null;
  // Per-product on the wire, though the backend repeats one shared value
  // across every row for a containerized update (only one field is shown).
  helmChartTag?: string | null;
  type?: string | null;
}

export interface UmtSecurityAdvisory {
  securityAdvisoryName?: string | null;
  userConsentFlag?: boolean | null;
}

// Response shape from GET /update/validate-security-advisory/{id} — loosely
// typed on the backend itself, so every field here is optional.
export interface UmtSecurityAdvisoryValidationResult {
  success?: boolean;
  status?: string;
  valid?: boolean;
  state?: string | null;
  message?: string | null;
}

export interface UmtUpdateSummary {
  id: number;
  caseId?: string | number | null;
  wso2CaseId?: string | null;
  jiraId?: string | null;
  internalGitIssue?: string | null;
  securityInternalGitIssue?: string | null;
  products?: UmtUpdateProduct[] | null;
  isHotfix?: boolean | null;
  lifecycleState?: string | null;
  assignedTo?: string | null;
  developedBy?: string | null;
  reporter?: string | null;
  reportedDate?: string | null;
  bestCaseEstimate?: string | null;
  mostLikelyEstimate?: string | null;
  worstCaseEstimate?: string | null;
  issueType?: string | null;
  lifecycle?: string | null;
  securityAdvisories?: UmtSecurityAdvisory[] | null;
  issues?: string[] | null;
  publicPullRequests?: string[] | null;
  testPullRequests?: string[] | null;
  pullRequests?: string[] | null;
  artifacts?: string[] | null;
  lastUpdatedTimestamp?: string | null;
  lastUpdatedUser?: string | null;
  highlightInstructions?: number | null;
  qaArtifactsLocation?: string | null;
  watcherList?: string[] | null;
  reason?: string | null;
  // The backend's authoritative "next lifecycle state" for whichever step is
  // currently active. The Edit tab's stepper sends promoteStages[0] as the
  // PUT body for any pure state promotion rather than hardcoding a target,
  // since the same lifecycleState can have different valid next states.
  promoteStages?: string[] | null;
  // PR-analysis progress for the current Development cycle: QUEUED,
  // PROCESSING, COMPLETED, FAILED or NONE. It describes the PR analysis
  // only, not the promotion that follows it.
  praStatus?: string | null;
  // Why the PR analysis failed, while praStatus is FAILED.
  praError?: string | null;
  // True from an analysis requested with promotion until the backend has
  // moved the update to PRAnalyzed and run its product analysis, whether
  // that worked or not.
  praPromotionPending?: boolean | null;
  // Why that promotion or product analysis failed. Cleared by the next
  // PR analysis.
  paError?: string | null;
  // Behavior-change attestation from the Description and Instruction step.
  // Persisted on the backend (unlike the step's own verification checkboxes,
  // which are not) — seeded into local state on mount/refetch so revisiting
  // this step doesn't require re-answering an already-answered question. It
  // drives the behaviour-change release email.
  productBehaviourChanges?: boolean | null;
  // Drives whether Integration Tests shows the per-product Test PR/Ignore
  // Test fields or a single Helm Chart Tag field applied to every product.
  isContainerizedUpdate?: boolean | null;
  // Set from the last PR analysis submission, alongside isContainerizedUpdate.
  isInstructionsOnly?: boolean | null;
}

export interface UmtFileOperation {
  file?: string | null;
  operation?: string | null;
  downloadURL?: string | null;
  // Populated client-side only, for manually-added rows: the SVN location or
  // GitHub raw URL the file came from (or blank for a direct upload). Kept
  // in local state purely for display — it's not part of what the backend
  // echoes back on `identifiedFileOperations`.
  sourceFilePath?: string | null;
}

export interface UmtPullRequestAnalysisItem {
  pr?: string | null;
  preferredVersion?: string | null;
}

export interface UmtBundleInfoChange {
  bundlesInfoPath?: string | null;
  jarName?: string | null;
  jarVersion?: string | null;
  relativeJarPath?: string | null;
  // Named `entryType` on the wire (verified against the backend contract) —
  // not `changeType`. Sending the wrong key means the backend never
  // receives the change type at all.
  entryType?: string | null;
}

export interface UmtDiffResponse {
  distributionPath?: string | null;
  diffOutputList?: string[] | null;
}

export interface UmtPullRequestAnalysis {
  pullRequests?: UmtPullRequestAnalysisItem[] | null;
  identifiedFileOperations?: UmtFileOperation[] | null;
  additionalFileOperations?: UmtFileOperation[] | null;
  unIdentifiedFileOperations?: UmtFileOperation[] | null;
  bundlesInfoChanges?: UmtBundleInfoChangeResult[] | null;
  diffResponses?: UmtDiffResponse[] | null;
}

// The analysis echoes each submitted bundle info change back with its change
// type under `changeType`, where the request sends it as `entryType`.
export type UmtBundleInfoChangeResult = Omit<UmtBundleInfoChange, "entryType"> & {
  changeType?: string | null;
};

export interface UmtPullRequestAnalysisRequest {
  updateId: string;
  pullRequests: UmtPullRequestAnalysisItem[];
  additionalFileOperations: UmtFileOperation[];
  bundlesInfoChanges: UmtBundleInfoChange[];
  isInstructionsOnly: boolean;
  isContainerizedUpdate: boolean;
}

export interface UmtProductAnalysisItem {
  productId?: string | number | null;
  productName?: string | null;
  baseVersion?: string | null;
  identifiedFiles?: UmtFileOperation[] | null;
}

export interface UmtProductAnalysis {
  compatibleProducts?: UmtProductAnalysisItem[] | null;
  applicableProducts?: UmtProductAnalysisItem[] | null;
  // Explains why the automated partial-applicability check was skipped for
  // this analysis, if it was.
  ignoredFilePathsDuringPartialProductAnalysis?: string[] | null;
  ignoredPartiallyApplicableProducts?: (string | { productName?: string | null; baseVersion?: string | null })[] | null;
  partiallyApplicableProductIgnoredReason?: {
    isRemoveOnly?: boolean | null;
    isTomcatUpgrade?: boolean | null;
    isJreUpgrade?: boolean | null;
    isBundleInfoChange?: boolean | null;
  } | null;
}

export interface UmtProductAnalysisRequest {
  updateNo: string;
  compatibleProducts: UmtProductAnalysisItem[];
  applicableProducts: UmtProductAnalysisItem[];
  ignoredFilePathsDuringPartialProductAnalysis: string[];
  ignoredPartiallyApplicableProducts: string[];
  partiallyApplicableProductIgnoredReason: {
    isRemoveOnly: boolean;
    isTomcatUpgrade: boolean;
    isJreUpgrade: boolean;
    isBundleInfoChange: boolean;
  };
}

// Body for PUT /update/{id}/products/details from the Description and
// Instruction save, distinct from updateProducts's whole-list replace (used by
// Product Analysis's save). Each product's current testPr, ignoreTestReason
// and helmChartTag travel back unchanged, so saving descriptions doesn't clear
// them.
export interface UmtProductDetailsRequest {
  productId: string | number;
  description: string;
  instruction: string;
  testPr: string;
  ignoreTestReason: string;
  helmChartTag: string;
}

// Body for the behaviour-change PUT /update/{id}. The approval checkbox isn't
// sent: it only gates Save.
export interface UmtBehaviorChangeRequest {
  productBehaviourChanges: boolean;
}

// Body for PUT /update/{id}/products/details from Integration Tests' own
// save — a different key set than UmtProductDetailsRequest, sent to the
// same endpoint. Always sends every key, zeroing whichever of
// testPr/ignoreTestReason/helmChartTag don't apply.
export interface UmtProductIntegrationTestRequest {
  productId: string | number;
  description: string;
  instruction: string;
  testPr: string;
  ignoreTestReason: string;
  helmChartTag: string;
}

// One row of GET/PUT /update/{id}/integrationTest/staging — a different
// resource than UmtUpdateProduct (per-product manual test review, not part
// of the main product list), named to disambiguate from the unrelated
// UmtProductIntegrationTestRequest (Integration Tests step's own PUT).
export interface UmtStagingTestResultRecord {
  productId: string | number;
  productName?: string | null;
  baseVersion?: string | null;
  manualTestResult?: string | null;
  manualTestComment?: string | null;
  // The Jenkins-driven result, distinct from the manualTestResult the user
  // enters below it — shown as a colour-coded dot so the reviewer can see
  // what the automated run concluded before entering their own verdict.
  automatedTestResult?: string | null;
  // The product's channel; the save looks the record up by it.
  channel?: string | null;
  // Link to this product's staging build; blank or missing when there is none.
  buildUrlWithBuildId?: string | null;
}

// Body for one PUT /update/{id}/integrationTest/staging call — the endpoint
// takes exactly one product per call (unlike /products/details), so
// multiple edited rows require multiple calls.
export interface UmtStagingTestResultRequest {
  productId: string | number;
  productName: string;
  baseVersion: string;
  manualTestResult: string;
  manualTestComment: string;
  channel: string;
}

export interface UmtUpdateDependency {
  from?: { id?: string | number | null } | null;
  to?: { id?: string | number | null } | null;
  type?: string | null;
}

export interface UmtHotfixInfo {
  isSuccess?: boolean;
  message?: string | null;
  hotfixUrl?: string | null;
  uploadUrl?: string | null;
  hotfixList?: string[] | null;
}

export interface UmtWorstCaseEstimateLogEntry {
  updateId: number;
  oldDate?: string | null;
  newDate?: string | null;
  timestamp?: string | null;
  changedBy?: string | null;
  reason?: string | null;
}

export interface UmtLifecycleHistoryEntry {
  timestamp?: string | null;
  fromState?: string | null;
  toState?: string | null;
  changedBy?: string | null;
}

export interface UmtUpdateBranch {
  updateNumber?: number | null;
  branchUrl?: string | null;
  supportRepoUrl?: string | null;
  publicRepoUrl?: string | null;
  releaseTag?: string | null;
  channel?: string | null;
  productName?: string | null;
  branchType?: string | null;
  jenkinsJobUrl?: string | null;
  issueKey?: string | null;
  productVersion?: string | null;
  status?: string | null;
}

// POST /update. Confirmed against the real backend's UpdateCreationRequest:
// caseId/securityInternalGitIssue/publicGitIssue each accept the sentinel
// "N/A" for whichever doesn't apply, but internalGitIssue is always a real
// required URL. The three estimate fields are local YYYY-MM-DD calendar-date
// strings (via localIsoDate), not full ISO instants — matching how
// worstCaseEstimate is already patched elsewhere in this feature.
export interface UmtCreateUpdateRequest {
  caseId: string;
  internalGitIssue: string;
  securityInternalGitIssue: string;
  publicGitIssue: string;
  bestCaseEstimate: string;
  mostLikelyEstimate: string;
  worstCaseEstimate: string;
  issueType: string;
  lifecycle: string;
  productId: number;
  hotfixRequired: boolean;
}

export interface UmtBranchCreationRequest {
  publicRepoUrl: string;
  releaseTag: string;
  channel: string;
  productName: string;
  branchType: "ComponentBranch" | "ProductBranch";
  productVersion?: string;
  jiraId?: string;
  wso2CaseId?: string;
  // Set to true when the component branch is cut from a mono repository.
  // Omit for a repository that holds one component.
  isMonoRepo?: boolean;
  // Directory from which the component branch is cut. Required when
  // isMonoRepo is true and omitted for a repository that holds one component.
  componentDirPath?: string;
}

export interface UmtComponentMaxVersionRequest {
  publicRepoUrl: string;
  releaseTag: string;
  productName: string;
  productVersion: string;
}

export interface UmtComponentMaxVersionResponse {
  version?: string | null;
}

export interface UmtUpdateFilters {
  lifecycleState: string | null;
  lifecycle: string | null;
  productName: string | null;
  productVersion: string | null;
  securityAdvisory: string | null;
  jiraId: string | null;
  serviceNowCaseId: string | null;
  internalGitIssue: string | null;
  securityInternalGitIssue: string | null;
  id: string | null;
  type: string | null;
  issueType: string | null;
  assignee: string | null;
  issue: string | null;
  pullRequest: string | null;
  artifacts: string | null;
  releasedWithoutPublicPR: string | null;
  releasedDate: string | null;
  lastUpdatedTimestampAfter: string | null;
}

export type UmtUpdateFilterDraft = Record<keyof UmtUpdateFilters, string>;

export interface UmtUpdatesResponse {
  updates: UmtUpdateSummary[];
  totalPages: number;
  pageSize: number;
}

export interface UmtUpdateSearchRequest {
  page: number;
  pageSize: number;
  filters: UmtUpdateFilters;
}

const FILTER_KEYS: (keyof UmtUpdateFilters)[] = [
  "lifecycleState", "lifecycle", "productName", "productVersion",
  "securityAdvisory", "jiraId", "serviceNowCaseId", "internalGitIssue",
  "securityInternalGitIssue", "id", "type", "issueType", "assignee",
  "issue", "pullRequest", "artifacts", "releasedWithoutPublicPR",
  "releasedDate", "lastUpdatedTimestampAfter",
];

export const EMPTY_UMT_UPDATE_FILTERS: UmtUpdateFilters = Object.fromEntries(
  FILTER_KEYS.map((key) => [key, null]),
) as unknown as UmtUpdateFilters;

export const EMPTY_UMT_UPDATE_FILTER_DRAFT: UmtUpdateFilterDraft = Object.fromEntries(
  FILTER_KEYS.map((key) => [key, ""]),
) as UmtUpdateFilterDraft;

// All three are `java.util.Date` on the backend's UpdatesRequest.Filters —
// `releasedWithoutPublicPR` reads like a flag but means "released without a
// public PR as of this date", and is rendered as a date input in the drawer.
const DATE_FILTERS = new Set<keyof UmtUpdateFilters>([
  "releasedWithoutPublicPR", "releasedDate", "lastUpdatedTimestampAfter",
]);

function wireDate(value: string): string {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

export function filtersFromDraft(draft: UmtUpdateFilterDraft): UmtUpdateFilters {
  return Object.fromEntries(
    FILTER_KEYS.map((key) => {
      const value = draft[key].trim();
      return [key, value ? (DATE_FILTERS.has(key) ? wireDate(value) : value) : null];
    }),
  ) as unknown as UmtUpdateFilters;
}

export function draftFromFilters(filters: UmtUpdateFilters): UmtUpdateFilterDraft {
  return Object.fromEntries(
    FILTER_KEYS.map((key) => {
      const value = filters[key];
      return [key, value && DATE_FILTERS.has(key) ? value.slice(0, 10) : (value ?? "")];
    }),
  ) as UmtUpdateFilterDraft;
}

export function activeUmtFilterCount(filters: UmtUpdateFilters): number {
  return Object.values(filters).filter((value) => value !== null && value !== "").length;
}

// GET /update?lifecycleState=X returns every match in one response, in the
// record-count envelope that endpoint uses rather than the page envelope the
// search endpoint returns.
export interface UmtUpdatesByLifecycleStateResponse {
  recordsTotal: number;
  recordsFiltered: number;
  data: UmtUpdateSummary[];
}

// The UI page is zero-based. The backend computes its SQL offset with
// `(page - 1) * pageSize`, so its contract is one-based.
export function createUmtUpdateSearchRequest(
  uiPage: number,
  pageSize: number,
  filters: UmtUpdateFilters,
): UmtUpdateSearchRequest {
  return { page: uiPage + 1, pageSize, filters };
}
