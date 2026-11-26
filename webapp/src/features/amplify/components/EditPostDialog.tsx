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
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Switch,
  TextField,
} from "@wso2/oxygen-ui";
import { dialogPaperSx } from "@components/confirmation-dialog/dialogPaperSx";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { Campaign } from "../api/amplifyTypes";
import { useAmplifyConfig } from "../api/useAmplifyData";
import { useEditCampaign } from "../api/useAmplifyMutations";
import { describeAmplifyError } from "../util/amplifyError";
import { closesAtFromDateInput } from "../util/linkedinPost";
import { checkImageUrl } from "../util/imageUrlCheck";
import { makePostLinkChecker } from "../util/postIdCheck";
import { useUrlCheck } from "../util/useUrlCheck";
import CategoryPicker from "./CategoryPicker";
import DeletePostDialog from "./DeletePostDialog";
import ImagePreview from "./ImagePreview";
import UrlCheckField from "./UrlCheckField";

/**
 * Update Post: the card fields Amplify owns (headline, summary, post link, image,
 * category, priority, tracking end). The post itself is edited on LinkedIn.
 * Sends the version it read; a stale one comes back as VERSION_CONFLICT.
 *
 * Mount with a `key` per campaign so the form starts from that campaign.
 */
export default function EditPostDialog({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  const edit = useEditCampaign();
  const { showError, showSuccess } = useNotifications();
  const [title, setTitle] = useState(campaign.title);
  const [summary, setSummary] = useState(campaign.summary ?? "");
  const [imageUrl, setImageUrl] = useState(campaign.imageUrl ?? "");
  const [resourceUrl, setResourceUrl] = useState(campaign.resourceUrl ?? "");
  const [category, setCategory] = useState(campaign.categoryCode);
  const [isPriority, setIsPriority] = useState(campaign.isPriority);
  const [trackUntil, setTrackUntil] = useState(campaign.closesAt.slice(0, 10));
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // The stored image is checked as the dialog opens, and again whenever the box loses focus.
  const imageCheck = useUrlCheck(checkImageUrl, imageUrl, campaign.imageUrl ?? "");
  // Format only: a link on an allowed origin. The tick does not mean LinkedIn has the post.
  const { campaignLinkOrigins } = useAmplifyConfig();
  const postLinkChecker = useMemo(() => makePostLinkChecker(campaignLinkOrigins), [campaignLinkOrigins]);
  const postLinkCheck = useUrlCheck(postLinkChecker, resourceUrl, campaign.resourceUrl ?? "");
  const busy = edit.isPending;

  const save = () => {
    if (!title.trim()) return;
    edit.mutate(
      {
        id: campaign.id,
        patch: {
          version: campaign.version,
          title: title.trim(),
          summary: summary.trim(),
          imageUrl: imageUrl.trim() || undefined,
          // Sent only when it changed; blank clears the link (amplify-api validates the origin).
          resourceUrl: resourceUrl.trim() !== (campaign.resourceUrl ?? "") ? resourceUrl.trim() : undefined,
          categoryCode: category,
          isPriority,
          closesAt: closesAtFromDateInput(trackUntil),
        },
      },
      {
        onSuccess: () => {
          showSuccess("Post updated");
          onClose();
        },
        onError: (err) => showError(describeAmplifyError(err)),
      },
    );
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: dialogPaperSx } }}>
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>Update post</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            label="Headline"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            error={!title.trim()}
            fullWidth
            slotProps={{ htmlInput: { maxLength: 200 } }}
            disabled={busy}
          />
          {imageCheck.state === "ok" && <ImagePreview url={imageUrl.trim()} />}
          <TextField
            label="Card summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            multiline
            minRows={3}
            fullWidth
            slotProps={{ htmlInput: { maxLength: 2000 } }}
            disabled={busy}
          />
          <UrlCheckField
            label="Post URL"
            subject="Post URL"
            labels={{
              ok: "Post URL format is valid. This doesn't confirm the post exists on LinkedIn",
              bad: "Post URL format is not valid",
            }}
            placeholder="https://www.linkedin.com/feed/update/urn:li:share:…"
            value={resourceUrl}
            onChange={(e) => setResourceUrl(e.target.value)}
            urlCheck={postLinkCheck}
            hint="Checks the link format only, not that the post exists."
            slotProps={{ htmlInput: { maxLength: 2048 } }}
            disabled={busy}
          />
          <UrlCheckField
            label="Image URL (optional)"
            subject="Image URL"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            urlCheck={imageCheck}
            disabled={busy}
          />
          <CategoryPicker value={category} onChange={setCategory} disabled={busy} />
          <FormControlLabel
            control={<Switch checked={isPriority} onChange={(e) => setIsPriority(e.target.checked)} disabled={busy} />}
            label="Priority post (shown first and marked on every card)"
          />
          <TextField
            type="date"
            label="Track engagement until"
            value={trackUntil}
            onChange={(e) => setTrackUntil(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ maxWidth: 260 }}
            disabled={busy}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, justifyContent: "space-between" }}>
        <Button color="error" onClick={() => setConfirmingDelete(true)} disabled={busy}>
          Delete
        </Button>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="contained" onClick={save} disabled={busy || !title.trim()}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </Box>
      </DialogActions>
      {confirmingDelete && (
        <DeletePostDialog campaign={campaign} onCancel={() => setConfirmingDelete(false)} onDeleted={onClose} />
      )}
    </Dialog>
  );
}
