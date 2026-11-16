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

import { Launch as LaunchIcon } from "../icons";
import {
  Alert, Box, Button, Chip, CircularProgress, FormControl, InputLabel, MenuItem,
  Paper, Select, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Tooltip, Typography,
} from "@wso2/oxygen-ui";
import { useCallback, useEffect, useState } from "react";
import { ReoLead, ReoLeadPage, useApiClient } from "../api/client";
import { C } from "../theme/pageTokens";
import { FS, FW, LABEL } from "../theme/typeScale";

const PAGE_SIZE = 25;

/** Reo score → colour band. */
function scoreColor(s: number | null): string {
  if (s == null) return C.slate;
  if (s >= 70) return C.red;
  if (s >= 40) return C.amber;
  return C.blue;
}

const STATUS_COLOR: Record<string, string> = {
  new: "#0077b5", promoted: C.green, dismissed: C.slate,
};

/** The message of a thrown value, or `fallback` when it carries none. */
function errorMessage(e: unknown, fallback: string): string {
  if (typeof e === "object" && e !== null && "message" in e && typeof e.message === "string" && e.message) {
    return e.message;
  }
  return fallback;
}

/** Reo Leads — net-new developer/buyer leads sourced from Reo.dev, kept separate
 *  from first-party leads until explicitly promoted. */
