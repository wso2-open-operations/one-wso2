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
  BabyIcon,
  CalendarDaysIcon,
  CloudSunIcon,
  CompassIcon,
  FileCheckIcon,
  HeartIcon,
  HeartHandshakeIcon,
  RepeatIcon,
  ThermometerIcon,
  TimerIcon,
  UmbrellaIcon,
  type LucideIcon,
} from "@wso2/oxygen-ui-icons-react";

// DTOs + enums mirrored from people-ops-suite/apps/leave-app/backend.
// Field names match the wire format. Source of truth: the backend's
// types.bal / modules/database/{types,enum}.bal.

// ---- enums -----------------------------------------------------------------

export type LeaveType =
  | "casual"
  | "sick"
  | "annual"
  | "lieu"
  | "maternity"
  | "paternity"
  | "sabbatical"
  | "conges_payes"
  | "rtt"
  | "compassionate"
  | "other_authorized";

export type LeavePeriodType = "multiple" | "one" | "half";

export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export type OrderBy = "ASC" | "DESC";

// leave-app employee statuses (from the HR system).
export type EmployeeStatus = "Active" | "Marked leaver" | "Left";

// leave-app privilege numbers — DISTINCT from people-app's. The leave
// backend's /user-info returns these in `privileges`.
export const LEAVE_PRIVILEGE = {
  EMPLOYEE: 987,
  INTERN: 678,
  LEAD: 879,
  PEOPLE_OPS_TEAM: 789,
  /** General leave report across all employees. Sent to People Ops too. */
  GENERAL_REPORT: 456,
  /** Sabbatical report across all employees. Sent to People Ops too. */
  SABBATICAL_REPORT: 654,
  /** Reads the France sick notes uploaded with sick leave. */
  SICK_NOTE_READER: 321,
} as const;

// ---- user / config ---------------------------------------------------------

export interface LeaveUserInfo {
  employeeId: string | null;
  firstName: string | null;
  lastName: string | null;
  workEmail: string | null;
  leadEmail: string | null;
  employeeThumbnail: string | null;
  jobRole: string | null;
  privileges: number[];
  employmentStartDate: string | null;
  isLead: boolean | null;
  subordinateCount: number;
  location: string | null;
  jobBand: number | null;
}

export interface DefaultMail {
  email: string;
  thumbnail?: string;
}

export interface AppConfig {
  isSabbaticalLeaveEnabled: boolean;
  sabbaticalLeavePolicyUrl: string;
  sabbaticalLeaveUserGuideUrl: string;
  sabbaticalLeaveEligibilityDuration: number;
  sabbaticalLeaveMaxApplicationDuration: number;
  sabbaticalLeaveMinJobBand: number;
  // Absent from an older backend.
  sickNoteMaxBytes?: number;
  sickNoteContentTypes?: string[];
  cachedEmails: {
    mandatoryMails: DefaultMail[];
    optionalMails: DefaultMail[];
  };
}

// ---- leaves ----------------------------------------------------------------

// The row shape returned by GET /leaves (database:Leave).
export interface DatabaseLeave {
  id: number;
  email: string;
  leaveType: string | null;
  periodType: string | null;
  copyEmailList: string | null;
  notifyEveryone: boolean | null;
  submitComment: string | null;
  cancelComment: string | null;
  createdDate: string | null;
  updatedDate: string | null;
  emailId: string | null;
  emailSubject: string | null;
  startDate: string;
  endDate: string;
  startHalf: number | null;
  isEndHalf: boolean | null;
  canceledDate: string | null;
  numberOfDays: number | null;
  isPublicComment: boolean | null;
  calendarEventId: string | null;
  location: string | null;
  status: LeaveStatus | null;
  approverEmail: string | null;
  // Optional: an older backend omits them.
  rejectionReason?: string | null;
  hasSickNote?: boolean;
  sickNoteDeletedOn?: string | null;
}

// One uploaded sick note, as listed by the sick-notes report.
export interface SickNoteSummary {
  leaveId: number;
  email: string;
  startDate: string;
  endDate: string;
  numberOfDays: number;
  status: LeaveStatus;
  uploadedAt: string;
  deletedAt: string | null;
  sizeBytes: number;
  contentType: string;
}

export interface FetchedLeavesRecord {
  leaves: DatabaseLeave[];
}

// POST /leaves?isValidationOnlyMode=true body — `types.ts:128-133`. Four
// fields, no comment and no recipients: this asks the backend to count working
// days, not to record anything.
export interface LeaveValidationPayload {
  startDate: string;
  endDate: string;
  isMorningLeave?: boolean | null;
  periodType?: LeavePeriodType;
}

