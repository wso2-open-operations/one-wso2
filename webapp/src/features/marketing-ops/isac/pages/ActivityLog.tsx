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

import { AccessTime as AccessTimeIcon } from "../icons";
import { ExpandLess as ExpandLessIcon } from "../icons";
import { ExpandMore as ExpandMoreIcon } from "../icons";
import { Group as GroupIcon } from "../icons";
import { Insights as InsightsIcon } from "../icons";
import { LockOutlined as LockOutlinedIcon } from "../icons";
import { TrendingUp as TrendingUpIcon } from "../icons";
import { PersonAddAltOutlined as PersonAddAltOutlinedIcon } from "../icons";
import {
  Alert, Box, Button, Chip, CircularProgress, Collapse, FormControl, IconButton,
  InputLabel, MenuItem, Paper, Select, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Tooltip, Typography, useTheme,
} from "@wso2/oxygen-ui";
import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis,
} from "recharts";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useApiClient } from "../api/client";
import { useUserRole } from "../context/UserRoleContext";
import { C, F } from "../theme/pageTokens";
import { FS, FW, LABEL } from "../theme/typeScale";

// ── Types ────────────────────────────────────────────────────────────────────

interface SummaryUser {
  user_sub: string;
  user_email: string | null;
  user_name: string | null;
  request_count: number;
  last_active: string | null;
  active_seconds: number;
  /** The route tag this user hit most in the period. */
  top_feature: string | null;
  /** Registration date (app_users.first_seen). */
  first_seen: string | null;
}
interface WeekBucket { week_start: string; requests: number; active_users: number; new_users: number; }
interface DayBucket { date: string; count: number; users: number; }
interface UseCase { key: string; label: string; requests: number; users: number; share: number; }
interface Summary {
  period_days: number;
  total_requests: number;
  unique_users: number;
  registered_users: number;
  most_used_feature: string | null;
  total_active_seconds: number;
  session_gap_minutes: number;
  /** The same-length window immediately before this one — for growth deltas. */
  previous: { total_requests: number; unique_users: number; total_active_seconds: number };
  /** Active now vs. the previous window: new (not active before), returning (both), churned (before only). */
  retention: { new: number; returning: number; churned: number };
  weekly: WeekBucket[];
  daily_usage: DayBucket[];
  use_cases: UseCase[];
  users: SummaryUser[];
}

interface LogItem {
  id: number;
  user_email: string | null;
  user_name: string | null;
  route_tag: string | null;
  action: string | null;
  path: string;
  created_at: string | null;
}
interface LogPage { items: LogItem[]; total: number; page: number; pages: number; }

// ── Display mappings ─────────────────────────────────────────────────────────

const FEATURE_LABELS: Record<string, string> = {
  dashboard: "Dashboard", companies: "Companies", "nl-query": "Ask AI", campaigns: "Campaigns",
  uploads: "Data Upload", "sf-accounts": "SF Accounts", certifications: "Certifications",
  "pardot-leads": "Pardot Leads", "pardot-snapshots": "Pardot Snapshots",
  "linkedin-campaigns": "LinkedIn Campaigns", "linkedin-stats": "LinkedIn Stats",
  "g2-intent": "G2 Intent", contacts: "Contacts", admin: "Admin", sync: "Sync",
  trends: "Trends", "data-imports": "Data Imports", users: "Users",
  "lead-enrichment": "Leads", "company-enrichment": "Company Enrichment",
  "contact-enrichment": "Contact Enrichment", "crm-sync": "CRM Sync",
  outreach: "Outreach", countries: "Countries", "activity-logs": "Activity Log",
};
const ACTION_LABELS: Record<string, string> = {
  view: "View", create: "Create", update: "Update", delete: "Delete",
  upload: "Upload", sync: "Sync", query: "Ask AI", generate: "Generate",
};
const ACTION_COLOR: Record<string, string> = {
  view: "#4f56c8", create: "#0d7d55", update: "#a97508", delete: "#c42d4e",
  upload: "#6b4fbb", sync: "#0077b5", get query() { return C.orange; }, generate: "#b83d6e",
};

