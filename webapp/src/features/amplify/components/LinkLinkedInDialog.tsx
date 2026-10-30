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
import { Box, Button, Dialog, DialogContent, Link, TextField, Typography } from "@wso2/oxygen-ui";
import { LinkIcon, LinkedinIcon } from "@wso2/oxygen-ui-icons-react";
import { dialogPaperSx } from "@components/confirmation-dialog/dialogPaperSx";
import { amplifyPrivacyNoticeUrl } from "@config/apiConfig";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useDeclineLinkedInConsent, useStartLinkedInConnect } from "../api/useAmplifyMutations";
import { describeAmplifyError } from "../util/amplifyError";
import { isAllowedLink } from "../util/linkedinPost";
import { isLinkedInProfileUrl } from "../util/linkedinProfile";

/**
 * The "Link Your LinkedIn Account" popup an unlinked Amplify click opens. It asks for consent first.
 *
 * "I consent" asks amplify-api for a LinkedIn consent URL and sends the browser there. LinkedIn comes back to
 * /amplify/connect/callback, which finishes the link and returns to `returnTo` with the post's share dialog open.
 *
 * "I don't consent" switches to a second step: the employee shares from their own LinkedIn and gives their profile
 * URL so WSO2 can track it. No link or token is created. `onDeclined` (Next after saving, or Back) closes every popup and returns to
 * Celebrate. The popup opens again on the next unlinked click.
 */
export default function LinkLinkedInDialog({
  open,
  onClose,
  onDeclined,
  returnTo,
  pendingCampaignId,
  reconnect = false,
}: {
  open: boolean;
  onClose: () => void;
  /** Leave the decline step (Next after saving, or Back): close every popup. Defaults to `onClose`. */
  onDeclined?: () => void;
  returnTo: string;
  pendingCampaignId?: string;
  reconnect?: boolean;
}) {
  const start = useStartLinkedInConnect();
  const decline = useDeclineLinkedInConsent();
  const { showError } = useNotifications();
  const [declined, setDeclined] = useState(false);
  const [profileUrl, setProfileUrl] = useState("");
  const busy = start.isPending || decline.isPending;
  const trimmedUrl = profileUrl.trim();
  const urlInvalid = trimmedUrl.length > 0 && !isLinkedInProfileUrl(trimmedUrl);

  const reset = () => {
    setDeclined(false);
    setProfileUrl("");
  };

  // Leaving the decline step in either direction lands on Celebrate.
  const leaveDecline = () => {
    reset();
    (onDeclined ?? onClose)();
  };

  const consent = () => {
    start.mutate(
      { returnTo, pendingCampaignId },
      {
        onSuccess: (auth) => {
          // Only ever follow a LinkedIn (or, in dev, the listed mock) sign-in page.
          if (auth?.authorizationUrl && isAllowedLink(auth.authorizationUrl)) window.location.assign(auth.authorizationUrl);
          else showError("Something went wrong, please try again.");
        },
        onError: (err) => showError(describeAmplifyError(err)),
      },
    );
  };

  const saveProfileUrl = () => {
    decline.mutate(
      { profileUrl: trimmedUrl || undefined },
      {
        onSuccess: leaveDecline,
        onError: (err) => showError(describeAmplifyError(err)),
      },
    );
  };

  const privacyNotice = amplifyPrivacyNoticeUrl ? (
    <Link href={amplifyPrivacyNoticeUrl} target="_blank" rel="noopener noreferrer">
      WSO2 Employee Privacy Notice
    </Link>
  ) : (
    "WSO2 Employee Privacy Notice"
  );

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : declined ? leaveDecline : onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{ paper: { sx: { ...dialogPaperSx, borderColor: "primary.main" } } }}
      aria-labelledby="amplify-link-title"
    >
      <DialogContent>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 1.5 }}>
          <Box sx={{ color: "primary.main", display: "flex" }}>
            <LinkedinIcon size={22} aria-hidden />
          </Box>
          <Typography id="amplify-link-title" component="h2" sx={{ fontWeight: 700 }}>
            {reconnect ? "Link Your LinkedIn Account Again" : "Link Your LinkedIn Account"}
          </Typography>
        </Box>
        {declined ? (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              I&apos;ll share WSO2 content directly from my LinkedIn account, without connecting my account to the
              Amplify App. I&apos;m sharing my LinkedIn profile URL so WSO2 can track my sharing efforts.
            </Typography>
            <TextField
              label="LinkedIn profile URL (optional)"
              placeholder="https://www.linkedin.com/in/your-name"
              value={profileUrl}
              onChange={(e) => setProfileUrl(e.target.value)}
              error={urlInvalid}
              helperText={urlInvalid ? "Use your profile address, like https://www.linkedin.com/in/your-name" : " "}
              fullWidth
              size="small"
              disabled={busy}
              slotProps={{ htmlInput: { maxLength: 255 } }}
              sx={{ mb: 1 }}
            />
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                variant="contained"
                onClick={saveProfileUrl}
                disabled={busy || urlInvalid}
              >
                {decline.isPending ? "Saving…" : "Next"}
              </Button>
              <Button onClick={leaveDecline} disabled={busy}>
                Back
              </Button>
            </Box>
          </>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {reconnect ? "Your LinkedIn link has expired. " : ""}
              By using the Amplify App, I agree to connect my LinkedIn profile with WSO2 so I can share WSO2 content
              with my LinkedIn connections and followers.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              I understand that WSO2 will use the Amplify App to track the reach and engagement of content shared
              through the app.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              To learn more about how WSO2 collects and uses my personal information, please read the{" "}
              {privacyNotice}.
            </Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button variant="contained" startIcon={<LinkIcon size={16} />} onClick={consent} disabled={busy}>
                {start.isPending ? "Opening LinkedIn…" : "I consent"}
              </Button>
              <Button onClick={() => setDeclined(true)} disabled={busy}>
                I don&apos;t consent
              </Button>
            </Box>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
