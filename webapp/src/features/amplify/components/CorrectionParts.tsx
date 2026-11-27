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

import { Box, Typography } from "@wso2/oxygen-ui";
import { effectPreview, signedPoints } from "../util/points";

/** Where a correction's reason ends up. */
export const REASON_SHOWN_NOTE = "Your reason is shown in the person's history.";

/**
 * What a correction does to a person's all-time total, e.g. "1,040 → 1,038". With no known total, only the change.
 */
export function CorrectionEffect({ total, change }: { total: number | null; change: number | null }) {
  if (change === null) return null;
  return (
    <Box role="status" sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, px: 1.5, py: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
        All-time points
      </Typography>
      <Typography sx={{ fontWeight: 600 }}>
        {total === null ? `${signedPoints(change)} points` : effectPreview(total, change)}
      </Typography>
    </Box>
  );
}
