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

import { AutoAwesome as AutoAwesomeIcon } from "../icons";
import { BookmarkAdd as BookmarkAddIcon } from "../icons";
import { Bookmark as BookmarkIcon } from "../icons";
import { ChatBubbleOutline as ChatBubbleOutlineIcon } from "../icons";
import { ChevronRight as ChevronRightIcon } from "../icons";
import { DeleteOutline as DeleteOutlineIcon } from "../icons";
import { InfoOutlined as InfoOutlinedIcon } from "../icons";
import { StorageOutlined as StorageOutlinedIcon } from "../icons";
import { PlayArrow as PlayArrowIcon } from "../icons";
import { PersonOutline as PersonOutlineIcon } from "../icons";
import { AddCommentOutlined as AddCommentOutlinedIcon } from "../icons";
import { ArrowUpward as ArrowUpwardIcon } from "../icons";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  InputBase,
  List,
  TextField,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  MenuList,
  Paper,
  Popper,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip as RechartTooltip, XAxis, YAxis,
} from "recharts";
import { useApiClient } from "../api/client";
import { C } from "../theme/pageTokens";
import { FS, FW } from "../theme/typeScale";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Skill {
  slug: string;
  name: string;
  description: string;
}


interface ChartSuggestion {
  type: "bar" | "line" | "pie" | "table";
  x: string;
  y: string;
  title: string;
}

interface IntelligenceAccount {
  company: string;
  tier: "hot" | "warm" | "watching";
  action: string;
  signals: string[];
  score?: number | null;
  confidence?: "high" | "medium" | "low" | null;
  confidence_reason?: string | null;
  region?: string | null;
  product_interest?: string[];
}

interface IntelligenceSummary {
  hot_count: number;
  warm_count: number;
  watching_count: number;
  new_this_week?: number | null;
  competitive_evals?: number | null;
  top_regions: string[];
  top_products?: string[];
  headline: string;
}

interface Intelligence {
  summary: IntelligenceSummary;
  recommendations?: string[];
  accounts: IntelligenceAccount[];
}

interface NLQueryResult {
  response_type?: "data" | "conversational" | "needs_confirmation";
  sql: string;
  explanation: string;
  chart: ChartSuggestion | null;
  columns: string[];
  rows: (string | null)[][];
  row_count: number;
  thinking?: string | null;
  intelligence?: Intelligence | null;
  answer?: string | null;
  confirmation_action?: string;
  confirmation_data?: { contact_id: number; contact_name: string; cost: string; message: string };
}

interface SavedQuery {
  id: number;
  title: string;
  prompt: string | null;
  sql: string;
  explanation: string | null;
  chart: ChartSuggestion | null;
  created_at: string;
}

// A single turn in the conversation thread
interface ChatTurn {
  id: string;
  userMessage: string;
  // While pending: result is null, thinkingPreview may be set
  result: NLQueryResult | null;
  thinkingPreview: string | null;
  error: string | null;
  pending: boolean;
}

// History entry passed to the backend for multi-turn context
interface HistoryEntry {
  role: "user" | "assistant";
  content: string;
}

