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

// BU Owners: the registry the Campaign Register's read-only Owner column
// resolves from. Register an owner (name + email), assign them to a BU
// effective from a date, and see the full history of who owned a BU when.
// Assignments are append-only server-side — reassigning a BU never erases the
// old record, it just adds a newer one, so "who owned BU01 in July" stays
// answerable after August's handover.
//
// Reads are open to anyone with Ad Campaigns access (same as the rest of this
// view); writes (register owner, assign) require admin, enforced server-side
// — this screen doesn't pre-check admin status, so the actions are always
// shown and a 403 surfaces as an inline error via describeError.

import { useState } from "react";
import { Box, Typography, Table, TableHead, TableBody, TableRow, TableCell, Button, Dialog, DialogActions, TextField, MenuItem, IconButton, Tooltip } from "@wso2/oxygen-ui";
import { Plus, History } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { BUSINESS_UNITS, BusinessUnit, parseLocalDate } from "../campaignTrackerTypes";
import {
  useOwners,
  useCurrentBuOwners,
  useBuOwnershipHistory,
  useAddOwner,
  useAssignBuOwner,
  type Owner,
} from "../../../api/useCampaignTracker";
import { NUMERIC, ToneChip } from "./campaignTrackerPrimitives";
import { RowCount } from "./FilterControls";

// effective_from is a date-only string ("2026-01-05"); created_at is a full
// timestamp — each needs its own parse so a date-only value isn't run through
// `new Date()` (which reads it as UTC midnight, then shifts a day in
// negative-offset timezones once toLocaleDateString renders it locally).
const fmtDate = (d: string) => {
  const parsed = parseLocalDate(d);
  return parsed ? parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
};
const fmtTimestamp = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const todayISO = () => new Date().toISOString().slice(0, 10);

