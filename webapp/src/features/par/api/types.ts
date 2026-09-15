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

// PAR (Performance Appraisal Review) app types. Subset of
// digiops-hr/apps/par-app backend modules/types/types.bal — only the
// employee-facing fields this app renders. See docs/ported-apps/par-app.md.

// GET /employees/{workEmail} — mirrors par-app backend's EmployeeInfo
// (modules/types/types.bal), narrowed to the one field this app reads:
// `leadEmail`, which OngoingCycleView.tsx's tab-set gate checks directly
// (`employeeInfo?.leadEmail !== null`).
export interface ParEmployeeInfo {
  leadEmail: string | null;
}

export type ParCycleStatus =
  | "PENDING"
  | "PENDING_QUOTA"
  | "OPEN"
  | "CLOSED"
  | "FAILED";

export type ParEmployeeStatus = "PENDING" | "DRAFT" | "SHARED" | "SHARED_BLOCKED";
export type ParLeadStatus = "PENDING" | "DRAFT" | "SHARED";
export type ParF2fStatus = "PENDING" | "SCHEDULED" | "COMPLETED";
export type ParEmployeeAcceptanceStatus = "PENDING" | "ACCEPTED" | "REJECTED";

// The admin-configured question/rating-scale text for a cycle. Mirrors
// par-app backend's ParCycleConfigurations — only the employee-facing
// question is rendered today; the 360 question and the rating scales are
// unused until those screens land.
export interface ParCycleConfigurations {
  employeeParQuestion: string;
  threeSixtyReviewQuestion: string;
  parRatings: string[];
  threeSixtyReviewRatings: string[];
}

export interface ParCycle {
  parCycleId: number;
  parCycleName: string;
  parCycleStartDate: string;
  parCycleEndDate: string;
  parEvaluationStartDate: string;
  parEvaluationEndDate: string;
  // Per-stage deadlines. Matches the four stages the employee moves
  // through (self-eval → 360 → lead → F2F).
  parEmployeeDeadline: string;
  parThreeSixtyRatingDeadline: string;
  parLeadDeadline: string;
  parF2FDeadline: string;
  parSpecialRatingDeadline?: string;
  parCycleConfigurations: ParCycleConfigurations;
  parCycleStatus: ParCycleStatus;
}

// ParRating carries many fields (lead comments, 360 reviewers, admin
// comment, etc.); we only pick the ones the employee-facing screens
// surface — the four-stage Performance & growth block, self-review, and
// the read-only "lead's feedback" panel shown once the lead has shared.
// Lead/admin-only fields (parSpecialRating quota context, parAdminComment,
// ...) are a separate, larger type to add when the Lead/Admin portals are
// ported.
export interface ParRating {
  parRatingId: number;
  parCycleId: number;
  parEmployeeEmail: string;
  parLeadEmail?: string;
  // Base64 of a UTF-8-encoded string (par-app's NONE_EMPTY_BASE64_STRING_REGEX
  // constraint) — decode with decodeParComment before rendering. Absent until
  // the employee has saved a draft.
  parEmployeeComment?: string;
  parEmployeeStatus: ParEmployeeStatus;
  // The three fields below are all sanitizeParRatingForSelf-gated: the
  // backend omits them from the response entirely while parLeadStatus is
  // PENDING/DRAFT, so their presence already means "the lead has shared".
  parRating?: string;
  parSpecialRating?: string;
  parLeadComment?: string;
  parLeadStatus: ParLeadStatus;
  // Who invoked the share (a lead, or an admin sharing on a lead's behalf) —
  // par-app's EmployeePar.tsx renders this as "PAR Shared By".
  parRatingSharedBy?: string;
  parF2fStatus: ParF2fStatus;
  parF2fDate?: string;
  parEmployeeAcceptanceStatus?: ParEmployeeAcceptanceStatus;
}

// ---- 360° feedback ----------------------------------------------------------
//
// Mirrors par-app backend's Par360Reviewer / Par360ReviewRequest / Par360Review
// / Par360ReviewUpdate / Par360ReviewRequestCreate (modules/types/types.bal).
// "SANITIZED" is a real wire value (a past review privacy-scrubbed after the
// fact) that this app treats the same as REJECTED — nothing to act on, nothing
// to show.

