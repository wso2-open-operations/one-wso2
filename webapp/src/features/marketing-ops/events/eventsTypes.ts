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

// Wire types for Events. Ported from Marketing Ops (operations/events/api.ts) with
// the fetch helpers removed — those become TanStack Query hooks in ../api/useEvents.
//
// Note how small this surface is relative to the feature: the browser parses the
// workbook, validates it, scores it and handles every accept/reject/edit locally (see
// ./rules/). The backend supplies reference lists, the model's opinion on values our
// rules couldn't resolve, storage, and the review workflow.

import type { Payload } from "./rules/model";
import type { SuggestItem, SuggestionAnswer } from "./rules/suggest";
import type { Tab } from "./rules/schema";

export type { Tab };
export type { Payload, SuggestItem, SuggestionAnswer };

// One column of one member status.
//
// `header_label` is what the sheet says; `field_name` is what we show. Only two data
// types exist — an email column is text with a `pattern`, so a new format needs no
// release.
export interface FieldDef {
  id?: number;
  tab?: string;
  sort_order?: number;
  header_label: string;
  field_name: string;
  data_type: "text" | "picklist";
  /** Optional regular expression, text columns only. */
  pattern?: string | null;
  picklist: string[];
  mandatory: boolean;
  // A column WE fill in. `field_name` then holds a computed key rather than a label,
  // and type/pattern/picklist/mandatory are all forced off — every one of those is a
  // rule about a value the sheet supplies, and this one it doesn't.
  computed?: boolean;
}

/** Every status' columns, in display order. */
export type FieldDefs = Record<string, FieldDef[]>;

/** Who is emailed when a list is submitted, and whether anyone is. */
export interface NotificationSettings {
  enabled: boolean;
  recipients: string[];
}

export interface NotificationSettingsOut extends NotificationSettings {
  updated_by?: string | null;
  updated_at?: string | null;
  /** Whether the server holds the email service settings. Without them nothing is sent,
   *  however the switch is set. */
  delivery_configured: boolean;
}

/** A member status — which is also a tab name a workbook may use. */
export interface MemberStatus {
  id?: number;
  name: string;
  score: number;
  sort_order?: number;
  enabled: boolean;
}

export type MemberStatusInput = Pick<MemberStatus, "name" | "score" | "enabled">;

export type Status = "Draft" | "Submitted" | "ChangesRequested" | "Approved" | "Imported";

// Wire value → what a human should read. "Submitted" means different things to the two
// sides, so the submitter-facing label says who is waiting on whom.
export const STATUS_LABEL: Record<Status, string> = {
  Draft: "Draft",
  Submitted: "Awaiting review",
  ChangesRequested: "Changes requested",
  Approved: "Approved",
  Imported: "Imported",
};

export interface SubmissionSummary {
  id: string;
  event_name: string;
  event_date?: string | null;
  sf_campaign_url?: string | null;
  /** The SDR who follows up these leads; required to pass automatic review. */
  sdr_owner_email?: string | null;
  /** Read out of sf_campaign_url by the server; null when the URL holds none. */
  campaign_id?: string | null;
  owner_email?: string | null;
  status: Status;
  row_count: number;
  source_filename?: string | null;
  template_version?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  /** "machine" when automatic review approved it, otherwise the reviewer's email. */
  reviewed_by?: string | null;
  imported_at?: string | null;
  updated_at?: string | null;
}

export interface SubmissionFull extends SubmissionSummary {
  payload: Payload;
}

export interface Comment {
  id: string;
  comment: string;
  author_email?: string | null;
  created_at?: string | null;
}

// A problem the server refused to accept at submit. Either automatic review's own checks
// (the campaign URL, duplicate emails), which an admin may overrule, or an invariant the
// browser should already have caught — in practice a stale tab. `tab` and `row` are
// null for a problem with the submission rather than a row.
/** One thing the server's review refused, said so the RMM can find it. */
export interface Problem {
  /** The member status (tab) the row is on; null for a problem with the whole list,
   *  such as a missing campaign URL or SDR owner. */
  tab: string | null;
  /** The row's position in that tab, counting from 1 as the grid shows it; null
   *  whenever `tab` is. */
  row: number | null;
  /** The column's key, when the problem is about one cell or one list-level field. */
  field?: string;
  /** What is wrong, in words for the RMM. */
  message: string;
}

