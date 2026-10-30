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

import type { LeaveType } from "../api/leaveTypes";
import { CANCEL_WINDOW_DAYS } from "./franceLeave";

// User-visible copy, transcribed from the leave-app.
//
// The source centralises its result messages in `config/constant.ts`
// (`SnackMessage`) and its labels in `types/types.ts` (`LeaveLabel`,
// `LeaveTooltip`, `DayPortionLabel`). The port had reused none of it and wrote
// its own wording inline at every call site, which is how 38 of 76 strings
// ended up reworded and 17 missing.
//
// Nothing here is invented. A string that the source does not have is a
// question, not something to write.

/**
 * The caption beside Submit, telling the user who will read their comment —
 * `GeneralLeave.tsx:345-349`. The port had dropped it, so nothing on screen
 * explained what the Public comment switch actually changes.
 */
export const PUBLIC_COMMENT_NOTE = {
  public: "Your comment will be visible to all email recipients.",
  private: "Your comment will be visible to all email recipients except the WSO2 Vacation Group.",
} as const;

/** The Public comment switch — `AdditionalComment.tsx:62`. */
export const PUBLIC_COMMENT_LABEL = "Public comment";

/** `LeaveCard.tsx:50-57`. */
export const CANCEL_CONFIRMATION = {
  title: "Do you want to cancel this leave?",
  body: (args: { leaveLabel: string; startDate: string; endDate: string }) =>
    `This will cancel your ${args.leaveLabel} (${args.startDate} \u2013 ${args.endDate}). ` +
    `This action cannot be undone.`,
  confirm: "Yes, Cancel",
  dismiss: "No, Keep It",
} as const;

/** What My history shows on a card for rejection reasons and sick notes. */
export const HISTORY_CARD_COPY = {
  rejectionReason: (reason: string) => `Reason: ${reason}`,
  downloadSickNote: "Download sick note",
  sickNoteDeleted: (date: string) => `Sick note deleted on ${date}`,
  cancelPastWindow: `Past the ${CANCEL_WINDOW_DAYS}-day cancellation window`,
} as const;

/** `LeaveHistory.tsx:151`. */
export const noLeaveHistoryFor = (year: number) => `No leave history available for ${year}.`;

/**
 * The Apply form's own submit messages — `GeneralLeave.tsx:147,158`.
 *
 * Deliberately not `SnackMessage.submitLeaveMessage`: GeneralLeave calls the
 * API directly (`GeneralLeave.tsx:145-147`) and hardcodes its own strings, the
 * success one ending in an exclamation mark the shared constant does not have.
 *
 * The sabbatical path dispatches the `submitLeave` thunk, which raises
 * `SnackMessage.success.submitLeaveMessage` instead (`leave.ts:150-156`) — so
 * the same event is worded two ways, and LeaveSabbaticalPage uses that one.
 */
export const SUBMIT_SUCCESS = "Leave request submitted successfully!";
/** Other Authorized is approved by the employee's lead, not auto-approved. */
export const OTHER_AUTHORIZED_SUBMIT_SUCCESS = "Your request has been sent to your lead for approval.";
export const OTHER_AUTHORIZED_CONFIRMATION_NOTE = "This request goes to your lead for approval.";
/** The comment box while Other Authorized is picked: a required, private reason. */
export const OTHER_AUTHORIZED_REASON = {
  label: "Reason",
  placeholder: "Tell your lead why you need this leave (required)…",
  note: "Your reason goes to your lead for approval and is never made public.",
} as const;

/** The sick-note field on Apply (France sick leave only). */
export const SICK_NOTE_COPY = {
  title: "Sick note",
  loadingLimits: "Loading upload limits…",
  chooseFile: "Choose sick note file",
  changeFile: "Change sick note file",
  remove: "Remove sick note",
  /** `maxMb` is already formatted, e.g. "5.0". */
  help: (maxMb: string): string =>
    `A sick note is required for sick leave. Upload a PDF, JPG or PNG file of up to ${maxMb} MB.`,
} as const;
export const SUBMIT_FAILED_FALLBACK = "Failed to submit leave request. Please try again.";

