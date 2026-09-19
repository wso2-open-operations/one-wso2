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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import type { ReactNode } from "react";
import { Alert, Button, DataGrid, Link, Paper, Stack, Typography } from "@wso2/oxygen-ui";
import type { UmtUpdateSummary } from "../../../api/umtUpdates";
import { useUmtGate } from "../../../api/useUmtGate";
import { useUmtPullRequestAnalysis } from "../../../api/useUmtUpdateViewData";

const { DataGrid: DataGridComponent } = DataGrid;

// A read-only review of the additional files PR Analysis found but couldn't
// confirm belong in the product pack — there's no dedicated "approve"
// endpoint. The shell's shared Proceed bar (real transition, "Approve and
// Proceed" label, role-gated to UMT_ADMIN/PRODUCT_LEAD) is what actually
// promotes the update; this component only needs to show what's being approved.
export default function UmtFileApprovalStep({ id, update }: { id: string; update: UmtUpdateSummary }) {
  const gate = useUmtGate();
  const pullRequestAnalysis = useUmtPullRequestAnalysis(id, update.lifecycleState);

  if (pullRequestAnalysis.isPending) {
    return (
      <Typography variant="body2" color="text.secondary">
        Loading files awaiting approval…
      </Typography>
    );
  }

  if (pullRequestAnalysis.isError) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={() => void pullRequestAnalysis.refetch()}>
            Retry
          </Button>
        }
      >
        Failed to load the files awaiting approval.
      </Alert>
    );
  }

  const rows = (pullRequestAnalysis.data?.additionalFileOperations ?? []).map((row, index) => ({
    id: `${row.file ?? "file"}-${index}`,
    file: row.file,
    operation: row.operation,
    downloadURL: row.downloadURL,
  }));

  return (
    <Stack spacing={3}>
      <Typography variant="h5">Manual File Approval</Typography>
      <Typography variant="body1">
        This update contains manual files that were uploaded by the developer and require approval before it
        can be promoted further.
      </Typography>

      <Paper variant="outlined" sx={{ minWidth: 0, overflow: "hidden" }}>
        <DataGridComponent
          autoHeight
          columnHeaderHeight={40}
          disableColumnMenu
          disableRowSelectionOnClick
          getRowHeight={() => "auto"}
          hideFooter
          rows={rows}
          aria-label="Files awaiting approval"
          sx={denseDataGridSx}
          columns={[
            {
              field: "file",
              headerName: "Files",
              flex: 3,
              sortable: false,
              renderCell: (params) => <CellCenter>{displayValue(params.row.file)}</CellCenter>,
            },
            {
              field: "operation",
              headerName: "Operation",
              flex: 1,
              sortable: false,
              renderCell: (params) => <CellCenter>{displayValue(params.row.operation)}</CellCenter>,
            },
            {
              field: "downloadURL",
              headerName: "Source",
              flex: 2,
              sortable: false,
              renderCell: (params) => <CellCenter>{renderLinkValue(params.row.downloadURL)}</CellCenter>,
            },
          ]}
        />
      </Paper>

      {!(gate.isAdmin || gate.isProductLead) && (
        <Alert severity="warning">
          You are not authorized to approve the manual files and promote this update. Please request a lead for
          approval.
        </Alert>
      )}
    </Stack>
  );
}

// getRowHeight="auto" above only lets the ROW grow to fit its content — MUI
// DataGrid's own cell CSS still clips text with nowrap/ellipsis unless
// explicitly told to wrap. Long Files/Source values (paths, URLs) were
// getting cut off with no way to read them; this lets them wrap and the
// auto row height then grows to fit the wrapped lines.
const denseDataGridSx = {
  border: 0,
  "& .MuiDataGrid-cell": {
    whiteSpace: "normal",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
  },
} as const;

function CellCenter({ children }: { children: ReactNode }) {
  return <Stack sx={{ justifyContent: "center", minHeight: "100%", py: 0.75, width: "100%" }}>{children}</Stack>;
}

function renderLinkValue(value: string | null | undefined): ReactNode {
  const normalizedValue = displayValue(value);
  if (normalizedValue === "N/A") return normalizedValue;

  return (
    <Link href={normalizedValue} target="_blank" rel="noopener noreferrer" underline="hover">
      {normalizedValue}
    </Link>
  );
}

function displayValue(value: string | null | undefined): string {
  if (value === null || value === undefined) return "N/A";
  const normalizedValue = value.trim();
  return normalizedValue || "N/A";
}
