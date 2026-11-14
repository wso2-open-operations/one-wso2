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

import { Chip, Typography } from "@wso2/oxygen-ui";
import type { JSX } from "react";
import type { DeadlineHandler } from "@features/security/grc/modules/audit/types/audit";
import { deadlineHandlerLabel } from "@features/security/grc/modules/audit/utils/deadlines";

/** Small chip naming the group that holds the control now (Owner / Compliance / Auditor). */
export function HandlerChip({ handler }: { handler: DeadlineHandler }): JSX.Element {
  return (
    <Chip
      label={deadlineHandlerLabel(handler)}
      size="small"
      variant="outlined"
      sx={{ height: 20, fontSize: "0.68rem", fontWeight: 600 }}
    />
  );
}

/** Red "Delayed" badge; a dash for a control that is not delayed or not tracked. */
export function DelayedBadge({ delayed }: { delayed: boolean | null | undefined }): JSX.Element {
  if (!delayed) return <Typography variant="body2" color="text.secondary">—</Typography>;
  return (
    <Chip
      label="Delayed"
      size="small"
      variant="outlined"
      sx={{ height: 20, fontSize: "0.68rem", fontWeight: 600, color: "#dc2626", borderColor: "#dc2626" }}
    />
  );
}
