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
import { PencilIcon } from "@wso2/oxygen-ui-icons-react";
import { usePointValues } from "../api/useAmplifyData";
import { ownPostAwards } from "../util/ownPosts";
import SubmitOwnPostDialog from "./SubmitOwnPostDialog";
import { AMPLIFY_RADIUS } from "../util/radius";

/**
 * Celebrate's own-post prompt: "Wrote your own post about Choreo Labs?", the points an approved and a featured post
 * earn (GET /point-values), and Submit your post, which opens Submit your own post. Where each submission is shows
 * on My points & Coins.
 */
export default function OwnPostPanel() {
  const awards = ownPostAwards(usePointValues().data);
  const [open, setOpen] = useState(false);

  return (
    <Box
      component="section"
      aria-label="Your own post"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2.5,
        flexWrap: { xs: "wrap", sm: "nowrap" },
        border: "1px solid",
        borderColor: "divider",
        borderRadius: AMPLIFY_RADIUS,
        p: 2.5,
        mb: 3,
      }}
    >
      <Box sx={{ color: "primary.dark", display: "inline-flex", flexShrink: 0 }} aria-hidden="true">
        <PencilIcon size={30} />
      </Box>
      <Box sx={{ flex: "1 1 240px", minWidth: 0 }}>
        <Typography component="h2" sx={{ fontWeight: 700, fontSize: 17 }}>
          Wrote your own post about Choreo Labs?
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Submit it for review. Approved posts earn{" "}
          <Box component="strong" sx={{ color: "text.primary" }}>
            +{awards.approved}
          </Box>
          , and{" "}
          <Box component="strong" sx={{ color: "text.primary" }}>
            +{awards.topUp} more
          </Box>{" "}
          if the marketing team features it.
        </Typography>
      </Box>
      <Button variant="outlined" onClick={() => setOpen(true)} sx={{ flexShrink: 0 }}>
        Submit your post
      </Button>
      <SubmitOwnPostDialog open={open} onClose={() => setOpen(false)} />
    </Box>
  );
}
