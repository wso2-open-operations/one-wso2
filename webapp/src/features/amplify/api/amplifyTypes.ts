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
  employeeId: string;
  displayName: string;
  email: string;
  points: number;
  teamRank: number;
  companyRank: number;
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
  /** Points needed in the month to qualify for the top three; null for ALL. */
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