/** Other Authorized approvals, for leads. */
export const OTHER_AUTHORIZED_APPROVE = {
  empty: "No pending Other Authorized requests.",
  historyEmpty: "No Other Authorized decisions yet.",
  columns: {
    employee: "Employee",
    startDate: "Start",
    endDate: "End",
    dayCount: "Days",
    comment: "Comment",
    waiting: "Waiting",
    status: "Status",
    reason: "Reason",
    decision: "Decision",
  },
  approve: "Approve",
  reject: "Reject",
  working: "Working…",
  approveDialog: {
    title: "Approve this request?",
    body: (email: string, dateRange: string) =>
      `This will approve the Other Authorized leave for ${email} (${dateRange}). ` +
      "The team is emailed and a calendar invite is sent.",
    cancel: "Cancel",
    confirm: "Yes, Approve",
  },
  rejectDialog: {
    title: "Reject this request?",
    body: "The reason is emailed to the employee.",
    label: "Reason for rejecting",
    cancel: "Cancel",
    confirm: "Reject",
    counter: (used: number, max: number) => `${used} / ${max}`,
  },
} as const;

/** `config/constant.ts:17-43`. */
export const SnackMessage = {
  success: {
    cancelLeaveMessage: "Leave cancelled successfully",
    submitLeaveMessage: "Leave request submitted successfully",
    approveLeaveMessage: "Leave request approved successfully",
    rejectLeaveMessage: "Leave request rejected successfully",
  },
  error: {
    insufficientPrivileges: "Insufficient Privileges",
    fetchPrivileges: "Failed to fetch Privileges",
    fetchEmployees: "Unable to retrieve list of Employees",
    fetchAppConfigMessage: "Unable to retrieve app configurations",
    fetchLeaveHistoryMessage: "Unable to retrieve leave history",
    cancelLeaveMessage: "Failed to cancel leave",
    submitLeaveMessage: "Failed to submit leave request",
    approveLeaveMessage: "Failed to approve leave request",
    rejectLeaveMessage: "Failed to reject leave request",
  },
} as const;

/**
 * Blocking messages on the Apply form — `GeneralLeave.tsx:165-189`.
 *
 * The port had dropped all four and disabled the button instead, which tells
 * someone nothing about why. Two of them are unreachable here because the
 * port's state cannot hold a null portion or a null leave type; they are
 * transcribed anyway so the set stays complete if that ever changes.
 */
export const VALIDATION_MESSAGE = {
  datesRequired: "Please select start and end dates",
  workingDaysRequired: "Working days must be at least 1 to submit a leave request",
  portionRequired: "Please select a portion of the day",
  leaveTypeRequired: "Please select a leave type",
} as const;

/**
 * Checked when Fetch Report is pressed — `Toolbar.tsx:95-107`. The port had
 * only a `min` attribute on the To field, which a typed date bypasses.
 */
export const REPORT_VALIDATION_MESSAGE = {
  datesRequired: "Please select both start and end dates",
  endBeforeStart: "End date must be after start date",
} as const;

/** The confirmation before a leave is posted — `GeneralLeave.tsx:222-229`. */
export const SUBMIT_CONFIRMATION = {
  title: "Do you want to submit this leave?",
  okText: "Yes",
  cancelText: "No",
  /**
   * `GeneralLeave.tsx:224`. Names the type, the working days, the range and the
   * portion, so the reader can check what they are about to send rather than
   * being asked to confirm an unlabelled action.
   *
   * The portion words here are the source's own — "Full day" / "Morning" /
   * "Afternoon" — which are NOT the DAY_PORTION_LABEL values used on the
   * buttons ("Full Day" / "First Half" / "Second Half").
   */
  body: (args: {
    leaveLabel: string;
    workingDays: number;
    dateRange: string;
    portionLabel: string;
  }): string =>
    `This will submit a ${args.leaveLabel} request for ${args.workingDays} working day` +
    `${args.workingDays !== 1 ? "s" : ""} (${args.dateRange}, ${args.portionLabel}).`,
} as const;