/** A Salesforce campaign, as the Sales Entity Service describes it. */
export interface CampaignInfo {
  /** The Salesforce campaign ID. */
  id: string;
  name?: string | null;
  /** Salesforce's campaign type, e.g. "Conference"; null when not set. */
  type?: string | null;
  /** Salesforce's campaign status, e.g. "Planned"; null when not set. */
  status?: string | null;
  isActive: boolean;
  /** YYYY-MM-DD as Salesforce holds it; null or absent when the campaign has none. */
  startDate?: string | null;
  /** YYYY-MM-DD as Salesforce holds it; null or absent when the campaign has none. */
  endDate?: string | null;
}

/** Whether Salesforce has a campaign. "unavailable" means it couldn't be asked — never
 *  read it as "does not exist". */
export interface CampaignCheck {
  result: "found" | "not_found" | "unavailable";
  campaign?: CampaignInfo | null;
}

/** How fresh the country and state lists are — a copy of Salesforce's, refreshed when
 *  over a day old or by an admin's Sync now. */
export interface GeographyStatus {
  /** Last successful sync; null while the lists are still the template's seed. */
  synced_at: string | null;
  /** The admin who pressed Sync now; null for the daily refresh. */
  synced_by: string | null;
  attempted_at: string | null;
  /** Why the last attempt failed; cleared by the next success. */
  error: string | null;
  country_count: number;
  state_count: number;
  countries_with_states: { country: string; states: number }[];
  stale: boolean;
  refresh_hours: number;
}

/** A stored job title the check took as not English, for an admin to correct. */
export interface FlaggedTitle {
  key: string;
  title: string;
  language: string | null;
  english: string;
  model: string;
  created_at: string;
}

/** A pick list column whose values are copied from a Salesforce Lead field (Industry). */
export interface PicklistSyncStatus {
  /** Our column, e.g. "Industry". */
  field_name: string;
  /** The Lead field it is copied from. */
  salesforce_field: string;
  /** Last successful sync; null if never synced (the column still has its initial values). */
  synced_at: string | null;
  synced_by: string | null;
  attempted_at: string | null;
  /** Why the last attempt failed; cleared by the next success. */
  error: string | null;
  /** Values on the column now. */
  value_count: number;
  /** Member statuses that have the column. */
  column_count: number;
}

/** One step of automatic review. */
export interface ReviewCheck {
  key: "rows" | "duplicates" | "sdr" | "titles" | "campaign";
  label: string;
  status: "passed" | "failed" | "skipped";
  problems: Problem[];
}

/** Automatic review run without changing anything — what the Review button shows. */
export interface ReviewResult {
  passed: boolean;
  can_escalate: boolean;
  checks: ReviewCheck[];
  campaign?: CampaignInfo | null;
  row_count: number;
}

export interface SubmitResult {
  submitted: boolean;
  /** Where the list went: approved by automatic review, or to an admin's queue. */
  outcome?: "approved" | "escalated" | "returned" | null;
  problems: Problem[];
  /** True when every problem is one an admin may overrule — offer "Send to admin". */
  can_escalate?: boolean;
}

export interface SuggestResult {
  assisted: boolean;
  suggestions: SuggestionAnswer[];
}

/** The job titles that are not in English (POST /submissions/{id}/titles). `key` is the
 *  title's titleKey. */
/** The list's job titles that are not in English. */
export interface TitleResult {
  /** False when the server has no model configured: titles it answered before still
   *  come back, but new ones go unchecked. */
  assisted: boolean;
  /** One entry per flagged title, keyed as titleKey keys it; `language` is null when the
   *  server could tell only that it isn't English. */
  translations: { key: string; english: string; language: string | null }[];
}

// Countries and states, plus whether suggestion assistance is configured at all.
// `assisted: false` means the model isn't wired up, so the UI shouldn't offer to ask it.
export interface ReferenceResponse {
  countries: string[];
  states: Record<string, string[]>;
  state_required: string[];
  assisted: boolean;
}
