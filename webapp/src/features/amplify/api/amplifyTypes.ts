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

// Wire shapes from amplify-api's OpenAPI (marketing-tools apps/amplify/amplify-api/openapi.yaml).
// Only the fields these screens read are typed; the rest pass through untouched.

/**
 * What amplify-api lets the caller do (GET /me `grants`, ADR-038). The
 * Asgardeo groups behind each grant are amplify-api configuration; the UI
 * gates on grants and never on a group name.
 */
export type AmplifyGrant =
  | "EMPLOYEE"
  | "CAN_CAMPAIGN"
  | "CAN_DASHBOARD"
  | "CAN_EXPORT"
  | "CAN_REVIEW_SHARES"
  | "CAN_POINT_RULES"
  | "CAN_ADJUST_POINTS"
  | "CAN_PO_DASHBOARD"
  | "CAN_REPORTS"
  | "CAN_ADMIN";

export type LinkedInStatus = "ACTIVE" | "EXPIRING" | "NEEDS_RECONNECT" | "REMOVED" | "NOT_CONNECTED";

export interface AmplifyMe {
  employee: { employeeId: string; email: string; displayName: string };
  /** The caller's Asgardeo groups that amplify-api's access configuration names. */
  roles: string[];
  grants: AmplifyGrant[];
  capabilities: string[];
  linkedin: { status: LinkedInStatus; expiresAt?: string | null };
  /** Deployment settings from amplify-api's Choreo configs (not from `window.config`). */
  config: { linkedinOrgUrn: string; privacyNoticeUrl: string; campaignLinkOrigins: string[] };
}

export interface AmplifyAppConfig {
  /** Choreo Labs' LinkedIn company page, the owner New Post sends. Empty when amplify-api has none. */
  linkedinOrgUrn: string;
  /** Privacy notice link for the consent pop-up. Empty shows plain text. */
  privacyNoticeUrl: string;
  /** GET /me `campaignLinkOrigins`: origins a post link may use (`scheme://host[:port]`, lowercase), and the only ones the consent popup follows. */
  campaignLinkOrigins: string[];
}

export type CampaignStatus = "SCHEDULED" | "OPEN" | "CLOSED" | "ARCHIVED";

export interface Campaign {
  id: string;
  resourceUrn: string;
  resourceUrl?: string | null;
  title: string;
  summary?: string | null;
  imageUrl?: string | null;
  categoryCode: string;
  isPriority: boolean;
  tags: string[];
  opensAt: string;
  closesAt: string;
  status: CampaignStatus;
  version: number;
}

export interface CampaignPage {
  items: Campaign[];
  page: number;
  size: number;
  total: number;
}

export interface CampaignDraft {
  resourceUrn: string;
  ownerUrn: string;
  resourceUrl?: string;
  title: string;
  summary?: string;
  imageUrl?: string;
  categoryCode: string;
  isPriority: boolean;
  closesAt?: string;
}

export interface CampaignPatch {
  version: number;
  title?: string;
  summary?: string;
  imageUrl?: string;
  /** New link to the post; a blank string clears it. amplify-api applies the allowed-origin rule. */
  resourceUrl?: string;
  categoryCode?: string;
  isPriority?: boolean;
  closesAt?: string;
}

export interface CampaignRegistration {
  campaign: Campaign;
  run: "NOT_REQUESTED" | "STARTED" | "DEFERRED";
}

export interface Category {
  code: string;
  label: string;
  sortOrder: number;
}

// REPOST reshares the org's post (`reshareContext.parent`); proven with a member token and `w_member_social`
// (D5 spike, 2026-10-20). SHARE creates a new post that links to it, the fallback if LinkedIn refuses a reshare.
// REPOST_COMMENTARY is a repost with the employee's own text on top (D5b spike, 2026-10-21: LinkedIn accepted it).
// The API requires text for it and refuses text on a plain REPOST. SHARE_COMMENTARY stays unused.
export type ShareKind = "REPOST" | "REPOST_COMMENTARY" | "SHARE";

