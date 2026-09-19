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

import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { FileDownIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useParRating } from "../api/useParData";
import { useLeadRatingUpdate } from "../api/useLeadRatingUpdate";
import { useParEmployeeReviews } from "../api/useLeadHistory";
import { decodeParComment, encodeParComment, isEmptyHtml } from "../util/parComment";
import { isDeadlinePassed } from "../util/parDeadline";
import { formatShortDate } from "../util/parDate";
import { downloadParPdf } from "../util/parPdf";
import ParRichTextField from "./ParRichTextField";
import { ParCommentView } from "./ParContent";
import ParEmptyState from "./ParEmptyState";
import ParHistoryReviewSection from "./ParHistoryReviewSection";
import type { ParCycle } from "../api/types";

const TOP_5_20_ENABLED_RATING = "Successful";

// Ports LeadReviewPanel.tsx's lead-only path (Admin Portal view modes left
// out). Not ported: evidence attachments (parPerformanceNoticeAck's Google
// Drive picker — a capability nothing else in this app has).
export default function ParLeadReviewPanel({
  cycle,
  employeeEmail,
}: {
  cycle: ParCycle;
  employeeEmail: string;
}) {
  const rating = useParRating(cycle.parCycleId, employeeEmail);
  const ratingUpdate = useLeadRatingUpdate(cycle.parCycleId);
  const reviews = useParEmployeeReviews(cycle.parCycleId, employeeEmail);
  const { showSuccess, showError } = useNotifications();

  const [leadComment, setLeadComment] = useState("");
  const [parRatingValue, setParRatingValue] = useState("");
  const [specialRating, setSpecialRating] = useState<"NONE" | "TOP5P" | "TOP20P">("NONE");
  const [specialRatingConfirmed, setSpecialRatingConfirmed] = useState(false);
  const [seededForId, setSeededForId] = useState<number | undefined>(undefined);
  const [autoSaved, setAutoSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const autoSaveTokenRef = useRef(0);

  const parRatingData = rating.data;

  // Seed once per record, so a background refetch doesn't overwrite mid-typing.
  if (parRatingData && parRatingData.parRatingId !== seededForId) {
    setSeededForId(parRatingData.parRatingId);
    setLeadComment(decodeParComment(parRatingData.parLeadComment));
    setParRatingValue(parRatingData.parRating && parRatingData.parRating !== "NOT_ASSIGNED" ? parRatingData.parRating : "");
    setSpecialRating((parRatingData.parSpecialRating as "TOP5P" | "TOP20P" | undefined) ?? "NONE");
    setSpecialRatingConfirmed(
      parRatingData.parRating === TOP_5_20_ENABLED_RATING &&
        Boolean(parRatingData.parSpecialRating) &&
        parRatingData.parSpecialRating !== "NONE",
    );
  }

  useEffect(() => {
    if (parRatingValue !== TOP_5_20_ENABLED_RATING) {
      setSpecialRating("NONE");
      setSpecialRatingConfirmed(false);
    }
  }, [parRatingValue]);

  // Every value below is derived with parRatingData possibly still
  // undefined (loading/error/not-found are handled further down, but hooks
  // must stay unconditional), so the submit/autosave logic guards on it
  // itself rather than relying on an early return to have already happened.
  const deadlinePassed = isDeadlinePassed(cycle.parLeadDeadline);
  const shared = parRatingData?.parLeadStatus === "SHARED";
  const readOnly = shared || deadlinePassed;
  const savedLeadComment = decodeParComment(parRatingData?.parLeadComment);

  const submit = (
    status: "DRAFT" | "SHARED",
    opts?: { silent?: boolean; onSuccess?: () => void; commentOnly?: boolean },
  ) => {
    if (!parRatingData) return;
    ratingUpdate.mutate(
      {
        employeeEmail,
        parRatingId: parRatingData.parRatingId,
        payload: {
          parLeadStatus: status,
          parLeadComment: encodeParComment(leadComment),
          // The autosave fires purely off comment typing and must not also
          // commit whatever the rating dropdowns currently hold — source's
          // own updateParRatingAutoSave has this same bug (parSpecialRating
          // sent unconditionally, clobbering a saved Top 5%/20% allocation
          // the moment someone types a character), so this is a deliberate
          // deviation, not a port gap.
          ...(opts?.commentOnly
            ? {}
            : {
                ...(parRatingValue ? { parRating: parRatingValue } : {}),
                parSpecialRating: specialRating,
              }),
        },
      },
      {
        onSuccess: () => {
          if (!opts?.silent) showSuccess(status === "SHARED" ? "Successfully shared" : "Draft saved");
          opts?.onSuccess?.();
        },
        onError: (err) => {
          if (!opts?.silent) showError(describeError(err));
        },
      },
    );
  };

  useEffect(() => {
    if (!parRatingData || readOnly) return;
    if (isEmptyHtml(leadComment) || leadComment.trim() === savedLeadComment.trim()) return;
    if (ratingUpdate.isPending) return;
    const timer = window.setTimeout(() => {
      const token = ++autoSaveTokenRef.current;
      submit("DRAFT", {
        silent: true,
        commentOnly: true,
        onSuccess: () => {
          if (token !== autoSaveTokenRef.current) return;
          setAutoSaved(true);
          window.setTimeout(() => setAutoSaved(false), 2000);
        },
      });
    }, 5000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadComment, readOnly, ratingUpdate.isPending, parRatingData]);

  if (rating.isLoading) {
    return <Skeleton variant="rectangular" height={360} sx={{ borderRadius: 1.5 }} />;
  }
  if (rating.isError) {
    return (
      <ErrorNotice error={rating.error} onRetry={() => rating.refetch()} retrying={rating.isFetching}>
        Couldn't load this employee's PAR record.
      </ErrorNotice>
    );
  }
  if (!parRatingData) {
    return <Alert severity="info">This employee's record for this cycle isn't ready yet.</Alert>;
  }

  const employeeComment = decodeParComment(parRatingData.parEmployeeComment);

  const dirty =
    leadComment.trim() !== savedLeadComment.trim() ||
    (parRatingValue !== (parRatingData.parRating ?? "") && parRatingValue !== "") ||
    specialRating !== (parRatingData.parSpecialRating ?? "NONE");

  const statusAlert = readOnly ? (
    <Alert severity={shared ? "success" : "info"}>
      {shared ? "Lead's feedback is shared with the employee" : "Lead's feedback is not shared with the employee"}
    </Alert>
  ) : parRatingData.parLeadStatus === "DRAFT" ? (
    <Alert severity="warning">
      You have saved your PAR as a draft Please share on or before the deadline: {formatShortDate(cycle.parLeadDeadline)}.
    </Alert>
  ) : (
    <Alert severity="info">
      Please share the lead's feedback before the deadline: {formatShortDate(cycle.parLeadDeadline)}.
    </Alert>
  );

  // Save Draft only enables once something has actually changed; Share
  // additionally waits for the employee to have at least started their own
  // side (LeadReviewPanel.tsx:1572-1574 — parEmployeeStatus !== PENDING),
  // and — per its own yup validationSchema (parRating/parLeadComment both
  // "Required" for a non-admin caller) — for a rating to be picked and the
  // comment to be non-empty. The backend doesn't enforce either, so this is
  // the only place that does.
  const employeeHasStarted = parRatingData.parEmployeeStatus !== "PENDING";
  const canSaveDraft = !readOnly && !deadlinePassed && !ratingUpdate.isPending && dirty;
  const canShare =
    !readOnly &&
    !deadlinePassed &&
    !ratingUpdate.isPending &&
    employeeHasStarted &&
    Boolean(parRatingValue) &&
    !isEmptyHtml(leadComment);

  return (
    <Grid container spacing={2}>
      <Grid size={12}>
        <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
          <Box flex={1}>
            {statusAlert}
            {deadlinePassed && !shared && (
              <Alert severity="error" sx={{ mt: 1.5 }}>
                Lead's feedback deadline is passed on: {formatShortDate(cycle.parLeadDeadline)}.
              </Alert>
            )}
          </Box>
          <Tooltip title={reviews.isSuccess ? "Download PAR details" : "360° reviews are still loading"}>
            <span>
              <IconButton
                aria-label="download"
                disabled={!reviews.isSuccess}
                onClick={() => downloadParPdf(parRatingData, employeeComment, savedLeadComment, reviews.data)}
              >
                <FileDownIcon size={18} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <Card variant="outlined" sx={{ height: "100%" }}>
          <CardHeader title={<Typography variant="h6">Lead's Feedback</Typography>} />
          <CardContent>
            <Stack spacing={2}>
              <Box sx={{ position: "relative" }}>
                {readOnly ? (
                  shared ? (
                    <ParCommentView html={savedLeadComment} />
                  ) : (
                    <ParEmptyState
                      text={
                        parRatingData.parLeadStatus === "DRAFT"
                          ? "Lead's feedback has not been shared"
                          : "Lead's feedback is pending"
                      }
                    />
                  )
                ) : (
                  <ParRichTextField value={leadComment} onChange={setLeadComment} placeholder="Enter your comment here" />
                )}
                {autoSaved && (
                  <Typography variant="caption" color="text.secondary" sx={{ position: "absolute", bottom: -20, left: 0 }}>
                    Draft Saved
                  </Typography>
                )}
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Typography sx={{ flexShrink: 0 }}>Rating:</Typography>
                {readOnly ? (
                  parRatingData.parRating ? (
                    <Chip size="small" label={parRatingData.parRating} />
                  ) : (
                    <Typography color="text.secondary">N/A</Typography>
                  )
                ) : (
                  <TextField
                    select
                    label="Select Rating"
                    size="small"
                    fullWidth
                    value={parRatingValue}
                    onChange={(e) => setParRatingValue(e.target.value)}
                    disabled={ratingUpdate.isPending}
                  >
                    {(cycle.parCycleConfigurations?.parRatings ?? []).map((r) => (
                      <MenuItem key={r} value={r}>
                        {r}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              </Box>

              {!readOnly && parRatingValue === TOP_5_20_ENABLED_RATING && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={specialRatingConfirmed}
                      onChange={(e) => setSpecialRatingConfirmed(e.target.checked)}
                      disabled={ratingUpdate.isPending}
                    />
                  }
                  label="The Top 5% / 20% rating decision was discussed and finalized with the functional lead"
                />
              )}

              {parRatingValue === TOP_5_20_ENABLED_RATING && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Typography sx={{ flexShrink: 0 }}>Top 5%/20% Rating:</Typography>
                  {readOnly ? (
                    <Chip size="small" label={specialRating} />
                  ) : (
                    <TextField
                      select
                      label="Select Top 5%/20% Rating"
                      size="small"
                      fullWidth
                      value={specialRating}
                      onChange={(e) => setSpecialRating(e.target.value as typeof specialRating)}
                      disabled={!specialRatingConfirmed || ratingUpdate.isPending}
                    >
                      <MenuItem value="NONE">N/A</MenuItem>
                      <MenuItem value="TOP5P">Top 5%</MenuItem>
                      <MenuItem value="TOP20P">Top 20%</MenuItem>
                    </TextField>
                  )}
                </Box>
              )}

              {readOnly && parRatingData.parRatingSharedBy && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Typography sx={{ flexShrink: 0 }}>PAR shared by:</Typography>
                  <Chip size="small" label={parRatingData.parRatingSharedBy} />
                </Box>
              )}

              {!readOnly && !employeeHasStarted && (
                <Typography color="warning.main" textAlign="right" sx={{ mb: 1 }}>
                  * Sharing lead's feedback is disabled until employee PAR is started
                </Typography>
              )}

              {!readOnly && (
                <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5 }}>
                  <Button variant="outlined" disabled={!canSaveDraft} onClick={() => submit("DRAFT")}>
                    Save draft
                  </Button>
                  <Button variant="contained" disabled={!canShare} onClick={() => setConfirming(true)}>
                    Share
                  </Button>
                </Box>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <Card variant="outlined" sx={{ height: "100%" }}>
          <CardHeader title={<Typography variant="h6">Employee PAR</Typography>} />
          <CardContent>
            {employeeComment ? (
              <ParCommentView html={employeeComment} />
            ) : (
              <ParEmptyState text="Employee PAR hasn't been shared" />
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid size={12}>
        {reviews.isLoading ? (
          <Skeleton variant="rectangular" height={72} sx={{ borderRadius: 1.5 }} />
        ) : reviews.isError ? (
          <ErrorNotice error={reviews.error} onRetry={() => reviews.refetch()} retrying={reviews.isFetching}>
            Couldn't load 360° feedback.
          </ErrorNotice>
        ) : (
          <ParHistoryReviewSection reviews={reviews.data ?? []} />
        )}
      </Grid>

      <Dialog open={confirming} onClose={() => setConfirming(false)} maxWidth="md" fullWidth>
        <DialogTitle>Share Lead's Feedback?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This action will share your review with the employee. You can't undo this action.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirming(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={ratingUpdate.isPending}
            onClick={() => submit("SHARED", { onSuccess: () => setConfirming(false) })}
          >
            {ratingUpdate.isPending ? "Sharing…" : "Share"}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
}