// POST /leaves body — `types.ts:164-173`.
export interface LeavePayload extends LeaveValidationPayload {
  leaveType?: LeaveType;
  emailRecipients?: string[];
  calendarEventId?: string | null;
  /**
   * Always a string, never null — `types.ts:169` types it as a required
   * `string` and the source sends its raw state, which is "" when untouched.
   */
  comment: string;
  isPublicComment?: boolean;
  emailSubject?: string | null;
}

// POST /leaves?isValidationOnlyMode=true response.
export interface CalculatedLeave {
  workingDays: number;
  hasOverlap: boolean;
  message?: string;
  holidays?: { title: string; date: string }[];
}

// ---- employees / entitlement -----------------------------------------------

export interface MinimalEmployeeInfo {
  firstName: string;
  lastName: string;
  workEmail: string;
  employeeThumbnail: string;
  employeeStatus: string | null;
}

export interface LeavePolicy {
  annual?: number | null;
  casual?: number | null;
  congesPayes?: number | null;
  rtt?: number | null;
  sick?: number | null;
}

export interface LeaveEntitlement {
  year: number;
  location: string | null;
  leavePolicy: LeavePolicy;
  policyAdjustedLeave: LeavePolicy;
  periodStart?: string | null;
  periodEnd?: string | null;
}

// ---- filter params for GET /leaves ----------------------------------------

export interface LeaveFilter {
  email?: string;
  startDate?: string;
  endDate?: string;
  approverEmail?: string;
  leaveCategory?: LeaveType[];
  statuses?: LeaveStatus[];
  limit?: number;
  offset?: number;
  orderBy?: OrderBy;
  employeeStatuses?: EmployeeStatus[];
  subordinatesLeaves?: boolean;
  excludedLeaveCategory?: LeaveType[];
}

// ---- display helpers -------------------------------------------------------

// Everyday (non-sabbatical) leave types offered in the Apply form.
export const GENERAL_LEAVE_TYPES: LeaveType[] = [
  "casual",
  "annual",
  "sick",
  "lieu",
  "maternity",
  "paternity",
  "conges_payes",
  "rtt",
  "compassionate",
  "other_authorized",
];

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  casual: "Casual",
  sick: "Sick",
  annual: "Annual",
  lieu: "Lieu",
  maternity: "Maternity",
  paternity: "Paternity",
  sabbatical: "Sabbatical",
  conges_payes: "Congés Payés",
  rtt: "RTT",
  compassionate: "Compassionate",
  other_authorized: "Other Authorized",
};

// Leave that does not count toward a leave total. Time off in lieu is earned
// back rather than drawn down, so adding it to "total leave" overstates what was
// consumed.
//
// Not our rule: the leave microapp marks lieu `isCounted: false`
// (constants.js:62-68) and its backend enforces the same exclusion when it
// builds `totalCount` (`UncountedLeaves = LIEU_LEAVE`, types.bal:182,
// service.bal:169-171). Kept identical so the totals here and the ones people
// already read in the microapp agree.
export const UNCOUNTED_LEAVE_TYPES: LeaveType[] = ["lieu"];

// How a leave's status is named and coloured, everywhere it is shown — the
// status chip on a card, and the totals above the history grid. Here rather
// than in LeaveChips so a non-component module can read them.
export const STATUS_COLOR: Record<LeaveStatus, "success" | "error" | "warning" | "default"> = {
  APPROVED: "success",
  REJECTED: "error",
  PENDING: "warning",
  CANCELLED: "default",
};

export const STATUS_LABEL: Record<LeaveStatus, string> = {
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PENDING: "Pending",
  CANCELLED: "Cancelled",
};

export const LEAVE_TYPE_ICON: Record<LeaveType, LucideIcon> = {
  casual: CloudSunIcon,
  sick: ThermometerIcon,
  annual: UmbrellaIcon,
  lieu: RepeatIcon,
  maternity: HeartHandshakeIcon,
  paternity: BabyIcon,
  sabbatical: CompassIcon,
  conges_payes: UmbrellaIcon,
  rtt: TimerIcon,
  compassionate: HeartIcon,
  other_authorized: FileCheckIcon,
};

/** Icon for a leave type that isn't in the known set. */
export const LEAVE_TYPE_ICON_FALLBACK: LucideIcon = CalendarDaysIcon;

// One colour per leave type, from LeadReportTable.tsx:27-37. The report table
// tints its chip per type so a column of them can be read at a glance; the port
// had made every chip the same primary outline, which throws that away.
//
// These are the source's literal hex values, kept as such rather than mapped to
// palette roles: there is no palette role that means "sabbatical", and picking
// near equivalents would drift the moment the theme changes.
export const LEAVE_TYPE_COLOR: Record<LeaveType, string> = {
  casual: "#ff9800",
  annual: "#3f51b5",
  sick: "#2196f3",
  sabbatical: "#9c27b0",
  maternity: "#4caf50",
  paternity: "#009688",
  lieu: "#00bcd4",
  conges_payes: "#607d8b",
  rtt: "#795548",
  compassionate: "#e91e63",
  other_authorized: "#ff5722",
};