export interface Share {
  id: string;
  campaignId: string;
  status: "QUEUED" | "PUBLISHED" | "FAILED";
}

export interface LeaderboardEntry {
  employeeId: string;
  displayName: string;
  email: string;
  points: number;
  rank: number;
  /** When the person reached these points (their latest points entry); ties are ordered by it. Only for Amplify dashboard readers. */
  reachedAt?: string | null;
}

export interface PersonalStanding {
  employeeId: string;
  points?: number | null;
  rank?: number | null;
  pointsToNextRank?: number | null;
  pointsToTopN?: number | null;
  inTopN: boolean;
}

export interface TeamEntry {
  /**
   * Null when Amplify sent no id: a member with no points in the period (the team list takes ids from the
   * points), or who never signed in.
   */
  employeeId: string | null;
  displayName: string;
  email: string;
  points: number;
  teamRank: number;
  /** Null for a member with no points in the period (no company rank). */
  companyRank: number | null;
  /** The member's house from the people directory; absent when they have none. */
  houseName?: string | null;
  isMe: boolean;
}

export interface Leaderboard {
  topN: number;
  company: LeaderboardEntry[];
  me: PersonalStanding;
  myTeam?: { teamName: string; headcount: number; activeCount: number; entries: TeamEntry[] } | null;
  teamStatus: "OK" | "NO_TEAM" | "UNAVAILABLE";
}

/** GET /leaderboard/top: the Celebrate top three and the caller's own line, company wide. */
export interface TopBoard {
  /** MONTH = this calendar month (UTC); ALL = all time. Set by `leaderboard.top_scope`. */
  period: "MONTH" | "ALL";
  /** Always null: the Celebrate top three has no points minimum (ADR-037). */
  minPoints?: number | null;
  monthStart?: string | null;
  monthEnd?: string | null;
  topN: number;
  /** When the monthly totals were read; the server reuses them for 2 hours. */
  generatedAt: string;
  company: LeaderboardEntry[];
  me: PersonalStanding;
}

export interface ConnectAuthorization {
  authorizationUrl: string;
  state: string;
  expiresAt: string;
}

export interface LinkedInConnection {
  status: LinkedInStatus;
  returnTo?: string | null;
  pendingCampaignId?: string | null;
}

/** RFC 9457 body every amplify-api error carries. The client branches on `code`, never `detail`. */
export interface AmplifyProblem {
  code: string;
  title: string;
  status: number;
  detail?: string | null;
}

// ---- Dashboarding (amplify-api GET /dashboards/*, GET /leaderboard/groups) -------------------------------

export interface DashboardAnnouncement {
  /** NONE = no announcement row yet. */
  status: "NONE" | "QUEUED" | "SENT" | "FAILED";
  /** Outbox attempts so far while QUEUED. */
  attempts?: number | null;
  sentAt?: string | null;
}

export interface DashboardCampaignRow {
  campaignId: string;
  title: string;
  categoryCode: string;
  categoryLabel: string;
  isPriority: boolean;
  status?: "SCHEDULED" | "OPEN" | "CLOSED" | "ARCHIVED";
  opensAt: string;
  closesAt: string;
  reposts: number;
  /** Of `reposts`, the ones posted with the employee's own comment. Absent until the API sends it. */
  repostsWithCommentary?: number;
  announcement?: DashboardAnnouncement;
}

export interface DashboardOperations {
  asOf: string;
  headcount?: number | null;
  kpis: {
    campaignsLive: number;
    campaignsLivePriority: number;
    campaignsClosingWithin7Days: number;
    /** Reposts since the 1st of the month (UTC). */
    repostsThisMonth: number;
    repostsPrevMonth: number;
    peopleConnected: number;
    connectionsExpired: number;
    pointsThisMonth: number;
    /** Calendar year; absent until the API sends it. */
    pointsThisYear?: number;
    peopleWithPoints: number;
    /** Of `repostsThisMonth`, the ones with the employee's own comment. */
    repostsThisMonthWithCommentary?: number;
  };
  campaigns: DashboardCampaignRow[];
  shareHealth: {
    /** The 1st of the current month, 00:00 UTC. */
    windowStart: string;
    published: number;
    queued: number;
    failed: number;
    failedByReason: Record<string, number>;
  };
  connections: {
    active: number;
    expiring: number;
    expired: number;
    revoked: number;
    neverConnected?: number | null;
  };
}