const featureLabel = (tag: string | null) => (tag ? FEATURE_LABELS[tag] || tag : "—");
const actionLabel = (a: string | null) => (a ? ACTION_LABELS[a] || a : "—");

/** Pretty date + time from an ISO string. */
function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
/** Humanize an estimated-active-time duration in seconds → "2h 15m" / "45m" / "<1m". */
function fmtDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0m";
  if (seconds < 60) return "<1m";
  // Round to whole minutes first, then split — avoids "1h 60m" / "60m" artifacts
  // that arise from rounding the minute remainder independently.
  const totalMin = Math.round(seconds / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
/** ISO date (YYYY-MM-DD) for `days` ago — feeds the per-user list's date_from filter. */
function sinceDate(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

const USER_PAGE_SIZE = 25;

// ── Growth helpers ───────────────────────────────────────────────────────────

/** Percentage change current vs previous; null when there is no previous baseline. */
function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** "▲ 12% vs previous 30 days" in green/red, or a neutral note when there's no baseline. */
function DeltaText({ current, previous, days }: { current: number; previous: number; days: number }) {
  const pct = pctChange(current, previous);
  if (pct === null) {
    return <Typography variant="caption" color="text.disabled">no activity in the previous {days} days</Typography>;
  }
  const up = pct > 0, flat = pct === 0;
  return (
    <Typography variant="caption" sx={{ color: flat ? "text.disabled" : up ? C.green : C.red, fontWeight: FW.semibold }}>
      {flat ? "no change" : `${up ? "\u25B2" : "\u25BC"} ${Math.abs(pct)}%`}
      <Box component="span" sx={{ color: "text.disabled", fontWeight: FW.regular }}> vs previous {days} days</Box>
    </Typography>
  );
}

/** Short "8 Oct" label for a week or day bucket. */
function shortDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Thin horizontal share bar used by the use-case and top-user lists. */
function ShareBar({ share, color }: { share: number; color: string }) {
  return (
    <Box sx={{ height: 6, borderRadius: 3, bgcolor: C.card, overflow: "hidden" }}>
      <Box sx={{ width: `${Math.max(2, Math.round(share * 100))}%`, height: "100%", bgcolor: color, borderRadius: 3 }} />
    </Box>
  );
}

// ── Usage trend ──────────────────────────────────────────────────────────────

/** Actions (bars) and active users (line) per week — or per day for short periods. */
function UsageTrend({ summary }: { summary: Summary }) {
  const daily = summary.period_days <= 14;
  const data = daily
    ? summary.daily_usage.map((d) => ({ label: shortDate(d.date), Actions: d.count, "Active users": d.users }))
    : summary.weekly.map((w) => ({ label: `w/c ${shortDate(w.week_start)}`, Actions: w.requests, "Active users": w.active_users, "New users": w.new_users }));
  const r = summary.retention;
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: C.panel }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 1, flexWrap: "wrap", gap: 1 }}>
        <Typography variant="subtitle2" fontWeight={FW.semibold}>Usage trend</Typography>
        <Typography variant="caption" color="text.secondary">
          {daily ? "per day" : "per week"} &middot; {r.new} new &middot; {r.returning} returning &middot; {r.churned} not back
        </Typography>
      </Box>
      {data.length === 0 ? (
        <Typography variant="body2" color="text.disabled" sx={{ py: 4, textAlign: "center" }}>No activity in this period.</Typography>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.borderSoft} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: C.sub, fontSize: FS.micro, fontFamily: F }} axisLine={{ stroke: C.borderSoft }} tickLine={false} />
            <YAxis yAxisId="left" tick={{ fill: C.sub, fontSize: FS.micro, fontFamily: F }} axisLine={false} tickLine={false} width={44} />
            <YAxis yAxisId="right" orientation="right" allowDecimals={false} tick={{ fill: C.sub, fontSize: FS.micro, fontFamily: F }} axisLine={false} tickLine={false} width={32} />
            <ChartTooltip
              contentStyle={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontFamily: F, fontSize: FS.body, boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}
              formatter={(v, name) => [Number(v).toLocaleString(), name]}
              cursor={{ fill: `${C.orange}0a` }}
            />
            <Legend wrapperStyle={{ fontFamily: F, fontSize: FS.micro, color: C.sub }} />
            <Bar yAxisId="left" dataKey="Actions" fill={C.orange} fillOpacity={0.85} radius={[3, 3, 0, 0]} maxBarSize={38} />
            <Line yAxisId="right" type="monotone" dataKey="Active users" stroke={C.blue} strokeWidth={2.5} dot={{ r: 3 }} />
            {!daily && <Line yAxisId="right" type="monotone" dataKey="New users" stroke={C.green} strokeWidth={2} strokeDasharray="4 3" dot={{ r: 2 }} />}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </Paper>
  );
}

