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

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Skeleton,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import { PlayCircleIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useMeProfile } from "@features/my/api/useMeProfile";
import { formatShortDate } from "../util/parDate";
import { useActiveParCycle, useParEmployeeInfo, useParRating } from "../api/useParData";
import { useSaveParRating } from "../api/useParMutations";
import { decodeParComment, encodeParComment, isEmptyHtml } from "../util/parComment";
import { isDeadlinePassed } from "../util/parDeadline";
import ParRatingSummary from "../components/ParRatingSummary";
import ParRichTextField from "../components/ParRichTextField";
import { ParCommentView, ParQuestionText } from "../components/ParContent";
import type { ParCycle, ParRating } from "../api/types";

// People Ops → Performance → Employee Feedback (OngoingCycleView.tsx's
// ParCycleViewTabs.EMPLOYEE): ParInputForm/ParStatusView for the form,
// ParRatingSummary (shared with History) for what shows once the lead has
// shared.
export default function ParEmployeeFeedbackTab() {
  const profile = useMeProfile();
  const workEmail = profile.data?.userInfo.workEmail;
  // par-app's own leadEmail, not people-app's managerEmail — the two can disagree.
  const leadEmail = useParEmployeeInfo(workEmail).data?.leadEmail ?? undefined;

  const activeCycles = useActiveParCycle(workEmail);
  // manager.bal refuses to have two cycles OPEN at once, so there is at most
  // one to show.
  const cycle = activeCycles.data?.[0];
  const rating = useParRating(cycle?.parCycleId, workEmail);
  const save = useSaveParRating(cycle?.parCycleId, workEmail);
  const { showSuccess, showError } = useNotifications();

  const [comment, setComment] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [unsharing, setUnsharing] = useState(false);

  // Seed the editable field from the fetched record exactly once per
  // record, so a background refetch doesn't overwrite mid-typing.
  const [seededForId, setSeededForId] = useState<number | undefined>(undefined);
  if (rating.data && rating.data.parRatingId !== seededForId) {
    setSeededForId(rating.data.parRatingId);
    setComment(decodeParComment(rating.data.parEmployeeComment));
  }

  let body: ReactNode;
  if (activeCycles.isLoading || profile.isLoading) {
    body = <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5, maxWidth: 1100 }} />;
  } else if (profile.isError) {
    body = (
      <ErrorNotice error={profile.error} onRetry={() => profile.refetch()} retrying={profile.isFetching}>
        Couldn't load your profile.
      </ErrorNotice>
    );
  } else if (activeCycles.isError) {
    body = (
      <ErrorNotice error={activeCycles.error} onRetry={() => activeCycles.refetch()} retrying={activeCycles.isFetching}>
        Couldn't load your PAR cycle.
      </ErrorNotice>
    );
  } else if (!cycle) {
    body = <Alert severity="info">There's no PAR cycle open for you right now.</Alert>;
  } else if (rating.isLoading) {
    body = <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5, maxWidth: 1100 }} />;
  } else if (rating.isError) {
    body = (
      <ErrorNotice error={rating.error} onRetry={() => rating.refetch()} retrying={rating.isFetching}>
        Couldn't load your PAR record for this cycle.
      </ErrorNotice>
    );
  } else if (!rating.data) {
    body = <Alert severity="info">Your record for this cycle isn't ready yet — check back shortly.</Alert>;
  } else {
    const ratingData = rating.data;
    body = (
      <SelfReviewForm
        cycle={cycle}
        rating={ratingData}
        leadEmail={leadEmail}
        comment={comment}
        setComment={setComment}
        confirming={confirming}
        setConfirming={setConfirming}
        unsharing={unsharing}
        setUnsharing={setUnsharing}
        isSaving={save.isPending}
        onSaveDraft={(opts) => {
          save.mutate(
            {
              parRatingId: ratingData.parRatingId,
              parEmployeeComment: encodeParComment(comment),
              parEmployeeStatus: "DRAFT",
            },
            {
              // Silent for the autosave path — only the manual button shows a toast.
              onSuccess: () => {
                if (!opts?.silent) showSuccess("Draft saved.");
                opts?.onSuccess?.();
              },
              onError: (err) => {
                if (!opts?.silent) showError(describeError(err));
              },
            },
          );
        }}
        onSubmit={() => {
          save.mutate(
            {
              parRatingId: ratingData.parRatingId,
              parEmployeeComment: encodeParComment(comment),
              parEmployeeStatus: "SHARED",
            },
            {
              onSuccess: () => {
                setConfirming(false);
                showSuccess("Your review has been shared with your lead.");
              },
              onError: (err) => showError(describeError(err)),
            },
          );
        }}
        onUnshare={() => {
          save.mutate(
            { parRatingId: ratingData.parRatingId, parEmployeeStatus: "DRAFT" },
            {
              onSuccess: () => {
                setUnsharing(false);
                showSuccess("Your review is back in draft — make your changes and share again.");
              },
              onError: (err) => showError(describeError(err)),
            },
          );
        }}
      />
    );
  }

  return <Box sx={{ pt: 0.5 }}>{body}</Box>;
}

