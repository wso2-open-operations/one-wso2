/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { Box, Drawer, IconButton, Stack, Typography } from "@wso2/oxygen-ui";
import { ReceiptTextIcon, UserRoundIcon, UsersIcon, XIcon, type LucideIcon } from "@wso2/oxygen-ui-icons-react";
import { StatusChip, expenseStatusMeta } from "../../components/FinanceChips";
import { approvalDateTime } from "./expenseApprovalFormat";
import { onBehalfOfParty, type ApprovalClaim } from "./expenseApprovalTypes";

/**
 * CustomTimelineItem.tsx — the claim's two-stage review, opened from the status
 * chip once a claim has been decided. For a lead this is the only place their
 * own rejection reason is legible after the fact; the backend carries no
 * finance equivalent, so a finance rejection shows a date and never a reason.
 *
 * Laid out by hand (dot + connector) because `@mui/lab` is not a dependency
 * here. The claim-history port draws the same three stages; when that branch
 * lands the two should become one component.
 */

type StageTone = "success" | "warning" | "error" | "idle";

const TONE_COLOR: Record<StageTone, string> = {
  success: "success.main",
  warning: "warning.main",
  error: "error.main",
  idle: "grey.400",
};

interface Stage {
  label: string;
  Icon: LucideIcon;
  date: string | null;
  statusLabel?: "Pending" | "Approved" | "Rejected";
  tone: StageTone;
  reason?: string | null;
  note?: string | null;
}

/**
 * Derived during render rather than in a mount-only effect the way the source
 * does it (`CustomTimelineItem.tsx:53`): one drawer instance outlives several
 * claims, so colours computed once on mount would describe whichever claim
 * happened to be open first.
 */
function claimStages(
  claim: ApprovalClaim,
  nameFor: (email: string | null | undefined) => string,
  viewerEmail: string | undefined,
): Stage[] {
  const s = claim.statusDetails;
  const status = s.status;
  const party = onBehalfOfParty(claim, viewerEmail);

  const submission: Stage = {
    label: "Claim Submission",
    Icon: ReceiptTextIcon,
    date: claim.createdDate,
    tone: "success",
    note: party ? `${party.label} ${nameFor(party.email)}` : null,
  };

  const lead: Stage =
    status === "PENDING_LEAD"
      ? { label: "Lead Review", Icon: UserRoundIcon, date: null, tone: "warning", statusLabel: "Pending" }
      : status === "LEAD_REJECTED"
        ? {
            label: "Lead Review",
            Icon: UserRoundIcon,
            date: s.leadRejectedDate,
            tone: "error",
            statusLabel: "Rejected",
            reason: s.leadRejectedReason,
          }
        : {
            label: "Lead Review",
            Icon: UserRoundIcon,
            // `leadApprovedDate || leadRejectedDate` — a claim that was
            // rejected, corrected and then passed carries only the latter.
            date: s.leadApprovedDate || s.leadRejectedDate,
            tone: "success",
          };

  const finance: Stage =
    status === "PENDING_FINANCE"
      ? { label: "Finance Review", Icon: UsersIcon, date: null, tone: "warning", statusLabel: "Pending" }
      : status === "FINANCE_REJECTED"
        ? {
            label: "Finance Review",
            Icon: UsersIcon,
            date: s.financeRejectedDate,
            tone: "error",
            statusLabel: "Rejected",
          }
        : status === "APPROVED"
          ? {
              label: "Finance Review",
              Icon: UsersIcon,
              date: s.financeApprovedDate || s.financeRejectedDate,
              tone: "success",
              statusLabel: "Approved",
            }
          : // Not reached finance yet — still with the lead, or lead-rejected.
            { label: "Finance Review", Icon: UsersIcon, date: null, tone: "idle" };

  return [submission, lead, finance];
}

export function ExpenseApprovalActivity({
  claim,
  nameFor,
  viewerEmail,
  onClose,
}: {
  claim: ApprovalClaim | null;
  nameFor: (email: string | null | undefined) => string;
  viewerEmail: string | undefined;
  onClose: () => void;
}) {
  const meta = expenseStatusMeta(claim?.statusDetails.status);
  return (
    <Drawer
      anchor="right"
      open={Boolean(claim)}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: 350, maxWidth: "100vw" } } }}
    >
      {claim && (
        <Box sx={{ p: 2.5 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
            <Typography sx={{ fontSize: 17, fontWeight: 700, flex: 1 }}>Claim Activity</Typography>
            <IconButton size="small" onClick={onClose} aria-label="Close claim activity">
              <XIcon size={17} />
            </IconButton>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
            <Typography sx={{ fontSize: 12.5, fontFamily: "monospace", color: "text.secondary" }}>
              {claim.id}
            </Typography>
            <StatusChip label={meta.label} color={meta.color} />
          </Stack>

          <Stack spacing={0}>
            {claimStages(claim, nameFor, viewerEmail).map((stage, i, all) => (
              <Box key={stage.label} sx={{ display: "flex", gap: 1.5 }}>
                <Stack alignItems="center">
                  <Box
                    sx={{
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1.5px solid",
                      borderColor: TONE_COLOR[stage.tone],
                      color: TONE_COLOR[stage.tone],
                      flexShrink: 0,
                    }}
                  >
                    <stage.Icon size={15} />
                  </Box>
                  {i < all.length - 1 && (
                    <Box sx={{ width: 2, flex: 1, minHeight: 40, bgcolor: "divider", my: 0.5 }} />
                  )}
                </Stack>

                <Box sx={{ pb: 3, pt: 0.4, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: TONE_COLOR[stage.tone] }}>
                    {stage.label}
                    {stage.statusLabel && (
                      <Typography component="span" sx={{ fontSize: 11.5, fontWeight: 500, ml: 0.5 }}>
                        ({stage.statusLabel})
                      </Typography>
                    )}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                    {stage.date ? approvalDateTime(stage.date) : "—"}
                  </Typography>
                  {stage.note && (
                    <Typography sx={{ fontSize: 11.5, color: "text.secondary", mt: 0.25 }}>
                      {stage.note}
                    </Typography>
                  )}
                  {stage.reason && (
                    <Typography sx={{ fontSize: 12, mt: 0.5, wordBreak: "break-word" }}>
                      <Typography component="span" sx={{ fontWeight: 600 }}>
                        Reason:
                      </Typography>{" "}
                      {stage.reason}
                    </Typography>
                  )}
                </Box>
              </Box>
            ))}
          </Stack>
        </Box>
      )}
    </Drawer>
  );
}