// ── Use cases ────────────────────────────────────────────────────────────────

/** What people come to ISAC to do: actions and distinct users per use case. */
function UseCasesPanel({ useCases, activeUsers }: { useCases: UseCase[]; activeUsers: number }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: C.panel, height: "100%" }}>
      <Typography variant="subtitle2" fontWeight={FW.semibold} sx={{ mb: 1.5 }}>What ISAC is used for</Typography>
      {useCases.length === 0 ? (
        <Typography variant="body2" color="text.disabled">No activity in this period.</Typography>
      ) : useCases.map((u) => (
        <Box key={u.key} sx={{ mb: 1.25 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 0.4 }}>
            <Typography variant="body2" fontWeight={FW.semibold}>{u.label}</Typography>
            <Typography variant="caption" color="text.secondary">
              {u.requests.toLocaleString()} actions &middot; {u.users} of {activeUsers} user{activeUsers === 1 ? "" : "s"} &middot; {Math.round(u.share * 100)}%
            </Typography>
          </Box>
          <ShareBar share={u.share} color={C.orange} />
        </Box>
      ))}
    </Paper>
  );
}

// ── Top users ────────────────────────────────────────────────────────────────

/** Who uses ISAC most: share of actions, time spent, their main feature, and whether they're new. */
function TopUsersPanel({ users, totalRequests, periodDays }: { users: SummaryUser[]; totalRequests: number; periodDays: number }) {
  const top = users.slice(0, 8);
  // "Now" is read once, when the panel first appears.
  const [now] = useState(() => Date.now());
  const cutoff = now - periodDays * 86_400_000;
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: C.panel, height: "100%" }}>
      <Typography variant="subtitle2" fontWeight={FW.semibold} sx={{ mb: 1.5 }}>Most active people</Typography>
      {top.length === 0 ? (
        <Typography variant="body2" color="text.disabled">No activity in this period.</Typography>
      ) : top.map((u) => {
        const share = totalRequests ? u.request_count / totalRequests : 0;
        const isNew = !!u.first_seen && new Date(u.first_seen).getTime() >= cutoff;
        return (
          <Box key={u.user_sub} sx={{ mb: 1.25 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 1, mb: 0.4 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={FW.semibold} noWrap>{u.user_name || u.user_email || u.user_sub}</Typography>
                {isNew && (
                  <Tooltip title="First signed in during this period" arrow>
                    <Chip label="new" size="small" sx={{ height: 16, "& .MuiChip-label": { px: 0.6, fontSize: FS.micro, fontWeight: FW.semibold }, bgcolor: `${C.green}14`, color: C.green }} />
                  </Tooltip>
                )}
              </Box>
              <Typography variant="caption" color="text.secondary" noWrap>
                {u.request_count.toLocaleString()} actions &middot; {fmtDuration(u.active_seconds)}
                {u.top_feature ? <> &middot; mostly <Box component="span" sx={{ color: C.text, fontWeight: FW.semibold }}>{featureLabel(u.top_feature)}</Box></> : null}
              </Typography>
            </Box>
            <ShareBar share={share} color={C.blue} />
          </Box>
        );
      })}
    </Paper>
  );
}

// ── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: React.ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, flex: 1, minWidth: 160, bgcolor: C.panel }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Box sx={{ color: "text.secondary", display: "flex" }}>{icon}</Box>
        <Typography variant="caption" color="text.secondary" fontWeight={FW.semibold} sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</Typography>
      </Box>
      <Typography variant="h5" fontWeight={FW.bold}>{value}</Typography>
      {sub && (typeof sub === "string" ? <Typography variant="caption" color="text.disabled">{sub}</Typography> : <Box sx={{ mt: 0.25 }}>{sub}</Box>)}
    </Paper>
  );
}

// ── One user's collapsible activity block ─────────────────────────────────────

/** A user row that expands to load and page through that user's own activities. */
function UserActivityRow({ user, days }: { user: SummaryUser; days: number }) {
  const { get } = useApiClient();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);

  // Reset paging whenever the period changes so a reopen starts fresh.
  const [pagedDays, setPagedDays] = useState(days);
  if (pagedDays !== days) { setPagedDays(days); setPage(1); }

  // Loaded only while the row is expanded.
  const { data, isFetching: loading, isError: error } = useQuery({
    queryKey: ["isac", "activity-logs", { user_sub: user.user_sub, days, page, page_size: USER_PAGE_SIZE }],
    queryFn: () => get<LogPage>(
      "/activity-logs",
      { user_sub: user.user_sub, date_from: sinceDate(days), page, page_size: USER_PAGE_SIZE },
    ),
    enabled: open,
    retry: 1,
    refetchOnMount: true,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const logs = data ?? null;

  const toggle = () => setOpen((o) => !o);

  const headerBg = C.card;

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, mb: 1, overflow: "hidden" }}>
      {/* Row header (click to expand) */}
      <Box
        role="button" aria-expanded={open} tabIndex={0} onClick={toggle}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}
        sx={{
          display: "flex", alignItems: "center", gap: 1.5, px: 2, py: 1.25, cursor: "pointer",
          "&:hover": { bgcolor: theme.palette.action.hover },
          "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: "-2px" },
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body2" fontWeight={FW.semibold} noWrap>{user.user_name || user.user_email || "Unknown user"}</Typography>
          {user.user_email && user.user_name && (
            <Typography variant="caption" color="text.secondary" noWrap>{user.user_email}</Typography>
          )}
        </Box>
        <Chip size="small" label={`${user.request_count.toLocaleString()} actions`}
          sx={{ height: 22, fontSize: FS.small, fontWeight: FW.semibold }} />
        <Chip size="small" icon={<AccessTimeIcon sx={{ fontSize: 14 }} />} label={fmtDuration(user.active_seconds)}
          sx={{ height: 22, fontSize: FS.small, fontWeight: FW.semibold, color: "#0077b5", bgcolor: "#0077b514" }} />
        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 96, textAlign: "right", display: { xs: "none", sm: "block" } }}>
          {fmtDateTime(user.last_active)}
        </Typography>
        <IconButton size="small" sx={{ color: "text.secondary" }}>
          {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Box>

      {/* Expanded: this user's activities */}
      <Collapse in={open} unmountOnExit>
        <TableContainer sx={{ borderTop: `1px solid ${theme.palette.divider}` }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ "& th": { ...LABEL, color: "text.secondary", bgcolor: headerBg } }}>
                <TableCell>Feature</TableCell>
                <TableCell>Action</TableCell>
                <TableCell align="right">When</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && !logs ? (
                <TableRow><TableCell colSpan={3} align="center" sx={{ py: 4, border: 0 }}><CircularProgress size={20} /></TableCell></TableRow>
              ) : error ? (
                <TableRow><TableCell colSpan={3} align="center" sx={{ py: 4, border: 0, color: "error.main" }}>Couldn't load this user's activity. Please try again.</TableCell></TableRow>
              ) : !logs || logs.items.length === 0 ? (
                <TableRow><TableCell colSpan={3} align="center" sx={{ py: 4, border: 0, color: "text.disabled" }}>No activity in this period.</TableCell></TableRow>
              ) : logs.items.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell><Typography variant="body2">{featureLabel(r.route_tag)}</Typography></TableCell>
                  <TableCell>
                    <Chip label={actionLabel(r.action)} size="small"
                      sx={{ height: 20, fontSize: FS.caption, fontWeight: FW.semibold, color: ACTION_COLOR[r.action ?? ""] || C.slate, bgcolor: `${ACTION_COLOR[r.action ?? ""] || C.slate}14` }} />
                  </TableCell>
                  <TableCell align="right"><Typography variant="caption" color="text.secondary" noWrap>{fmtDateTime(r.created_at)}</Typography></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {logs && logs.pages > 1 && (
          <Box sx={{ display: "flex", gap: 2, justifyContent: "center", alignItems: "center", py: 1 }}>
            <Button size="small" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} sx={{ textTransform: "none" }}>Prev</Button>
            <Typography variant="caption" color="text.secondary">Page {page} of {logs.pages}</Typography>
            <Button size="small" disabled={page >= logs.pages} onClick={() => setPage((p) => p + 1)} sx={{ textTransform: "none" }}>Next</Button>
          </Box>
        )}
      </Collapse>
    </Paper>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

