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
import { Box, Button, Typography } from "@wso2/oxygen-ui";
import { SendIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import type { ExternalShare } from "../api/amplifyTypes";
import { useMyExternalShares } from "../api/useAmplifyData";
import { shortDate } from "../util/dashboardFormat";
import { AmplifyPanel } from "./AmplifyShell";
import { OwnPostLink, OwnPostStatusChip } from "./OwnPostParts";
import SubmitOwnPostDialog from "./SubmitOwnPostDialog";

/** How many of the caller's latest submissions the panel lists. */
export const OWN_POSTS_SHOWN = 5;

function SubmissionRow({ share }: { share: ExternalShare }) {
  return (
    <Box component="li" sx={{ py: 1, borderTop: "1px solid", borderColor: "divider" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Typography variant="body2" sx={{ minWidth: 56 }}>
          {shortDate(share.createdAt)}
        </Typography>
        <OwnPostStatusChip status={share.status} />
        <OwnPostLink share={share} />
      </Box>
      {share.status === "REJECTED" && share.decisionReason && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Reason: {share.decisionReason}
        </Typography>
      )}
    </Box>
  );
}

/**
 * Celebrate's "own post" prompt: a button that opens Submit your own post, and the caller's latest submissions with
 * where each one is.
 */
export default function OwnPostPanel() {
  const mine = useMyExternalShares();
  const [open, setOpen] = useState(false);
  const latest = (mine.data ?? []).slice(0, OWN_POSTS_SHOWN);

  return (
    <AmplifyPanel title="Your own posts">
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", justifyContent: "space-between" }}>
        <Typography variant="body2">
          Wrote your own LinkedIn post about Choreo Labs? Submit it for extra points.
        </Typography>
        <Button variant="outlined" size="small" startIcon={<SendIcon size={14} />} onClick={() => setOpen(true)}>
          Submit your own post
        </Button>
      </Box>
      {mine.isError ? (
        <ErrorNotice error={mine.error} onRetry={() => void mine.refetch()} sx={{ mt: 1.5 }}>
          Couldn&apos;t load the posts you submitted.
        </ErrorNotice>
      ) : (
        latest.length > 0 && (
          <Box component="ul" aria-label="Posts you submitted" sx={{ listStyle: "none", p: 0, m: 0, mt: 1.5 }}>
            {latest.map((share) => (
              <SubmissionRow key={share.id} share={share} />
            ))}
          </Box>
        )
      )}
      <SubmitOwnPostDialog open={open} onClose={() => setOpen(false)} />
    </AmplifyPanel>
  );
}
