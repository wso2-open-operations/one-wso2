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
import { Link as RouterLink, Navigate, Outlet, useLocation } from "react-router";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  Paper,
  Skeleton,
  TablePagination,
  Typography,
  alpha,
} from "@wso2/oxygen-ui";
import { CheckIcon, ExternalLinkIcon } from "@wso2/oxygen-ui-icons-react";
import { dialogPaperSx } from "@components/confirmation-dialog/dialogPaperSx";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { AMPLIFY_REVIEW_PATH } from "@constants/perspectives";
import type { ExternalShare, ExternalShareStatus } from "../api/amplifyTypes";
import {
  REVIEW_PAGE_SIZE,
  useAmplifyMe,
  useExternalSharesForReview,
  usePointValues,
  useWaitingReviewCount,
} from "../api/useAmplifyData";
import { useApproveExternalShare, useFeatureExternalShare } from "../api/useAmplifyMutations";
import { UNKNOWN_EMPLOYEE, usePersonLookup, type ResolvedPerson } from "../api/usePersonLookup";
import AmplifyShell from "../components/AmplifyShell";
import { ClosableDialogTitle } from "../components/ShareDialog";
import DeclineOwnPostForm from "../components/DeclineOwnPostForm";
import { describeAmplifyError } from "../util/amplifyError";
import { fullDate, initialsOf } from "../util/dashboardFormat";
import { originOf } from "../util/linkedinPost";
import { REVIEW_TABS, ownPostAwards, type OwnPostAwards } from "../util/ownPosts";

/** The error when Feature approved a post but couldn't feature it. */
export const FEATURE_AFTER_APPROVE_FAILED =
  "The post was approved, but it couldn't be featured. You can feature it from the Approved tab.";

/** Shown beside the disabled buttons on the reviewer's own post. */
export const OWN_CLAIM_NOTE = "This is your own post, so another marketing team member reviews it.";

/** The line under the list. */
export const AUDIT_NOTE = "Every decision is recorded in the audit log.";

const EMPTY_TEXT: Readonly<Record<ExternalShareStatus, string>> = {
  PENDING: "Nothing is waiting for review.",
  APPROVED: "No approved posts.",
  AMPLIFIED: "No featured posts.",
  REJECTED: "No declined posts.",
};