export interface DashboardPerson {
  employeeId: string;
  /** The id itself when Amplify never recorded a name; look the person up in the directory. */
  displayName: string;
  /** Work email, the key to the people directory. */
  email?: string | null;
}

/** GET /dashboards/people/{employeeId}: one person's Post Performance. */
export interface DashboardPersonBoard {
  employeeId: string;
  displayName: string;
  email?: string | null;
  /** Plain reposts. */
  reposts: number;
  repostsWithCommentary: number;
  /** Points earned since the 1st (UTC), adjustments and reversals included. */
  pointsThisMonth: number;
  campaigns: {
    campaignId: string;
    title: string;
    categoryCode: string;
    categoryLabel: string;
    isPriority: boolean;
    opensAt: string;
    closesAt: string;
    reposts: number;
    repostsWithCommentary: number;
    /** Points the person earned on this post. */
    points: number;
  }[];
  byCategory: { code: string; label: string; reposts: number; repostsWithCommentary: number; points: number }[];
}

export interface DashboardCampaignDetail {
  campaignId: string;
  title: string;
  categoryCode: string;
  categoryLabel: string;
  isPriority: boolean;
  opensAt: string;
  closesAt: string;
  reposts: number;
  shareOfConnected?: number | null;
  first24Hours: number;
  announcement: DashboardAnnouncement;
  byDay: { day: number; reposts: number }[];
  /** The post's card: text, picture and the LinkedIn link. Absent until the API sends them. */
  summary?: string | null;
  imageUrl?: string | null;
  resourceUrl?: string | null;
  resourceUrn?: string;
  /** Who reposted it, by name: plain reposts and reposts with the person's own comment. */
  people?: { reposts: DashboardPerson[]; withComments: DashboardPerson[] };
  repostsWithCommentary?: number;
}

export interface DashboardCampaigns {
  asOf: string;
  windowDays: number;
  peopleConnected?: number;
  campaigns: DashboardCampaignRow[];
  selected?: DashboardCampaignDetail | null;
  byCategory: { code: string; label: string; reposts: number; repostsWithCommentary?: number }[];
}

export interface DashboardParticipation {
  asOf: string;
  funnel: {
    employees?: number | null;
    connected: number;
    reposted: number;
    active30Days: number;
    expired: number;
  };
}

export interface DashboardGlance {
  asOf: string;
  month: string;
  reposts: { thisMonth: number; previousMonth: number };
  /** Last six calendar months, oldest first, the current month last. */
  monthly: { monthStart: string; reposts: number }[];
  participants: number;
  headcount?: number | null;
  campaignsLive: number;
  campaignsReachingTarget: { reached: number; live: number; thresholdPercent: number };
  shareSuccess: { published: number; attempts: number };
  bestCampaign?: {
    campaignId: string;
    title: string;
    categoryLabel: string;
    isPriority: boolean;
    reposts: number;
  } | null;
}

export interface ScorecardMeasure {
  key: "connected" | "expired" | "shareSuccess" | "chatCards" | "priorityReach" | "active30Days" | "repostsPerMonth";
  label: string;
  unit: "PERCENT" | "COUNT";
  value: number;
  numerator?: number | null;
  denominator?: number | null;
  target: number;
  comparison: "AT_LEAST" | "AT_MOST";
  status: "ON_TRACK" | "WATCH";
  note?: string | null;
}

export interface DashboardScorecard {
  asOf: string;
  measures: ScorecardMeasure[];
}

/** Server-side sort columns of /leaderboard/groups. `rank` is the points-based dense rank. */
export type GroupSort = "rank" | "name" | "points" | "participants" | "headcount" | "participation";
export type SortDir = "asc" | "desc";

