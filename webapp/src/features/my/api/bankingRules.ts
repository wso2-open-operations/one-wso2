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

import { hasAnyGroup } from "@hooks/useAsgardeoGroups";
import type { CustomLocationMapEntry } from "./types";

// The three Bank Account gating decisions: whether an Account Type's day-
// of-month cutoff has passed, whether the employee's work location is
// reimbursement-eligible, and whether the employee belongs to a role/group
// excluded from Consultancy. All three are presentation only: the banking
// backend independently re-derives and enforces each one, so a wrong answer
// here only ever hides or shows a control, never grants or denies anything
// for real. Pure functions so they're unit-testable without rendering.

/**
 * True once `today` is past the Account Type's Threshold day-of-month —
 * that Account Type's Edit action should be disabled. Compares the UTC
 * day, as the source app does, so the answer near a cutoff doesn't depend
 * on the viewer's timezone.
 */
export function isPastThreshold(today: Date, thresholdDay: number): boolean {
  return today.getUTCDate() > thresholdDay;
}

/** True when `workLocation` is on the Reimbursement Eligibility allow-list. */
export function isReimbursementEligible(
  workLocation: string | null | undefined,
  allowedLocations: readonly string[],
): boolean {
  return Boolean(workLocation) && allowedLocations.includes(workLocation as string);
}

/**
 * True when the caller belongs to any of the Account Type's Consultancy
 * Restriction groups — the Consultancy panel should not render at all.
 * Delegates to hasAnyGroup so the "does the caller hold one of these
 * groups" logic has exactly one implementation across the app.
 */
export function isConsultancyRestricted(
  callerGroups: readonly string[],
  restrictedGroups: readonly string[],
): boolean {
  return hasAnyGroup(callerGroups, restrictedGroups);
}

/** "18" -> "18th", "21" -> "21st" — for stating a Threshold's cutoff date. */
export function formatOrdinal(day: number): string {
  const rem100 = day % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

/**
 * The Bank Location options a Consultancy request may choose from: the
 * work location's own `customLocationMap` entry when the backend config has
 * one (used as-is, even if it leaves the work location out), otherwise just
 * the work location itself. Presentation only — the backend does not
 * enforce it, same as the source app.
 */
export function consultancyAllowedLocations(
  workLocation: string | null | undefined,
  customLocationMap: readonly CustomLocationMapEntry[] | undefined,
): string[] {
  const entry = customLocationMap?.find((e) => e.location === workLocation);
  if (entry) return [...entry.customMap];
  return workLocation ? [workLocation] : [];
}

/**
 * The Bank Location a Consultancy request starts on: the work location when
 * it is allowed, otherwise the first allowed location, otherwise nothing.
 */
export function initialConsultancyBankLocation(
  workLocation: string | null | undefined,
  allowedLocations: readonly string[],
): string {
  return workLocation && allowedLocations.includes(workLocation)
    ? workLocation
    : (allowedLocations[0] ?? "");
}
