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

import { Add as AddIcon } from "../icons";
import { CallMerge as MergeIcon } from "../icons";
import { DeleteForever as DeleteForeverIcon } from "../icons";
import { Search as SearchIcon } from "../icons";
import { SwapHoriz as SwapHorizIcon } from "../icons";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  InputAdornment,
  List,
  ListItemButton,
  ListItemSecondaryAction,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { Company, PaginatedResponse, SourceAlias, useApiClient } from "../api/client";
import { useUserRole } from "../context/UserRoleContext";
import { C } from "../theme/pageTokens";
import { FS, FW } from "../theme/typeScale";

// ── Source table display helpers ──────────────────────────────────────────────

const SOURCE_LABEL: Record<string, string> = {
  sf_accounts:        "Salesforce",
  certifications:     "Certifications",
  pardot_leads:       "Pardot Leads",
  pardot_snapshots:   "Pardot Snapshots",
  linkedin_companies: "LinkedIn",
  g2_visit_events:    "G2 Visits",
  g2_account_intent:  "G2 Intent",
};

type ChipColor = "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning";

const SOURCE_COLOR: Record<string, ChipColor> = {
  sf_accounts:        "primary",
  certifications:     "success",
  pardot_leads:       "info",
  pardot_snapshots:   "info",
  linkedin_companies: "secondary",
  g2_visit_events:    "warning",
  g2_account_intent:  "warning",
};

// ── Company search for dialogs ────────────────────────────────────────────────

function useCompanySearch(excludeId?: number) {
  const { get } = useApiClient();
  const [inputValue, setInputValue] = useState("");
  const hasTerm = !!inputValue.trim();

  // staleTime 0: every change of the search text asks the server again, so a company
  // that was just merged or deleted never lingers in the suggestions.
  const { data, isFetching } = useQuery({
    queryKey: ["isac", "companies", "search", { search: inputValue, page_size: 10 }],
    queryFn: () => get<PaginatedResponse<Company>>("/companies", { search: inputValue, page_size: 10 }),
    enabled: hasTerm,
    retry: 1,
    refetchOnMount: true,
    staleTime: 0,
    placeholderData: keepPreviousData,
  });
  const options = hasTerm ? (data?.items ?? []).filter((c) => c.id !== excludeId) : [];

  return { options, inputValue, setInputValue, loading: isFetching };
}

// ── Main component ────────────────────────────────────────────────────────────