/** "Nov 22, 10:14" in the reader's timezone, or "" when it isn't a date. */
export function submittedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${day}, ${time}`;
}

/**
 * Review own posts (CAN_REVIEW_SHARES, checked by AmplifyReviewRoute): posts employees wrote about Choreo Labs, one
 * pill per status (Waiting carries its count), each a route of its own.
 */
export default function ReviewOwnPostsPage() {
  const waiting = useWaitingReviewCount(true);
  const awards = ownPostAwards(usePointValues().data);
  return (
    <AmplifyShell
      title="Review own posts"
      subtitle={
        `Posts employees wrote about Choreo Labs. Approve for +${awards.approved}, feature for +${awards.topUp} ` +
        "more, or decline with a reason they'll see."
      }
    >
      <StatusPills waiting={waiting.data} />
      <Outlet />
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        {AUDIT_NOTE}
      </Typography>
    </AmplifyShell>
  );
}

/** The four statuses as pills that link to their routes; the current one is filled. */
function StatusPills({ waiting }: { waiting: number | undefined }) {
  const { pathname } = useLocation();
  const current = pathname.startsWith(AMPLIFY_REVIEW_PATH)
    ? pathname.slice(AMPLIFY_REVIEW_PATH.length).replace(/^\//, "").split("/")[0]
    : "";
  return (
    <Box component="nav" aria-label="Review own posts" sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2.5 }}>
      {REVIEW_TABS.map((t) => {
        const selected = t.segment === current;
        const label = t.status === "PENDING" && waiting ? `${t.label} · ${waiting}` : t.label;
        return (
          <Chip
            key={t.segment}
            component={RouterLink}
            to={`${AMPLIFY_REVIEW_PATH}/${t.segment}`}
            clickable
            label={label}
            color={selected ? "primary" : "default"}
            variant={selected ? "filled" : "outlined"}
            aria-current={selected ? "page" : undefined}
            sx={{ fontWeight: 600, height: 36, px: 0.5, borderRadius: 999 }}
          />
        );
      })}
    </Box>
  );
}

/** `/amplify/review` itself opens the Waiting tab. */
export function ReviewIndexRedirect() {
  return <Navigate to={`${AMPLIFY_REVIEW_PATH}/${REVIEW_TABS[0].segment}`} replace />;
}

/** One tab: a page of claims in `status`, oldest first. */
export function ReviewTab({ status }: { status: ExternalShareStatus }) {
  const [page, setPage] = useState(0);
  const list = useExternalSharesForReview(status, page);
  const me = useAmplifyMe();
  const lookup = usePersonLookup();
  const awards = ownPostAwards(usePointValues().data);
  const myId = me.data?.employee.employeeId;
  const items = list.data?.items ?? [];

  // A decision moves the card off this list; when it was the last one on a later page, step back a page.
  const afterDecision = () => setPage((p) => (items.length === 1 && p > 0 ? p - 1 : p));

  if (list.isPending) return <Skeleton variant="rounded" height={180} />;
  if (list.isError) {
    return (
      <ErrorNotice error={list.error} onRetry={() => void list.refetch()} retrying={list.isFetching}>
        Couldn&apos;t load these posts.
      </ErrorNotice>
    );
  }
  // A later page can empty while it's open (another reviewer decided its posts); offer the way back.
  if (items.length === 0 && page > 0) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Typography variant="body2" color="text.secondary">
          This page is empty now.
        </Typography>
        <Button size="small" onClick={() => setPage(0)}>
          Back to the first page
        </Button>
      </Box>
    );
  }
  if (items.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {EMPTY_TEXT[status]}
      </Typography>
    );
  }
  return (
    <Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map((share) => (
          <ReviewCard
            key={share.id}
            share={share}
            who={lookup({ employeeId: share.employeeId, email: share.employeeEmail, displayName: share.employeeName })}
            awards={awards}
            isOwn={myId !== undefined && share.employeeId === myId}
            onDecided={afterDecision}
          />
        ))}
      </Box>
      {list.data.total > REVIEW_PAGE_SIZE && (
        <TablePagination
          component="div"
          count={list.data.total}
          page={page}
          rowsPerPage={REVIEW_PAGE_SIZE}
          rowsPerPageOptions={[REVIEW_PAGE_SIZE]}
          onPageChange={(_, p) => setPage(p)}
        />
      )}
    </Box>
  );
}

/** A check line under a waiting post's note. */
function Check({ children }: { children: string }) {
  return (
    <Box component="li" sx={{ display: "flex", alignItems: "center", gap: 0.75, color: "success.main", fontSize: 14 }}>
      <CheckIcon size={15} aria-hidden="true" />
      {children}
    </Box>
  );
}

/**
 * One claim: who sent it (with their team and location from the people directory), when, the link, their note, and
 * the decision buttons its status allows, each labelled with the points it awards. Decline opens a form in the card.
 */
function ReviewCard({
  share,
  who,
  awards,
  isOwn,
  onDecided,
}: {
  share: ExternalShare;
  who: ResolvedPerson;
  awards: OwnPostAwards;
  isOwn: boolean;
  onDecided: () => void;
}) {
  const approve = useApproveExternalShare();
  const feature = useFeatureExternalShare();
  const { showError, showSuccess } = useNotifications();
  const [working, setWorking] = useState(false);
  const [declining, setDeclining] = useState(false);
  // Approve and Feature award points at once, so each asks first: a stray click must not decide a post.
  const [confirming, setConfirming] = useState<"approve" | "feature" | null>(null);
  const known = who.name !== UNKNOWN_EMPLOYEE;
  const email = share.employeeEmail?.trim() || null;
  // Without a name, the work email is the next best way to say who sent it; the id only when there is neither.
  const name = known ? who.name : (email ?? "An employee");
  const where = [who.team, who.location].filter(Boolean).join(" · ");
  const target = { id: share.id, employeeId: share.employeeId };
  const open = share.status === "PENDING" || share.status === "APPROVED";
  const link = originOf(share.evidenceUrl) !== null ? share.evidenceUrl : null;

  const run = async (step: () => Promise<void>) => {
    setWorking(true);
    try {
      await step();
    } finally {
      setWorking(false);
    }
  };

  const approveOnly = () =>
    run(async () => {
      try {
        await approve.mutateAsync(target);
      } catch (err) {
        showError(describeAmplifyError(err));
        return;
      }
      showSuccess(`Approved: +${awards.approved} points for ${name}.`);
      onDecided();
    });

  // From Waiting: approve, then feature. The two are separate calls, so a failure after the approval says so.
  const approveAndFeature = () =>
    run(async () => {
      try {
        await approve.mutateAsync(target);
      } catch (err) {
        showError(describeAmplifyError(err));
        return;
      }
      onDecided();
      try {
        await feature.mutateAsync(target);
      } catch {
        showError(FEATURE_AFTER_APPROVE_FAILED);
        return;
      }
      showSuccess(`Featured: +${awards.featured} points for ${name}.`);
    });

  const featureApproved = () =>
    run(async () => {
      try {
        await feature.mutateAsync(target);
      } catch (err) {
        showError(describeAmplifyError(err));
        return;
      }
      showSuccess(`Featured: +${awards.topUp} more points for ${name}.`);
      onDecided();
    });

  return (
    <Paper
      variant="outlined"
      component="article"
      aria-label={`Post from ${name}`}
      sx={{ p: 2.5, borderRadius: 2, ...(declining && { borderColor: "error.light" }) }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: "wrap" }}>
        <Avatar src={who.photoUrl ?? undefined} alt="" sx={{ width: 44, height: 44, fontSize: 15 }}>
          {known ? initialsOf(who.name) : "?"}
        </Avatar>
        <Box sx={{ flex: "1 1 240px", minWidth: 0 }}>
          <Typography sx={{ overflowWrap: "anywhere" }}>
            <Box component="span" sx={{ fontWeight: 700, fontSize: 17 }}>
              {name}
              {isOwn && " (you)"}
            </Box>
            {where && (
              <Box component="span" sx={{ color: "text.secondary", fontSize: 14 }}>
                {" · "}
                {where}
              </Box>
            )}
          </Typography>
          {!known && !email && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", wordBreak: "break-all" }}>
              Employee ID: {share.employeeId}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            Submitted {submittedAt(share.createdAt)}
          </Typography>
        </Box>
        {link && (
          <Button
            variant="outlined"
            component="a"
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<ExternalLinkIcon size={15} aria-hidden="true" />}
          >
            {share.evidenceProvider === "linkedin" ? "Open on LinkedIn" : "Open the post"}
          </Button>
        )}
      </Box>

      {share.note?.trim() && (
        <Box
          aria-label="Note for the reviewer"
          sx={{ mt: 2, px: 2, py: 1.25, borderRadius: 2, bgcolor: "action.hover" }}
        >
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            <Box component="span" sx={{ color: "text.secondary" }}>
              Their note:{" "}
            </Box>
            {share.note}
          </Typography>
        </Box>
      )}

      {share.status === "PENDING" && !isOwn && !declining && (
        <Box component="ul" sx={{ listStyle: "none", p: 0, m: 0, mt: 1.5, display: "flex", gap: 3, flexWrap: "wrap" }}>
          <Check>First claim of this post</Check>
          <Check>Author certified they wrote it</Check>
        </Box>
      )}

      {share.status === "REJECTED" && share.decisionReason && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          Declined {fullDate(share.decidedAt)}: {share.decisionReason}
        </Typography>
      )}
      {share.status === "AMPLIFIED" && share.amplifiedAt && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          Featured {fullDate(share.amplifiedAt)}
        </Typography>
      )}
      {share.status === "APPROVED" && share.decidedAt && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          Approved {fullDate(share.decidedAt)}
        </Typography>
      )}

      {open && !declining && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", mt: 2 }}>
          {share.status === "PENDING" && (
            <Button variant="contained" onClick={() => setConfirming("approve")} disabled={working || isOwn}>
              Approve · +{awards.approved}
            </Button>
          )}
          <Button
            variant="outlined"
            color="warning"
            onClick={() => setConfirming("feature")}
            disabled={working || isOwn}
            sx={{ color: "warning.dark", bgcolor: (t) => alpha(t.palette.warning.main, 0.1) }}
          >
            Feature · +{share.status === "PENDING" ? awards.featured : awards.topUp}
          </Button>
          {share.status === "PENDING" && !isOwn && (
            <Button variant="outlined" color="error" onClick={() => setDeclining(true)} disabled={working}>
              Decline…
            </Button>
          )}
          {isOwn && (
            <Typography variant="body2" color="text.secondary">
              {OWN_CLAIM_NOTE}
            </Typography>
          )}
        </Box>
      )}

      <Dialog
        open={confirming !== null}
        onClose={working ? undefined : () => setConfirming(null)}
        maxWidth="xs"
        fullWidth
        aria-labelledby={`confirm-${share.id}`}
        slotProps={{ paper: { sx: dialogPaperSx } }}
      >
        <ClosableDialogTitle id={`confirm-${share.id}`} onClose={() => setConfirming(null)} disabled={working}>
          {confirming === "feature" ? "Feature this post?" : "Approve this post?"}
        </ClosableDialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {confirming === "feature"
              ? share.status === "PENDING"
                ? `It's approved and featured: ${name} gets +${awards.featured} points now.`
                : `${name} gets +${awards.topUp} more points now.`
              : `${name} gets +${awards.approved} points now.`}{" "}
            Points can only be taken back by a PO correction.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button variant="text" onClick={() => setConfirming(null)} disabled={working}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={confirming === "feature" ? "warning" : "primary"}
            disabled={working}
            onClick={() => {
              const step = confirming === "feature" ? (share.status === "PENDING" ? approveAndFeature : featureApproved) : approveOnly;
              setConfirming(null);
              void step();
            }}
          >
            {confirming === "feature"
              ? `Yes, feature · +${share.status === "PENDING" ? awards.featured : awards.topUp}`
              : `Yes, approve · +${awards.approved}`}
          </Button>
        </DialogActions>
      </Dialog>

      {declining && (
        <DeclineOwnPostForm
          share={share}
          firstName={known ? (who.name.split(/\s+/)[0] ?? null) : null}
          onClose={() => setDeclining(false)}
          onDeclined={onDecided}
        />
      )}
    </Paper>
  );
}