export interface GroupBoardEntry {
  rank: number;
  /** Opaque team key, or the BU name. */
  key: string;
  name: string;
  businessUnit?: string | null;
  points: number;
  participants: number;
  headcount: number;
  participationRate: number;
}

export interface GroupBoard {
  period: string;
  by: "TEAM" | "BU" | "HOUSE";
  businessUnit?: string | null;
  asOf: string;
  totals: { headcount: number; participants: number; points: number };
  entries: GroupBoardEntry[];
  unassigned: { participants: number; points: number };
}

// ---- Own posts (amplify-api /external-shares, /me/external-shares, /po/external-shares) ------------------

/** Where a claim is: waiting for the PO team, approved, featured (AMPLIFIED) or declined (REJECTED). */
export type ExternalShareStatus = "PENDING" | "APPROVED" | "REJECTED" | "AMPLIFIED";

/** POST /external-shares: an employee's own post, sent for review. */
export interface ExternalShareClaim {
  /** The post's public HTTPS link. */
  evidenceUrl: string;
  /** "I wrote this post myself, and it's about Choreo Labs." Must be true. */
  certified: true;
  /** A note for the reviewer, at most 500 characters. Sent only when there is one. */
  note?: string;
}

/** One claim, as the employee and the PO team see it. */
export interface ExternalShare {
  id: string;
  /** Amplify's id for the person who sent it, the same id as GET /me `employee.employeeId`. */
  employeeId: string;
  campaignId?: string | null;
  action: "OWN_POST";
  evidenceUrl: string;
  evidenceHost: string;
  evidenceProvider: "linkedin" | "medium" | "other";
  status: ExternalShareStatus;
  decidedBy?: string | null;
  decidedAt?: string | null;
  /** Why it was declined; shown to the employee. */
  decisionReason?: string | null;
  amplifiedAt?: string | null;
  /** The employee's note for the reviewer. Absent until the API sends it. */
  note?: string | null;
  /** Who sent it, as Amplify recorded them. On GET /po/external-shares items only; null when unknown. */
  employeeName?: string | null;
  /** Their work email. On GET /po/external-shares items only; null when unknown. */
  employeeEmail?: string | null;
  createdAt: string;
  version: number;
}

/** GET /po/external-shares: one page of claims, oldest first. */
export interface ExternalSharePage {
  items: ExternalShare[];
  page: number;
  size: number;
  total: number;
}

// ---- Points (amplify-api /po/point-rules, /po/points/*, /team/{employeeId}/history, /po/people) ----------

/** What a points rule or a ledger row is for. */
export type PointAction =
  | "REPOST"
  | "REPOST_COMMENTARY"
  | "SHARE"
  | "SHARE_COMMENTARY"
  | "OWN_POST"
  | "OWN_POST_AMPLIFIED"
  | "REACTION"
  | "COMMENT"
  | "CHALLENGE_ENTRY"
  | "CHALLENGE_WINNER";

/** One version of a points rule. `inForce` marks the version used for new activity. */
export interface PointRule {
  id: string;
  action: PointAction;
  points: number;
  effectiveFrom: string;
  createdBy: string;
  createdAt: string;
  inForce: boolean;
}

/**
 * Where a history row stands for Coins: HELD counts toward the next Coins, PAID became Coins, ACTION_REQUIRED waits
 * for the PO team.
 */
export type LedgerSettlement = "HELD" | "PAID" | "ACTION_REQUIRED";

