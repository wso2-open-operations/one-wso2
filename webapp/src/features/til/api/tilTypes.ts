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

// Wire and domain types for the til-backend service.
//
// The backend is the only writer of `submittedByEmail` — it reads it from the
// caller's id_token, never from the request body, so a submission can never be
// attributed to someone other than whoever authenticated the call. `who` is a
// separate, human-readable byline (the submitter's own name, e.g. "Jane Doe,
// Customer Success Engineer"), pre-filled by the form from the caller's own
// signed-in identity rather than freely typed; it is NOT the identity check.
// Keeping both means a submission can never be anonymous (submittedByEmail is
// always real) while still letting people describe themselves naturally.

export const TIL_WHERE_OPTIONS = ["Customer", "Partner", "Internal", "Other"] as const;
export type TilWhere = (typeof TIL_WHERE_OPTIONS)[number];

export function isTilWhere(value: string): value is TilWhere {
  return (TIL_WHERE_OPTIONS as readonly string[]).includes(value);
}

// The backend sets the learning's length limit (GET /settings); this is its
// default, used until that answer arrives or if it can't be fetched.
export const TIL_WHAT_DEFAULT_MAX_LENGTH = 500;
export const TIL_TITLE_MAX_LENGTH = 100;
export const TIL_WHERE_DETAIL_MAX_LENGTH = 200;
export const TIL_WHO_MAX_LENGTH = 200;

// --- wire --------------------------------------------------------------

export interface TilUserInfoWire {
  email: string;
  displayName: string;
  /** Whether this caller may delete other people's submissions. */
  canModerate: boolean;
}

export interface TilSubmissionWire {
  id: string;
  title: string;
  who: string;
  where: TilWhere;
  /** The customer/partner's name — present when `where` is "Customer" or "Partner". */
  whereDetail: string | null;
  what: string;
  submittedByEmail: string;
  createdAt: string; // ISO 8601
  /** ISO 8601, or null when the entry has never been edited. Optional so a
   * backend that predates editing still parses. */
  updatedAt?: string | null;
  /** ISO 8601 when the entry was sent to Google Chat, or null when its
   * announcement failed. Optional so a backend that predates it still parses. */
  notifiedAt?: string | null;
}

export interface TilSubmissionsPageWire {
  items: TilSubmissionWire[];
  /** How many entries match, across all pages. */
  total: number;
  limit: number;
  offset: number;
}

export interface TilSettingsWire {
  /** The most characters of plain text a learning may have. */
  whatMaxLength: number;
  /** Whether entries are sent to Google Chat. Absent from a backend that
   * predates it. */
  notificationsEnabled?: boolean;
}

// --- domain --------------------------------------------------------------

/** One page of the feed, as GET /submissions is asked for it. Times are ISO
 * 8601: createdFrom is inclusive, createdBefore exclusive. */
export interface TilSubmissionsQuery {
  search?: string;
  createdFrom?: string;
  createdBefore?: string;
  /** The author's name alone; each word matches the start of a word in it. */
  author?: string;
  source?: TilWhere;
  mine?: boolean;
  limit: number;
  offset: number;
}

export interface TilSubmissionsPage {
  items: TilSubmission[];
  total: number;
}

export interface TilSubmission {
  id: string;
  title: string;
  who: string;
  where: TilWhere;
  whereDetail: string | null;
  what: string;
  submittedByEmail: string;
  /** Parsed once here so components never touch `Date` directly (see conventions.md, Time). */
  createdAt: Date;
  /** When the entry was last edited, or null if it never has been. */
  updatedAt: Date | null;
  /** When the entry was sent to Google Chat, or null if it hasn't been
   * (its announcement failed, or the backend predates this). */
  notifiedAt: Date | null;
}

export interface TilSubmissionPayload {
  title: string;
  who: string;
  where: TilWhere;
  /** Required by the backend when `where` is "Customer" or "Partner", omitted otherwise. */
  whereDetail?: string;
  what: string;
}

/** PUT /submissions/{id}. No `who`: an edit never changes the byline, even
 * when a moderator makes it. */
export type TilSubmissionUpdatePayload = Omit<TilSubmissionPayload, "who">;

/** Whether an edit leaves `whereDetail` as the entry has it. Blank reads the
 * same as none, and for a source that takes no detail the stored value doesn't
 * count: the form neither shows nor sends it, so it can't have been changed. */
export function isSameWhereDetail(needsDetail: boolean, edited: string, stored: string | null): boolean {
  return !needsDetail || edited.trim() === (stored ?? "").trim();
}

export function normalizeSubmission(wire: TilSubmissionWire): TilSubmission {
  return {
    ...wire,
    createdAt: new Date(wire.createdAt),
    updatedAt: wire.updatedAt ? new Date(wire.updatedAt) : null,
    notifiedAt: wire.notifiedAt ? new Date(wire.notifiedAt) : null,
  };
}