/** Activity Log — admin-only usage analytics grouped per user, expandable to each
 *  user's activities, with an estimated "time spent on ISAC". */
export default function ActivityLog() {
  const { get } = useApiClient();
  const { isAdmin, loading: roleLoading } = useUserRole();

  const [days, setDays] = useState(30);
  const [search, setSearch] = useState("");

  // The summary endpoint is admin-only, so it is not requested for anyone else.
  const { data, isFetching: loading, error: loadError } = useQuery({
    queryKey: ["isac", "activity-logs", "summary", { days }],
    queryFn: () => get<Summary>("/activity-logs/summary", { days }),
    enabled: isAdmin,
    retry: 1,
    refetchOnMount: true,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const summary = data ?? null;
  const error = loadError ? loadError.message || "Failed to load activity" : null;

  // Bordered "card" boundary matching the other full-page views (e.g. Companies).
  // Nothing above this screen draws its title, so it lives in here.
  const boundarySx = {
    bgcolor: "background.paper", p: { xs: 2, md: 2.5 }, minHeight: "100%",
  } as const;

  // ── Permission gate: tell non-admins from the view itself ──
  if (roleLoading) {
    return (
      <Box sx={boundarySx}>
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress size={26} /></Box>
      </Box>
    );
  }
  if (!isAdmin) {
    return (
      <Box sx={boundarySx}>
        <Typography variant="h5" fontWeight={FW.semibold} sx={{ mb: 2 }}>Activity Log</Typography>
        <Paper variant="outlined" sx={{ borderRadius: 2, p: 5, textAlign: "center", maxWidth: 520, mx: "auto", mt: 4 }}>
          <LockOutlinedIcon sx={{ fontSize: 42, color: "text.disabled", mb: 1.5 }} />
          <Typography variant="h6" fontWeight={FW.bold} gutterBottom>You don't have permission</Typography>
          <Typography variant="body2" color="text.secondary">
            The Activity Log is available to administrators only. If you need access, ask an ISAC administrator to grant you the admin role.
          </Typography>
        </Paper>
      </Box>
    );
  }

  const users = (summary?.users ?? []).filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (u.user_name || "").toLowerCase().includes(q) || (u.user_email || "").toLowerCase().includes(q);
  });

  return (
    <Box sx={boundarySx}>
      {/* Header: title + period selector */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 1 }}>
        <Typography variant="h5" fontWeight={FW.semibold}>Activity Log</Typography>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Period</InputLabel>
          <Select value={days} label="Period" onChange={(e) => setDays(Number(e.target.value))}>
            <MenuItem value={7}>7 days</MenuItem>
            <MenuItem value={14}>14 days</MenuItem>
            <MenuItem value={30}>30 days</MenuItem>
            <MenuItem value={60}>60 days</MenuItem>
            <MenuItem value={90}>90 days</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 1 }}>{error}</Alert>}

      {/* Stat cards — each with growth vs the previous period */}
      <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
        <StatCard icon={<GroupIcon sx={{ fontSize: 20 }} />} label="Active Users" value={summary?.unique_users ?? "—"}
          sub={summary ? <DeltaText current={summary.unique_users} previous={summary.previous.unique_users} days={summary.period_days} /> : `Last ${days} days`} />
        <StatCard icon={<PersonAddAltOutlinedIcon sx={{ fontSize: 20 }} />} label="Adoption"
          value={summary ? `${summary.registered_users ? Math.round((summary.unique_users / summary.registered_users) * 100) : 0}%` : "—"}
          sub={summary ? `${summary.unique_users} of ${summary.registered_users} registered users active · ${summary.retention.new} new` : undefined} />
        <StatCard icon={<TrendingUpIcon sx={{ fontSize: 20 }} />} label="Total Actions" value={summary ? summary.total_requests.toLocaleString() : "—"}
          sub={summary ? <DeltaText current={summary.total_requests} previous={summary.previous.total_requests} days={summary.period_days} /> : undefined} />
        <StatCard icon={<AccessTimeIcon sx={{ fontSize: 20 }} />} label="Time Spent on ISAC" value={summary ? fmtDuration(summary.total_active_seconds) : "—"}
          sub={summary ? <DeltaText current={summary.total_active_seconds} previous={summary.previous.total_active_seconds} days={summary.period_days} /> : undefined} />
        <StatCard icon={<InsightsIcon sx={{ fontSize: 20 }} />} label="Top Use Case" value={summary?.use_cases?.[0]?.label ?? "—"}
          sub={summary?.use_cases?.[0] ? `${summary.use_cases[0].users} of ${summary.unique_users} users` : undefined} />
      </Box>

      {/* Trend + use cases + people */}
      {summary && (
        <Box sx={{ display: "grid", gap: 2, mb: 3, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
          <Box sx={{ gridColumn: { xs: "auto", md: "1 / -1" } }}><UsageTrend summary={summary} /></Box>
          <UseCasesPanel useCases={summary.use_cases} activeUsers={summary.unique_users} />
          <TopUsersPanel users={summary.users} totalRequests={summary.total_requests} periodDays={summary.period_days} />
        </Box>
      )}

      <Typography variant="subtitle2" fontWeight={FW.semibold} sx={{ mb: 1 }}>All users</Typography>

      {/* User search */}
      <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
        <TextField size="small" placeholder="Search user…" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 220 }} />
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.secondary">{users.length} user{users.length === 1 ? "" : "s"}</Typography>
      </Box>

      {/* Per-user, expandable */}
      {loading && !summary ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress size={24} /></Box>
      ) : users.length === 0 ? (
        <Paper variant="outlined" sx={{ borderRadius: 2, p: 5, textAlign: "center", color: "text.disabled" }}>
          No user activity in this period.
        </Paper>
      ) : (
        users.map((u) => <UserActivityRow key={u.user_sub} user={u} days={days} />)
      )}
    </Box>
  );
}