// Persisted chat session (matches backend ChatSessionOut)
interface ChatSession {
  id: number;
  title: string;
  turns: ChatTurn[];
  history: HistoryEntry[];
  created_at: string;
  updated_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Strip raw SQL, stack traces, and technical jargon from error messages shown to the user. */
function cleanErrorMessage(error: string): string {
  // If it contains a SQL dump or pymysql error, give a friendly message
  if (error.includes("pymysql") || error.includes("OperationalError") || error.includes("[SQL:")) {
    return "The AI query encountered a technical issue. Please try rephrasing your question or ask about different data.";
  }
  if (error.includes("unparseable response")) {
    return "The AI could not process this request. Please try rephrasing your question.";
  }
  // Truncate very long errors
  if (error.length > 300) {
    const clean = error.slice(0, error.indexOf("[SQL:") > 0 ? error.indexOf("[SQL:") : 250).trim();
    return clean.endsWith(".") ? clean : clean + "…";
  }
  return error;
}

// ── Chart colors ──────────────────────────────────────────────────────────────

const CHART_COLORS = () => [
  C.orange, "#3b82f6", "#10b981", "#8b5cf6",
  "#f59e0b", "#ef4444", "#0077b5", "#14b8a6",
];

// ── Chart renderer ────────────────────────────────────────────────────────────

/** Returns true if a column has at least some non-zero numeric values. */
function isNumericColumn(colIdx: number, rows: (string | null)[][]): boolean {
  let numericCount = 0;
  for (const row of rows.slice(0, 20)) {
    const v = parseFloat(row[colIdx] ?? "");
    if (!isNaN(v) && v !== 0) numericCount++;
  }
  return numericCount > 0;
}

/** Find the best numeric Y column: prefer the suggested one, otherwise pick the first numeric col that isn't the X col. */
function resolveYColumn(
  suggestedY: string,
  xCol: string,
  columns: string[],
  rows: (string | null)[][]
): number {
  const suggestedIdx = columns.indexOf(suggestedY);
  if (suggestedIdx !== -1 && isNumericColumn(suggestedIdx, rows)) return suggestedIdx;

  // Fall back: find first numeric column that isn't the x column
  for (let i = 0; i < columns.length; i++) {
    if (columns[i] !== xCol && isNumericColumn(i, rows)) return i;
  }
  // Last resort: return suggested index even if non-numeric
  return suggestedIdx !== -1 ? suggestedIdx : 1;
}

function ChartView({ chart, columns, rows }: { chart: ChartSuggestion; columns: string[]; rows: (string | null)[][] }) {
  const axisColor = C.sub;

  const xIdx = columns.indexOf(chart.x);
  if (xIdx === -1) return <ResultTable columns={columns} rows={rows} />;

  const yIdx = resolveYColumn(chart.y, chart.x, columns, rows);
  const yLabel = columns[yIdx];

  const data = rows.slice(0, 100).map((row) => ({
    name: row[xIdx] ?? "(null)",
    value: parseFloat(row[yIdx] ?? "0") || 0,
  }));

  if (chart.type === "bar") {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 8, right: 24, left: 8, bottom: 80 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
          <XAxis dataKey="name" tick={{ fontSize: FS.caption, fill: axisColor }} angle={-35} textAnchor="end" interval={0} />
          <YAxis tick={{ fontSize: FS.caption, fill: axisColor }} />
          <RechartTooltip contentStyle={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 2 }}
            labelStyle={{ color: C.text, fontWeight: FW.semibold }}
            itemStyle={{ color: C.textMd }} />
          <Bar dataKey="value" name={yLabel} radius={[2, 2, 0, 0]}>
            {data.map((_, i) => <Cell key={i} fill={CHART_COLORS()[i % 8]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (chart.type === "line") {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 8, right: 24, left: 8, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
          <XAxis dataKey="name" tick={{ fontSize: FS.caption, fill: axisColor }} angle={-35} textAnchor="end" interval={0} />
          <YAxis tick={{ fontSize: FS.caption, fill: axisColor }} />
          <RechartTooltip contentStyle={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 2 }}
            labelStyle={{ color: C.text, fontWeight: FW.semibold }}
            itemStyle={{ color: C.textMd }} />
          <Legend wrapperStyle={{ fontSize: FS.small }} />
          <Line type="monotone" dataKey="value" name={yLabel} stroke={C.orange} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (chart.type === "pie") {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}
            label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
            {data.map((_, i) => <Cell key={i} fill={CHART_COLORS()[i % 8]} />)}
          </Pie>
          <RechartTooltip contentStyle={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 2 }}
            labelStyle={{ color: C.text, fontWeight: FW.semibold }}
            itemStyle={{ color: C.textMd }} />
          <Legend wrapperStyle={{ fontSize: FS.small }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  return null;
}

// ── Results table ─────────────────────────────────────────────────────────────

function ResultTable({ columns, rows }: { columns: string[]; rows: (string | null)[][] }) {
  // Per-column alignment shared by header and body cells: a column whose
  // non-null values are all numeric is right-aligned, everything else left.
  const colAlign = columns.map((_, ci): "left" | "right" => {
    const vals = rows.map((r) => r[ci]).filter((v): v is string => v != null && String(v).trim() !== "");
    return vals.length > 0 && vals.every((v) => /^-?[\d,]*\.?\d+%?$/.test(String(v).trim())) ? "right" : "left";
  });

  return (
    <TableContainer sx={{ maxHeight: 360, overflowX: "auto" }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            {columns.map((col, ci) => (
              <TableCell key={col} align={colAlign[ci]} sx={{
                whiteSpace: "nowrap",
                bgcolor: C.card,
                color: C.textMd,
              }}>
                {col}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, ri) => (
            <TableRow key={ri} sx={{
              "&:nth-of-type(even)": { bgcolor: `${C.text}06` },
              "&:hover": { bgcolor: `${C.orange}12` },
            }}>
              {row.map((cell, ci) => (
                <TableCell key={ci} align={colAlign[ci]} sx={{ fontSize: FS.body, py: 0.5, whiteSpace: "nowrap" }}>
                  {cell ?? <Typography variant="caption" color="text.disabled" fontStyle="italic">null</Typography>}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ── Intelligence components ───────────────────────────────────────────────────

const TIER_CONFIG = {
  hot:      { label: "Hot",      color: "#ef4444", bg: "rgba(239,68,68,0.08)",   icon: "🔴" },
  warm:     { label: "Warm",     color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  icon: "🟡" },
  watching: { label: "Watching", get color() { return C.sub; }, bg: "rgba(107,114,128,0.08)", icon: "👁" },
};

const ACTION_COLOR: Record<string, string> = {
  "SDR Outreach":     "#ef4444",
  "LinkedIn Retarget":"#0077b5",
  "Email Nurture":    "#10b981",
  get "Monitor"() { return C.dim; },
};

function IntelligenceSummaryCards({ summary }: { summary: IntelligenceSummary }) {
  const cards = [
    { label: "Hot",          value: summary.hot_count,         color: "#ef4444", sub: "Ready for SDR outreach" },
    { label: "Warm",         value: summary.warm_count,        color: "#f59e0b", sub: "Needs nurturing" },
    { label: "Watching",     value: summary.watching_count,    color: C.sub, sub: "Early signals only" },
    ...(summary.competitive_evals != null
      ? [{ label: "Competitive", value: summary.competitive_evals, color: "#8b5cf6", sub: "Active vendor evals" }]
      : []),
    ...(summary.new_this_week != null
      ? [{ label: "New this week", value: summary.new_this_week, color: "#3b82f6", sub: "Entered pipeline" }]
      : []),
  ];

  return (
    <Box sx={{ mb: 2 }}>
      {summary.headline && (
        <Box sx={{
          mb: 1.5, px: 1.5, py: 1,
          bgcolor: `${C.orange}10`,
          borderLeft: "3px solid #FF7300", borderRadius: "0 6px 6px 0",
        }}>
          <Typography variant="body2" sx={{ fontWeight: FW.medium, fontSize: FS.reading, lineHeight: 1.5 }}>
            {summary.headline}
          </Typography>
        </Box>
      )}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 1 }}>
        {cards.map((c) => (
          <Box key={c.label} sx={{
            border: "1px solid", borderColor: "divider", borderRadius: 1.5,
            px: 1.5, py: 1.25, textAlign: "center",
            bgcolor: C.card,
          }}>
            <Typography sx={{ fontSize: FS.kpi, fontWeight: FW.bold, lineHeight: 1.1, color: c.color }}>
              {c.value}
            </Typography>
            <Typography sx={{ fontSize: FS.small, fontWeight: FW.semibold, color: c.color, mt: 0.25 }}>
              {c.label}
            </Typography>
            <Typography sx={{ fontSize: FS.caption, color: "text.disabled", mt: 0.25 }}>
              {c.sub}
            </Typography>
          </Box>
        ))}
      </Box>
      {((summary.top_regions?.length ?? 0) > 0 || (summary.top_products && summary.top_products.length > 0)) && (
        <Box sx={{ mt: 1, display: "flex", flexDirection: "column", gap: 0.5 }}>
          {(summary.top_regions?.length ?? 0) > 0 && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: FS.small }}>Top regions:</Typography>
              {(summary.top_regions ?? []).map((r) => (
                <Chip key={r} label={r} size="small"
                  sx={{ height: 18, fontSize: FS.caption, "& .MuiChip-label": { px: 0.75 } }} />
              ))}
            </Box>
          )}
          {summary.top_products && summary.top_products.length > 0 && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: FS.small }}>Top products:</Typography>
              {summary.top_products.map((p) => (
                <Chip key={p} label={p} size="small" variant="outlined"
                  sx={{ height: 18, fontSize: FS.caption, borderColor: C.orange, color: C.orange, "& .MuiChip-label": { px: 0.75 } }} />
              ))}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

/** Compact account chip — shows company name only, click to expand details */
function AccountCompactCard({ account }: { account: IntelligenceAccount }) {
  const [open, setOpen] = useState(false);
  const tier = TIER_CONFIG[account.tier] ?? TIER_CONFIG.watching;
  const actionColor = ACTION_COLOR[account.action] ?? C.dim;

  return (
    <Box>
      <Box
        onClick={() => setOpen((v) => !v)}
        sx={{
          display: "flex", alignItems: "center", gap: 0.75,
          px: 1.25, py: 0.75, cursor: "pointer",
          border: "1px solid", borderColor: open ? tier.color + "44" : "divider",
          borderRadius: 1.5,
          bgcolor: open ? tier.bg : "transparent",
          "&:hover": { borderColor: tier.color + "66", bgcolor: tier.bg },
          transition: "all 0.15s",
        }}
      >
        <Typography sx={{ fontSize: FS.body, fontWeight: FW.medium, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {account.company}
        </Typography>
        <Typography sx={{ fontSize: FS.micro, color: "text.disabled", flexShrink: 0 }}>
          {open ? "▲" : "▼"}
        </Typography>
      </Box>

      {/* Expanded details */}
      <Collapse in={open}>
        <Box sx={{
          mt: 0.5, ml: 0.5, px: 1.25, py: 1,
          borderLeft: `2px solid ${tier.color}44`,
          bgcolor: `${C.text}04`,
          borderRadius: "0 6px 6px 0",
        }}>
          {/* Score + action row */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75, flexWrap: "wrap" }}>
            {account.score != null && (
              <Typography sx={{ fontSize: FS.body, fontWeight: FW.semibold, color: tier.color }}>
                {account.score} pts
              </Typography>
            )}
            <Box sx={{
              px: 0.75, py: 0.2, borderRadius: 0.75,
              bgcolor: `${actionColor}14`, border: `1px solid ${actionColor}30`,
            }}>
              <Typography sx={{ fontSize: FS.caption, fontWeight: FW.semibold, color: actionColor }}>
                {account.action}
              </Typography>
            </Box>
            {account.confidence && (
              <Typography sx={{ fontSize: FS.caption, color: "text.disabled", fontStyle: "italic" }}>
                {account.confidence} confidence
              </Typography>
            )}
          </Box>

          {/* Evidence */}
          {(account.signals ?? []).length > 0 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.3 }}>
              {(account.signals ?? []).map((s, i) => (
                <Box key={i} sx={{ display: "flex", alignItems: "flex-start", gap: 0.5 }}>
                  <Typography sx={{ fontSize: FS.small, color: tier.color, flexShrink: 0, mt: "1px" }}>▸</Typography>
                  <Typography sx={{ fontSize: FS.body, color: "text.secondary", lineHeight: 1.5 }}>{s}</Typography>
                </Box>
              ))}
            </Box>
          )}

          {/* Region + Products */}
          {(account.region || (account.product_interest && account.product_interest.length > 0)) && (
            <Box sx={{ mt: 0.75, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              {account.region && (
                <Chip label={account.region} size="small" sx={{ height: 16, fontSize: FS.caption, "& .MuiChip-label": { px: 0.6 } }} />
              )}
              {account.product_interest && account.product_interest.map((p) => (
                <Chip key={p} label={p} size="small" variant="outlined"
                  sx={{ height: 16, fontSize: FS.caption, borderColor: C.orange, color: C.orange, "& .MuiChip-label": { px: 0.5 } }} />
              ))}
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

/** 3-column grid of account cards for a given tier */
function AccountTierGrid({ accounts }: { accounts: IntelligenceAccount[] }) {
  return (
    <Box sx={{
      display: "grid",
      gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" },
      gap: 0.75,
    }}>
      {accounts.map((a) => (
        <AccountCompactCard key={a.company} account={a} />
      ))}
    </Box>
  );
}

function IntelligencePanel({ intelligence }: { intelligence: Intelligence }) {
  const [listOpen, setListOpen] = useState(true);
  const accounts = intelligence.accounts ?? [];
  const hotAccounts = accounts.filter((a) => a.tier === "hot");
  const warmAccounts = accounts.filter((a) => a.tier === "warm");
  const watchingAccounts = accounts.filter((a) => a.tier === "watching");

  return (
    <Box sx={{ mb: 1.5 }}>
      {/* Summary cards */}
      {intelligence.summary && (
        <IntelligenceSummaryCards summary={intelligence.summary} />
      )}

      {/* Recommendations — actionable next-steps */}
      {intelligence.recommendations && intelligence.recommendations.length > 0 && (
        <Box sx={{
          mb: 2, border: "1px solid", borderColor: "divider", borderRadius: 1.5,
          overflow: "hidden",
        }}>
          <Box sx={{
            px: 1.5, py: 0.75,
            bgcolor: "rgba(16,185,129,0.035)",
            borderBottom: "1px solid", borderColor: "divider",
          }}>
            <Typography sx={{ fontWeight: FW.semibold, fontSize: FS.body, textTransform: "uppercase", letterSpacing: 0.5, color: "#10b981" }}>
              Recommended Actions
            </Typography>
          </Box>
          <Box sx={{ px: 1.5, py: 1.25, display: "flex", flexDirection: "column", gap: 0.75 }}>
            {intelligence.recommendations.map((rec, i) => (
              <Box key={i} sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                <Typography sx={{ fontSize: FS.body, color: "#10b981", fontWeight: FW.semibold, flexShrink: 0, mt: "1px" }}>
                  {i + 1}.
                </Typography>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <MarkdownContent content={rec} />
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Account list */}
      {accounts.length > 0 && (
        <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5, overflow: "hidden" }}>
          <Box
            onClick={() => setListOpen((v) => !v)}
            sx={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              px: 1.5, py: 1, cursor: "pointer",
              bgcolor: `${C.orange}08`,
              "&:hover": { bgcolor: `${C.orange}10` },
            }}
          >
            <Typography sx={{ fontWeight: FW.semibold, fontSize: FS.body, textTransform: "uppercase", letterSpacing: 0.5, color: "primary.main" }}>
              Account Intelligence — {accounts.length} accounts {listOpen ? "▲" : "▼"}
            </Typography>
            <Box sx={{ display: "flex", gap: 0.75 }}>
              {hotAccounts.length > 0 && (
                <Chip label={`🔴 ${hotAccounts.length} Hot`} size="small"
                  sx={{ height: 20, fontSize: FS.small, bgcolor: "rgba(239,68,68,0.1)", color: "#ef4444", "& .MuiChip-label": { px: 0.75 } }} />
              )}
              {warmAccounts.length > 0 && (
                <Chip label={`🟡 ${warmAccounts.length} Warm`} size="small"
                  sx={{ height: 20, fontSize: FS.small, bgcolor: "rgba(245,158,11,0.1)", color: "#f59e0b", "& .MuiChip-label": { px: 0.75 } }} />
              )}
            </Box>
          </Box>
          <Collapse in={listOpen}>
            <Box sx={{ p: 1.5 }}>
              {hotAccounts.length > 0 && (
                <Box sx={{ mb: 1 }}>
                  <Typography sx={{ fontSize: FS.small, fontWeight: FW.semibold, textTransform: "uppercase", letterSpacing: 0.5, color: "#ef4444", mb: 0.75 }}>
                    🔴 Hot — Immediate Outreach ({hotAccounts.length})
                  </Typography>
                  <AccountTierGrid accounts={hotAccounts} />
                </Box>
              )}
              {warmAccounts.length > 0 && (
                <Box sx={{ mb: 1 }}>
                  <Typography sx={{ fontSize: FS.small, fontWeight: FW.semibold, textTransform: "uppercase", letterSpacing: 0.5, color: "#f59e0b", mb: 0.75 }}>
                    🟡 Warm — Nurture & Retarget ({warmAccounts.length})
                  </Typography>
                  <AccountTierGrid accounts={warmAccounts} />
                </Box>
              )}
              {watchingAccounts.length > 0 && (
                <Box>
                  <Typography sx={{ fontSize: FS.small, fontWeight: FW.semibold, textTransform: "uppercase", letterSpacing: 0.5, color: C.sub, mb: 0.75 }}>
                    👁 Watching — Monitor ({watchingAccounts.length})
                  </Typography>
                  <AccountTierGrid accounts={watchingAccounts} />
                </Box>
              )}
            </Box>
          </Collapse>
        </Box>
      )}
    </Box>
  );
}

// ── Markdown renderer for conversational responses ───────────────────────────

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split(/\n/);

  const renderInline = (text: string) => {
    const parts: React.ReactNode[] = [];
    // Match: [link text](url), **bold**, *italic*, `code`
    const regex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>);
      }
      if (match[1] && match[2]) {
        // [text](url) → clickable link
        parts.push(
          <a key={key++} href={match[2]} target="_blank" rel="noopener noreferrer"
            style={{ color: C.orange, textDecoration: "none" }}
            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
          >{match[1]}</a>
        );
      } else if (match[3]) {
        parts.push(<Box key={key++} component="span" sx={{ fontWeight: FW.semibold, color: "text.primary" }}>{match[3]}</Box>);
      } else if (match[4]) {
        parts.push(<Box key={key++} component="span" sx={{ fontStyle: "italic" }}>{match[4]}</Box>);
      } else if (match[5]) {
        parts.push(
          <Box key={key++} component="span" sx={{
            fontFamily: "monospace", fontSize: FS.body,
            px: 0.5, py: 0.125, borderRadius: 0.5,
            bgcolor: `${C.text}14`,
          }}>{match[5]}</Box>
        );
      }
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      parts.push(<span key={key++}>{text.slice(lastIndex)}</span>);
    }
    return parts.length > 0 ? parts : [<span key={0}>{text}</span>];
  };

  // ── Group consecutive table rows ──────────────────────────────────────
  const isTableRow = (s: string) => s.trim().startsWith("|") && s.trim().endsWith("|");
  const isSeparatorRow = (s: string) => /^\|[\s:|-]+\|$/.test(s.trim());

  const parseTableCells = (row: string) =>
    row.trim().slice(1, -1).split("|").map((c) => c.trim());

  const renderTable = (tableLines: string[], startIdx: number) => {
    // Find header, separator, and body rows
    const headerCells = parseTableCells(tableLines[0]);
    const bodyLines = tableLines.filter((_, j) => j > 0 && !isSeparatorRow(tableLines[j]));
    // Honour the markdown separator's alignment markers (:--, :-:, --:) so the
    // header and every body cell of a column share one alignment.
    const sepLine = tableLines.find((l, j) => j > 0 && isSeparatorRow(l));
    const sepCells = sepLine ? parseTableCells(sepLine) : [];
    const colAlign = (ci: number): "left" | "center" | "right" => {
      const m = (sepCells[ci] || "").replace(/\s/g, "");
      if (m.startsWith(":") && m.endsWith(":") && m.length > 1) return "center";
      if (m.endsWith(":")) return "right";
      return "left";
    };

    return (
      <TableContainer key={startIdx} component={Box} sx={{
        my: 1, borderRadius: 1.5, overflowX: "auto",
        border: "1px solid", borderColor: `${C.text}1a`,
      }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: `${C.text}0a` }}>
              {headerCells.map((cell, ci) => (
                <TableCell key={ci} align={colAlign(ci)} sx={{
                  color: "text.primary",
                  py: 0.75, borderColor: `${C.text}14`,
                }}>
                  {renderInline(cell)}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {bodyLines.map((row, ri) => {
              const cells = parseTableCells(row);
              return (
                <TableRow key={ri} sx={{
                  "&:last-child td": { borderBottom: 0 },
                  "&:hover": { bgcolor: `${C.text}05` },
                }}>
                  {cells.map((cell, ci) => (
                    <TableCell key={ci} align={colAlign(ci)} sx={{
                      fontSize: FS.body, color: "text.secondary", py: 0.6,
                      borderColor: `${C.text}0f`,
                    }}>
                      {renderInline(cell)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  // ── Render all lines, grouping tables ──────────────────────────────────
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    // ── Empty line → spacer ─────────────────────────────────────────────
    if (!trimmed) {
      elements.push(<Box key={i} sx={{ height: "0.4rem" }} />);
      i++;
      continue;
    }

    // ── Horizontal rule (--- or *** or ___) ─────────────────────────────
    if (/^[-*_]{3,}$/.test(trimmed)) {
      elements.push(<Divider key={i} sx={{ my: 1.5, borderColor: `${C.text}14` }} />);
      i++;
      continue;
    }

    // ── Table block — collect consecutive table rows ────────────────────
    if (isTableRow(trimmed)) {
      const tableStart = i;
      const tableLines: string[] = [];
      while (i < lines.length && isTableRow(lines[i].trim())) {
        tableLines.push(lines[i]);
        i++;
      }
      if (tableLines.length >= 2) {
        elements.push(renderTable(tableLines, tableStart));
      } else {
        // Single pipe line — render as text
        elements.push(
          <Typography key={tableStart} sx={{ fontSize: FS.body, lineHeight: 1.7, color: "text.secondary", mb: 0.15 }}>
            {renderInline(trimmed)}
          </Typography>
        );
      }
      continue;
    }

    // ── Blockquote (> text) ─────────────────────────────────────────────
    const blockquoteMatch = trimmed.match(/^>\s*(.*)/);
    if (blockquoteMatch) {
      elements.push(
        <Box key={i} sx={{
          borderLeft: "3px solid", borderColor: "primary.main", pl: 1.5, py: 0.5, my: 0.5,
          bgcolor: `${C.orange}08`,
          borderRadius: "0 6px 6px 0",
        }}>
          <Typography sx={{ fontSize: FS.body, lineHeight: 1.7, color: "text.secondary" }}>
            {renderInline(blockquoteMatch[1])}
          </Typography>
        </Box>
      );
      i++;
      continue;
    }

    // ── Headers ─────────────────────────────────────────────────────────
    const h2Match = trimmed.match(/^##\s+(.*)/);
    if (h2Match) {
      elements.push(
        <Typography key={i} sx={{
          fontSize: FS.reading, fontWeight: FW.semibold, color: "text.primary",
          mt: i > 0 ? 1.5 : 0, mb: 0.5,
          pb: 0.5, borderBottom: "1px solid",
          borderColor: `${C.text}14`,
        }}>
          {renderInline(h2Match[1])}
        </Typography>
      );
      i++;
      continue;
    }
    const h3Match = trimmed.match(/^###\s+(.*)/);
    if (h3Match) {
      elements.push(
        <Typography key={i} sx={{ fontSize: FS.reading, fontWeight: FW.semibold, color: "text.primary", mt: i > 0 ? 1 : 0, mb: 0.25 }}>
          {renderInline(h3Match[1])}
        </Typography>
      );
      i++;
      continue;
    }

    // ── Bold section header (full line bold **Header**) ─────────────────
    const headerMatch = trimmed.match(/^\*\*(.+?)\*\*$/);
    if (headerMatch) {
      elements.push(
        <Typography key={i} sx={{ fontSize: FS.reading, fontWeight: FW.semibold, color: "text.primary", mt: i > 0 ? 0.75 : 0, mb: 0.25 }}>
          {headerMatch[1]}
        </Typography>
      );
      i++;
      continue;
    }

    // ── Numbered list item (1. text) ────────────────────────────────────
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numberedMatch) {
      // Check if this looks like a major section header (e.g. "1. 🏢 Company Name")
      const isSection = /^\d+\.\s+[^\w]*[A-Z]/.test(trimmed) && trimmed.length < 80;
      elements.push(
        <Box key={i} sx={{ display: "flex", gap: 0.75, ml: isSection ? 0 : 1.5, mt: isSection ? 1.5 : 0.15, mb: 0.2 }}>
          <Typography sx={{
            fontSize: isSection ? FS.reading : FS.body,
            fontWeight: isSection ? FW.semibold : FW.regular,
            color: isSection ? "text.primary" : "text.disabled",
            lineHeight: 1.7, flexShrink: 0, minWidth: "1.5em",
          }}>
            {numberedMatch[1]}.
          </Typography>
          <Typography sx={{
            fontSize: isSection ? FS.reading : FS.body,
            fontWeight: isSection ? FW.semibold : FW.regular,
            lineHeight: 1.7,
            color: isSection ? "text.primary" : "text.secondary",
          }}>
            {renderInline(numberedMatch[2])}
          </Typography>
        </Box>
      );
      i++;
      continue;
    }

    // ── Bullet/list items (-, •, *) ─────────────────────────────────────
    const bulletMatch = trimmed.match(/^[-•*]\s+(.*)/);
    if (bulletMatch) {
      // Detect indent level from original line
      const indent = lines[i].match(/^(\s*)/)?.[1].length ?? 0;
      const level = Math.min(Math.floor(indent / 2), 3);
      elements.push(
        <Box key={i} sx={{ display: "flex", gap: 0.75, ml: 1.5 + level * 1.5, mb: 0.15 }}>
          <Typography sx={{ fontSize: FS.body, color: "text.disabled", lineHeight: 1.7, flexShrink: 0 }}>
            {level > 0 ? "◦" : "•"}
          </Typography>
          <Typography sx={{ fontSize: FS.body, lineHeight: 1.7, color: "text.secondary" }}>
            {renderInline(bulletMatch[1])}
          </Typography>
        </Box>
      );
      i++;
      continue;
    }

    // ── Regular paragraph ───────────────────────────────────────────────
    elements.push(
      <Typography key={i} sx={{ fontSize: FS.body, lineHeight: 1.7, color: "text.secondary", mb: 0.15 }}>
        {renderInline(trimmed)}
      </Typography>
    );
    i++;
  }

  return <Box sx={{ display: "flex", flexDirection: "column" }}>{elements}</Box>;
}

// ── AI message (Claude CLI–style flat layout) ─────────────────────────────────

function AIBubble({
  turn,
  favorites,
  onSave,
  onSendMessage,
}: {
  turn: ChatTurn;
  favorites: SavedQuery[];
  onSave: (turn: ChatTurn) => void;
  onSendMessage?: (msg: string) => void;
}) {
  const [viewTab, setViewTab] = useState(0);
  const [explanationOpen, setExplanationOpen] = useState(false);

  const { result, thinkingPreview, error, pending } = turn;
  const rows = result?.rows ?? [];
  const columns = result?.columns ?? [];
  const hasChart = result && result.chart && result.chart.type !== "table";
  const alreadySaved = result && favorites.some((f) => f.sql === result.sql);

  return (
    <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
      {/* AI avatar — small label like Claude CLI */}
      <Avatar sx={{
        width: 28, height: 28, flexShrink: 0,
        bgcolor: "primary.main", fontSize: "0.62rem", fontWeight: FW.semibold,
        letterSpacing: 0.3, mt: 0.25,
      }}>
        AI
      </Avatar>

      <Box sx={{ flex: 1, minWidth: 0, overflow: "hidden", pt: 0.1 }}>

        {/* Pending — thinking ticker (no box border, just inline) */}
        {pending && (
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: thinkingPreview ? 1.25 : 0 }}>
              <CircularProgress size={13} sx={{ color: "primary.main" }} />
              <Typography variant="body2" color="text.secondary" fontStyle="italic" fontSize={FS.reading}>
                Thinking… complex queries can take 1–3 minutes.
              </Typography>
            </Box>
            {thinkingPreview && (
              <Box sx={{
                borderLeft: "2px solid", borderColor: "primary.main",
                pl: 1.5, py: 0.5,
                bgcolor: `${C.orange}0a`,
                borderRadius: "0 4px 4px 0",
              }}>
                <Typography sx={{
                  display: "block", mb: 0.25, fontWeight: FW.semibold,
                  textTransform: "uppercase", letterSpacing: 0.6, fontSize: FS.caption,
                  color: "primary.main",
                }}>
                  Reasoning…
                </Typography>
                <Typography variant="caption" sx={{
                  color: "text.secondary", fontStyle: "italic", fontSize: FS.body,
                  lineHeight: 1.6, overflow: "hidden",
                  display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical",
                }}>
                  {thinkingPreview}
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Error — show a clean message, strip raw SQL/stack traces */}
        {error && !pending && (
          <Alert severity="error" variant="outlined" sx={{ borderRadius: 1 }}>
            {cleanErrorMessage(error)}
          </Alert>
        )}

        {/* Result — decision-focused layout */}
        {result && !pending && (result.response_type === "conversational") && result.answer && (
          <Box sx={{
            px: 1.5, py: 1.25,
            borderRadius: 2,
            bgcolor: `${C.text}05`,
            border: "1px solid",
            borderColor: `${C.text}12`,
          }}>
            <MarkdownContent content={result.answer} />
          </Box>
        )}

        {result && !pending && result.response_type === "needs_confirmation" && (
          <Box sx={{
            px: 2, py: 1.5,
            borderRadius: 2,
            bgcolor: "rgba(255,180,0,0.05)",
            border: "1px solid",
            borderColor: "rgba(255,180,0,0.18)",
          }}>
            <Typography variant="body2" sx={{ mb: 1.5, color: "text.primary" }}>
              {result.answer || result.confirmation_data?.message || "This action requires confirmation."}
            </Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                size="small"
                variant="contained"
                sx={{ textTransform: "none", fontSize: FS.body, borderRadius: "6px", bgcolor: C.orange, "&:hover": { bgcolor: C.orangeDark } }}
                onClick={() => onSendMessage?.("Yes, proceed")}
              >
                Yes, proceed (1 credit)
              </Button>
              <Button
                size="small"
                variant="outlined"
                sx={{ textTransform: "none", fontSize: FS.body, borderRadius: "6px", color: "text.secondary" }}
                onClick={() => onSendMessage?.("No, cancel")}
              >
                Cancel
              </Button>
            </Box>
          </Box>
        )}

        {result && !pending && result.response_type !== "conversational" && result.response_type !== "needs_confirmation" && (
          <Box>
            {/* ─── Explanation — collapsible "Why this query" section ── */}
            <Box sx={{ mb: 1.5 }}>
              <Box
                onClick={() => setExplanationOpen((v) => !v)}
                sx={{
                  display: "flex", alignItems: "center", gap: 0.75,
                  cursor: "pointer", userSelect: "none",
                  py: 0.5, px: 0.25, borderRadius: 1,
                  "&:hover": { bgcolor: `${C.text}0a` },
                  transition: "background 0.15s",
                }}
              >
                <InfoOutlinedIcon sx={{ fontSize: 15, color: "text.disabled" }} />
                <Typography sx={{
                  fontSize: FS.body, fontWeight: FW.semibold, color: "text.secondary",
                  letterSpacing: 0.2,
                }}>
                  Why this analysis
                </Typography>
                <Typography sx={{ fontSize: FS.caption, color: "text.disabled", ml: 0.25 }}>
                  {explanationOpen ? "▲" : "▼"}
                </Typography>
              </Box>
              <Collapse in={explanationOpen}>
                <Box sx={{
                  mt: 0.75, px: 1.5, py: 1.25,
                  borderLeft: "2px solid",
                  borderColor: `${C.orange}59`,
                  bgcolor: `${C.orange}08`,
                  borderRadius: "0 8px 8px 0",
                }}>
                  <MarkdownContent content={result.explanation || ""} />
                </Box>
              </Collapse>
            </Box>

            {result.intelligence ? (
              <>
                {/* ─── Intelligence-only view (CMO mode) ──────────────── */}
                {/* When intelligence exists, this IS the result. No chart noise, no raw tables. */}
                <IntelligencePanel intelligence={result.intelligence} />

                {/* ─── Action bar ─────────────────────────────────────── */}
                <Box sx={{
                  mt: 1.5, display: "flex", alignItems: "center", gap: 1,
                  flexWrap: "wrap",
                }}>
                  <Button
                    size="small"
                    variant={alreadySaved ? "outlined" : "contained"}
                    onClick={() => onSave(turn)}
                    disabled={!!alreadySaved}
                    startIcon={alreadySaved ? <BookmarkIcon sx={{ fontSize: 16 }} /> : <BookmarkAddIcon sx={{ fontSize: 16 }} />}
                    sx={{
                      textTransform: "none", fontSize: FS.body, borderRadius: "6px",
                      px: 1.5, py: 0.5,
                      ...(alreadySaved ? {
                        borderColor: "primary.main", color: "primary.main",
                      } : {}),
                    }}
                  >
                    {alreadySaved ? "Saved" : "Save query"}
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setViewTab(viewTab === 99 ? 0 : 99)}
                    startIcon={<StorageOutlinedIcon sx={{ fontSize: 15 }} />}
                    sx={{
                      textTransform: "none", fontSize: FS.body, borderRadius: "6px",
                      px: 1.5, py: 0.5,
                      borderColor: "divider", color: "text.secondary",
                      "&:hover": { borderColor: "primary.main", color: "primary.main" },
                    }}
                  >
                    {viewTab === 99 ? "Hide data" : `View data (${result.row_count ?? 0} rows)`}
                  </Button>
                </Box>

                {/* Underlying data — only when explicitly requested */}
                <Collapse in={viewTab === 99}>
                  <Box sx={{ mt: 1, border: "1px solid", borderColor: "divider", borderRadius: 1, overflow: "hidden" }}>
                    {rows.length === 0
                      ? <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>No results.</Typography>
                      : <ResultTable columns={columns} rows={rows} />
                    }
                  </Box>
                </Collapse>
              </>
            ) : (
              <>
                {/* ─── Analytics view (no intelligence — show chart/table) ── */}
                {/* For pure analytical queries: chart + data table */}

                {hasChart && rows.length > 0 && result.chart && (
                  <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5, overflow: "hidden", mb: 1.5 }}>
                    <Box sx={{ px: 1.5, py: 0.75, borderBottom: "1px solid", borderColor: "divider", bgcolor: C.card }}>
                      <Typography sx={{ fontSize: FS.body, fontWeight: FW.semibold, color: "text.secondary" }}>
                        {result.chart.title}
                      </Typography>
                    </Box>
                    <Box sx={{ p: 1.5, overflow: "hidden" }}>
                      <ChartView chart={result.chart} columns={columns} rows={rows} />
                    </Box>
                  </Box>
                )}

                {rows.length > 0 && (
                  <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, overflow: "hidden", mb: 1 }}>
                    <ResultTable columns={columns} rows={rows} />
                  </Box>
                )}

                {/* ─── Action bar ─────────────────────────────────────── */}
                <Box sx={{
                  display: "flex", alignItems: "center", gap: 1,
                  flexWrap: "wrap",
                }}>
                  <Chip label={`${result.row_count ?? 0} result${(result.row_count ?? 0) !== 1 ? "s" : ""}`}
                    size="small" variant="outlined"
                    sx={{ height: 24, fontSize: FS.body, borderRadius: "6px" }} />
                  <Button
                    size="small"
                    variant={alreadySaved ? "outlined" : "contained"}
                    onClick={() => onSave(turn)}
                    disabled={!!alreadySaved}
                    startIcon={alreadySaved ? <BookmarkIcon sx={{ fontSize: 16 }} /> : <BookmarkAddIcon sx={{ fontSize: 16 }} />}
                    sx={{
                      textTransform: "none", fontSize: FS.body, borderRadius: "6px",
                      px: 1.5, py: 0.5,
                      ...(alreadySaved ? {
                        borderColor: "primary.main", color: "primary.main",
                      } : {}),
                    }}
                  >
                    {alreadySaved ? "Saved" : "Save query"}
                  </Button>
                </Box>
              </>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const DRAWER_WIDTH = 320;

/** Natural language query interface — converts plain English to SQL and displays results. */
export default function NLQuery() {
  const { request, get } = useApiClient();

  const [prompt, setPrompt] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const isWaiting = turns.some((t) => t.pending);

  // Skills (slash commands)
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillMenuOpen, setSkillMenuOpen] = useState(false);
  const [skillFilter, setSkillFilter] = useState("");
  const [activeSkill, setActiveSkill] = useState<Skill | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Favorites state
  const [favorites, setFavorites] = useState<SavedQuery[]>([]);
  const [favLoading, setFavLoading] = useState(true);

  // Sessions state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState(0); // 0 = Sessions, 1 = Saved Queries
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [saveTurn, setSaveTurn] = useState<ChatTurn | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingFav, setDeletingFav] = useState<number | null>(null);
  const [deletingSession, setDeletingSession] = useState<number | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  // Ref to latest turns/history so we can persist from inside async callbacks
  const turnsRef = useRef<ChatTurn[]>(turns);
  const historyRef = useRef<HistoryEntry[]>(history);
  useEffect(() => { turnsRef.current = turns; }, [turns]);
  useEffect(() => { historyRef.current = history; }, [history]);

  useEffect(() => {
    get<SavedQuery[]>("/saved-queries")
      .then(setFavorites)
      .catch(() => setFavorites([]))
      .finally(() => setFavLoading(false));
    get<Skill[]>("/nl-query/skills")
      .then(setSkills)
      .catch(() => setSkills([]));
    get<ChatSession[]>("/chat-sessions")
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setSessionsLoading(false));
  }, [get]);

  // Auto-scroll to bottom whenever turns change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  // Persist current turns+history to the DB after each completed turn.
  // Called with the latest snapshot from inside pollJob/handleRunFavorite.
  const persistSession = useCallback(async (
    latestTurns: ChatTurn[],
    latestHistory: HistoryEntry[],
    sessionId: number | null,
    firstUserMessage: string,
  ): Promise<number> => {
    // Strip pending turns before saving — only persist completed turns
    const completedTurns = latestTurns.filter((t) => !t.pending);
    if (completedTurns.length === 0) return sessionId ?? 0;

    try {
      if (sessionId) {
        await request("put", `/chat-sessions/${sessionId}`, {
          turns: completedTurns,
          history: latestHistory,
        });
        setSessions((prev) => prev.map((s) =>
          s.id === sessionId
            ? { ...s, turns: completedTurns, history: latestHistory, updated_at: new Date().toISOString() }
            : s
        ));
        return sessionId;
      } else {
        const title = firstUserMessage.slice(0, 120) || "New chat";
        const created = await request<ChatSession>("post", "/chat-sessions", {
          title,
          turns: completedTurns,
          history: latestHistory,
        });
        setCurrentSessionId(created.id);
        setSessions((prev) => [created, ...prev]);
        return created.id;
      }
    } catch {
      // Non-fatal — session persistence failure shouldn't break the chat UX
      return sessionId ?? 0;
    }
  }, [request]);

  const pollJob = useCallback(async (jobId: string, turnId: string, userMessage: string) => {
    const MAX_ATTEMPTS = 120;
    let attempts = 0;
    while (attempts < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, 5000));
      attempts++;
      try {
        const job = await get<{
          job_id: string;
          status: string;
          thinking_preview?: string | null;
          result?: NLQueryResult;
          error?: string;
        }>(`/nl-query/${jobId}`);

        // Update thinking preview live
        if (job.thinking_preview) {
          setTurns((prev) => prev.map((t) =>
            t.id === turnId ? { ...t, thinkingPreview: job.thinking_preview! } : t
          ));
        }

        if (job.status === "done" && job.result) {
          const updatedTurns = turnsRef.current.map((t) =>
            t.id === turnId ? { ...t, result: job.result!, thinkingPreview: null, pending: false } : t
          );
          // Build assistant history content based on response type
          let assistantContent = job.result!.explanation + "\n\nSQL:\n" + job.result!.sql;
          if (job.result!.response_type === "conversational" && job.result!.answer) {
            assistantContent = job.result!.answer;
          } else if (job.result!.response_type === "needs_confirmation" && job.result!.confirmation_data) {
            // Store the confirmation data as JSON so the backend can find it on follow-up
            assistantContent = JSON.stringify(job.result!.confirmation_data);
          }
          const updatedHistory: HistoryEntry[] = [
            ...historyRef.current,
            { role: "user", content: userMessage },
            { role: "assistant", content: assistantContent },
          ];
          setTurns(updatedTurns);
          setHistory(updatedHistory);
          // Persist to DB — use functional ref for currentSessionId since state may be stale
          setCurrentSessionId((prevId) => {
            persistSession(updatedTurns, updatedHistory, prevId, userMessage);
            return prevId;
          });
          return;
        }

        if (job.status === "failed") {
          setTurns((prev) => prev.map((t) =>
            t.id === turnId ? { ...t, error: job.error ?? "AI query failed.", thinkingPreview: null, pending: false } : t
          ));
          return;
        }
      } catch {
        // transient network error — keep polling
      }
    }
    setTurns((prev) => prev.map((t) =>
      t.id === turnId
        ? { ...t, error: "Timed out waiting for AI response. Please try again.", thinkingPreview: null, pending: false }
        : t
    ));
  }, [get, persistSession]);

  const handlePromptChange = (value: string) => {
    setPrompt(value);
    if (value.startsWith("/")) {
      setSkillFilter(value.slice(1).toLowerCase());
      setSkillMenuOpen(true);
    } else {
      setSkillMenuOpen(false);
      setSkillFilter("");
    }
  };

  const handleSelectSkill = (skill: Skill) => {
    setActiveSkill(skill);
    setPrompt("");
    setSkillMenuOpen(false);
    setSkillFilter("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleClearSkill = () => {
    setActiveSkill(null);
    setPrompt("");
  };

  const filteredSkills = skills.filter(
    (s) =>
      s.slug.toLowerCase().includes(skillFilter) ||
      s.name.toLowerCase().includes(skillFilter) ||
      s.description.toLowerCase().includes(skillFilter)
  );

  const sendDirectMessage = (msg: string) => {
    setPrompt(msg);
    // Use requestAnimationFrame to ensure state is set before handleAsk reads it
    requestAnimationFrame(() => {
      // Inline the send logic
      const q = msg.trim();
      if (!q || isWaiting) return;
      setPrompt("");
      setGlobalError(null);

      const turnId = crypto.randomUUID();
      const newTurn: ChatTurn = {
        id: turnId,
        userMessage: q,
        result: null,
        thinkingPreview: null,
        error: null,
        pending: true,
      };
      setTurns((prev) => [...prev, newTurn]);

      request<{ job_id: string; status: string }>("post", "/nl-query", {
        prompt: q,
        session_id: currentSessionId?.toString() ?? crypto.randomUUID(),
        history: historyRef.current,
        skill: null,
      }).then((accepted) => {
        pollJob(accepted.job_id, turnId, q);
      }).catch((e: unknown) => {
        setTurns((prev) => prev.map((t) =>
          t.id === turnId
            ? { ...t, error: (e as { message?: string })?.message ?? "Something went wrong.", pending: false }
            : t
        ));
      });
    });
  };

  const handleAsk = async () => {
    const q = prompt.trim();
    if (!q || isWaiting) return;
    setPrompt("");
    setGlobalError(null);
    const usedSkill = activeSkill;
    setActiveSkill(null);

    const turnId = crypto.randomUUID();
    const newTurn: ChatTurn = {
      id: turnId,
      userMessage: usedSkill ? `/${usedSkill.slug} — ${q}` : q,
      result: null,
      thinkingPreview: null,
      error: null,
      pending: true,
    };
    setTurns((prev) => [...prev, newTurn]);

    try {
      const accepted = await request<{ job_id: string; status: string }>("post", "/nl-query", {
        prompt: q,
        session_id: currentSessionId?.toString() ?? crypto.randomUUID(),
        history,
        skill: usedSkill?.slug ?? null,
      });
      pollJob(accepted.job_id, turnId, newTurn.userMessage);
    } catch (e: unknown) {
      setTurns((prev) => prev.map((t) =>
        t.id === turnId
          ? { ...t, error: (e as { message?: string })?.message ?? "Something went wrong.", pending: false }
          : t
      ));
    }
  };

  const handleNewChat = () => {
    setTurns([]);
    setHistory([]);
    setCurrentSessionId(null);
    setPrompt("");
    setActiveSkill(null);
    setSkillMenuOpen(false);
    setGlobalError(null);
  };

  const handleRestoreSession = (session: ChatSession) => {
    setTurns(session.turns ?? []);
    setHistory(session.history ?? []);
    setCurrentSessionId(session.id);
    setDrawerOpen(false);
    setGlobalError(null);
  };

  const handleDeleteSession = async (id: number) => {
    setDeletingSession(id);
    try {
      await request("delete", `/chat-sessions/${id}`, undefined);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (currentSessionId === id) {
        setTurns([]);
        setHistory([]);
        setCurrentSessionId(null);
      }
    } catch (e: unknown) {
      setGlobalError((e as { message?: string })?.message ?? "Failed to delete session.");
    } finally {
      setDeletingSession(null);
    }
  };

  const handleRunFavorite = async (fav: SavedQuery) => {
    setDrawerOpen(false);
    setGlobalError(null);

    const turnId = crypto.randomUUID();
    const userMessage = fav.prompt || fav.title;

    const pendingTurn: ChatTurn = {
      id: turnId,
      userMessage,
      result: null,
      thinkingPreview: null,
      error: null,
      pending: true,
    };
    setTurns((prev) => [...prev, pendingTurn]);

    try {
      const result = await request<NLQueryResult>("post", `/saved-queries/${fav.id}/run`, undefined);
      const updatedTurns = turnsRef.current.map((t) =>
        t.id === turnId ? { ...t, result, pending: false } : t
      );
      const updatedHistory: HistoryEntry[] = [
        ...historyRef.current,
        { role: "user", content: userMessage },
        { role: "assistant", content: result.explanation + "\n\nSQL:\n" + result.sql },
      ];
      setTurns(updatedTurns);
      setHistory(updatedHistory);
      setCurrentSessionId((prevId) => {
        persistSession(updatedTurns, updatedHistory, prevId, userMessage);
        return prevId;
      });
    } catch (e: unknown) {
      setTurns((prev) => prev.map((t) =>
        t.id === turnId
          ? { ...t, error: (e as { message?: string })?.message ?? "Failed to run saved query.", pending: false }
          : t
      ));
    }
  };

  const handleDeleteFavorite = async (id: number) => {
    setDeletingFav(id);
    try {
      await request("delete", `/saved-queries/${id}`, undefined);
      setFavorites((prev) => prev.filter((f) => f.id !== id));
    } catch (e: unknown) {
      setGlobalError((e as { message?: string })?.message ?? "Failed to delete.");
    } finally {
      setDeletingFav(null);
    }
  };

  const openSaveDialog = (turn: ChatTurn) => {
    setSaveTurn(turn);
    setSaveTitle((turn.userMessage ?? "").slice(0, 120) || "My Query");
    setSaveDialogOpen(true);
  };

  const handleSave = async () => {
    if (!saveTurn?.result || !saveTitle.trim()) return;
    setSaving(true);
    try {
      const saved = await request<SavedQuery>("post", "/saved-queries", {
        title: saveTitle.trim(),
        prompt: saveTurn.userMessage || null,
        sql: saveTurn.result.sql,
        explanation: saveTurn.result.explanation,
        chart: saveTurn.result.chart,
      });
      setFavorites((prev) => [saved, ...prev]);
      setSaveDialogOpen(false);
    } catch (e: unknown) {
      setGlobalError((e as { message?: string })?.message ?? "Failed to save query.");
    } finally {
      setSaving(false);
    }
  };

  const SUGGESTIONS = [
    "Top 10 companies by G2 intent signals in the last 90 days",
    "Show Pardot leads from enterprise accounts with high activity",
    "LinkedIn campaign performance by job title this quarter",
    "Companies active on G2 but not yet in Salesforce",
  ];

  const formatSessionDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  };

  return (
    <Box sx={{
      height: "100%", display: "flex", flexDirection: "column",
      fontFamily: "'Inter', system-ui, sans-serif",
      bgcolor: C.bg, overflow: "hidden",
    }}>

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <Box sx={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        px: 2, py: 1.25, flexShrink: 0, borderBottom: `1px solid ${C.border}`, bgcolor: C.panel,
      }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <AutoAwesomeIcon sx={{ color: "primary.main", fontSize: 18 }} />
          <Typography fontWeight={FW.semibold} fontSize={FS.reading} fontFamily="'Inter', system-ui, sans-serif">Ask AI</Typography>
          {turns.length > 0 && (
            <Chip label={`${turns.length} turn${turns.length !== 1 ? "s" : ""}`}
              size="small" sx={{ height: 18, fontSize: FS.caption, "& .MuiChip-label": { px: 0.75 } }} />
          )}
          {currentSessionId && (
            <Chip label="saved" size="small" color="success" variant="outlined"
              sx={{ height: 18, fontSize: FS.caption, "& .MuiChip-label": { px: 0.75 } }} />
          )}
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          {turns.length > 0 && (
            <Tooltip title="New conversation">
              <Button size="small" variant="outlined" startIcon={<AddCommentOutlinedIcon sx={{ fontSize: 15 }} />}
                onClick={handleNewChat}
                sx={{ textTransform: "none", fontSize: FS.body, borderRadius: "4px", borderColor: "divider", color: "text.secondary", "&:hover": { borderColor: "primary.main", color: "primary.main" } }}>
                New chat
              </Button>
            </Tooltip>
          )}
          <Tooltip title="Sessions & bookmarked queries">
            <Button size="small" variant="outlined" onClick={() => setDrawerOpen(true)}
              startIcon={<ChatBubbleOutlineIcon sx={{ fontSize: 15 }} />}
              sx={{ textTransform: "none", fontSize: FS.body, borderRadius: "4px", borderColor: "divider", color: "text.secondary", "&:hover": { borderColor: "primary.main", color: "primary.main" } }}>
              History
              {sessions.length > 0 && (
                <Chip label={sessions.length} size="small"
                  sx={{ ml: 0.75, height: 16, fontSize: FS.caption, "& .MuiChip-label": { px: 0.6 } }} />
              )}
            </Button>
          </Tooltip>
        </Box>
      </Box>

      {globalError && (
        <Alert severity="error" sx={{ mb: 1.5, borderRadius: "4px", flexShrink: 0 }} onClose={() => setGlobalError(null)}>
          {globalError}
        </Alert>
      )}

      {/* ── Chat thread ────────────────────────────────────────────────────── */}
      <Box sx={{
        flex: 1, overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column",
        pb: 2, px: 2,
        "&::-webkit-scrollbar": { width: 4 },
        "&::-webkit-scrollbar-track": { bgcolor: "transparent" },
        "&::-webkit-scrollbar-thumb": { bgcolor: `${C.text}1f`, borderRadius: 2 },
      }}>

        {turns.length === 0 && (
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2.5, px: 2 }}>
            <Box sx={{ textAlign: "center" }}>
              <AutoAwesomeIcon sx={{ fontSize: 40, color: "primary.main", mb: 1, opacity: 0.8 }} />
              <Typography variant="h6" fontWeight={FW.semibold} gutterBottom>
                What would you like to know?
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Ask anything about your marketing intent data — I'll write and run the SQL for you.
              </Typography>
            </Box>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25, justifyContent: "center", maxWidth: 640 }}>
              {SUGGESTIONS.map((s) => (
                <Chip
                  key={s}
                  label={s}
                  icon={<ChevronRightIcon sx={{ fontSize: 14 }} />}
                  variant="outlined"
                  size="small"
                  clickable
                  onClick={() => setPrompt(s)}
                  sx={{
                    fontSize: FS.body, borderRadius: "8px", height: "auto",
                    py: 0.75, px: 0.5,
                    borderColor: "divider",
                    "& .MuiChip-label": { whiteSpace: "normal", lineHeight: 1.5 },
                    "& .MuiChip-icon": { color: "text.disabled", ml: 0.5 },
                    "&:hover": {
                      borderColor: "primary.main", color: "primary.main",
                      "& .MuiChip-icon": { color: "primary.main" },
                    },
                    transition: "all 0.15s",
                  }}
                />
              ))}
            </Box>
          </Box>
        )}

        <Box sx={{ display: "flex", flexDirection: "column", gap: 0, minWidth: 0 }}>
          {turns.map((turn, idx) => (
            <Box key={turn.id} sx={{ minWidth: 0 }}>
              {idx > 0 && <Divider sx={{ my: 2.5 }} />}
              <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", mb: 2 }}>
                <Avatar sx={{
                  width: 28, height: 28, flexShrink: 0,
                  bgcolor: `${C.text}1a`,
                  color: "text.secondary",
                  mt: 0.25,
                }}>
                  <PersonOutlineIcon sx={{ fontSize: 17 }} />
                </Avatar>
                <Typography variant="body1" sx={{ pt: 0.25, lineHeight: 1.7, fontWeight: FW.medium }}>
                  {turn.userMessage}
                </Typography>
              </Box>
              <AIBubble turn={turn} favorites={favorites} onSave={openSaveDialog} onSendMessage={sendDirectMessage} />
            </Box>
          ))}
        </Box>

        <div ref={bottomRef} />
      </Box>

      {/* ── Input bar ───────────────────────────────────────────────────────── */}
      <Box sx={{ flexShrink: 0, pt: 1.5 }} id="input-anchor">

        <Popper
          open={skillMenuOpen && filteredSkills.length > 0}
          anchorEl={document.getElementById("input-anchor")}
          placement="top-start"
          style={{ zIndex: 1300, width: "100%" }}
        >
          <Paper variant="outlined" sx={{ borderRadius: "8px", overflow: "hidden", mb: 0.5, maxHeight: 260, overflowY: "auto" }}>
            <Box sx={{ px: 1.5, py: 0.75, borderBottom: "1px solid", borderColor: "divider" }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: FS.small, fontWeight: FW.semibold, textTransform: "uppercase", letterSpacing: 0.6 }}>
                Skills
              </Typography>
            </Box>
            <MenuList dense sx={{ py: 0.5 }}>
              {filteredSkills.map((skill) => (
                <MenuItem
                  key={skill.slug}
                  onClick={() => handleSelectSkill(skill)}
                  sx={{
                    px: 1.5, py: 0.75, gap: 1.5, alignItems: "flex-start",
                    borderRadius: "4px", mx: 0.5,
                    "&:hover": { bgcolor: `${C.orange}12` },
                  }}
                >
                  <Box sx={{
                    fontFamily: "monospace", fontSize: FS.body, fontWeight: FW.semibold,
                    color: "primary.main", flexShrink: 0, minWidth: 130,
                  }}>
                    /{skill.slug}
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: FS.body, lineHeight: 1.4 }}>
                    {skill.description}
                  </Typography>
                </MenuItem>
              ))}
            </MenuList>
          </Paper>
        </Popper>

        <Paper
          variant="outlined"
          sx={{
            display: "flex", flexDirection: "column",
            borderRadius: "12px",
            borderColor: isWaiting ? "primary.main" : skillMenuOpen ? "primary.main" : "divider",
            transition: "border-color 0.2s",
            overflow: "hidden",
            "&:focus-within": { borderColor: "primary.main" },
          }}
        >
          {activeSkill && (
            <Box sx={{ px: 1.5, pt: 1, display: "flex", alignItems: "center", gap: 0.75 }}>
              <Chip
                label={`/${activeSkill.slug}`}
                size="small"
                onDelete={handleClearSkill}
                sx={{
                  height: 22, fontSize: FS.small, fontFamily: "monospace",
                  fontWeight: FW.semibold, borderRadius: "4px",
                  bgcolor: `${C.orange}1a`,
                  color: "primary.main",
                  "& .MuiChip-deleteIcon": { color: "primary.main", fontSize: FS.reading },
                }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: FS.small }}>
                {activeSkill.description}
              </Typography>
            </Box>
          )}

          <InputBase
            fullWidth
            multiline
            minRows={1}
            maxRows={6}
            inputRef={inputRef}
            placeholder={
              isWaiting
                ? "Waiting for response…"
                : skillMenuOpen
                  ? `Filter skills…`
                  : activeSkill
                    ? `Type a company name…`
                    : turns.length === 0
                      ? "Ask anything, or type / for skills…"
                      : "Ask a follow-up, or type / for skills…"
            }
            value={prompt}
            onChange={(e) => handlePromptChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && skillMenuOpen) { setSkillMenuOpen(false); setPrompt(""); return; }
              if (e.key === "Tab" && skillMenuOpen && filteredSkills.length > 0) {
                e.preventDefault();
                handleSelectSkill(filteredSkills[0]);
                return;
              }
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAsk(); }
            }}
            disabled={isWaiting}
            sx={{
              px: 2, pt: activeSkill ? 0.75 : 1.5, pb: 0.5,
              fontSize: FS.reading, lineHeight: 1.6,
              "& textarea": { resize: "none" },
            }}
          />
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 1.5, py: 0.75 }}>
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: FS.body }}>
              {isWaiting ? "Processing…" : "Enter to send · Shift+Enter for new line · type / for skills"}
            </Typography>
            <Tooltip title={isWaiting ? "Waiting…" : "Send (Enter)"}>
              <span>
                <IconButton
                  size="small"
                  onClick={handleAsk}
                  disabled={!prompt.trim() || isWaiting}
                  sx={{
                    bgcolor: prompt.trim() && !isWaiting ? "primary.main" : "action.disabledBackground",
                    color: "#fff", width: 34, height: 34, borderRadius: "8px",
                    "&:hover": { bgcolor: "primary.dark" },
                    "&:disabled": { bgcolor: "action.disabledBackground", color: "action.disabled" },
                  }}
                >
                  {isWaiting
                    ? <CircularProgress size={14} sx={{ color: "text.disabled" }} />
                    : <ArrowUpwardIcon sx={{ fontSize: 16 }} />}
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Paper>
      </Box>

      {/* ── History Drawer (Sessions + Saved Queries) ───────────────────────── */}
      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: DRAWER_WIDTH, bgcolor: "background.paper", borderLeft: "1px solid", borderColor: "divider" } }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
          <Typography fontWeight={FW.semibold} fontSize={FS.reading}>History</Typography>
          <IconButton size="small" onClick={() => setDrawerOpen(false)}>
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Tabs */}
        <Tabs value={drawerTab} onChange={(_, v) => setDrawerTab(v)}
          sx={{
            borderBottom: "1px solid", borderColor: "divider", minHeight: 38,
            "& .MuiTab-root": { textTransform: "none", fontSize: FS.body, minHeight: 38 },
          }}>
          <Tab label={
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <ChatBubbleOutlineIcon sx={{ fontSize: 14 }} />
              Sessions
              {sessions.length > 0 && (
                <Chip label={sessions.length} size="small"
                  sx={{ height: 16, fontSize: FS.caption, "& .MuiChip-label": { px: 0.5 } }} />
              )}
            </Box>
          } />
          <Tab label={
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <BookmarkIcon sx={{ fontSize: 14 }} />
              Bookmarked
              {favorites.length > 0 && (
                <Chip label={favorites.length} size="small"
                  sx={{ height: 16, fontSize: FS.caption, "& .MuiChip-label": { px: 0.5 } }} />
              )}
            </Box>
          } />
        </Tabs>

        {/* Sessions tab */}
        {drawerTab === 0 && (
          <Box sx={{ flex: 1, overflowY: "auto" }}>
            {sessionsLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", pt: 4 }}>
                <CircularProgress size={24} />
              </Box>
            ) : sessions.length === 0 ? (
              <Box sx={{ px: 2, pt: 4, textAlign: "center" }}>
                <ChatBubbleOutlineIcon sx={{ fontSize: 32, color: "text.disabled", mb: 1 }} />
                <Typography variant="body2" color="text.disabled">No saved sessions yet.</Typography>
                <Typography variant="caption" color="text.disabled">Sessions are saved automatically as you chat.</Typography>
              </Box>
            ) : (
              <List disablePadding>
                {sessions.map((session, idx) => (
                  <Box key={session.id}>
                    {idx > 0 && <Divider />}
                    <ListItem
                      disablePadding
                      secondaryAction={
                        <Tooltip title="Delete session">
                          <span>
                            <IconButton edge="end" size="small" onClick={() => handleDeleteSession(session.id)}
                              disabled={deletingSession === session.id}
                              sx={{ color: "text.disabled", "&:hover": { color: "error.main" } }}>
                              {deletingSession === session.id ? <CircularProgress size={13} /> : <DeleteOutlineIcon sx={{ fontSize: 16 }} />}
                            </IconButton>
                          </span>
                        </Tooltip>
                      }
                    >
                      <ListItemButton
                        onClick={() => handleRestoreSession(session)}
                        selected={currentSessionId === session.id}
                        sx={{
                          py: 1.25, pr: 5,
                          "&.Mui-selected": { bgcolor: `${C.orange}12` },
                          "&.Mui-selected:hover": { bgcolor: `${C.orange}1a` },
                        }}
                      >
                        <ListItemText
                          primary={session.title}
                          secondary={`${session.turns?.length ?? 0} turn${(session.turns?.length ?? 0) !== 1 ? "s" : ""} · ${formatSessionDate(session.updated_at)}`}
                          primaryTypographyProps={{ fontSize: FS.body, fontWeight: currentSessionId === session.id ? FW.semibold : FW.medium, noWrap: true }}
                          secondaryTypographyProps={{ fontSize: FS.small }}
                        />
                      </ListItemButton>
                    </ListItem>
                  </Box>
                ))}
              </List>
            )}
          </Box>
        )}

        {/* Saved Queries tab */}
        {drawerTab === 1 && (
          <Box sx={{ flex: 1, overflowY: "auto" }}>
            {favLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", pt: 4 }}>
                <CircularProgress size={24} />
              </Box>
            ) : favorites.length === 0 ? (
              <Box sx={{ px: 2, pt: 4, textAlign: "center" }}>
                <BookmarkIcon sx={{ fontSize: 32, color: "text.disabled", mb: 1 }} />
                <Typography variant="body2" color="text.disabled">No bookmarked queries yet.</Typography>
                <Typography variant="caption" color="text.disabled">Run a query and click the bookmark icon to add it here.</Typography>
              </Box>
            ) : (
              <List disablePadding>
                {favorites.map((fav, idx) => (
                  <Box key={fav.id}>
                    {idx > 0 && <Divider />}
                    <ListItem disablePadding secondaryAction={
                      <Tooltip title="Delete">
                        <span>
                          <IconButton edge="end" size="small" onClick={() => handleDeleteFavorite(fav.id)}
                            disabled={deletingFav === fav.id}
                            sx={{ color: "text.disabled", "&:hover": { color: "error.main" } }}>
                            {deletingFav === fav.id ? <CircularProgress size={13} /> : <DeleteOutlineIcon sx={{ fontSize: 16 }} />}
                          </IconButton>
                        </span>
                      </Tooltip>
                    }>
                      <ListItemButton onClick={() => handleRunFavorite(fav)} sx={{ py: 1.25, pr: 5 }}>
                        <PlayArrowIcon sx={{ fontSize: 16, mr: 1.25, color: "primary.main", flexShrink: 0 }} />
                        <ListItemText
                          primary={fav.title}
                          secondary={fav.prompt ?? fav.explanation ?? undefined}
                          primaryTypographyProps={{ fontSize: FS.body, fontWeight: FW.medium, noWrap: true }}
                          secondaryTypographyProps={{ fontSize: FS.small, sx: { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }}
                        />
                      </ListItemButton>
                    </ListItem>
                  </Box>
                ))}
              </List>
            )}
          </Box>
        )}
      </Drawer>

      {/* ── Save dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <BookmarkAddIcon color="primary" fontSize="small" />
            Save to Favorites
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <TextField autoFocus fullWidth label="Name" size="small" value={saveTitle}
            onChange={(e) => setSaveTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            inputProps={{ maxLength: 200 }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSaveDialogOpen(false)} size="small">Cancel</Button>
          <Button variant="contained" size="small" onClick={handleSave}
            disabled={!saveTitle.trim() || saving}
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <BookmarkAddIcon />}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