/** `GeneralLeave.tsx:212-217` — the confirmation's wording, not the buttons'. */
export const CONFIRMATION_PORTION_LABEL = {
  full: "Full day",
  first: "Morning",
  second: "Afternoon",
} as const;

/** `types/types.ts:50-54`. */
export const DAY_PORTION_LABEL = {
  full: "Full Day",
  first: "First Half",
  second: "Second Half",
} as const;

/** `types/types.ts:109-113` — only these three carry one. */
export const LEAVE_TOOLTIP: Partial<Record<LeaveType, string>> = {
  conges_payes: "Paid Annual Leave",
  rtt: "Réduction du Temps de Travail",
  sick: "Sick Leave",
};

// `types/types.ts:93-106`. Twelve labels for nine types, because four of them
// are named differently depending on where the employee sits: `casual` is
// "Casual/Annual" in Sri Lanka, "Casual" in India and "Casual Leave" in Spain.
// Collapsing them to one label each — which the port had done — renames leave
// for three of the four locations.
const LEAVE_LABEL = {
  CASUAL: "Casual/Annual",
  MATERNITY: "Maternity",
  PATERNITY: "Paternity",
  LIEU: "Lieu",
  SABBATICAL: "Sabbatical",
  SICK: "Sick Leave",
  CONGES_PAYES: "Congés Payés",
  RTT: "RTT",
  SPAIN_ANNUAL: "Annual Leave",
  SPAIN_CASUAL: "Casual Leave",
  INDIA_ANNUAL: "Annual / Earned",
  INDIA_CASUAL: "Casual",
} as const;

/** Shown in every location — `LeaveSelection.tsx:51-55`. */
const COMMON_LABELS: Partial<Record<LeaveType, string>> = {
  maternity: LEAVE_LABEL.MATERNITY,
  paternity: LEAVE_LABEL.PATERNITY,
  lieu: LEAVE_LABEL.LIEU,
  sabbatical: LEAVE_LABEL.SABBATICAL,
};

/** Per-location, from `LeaveSelection.tsx:57-109`. */
const LOCATION_LABELS: Record<string, Partial<Record<LeaveType, string>>> = {
  "Sri Lanka": { casual: LEAVE_LABEL.CASUAL },
  India: {
    annual: LEAVE_LABEL.INDIA_ANNUAL,
    casual: LEAVE_LABEL.INDIA_CASUAL,
    sick: LEAVE_LABEL.SICK,
  },
  France: {
    conges_payes: LEAVE_LABEL.CONGES_PAYES,
    rtt: LEAVE_LABEL.RTT,
    sick: LEAVE_LABEL.SICK,
  },
  Spain: {
    annual: LEAVE_LABEL.SPAIN_ANNUAL,
    casual: LEAVE_LABEL.SPAIN_CASUAL,
    sick: LEAVE_LABEL.SICK,
  },
};

/**
 * What this leave type is called where this employee sits.
 *
 * Falls back to Sri Lanka for an unknown location, matching the source's
 * `EmployeeLocation.LK` default branch, and then to the generic label so a type
 * offered outside its own location still has a name rather than a blank.
 */
export function leaveTypeLabel(location: string | null | undefined, type: LeaveType): string {
  const forLocation = (location ? LOCATION_LABELS[location] : undefined) ?? LOCATION_LABELS["Sri Lanka"];
  return forLocation[type] ?? COMMON_LABELS[type] ?? GENERIC_LABEL[type];
}

/**
 * Used where there is no location to hand — a report row, a history card for
 * someone else's leave. `GeneralLeave.tsx:74-81` uses this same shape for its
 * entitlement warning, including mapping `annual` to "Casual/Annual", which
 * reads oddly but is what the source says.
 */
