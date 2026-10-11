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

import { useEffect, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  ComplexSelect,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Skeleton,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";
import { useLeaveEmployees } from "@features/leave/api/useLeaveData";
import { employeeDisplayName } from "@features/leave/util/employeeName";
import { useMyReview, useSubmitReview } from "../api/usePar360";
import { decodeParComment, encodeParComment, isEmptyHtml } from "../util/parComment";
import { isDeadlinePassed as checkDeadlinePassed } from "../util/parDeadline";
import { formatShortDate } from "../util/parDate";
import ParRichTextField from "./ParRichTextField";
import { ParCommentView, ParQuestionText } from "./ParContent";

// par-app's own copy for the panel intro — config/constant.ts's
// parUiText.ThreeSixtyReviewPanelDescription.
const PANEL_DESCRIPTION =
  "Your feedback is all about helping our colleagues improve and become better versions of themselves. " +
  "Please share your candid feedback to support their growth and development.";

// Give (or decline) the 360° review one employee asked of you — par-app's
// ReviewProvideModal, including its 5s debounced autosave
// (autoSaveCountdownDuration).
export default function Par360ReviewDialog({
  open,
  onClose,
  parCycleId,
  employeeEmail,
  reviewQuestion,
  reviewRatings,
  reviewDeadline,
  isOfferedFeedback = false,
  reviewerEmail,
}: {
  open: boolean;
  onClose: () => void;
  parCycleId: number;
  employeeEmail: string;
  reviewQuestion: string;
  reviewRatings: string[];
  /** The cycle's parThreeSixtyRatingDeadline — drives this dialog's own
   * status alert (ReviewProvideModal.tsx:400-424), separate from (and in
   * addition to) the tab's page-level one. */
  reviewDeadline: string;
  /** Voluntary feedback — offered rather than requested. Hides Decline
   * (there was no request to decline) and identifies the reviewer
   * explicitly in the payload. */
  isOfferedFeedback?: boolean;
  /** Required when `isOfferedFeedback` — the caller's own email. */
  reviewerEmail?: string;
}) {
  const existing = useMyReview(parCycleId, employeeEmail, open);
  const submit = useSubmitReview(parCycleId);

  const [rating, setRating] = useState("");
  const [comment, setComment] = useState("");
  const [declining, setDeclining] = useState(false);
  const [seededFor, setSeededFor] = useState<string | undefined>(undefined);
  const [autoSaved, setAutoSaved] = useState(false);
  // ReviewProvideModal.tsx wraps the final Share/Decline in a
  // ConfirmationDialog ("This action cannot be undone" / "You can't undo
  // this action") — both are irreversible once the backend records them.
  const [confirmingAction, setConfirmingAction] = useState<"share" | "decline" | null>(null);

  // Seed once per (dialog-open, employee) pair.
  const seedKey = open ? employeeEmail : undefined;
  if (existing.data !== undefined && seedKey && seedKey !== seededFor) {
    setSeededFor(seedKey);
    setRating(existing.data?.reviewRating ?? "");
    setComment(decodeParComment(existing.data?.reviewComment));
  }

  const handleClose = () => {
    setSeededFor(undefined);
    setDeclining(false);
    setConfirmingAction(null);
    onClose();
  };

  const submitReview = (
    status: "DRAFT" | "SHARED" | "REJECTED",
    opts?: { silent?: boolean; onSuccess?: () => void },
  ) => {
    submit.mutate(
      {
        employeeWorkEmail: employeeEmail,
        payload: {
          reviewComment: encodeParComment(comment),
          ...(status !== "REJECTED" && rating ? { reviewRating: rating } : {}),
          par360ReviewStatus: status,
          ...(isOfferedFeedback && reviewerEmail ? { reviewerEmail } : {}),
        },
      },
      opts?.silent ? { onSuccess: opts.onSuccess } : { onSuccess: handleClose },
    );
  };

  const commentValid = !isEmptyHtml(comment);
  const canSubmit = commentValid && rating !== "" && !submit.isPending;
  const savedComment = decodeParComment(existing.data?.reviewComment);
  const deadlinePassed = checkDeadlinePassed(reviewDeadline);
  const reviewStatus = existing.data?.reviewStatus ?? "PENDING";
  const finalized = reviewStatus === "SHARED" || reviewStatus === "REJECTED";
  const employees = useLeaveEmployees(open && finalized);
  const employee = employees.data?.find((e) => e.workEmail === employeeEmail);

  // ReviewProvideModal.tsx's autosave: 5s after the comment stops changing,
  // save a draft silently — no confirmation dialog open, not mid-decline,
  // not past the deadline. `confirmingAction` must gate (and be a dep of)
  // this effect: without it, a save already scheduled before Share was
  // clicked keeps its timer and can PATCH a stale DRAFT after the SHARED
  // submit that the confirm dialog just sent.
  useEffect(() => {
    if (
      !open ||
      existing.isLoading ||
      declining ||
      deadlinePassed ||
      confirmingAction !== null ||
      comment.trim() === savedComment.trim() ||
      !commentValid
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      submitReview("DRAFT", {
        silent: true,
        onSuccess: () => {
          setAutoSaved(true);
          window.setTimeout(() => setAutoSaved(false), 2000);
        },
      });
    }, 5000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comment, open, declining, deadlinePassed, confirmingAction, existing.isLoading]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      {/* ReviewProvideModal.tsx: fixed title, divider, who-it's-for below
          (email — no name/thumbnail lookup available here). */}
      <DialogTitle sx={{ pb: 2 }}>{finalized ? "360° Feedback" : "Provide 360° Feedback"}</DialogTitle>
      <Divider />
      <DialogContent>
        {existing.isLoading ? (
          <Skeleton variant="rectangular" height={180} sx={{ borderRadius: 1.5 }} />
        ) : existing.isError ? (
          <Alert severity="error">{describeError(existing.error)}</Alert>
        ) : finalized ? (
          <Stack spacing={2.5} sx={{ mt: 0.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Avatar
                src={employee?.employeeThumbnail || undefined}
                slotProps={{ img: { referrerPolicy: "no-referrer" } }}
                sx={{ width: 56, height: 56 }}
              />
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600 }}>{employee ? employeeDisplayName(employee) : employeeEmail}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {employeeEmail}
                </Typography>
              </Box>
            </Box>
            {reviewStatus === "SHARED" && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Typography sx={{ fontWeight: 600, minWidth: 80 }}>Rating:</Typography>
                <Chip size="small" variant="outlined" color="primary" label={existing.data?.reviewRating ?? ""} />
              </Box>
            )}
            <Box>
              <Typography sx={{ fontWeight: 600, mb: 1 }}>
                {reviewStatus === "REJECTED" ? "Reason:" : "Feedback:"}
              </Typography>
              <Box sx={{ p: 2, borderRadius: 1.5, bgcolor: "action.hover" }}>
                <ParCommentView html={savedComment} />
              </Box>
            </Box>
          </Stack>
        ) : (
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <Typography sx={{ fontWeight: 600 }}>{employeeEmail}</Typography>
            {/* ReviewProvideModal.tsx:400-424 — the dialog's own status
                alert, separate from (and in addition to) the tab's. */}
            {deadlinePassed ? (
              <Alert severity="error">
                The deadline for sharing the 360° feedback has passed on {formatShortDate(reviewDeadline)}.
              </Alert>
            ) : reviewStatus === "PENDING" ? (
              <Alert severity="info">
                Please share your 360° feedback before the deadline: {formatShortDate(reviewDeadline)}.
              </Alert>
            ) : reviewStatus === "DRAFT" ? (
              <Alert severity="warning">
                Your 360° feedback is saved as a draft. Please share on or before the deadline:{" "}
                {formatShortDate(reviewDeadline)}.
              </Alert>
            ) : null}

            {!declining && (
              <>
                {/* ReviewProvideModal.tsx:442, parUiText.ThreeSixtyReviewPanelDescription */}
                <Typography variant="body2" color="text.secondary">{PANEL_DESCRIPTION}</Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Typography id="par360-review-rating-label" sx={{ flexShrink: 0 }}>Rating:</Typography>
                  <ComplexSelect
                    fullWidth
                    value={rating}
                    onChange={(e) => setRating(e.target.value as string)}
                    readOnly={deadlinePassed}
                    aria-labelledby="par360-review-rating-label"
                  >
                    {reviewRatings.map((r) => (
                      <ComplexSelect.MenuItem key={r} value={r}>
                        {r}
                      </ComplexSelect.MenuItem>
                    ))}
                  </ComplexSelect>
                </Box>
              </>
            )}

            {declining ? (
              <Typography sx={{ fontWeight: 600 }}>Reason :</Typography>
            ) : (
              <ParQuestionText html={reviewQuestion} fallback="360° feedback" />
            )}
            <Box sx={{ position: "relative" }}>
              {/* ReviewProvideModal.tsx:484-507 — past the deadline the
                  field becomes read-only (CommentPaper), not just the
                  actions below. */}
              {deadlinePassed ? (
                <ParCommentView html={comment} />
              ) : (
                <ParRichTextField value={comment} onChange={setComment} />
              )}
              {/* ReviewProvideModal.tsx:508-515 — shown while autosaving. */}
              {autoSaved && (
                <Typography variant="caption" color="text.secondary" sx={{ position: "absolute", bottom: -20, left: 0 }}>
                  Saving draft…
                </Typography>
              )}
            </Box>
            {submit.isError && <Alert severity="error">{describeError(submit.error)}</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose}>{finalized ? "Close" : "Cancel"}</Button>
        {!isOfferedFeedback &&
          !finalized &&
          (!declining ? (
            <Button color="error" onClick={() => setDeclining(true)} disabled={submit.isPending}>
              Decline
            </Button>
          ) : (
            <Button onClick={() => setDeclining(false)} disabled={submit.isPending}>
              Back
            </Button>
          ))}
        {finalized ? null : declining ? (
          <Button
            color="error"
            variant="contained"
            disabled={!commentValid || submit.isPending}
            onClick={() => setConfirmingAction("decline")}
          >
            Decline
          </Button>
        ) : (
          <>
            <Button
              variant="outlined"
              disabled={!commentValid || submit.isPending || deadlinePassed}
              onClick={() => submitReview("DRAFT")}
            >
              Save draft
            </Button>
            <Button
              variant="contained"
              disabled={!canSubmit || deadlinePassed}
              onClick={() => setConfirmingAction("share")}
            >
              Share
            </Button>
          </>
        )}
      </DialogActions>

      {/* ReviewProvideModal.tsx's ConfirmationDialog — wording matches
          uiMessages.dialog.threeSixtyReviewShare / threeSixtyReviewReject. */}
      <Dialog open={confirmingAction !== null} onClose={() => setConfirmingAction(null)} maxWidth="md">
        <DialogTitle>
          {confirmingAction === "decline" ? "Decline 360° Feedback Request?" : "Share 360° Feedback?"}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {confirmingAction === "decline"
              ? "This will decline the 360 Feedback request. You can't undo this action."
              : "By proceeding you will send your 360° feedback to the employee's lead. This action cannot be undone."}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmingAction(null)} disabled={submit.isPending}>
            Cancel
          </Button>
          <Button
            color={confirmingAction === "decline" ? "error" : "primary"}
            variant="contained"
            disabled={submit.isPending}
            onClick={() => submitReview(confirmingAction === "decline" ? "REJECTED" : "SHARED")}
          >
            {submit.isPending
              ? confirmingAction === "decline"
                ? "Declining…"
                : "Sharing…"
              : confirmingAction === "decline"
                ? "Decline"
                : "Share"}
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}