/** One points ledger row. A reversal row cancels the row named in `reversesReference`. */
export interface LedgerEntry {
  reference: string;
  employeeId: string;
  campaignId?: string | null;
  sourceType: "ENGAGEMENT" | "EXTERNAL_SHARE" | "ADJUSTMENT" | "REVERSAL";
  action?: string | null;
  /** Signed: a removal or a reversal is negative. */
  points: number;
  /** The PO team's reason, on adjustment and reversal rows. The person the row belongs to sees it too. */
  reason?: string | null;
  reversesReference?: string | null;
  actorId?: string;
  createdAt: string;
  status?: "HELD" | "PAID" | null;
  /** History rows only: the title of the post the points were earned on. */
  campaignTitle?: string | null;
  /** History rows only: the reference of the row that reversed this one; null when it stands. */
  reversedBy?: string | null;
  /** History rows only: where the row stands for Coins. */
  settlement?: LedgerSettlement;
}

/** GET /team/{employeeId}/history: one page of a person's ledger rows, newest first. `total` counts rows. */
export interface PointsHistory {
  employeeId: string;
  page: number;
  size: number;
  total: number;
  /** The person's all-time points: every row, not only this page. */
  totalPoints?: number;
  /** Their points not yet paid out as Coins. */
  heldPoints?: number;
  items: LedgerEntry[];
}

/** POST /po/points/adjustments. */
export interface PointsAdjustment {
  employeeId: string;
  /** Signed, not zero, within ±10,000. */
  points: number;
  reason: string;
}

/** One match from GET /po/people: someone who has used Amplify. */
export interface AmplifyPersonMatch {
  employeeId: string;
  displayName: string | null;
  email: string;
}

// ---- Coins and settings (amplify-api /me/points, /point-values, /po/settings, /admin/settings) -------------

/** How often points become Coins: on the 1st of each month, every Monday, or every day. */
export type CoinSchedule = "MONTHLY" | "WEEKLY" | "DAILY";

/** POST /me/coins/wallet, and GET /me/points `coins.wallet`: the caller's WSO2 Coins wallet as Amplify captured it. */
export interface CoinWallet {
  /** Masked: the first 6 and last 4 characters, e.g. `0x12ab…9f3c`. */
  walletAddress: string;
  capturedAt: string;
}

/** GET /me/points `coins`: the conversion rate and schedule, and the caller's progress toward the next Coins. */
export interface CoinsStanding {
  /** False while Coins aren't sent to wallets yet; points keep counting. */
  walletsEnabled: boolean;
  /** Points in one conversion block. */
  blockPoints: number;
  /** Coins one block becomes. */
  blockCoins: number;
  schedule: CoinSchedule;
  /** Points not yet paid out as Coins. */
  heldPoints: number;
  /** What the last conversion carried over (a part block, or what a cap held back); counts toward the next block. */
  carryPoints: number;
  /** Points toward the next block (held plus carry), 0 to `blockPoints - 1`. */
  pointsTowardNext: number;
  /** Coins the conversion has sent to the caller. */
  coinsReceived: number;
  /** The captured wallet (masked); null until POST /me/coins/wallet has found one. */
  wallet: CoinWallet | null;
}

/** GET /me/points: the caller's standing for one period, and their Coins. */
export interface MyPoints {
  /** The period asked for: `ALL`, `YYYY-MM` or `YYYY-Qn`. */
  period: string;
  standing: PersonalStanding;
  coins: CoinsStanding;
  monthly: { month: string; points: number; actions: number }[];
}

/** GET /point-values `values`: the points each action earns today, by action. Actions without a rule are absent. */
export type PointValues = Partial<Record<PointAction, number>>;

/** One setting as GET /po/settings and GET /admin/settings list it. */
export interface AmplifySetting {
  key: string;
  /** A JSON number, boolean or string. */
  value: unknown;
  /** Sent back with a change; a stale one is refused with 409 VERSION_CONFLICT. */
  version: number;
  updatedBy: string;
  updatedAt: string;
}

/** GET and PUT /po/settings and /admin/settings. */
export interface SettingList {
  settings: AmplifySetting[];
  /** Only on a PUT that changed a schedule setting. */
  schedulerSync?: "SYNCED" | "PENDING" | "NOT_CONFIGURED";
}

/** One change in PUT /po/settings or /admin/settings: the new value and the version it was read at. */
export interface SettingChange {
  key: string;
  value: number | boolean | string;
  version: number;
}