export type Par360ReviewStatus = "PENDING" | "DRAFT" | "SHARED" | "REJECTED" | "SANITIZED";

// One person you've asked (or your lead has asked, on your behalf) to review
// you. GET .../employees/{email}/reviewers.
export interface Par360Reviewer {
  reviewerEmail: string;
  reviewStatus: Par360ReviewStatus;
  isLeadRequested: boolean;
  isEmployeeRequested: boolean;
}

// Body for POST .../employees/{email}/reviewers.
export interface Par360ReviewRequestCreate {
  reviewerEmails: string[];
}

// One request FOR you to review someone else. GET .../employees/{email}/review-requests
// (`email` here is the person being reviewed; the caller is resolved from the
// token as the reviewer).
export interface Par360ReviewRequest {
  employeeEmail: string;
  reviewStatus: Par360ReviewStatus;
  isEmployeeRequested: boolean;
  isLeadRequested: boolean;
}

// Your own review of one employee. GET .../employees/{email}/review.
export interface Par360Review {
  reviewerEmail: string;
  reviewRating?: string;
  // Base64 of a UTF-8-encoded string, same scheme as ParRating's comments —
  // decode with decodeParComment.
  reviewComment?: string;
  reviewStatus: Par360ReviewStatus;
}

// Body for PATCH .../employees/{email}/review — submitting or declining a
// review you were asked to give, or (with `reviewerEmail` set to your own
// address) offering one voluntarily — see the "Voluntary Feedback" flow in
// ParProvideFeedbackTab.tsx.
export interface Par360ReviewUpdate {
  reviewRating?: string;
  reviewComment?: string;
  par360ReviewStatus?: Par360ReviewStatus;
  reviewerEmail?: string;
}

// GET /par-cycles/{cycleId}/participants — mirrors par-app backend's
// Participant record exactly (name + email only, no thumbnail — the
// source's own avatar in OfferFeedbackView.tsx comes from a separate
// whole-org employee lookup this app doesn't carry, so the picker shows
// name/email without a photo). Backs "Voluntary Feedback"'s picker.
export interface ParParticipant {
  employeeName: string;
  workEmail: string;
}

// Body for PATCH /par-cycles/{cycleId}/employees/{email}/par-ratings/{id}.
// par-app's backend rejects (403) any field outside what the caller's role
// may touch — checkForModifiableFieldsForSelf in modules/types/types.bal is
// a DENYLIST, not an allowlist: it blocks parRating, parSpecialRating,
// parLeadComment, parLeadStatus, parAdminComment and parPerformanceNoticeAck
// for an employee acting on their own record, and lets everything else
// through — which is why parF2fStatus/parF2fDate (below) are here despite
// being set by the employee, same endpoint as the comment/status pair.
// Lead/admin-only fields are a separate, larger type to add when the
// lead-review screen is ported.
export interface ParRatingModify {
  parEmployeeComment?: string;
  parEmployeeStatus?: ParEmployeeStatus;
  parF2fStatus?: ParF2fStatus;
  parF2fDate?: string;
}

// ---- F2F scheduling ----------------------------------------------------------
//
// Mirrors par-app backend's raw Google Calendar freebusy shape (gcalendar:
// FreeBusyResponse) and its own ScheduleMeetingRequest — see manager.bal's
// getBusyTimeSlots / scheduleF2FMeeting.

export interface ParCalendarBusySlot {
  start: string;
  end: string;
}

export interface ParCalendarBusy {
  busy: ParCalendarBusySlot[];
}

// GET .../calendar/busy-times?date=YYYY-MM-DD.
export interface ParFreeBusyResponse {
  calendars: Record<string, ParCalendarBusy>;
  kind: string;
  timeMax: string;
  timeMin: string;
}

// Body for POST .../calendar/schedule-f2f. The response is a bare 201 with
// no payload (service.bal's own resource returns `http:CREATED` and nothing
// else) — there is no meetLink to read back from this call.
export interface ParScheduleF2fRequest {
  parRatingId: number;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  date: string;
}