/** Company MDM management — merge, split, and resolve company aliases across data sources. */
export default function CompanyManagement() {
  const { get, request } = useApiClient();
  const { isAdmin } = useUserRole();

  // List state
  const [companies, setCompanies] = useState<PaginatedResponse<Company>>({
    items: [], total: 0, page: 1, page_size: 30, pages: 1,
  });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [listLoading, setListLoading] = useState(false);

  // Selected company
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [aliases, setAliases] = useState<SourceAlias[]>([]);
  const [aliasLoading, setAliasLoading] = useState(false);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDomain, setCreateDomain] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Reassign dialog
  const [reassignAlias, setReassignAlias] = useState<SourceAlias | null>(null);
  const [reassignTarget, setReassignTarget] = useState<Company | null>(null);
  const [reassignLoading, setReassignLoading] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);
  const reassignSearch = useCompanySearch(selectedId ?? undefined);

  // Merge dialog
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<Company | null>(null);
  const [mergeLoading, setMergeLoading] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const mergeSearch = useCompanySearch(selectedId ?? undefined);

  // Delete dialog (admin-only, irreversible erasure — type-to-confirm)
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── Data fetching ─────────────────────────────────────────────────────────

  const loadList = useCallback(() => {
    setListLoading(true);
    get<PaginatedResponse<Company>>("/companies", {
      page, page_size: 30, search: search || undefined,
    })
      .then(setCompanies)
      .finally(() => setListLoading(false));
  }, [get, page, search]);

  useEffect(() => { loadList(); }, [loadList]);

  const loadAliases = useCallback((id: number) => {
    setAliasLoading(true);
    get<SourceAlias[]>(`/companies/${id}/aliases`)
      .then(setAliases)
      .finally(() => setAliasLoading(false));
  }, [get]);

  const selectCompany = (c: Company) => {
    setSelectedId(c.id);
    setSelectedCompany(c);
    loadAliases(c.id);
  };

  // ── Create ────────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setCreateLoading(true);
    setCreateError(null);
    try {
      await request<Company>("post", "/companies", {
        canonical_name: createName.trim(),
        domain: createDomain.trim() || undefined,
      });
      setCreateOpen(false);
      setCreateName("");
      setCreateDomain("");
      loadList();
    } catch (e: unknown) {
      setCreateError((e as { message?: string })?.message ?? "Failed to create company");
    } finally {
      setCreateLoading(false);
    }
  };

  // ── Reassign alias ────────────────────────────────────────────────────────

  const handleReassign = async () => {
    if (!reassignAlias || !reassignTarget || !selectedId) return;
    setReassignLoading(true);
    setReassignError(null);
    try {
      await request("put", "/companies/reassign-alias", {
        source_table:    reassignAlias.source_table,
        raw_name:        reassignAlias.raw_name,
        from_company_id: selectedId,
        to_company_id:   reassignTarget.id,
      });
      setReassignAlias(null);
      setReassignTarget(null);
      loadAliases(selectedId);
      loadList();
    } catch (e: unknown) {
      setReassignError((e as { message?: string })?.message ?? "Reassign failed");
    } finally {
      setReassignLoading(false);
    }
  };

  // ── Merge ─────────────────────────────────────────────────────────────────

  const handleMerge = async () => {
    if (!selectedId || !mergeTarget) return;
    setMergeLoading(true);
    setMergeError(null);
    try {
      // Absorb the currently selected company INTO mergeTarget
      // (i.e., mergeTarget survives; selectedCompany is deleted)
      await request("post", `/companies/${mergeTarget.id}/absorb/${selectedId}`);
      setMergeOpen(false);
      setMergeTarget(null);
      setSelectedId(null);
      setSelectedCompany(null);
      setAliases([]);
      loadList();
    } catch (e: unknown) {
      setMergeError((e as { message?: string })?.message ?? "Merge failed");
    } finally {
      setMergeLoading(false);
    }
  };

  // ── Delete (erase company + all its data) ───────────────────────────────────

  const closeDelete = () => {
    setDeleteOpen(false);
    setDeleteConfirm("");
    setDeleteError(null);
  };

  const handleDelete = async () => {
    if (!selectedId || !selectedCompany) return;
    if (deleteConfirm.trim() !== selectedCompany.canonical_name) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await request("delete", `/companies/${selectedId}`);
      closeDelete();
      setSelectedId(null);
      setSelectedCompany(null);
      setAliases([]);
      loadList();
    } catch (e: unknown) {
      setDeleteError((e as { message?: string })?.message ?? "Delete failed");
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ display: "flex", gap: 0, height: "100%", minHeight: 0 }}>

      {/* ── Left: company list ──────────────────────────────────────────── */}
      <Paper
        variant="outlined"
        sx={{ width: 260, flexShrink: 0, borderRadius: "2px", overflow: "hidden", display: "flex", flexDirection: "column" }}
      >
        {/* Header + search */}
        <Box sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography variant="caption" fontWeight={FW.semibold} color="text.secondary"
              sx={{ textTransform: "uppercase", letterSpacing: 0.8 }}>
              Companies ({companies.total})
            </Typography>
            <Tooltip title="New company">
              <Button size="small" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}
                sx={{ minWidth: 0, px: 1, fontSize: FS.body, textTransform: "none" }}>
                New
              </Button>
            </Tooltip>
          </Stack>
          <TextField
            size="small"
            placeholder="Search…"
            fullWidth
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16 }} /></InputAdornment> }}
            sx={{ "& .MuiInputBase-root": { fontSize: FS.body } }}
          />
        </Box>

        {/* List */}
        <Box sx={{ flex: 1, overflowY: "auto" }}>
          {listLoading
            ? <Box sx={{ display: "flex", justifyContent: "center", pt: 3 }}><CircularProgress size={24} /></Box>
            : (
              <List dense disablePadding>
                {companies.items.map((c) => (
                  <ListItemButton
                    key={c.id}
                    selected={c.id === selectedId}
                    onClick={() => selectCompany(c)}
                    sx={{
                      mx: 0.5, my: 0.25, borderRadius: "2px",
                      "&.Mui-selected": { bgcolor: "primary.main", color: "#fff", "&:hover": { bgcolor: "primary.dark" } },
                    }}
                  >
                    <ListItemText
                      primary={c.canonical_name}
                      secondary={c.domain}
                      primaryTypographyProps={{ fontSize: FS.body, fontWeight: c.id === selectedId ? FW.semibold : FW.regular }}
                      secondaryTypographyProps={{ fontSize: FS.small, color: c.id === selectedId ? "rgba(255,255,255,0.7)" : undefined }}
                    />
                    {(c.alias_count ?? 0) > 0 && (
                      <ListItemSecondaryAction>
                        <Typography variant="caption" sx={{ opacity: 0.6, fontSize: FS.small }}>
                          {c.alias_count}
                        </Typography>
                      </ListItemSecondaryAction>
                    )}
                  </ListItemButton>
                ))}
                {companies.pages > 1 && (
                  <Box sx={{ display: "flex", justifyContent: "center", gap: 1, py: 1 }}>
                    <Button size="small" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
                    <Typography variant="caption" sx={{ alignSelf: "center" }}>{page}/{companies.pages}</Typography>
                    <Button size="small" disabled={page >= companies.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                  </Box>
                )}
              </List>
            )}
        </Box>
      </Paper>

      {/* ── Right: company detail ───────────────────────────────────────── */}
      <Box sx={{ flex: 1, pl: 3, display: "flex", flexDirection: "column", gap: 2, minWidth: 0, overflow: "auto" }}>
        {!selectedCompany ? (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "text.disabled" }}>
            <Typography>Select a company to view its source aliases</Typography>
          </Box>
        ) : (
          <>
            {/* Company header */}
            <Box>
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                <Box>
                  <Typography variant="h6" fontWeight={FW.semibold}>{selectedCompany.canonical_name}</Typography>
                  {selectedCompany.domain && (
                    <Typography variant="body2" color="text.secondary">{selectedCompany.domain}</Typography>
                  )}
                </Box>
                <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                  <Tooltip title="Merge this company into another (this company will be deleted)">
                    <Button
                      size="small"
                      variant="outlined"
                      color="warning"
                      startIcon={<MergeIcon />}
                      onClick={() => { setMergeOpen(true); setMergeError(null); }}
                      sx={{ textTransform: "none", flexShrink: 0 }}
                    >
                      Merge into…
                    </Button>
                  </Tooltip>
                  {isAdmin && (
                    <Tooltip title="Permanently delete this company and ALL of its data (irreversible)">
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteForeverIcon />}
                        onClick={() => { setDeleteOpen(true); setDeleteConfirm(""); setDeleteError(null); }}
                        sx={{ textTransform: "none", flexShrink: 0 }}
                      >
                        Delete
                      </Button>
                    </Tooltip>
                  )}
                </Stack>
              </Stack>
            </Box>

            <Divider />

            {/* Aliases */}
            <Box>
              <Typography variant="caption" fontWeight={FW.semibold} color="text.secondary"
                sx={{ textTransform: "uppercase", letterSpacing: 0.8, display: "block", mb: 1.5 }}>
                Source Aliases
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                These raw names from source files are mapped to <strong>{selectedCompany.canonical_name}</strong>.
                Use <em>Reassign</em> to move a name to a different canonical company.
              </Typography>

              {aliasLoading
                ? <CircularProgress size={20} />
                : aliases.length === 0
                  ? <Typography variant="body2" color="text.disabled" fontStyle="italic">No source records linked yet.</Typography>
                  : (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                      {aliases.map((a, idx) => (
                        <Paper key={idx} variant="outlined" sx={{ px: 2, py: 1, display: "flex", alignItems: "center", gap: 1.5 }}>
                          <Chip
                            label={SOURCE_LABEL[a.source_table] ?? a.source_table}
                            size="small"
                            color={SOURCE_COLOR[a.source_table] ?? "default"}
                            sx={{ fontSize: FS.small, height: 20, flexShrink: 0 }}
                          />
                          <Typography variant="body2" sx={{ flex: 1, fontFamily: "monospace", fontSize: FS.body }}>
                            {a.raw_name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                            {a.record_count} record{a.record_count !== 1 ? "s" : ""}
                          </Typography>
                          <Tooltip title="Reassign to a different company">
                            <Button
                              size="small"
                              startIcon={<SwapHorizIcon />}
                              onClick={() => {
                                setReassignAlias(a);
                                setReassignTarget(null);
                                setReassignError(null);
                                reassignSearch.setInputValue("");
                              }}
                              sx={{ textTransform: "none", flexShrink: 0 }}
                            >
                              Reassign
                            </Button>
                          </Tooltip>
                        </Paper>
                      ))}
                    </Box>
                  )}
            </Box>
          </>
        )}
      </Box>

      {/* ── Create company dialog ───────────────────────────────────────── */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>New Company</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <TextField
              label="Canonical Name"
              size="small"
              fullWidth
              autoFocus
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            />
            <TextField
              label="Domain (optional)"
              size="small"
              fullWidth
              placeholder="example.com"
              value={createDomain}
              onChange={(e) => setCreateDomain(e.target.value)}
            />
            {createError && <Alert severity="error">{createError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!createName.trim() || createLoading}>
            {createLoading ? <CircularProgress size={16} color="inherit" /> : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Reassign alias dialog ───────────────────────────────────────── */}
      <Dialog open={!!reassignAlias} onClose={() => setReassignAlias(null)} fullWidth maxWidth="sm">
        <DialogTitle>Reassign Source Alias</DialogTitle>
        <DialogContent>
          {reassignAlias && (
            <Stack spacing={2} sx={{ mt: 0.5 }}>
              <DialogContentText>
                Move all <strong>{reassignAlias.record_count}</strong> record
                {reassignAlias.record_count !== 1 ? "s" : ""} with the
                name <code style={{ background: `${C.text}12`, padding: "2px 5px", borderRadius: "2px" }}>
                  {reassignAlias.raw_name}
                </code> from <strong>{selectedCompany?.canonical_name}</strong> to a different company.
              </DialogContentText>
              <Autocomplete
                options={reassignSearch.options}
                loading={reassignSearch.loading}
                getOptionLabel={(o) => o.canonical_name + (o.domain ? ` (${o.domain})` : "")}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                value={reassignTarget}
                onChange={(_, v) => setReassignTarget(v)}
                inputValue={reassignSearch.inputValue}
                onInputChange={(_, v) => reassignSearch.setInputValue(v)}
                renderInput={(params) => (
                  <TextField {...params} label="Target company" size="small" placeholder="Search companies…"
                    InputProps={{ ...params.InputProps, endAdornment: reassignSearch.loading
                      ? <CircularProgress size={16} /> : params.InputProps.endAdornment }} />
                )}
              />
              {reassignError && <Alert severity="error">{reassignError}</Alert>}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReassignAlias(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleReassign}
            disabled={!reassignTarget || reassignLoading}
          >
            {reassignLoading ? <CircularProgress size={16} color="inherit" /> : "Reassign"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Merge dialog ────────────────────────────────────────────────── */}
      <Dialog open={mergeOpen} onClose={() => setMergeOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Merge Company</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <DialogContentText>
              All data from <strong>{selectedCompany?.canonical_name}</strong> will be moved
              to the selected company, and <strong>{selectedCompany?.canonical_name}</strong> will
              be permanently deleted.
            </DialogContentText>
            <Autocomplete
              options={mergeSearch.options}
              loading={mergeSearch.loading}
              getOptionLabel={(o) => o.canonical_name + (o.domain ? ` (${o.domain})` : "")}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              value={mergeTarget}
              onChange={(_, v) => setMergeTarget(v)}
              inputValue={mergeSearch.inputValue}
              onInputChange={(_, v) => mergeSearch.setInputValue(v)}
              renderInput={(params) => (
                <TextField {...params} label="Merge into" size="small" placeholder="Search target company…"
                  InputProps={{ ...params.InputProps, endAdornment: mergeSearch.loading
                    ? <CircularProgress size={16} /> : params.InputProps.endAdornment }} />
              )}
            />
            {mergeError && <Alert severity="error">{mergeError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMergeOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleMerge}
            disabled={!mergeTarget || mergeLoading}
          >
            {mergeLoading ? <CircularProgress size={16} color="inherit" /> : "Merge & Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete company dialog (admin-only, type-to-confirm) ──────────── */}
      <Dialog open={deleteOpen} onClose={closeDelete} fullWidth maxWidth="sm">
        <DialogTitle sx={{ color: "error.main" }}>Delete Company</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <Alert severity="error" sx={{ "& .MuiAlert-message": { fontSize: FS.body } }}>
              This permanently erases <strong>{selectedCompany?.canonical_name}</strong> and{" "}
              <strong>all of its data</strong> — contacts, Salesforce accounts, certifications,
              Pardot leads &amp; snapshots, LinkedIn stats, and G2 signals — including any PII.
              This cannot be undone.
            </Alert>
            <DialogContentText>
              Type the company name <code style={{ background: `${C.text}12`, padding: "2px 5px", borderRadius: "2px" }}>
                {selectedCompany?.canonical_name}
              </code> to confirm.
            </DialogContentText>
            <TextField
              size="small"
              fullWidth
              autoFocus
              placeholder={selectedCompany?.canonical_name}
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleDelete(); }}
            />
            {deleteError && <Alert severity="error">{deleteError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDelete}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={deleteConfirm.trim() !== selectedCompany?.canonical_name || deleteLoading}
          >
            {deleteLoading ? <CircularProgress size={16} color="inherit" /> : "Delete permanently"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