export function BuOwnersPanel() {
  const ownersQuery = useOwners();
  const currentQuery = useCurrentBuOwners();
  const [addingOwner, setAddingOwner] = useState(false);
  const [assigning, setAssigning] = useState<BusinessUnit | null>(null);
  const [historyBu, setHistoryBu] = useState<BusinessUnit | null>(null);

  const owners = ownersQuery.data ?? [];
  const current = currentQuery.data ?? [];
  const loading = ownersQuery.isLoading || currentQuery.isLoading;
  const error = ownersQuery.error ?? currentQuery.error;

  const currentByBu = new Map(current.map((c) => [c.bu, c]));

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.25 }}>
          <Typography sx={{ fontSize: "0.82rem", fontWeight: 700 }}>BU → Owner assignment</Typography>
          <RowCount shown={BUSINESS_UNITS.length} total={BUSINESS_UNITS.length} singular="business unit" />
        </Box>
        <Button size="small" variant="contained" startIcon={<Plus size={16} />} onClick={() => setAddingOwner(true)} sx={{ textTransform: "none", fontSize: "0.76rem", fontWeight: 700 }}>
          Register owner
        </Button>
      </Box>

      {error && (
        <Typography sx={{ fontSize: "0.76rem", color: "error.main", mb: 2 }}>{describeError(error)}</Typography>
      )}
      {loading ? (
        <Typography sx={{ fontSize: "0.76rem", color: "text.secondary", mb: 2 }}>Loading…</Typography>
      ) : (
        <Box sx={{ border: 1, borderColor: "divider", borderRadius: "10px", overflow: "hidden", mb: 3 }}>
          <Box sx={{ overflow: "auto", maxHeight: 640 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Business unit</TableCell>
                  <TableCell>Current owner</TableCell>
                  <TableCell>Since</TableCell>
                  <TableCell align="right" sx={{ width: 160 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {BUSINESS_UNITS.map((bu) => {
                  const c = currentByBu.get(bu);
                  return (
                    <TableRow key={bu}>
                      <TableCell>
                        <Typography sx={{ fontSize: "0.78rem", fontWeight: 600 }}>{bu}</Typography>
                      </TableCell>
                      <TableCell>
                        {c ? (
                          <Box>
                            <Typography sx={{ fontSize: "0.78rem" }}>{c.owner_name}</Typography>
                            <Typography sx={{ fontSize: "0.66rem", color: "text.secondary" }}>{c.owner_email}</Typography>
                          </Box>
                        ) : (
                          <ToneChip label="Unassigned" color="warning.main" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: "0.72rem", ...NUMERIC }}>{c ? fmtDate(c.effective_from) : "—"}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="View history" arrow placement="top">
                          <IconButton size="small" onClick={() => setHistoryBu(bu)} sx={{ color: "text.secondary", p: 0.5, "&:hover": { color: "primary.main" } }}>
                            <History size={16} />
                          </IconButton>
                        </Tooltip>
                        <Button size="small" onClick={() => setAssigning(bu)} sx={{ textTransform: "none", fontSize: "0.72rem", fontWeight: 700, color: "primary.main" }}>
                          {c ? "Reassign" : "Assign"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        </Box>
      )}

      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.25, mb: 1.5 }}>
        <Typography sx={{ fontSize: "0.82rem", fontWeight: 700 }}>Registered owners</Typography>
        <RowCount shown={owners.length} total={owners.length} singular="owner" />
      </Box>
      <Box sx={{ border: 1, borderColor: "divider", borderRadius: "10px", overflow: "hidden" }}>
        <Box sx={{ overflow: "auto", maxHeight: 640 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Registered</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {owners.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Typography sx={{ fontSize: "0.76rem", color: "text.disabled", textAlign: "center", py: 2 }}>No owners registered yet</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                owners.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Typography sx={{ fontSize: "0.78rem" }}>{o.name}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: "0.78rem", color: "text.secondary" }}>{o.email}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: "0.72rem", ...NUMERIC }}>{fmtTimestamp(o.created_at)}</Typography>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Box>
      </Box>

      {addingOwner && <AddOwnerDialog onCancel={() => setAddingOwner(false)} onSaved={() => setAddingOwner(false)} />}
      {assigning && <AssignDialog bu={assigning} owners={owners} onCancel={() => setAssigning(null)} onSaved={() => setAssigning(null)} />}
      {historyBu && <HistoryDialog bu={historyBu} onClose={() => setHistoryBu(null)} />}
    </Box>
  );
}

function AddOwnerDialog({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const addOwner = useAddOwner();
  const canSave = name.trim().length > 0 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  function save() {
    addOwner.mutate(
      { name: name.trim(), email: email.trim() },
      { onSuccess: onSaved },
    );
  }

  return (
    <Dialog open onClose={onCancel} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: "12px" } }}>
      <Box sx={{ px: 3, pt: 3, pb: 1 }}>
        <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, letterSpacing: "-0.01em" }}>Register owner</Typography>
      </Box>
      <Box sx={{ px: 3, py: 1.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
        <TextField label="Name" size="small" fullWidth value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label="Email" size="small" fullWidth value={email} onChange={(e) => setEmail(e.target.value)} />
        {addOwner.isError && <Typography sx={{ fontSize: "0.72rem", color: "error.main" }}>{describeError(addOwner.error)}</Typography>}
      </Box>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
        <Button onClick={onCancel} sx={{ textTransform: "none", fontSize: "0.78rem", color: "text.secondary" }}>
          Cancel
        </Button>
        <Button onClick={save} disabled={!canSave || addOwner.isPending} variant="contained" sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.78rem" }}>
          {addOwner.isPending ? "Saving…" : "Register"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function AssignDialog({ bu, owners, onCancel, onSaved }: { bu: BusinessUnit; owners: Owner[]; onCancel: () => void; onSaved: () => void }) {
  const [ownerId, setOwnerId] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(todayISO());
  const assign = useAssignBuOwner();

  function save() {
    assign.mutate({ bu, owner_id: ownerId, effective_from: effectiveFrom }, { onSuccess: onSaved });
  }

  return (
    <Dialog open onClose={onCancel} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: "12px" } }}>
      <Box sx={{ px: 3, pt: 3, pb: 1 }}>
        <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, letterSpacing: "-0.01em" }}>Assign owner — {bu}</Typography>
        <Typography sx={{ fontSize: "0.74rem", color: "text.secondary", mt: 0.25 }}>
          Adds a new assignment effective from the date below. Past assignments stay in the history — they aren't overwritten.
        </Typography>
      </Box>
      <Box sx={{ px: 3, py: 1.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
        <TextField select label="Owner" size="small" fullWidth value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
          {owners.length === 0 && (
            <MenuItem value="" disabled>
              No owners registered yet
            </MenuItem>
          )}
          {owners.map((o) => (
            <MenuItem key={o.id} value={o.id}>
              {o.name} ({o.email})
            </MenuItem>
          ))}
        </TextField>
        <TextField label="Effective from" type="date" size="small" fullWidth InputLabelProps={{ shrink: true }} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
        {assign.isError && <Typography sx={{ fontSize: "0.72rem", color: "error.main" }}>{describeError(assign.error)}</Typography>}
      </Box>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
        <Button onClick={onCancel} sx={{ textTransform: "none", fontSize: "0.78rem", color: "text.secondary" }}>
          Cancel
        </Button>
        <Button onClick={save} disabled={!ownerId || !effectiveFrom || assign.isPending} variant="contained" sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.78rem" }}>
          {assign.isPending ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function HistoryDialog({ bu, onClose }: { bu: BusinessUnit; onClose: () => void }) {
  const historyQuery = useBuOwnershipHistory(bu);
  const entries = historyQuery.data ?? null;

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: "12px" } }}>
      <Box sx={{ px: 3, pt: 3, pb: 1 }}>
        <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, letterSpacing: "-0.01em" }}>Ownership history — {bu}</Typography>
      </Box>
      <Box sx={{ px: 3, py: 1.5 }}>
        {historyQuery.isError && <Typography sx={{ fontSize: "0.76rem", color: "error.main" }}>{describeError(historyQuery.error)}</Typography>}
        {!historyQuery.isError && entries === null && <Typography sx={{ fontSize: "0.76rem", color: "text.secondary" }}>Loading…</Typography>}
        {entries && entries.length === 0 && <Typography sx={{ fontSize: "0.76rem", color: "text.disabled" }}>No assignments yet.</Typography>}
        {entries && entries.length > 0 && (
          <>
            <Box sx={{ mb: 1 }}>
              <RowCount shown={entries.length} total={entries.length} singular="assignment" />
            </Box>
            <Box sx={{ border: 1, borderColor: "divider", borderRadius: "10px", overflow: "hidden" }}>
              <Box sx={{ overflow: "auto", maxHeight: 360 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Effective from</TableCell>
                      <TableCell>Owner</TableCell>
                      <TableCell>Assigned by</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {entries.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>
                          <Typography sx={{ fontSize: "0.74rem", ...NUMERIC }}>{fmtDate(e.effective_from)}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ fontSize: "0.76rem" }}>{e.owner_name}</Typography>
                          <Typography sx={{ fontSize: "0.64rem", color: "text.secondary" }}>{e.owner_email}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ fontSize: "0.72rem", color: "text.secondary" }}>{e.changed_by ?? "—"}</Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </Box>
          </>
        )}
      </Box>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
        <Button onClick={onClose} sx={{ textTransform: "none", fontSize: "0.78rem", color: "text.secondary" }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