/** LeadReportTable.tsx:76 — the tint for a type the registry does not know. */
export const LEAVE_TYPE_COLOR_FALLBACK = "#607d8b";

// Default leave type per location (matches leave-app's LOCATION defaults).
export function defaultLeaveTypeForLocation(location: string | null | undefined): LeaveType {
  switch (location) {
    case "France":
      return "conges_payes";
    case "Spain":
      return "annual";
    default:
      return "casual";
  }
}

// Which of the location-specific (quota-tracked) leave types apply where,
// plus an eligibility caveat where one exists — matches leave-app's
// LOCATION_LEAVE_TYPES (LeaveSelection.tsx) exactly, including the two
// India entries that are only available in a specific state. `info` is
// eligibility policy, not a glossary note — it's rendered as always-visible
// text under the button (see LeaveSelectionIcon.tsx), not a hover tooltip.
// Sri Lanka (and any location we don't otherwise recognize) only gets
// casual — matches leave-app's EmployeeLocation.LK default branch.
const LOCATION_LEAVE_TYPES: Record<string, { type: LeaveType; info?: string }[]> = {
  "Sri Lanka": [{ type: "casual" }],
  India: [
    { type: "annual" },
    { type: "casual", info: "Maharashtra only" },
    { type: "sick", info: "Karnataka only" },
  ],
  France: [
    { type: "conges_payes" },
    { type: "rtt" },
    { type: "sick" },
    { type: "compassionate" },
    { type: "other_authorized" },
  ],
  Spain: [{ type: "annual" }, { type: "casual" }, { type: "sick" }],
};

// Shown regardless of location — not quota-tracked, so there's nothing
// location-specific about them.
const COMMON_LEAVE_TYPES: LeaveType[] = ["maternity", "paternity", "lieu"];

function locationEntries(
  location: string | null | undefined,
): { type: LeaveType; info?: string }[] {
  return (
    (location ? LOCATION_LEAVE_TYPES[location] : undefined) ?? LOCATION_LEAVE_TYPES["Sri Lanka"]
  );
}

// The eligibility caveat for a (location, type) pair, if one exists — e.g.
// "Maharashtra only" for India's Casual. Render this next to the type
// button whenever it's present; undefined means no caveat.
export function leaveTypeInfo(
  location: string | null | undefined,
  type: LeaveType,
): string | undefined {
  return locationEntries(location).find((e) => e.type === type)?.info;
}

// Locations the leave-entitlement endpoint actually has data for — matches
// leave-app's LeaveBalanceSummary.tsx LOCATION_KEYS, which only defines
// France/Spain (Sri Lanka/India aren't tracked there at all, even though
// they do have location-specific *types* for Apply-form gating above).
// Deliberately a separate, smaller list from LOCATION_LEAVE_TYPES — reusing
// that one here would show a (meaningless/zero) balance panel for every
// location instead of just the two the entitlement data covers.
const BALANCE_TRACKED_LOCATIONS = new Set(["France", "Spain"]);

// The quota-tracked types for a location, for the balance panel — matches
// leave-app's LeaveBalanceSummary, which only ever renders for France/Spain.
export function quotaTrackedTypesForLocation(location: string | null | undefined): LeaveType[] {
  if (!location || !BALANCE_TRACKED_LOCATIONS.has(location)) return [];
  // Only types with a policy field have a balance to show. France's
  // Compassionate and Other Authorized are selectable on Apply but untracked.
  return (LOCATION_LEAVE_TYPES[location] ?? [])
    .map((e) => e.type)
    .filter((t) => t in LEAVE_TYPE_POLICY_KEY);
}

// The Apply form's selectable leave types for a given location — matches
// leave-app's LeaveSelection.tsx (location-specific + common), rather than
// offering every general type to everyone regardless of where they are.
export function leaveTypesForLocation(location: string | null | undefined): LeaveType[] {
  return [...locationEntries(location).map((e) => e.type), ...COMMON_LEAVE_TYPES];
}

// A short explainer for types whose name alone doesn't say what they are —
// matches leave-app's LeaveTooltip.
export const LEAVE_TYPE_TOOLTIP: Partial<Record<LeaveType, string>> = {
  conges_payes: "Paid Annual Leave",
  rtt: "Réduction du Temps de Travail",
  compassionate: "Leave for a bereavement or serious family event",
  other_authorized: "Other authorised absence, approved by your lead",
};

// Maps a leave type to its LeavePolicy/LeaveEntitlement field — undefined
// for types that aren't quota-tracked (maternity/paternity/lieu/sabbatical).
export const LEAVE_TYPE_POLICY_KEY: Partial<Record<LeaveType, keyof LeavePolicy>> = {
  casual: "casual",
  annual: "annual",
  sick: "sick",
  conges_payes: "congesPayes",
  rtt: "rtt",
};