export default function ReoLeads() {
  const { get, request } = useApiClient();

  const [status, setStatus] = useState("new");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ReoLeadPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params: Record<string, unknown> = { page, page_size: PAGE_SIZE };
      if (status !== "all") params.lead_status = status;
      if (search.trim()) params.q = search.trim();
      setData(await get<ReoLeadPage>("/reo/leads", params));
    } catch (e) {
      setError(errorMessage(e, "Failed to load Reo leads"));
      setData(null);
    } finally { setLoading(false); }
  }, [get, page, status, search]);

  useEffect(() => { load(); }, [load]);

  const promote = async (lead: ReoLead) => {
    setBusyId(lead.id); setNotice(null);
    try {
      const r = await request<{ status: string; created: boolean }>("post", `/reo/leads/${lead.id}/promote`);
      setNotice(r.status === "already_promoted"
        ? "Already promoted."
        : r.created ? "Promoted — created a first-party lead." : "Promoted — linked to an existing first-party lead.");
      await load();
    } catch (e) { setError(errorMessage(e, "Promote failed")); }
    finally { setBusyId(null); }
  };

  const dismiss = async (lead: ReoLead) => {
    setBusyId(lead.id);
    try { await request("post", `/reo/leads/${lead.id}/dismiss`); await load(); }
    catch (e) { setError(errorMessage(e, "Dismiss failed")); }
    finally { setBusyId(null); }
  };

  const headerBg = C.card;
  const name = (l: ReoLead) => [l.first_name, l.last_name].filter(Boolean).join(" ") || "—";

  return (
    <Box sx={{ bgcolor: "background.paper", p: { xs: 2, md: 2.5 }, minHeight: "100%" }}>
      {/* Header */}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Net-new intent leads from Reo.dev — kept separate from your first-party leads. Promote one to create a first-party lead when you trust it.
        Run a sync from the Data Ingestion page.
      </Typography>

      {notice && <Alert severity="info" onClose={() => setNotice(null)} sx={{ mb: 2, borderRadius: 1 }}>{notice}</Alert>}
      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2, borderRadius: 1 }}>{error}</Alert>}

      {/* Filters */}
      <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Status</InputLabel>
          <Select value={status} label="Status" onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <MenuItem value="new">New</MenuItem>
            <MenuItem value="promoted">Promoted</MenuItem>
            <MenuItem value="dismissed">Dismissed</MenuItem>
            <MenuItem value="all">All</MenuItem>
          </Select>
        </FormControl>
        <TextField size="small" placeholder="Search name / email / company…" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }} sx={{ minWidth: 260 }} />
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.secondary">{data ? `${data.total.toLocaleString()} leads` : ""}</Typography>
      </Box>

      {/* Table */}
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ "& th": { ...LABEL, color: "text.secondary", bgcolor: headerBg } }}>
              <TableCell>Person</TableCell>
              <TableCell>Company</TableCell>
              <TableCell>Segment</TableCell>
              <TableCell align="center">Reo Score</TableCell>
              <TableCell align="center">Activity</TableCell>
              <TableCell align="center">Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && !data ? (
              <TableRow><TableCell colSpan={7} align="center" sx={{ py: 5, border: 0 }}><CircularProgress size={22} /></TableCell></TableRow>
            ) : !data || data.items.length === 0 ? (
              <TableRow><TableCell colSpan={7} align="center" sx={{ py: 5, border: 0, color: "text.disabled" }}>No Reo leads match these filters.</TableCell></TableRow>
            ) : data.items.map((l) => (
              <TableRow key={l.id} hover>
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Typography variant="body2" fontWeight={FW.semibold} noWrap>{name(l)}</Typography>
                    {l.reo_developer_link && (
                      <Tooltip title="View in Reo.dev" arrow>
                        <a href={l.reo_developer_link} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", color: C.sub }}>
                          <LaunchIcon sx={{ fontSize: 12 }} />
                        </a>
                      </Tooltip>
                    )}
                  </Box>
                  {l.job_title && <Typography variant="caption" color="text.secondary" noWrap>{l.job_title}</Typography>}
                  {l.email && <Typography variant="caption" color="text.disabled" display="block" noWrap>{l.email}</Typography>}
                </TableCell>
                <TableCell>
                  <Typography variant="body2" noWrap>{l.raw_company_name || "—"}</Typography>
                  {l.account_domain && <Typography variant="caption" color="text.secondary" noWrap>{l.account_domain}</Typography>}
                </TableCell>
                <TableCell><Typography variant="caption" color="text.secondary">{l.segment_name || "—"}</Typography></TableCell>
                <TableCell align="center">
                  <Chip label={l.reo_score ?? "—"} size="small"
                    sx={{ height: 22, minWidth: 40, fontWeight: FW.semibold, fontSize: FS.small, color: scoreColor(l.reo_score), bgcolor: `${scoreColor(l.reo_score)}14` }} />
                </TableCell>
                <TableCell align="center"><Typography variant="caption">{l.activity_score || "—"}</Typography></TableCell>
                <TableCell align="center">
                  <Chip label={l.status} size="small"
                    sx={{ height: 20, fontSize: FS.caption, fontWeight: FW.semibold, textTransform: "capitalize", color: STATUS_COLOR[l.status] || C.slate, bgcolor: `${STATUS_COLOR[l.status] || C.slate}14` }} />
                </TableCell>
                <TableCell align="right">
                  {l.status === "promoted" ? (
                    <Typography variant="caption" color="text.disabled">Promoted</Typography>
                  ) : (
                    <Box sx={{ display: "inline-flex", gap: 0.5 }}>
                      <Button size="small" variant="contained" disableElevation disabled={busyId === l.id}
                        onClick={() => promote(l)} sx={{ textTransform: "none", fontSize: FS.small, py: 0.25, minWidth: 0, px: 1 }}>
                        Promote
                      </Button>
                      {l.status !== "dismissed" && (
                        <Button size="small" variant="text" color="inherit" disabled={busyId === l.id}
                          onClick={() => dismiss(l)} sx={{ textTransform: "none", fontSize: FS.small, py: 0.25, minWidth: 0, px: 1, color: "text.secondary" }}>
                          Dismiss
                        </Button>
                      )}
                    </Box>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <Box sx={{ display: "flex", gap: 2, justifyContent: "center", alignItems: "center", mt: 2 }}>
          <Button size="small" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} sx={{ textTransform: "none" }}>Prev</Button>
          <Typography variant="caption" color="text.secondary">Page {page} of {data.pages}</Typography>
          <Button size="small" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)} sx={{ textTransform: "none" }}>Next</Button>
        </Box>
      )}
    </Box>
  );
}
