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

import type { UmtStagingTestResultRecord } from "../api/umtUpdates";

export const UMT_TESTING_LIFECYCLE_STATES = [
  "TestingEnvironmentRequested",
  "TestingEnvironmentCreated",
  "TestingEnvironmentFailed",
  "StagingRequested",
  "Staging",
] as const;

export type UmtTestingResultValue = "success" | "failure" | "not_built";

export const UMT_TESTING_RESULT_OPTIONS: { value: UmtTestingResultValue; label: string }[] = [
  { value: "success", label: "Successful" },
  { value: "failure", label: "Failed" },
  { value: "not_built", label: "Not Performed" },
];

// Failed/Not Performed require a comment; Successful doesn't.
export function umtTestingResultRequiresComment(value: string): boolean {
  return value === "failure" || value === "not_built";
}

// A single persisted row already has a valid result (and a comment if the
// result requires one) — the shell's Proceed-gate rule.
export function umtStagingRowIsComplete(record: UmtStagingTestResultRecord): boolean {
  const result = record.manualTestResult?.trim() ?? "";
  if (!result) return false;
  if (umtTestingResultRequiresComment(result)) return Boolean(record.manualTestComment?.trim());
  return true;
}

// True when lifecycleState has reached Staging AND every persisted row is
// complete: an environment-ready signal from the backend, plus a
// human-reviewed-every-row check. Vacuously true for an empty/null/undefined
// record list once Staging is reached (nothing to review); false for every
// other state.
export function isTestingComplete(
  lifecycleState: string | null | undefined,
  records: UmtStagingTestResultRecord[] | null | undefined,
): boolean {
  if (lifecycleState !== "Staging") return false;
  return (records ?? []).every(umtStagingRowIsComplete);
}

// Color for the Automated Test Result indicator: green while success, red
// on failure, blue while the Jenkins build is still running, grey
// otherwise/unknown. Returned as an MUI theme color path (ready for an sx
// `bgcolor`), not a bare palette key.
export function umtAutomatedTestResultColor(value: string | null | undefined): string {
  switch ((value ?? "").toLowerCase()) {
    case "success":
      return "success.main";
    case "failure":
      return "error.main";
    case "building":
      return "info.main";
    default:
      return "grey.400";
  }
}

// Renders the raw backend value in title case (e.g. "not_built" ->
// "Not Built"). Values here are already lower_snake_case from the backend.
export function umtAutomatedTestResultLabel(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "Unknown";
  return trimmed
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

// Whether polling for staging test results should keep running: true while
// lifecycleState is one of the transient in-between states, false once it's
// reached a terminal state (Staging or Failed) — stops polling on failure
// too, not just success, so a permanently-failed environment isn't polled
// forever.
export function umtShouldPollStagingTestResults(lifecycleState: string | null | undefined): boolean {
  return (
    lifecycleState === "TestingEnvironmentRequested" ||
    lifecycleState === "TestingEnvironmentCreated" ||
    lifecycleState === "StagingRequested"
  );
}
