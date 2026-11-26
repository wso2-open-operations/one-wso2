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

import { useState, type FormEvent } from "react";
import { Alert, Box, Button, FormControlLabel, MenuItem, Switch, TextField, Typography } from "@wso2/oxygen-ui";
import { useNavigate } from "react-router";
import { AMPLIFY_CURRENT_POSTS_PATH } from "@constants/perspectives";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useAmplifyCategories, useAmplifyConfig } from "../api/useAmplifyData";
import { useRegisterCampaign } from "../api/useAmplifyMutations";
import AmplifyShell, { AmplifyPanel } from "../components/AmplifyShell";
import CategoryPicker from "../components/CategoryPicker";
import ImagePreview from "../components/ImagePreview";
import UrlCheckField from "../components/UrlCheckField";
import { describeAmplifyError } from "../util/amplifyError";
import { checkImageUrl } from "../util/imageUrlCheck";
import { POST_ID_HELP, checkPostIdFormat, postIdCheckKey } from "../util/postIdCheck";
import { useUrlCheck } from "../util/useUrlCheck";
import {
  DEFAULT_POST_KIND,
  POST_KINDS,
  closesAtFromDateInput,
  POST_PERMALINK_PREFIX,
  isPostKind,
  postPermalink,
  postRefFromPaste,
  postUrnFor,
  type PostKind,
} from "../util/linkedinPost";

// amplify-api's limits (CampaignDraft in openapi.yaml).
const TITLE_MAX = 200;
const SUMMARY_MAX = 2000;

