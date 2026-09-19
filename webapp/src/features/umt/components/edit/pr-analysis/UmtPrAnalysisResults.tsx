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
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  DataGrid,
  Divider,
  Link,
  Paper,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import { ChevronDownIcon } from "@wso2/oxygen-ui-icons-react";
import { groupFileOperationsByType } from "../../../lib/umtPrAnalysis";
import type { UmtFileOperation, UmtPullRequestAnalysis } from "../../../api/umtUpdates";

const { DataGrid: DataGridComponent } = DataGrid;

interface DenseColumn<Row> {
  key: string;
  label: string;
  render: (row: Row) => ReactNode;
}

export default function UmtPrAnalysisResults({ result }: { result: UmtPullRequestAnalysis }) {
  const pullRequests = result.pullRequests ?? [];
  const unidentifiedFiles = result.unIdentifiedFileOperations ?? [];
  const additionalFiles = result.additionalFileOperations ?? [];
  const bundlesInfoChanges = result.bundlesInfoChanges ?? [];
  const diffResponses = result.diffResponses ?? [];
  const { added, modified, removed, other } = groupFileOperationsByType(result.identifiedFileOperations ?? []);

  const hasAnything =
    pullRequests.length > 0 ||
    unidentifiedFiles.length > 0 ||
    added.length > 0 ||
    modified.length > 0 ||
    removed.length > 0 ||
    other.length > 0 ||
    additionalFiles.length > 0 ||
    bundlesInfoChanges.length > 0 ||
    diffResponses.length > 0;

  if (!hasAnything) return null;

  return (
    <Stack spacing={2} divider={<Divider flexItem />} sx={{ mt: 2 }}>
      {pullRequests.length > 0 && (
        <ResultSection title="Pull Requests">
          <DenseTable
            ariaLabel="Pull requests"
            rowKey={(row, index) => row.pr ?? String(index)}
            rows={pullRequests}
            columns={[
              { key: "pr", label: "Pull Request", render: (row) => renderLinkValue(row.pr) },
              {
                key: "preferredVersion",
                label: "Preferred Version",
                render: (row) => displayValue(row.preferredVersion),
              },
            ]}
          />
        </ResultSection>
      )}

      {unidentifiedFiles.length > 0 && (
        <Alert severity="warning">
          <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
            The following files were identified from the provided PRs, but their existence in the product
            pack could not be confirmed. Upload them manually if they are required.
          </Typography>
          <Stack spacing={0.5}>
            {unidentifiedFiles.map((op, index) => (
              <Typography key={`${op.file}-${index}`} variant="body2" sx={{ fontFamily: "monospace" }}>
                - {displayValue(op.operation)} : {displayValue(op.file)}
              </Typography>
            ))}
          </Stack>
        </Alert>
      )}

      {added.length > 0 && <FileGroupAccordion title="Added Files" rows={added} />}
      {modified.length > 0 && <FileGroupAccordion title="Modified Files" rows={modified} />}
      {removed.length > 0 && <FileGroupAccordion title="Removed Files" rows={removed} />}
      {other.length > 0 && <FileGroupAccordion title="Other Files" rows={other} />}

      {additionalFiles.length > 0 && (
        <ResultSection title="Additional Files">
          <FileOperationTable rows={additionalFiles} />
        </ResultSection>
      )}

      {bundlesInfoChanges.length > 0 && (
        <ResultSection title="Bundles Info Changes">
          <DenseTable
            ariaLabel="Bundles info changes"
            rowKey={(row, index) => row.bundlesInfoPath ?? String(index)}
            rows={bundlesInfoChanges}
            columns={[
              { key: "path", label: "Bundles Info Path", render: (row) => displayValue(row.bundlesInfoPath) },
              { key: "jarName", label: "JAR Name", render: (row) => displayValue(row.jarName) },
              { key: "jarVersion", label: "JAR Version", render: (row) => displayValue(row.jarVersion) },
              {
                key: "relativeJarPath",
                label: "Relative JAR Path",
                render: (row) => displayValue(row.relativeJarPath),
              },
              { key: "entryType", label: "Change Type", render: (row) => displayValue(row.entryType) },
            ]}
          />
        </ResultSection>
      )}

      {diffResponses.length > 0 && (
        <ResultSection title="File Conflicts">
          <DenseTable
            ariaLabel="File conflicts"
            rowKey={(row, index) => row.distributionPath ?? String(index)}
            rows={diffResponses}
            columns={[
              {
                key: "distributionPath",
                label: "Distribution Path",
                render: (row) => displayValue(row.distributionPath),
              },
              {
                key: "conflictsFound",
                label: "Conflicts Found",
                render: (row) => ((row.diffOutputList?.length ?? 0) > 0 ? "Yes" : "No"),
              },
            ]}
          />
        </ResultSection>
      )}
    </Stack>
  );
}

