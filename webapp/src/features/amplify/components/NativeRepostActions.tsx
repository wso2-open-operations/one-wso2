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

import type { ReactNode } from "react";
import { Box, Button, Link, Typography, alpha, type Theme } from "@wso2/oxygen-ui";
import { CircleAlertIcon, CircleCheckIcon, ClockIcon } from "@wso2/oxygen-ui-icons-react";
import { LinkedinIcon } from "@components/icons/LinkedinIcon";
import type { Campaign } from "../api/amplifyTypes";
import { useOpenOnLinkedIn } from "../api/useOpenOnLinkedIn";
import { foundRepostText, type NativeRepostState } from "../util/nativeRepost";

type RepostTarget = Pick<Campaign, "id" | "resourceUrn" | "resourceUrl">;

type NoticeTone = "primary" | "success";

/** The soft box a card shows in place of its buttons once the post was opened on LinkedIn. */
function Notice({
  tone,
  icon,
  title,
  children,
}: {
  tone: NoticeTone;
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <Box
      role="status"
      sx={{
        display: "flex",
        gap: 1.25,
        border: "1px solid",
        borderRadius: 2,
        px: 1.5,
        py: 1.25,
        bgcolor: (t: Theme) => alpha(t.palette[tone].main, 0.07),
        borderColor: (t: Theme) => alpha(t.palette[tone].main, 0.3),
      }}
    >
      <Box sx={{ color: `${tone}.main`, pt: 0.25, display: "flex", flexShrink: 0 }}>
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{title}</Typography>
        {children}
      </Box>
    </Box>
  );
}

/**
 * A post card's actions when "Repost on LinkedIn" is on (designs 01 and 01b):
 *  - not opened yet: "Repost on LinkedIn" (the post opens on LinkedIn) above "Post it for me";
 *  - LOOKING (under 24 hours): "Looking for your repost", with a link to open LinkedIn again;
 *  - DETECTED: "Found your repost · +N";
 *  - NOT_FOUND (after 24 hours): "We couldn't find your repost", with "Open LinkedIn again" and "Post it for me".
 */
export default function NativeRepostActions({
  campaign,
  state,
  foundPoints,
  onPostForMe,
}: {
  campaign: RepostTarget;
  state: NativeRepostState;
  /** What the found repost earned (the intent's `points`), for "Found your repost · +N"; unknown until it is scored. */
  foundPoints?: number;
  onPostForMe: () => void;
}) {
  const { open, busy } = useOpenOnLinkedIn();
  const openAgain = () => open(campaign);

  if (state === "LOOKING") {
    return (
      <Notice tone="primary" icon={<ClockIcon size={16} aria-hidden />} title="Looking for your repost">
        <Typography variant="body2" color="text.secondary">
          We count it within 24 hours. Didn&apos;t repost?{" "}
          <Link component="button" type="button" onClick={openAgain} disabled={busy} sx={{ fontSize: "inherit", verticalAlign: "baseline" }}>
            Open LinkedIn again
          </Link>
        </Typography>
      </Notice>
    );
  }

  if (state === "DETECTED") {
    return (
      <Notice tone="success" icon={<CircleCheckIcon size={16} aria-hidden />} title={foundRepostText(foundPoints)}>
        <Typography variant="body2" color="text.secondary">
          Amplify found it on LinkedIn and added your points.
        </Typography>
      </Notice>
    );
  }

  if (state === "NOT_FOUND") {
    return (
      <Notice tone="primary" icon={<CircleAlertIcon size={16} aria-hidden />} title="We couldn't find your repost">
        <Typography variant="body2" color="text.secondary">
          It&apos;s been 24 hours. Try once more, or let Amplify post it.
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1, mt: 1.25 }}>
          <Button variant="contained" size="small" onClick={openAgain} disabled={busy}>
            Open LinkedIn again
          </Button>
          <Button variant="outlined" size="small" onClick={onPostForMe}>
            Post it for me
          </Button>
        </Box>
      </Notice>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1.25 }}>
      <Button variant="contained" fullWidth startIcon={<LinkedinIcon size={16} />} onClick={openAgain} disabled={busy}>
        Repost on LinkedIn
      </Button>
      <Button variant="outlined" onClick={onPostForMe}>
        Post it for me
      </Button>
    </Box>
  );
}
