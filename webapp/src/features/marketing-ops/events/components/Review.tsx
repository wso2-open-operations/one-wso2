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

import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import {
  Check,
  Download,
  ExternalLink,
  FileArchive,
  RotateCcw,
  Trash2,
} from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { HttpError } from "@api/http";
import {
  useApproveSubmission,
  useExportAll,
  useExportTab,
  useFieldDefs,
  useMarkImported,
  useMemberStatuses,
  useRemoveFromQueue,
  useReviewComments,
  useReviewQueue,
  useReviewSubmission,
  useSendBackSubmission,
} from "../../api/useEvents";
import type { Status, SubmissionSummary, Tab } from "../eventsTypes";
import AttendeeGrid from "./AttendeeGrid";
import { fromPayloadReadOnly } from "../rules/model";
import type { EventsConfig } from "../rules/schema";
import {
  ConfirmDialog,
  Empty,
  EventsLoading,
  FilterPills,
  Panel,
  StatusChip,
  TabRail,
  Timestamp,
  WorkspaceHead,
} from "./EventsUi";
import { EVENTS_LOADING, primaryBtn, quietBtn } from "./eventsStyles";

// The marketing team's side: the queue, and one submission.
//
// READ-ONLY by design. A list only reaches here with zero unresolved problems, so the job
// is a spot-check then approve and export — or send it back with a reason. Keeping the
// reviewer out of the data is what makes "she shouldn't have to change anything" literally
// true, and sidesteps any question of who altered whose values.

// Queue filters. `null` is "everything".
//
// The counts are deliberately UNCOLOURED. Each pill's own words say which state it is, so
// tinting its number added four accents carrying no information the label didn't. The status
// chips in the table below still carry lifecycle colour, which is where it earns its place:
// scanning a column.
const FILTERS: { key: Status | null; label: string }[] = [
  { key: null, label: "All" },
  { key: "Submitted", label: "Awaiting review" },
  { key: "ChangesRequested", label: "Sent back" },
  { key: "Approved", label: "Approved" },
  { key: "Imported", label: "Imported" },
];

/** What the reviewer may clear out. Anything else is still someone's pending work and gets
 *  sent back instead. */
const FINISHED: Status[] = ["Approved", "Imported"];

/** Who signed a list off: automatic review, a person, or nobody yet. */
function reviewerLabel(s: SubmissionSummary): string {
  if (s.reviewed_by === "machine") return "Automatic review";
  return s.reviewed_by || "—";
}

