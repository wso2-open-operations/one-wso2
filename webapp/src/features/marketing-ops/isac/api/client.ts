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

import { useCallback } from "react";
import { fetchWithReauth } from "@api/http";
import { isacApiUrl } from "@config/apiConfig";
import { useAccessToken } from "@hooks/useAccessToken";

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.detail || data?.message || response.statusText;
    throw new Error(message);
  }

  return data as T;
}

function buildQueryString(params?: Record<string, unknown>): string {
  if (!params) {
    return "";
  }

  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

// ── Types ─────────────────────────────────────────────────────────────────────

/** Paginated API response wrapper with items array and navigation metadata. */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

/** Core company record with firmographic data, scoring fields, and aggregated source counts. */
export interface Company {
  id: number;
  canonical_name: string;
  domain?: string;
  country?: string;
  state?: string;
  city?: string;
  employees?: number;
  employees_range?: string;
  annual_revenue?: number;
  sector?: string;
  industry_group?: string;
  industry?: string;
  sub_industry?: string;
  naics_industry?: string;
  region?: string;
  is_restricted?: boolean;
  net_new?: boolean;
  exclude_from_ads?: boolean;
  description?: string;
  founded_year?: number;
  tech_stack?: string[];
  funding_stage?: string;
  linkedin_url?: string;
  enrichment_status?: string;
  created_at?: string;
  updated_at?: string;
  alias_count?: number;
  intent_score?: number;
  intent_tier?: string;
  awareness_score?: number;
  awareness_tier?: string;
  heat_tier?: string;
  funnel_stage?: string;
  buying_stage?: string;
  score_trend?: "up" | "down" | "flat" | null;  // intent trend over the last ~7 days
  intent_delta?: number | null;                  // intent_score change over the window
  g2_pageviews?: number;
  li_clicks?: number;
  li_impressions?: number;
  pardot_lead_count?: number;
  cert_count?: number;
  sf_account_count?: number;
}

/** Per-source record counts for a single company (used in company profile). */
export interface SourceCounts {
  sf_accounts: number;
  certifications: number;
  pardot_leads: number;
  pardot_snapshots: number;
  linkedin: number;
  g2_visits: number;
  g2_intent: number;
  contacts: number;
}

/** Full company profile — extends Company with source mappings and all related source records. */
export interface CompanyProfile extends Company {
  source_mappings: { id: number; source_system: string; source_company_name?: string }[];
  /** True per-source totals (COUNT queries) — the nested lists below may be capped. */
  source_counts: SourceCounts;
  /** Max rows per nested list (newest first); 0/undefined = unbounded. A list whose length equals this while its source_counts total is larger was truncated. */
  section_limit?: number;
  sf_accounts: SfAccount[];
  certifications: Certification[];
  pardot_leads: PardotLead[];
  pardot_snapshots: PardotSnapshot[];
  linkedin_stats: LinkedInCompanyStat[];
  g2_visits: G2VisitEvent[];
  g2_intent: G2AccountIntent[];
}

/** One G2 intent-signal category (pricing/comparison/...) with its pageview count. */
export interface EngagementSignal {
  key: string;
  label: string;
  views: number;
}

/** A WSO2 product the company is researching on G2. */
export interface EngagementProduct {
  product: string;
  pageviews: number;
  buying_stage: string | null;
}

/** A specific G2 page the company viewed. */
export interface EngagementPage {
  title: string | null;
  type: string | null;
  url: string | null;
  views: number;
  date: string | null;
}

/** What a company is researching on G2. */
export interface G2Engagement {
  total_pageviews: number;
  buying_stage: string | null;
  activity_level: string | null;
  last_seen: string | null;
  products: EngagementProduct[];
  signals: EngagementSignal[];
  top_pages: EngagementPage[];
  intent_topics: string[];
}

/** A specific ad (creative) that reached the company — currently running ads only. */
export interface EngagementAd {
  name: string | null;
  status: string | null;
  impressions: number;
  clicks: number;
  ctr: number;
  spent: number;
  ad_url: string | null;
}

/** A LinkedIn campaign that reached the company. */
export interface EngagementCampaign {
  campaign_name: string | null;
  impressions: number;
  clicks: number;
  ctr: number;
  spent: number;
  first_date: string | null;
  last_date: string | null;
  ad_format: string | null;
  objective_type: string | null;
  status: string | null;
  campaign_url: string | null;
  ads: EngagementAd[];
}

/** Which LinkedIn campaigns reached the company and how they engaged. */
export interface LinkedInEngagement {
  total_impressions: number;
  total_clicks: number;
  ctr: number;
  campaigns: EngagementCampaign[];
}

/** Per-company engagement summary — what they're interested in, across G2 + LinkedIn. */
export interface CompanyEngagement {
  company_id: number;
  g2: G2Engagement;
  linkedin: LinkedInEngagement;
}

/** Reo.dev account-level intent (additive source, resolved to an ISAC company). */
export interface ReoAccount {
  id: number;
  reo_account_id: string;
  company_id: number | null;
  raw_company_name: string | null;
  account_domain: string | null;
  country: string | null;
  city: string | null;
  state: string | null;
  industry: string | null;
  annual_revenue_text: string | null;
  employee_count_range: string | null;
  active_developers_count: number | null;
  developer_activity: string | null;
  customer_fit: string | null;
  reo_score: number | null;
  first_activity_date: string | null;
  last_activity_date: string | null;
  segment_id: string | null;
  segment_name: string | null;
  developer_funnel: string | null;
  preferred_technology: string | null;
  reo_account_link: string | null;
}

/** A net-new lead sourced from Reo.dev — kept separate until promoted. */
export interface ReoLead {
  id: number;
  reo_developer_id: string;
  reo_account_id: string | null;
  company_id: number | null;
  raw_company_name: string | null;
  account_domain: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  job_title: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  activity_score: string | null;
  reo_score: number | null;
  first_activity_date: string | null;
  last_activity_date: string | null;
  reo_developer_link: string | null;
  segment_name: string | null;
  status: string;
  promoted_lead_id: number | null;
}

/** Paginated list of Reo leads. */
export interface ReoLeadPage {
  items: ReoLead[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

/** Reo account intent + leads for one company (Engagement tab). */
export interface ReoCompanyData {
  company_id: number;
  accounts: ReoAccount[];
  leads: ReoLead[];
}

/** A raw company name alias from a specific source table with its occurrence count. */
export interface SourceAlias {
  source_table: string;
  raw_name: string;
  record_count: number;
}

/** Individual contact record linked to a company, sourced from enrichment or CRM. */
export interface Contact {
  id: number;
  company_id?: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  job_title?: string;
  department?: string;
  phone?: string;
  country?: string;
  city?: string;
  state?: string;
  source?: string;
  external_id?: string;
  linkedin_url?: string;
  created_at?: string;
}

/** A saved contact as returned by GET /contact-enrichment/company/{id} — rows arrive ranked best-first. */
export interface ContactRow {
  id: number;
  first_name: string | null; last_name: string | null; job_title: string | null; department: string | null;
  seniority: string | null; source: string | null; external_id: string | null;
  email: string | null; phone: string | null; mobile_phone: string | null; linkedin_url: string | null;
  country: string | null; city: string | null;
  has_email: boolean; has_phone: boolean; has_direct_phone: boolean; has_mobile_phone: boolean;
  match_confidence: number | null; email_status: string | null;
  direct_phone_do_not_call: boolean | null; mobile_phone_do_not_call: boolean | null;
  revealed_at: string | null; revealed_by: string | null; last_refreshed_at: string | null; created_at: string | null;
}

/** Contact-discovery cooldown state for a company. */
export interface ContactsCooldown { cached: boolean; last_discovered?: string; days_ago?: number; days_remaining?: number; }

/** Contacts-tab payload: saved contacts plus provider discovery totals and the ZoomInfo credit balance. */
export interface CompanyContactsResponse {
  company_id: number; company_name: string; has_domain: boolean;
  cooldown: ContactsCooldown;
  discovery: { total_available: number | null; provider_totals: Record<string, number>; discovered_at: string | null };
  credits: { zoominfo_remaining: number | null; zoominfo_limit: number | null; as_of: string | null };
  contacts: ContactRow[];
  total: number;
}

/** One contact's line in a reveal cost estimate (POST /contact-enrichment/reveal/estimate). */
export interface RevealEstimateItem {
  contact_id: number; name: string; provider: "zoominfo" | "apollo" | null; credits: number;
  status: "ready" | "already_revealed" | "opted_out" | "no_provider" | "over_limit";
  expect: { email: boolean; direct_phone: boolean; mobile_phone: boolean };
  do_not_call: boolean;
}

/** Reveal cost estimate for a selection of contacts. */
export interface RevealEstimate {
  items: RevealEstimateItem[];
  total_credits: number; by_provider: Record<string, number>; max_per_run: number;
  credits: { zoominfo_remaining: number | null; as_of: string | null };
  warnings: string[];
}

/** Outcome for one contact in a bulk reveal run. */
export interface RevealResultItem {
  contact_id: number;
  status: "revealed" | "no_match" | "no_data" | "opted_out" | "already_revealed" | "failed" | "skipped";
  provider: string | null; credits_used: number; message?: string; contact?: ContactRow;
}

/** Result of POST /contact-enrichment/reveal/bulk. */
export interface RevealBulkResult {
  run_id: string; results: RevealResultItem[];
  total_credits_used: number; revealed: number;
  credits: { zoominfo_remaining: number | null; as_of: string | null };
}

/** Audit record for a CSV or API data import operation. */
export interface DataImport {
  id: number;
  source_system: string;
  file_name?: string;
  rows_imported: number;
  status: string;
  error_msg?: string;
  imported_by?: string;
  started_at?: string;
  finished_at?: string;
  created_at?: string;
}

/** Salesforce account record with lifecycle, rating, and partner metadata. */
export interface SfAccount {
  id: number;
  company_id?: number;
  raw_company_name: string;
  sf_account_id?: string;
  account_owner?: string;
  account_record_type?: string;
  account_life_cycle?: string;
  rating?: string;
  billing_state?: string;
  billing_country?: string;
  naics_industry?: string;
  last_activity?: string;
  last_modified_date?: string;
  partner_type?: string;
  partner_status?: string;
  business_model?: string;
  sub_category?: string;
  partner_start_date?: string;
  region_bucket?: string;
  arr_current?: number;
  won_value?: number;
  open_opps?: number;
  activation_date?: string;
  customer_lifetime?: number;
  lost_date?: string;
  lost_reason?: string;
  products_use?: string;
  domain_list?: string;
  is_lost?: boolean;
  synced_at?: string;
}

/** WSO2 certification record for a contact, synced from Salesforce. */
export interface Certification {
  id: number;
  company_id?: number;
  contact_id?: number;
  raw_company_name?: string;
  token: string;
  cert_type?: string;
  contact_email?: string;
  is_awarded: boolean;
  awarded_date?: string;
  synced_at?: string;
}

/** Pardot prospect/lead record with marketing engagement and CRM linkage fields. */
export interface PardotLead {
  id: number;
  company_id?: number;
  prospect_id?: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  raw_company_name?: string;
  job_title?: string;
  lead_stage?: string;
  lead_type?: string;
  enrichment_status?: string;
  country?: string;
  region?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  source?: string;
  industry?: string;
  annual_revenue?: number;
  employees?: number;
  campaign?: string;
  grade?: string;
  lead_source?: string;
  sub_channel?: string;
  lead_source_details?: string;
  lead_channel?: string;
  lead_status?: string;
  is_converted?: boolean;
  rating?: string;
  linkedin_url?: string;
  pardot_score?: number;
  job_role?: string;
  last_responded_campaign?: string;
  mql_at?: string;
  sal_at?: string;
  sql_at?: string;
  website?: string;
  referrer?: string;
  do_not_email?: boolean;
  do_not_call?: boolean;
  opted_out?: boolean;
  assigned_user?: string;
  crm_contact_fid?: string;
  crm_lead_fid?: string;
  last_activity_at?: string;
  first_assigned?: string;
  created_date?: string;
  updated_date?: string;
  synced_at?: string;
}

/** Pardot account-level engagement snapshot with per-category scoring totals and averages. */
export interface PardotSnapshot {
  id: number;
  company_id?: number;
  raw_account_name?: string;
  assigned_user?: string;
  snapshot_date?: string;
  prospects_count: number;
  last_activity_at?: string;
  iam_total: number;
  iam_avg?: string;
  bfsi_total: number;
  bfsi_avg?: string;
  oh_total: number;
  oh_avg?: string;
  oem_total: number;
  oem_avg?: string;
  integration_total: number;
  integration_avg?: string;
  content_syndication_total: number;
  content_syndication_avg?: string;
  external_events_total: number;
  external_events_avg?: string;
  webinar_total: number;
  webinar_avg?: string;
  drift_engagement_total: number;
  drift_engagement_avg?: string;
  sdr_interaction_total: number;
  sdr_interaction_avg?: string;
  contact_us_total: number;
  contact_us_avg?: string;
  analyst_report_total: number;
  analyst_report_avg?: string;
  content_wp_ebook_total: number;
  content_wp_ebook_avg?: string;
  internal_events_total: number;
  internal_events_avg?: string;
  choreo_total: number;
  choreo_avg?: string;
  asgardeo_total: number;
  asgardeo_avg?: string;
  ballerina_total: number;
  ballerina_avg?: string;
  pricing_request_total: number;
  pricing_request_avg?: string;
  training_cert_total: number;
  training_cert_avg?: string;
  score_reset_total: number;
  score_reset_avg?: string;
  high_intent_page_visit_total: number;
  high_intent_page_visit_avg?: string;
  synced_at?: string;
}

/** LinkedIn Ads campaign group with aggregated performance metrics across child campaigns. */
export interface LinkedInCampaignGroup {
  id: number;
  linkedin_group_id: string;
  group_name: string;
  group_status?: string;
  total_budget?: number;
  budget_currency?: string;
  start_date?: string;
  end_date?: string;
  linkedin_created_at?: string;
  linkedin_modified_at?: string;
  synced_at?: string;
  campaign_count: number;
  total_impressions: number;
  total_clicks: number;
  total_spent: number;
  avg_cpc: number;
  avg_ctr: number;
  first_report_date?: string;
  last_report_date?: string;
  unique_job_titles: number;
  unique_companies: number;
}

/** LinkedIn Ads campaign record with budget, targeting, and aggregated performance metrics. */
export interface LinkedInCampaign {
  id: number;
  campaign_name: string;
  campaign_status?: string;
  region?: string;
  business_unit?: string;
  budget_allocation?: string;
  linkedin_campaign_id?: string;
  campaign_type?: string;
  objective_type?: string;
  cost_type?: string;
  ad_format?: string;
  daily_budget?: number;
  total_budget?: number;
  unit_cost?: number;
  budget_currency?: string;
  campaign_group_id?: string;
  campaign_start_date?: string;
  campaign_end_date?: string;
  linkedin_created_at?: string;
  linkedin_modified_at?: string;
  // Aggregate metrics
  total_impressions: number;
  total_clicks: number;
  total_spent: number;
  avg_cpc: number;
  avg_ctr: number;
  first_report_date?: string;
  last_report_date?: string;
  unique_job_titles: number;
  unique_companies: number;
}

/** LinkedIn Ads analytics row pivoted by job title for a given campaign and report date. */
export interface LinkedInJobTitleStat {
  id: number;
  campaign_id?: number;
  campaign_name?: string;
  report_date?: string;
  month?: number;
  campaign_status?: string;
  member_job_title?: string;
  clicks: number;
  impressions: number;
  total_spent?: string;
  cpc?: string;
  ctr?: string;
  synced_at?: string;
}

/** LinkedIn Ads analytics row pivoted by company for a given campaign and report date. */
export interface LinkedInCompanyStat {
  id: number;
  campaign_id?: number;
  campaign_name?: string;
  company_id?: number;
  raw_company_name?: string;
  report_date?: string;
  month?: number;
  campaign_status?: string;
  clicks: number;
  impressions: number;
  total_spent?: string;
  cpc?: string;
  ctr?: string;
  synced_at?: string;
}

/** Aggregated LinkedIn Ads performance metrics across all campaigns. */
export interface LinkedInMetrics {
  total_impressions: number;
  total_clicks: number;
  total_spent: string;
  avg_ctr: string;
  campaign_count: number;
}

/** G2 page visit event with visitor firmographics and page-level detail. */
export interface G2VisitEvent {
  id: number;
  company_id?: number;
  g2_company_id?: string;
  raw_company_name?: string;
  company_domain?: string;
  company_country?: string;
  company_state?: string;
  company_employees?: number;
  company_sector?: string;
  company_industry?: string;
  annual_revenue?: number;
  visit_url?: string;
  visit_title?: string;
  visit_type?: string;
  visit_date?: string;
  last_seen?: string;
  visitor_city?: string;
  visitor_region?: string;
  visitor_country?: string;
  total_pageviews: number;
  product_id?: string;
  product_slug?: string;
  product_name?: string;
  wso2_product?: string;
  synced_at?: string;
}

/** G2 account-level buyer intent record with pageview breakdown, buying stage, and competitive signals. */
export interface G2AccountIntent {
  id: number;
  company_id?: number;
  g2_company_id?: string;
  raw_company_name?: string;
  company_domain?: string;
  company_country?: string;
  company_state?: string;
  company_employees?: number;
  annual_revenue?: number;
  bombora_intent_topics?: string;
  total_pageviews: number;
  direct_pageviews: number;
  product_profile_pageviews: number;
  sponsored_content_pageviews: number;
  comparison_pageviews: number;
  category_pageviews: number;
  pricing_pageviews: number;
  competitors_pageviews: number;
  activity_level?: string;
  buying_stage?: string;
  competitive_signals: number;
  last_seen?: string;
  visitor_locations?: unknown;
  product_slug?: string;
  wso2_product?: string;
  synced_at?: string;
}

/** G2 intent signal summary counts grouped by buying stage and activity level. */
export interface G2IntentStats {
  awareness: number;
  consideration: number;
  decision: number;
  low: number;
  medium: number;
  high: number;
  total: number;
}

/** Single competitive alert from the G2 competitive alerts endpoint. */
export interface CompetitiveAlert {
  company: string;
  domain: string;
  product: string;
  stage: string;
  compare_views: number;
  competitor_views: number;
  signals: number;
  profile_views: number;
  pricing_views: number;
  wso2_views: number;
  activity_intensity: number;
  last_seen: string | null;
  also_interested: boolean;
  also_viewing_wso2: boolean;
  is_customer: boolean;
  is_prospect: boolean;
  is_lost: boolean;
  in_salesforce: boolean;
  sf_lifecycle: string | null;
  sf_owner: string | null;
}

/** Response from GET /g2/competitive-alerts. */
export interface CompetitiveAlertsResponse {
  total_companies: number;
  days: number;
  customer_count: number;
  prospect_count: number;
  lost_count: number;
  alerts: CompetitiveAlert[];
}

/** Per-product competitive pressure breakdown. */
export interface CompetitiveTrendProduct {
  product: string;
  competitor_views: number;
  comparison_views: number;
  signals: number;
  companies: number;
}

/** Monthly competitive activity data point. */
export interface CompetitiveTrendMonth {
  month: string;
  competitor_views: number;
  comparison_views: number;
  companies: number;
  wso2_also_count: number;
}

/** Response from GET /g2/competitive-trends. */
export interface CompetitiveTrendsResponse {
  days: number;
  by_product: CompetitiveTrendProduct[];
  monthly_trend: CompetitiveTrendMonth[];
  competitor_vs_wso2: {
    both_viewing: number;
    competitor_only: number;
    total: number;
  };
}

/** G2 signal analytics summary — aggregated metrics across all signal types. */
export interface G2SignalAnalytics {
  summary: {
    wso2_interest: { profile_views: number; pricing_views: number; sponsored_views: number; total: number };
    competitor_activity: { comparison_views: number; competitor_views: number; competitive_signals: number; total: number };
    category_browsing: { category_views: number; total_pageviews: number };
    unique_companies: number;
    decision_companies: number;
    consideration_companies: number;
    awareness_companies: number;
  };
  by_product: { product: string; wso2_interest: number; profile_views: number; pricing_views: number; competitor_views: number; competitive_signals: number; category_views: number; unique_companies: number }[];
  monthly_trend: { month: string; wso2_interest: number; competitor_activity: number; category_browsing: number; unique_companies: number; decision: number; consideration: number }[];
  top_wso2_interest: { company: string; views: number }[];
  top_competitor_activity: { company: string; competitor_views: number; signals: number }[];
  buying_funnel: { product: string; stage: string; companies: number }[];
}

/** Top-level numeric KPIs displayed on the main dashboard. */
export interface DashboardStats {
  total_companies: number;
  total_contacts: number;
  total_leads: number;
  certifications_issued: number;
  active_campaigns: number;
  intent_signals_7d: number;
}

/** Legacy dashboard API response with stats, buying stage distribution, and recent signals. */
export interface DashboardResponse {
  stats: DashboardStats;
  buying_stage_distribution: { stage: string; count: number }[];
  top_accounts_by_engagement: { raw_account_name: string; total_engagement: number }[];
  recent_intent_signals: {
    raw_company_name?: string;
    buying_stage?: string;
    activity_level?: string;
    last_seen?: string;
    wso2_product?: string;
  }[];
}

/** CMO dashboard headline metrics including hot account counts, signal volumes, and LinkedIn spend. */
export interface CMOCommandStats {
  hot_accounts: number;
  hot_accounts_mom_delta: number | null;
  decision_stage_count: number;
  decision_stage_pct: number;
  signals_7d: number;
  signals_7d_g2: number;
  signals_7d_linkedin: number;
  signals_7d_pardot: number;
  linkedin_total_spent: number;
  linkedin_avg_cpc: number;
  linkedin_avg_ctr: number;
}
/** Top-ranked account for the CMO dashboard with scoring and source coverage flags. */
export interface CMOTopAccount {
  company_id: number;
  company_name: string;
  intent_score: number;
  awareness_score: number;
  heat_tier: string;
  buying_stage?: string;
  industry?: string;
  has_g2: boolean;
  has_linkedin: boolean;
  has_pardot: boolean;
  has_sf: boolean;
  has_certs: boolean;
}
/** Company counts at each pipeline funnel stage (awareness, consideration, decision). */
export interface CMOPipelineFunnel { awareness: number; consideration: number; decision: number; }
/** Company counts by heat tier classification. */
export interface CMOHeatTierCounts { hot: number; warm: number; cold: number; }
/** Monthly snapshot of heat tier distribution for trajectory charting. */
export interface CMOTrajectoryMonth { month: string; hot: number; warm: number; cold: number; }
/** Number of unique companies with data from each source system. */
export interface CMOSourceCoverage { g2_companies: number; linkedin_companies: number; pardot_companies: number; cert_companies: number; }
/** Single item in the CMO dashboard real-time signal feed. */
export interface CMOSignalFeedItem { raw_company_name?: string; buying_stage?: string; activity_level?: string; last_seen?: string; wso2_product?: string; }
/** Complete CMO dashboard API response combining all dashboard sections. */
export interface CMODashboardResponse {
  command_stats: CMOCommandStats;
  top_accounts: CMOTopAccount[];
  pipeline_funnel: CMOPipelineFunnel;
  heat_tier_counts: CMOHeatTierCounts;
  trajectory: CMOTrajectoryMonth[];
  source_coverage: CMOSourceCoverage;
  signal_feed: CMOSignalFeedItem[];
}

/** Per-month data point for trends charts with source counts and heat tier breakdown. */
export interface TrendMonthData {
  month: string;
  g2_companies: number;
  linkedin_companies: number;
  pardot_companies: number;
  cert_companies: number;
  aware_companies: number;
  intent_companies: number;
  overlap_companies: number;
  hot_count: number;
  warm_count: number;
  cold_count: number;
}

/** Current-period summary totals for the trends overview. */
export interface TrendSummary {
  total_companies: number;
  hot_count: number;
  warm_count: number;
  cold_count: number;
}

/** Trends overview API response with a current summary and monthly time-series data. */
export interface TrendsOverviewResponse {
  summary: TrendSummary;
  months: TrendMonthData[];
}

// ── Company Enrichment ───────────────────────────────────────────────────────

/** Record of a single enrichment attempt for a company from a specific provider. */
export interface CompanyEnrichmentRecord {
  id: number;
  source: string;
  status: string;
  provided_fields: string[];
  confidence: string;
  credits_used: number;
  error_msg?: string;
  enriched_at?: string;
}

/** Enrichment provider credit usage and availability status. */
export interface EnrichmentCreditSource {
  source: string;
  credits_used_today: number;
  credits_used_total: number;
  total_enrichments: number;
  is_configured: boolean;
  costs_credits: boolean;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * A `fetch` for ISAC API URLs that signs each request with the caller's access
 * token. A 401 renews the session once; only a GET is then replayed.
 */
export function useIsacFetch(): (url: string, init?: RequestInit) => Promise<Response> {
  const getToken = useAccessToken();
  return useCallback(
    async (url: string, init: RequestInit = {}) => fetchWithReauth(url, init, await getToken()),
    [getToken],
  );
}

/** The ISAC API client: `get`, `upload`, `request` and `download`, each taking a path under `/api/v1`. */
export function useApiClient() {
  const isacFetch = useIsacFetch();

  const fetchJson = useCallback(
    async <T>(url: string, init: RequestInit): Promise<T> => parseJsonResponse<T>(await isacFetch(url, init)),
    [isacFetch],
  );

  const get = useCallback(
    async <T>(path: string, params?: Record<string, unknown>): Promise<T> =>
      fetchJson<T>(`${isacApiUrl(path)}${buildQueryString(params)}`, { method: "GET" }),
    [fetchJson],
  );

  const upload = useCallback(
    async <T>(path: string, formData: FormData): Promise<T> =>
      fetchJson<T>(isacApiUrl(path), { method: "POST", body: formData }),
    [fetchJson],
  );

  const request = useCallback(
    async <T>(method: "post" | "put" | "delete", path: string, body?: unknown): Promise<T> =>
      fetchJson<T>(isacApiUrl(path), {
        method: method.toUpperCase(),
        headers: body !== undefined ? { "Content-Type": "application/json" } : {},
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }),
    [fetchJson],
  );

  const download = useCallback(
    async (path: string, params?: Record<string, unknown>): Promise<DownloadResult> => {
      const response = await isacFetch(`${isacApiUrl(path)}${buildQueryString(params)}`, { method: "GET" });
      if (!response.ok) {
        throw new Error(response.statusText || `Download failed (${response.status})`);
      }
      const blob = await response.blob();
      const match = (response.headers.get("Content-Disposition") ?? "").match(/filename="?([^";]+)/i);
      const total = response.headers.get("X-Total-Count");
      return {
        blob,
        filename: match?.[1] ?? null,
        total: total !== null ? Number(total) : null,
        truncated: response.headers.get("X-Export-Truncated") === "true",
      };
    },
    [isacFetch],
  );

  return { get, upload, request, download };
}

/** Result of useApiClient().download(): the file blob plus the export metadata headers. */
export interface DownloadResult {
  blob: Blob;
  filename: string | null;
  total: number | null;
  truncated: boolean;
}

/** Save a blob to the user's disk under the given filename. */
export function saveBlobAsFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const el = document.createElement("a");
  el.href = url;
  el.download = filename;
  el.click();
  // revoking immediately can abort the download in some browsers
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ── Account follow + stage alerts ────────────────────────────────────────────

/** One account the current user follows (GET /users/me/follows). */
export interface FollowedCompany {
  company_id: number;
  canonical_name: string;
  domain: string | null;
  industry: string | null;
  funnel_stage: string | null;
  intent_score: number | null;
  heat_tier: string | null;
  /** The company's most recent funnel-stage move, if any. */
  previous_stage: string | null;
  stage_changed_on: string | null;
  followed_at: string | null;
}

/** Whether the current user follows a company, and how many users do. */
export interface FollowStatus {
  company_id: number;
  following: boolean;
  follower_count: number;
}

/** Admin view of the stage-alert configuration and recent ledger counts. */
export interface StageAlertsStatus {
  enabled: boolean;
  dry_run: boolean;
  email_configured: boolean;
  sender: string | null;
  cooldown_days: number;
  lookback_days: number;
  allowlist: string[];
  public_app_url: string | null;
  counts: Record<string, number>;
}

/** Summary of one stage-alert run. */
export interface StageAlertsRun {
  pairs: number;
  sent: number;
  failed: number;
  skipped: number;
  dry_run: number;
  enabled: boolean;
  dry_run_mode: boolean;
  email_configured: boolean;
}
