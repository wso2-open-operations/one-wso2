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

import { useMemo } from "react";
import { Box, Button, Card, Chip, Stack, Tooltip, Typography } from "@wso2/oxygen-ui";
import { FileDownIcon } from "@wso2/oxygen-ui-icons-react";
import type { ParCycle, ParRating } from "../api/types";
import { decodeParComment } from "../util/parComment";
import { ParCommentView, ParQuestionText } from "./ParContent";
import { employeeChipLabel } from "../util/parLabels";
import { downloadParPdf } from "../util/parPdf";
import { useLeaveEmployees } from "@features/leave/api/useLeaveData";
import { employeeDisplayName } from "@features/leave/util/employeeName";

// The read-only view of one cycle's record from the employee's side: their
// own submitted comment, and — once the lead has shared — the lead's
// feedback (rating, special rating, shared-by, comment), plus a PDF export.
// Mirrors par-app's EmployeePar.tsx. Used by both the locked self-review
// tab and History's detail view.
export default function ParRatingSummary({
  cycle,
  rating,
}: {
  cycle: Pick<ParCycle, "parCycleConfigurations">;
  rating: ParRating;
}) {
  const selfComment = decodeParComment(rating.parEmployeeComment);
  // Presence, not parLeadStatus, is the visibility rule here: the backend's
  // sanitizeParRatingForSelf strips these three fields from the response
  // entirely while the lead's status is PENDING/DRAFT, so a lead comment
  // showing up at all already means it was shared.
  const leadShared = Boolean(rating.parLeadComment || rating.parRating);
  const leadComment = decodeParComment(rating.parLeadComment);

  // "Shared by" is an email address on the wire — resolve it to the lead's
  // name the same way ParLead360ReviewsTab.tsx does, rather than showing the
  // raw address.
  const employees = useLeaveEmployees();
  const nameByEmail = useMemo(
    () => new Map(employees.data?.map((e) => [e.workEmail, employeeDisplayName(e)]) ?? []),
    [employees.data],
  );
  // NOT_ASSIGNED's generic "Not Assigned" label reads fine next to "PAR
  // rating:", but standing alone on the special-rating chip it doesn't say
  // what isn't assigned — spell that out instead of the bare label.
  const specialRatingLabel =
    rating.parSpecialRating === "NOT_ASSIGNED"
      ? "No Top 5%/20% Rating"
      : employeeChipLabel(rating.parSpecialRating ?? "").label;

  return (
    <Stack spacing={1.75}>
      {leadShared && (
        <Card variant="outlined" sx={{ p: 2 }}>
          <Typography sx={{ fontWeight: 600, mb: 1 }}>Lead's feedback</Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: "wrap" }}>
            {rating.parRating && (
              <Chip
                size="small"
                variant="outlined"
                color={employeeChipLabel(rating.parRating).color}
                label={`PAR rating: ${employeeChipLabel(rating.parRating).label}`}
              />
            )}
            {rating.parSpecialRating && (
              <Chip size="small" variant="outlined" color={employeeChipLabel(rating.parSpecialRating).color} label={specialRatingLabel} />
            )}
            {rating.parRatingSharedBy && (
              <Chip size="small" variant="outlined" label={`Shared by ${nameByEmail.get(rating.parRatingSharedBy) ?? rating.parRatingSharedBy}`} />
            )}
            {rating.parRatingUpdatedBy === "SYSTEM" && (
              <Tooltip title="Automatically assigned by the system because the PAR deadline was missed">
                <Chip size="small" color="warning" variant="outlined" label="Auto-assigned (deadline missed)" />
              </Tooltip>
            )}
          </Stack>
          <ParCommentView html={leadComment} />
        </Card>
      )}

      <Card variant="outlined" sx={{ p: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
          <ParQuestionText
            html={cycle.parCycleConfigurations?.employeeParQuestion}
            fallback="Employee feedback"
          />
          <Button
            size="small"
            variant="outlined"
            startIcon={<FileDownIcon size={14} />}
            onClick={() => downloadParPdf(rating, selfComment, leadComment)}
            sx={{ flexShrink: 0, ml: 1.5 }}
          >
            Download PDF
          </Button>
        </Box>
        <ParCommentView html={selfComment} />
      </Card>
    </Stack>
  );
}
