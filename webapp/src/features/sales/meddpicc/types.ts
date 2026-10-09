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

// Wire types for the MEDDPICC backend (echo-backend), copied from the MEDDPICC
// contract: §1 for the shared shapes, §3.6 for the HTTP API. Field names are
// the ones on the wire; keep this file a mirror of the contract rather than a
// view model, so a contract change is a diff in one place.

/** The eight Letters, in display order. The two Ds and the two Cs are distinct. */
export type LetterKey = "M" | "E" | "DC" | "DP" | "P" | "I" | "CH" | "CO";

/** 0 = not discussed, 1 = touched on but unanswered, 2 = a Gate field was answered. */
export type CoverageLevel = 0 | 1 | 2;

export type DealLetterState = "EMPTY" | "SUGGESTED" | "FILLED";

export type FieldKind = "text" | "picklist" | "multiPicklist" | "role" | "url" | "salesforceOnly";

/** A Salesforce Contact holding a role, as Salesforce stores it. */
export interface RoleHolder {
  contactId: string;
  name: string;
}

/**
 * One value of a Gate field. The shape depends on the kind:
 *   text / url / picklist -> string
 *   multiPicklist         -> string[]
 *   role                  -> RoleHolder (Salesforce value)
 *   salesforceOnly        -> string | number | boolean | null (display only)
 * A cleared value is null.
 */
export type FieldValue = string | string[] | RoleHolder | number | boolean | null;

/** Where evidence came from. Calls are the only source analysed today. */
export type EvidenceSourceType = "CALL" | "EMAIL" | "ACTIVITY";

/** Who said it: the customer's words are evidence; WSO2's are WSO2's claim. */
export type AuthorRole = "CUSTOMER" | "WSO2" | "UNKNOWN";

export interface EvidenceSource {
  type: EvidenceSourceType;
  /** The meeting id for a call; the Salesforce record id otherwise. */
  id: string;
  /** The meeting title or the email subject. */
  title: string;
  occurredAt: string;
  /** A link to the record outside this app, when there is one. */
  url: string | null;
}

export interface EvidenceQuote {
  /** 0 when the source is not a call. */
  meetingId: number;
  meetingTitle: string;
  /** The meeting's start time. */
  callStart: string;
  speaker: string;
  /** Verbatim text. */
  quote: string;
  /** Position in the recording, for a call. */
  offsetSeconds: number;
  /** Absent from a backend older than evidence sources; see util/evidenceSource. */
  source?: EvidenceSource;
  authorRole?: AuthorRole;
}

// ---- POST /meetings/coverage ------------------------------------------------

/** NONE: the meeting has no transcript yet. */
export type CoverageStatus = "NONE" | "PENDING" | "RUNNING" | "DONE" | "FAILED";

export interface MeetingCoverage {
  meetingId: number;
  status: CoverageStatus;
  coverage: Record<LetterKey, CoverageLevel> | null;
  missed: LetterKey[];
  stageAtCall: string | null;
  /** Up to 2 per letter, for hover. */
  quotes: Partial<Record<LetterKey, EvidenceQuote[]>>;
  opportunityId: string | null;
}

export interface MeetingCoverageRequest {
  /** At most 200. */
  meetingIds: number[];
}

export interface MeetingCoverageList {
  items: MeetingCoverage[];
}

// ---- GET /deals ------------------------------------------------------------

export interface DealSummary {
  opportunityId: string;
  name: string;
  accountId: string;
  accountName: string;
  stage: string;
  recordType: string;
  amount: number | null;
  currencyIsoCode: string | null;
  closeDate: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  isClosed: boolean;
  lastCallAt: string | null;
  callCount: number;
  pendingCount: number;
  dealState: Record<LetterKey, DealLetterState>;
}

export interface DealList {
  items: DealSummary[];
}

// ---- GET /deals/{opportunityId} --------------------------------------------

export interface ContactOption {
  contactId: string;
  name: string;
  email: string | null;
  title: string | null;
  score: number;
}

/** A role field's Proposal value: a person heard on a call, and the Contacts it may be. */
export interface RoleProposalValue {
  name: string;
  title: string | null;
  /** Set when the best candidate scores >= 0.8. */
  suggestedContactId: string | null;
  candidates: ContactOption[];
}

export interface FieldProposal {
  /** For role: RoleProposalValue. */
  value: FieldValue | RoleProposalValue;
  rationale: string | null;
  confidence: number;
  evidence: EvidenceQuote[];
  /** Differs from Salesforce and not yet approved. */
  pending: boolean;
}