export function ReviewQueue({ onOpen }: { onOpen: (id: string) => void }) {
  const queue = useReviewQueue();
  const remove = useRemoveFromQueue();
  const [filter, setFilter] = useState<Status | null>("Submitted");
  const [removing, setRemoving] = useState<SubmissionSummary | null>(null);

  // A submitter reaching this by direct URL gets a 403 from the gated route. Show that
  // plainly rather than as a failed request — the rail hides the entry point anyway, so
  // anyone here typed the URL.
  const denied = queue.error instanceof HttpError && queue.error.status === 403;
  if (denied) {
    return <Empty>You don't have access to the review queue.</Empty>;
  }
  if (queue.isError) {
    return (
      <Alert severity="error">Could not load the queue. {describeError(queue.error)}</Alert>
    );
  }
  if (queue.isLoading) {
    return <EventsLoading messages={EVENTS_LOADING.queue} />;
  }

  const rows = queue.data ?? [];
  // Counting BEFORE filtering, so a pill always says how many it would show.
  const options = FILTERS.map((f) => ({
    ...f,
    count: f.key === null ? rows.length : rows.filter((r) => r.status === f.key).length,
  }));
  const visible = filter === null ? rows : rows.filter((r) => r.status === filter);

  return (
    <Box>
      <FilterPills options={options} value={filter} onChange={setFilter} />

      {rows.length === 0 ? (
        <Empty>Nothing to review yet. Submitted lists appear here.</Empty>
      ) : visible.length === 0 ? (
        <Empty>Nothing in this state right now.</Empty>
      ) : (
        <Panel>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={TH}>Event</TableCell>
                <TableCell sx={TH}>Submitted by</TableCell>
                <TableCell sx={TH}>Status</TableCell>
                <TableCell sx={TH}>Reviewed by</TableCell>
                <TableCell align="right" sx={TH}>Rows</TableCell>
                <TableCell sx={TH}>Submitted</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map((r) => (
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
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
                      {r.owner_email ?? "Unknown"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <StatusChip status={r.status} />
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
                      {reviewerLabel(r)}
                    </Typography>
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
                      <Timestamp value={r.submitted_at} />
                    </Typography>
                  </TableCell>
                  {/* Housekeeping lives HERE rather than on the detail page: clearing a
                      quarter's finished lists one page at a time is nobody's afternoon.
                      Only finished work gets a button — anything still with its submitter
                      has none, because the move there is Send back, not delete. */}
                  <TableCell align="right">
                    {FINISHED.includes(r.status) && (
                      <Tooltip title="Remove from the queue" arrow>
                        <IconButton
                          size="small"
                          aria-label={`Remove ${r.event_name} from the queue`}
                          onClick={() => setRemoving(r)}
                          sx={{ color: "text.secondary", "&:hover": { color: "error.main" } }}
                        >
                          <Trash2 size={15} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}

      <ConfirmDialog
        open={Boolean(removing)}
        title="Remove from the queue?"
        confirmLabel="Remove"
        tone="danger"
        busy={remove.isPending}
        body={
          <>
            <Box component="span" sx={{ fontWeight: 700, color: "text.primary" }}>
              {removing?.event_name}
            </Box>{" "}
            and its attendee data are deleted for good. Export the CSVs first if you still need them —
            the submitter keeps no copy here either.
          </>
        }
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (!removing) return;
          void remove.mutateAsync(removing.id).then(() => setRemoving(null));
        }}
      />
    </Box>
  );
}

export function ReviewDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const submission = useReviewSubmission(id);
  const comments = useReviewComments(id);
  const statuses = useMemberStatuses(true);
  const fields = useFieldDefs();
  const approve = useApproveSubmission();
  const sendBack = useSendBackSubmission();
  const markImported = useMarkImported();
  const exportTabM = useExportTab();
  const exportAllM = useExportAll();

  const [rejecting, setRejecting] = useState(false);
  const [rejectText, setRejectText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab | null>(null);

  const sub = submission.data;

  // Read-only, and deliberately UNVALIDATED — the list cleared every rule before it could
  // be submitted; there's nothing left to judge and nobody here who could act on a verdict.
  const model = useMemo(() => (sub ? fromPayloadReadOnly(sub.payload) : null), [sub]);

  /** Tabs with rows — the only ones the export routes will produce a file for. */
  const exportable = useMemo(
    () => Object.keys(model?.tabs ?? {}).filter((t) => (model?.tabs[t] ?? []).length > 0),
    [model],
  );

  // Which statuses exist is CONFIGURATION, so there's no fixed first tab. Derived rather
  // than assigned in an effect.
  const active = activeTab && exportable.includes(activeTab) ? activeTab : (exportable[0] ?? "");
  const rows = useMemo(() => model?.tabs[active] ?? [], [model, active]);

  const config: EventsConfig = useMemo(
    () => ({ statuses: statuses.data ?? [], fields: fields.data ?? {} }),
    [statuses.data, fields.data],
  );

  const busy =
    approve.isPending || sendBack.isPending || markImported.isPending;

  // Returns whether it worked. It swallows the error into `error` state rather than
  // rethrowing, so without this flag every caller's `.then` ran on failure too —
  // which closed the send-back dialog and discarded the comment the reviewer had
  // just typed, leaving the error alert behind a dialog that was no longer there.
  async function act(fn: () => Promise<unknown>): Promise<boolean> {
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(describeError(e));
      return false;
    }
  }

  if (submission.isError) {
    return <Alert severity="error">Could not open that submission. {describeError(submission.error)}</Alert>;
  }
  if (!sub) return <EventsLoading messages={EVENTS_LOADING.list} />;

  const awaiting = sub.status === "Submitted";
  const approved = sub.status === "Approved";
  const released = approved || sub.status === "Imported";

  return (
    <Box>
      <WorkspaceHead
        title={sub.event_name}
        caption={[
          sub.owner_email ?? "unknown submitter",
          sub.source_filename,
          sub.reviewed_by ? `reviewed by ${reviewerLabel(sub)}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        onBack={onBack}
        backLabel="Queue"
        status={<StatusChip status={sub.status} />}
      >
        {/* Approve is the one filled button: the thing this screen exists for. Send back
            stays quiet until hovered, and turns red only then. */}
        {awaiting && (
          <>
            <Button
              onClick={() => setRejecting(true)}
              disabled={busy}
              startIcon={<RotateCcw size={16} />}
              sx={{ ...quietBtn, "&:hover": { color: "error.main" } }}
            >
              Send back
            </Button>
            <Button
              onClick={() => void act(() => approve.mutateAsync(id))}
              disabled={busy}
              variant="contained"
              startIcon={<Check size={16} />}
              sx={primaryBtn}
            >
              Approve
            </Button>
          </>
        )}
        {approved && (
          <Button
            onClick={() => void act(() => markImported.mutateAsync(id))}
            disabled={busy}
            variant="contained"
            startIcon={<Check size={16} />}
            sx={primaryBtn}
          >
            Mark imported
          </Button>
        )}
      </WorkspaceHead>

      {error && (
        <Alert severity="error" sx={{ mb: 2, fontSize: 13 }}>
          {error}
        </Alert>
      )}

      {/* The campaign this list belongs to. A reviewer CANNOT import without it, so it sits
          in the open rather than behind a detail panel — and says plainly when the submitter
          didn't provide one. */}
      <Panel sx={{ px: 2, py: 1.25, mb: 2, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Typography
          sx={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "text.disabled",
          }}
        >
          Salesforce campaign
        </Typography>
        {sub.campaign_id && (
          <Typography sx={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace" }}>
            {sub.campaign_id}
          </Typography>
        )}
        {sub.sf_campaign_url && !sub.campaign_id && (
          <Typography sx={{ fontSize: 13, color: "warning.main", fontWeight: 600 }}>
            No campaign ID in this link —
          </Typography>
        )}
        {sub.sf_campaign_url ? (
          <Link
            href={sub.sf_campaign_url}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              fontSize: 13,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 0.4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {sub.sf_campaign_url}
            <Box sx={{ flexShrink: 0, display: "inline-flex" }}>
              <ExternalLink size={12} />
            </Box>
          </Link>
        ) : (
          <Typography sx={{ fontSize: 13, color: "warning.main", fontWeight: 600 }}>
            Not provided — ask the submitter before importing.
          </Typography>
        )}
        <Typography
          sx={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "text.disabled",
            ml: { sm: 2 },
          }}
        >
          SDR owner
        </Typography>
        {sub.sdr_owner_email ? (
          <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{sub.sdr_owner_email}</Typography>
        ) : (
          <Typography sx={{ fontSize: 13, color: "warning.main", fontWeight: 600 }}>
            Not provided
          </Typography>
        )}
      </Panel>

      {/* Export is review-only BY DESIGN: submitters must never obtain the Pardot file. */}
      {released && (
        <Panel sx={{ px: 2, py: 1.5, mb: 2, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, mr: 0.5 }}>Pardot-ready CSVs</Typography>
          {/* The whole set FIRST — taking all of them is the normal case, and picking them
              off one at a time is the exception. */}
          <Button
            onClick={() =>
              void exportAllM.mutateAsync({ id, filename: `${sub.event_name} - Pardot lists.zip` })
            }
            disabled={exportAllM.isPending}
            variant="contained"
            startIcon={<FileArchive size={16} />}
            sx={primaryBtn}
          >
            Download all ({exportable.length})
          </Button>
          {exportable.map((t) => (
            <Button
              key={t}
              onClick={() =>
                void exportTabM.mutateAsync({ id, tab: t, filename: `${sub.event_name} - ${t}.csv` })
              }
              disabled={exportTabM.isPending}
              sx={quietBtn}
              startIcon={<Download size={16} />}
            >
              {t}
            </Button>
          ))}
        </Panel>
      )}

      {/* The same rail the submitter sees, so the two sides of the feature agree about what
          the primary axis is. Here the badge is a ROW COUNT: there's nothing to fix, and how
          big each list is happens to be what a reviewer wants to know. */}
      <TabRail
        tabs={exportable.map((t) => ({ key: t, label: t, count: (model?.tabs[t] ?? []).length }))}
        value={active}
        onChange={setActiveTab}
      />

      {rows.length === 0 ? (
        <Empty>Nothing in this submission.</Empty>
      ) : (
        <AttendeeGrid
          rows={rows}
          tab={active}
          editable={false}
          busy={false}
          attached
          config={config}
          onEdit={() => {}}
          onAccept={() => {}}
          onReject={() => {}}
        />
      )}

      {(comments.data ?? []).length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1 }}>History</Typography>
          <Panel sx={{ px: 2, py: 1.5 }}>
            {(comments.data ?? []).map((c) => (
              <Typography key={c.id} sx={{ fontSize: 13, mb: 0.75, "&:last-child": { mb: 0 } }}>
                {c.comment}
                <Box component="span" sx={{ color: "text.secondary", ml: 1, fontSize: 11.5 }}>
                  — {c.author_email} · <Timestamp value={c.created_at} />
                </Box>
              </Typography>
            ))}
          </Panel>
        </Box>
      )}

      <Dialog open={rejecting} onClose={() => !busy && setRejecting(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontSize: 16, fontWeight: 800 }}>Send back for changes</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 1.5 }}>
            Say what needs fixing — this is what the submitter sees.
          </Typography>
          <Box
            component="textarea"
            value={rejectText}
            autoFocus
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRejectText(e.target.value)}
            sx={{
              width: "100%",
              minHeight: 110,
              p: 1.5,
              borderRadius: 1,
              border: 1,
              borderColor: "divider",
              bgcolor: "background.default",
              font: "inherit",
              fontSize: 13,
              color: "text.primary",
              resize: "vertical",
              outline: "none",
              "&:focus": { borderColor: "primary.main" },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRejecting(false)} disabled={busy} sx={quietBtn}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={!rejectText.trim() || busy}
            sx={primaryBtn}
            onClick={() =>
              void act(() => sendBack.mutateAsync({ id, comment: rejectText.trim() })).then((ok) => {
                if (!ok) return;
                setRejecting(false);
                setRejectText("");
              })
            }
          >
            Send back
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

const TH = { fontSize: 11, fontWeight: 700 } as const;