function SelfReviewForm({
  cycle,
  rating,
  leadEmail,
  comment,
  setComment,
  confirming,
  setConfirming,
  unsharing,
  setUnsharing,
  isSaving,
  onSaveDraft,
  onSubmit,
  onUnshare,
}: {
  cycle: ParCycle;
  rating: ParRating;
  leadEmail: string | undefined;
  comment: string;
  setComment: (v: string) => void;
  confirming: boolean;
  setConfirming: (v: boolean) => void;
  unsharing: boolean;
  setUnsharing: (v: boolean) => void;
  isSaving: boolean;
  onSaveDraft: (opts?: { silent?: boolean; onSuccess?: () => void }) => void;
  onSubmit: () => void;
  onUnshare: () => void;
}) {
  const deadlinePassed = isDeadlinePassed(cycle.parEmployeeDeadline);
  const status = rating.parEmployeeStatus;
  const shared = status === "SHARED" || status === "SHARED_BLOCKED";
  // The finalized summary (+ PDF) only shows once actually shared
  // (ParStatusView.tsx) — a lapsed but never-shared draft stays the form,
  // read-only, not the summary.
  const finalized = shared;
  const savedComment = decodeParComment(rating.parEmployeeComment);
  const dirty = comment.trim() !== savedComment.trim();
  // par-app's EmployeePar.tsx: UNSHARE is offered only while the lead hasn't
  // shared their own side yet — once they have, the record is final.
  const canUnshare = status === "SHARED" && rating.parLeadStatus !== "SHARED" && !deadlinePassed;

  // PENDING opens on a "Start" button rather than the form directly; a
  // draft always shows the form (ParStatusView.tsx).
  const [started, setStarted] = useState(false);
  const showForm = started || status === "DRAFT";

  // Autosave 1s after the comment changes (ParInputForm.tsx's handleAutoSave).
  const [autoSaved, setAutoSaved] = useState(false);
  // ParInputForm.tsx's lastChangeTimestamp guard — ignore a stale autosave
  // completing after a newer one has started.
  const autoSaveTokenRef = useRef(0);
  useEffect(() => {
    if (
      finalized ||
      deadlinePassed ||
      !showForm ||
      confirming ||
      isEmptyHtml(comment) ||
      comment.trim() === savedComment.trim()
    ) {
      return;
    }
    // A save (this autosave or the manual button) is already in flight —
    // don't dispatch a second, possibly-overlapping PATCH. `isSaving`
    // flipping back to false re-runs this effect with whatever `comment`
    // is current then, so the latest text still gets saved once it clears.
    if (isSaving) return;
    const timer = window.setTimeout(() => {
      const token = ++autoSaveTokenRef.current;
      // ParInputForm.tsx sets isDraftSaved from updateParRating's own
      // success callback, not optimistically at dispatch time.
      onSaveDraft({
        silent: true,
        onSuccess: () => {
          if (token !== autoSaveTokenRef.current) return;
          setAutoSaved(true);
          window.setTimeout(() => setAutoSaved(false), 2000);
        },
      });
    }, 1000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comment, finalized, deadlinePassed, showForm, confirming, isSaving]);

  return (
    <Stack spacing={1.75} sx={{ maxWidth: 1100 }}>
      {!shared && (
        <Alert severity={deadlinePassed ? "error" : status === "DRAFT" ? "warning" : "info"}>
          {deadlinePassed
            ? `The deadline for submitting your PAR passed on ${formatShortDate(cycle.parEmployeeDeadline)}.`
            : status === "DRAFT"
              ? `Draft saved. Share it on or before ${formatShortDate(cycle.parEmployeeDeadline)}.`
              : `Share your PAR before the deadline: ${formatShortDate(cycle.parEmployeeDeadline)}.`}
        </Alert>
      )}
      {status === "SHARED" && (
        <Alert severity="success">Your review has been shared with your lead.</Alert>
      )}
      {status === "SHARED_BLOCKED" && (
        <Alert severity={rating.parLeadStatus === "SHARED" ? "success" : "info"}>
          {rating.parLeadStatus === "SHARED"
            ? "Your lead has shared their review."
            : "Your review is locked in while your lead completes theirs."}
        </Alert>
      )}

      {finalized ? (
        <ParRatingSummary cycle={cycle} rating={rating} />
      ) : !showForm ? (
        <Card variant="outlined" sx={{ p: 4, textAlign: "center" }}>
          <Box sx={{ color: "primary.main", display: "flex", justifyContent: "center", mb: 1.5 }}>
            <PlayCircleIcon size={36} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            Start your self-review
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 480, mx: "auto" }}>
            Answer this cycle's employee question in your own words, then share it with your lead
            before the deadline. Your progress is saved as a draft, so you can come back and finish
            it later.
          </Typography>
          <Button
            variant="contained"
            size="large"
            endIcon={<PlayCircleIcon size={16} />}
            disabled={deadlinePassed}
            onClick={() => setStarted(true)}
          >
            Start
          </Button>
        </Card>
      ) : (
        <Card variant="outlined" sx={{ p: 2 }}>
          <ParQuestionText
            html={cycle.parCycleConfigurations?.employeeParQuestion}
            fallback="No employee feedback question has been configured for this cycle yet."
            sx={{ mb: 1.5 }}
          />
          {/* ParInputForm.tsx:204-207 — past the deadline the field becomes
              read-only (CommentPaper), but the form itself (and its footer
              below) stays; it isn't replaced by the finalized summary. */}
          {deadlinePassed ? (
            <ParCommentView html={savedComment} />
          ) : (
            <ParRichTextField value={comment} onChange={setComment} placeholder="Enter your comment here" />
          )}
        </Card>
      )}

      {!finalized && showForm && (
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1.5 }}>
          <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>
            {autoSaved ? "Draft saved" : ""}
          </Typography>
          <Box sx={{ display: "flex", gap: 1.5 }}>
            {/* Buttons stay visible and merely disable past the deadline —
                ParInputForm.tsx:230-252 never hides them. */}
            <Button
              variant="outlined"
              disabled={isSaving || deadlinePassed || !dirty || isEmptyHtml(comment)}
              onClick={() => onSaveDraft()}
            >
              Save draft
            </Button>
            <Button
              variant="contained"
              disabled={isSaving || deadlinePassed || isEmptyHtml(comment)}
              onClick={() => setConfirming(true)}
            >
              Share
            </Button>
          </Box>
        </Box>
      )}

      {canUnshare && (
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Button color="error" variant="outlined" onClick={() => setUnsharing(true)}>
            Unshare
          </Button>
        </Box>
      )}

      <Dialog open={confirming} onClose={() => setConfirming(false)} maxWidth="md">
        <DialogTitle>Share your PAR?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            If you share this review, your feedback will be made available to{" "}
            <b>{leadEmail || "your lead"}</b>. Do you wish to continue?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirming(false)}>Cancel</Button>
          <Button variant="contained" onClick={onSubmit} disabled={isSaving}>
            {isSaving ? "Sharing…" : "Share"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={unsharing} onClose={() => setUnsharing(false)} maxWidth="md">
        <DialogTitle>Unshare your PAR?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This puts your review back in draft so you can change it. Your lead will no longer be
            able to see it until you share again.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setUnsharing(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={onUnshare} disabled={isSaving}>
            {isSaving ? "Unsharing…" : "Unshare"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
