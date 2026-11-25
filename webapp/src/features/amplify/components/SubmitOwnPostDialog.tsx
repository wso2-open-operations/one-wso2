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

import { useState, type ReactNode } from "react";
import { Link as RouterLink } from "react-router";
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  FormControlLabel,
  Link,
  TextField,
  Typography,
  alpha,
} from "@wso2/oxygen-ui";
import { CheckIcon } from "@wso2/oxygen-ui-icons-react";
import { dialogPaperSx } from "@components/confirmation-dialog/dialogPaperSx";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { AMPLIFY_MY_POINTS_PATH } from "@constants/perspectives";
import { usePointValues } from "../api/useAmplifyData";
import { useClaimOwnPost } from "../api/useAmplifyMutations";
import { describeAmplifyError } from "../util/amplifyError";
import { isLinkedInShortLink, ownPostEvidenceUrl } from "../util/linkedinPost";
import { OWN_POST_NOTE_MAX_LENGTH, ownPostAwards } from "../util/ownPosts";
import { ClosableDialogTitle } from "./ShareDialog";

/** The toast after a post is sent for review. */
export const OWN_POST_SUBMITTED_MESSAGE = "Thanks! Your post is waiting for review.";

/** Shown under the link once it looks like a LinkedIn post. */
export const LINK_LOOKS_RIGHT = "Looks like a LinkedIn post link";

/** How to find the link, under the field. */
export const LINK_HELP = "On LinkedIn, open the post's ••• menu and choose Copy link to post.";

/** The rule under What happens next. */
export const CLAIM_ONCE_NOTE = "Each post can be claimed once, by its author.";

const CERTIFY_LABEL = "I wrote this post myself, and it's about Choreo Labs.";

function linkProblem(link: string): string | null {
  const value = link.trim();
  if (!value || ownPostEvidenceUrl(value)) return null;
  if (isLinkedInShortLink(value)) return "Short lnkd.in links can't be checked. Open the post and copy its full link.";
  return "Paste the link to your LinkedIn post, like https://www.linkedin.com/posts/…";
}

/** One numbered step of What happens next. */
function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <Box component="li" sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
      <Box
        aria-hidden="true"
        sx={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 700,
          color: "primary.dark",
          bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
        }}
      >
        {n}
      </Box>
      <Typography variant="body2" sx={{ pt: 0.25 }}>
        {children}
      </Typography>
    </Box>
  );
}

/**
 * "Submit your own post": an employee sends the link to a LinkedIn post they wrote about Choreo Labs, with an
 * optional note for the reviewer, for the marketing team to review (POST /external-shares).
 */
export default function SubmitOwnPostDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const claim = useClaimOwnPost();
  const awards = ownPostAwards(usePointValues().data);
  const { showError, showSuccess } = useNotifications();
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [certified, setCertified] = useState(false);
  const [linkTouched, setLinkTouched] = useState(false);

  const evidenceUrl = ownPostEvidenceUrl(link);
  const problem = linkTouched ? linkProblem(link) : null;
  const busy = claim.isPending;
  const canSubmit = evidenceUrl !== null && certified && !busy;

  const close = () => {
    setLink("");
    setNote("");
    setCertified(false);
    setLinkTouched(false);
    onClose();
  };

  const submit = () => {
    if (!evidenceUrl || !certified) return;
    const reviewerNote = note.trim();
    claim.mutate(
      reviewerNote ? { evidenceUrl, certified: true, note: reviewerNote } : { evidenceUrl, certified: true },
      {
        onSuccess: () => {
          showSuccess(OWN_POST_SUBMITTED_MESSAGE);
          close();
        },
        onError: (err) => showError(describeAmplifyError(err)),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : close}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: { ...dialogPaperSx, borderRadius: 3 } } }}
    >
      <ClosableDialogTitle onClose={close} disabled={busy}>
        Submit your own post
      </ClosableDialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography color="text.secondary">
            Wrote a LinkedIn post about Choreo Labs? The marketing team reviews it and adds your points:{" "}
            <Box component="strong" sx={{ color: "text.primary" }}>
              +{awards.approved}
            </Box>{" "}
            when approved,{" "}
            <Box component="strong" sx={{ color: "text.primary" }}>
              +{awards.topUp} more
            </Box>{" "}
            if it&apos;s featured.
          </Typography>

          <Box>
            <Typography component="label" htmlFor="own-post-link" variant="body2" sx={{ fontWeight: 700, display: "block", mb: 0.75 }}>
              Link to your LinkedIn post
            </Typography>
            <TextField
              id="own-post-link"
              placeholder="https://www.linkedin.com/posts/…"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onBlur={() => setLinkTouched(true)}
              required
              fullWidth
              disabled={busy}
              error={problem !== null}
              slotProps={{ htmlInput: { inputMode: "url", autoComplete: "off", "aria-describedby": "own-post-link-help" } }}
            />
            <Box id="own-post-link-help" sx={{ mt: 0.75 }}>
              {problem ? (
                <Typography variant="body2" color="error">
                  {problem}
                </Typography>
              ) : (
                evidenceUrl && (
                  <Typography variant="body2" sx={{ color: "success.main", display: "flex", alignItems: "center", gap: 0.75 }}>
                    <CheckIcon size={15} aria-hidden="true" />
                    {LINK_LOOKS_RIGHT}
                  </Typography>
                )
              )}
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                {LINK_HELP}
              </Typography>
            </Box>
          </Box>

          <Box>
            <Typography component="label" htmlFor="own-post-note" variant="body2" sx={{ display: "block", mb: 0.75 }}>
              <Box component="span" sx={{ fontWeight: 700 }}>
                What&apos;s it about?
              </Box>{" "}
              <Box component="span" sx={{ color: "text.secondary" }}>
                (optional, helps the reviewer)
              </Box>
            </Typography>
            <TextField
              id="own-post-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              multiline
              minRows={2}
              maxRows={6}
              fullWidth
              disabled={busy}
              slotProps={{ htmlInput: { maxLength: OWN_POST_NOTE_MAX_LENGTH } }}
            />
          </Box>

          <Box sx={{ bgcolor: "action.hover", borderRadius: 2, px: 1.5, py: 1 }}>
            <FormControlLabel
              control={
                <Checkbox checked={certified} onChange={(e) => setCertified(e.target.checked)} disabled={busy} required />
              }
              label={CERTIFY_LABEL}
            />
          </Box>

          <Box component="section" aria-label="What happens next">
            <Typography
              component="h3"
              variant="overline"
              sx={{ fontWeight: 700, letterSpacing: "0.08em", color: "text.secondary", display: "block", mb: 1 }}
            >
              What happens next
            </Typography>
            <Box component="ol" sx={{ listStyle: "none", p: 0, m: 0, display: "flex", flexDirection: "column", gap: 1.25 }}>
              <Step n={1}>
                You&apos;ll see it in{" "}
                <Link component={RouterLink} to={AMPLIFY_MY_POINTS_PATH} onClick={close}>
                  My points &amp; Coins
                </Link>{" "}
                as <em>Waiting for review</em>.
              </Step>
              <Step n={2}>The marketing team approves, features or declines it, with a reason if declined.</Step>
              <Step n={3}>Approved points count toward your next Coins.</Step>
            </Box>
          </Box>

          <Typography variant="caption" color="text.secondary">
            {CLAIM_ONCE_NOTE}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={close} disabled={busy} color="inherit">
          Cancel
        </Button>
        <Button variant="contained" onClick={submit} disabled={!canSubmit}>
          {busy ? "Submitting…" : "Submit for review"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