// New Post: PO and Marketing register an official Choreo Labs LinkedIn post, with a
// category and a priority flag. Save & share now registers it and starts an
// Amplify run straight away. Only callers granted
// CAN_CAMPAIGN reach this page (AmplifyEditorRoute), and amplify-api
// refuses POST /campaigns from anyone else.
export default function NewPostPage() {
  const navigate = useNavigate();
  const register = useRegisterCampaign();
  const categories = useAmplifyCategories();
  const { showError, showSuccess } = useNotifications();

  const [postId, setPostId] = useState("");
  const [postKind, setPostKind] = useState<PostKind>(DEFAULT_POST_KIND);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [chosenCategory, setCategory] = useState("");
  const [isPriority, setIsPriority] = useState(false);
  const [trackUntil, setTrackUntil] = useState("");
  const [touched, setTouched] = useState(false);
  const imageCheck = useUrlCheck(checkImageUrl, imageUrl);
  const postIdKey = postIdCheckKey(postKind, postId);
  const postIdCheck = useUrlCheck(checkPostIdFormat, postIdKey);

  // The first category until one is chosen, so there is always a choice.
  const category = chosenCategory || categories.data?.[0]?.code || "";
  const { linkedinOrgUrn, campaignLinkOrigins } = useAmplifyConfig();
  const resourceUrn = postUrnFor(postKind, postId);
  const idError = touched && !resourceUrn;
  const titleError = touched && !title.trim();
  const orgConfigured = Boolean(linkedinOrgUrn);
  const valid = Boolean(resourceUrn) && Boolean(title.trim()) && Boolean(category);

  // Pasting a whole link or URN into the id box fills the kind list and keeps just the id.
  const onPostIdChange = (value: string) => {
    const pasted = /[:/]/.test(value) ? postRefFromPaste(value, campaignLinkOrigins) : null;
    if (pasted) {
      setPostKind(pasted.kind);
      setPostId(pasted.id);
      postIdCheck.check(postIdCheckKey(pasted.kind, pasted.id));
    } else {
      setPostId(value);
    }
  };

  const save = () => {
    setTouched(true);
    if (!valid || !resourceUrn) return;
    register.mutate(
      {
        shareNow: true,
        draft: {
          resourceUrn,
          ownerUrn: linkedinOrgUrn,
          // amplify-api reposts by the URN; the link is the permalink shown on the cards.
          resourceUrl: postPermalink(resourceUrn),
          title: title.trim(),
          summary: summary.trim() || undefined,
          imageUrl: imageUrl.trim() || undefined,
          categoryCode: category,
          isPriority,
          closesAt: closesAtFromDateInput(trackUntil),
        },
      },
      {
        onSuccess: (result) => {
          showSuccess(
            result?.run === "STARTED" ? "Saved. Sharing it now." : "Saved. It goes out with the next Amplify run.",
          );
          navigate(AMPLIFY_CURRENT_POSTS_PATH);
        },
        onError: (err) => showError(describeAmplifyError(err)),
      },
    );
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    save();
  };

  const busy = register.isPending;

  return (
    <AmplifyShell
      title="New Post"
      subtitle="Let Marketing and PO register official Choreo Labs LinkedIn posts, with a category and a priority flag."
    >
      {!orgConfigured && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Amplify doesn&apos;t have a LinkedIn company page configured yet (<code>WSO2ORGANIZATIONURN</code> on
          amplify-api), so posts can&apos;t be registered. Amplify only accepts posts from the Choreo Labs company page.
        </Alert>
      )}
      <Box component="form" noValidate onSubmit={onSubmit}>
        <AmplifyPanel title="LinkedIn post">
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, flexWrap: "wrap" }}>
              <Typography
                component="span"
                sx={{ fontFamily: "monospace", fontSize: "0.9rem", color: "text.secondary", pt: 2, whiteSpace: "nowrap" }}
              >
                {POST_PERMALINK_PREFIX}
              </Typography>
              <TextField
                select
                label="Post type"
                value={postKind}
                onChange={(e) => {
                  const next = e.target.value;
                  if (!isPostKind(next)) return;
                  setPostKind(next);
                  // A filled id is re-checked against the new type; an empty one stays quiet.
                  postIdCheck.check(postIdCheckKey(next, postId));
                }}
                sx={{ minWidth: 170 }}
                disabled={busy}
              >
                {POST_KINDS.map((kind) => (
                  <MenuItem key={kind} value={kind}>
                    {`urn:li:${kind}`}
                  </MenuItem>
                ))}
              </TextField>
              <Typography component="span" sx={{ pt: 2, color: "text.secondary" }}>
                :
              </Typography>
              <UrlCheckField
                label="Post ID"
                subject="Post ID"
                labels={{
                  ok: "Post ID format is valid. This doesn't confirm the post exists on LinkedIn",
                  bad: "Post ID format is not valid",
                }}
                placeholder="7123456789012345678"
                value={postId}
                onChange={(e) => onPostIdChange(e.target.value)}
                checkValue={postIdKey}
                urlCheck={postIdCheck}
                required
                errorText={idError && postIdCheck.state !== "bad" ? POST_ID_HELP : undefined}
                hint="Checks the format only, not that the post exists. Must be a post on the Choreo Labs company page."
                sx={{ flex: 1, minWidth: 220 }}
                disabled={busy}
              />
            </Box>
            <TextField
              label="Headline"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              fullWidth
              error={titleError}
              helperText={titleError ? "Give the post a headline." : "Shown on the Amplify cards."}
              slotProps={{ htmlInput: { maxLength: TITLE_MAX } }}
              disabled={busy}
            />
            {imageCheck.state === "ok" && <ImagePreview url={imageUrl.trim()} />}
            <TextField
              label="Card summary"
              placeholder="2-3 lines shown on the Amplify cards in One App and Google Chat"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              multiline
              minRows={3}
              fullWidth
              slotProps={{ htmlInput: { maxLength: SUMMARY_MAX } }}
              disabled={busy}
            />
            <UrlCheckField
              label="Image URL (optional)"
              subject="Image URL"
              placeholder="https://…"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              urlCheck={imageCheck}
              hint="An HTTPS link to the post's image."
              disabled={busy}
            />
          </Box>
        </AmplifyPanel>

        <AmplifyPanel title="Category">
          <CategoryPicker value={category} onChange={setCategory} disabled={busy} />
          <Typography
            component="h2"
            variant="overline"
            sx={{ display: "block", fontWeight: 700, letterSpacing: "0.08em", color: "text.secondary", mt: 3 }}
          >
            Priority
          </Typography>
          <FormControlLabel
            control={<Switch checked={isPriority} onChange={(e) => setIsPriority(e.target.checked)} disabled={busy} />}
            label="Priority post (shown first and marked on every card)"
          />
          <TextField
            type="date"
            label="Track engagement until"
            value={trackUntil}
            onChange={(e) => setTrackUntil(e.target.value)}
            helperText="Defaults to 30 days after the post date."
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ mt: 2, display: "flex", maxWidth: 260 }}
            disabled={busy}
          />
        </AmplifyPanel>

        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", gap: 1.5 }}>
          <Button type="submit" variant="contained" disabled={busy || !orgConfigured}>
            {busy ? "Saving…" : "Save & share now"}
          </Button>
        </Box>
      </Box>
    </AmplifyShell>
  );
}
