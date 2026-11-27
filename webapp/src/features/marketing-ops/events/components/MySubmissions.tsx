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

import { useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { Pencil, Plus, Trash2 } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import {
  useCreateSubmission,
  useDeleteSubmission,
  useEventNames,
  useSubmissions,
} from "../../api/useEvents";
import type { SubmissionSummary } from "../eventsTypes";
import { normaliseSdr } from "../lib/sdrOwner";
import {
  CampaignUrlField,
  SdrOwnerField,
  Empty,
  EventsLoading,
  ActionRow,
  Panel,
  StatusChip,
  Timestamp,
} from "./EventsUi";
import { EVENTS_LOADING, fieldInput, fieldLabel, primaryBtn, quietBtn } from "./eventsStyles";

// "My submissions" — an RMM's own event lists.
//
// Owner scoping is enforced SERVER-side (the store filters on the caller's sub), so this
// renders whatever it's given. Every RMM is in the same Asgardeo group, so RBAC could
// never have made that distinction.

export default function MySubmissions({ onOpen }: { onOpen: (id: string) => void }) {
  const submissions = useSubmissions();
  const create = useCreateSubmission();
  const del = useDeleteSubmission();

  const [creating, setCreating] = useState(false);
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [campaignUrl, setCampaignUrl] = useState("");
  const [sdrOwner, setSdrOwner] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<SubmissionSummary | null>(null);

  // Autocomplete over event names already used, so spelling stays consistent without
  // needing a registry of events. Suggestions are a convenience — a failure here must
  // never block creating a submission, which is why it's a separate query whose error
  // state is simply ignored.
  const names = useEventNames(eventName);

  async function submitNew() {
    if (!eventName.trim()) return;
    setError(null);
    try {
      const res = await create.mutateAsync({
        event_name: eventName.trim(),
        event_date: eventDate || null,
        sf_campaign_url: campaignUrl.trim() || null,
        sdr_owner_email: normaliseSdr(sdrOwner) || null,
      });
      setCreating(false);
      setEventName("");
      setEventDate("");
      setCampaignUrl("");
      setSdrOwner("");
      if (res?.id) onOpen(res.id);
    } catch (e) {
      setError(describeError(e));
    }
  }

  async function remove() {
    if (!confirm) return;
    setError(null);
    try {
      await del.mutateAsync(confirm.id);
      setConfirm(null);
    } catch (e) {
      setError(describeError(e));
    }
  }

  const rows = submissions.data ?? [];

  return (
    <Box>
      <ActionRow>
        <Button
          onClick={() => {
            setCreating(true);
            setError(null);
          }}
          variant="contained"
          startIcon={<Plus size={16} />}
          sx={primaryBtn}
        >
          New submission
        </Button>
      </ActionRow>

      {submissions.isError ? (
        <Alert severity="error">
          Could not load your submissions. {describeError(submissions.error)}
        </Alert>
      ) : submissions.isLoading ? (
        <EventsLoading messages={EVENTS_LOADING.submissions} />
      ) : rows.length === 0 ? (
        <Empty>
          You haven't submitted any lists yet.
          <Box sx={{ mt: 0.5 }}>
            Fill the List Import Template in Google Sheets, then start a submission and upload it
            here.
          </Box>
        </Empty>
      ) : (
        <Panel>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontSize: 11, fontWeight: 700 }}>Event</TableCell>
                <TableCell sx={{ fontSize: 11, fontWeight: 700 }}>Status</TableCell>
                <TableCell align="right" sx={{ fontSize: 11, fontWeight: 700 }}>Rows</TableCell>
                <TableCell sx={{ fontSize: 11, fontWeight: 700 }}>Last modified</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => {
                // Only these two states are the submitter's to change. Once submitted,
                // the list belongs to the marketing team.
                const editable = r.status === "Draft" || r.status === "ChangesRequested";
                return (
                  <TableRow key={r.id} hover>
                    <TableCell>
                      <Box
                        component="button"
                        type="button"
                        onClick={() => onOpen(r.id)}
                        sx={{
                          border: 0,
                          p: 0,
                          bgcolor: "transparent",
                          textAlign: "left",
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{r.event_name}</Typography>
                        {r.status === "ChangesRequested" && (
                          <Typography sx={{ fontSize: 11, color: "error.main", fontWeight: 600 }}>
                            Sent back — needs your attention
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <StatusChip status={r.status} />
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        sx={{ fontSize: 11.5, color: "text.secondary", fontVariantNumeric: "tabular-nums" }}
                      >
                        {r.row_count || "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
                        {r.status === "Draft" && !r.row_count ? (
                          "Nothing uploaded yet"
                        ) : (
                          <Timestamp value={r.updated_at} />
                        )}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={editable ? "Open and fix" : "Open"} arrow>
                        <IconButton
                          size="small"
                          aria-label={`Open ${r.event_name}`}
                          onClick={() => onOpen(r.id)}
                          sx={{ color: "text.secondary", "&:hover": { color: "primary.main" } }}
                        >
                          <Pencil size={15} />
                        </IconButton>
                      </Tooltip>
                      {/* A submitted list belongs to the marketing team now; discarding it
                          from under them is not the submitter's call. */}
                      {editable && (
                        <Tooltip title="Discard" arrow>
                          <IconButton
                            size="small"
                            aria-label={`Discard ${r.event_name}`}
                            onClick={() => setConfirm(r)}
                            sx={{ color: "text.secondary", "&:hover": { color: "error.main" } }}
                          >
                            <Trash2 size={15} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Panel>
      )}

      <Dialog
        open={creating}
        onClose={() => !create.isPending && setCreating(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.01em", pb: 0.5 }}>
          New submission
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 2.5 }}>
            Name the event this list came from. The date fills in the opt-in timestamp and method for
            every row, so nobody has to type them.
          </Typography>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
            <Box sx={{ gridColumn: { sm: "1 / -1" } }}>
              <Typography sx={fieldLabel}>Event</Typography>
              <Autocomplete
                freeSolo
                options={names.data ?? []}
                inputValue={eventName}
                onInputChange={(_, v) => setEventName(v)}
                renderInput={(p) => (
                  <TextField
                    {...p}
                    autoFocus
                    size="small"
                    sx={fieldInput}
                    placeholder="e.g. Exito BFSI Summit Philippines"
                  />
                )}
              />
            </Box>

            <Box>
              <Typography sx={fieldLabel}>Event date</Typography>
              <TextField
                type="date"
                size="small"
                fullWidth
                sx={fieldInput}
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </Box>

            <Box sx={{ gridColumn: { sm: "1 / -1" } }}>
              <Typography sx={fieldLabel}>Salesforce campaign URL</Typography>
              {/* Echo what was read out of the URL, so a wrong link (an Account, a report)
                  is caught here rather than at Submit. */}
              <CampaignUrlField value={campaignUrl} onChange={setCampaignUrl} />
            </Box>

            <Box sx={{ gridColumn: { sm: "1 / -1" } }}>
              <Typography sx={fieldLabel}>SDR owner</Typography>
              <SdrOwnerField value={sdrOwner} onChange={setSdrOwner} />
            </Box>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mt: 2.5, fontSize: 13 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreating(false)} disabled={create.isPending} sx={quietBtn}>
            Cancel
          </Button>
          <Button
            onClick={() => void submitNew()}
            disabled={!eventName.trim() || create.isPending}
            variant="contained"
            sx={primaryBtn}
            startIcon={create.isPending ? <CircularProgress size={15} color="inherit" /> : undefined}
          >
            {create.isPending ? "Creating…" : "Create submission"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(confirm)}
        onClose={() => !del.isPending && setConfirm(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontSize: 16, fontWeight: 800 }}>Discard this submission?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: "text.secondary", lineHeight: 1.5 }}>
            <Box component="span" sx={{ fontWeight: 700, color: "text.primary" }}>
              {confirm?.event_name}
            </Box>{" "}
            and everything uploaded to it will be removed. This can't be undone — the Google Sheet it
            came from is untouched.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirm(null)} disabled={del.isPending} sx={quietBtn}>
            Cancel
          </Button>
          <Button
            onClick={() => void remove()}
            disabled={del.isPending}
            variant="contained"
            color="error"
            startIcon={
              del.isPending ? <CircularProgress size={14} color="inherit" /> : <Trash2 size={16} />
            }
            sx={primaryBtn}
          >
            Discard
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