export const GENERIC_LABEL: Record<LeaveType, string> = {
  casual: LEAVE_LABEL.CASUAL,
  annual: LEAVE_LABEL.CASUAL,
  sick: LEAVE_LABEL.SICK,
  lieu: LEAVE_LABEL.LIEU,
  maternity: LEAVE_LABEL.MATERNITY,
  paternity: LEAVE_LABEL.PATERNITY,
  sabbatical: LEAVE_LABEL.SABBATICAL,
  conges_payes: LEAVE_LABEL.CONGES_PAYES,
  rtt: LEAVE_LABEL.RTT,
  compassionate: "Compassionate",
  other_authorized: "Other Authorized",
};

// ---------------------------------------------------------------------------
// Sabbatical
// ---------------------------------------------------------------------------
//
// Transcribed from view/SabbaticalLeave/ and view/LeadReport/. None of it is
// centralised in the source — every string below is an inline literal there,
// cited to the line it came from.
//
// The doubled spaces in some titles are the source's, not typos. Its `Title`
// component renders `<span>{firstWord}</span> {secondWord}` with a literal space
// between, and several callers pass a leading or trailing space of their own
// (SabbaticalLeave.tsx:39, ApproveLeaveTab.tsx:64, ApproveHistoryTab.tsx:59).

