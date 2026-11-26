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
import { Box, Chip, Link, Paper, Typography } from "@wso2/oxygen-ui";
import type { Campaign } from "../api/amplifyTypes";
import { useAmplifyConfig } from "../api/useAmplifyData";
import { linkedInPostUrl } from "../util/linkedinPost";

// Choreo Labs logo, drawn inline so there is nothing to fetch. White on the black card.
function ChoreoLabsLogo() {
  return (
    <svg
      data-testid="default-post-image"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 844.97 887.42"
      fill="#fff"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", height: "80%", width: "auto", maxWidth: "80%", aspectRatio: "844.97 / 887.42" }}
    >
      <ellipse cx="710.09" cy="282.87" rx="134.88" ry="60.8" />
      <ellipse cx="629.81" cy="135.53" rx="129.85" ry="51.34" />
      <ellipse cx="470.02" cy="24.5" rx="141.63" ry="24.5" />
      <ellipse cx="710.09" cy="604.55" rx="134.88" ry="60.8" />
      <ellipse cx="629.81" cy="751.87" rx="129.85" ry="51.34" />
      <ellipse cx="470.02" cy="862.91" rx="141.63" ry="24.5" />
      <ellipse cx="134.88" cy="430.4" rx="134.88" ry="60.8" />
      <ellipse cx="181.78" cy="607.8" rx="110.13" ry="51.34" />
      <ellipse cx="181.78" cy="252.45" rx="110.13" ry="51.34" />
    </svg>
  );
}

// The post's own image, or the default when the URL is empty or fails to load.
function PostImage({ url }: { url?: string | null }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const useDefault = !url || failedUrl === url;
  const onError = () => {
    if (url && !useDefault) setFailedUrl(url);
  };
  if (useDefault) {
    // Logo sits at 80% of the frame, centred, so it never touches the edges.
    return (
      <Box sx={{ width: "100%", height: "100%", bgcolor: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <ChoreoLabsLogo />
      </Box>
    );
  }
  return (
    <Box
      component="img"
      src={url ?? undefined}
      alt=""
      loading="lazy"
      onError={onError}
      sx={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
}

function postDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/**
 * One post: headline, "Choreo Labs on LinkedIn · date", image, chips, the 2–3 line
 * summary, and an action button. Same card on Celebrate, Current Posts and the
 * share dialog; only the chips and the action differ (the dialog passes none).
 */
export default function PostCard({
  campaign,
  chips,
  action,
}: {
  campaign: Pick<Campaign, "resourceUrn" | "resourceUrl" | "title" | "opensAt" | "imageUrl" | "summary">;
  chips?: ReactNode;
  action?: ReactNode;
}) {
  const { campaignLinkOrigins } = useAmplifyConfig();
  return (
    <Paper variant="outlined" sx={{ p: 1.5, height: "100%", display: "flex", flexDirection: "column", gap: 1 }}>
      <Box sx={{ minWidth: 0 }}>
        <Link
          href={linkedInPostUrl(campaign.resourceUrn, campaign.resourceUrl, campaignLinkOrigins)}
          target="_blank"
          rel="noopener noreferrer"
          underline="hover"
          color="text.primary"
          sx={{ fontWeight: 700, fontSize: 14, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {campaign.title}
        </Link>
        <Typography variant="caption" color="text.secondary">
          Choreo Labs on LinkedIn · {postDate(campaign.opensAt)}
        </Typography>
      </Box>

      <Box sx={{ position: "relative", aspectRatio: "16 / 9", borderRadius: 1, overflow: "hidden", bgcolor: "common.black" }}>
        <PostImage url={campaign.imageUrl} />
      </Box>

      {chips && <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>{chips}</Box>}

      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", flexGrow: 1 }}
      >
        {campaign.summary || " "}
      </Typography>

      {action && <Box>{action}</Box>}
    </Paper>
  );
}

export function PriorityChip() {
  return <Chip size="small" color="primary" label="Priority" />;
}

export function CategoryChip({ label }: { label: string }) {
  return <Chip size="small" variant="outlined" color="primary" label={label} />;
}
