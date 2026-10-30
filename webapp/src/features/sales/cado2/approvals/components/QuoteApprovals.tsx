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

import type { JSX } from "react";
import { Alert, Box, CircularProgress, Typography } from "@wso2/oxygen-ui";
import { ShieldCheckIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import StatusChip from "@features/sales/cado2/components/status-chip/StatusChip";
import SectionCard from "@features/sales/cado2/components/section-card/SectionCard";
import type { ApprovalPreview, ApprovalWorkflow } from "@features/sales/cado2/approvals/api/approvalTypes";
import { WORKFLOW_STATUS } from "@features/sales/cado2/approvals/model/approvalText";
import LazyApprovalDiagram from "./LazyApprovalDiagram";
import ApprovalPreviewPanel from "./ApprovalPreviewPanel";
import OnBehalfPanel from "./OnBehalfPanel";

interface QuoteApprovalsProps {
  /** A draft shows what it would need; a submitted version its workflow. */
  readonly isDraft: boolean;
  readonly workflow: { data: ApprovalWorkflow | null | undefined; isPending: boolean; error: Error | null; refetch: () => void };
  readonly preview: { data: ApprovalPreview | undefined; isPending: boolean; isFetching: boolean; error: Error | null };
  /** The version shown, for Deal Desk approving on someone's behalf (D120). */
  readonly quoteId: number;
  readonly versionNumber: number;
}

/** The quote page's Approvals tab. */
export default function QuoteApprovals({ isDraft, workflow, preview, quoteId, versionNumber }: QuoteApprovalsProps): JSX.Element {
  if (isDraft) {
    return <ApprovalPreviewPanel preview={preview.data} loading={preview.isFetching} error={preview.error} />;
  }
  if (workflow.isPending) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
        <CircularProgress aria-label="Loading the approvals" />
      </Box>
    );
  }
  if (workflow.error) {
    return (
      <ErrorNotice error={workflow.error} onRetry={workflow.refetch}>
        Couldn&apos;t load the approvals.
      </ErrorNotice>
    );
  }
  const wf = workflow.data;
  if (!wf) {
    return <Alert severity="info">This version was submitted before approvals were tracked in QuickQuote.</Alert>;
  }
  const status = WORKFLOW_STATUS[wf.status];
  return (
    <SectionCard
      title="Approvals"
      icon={<ShieldCheckIcon size={18} />}
      aside={<StatusChip color={status.color} label={status.label} />}
    >
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Worked out from this exact version when it was submitted. Deal Desk goes first; the discount and commercial
        approvals then run in parallel. Click a role to see why it is needed.
      </Typography>
      <OnBehalfPanel quoteId={quoteId} versionNumber={versionNumber} steps={wf.steps} />
      <LazyApprovalDiagram steps={wf.steps} />
    </SectionCard>
  );
}