export const SABBATICAL = {
  /** SabbaticalLeave.tsx:38-41 — the whole apply screen when the flag is off. */
  featureOff: "Sabbatical  Leave Feature is currently not available. Please check again later.",

  apply: {
    title: "Sabbatical Leave Application", // ApplyTab.tsx:316
    userGuide: "User Guide", // :324

    /** :330-333. Shown INSTEAD of the form — this is the hard block. */
    noLeadTitle: "Reporting lead not set",
    noLeadBody:
      "Sabbatical leave requires a reporting lead for the approval process. Your lead is " +
      "currently not set in the people management system. Please contact the People " +
      "Operations team to update your profile before applying.",

    /** Policy V2.6. Shown INSTEAD of the form, like the missing-lead block. */
    jobBandTitle: "Not eligible for sabbatical leave",
    jobBandBelow: (minJobBand: number) =>
      `Sabbatical leave is available for job band ${minJobBand} and above.`,
    jobBandMissing:
      "Your job band is not recorded in the people management system. Please contact the " +
      "People Operations team to apply for sabbatical leave.",

    employmentStartDate: "Employment Start date", // :343 — always read-only
    lastSabbaticalEndDate: "Last sabbatical leave end date", // :350
    startDate: "Leave request start date*", // :371
    endDate: "Leave request end date*", // :392
    commentLabel: "Additional Comments:", // :417
    commentPlaceholder: "Add a comment...", // :420 — three dots, not an ellipsis
    submit: "Apply", // :518

    /** The acknowledgements. All required; the second carries a link. */
    ackManagerApproval:
      "I confirm that I have discussed my sabbatical leave plans with my lead and have " +
      "obtained their approval.", // :441
    ackPolicyBefore: "I have read and understood the terms of the ", // :467
    ackPolicyLink: "Sabbatical Leave Policy", // :474
    ackPolicyAfter: ".", // :476
    /** :502. "6 months" is hardcoded copy in the source, not config-driven. */
    ackResignation:
      "I acknowledge that I cannot voluntarily resign from my employment for 6 months after " +
      "completing sabbatical leave. If I do, I will be required to reimburse an amount " +
      "equivalent to the salary paid to me during the sabbatical period.",
    /** Policy V2.6 — a fourth required acknowledgement. */
    ackHandover:
      "I acknowledge that sabbatical leave is subject to appropriate planning and handover " +
      "between myself and my Lead. I am responsible for ensuring that my responsibilities, " +
      "objectives and work commitments are appropriately managed during my absence.",

    /** Inline, on the field itself. */
    startDateRequired: "Start date is required", // :387
    endDateRequired: "End date is required", // :409
    durationExceededField: (weeks: number) => `Leave duration must not exceed ${weeks} weeks`, // :408

    /** Raised as errors, in this order (:212-261). */
    datesRequired: "Please select both start and end dates", // :220
    endBeforeStart: "End date must be after start date", // :225
    durationExceeded: (weeks: number) =>
      `Sabbatical leave duration should be less than or equal to ${weeks} weeks`, // :234
    acknowledgeAll: "Please acknowledge all the required checkboxes", // :259

    /**
     * :171-174. The anchor is the last approved sabbatical's end date, or the
     * employment start date when there is none — and the sentence names which.
     */
    notEligible: (years: number, anchor: "last sabbatical leave end date" | "employment start date") =>
      `The leave start date must be at least ${years} years after the ${anchor}.`,
    anchorLastSabbatical: "last sabbatical leave end date",
    anchorEmploymentStart: "employment start date",

    /** :263-272. Note " to " here, where the approve dialog uses an en dash. */
    confirmTitle: "Do you want to submit this sabbatical leave?",
    confirmBody: (dateRange: string, leadEmail: string | null) =>
      `This will submit your sabbatical leave request for ${dateRange} and send it` +
      `${leadEmail ? ` to ${leadEmail}` : ""} for approval.`,
    confirmOk: "Yes",
    confirmCancel: "No",
  },

  approve: {
    title: "Sabbatical  Leave Approval", // ApproveLeaveTab.tsx:64
    historyTitle: "Sabbatical  Leave History", // ApproveHistoryTab.tsx:59
    approve: "Approve", // ApproveLeaveTable.tsx:151
    reject: "Reject", // :163

    confirmApproveTitle: "Do you want to approve this leave?", // :70
    confirmRejectTitle: "Do you want to reject this leave?", // :70
    /** :72. `teamShare` is appended only to the approve message, never reject. */
    confirmApproveBody: (email: string, dateRange: string, teamShare: string) =>
      `This will approve the sabbatical leave for ${email} (${dateRange}).${teamShare}`,
    confirmRejectBody: (email: string, dateRange: string) =>
      `This will reject the sabbatical leave request for ${email} (${dateRange}).`,
    /** :63 — leading space is deliberate; it follows a full stop. */
    teamShare: (percent: number) =>
      ` ${percent}% of your team will be on sabbatical during this period.`,
    /** Policy V2.6 — required before approving; rejecting needs none. */
    confirmApproveAck:
      "I confirm that I have reviewed and approved this sabbatical leave request and that " +
      "appropriate plans are in place to manage the employee's responsibilities, objectives " +
      "and work commitments during the leave period.",
    confirmApproveOk: "Yes, Approve", // :86
    confirmRejectOk: "Yes, Reject", // :86
    confirmCancel: "Cancel", // :87
  },

  /** ApproveLeaveTable.tsx:94-124 and ApprovalHistoryTable.tsx:28-66. */
  columns: {
    employee: "Employee",
    leaveType: "Leave Type",
    startDate: "Start Date",
    endDate: "End Date",
    dayCount: "Day Count",
    approval: "Approval",
    lead: "Lead",
    status: "Status",
    /** ApprovalHistoryTable.tsx:62 — for a row with no approver yet. */
    noLead: "N/A",
    /** :74 — a status the switch does not recognise. */
    unknownStatus: "Unknown",
  },

  history: { title: "Sabbatical Leave History" }, // SabbaticalLeaveHistory.tsx:25
  report: { title: "Sabbatical Leave Report" }, // AdminSabbaticalTab.tsx:83
} as const;

/** The Sick notes report (People Ops, privilege 321). */
export const SICK_NOTES_REPORT = {
  employeeFilter: "Employee email",
  employeeFilterPlaceholder: "Filter by email",
  empty: "No sick notes in this period.",
  download: "Download",
  downloadFor: (email: string, start: string, end: string): string =>
    `Download sick note for ${email}, ${start}\u2013${end}`,
  deletedOn: (date: string): string => `Deleted on ${date}`,
  columns: {
    employee: "Employee",
    dates: "Dates",
    days: "Days",
    status: "Status",
    uploaded: "Uploaded",
    note: "Note",
  },
} as const;