function FileGroupAccordion({ title, rows }: { title: string; rows: UmtFileOperation[] }) {
  return (
    <Accordion defaultExpanded disableGutters>
      <AccordionSummary expandIcon={<ChevronDownIcon size={18} />}>
        <Typography variant="h6">
          {title} ({rows.length})
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <FileOperationTable rows={rows} />
      </AccordionDetails>
    </Accordion>
  );
}

function FileOperationTable({ rows }: { rows: UmtFileOperation[] }) {
  return (
    <DenseTable
      ariaLabel="Files"
      rowKey={(row, index) => row.file ?? String(index)}
      rows={rows}
      columns={[
        { key: "file", label: "Files", render: (row) => displayValue(row.file) },
        { key: "operation", label: "Operation", render: (row) => displayValue(row.operation) },
        { key: "source", label: "Source", render: (row) => renderLinkValue(row.downloadURL) },
      ]}
    />
  );
}

function ResultSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack spacing={1}>
      <Typography variant="h6">{title}</Typography>
      {children}
    </Stack>
  );
}

// Mirrors the View tab's own dense-table style (UmtUpdateViewSections.tsx):
// bordered Paper, zero-border DataGrid, auto row height, hidden footer.
function DenseTable<Row>({
  ariaLabel,
  columns,
  rows,
  rowKey,
}: {
  ariaLabel: string;
  columns: DenseColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row, index: number) => string;
}) {
  const gridRows = rows.map((row, index) => ({ id: rowKey(row, index), value: row }));
  const gridColumns: DataGrid.GridColDef[] = columns.map((column) => ({
    field: column.key,
    flex: 1,
    headerName: column.label,
    minWidth: 160,
    // A single-column table has nothing to resize against, so its header
    // resize handle only misleads.
    resizable: columns.length > 1,
    sortable: false,
    renderCell: (params) => (
      <Stack sx={{ justifyContent: "center", minHeight: "100%", py: 0.75, width: "100%" }}>
        {column.render(params.row.value as Row)}
      </Stack>
    ),
  }));

  return (
    <Paper variant="outlined" sx={{ minWidth: 0, overflow: "hidden", position: "relative" }}>
      <DataGridComponent
        autoHeight
        columnHeaderHeight={40}
        columns={gridColumns}
        disableColumnMenu
        disableRowSelectionOnClick
        getRowHeight={() => "auto"}
        hideFooter
        rows={gridRows}
        aria-label={ariaLabel}
        sx={denseDataGridSx}
      />
    </Paper>
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

function renderLinkValue(value: string | null | undefined): ReactNode {
  const normalizedValue = displayValue(value);
  if (normalizedValue === "N/A") return normalizedValue;

  return (
    <Link href={normalizedValue} target="_blank" rel="noopener noreferrer" underline="hover">
      {normalizedValue}
    </Link>
  );
}

function displayValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "N/A";
  const normalizedValue = String(value).trim();
  return normalizedValue || "N/A";
}
