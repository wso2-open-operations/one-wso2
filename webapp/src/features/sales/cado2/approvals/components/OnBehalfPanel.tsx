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


import { useState, type JSX } from "react";
import { Box, Button, Stack, Typography } from "@wso2/oxygen-ui";
import type { ApprovalStep } from "@features/sales/cado2/approvals/api/approvalTypes";
import { useApproveOnBehalf } from "@features/sales/cado2/approvals/api/useApprovalApi";
import LifecycleDialog from "@features/sales/cado2/quotes/components/detail/LifecycleDialog";
import { useCado2Toast } from "@features/sales/cado2/components/toast/toastContext";
import { formatDate } from "@features/sales/cado2/quotes/form/draftForm";
import SlaChip from "./SlaChip";

interface OnBehalfPanelProps {
  readonly quoteId: number;
  readonly versionNumber: number;
  readonly steps: readonly ApprovalStep[];
}

/**
 * Deal Desk: approve a stuck step for its approver, who is away or not
 * responding (D120). Only the steps it's their turn on, never the CFO, the
 * CEO or Legal (the backend says which: canApproveOnBehalf). A reason is
 * required; the approver is told by email.
 */
export default function OnBehalfPanel({ quoteId, versionNumber, steps }: OnBehalfPanelProps): JSX.Element | null {
  const approve = useApproveOnBehalf();
  const notify = useCado2Toast();
  const [chosen, setChosen] = useState<ApprovalStep | null>(null);
  const stuck = steps.filter((s) => s.canApproveOnBehalf && s.stepId !== null);
  if (!stuck.length) return null;

  return (
    <Box sx={{ mb: 2, p: 1.5, borderRadius: 1.5, border: 1, borderColor: "divider" }} aria-label="Approve on behalf">
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        Is an approver away?
      </Typography>
      <Typography variant="body2" color="text.secondary">
        As Deal Desk you can approve on their behalf, with a reason. They are told by email. Not for the CFO, the CEO or
        Legal.
      </Typography>
      <Stack component="ul" spacing={1} sx={{ m: 0, mt: 1.5, p: 0, listStyle: "none" }}>
        {stuck.map((s) => (
          <Stack component="li" key={s.role} direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap", rowGap: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {s.roleLabel}
            </Typography>
            {s.requestedAt ? (
              <Typography variant="caption" color="text.secondary">
                waiting since {formatDate(s.requestedAt.slice(0, 10))}
              </Typography>
            ) : null}
            {s.slaState && s.dueAt ? <SlaChip state={s.slaState} dueAt={s.dueAt} /> : null}
            <Box sx={{ flexGrow: 1 }} />
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                approve.reset();
                setChosen(s);
              }}
            >
              Approve on behalf…
            </Button>
          </Stack>
        ))}
      </Stack>
      {chosen ? (
        <LifecycleDialog
          title={`Approve on behalf of ${chosen.roleLabel}?`}
          confirmLabel="Approve on behalf"
          reason="required"
          reasonLabel="Why are you approving for them?"
          pending={approve.isPending}
          error={approve.error}
          onClose={() => setChosen(null)}
          onConfirm={(reason) =>
            approve.mutate(
              { quoteId, version: versionNumber, stepId: chosen.stepId as number, reason },
              {
                onSuccess: () => {
                  notify(`Approved on behalf of ${chosen.roleLabel}.`);
                  setChosen(null);
                },
              },
            )
          }
        >
          {`Use this only when the ${chosen.roleLabel} can't act, for example because they're away. The approval is recorded as yours, on their behalf, with your reason, and the ${chosen.roleLabel} is told by email. The next approvers are asked straight away.`}
        </LifecycleDialog>
      ) : null}
    </Box>
  );
}