export interface DealField {
  key: string;
  gate: string;
  label: string;
  letters: LetterKey[];
  kind: FieldKind;
  conversational: boolean;
  notInSalesforce: boolean;
  optional: boolean;
  /**
   * Only the account manager may confirm this field: budget confirmed, WSO2 selected, price
   * confirmed, use-case fit, POC completed. Absent from an older backend.
   */
  attest?: boolean;
  /** False when dependsOn fails. */
  applicable: boolean;
  options: string[];
  salesforceValue: FieldValue;
  proposal: FieldProposal | null;
  state: DealLetterState;
}

export interface AskNextItem {
  fieldKey: string;
  question: string;
}

export interface DealCall {
  meetingId: number;
  title: string;
  start: string;
  host: string;
  coverage: Record<LetterKey, CoverageLevel> | null;
}

export interface UnassignedCall {
  meetingId: number;
  title: string;
  start: string;
  host: string;
  letters: LetterKey[];
}

/** What a deal's evidence is drawn from. */
export interface SourceSummary {
  calls: number;
  emails: number;
  activities: number;
  lastActivityAt: string | null;
}

/** One entry on a deal's timeline: a call today; an email or Salesforce activity later. */
export interface DealActivity {
  type: EvidenceSourceType;
  id: string;
  title: string;
  occurredAt: string;
  /** Who held the call, or sent the email. */
  actor: string;
  /** Letters it touched. */
  letters: LetterKey[];
  /** Set for a call, to open its page. */
  meetingId: number | null;
  url: string | null;
}

export interface DealDetail {
  deal: DealSummary;
  currentStage: string;
  nextStage: string | null;
  gateComplete: boolean;
  /** fieldKeys blocking Move stage. */
  incomplete: string[];
  /** All gates, in gates.json order. */
  fields: DealField[];
  askNext: AskNextItem[];
  productsDiscussed: string[];
  calls: DealCall[];
  unassignedCalls: UnassignedCall[];
  /** Absent from a backend older than evidence sources; see util/evidenceSource. */
  sources?: SourceSummary;
  /** Newest first. Absent from an older backend. */
  activity?: DealActivity[];
  canEdit: boolean;
  /** SALESFORCE_BASE_URL + "/" + opportunityId. */
  salesforceUrl: string;
  lastApproval: { by: string; at: string } | null;
}

// ---- POST /deals/{opportunityId}/approve -----------------------------------

export interface ApproveRequest {
  /** fieldKey -> the AM's value; null = clear. */
  edits: Record<string, FieldValue>;
  /** Role fieldKey -> contactId. */
  roleMatches: Record<string, string>;
}

export interface ApproveResult {
  /** fieldKeys written to Salesforce. */
  written: string[];
  /** For example notInSalesforce, unchanged. */
  skipped: { fieldKey: string; reason: string }[];
  /** A Salesforce 422; nothing partial is hidden. */
  error: { message: string; fields?: string[] } | null;
  deal: DealDetail;
}

// ---- POST /deals/{opportunityId}/move-stage --------------------------------

export interface MoveStageRequest {
  toStage: string;
}

export interface MoveStageResult {
  stage: string;
}

/** 409: the Gate is not complete. */
export interface MoveStageConflict {
  message: string;
  incomplete: string[];
}

/** 422: Salesforce refused the change. */
export interface MoveStageRefusal {
  message: string;
  salesforceUrl: string;
}

// ---- POST /deals/{opportunityId}/include-calls -----------------------------

export interface IncludeCallsRequest {
  meetingIds: number[];
}

// ---- GET /gates ------------------------------------------------------------
//
// The contract describes this response as "the parsed gates.json", not as a
// named type, so this is gates.json's own shape. Only what the screens read is
// required; `hint` and anything else the backend keeps for itself is not
// declared, so nothing here depends on it.

export interface GateLetter {
  key: LetterKey;
  /** The single character on the circle: "D" for both DC and DP. */
  short: string;
  label: string;
}

export interface GateFieldDefinition {
  key: string;
  gate: string;
  label: string;
  letters: LetterKey[];
  kind: FieldKind;
  conversational: boolean;
  sfField?: string;
  role?: string;
  options?: string[];
  optional?: boolean;
  notInSalesforce?: boolean;
  requiredValue?: string;
  dependsOn?: { field: string; equals?: string; includes?: string };
  askNext?: string;
}

export interface GatesResponse {
  version: number;
  stages: string[];
  letters: GateLetter[];
  fields: GateFieldDefinition[];
  missingFields: string[];
}
