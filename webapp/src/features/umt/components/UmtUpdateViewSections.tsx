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

import { useState, type ReactNode } from "react";
import {
  Alert,
  Button,
  Chip,
  DataGrid,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Link,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { PlusIcon, TrashIcon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type {
  UmtFileOperation,
  UmtHotfixInfo,
  UmtProductAnalysis,
  UmtProductAnalysisItem,
  UmtPullRequestAnalysis,
  UmtPullRequestAnalysisItem,
  UmtUpdateDependency,
  UmtUpdateProduct,
  UmtUpdateSummary,
} from "../api/umtUpdates";
import { useUmtGate } from "../api/useUmtGate";
import {
  useUmtSaveIssues,
  useUmtSavePublicPullRequests,
  useUmtSaveTestPullRequests,
} from "../api/useUmtUpdateActions";
import { isValidGithubIssueUrl } from "../lib/umtCreateUpdate";
import { useUmtUpdateViewData } from "../api/useUmtUpdateViewData";

interface DenseColumn<Row> {
  key: string;
  label: string;
  render: (row: Row) => ReactNode;
}

const { DataGrid: DataGridComponent } = DataGrid;

export default function UmtUpdateViewSections({
  id,
  update,
}: {
  id: string;
  update: UmtUpdateSummary;
}) {
  const viewData = useUmtUpdateViewData(id, update.lifecycleState, Boolean(update.isHotfix));
  const publicPullRequests = update.publicPullRequests ?? [];
  const gate = useUmtGate();
  const saveIssues = useUmtSaveIssues(id);
  const savePublicPrs = useUmtSavePublicPullRequests(id);
  const saveTestPrs = useUmtSaveTestPullRequests(id);
  // The add action is hidden once an update is Released; the admin-only
  // delete column follows the same rule this codebase already applies
  // elsewhere (e.g. File Approval's promote gate).
  const canAddLinks = update.lifecycleState !== "Released";

  return (
    <Stack spacing={3} sx={{ mt: 3 }}>
      <Grid container spacing={{ xs: 3, lg: 4 }}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <EditableLinkSection
            title="Public GitHub Issues"
            ariaLabel="Public GitHub issues"
            columnLabel="Public Git Issues"
            emptyText="No Public GitHub Issues Available"
            items={update.issues ?? []}
            canAdd={canAddLinks}
            canDelete={gate.isAdmin}
            requireAtLeastOne
            addDialogTitle="Add Public GitHub Issues"
            addFieldLabel="Public GitHub Issue"
            validate={(value) => (isValidGithubIssueUrl(value) ? undefined : "Invalid Public GitHub Issue")}
            isSaving={saveIssues.isPending}
            onSave={(next) => saveIssues.mutateAsync(next)}
          />
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <EditableLinkSection
            title="Public Pull Requests"
            ariaLabel="Public pull requests"
            columnLabel="Public Pull Requests"
            emptyText="No Public Pull Requests Available"
            items={publicPullRequests}
            canAdd={canAddLinks}
            canDelete={gate.isAdmin}
            addDialogTitle="Add Public Pull Requests"
            addFieldLabel="Public Pull Request"
            isSaving={savePublicPrs.isPending}
            onSave={(next) => savePublicPrs.mutateAsync(next)}
          />
        </Grid>
      </Grid>

      <Divider flexItem />
      <EditableLinkSection
        title="Integration Pull Requests"
        ariaLabel="Integration pull requests"
        columnLabel="Integration Test Pull Requests"
        hideColumnHeader
        emptyText="No Integration Test Pull Requests Available"
        items={update.testPullRequests ?? []}
        canAdd={canAddLinks}
        canDelete={gate.isAdmin}
        addDialogTitle="Add Integration Test Pull Requests"
        addFieldLabel="Integration Test Pull Request"
        isSaving={saveTestPrs.isPending}
        onSave={(next) => saveTestPrs.mutateAsync(next)}
      />

      <DividedTableSection title="Products">
        <DenseTable
          ariaLabel="Products"
          columns={productColumns}
          rows={update.products ?? []}
          rowKey={(row, index) => `${row.product?.id ?? row.product?.name ?? "product"}-${index}`}
        />
      </DividedTableSection>

      <PullRequestAnalysisSection query={viewData.pullRequestAnalysis} />
      <ProductAnalysisSection query={viewData.productAnalysis} />

      {(update.securityAdvisories?.length ?? 0) > 0 && (
        <DividedTableSection title="Security Advisories">
          <DenseTable
            ariaLabel="Security advisories"
            columns={[
              {
                key: "security-advisory",
                label: "Security Advisory Name",
                render: (row) => displayValue(row.securityAdvisoryName),
              },
            ]}
            rows={update.securityAdvisories ?? []}
            rowKey={(row, index) => `${row.securityAdvisoryName ?? "advisory"}-${index}`}
          />
        </DividedTableSection>
      )}

      <DependencySection query={viewData.dependencies} />
      {update.isHotfix && <HotfixSection query={viewData.hotfixInfo} />}

      {update.lifecycleState === "Completed" && (
        <DividedTableSection title="Completion Details">
          <DenseTable
            ariaLabel="Completion details"
            columns={[
              {
                key: "pull-requests",
                label: "Public Pull Requests",
                render: (row) => displayValue(row.pullRequests.join(", ")),
              },
              {
                key: "reason",
                label: "Completion Reason",
                render: (row) => displayValue(row.reason),
              },
            ]}
            rows={[{ pullRequests: publicPullRequests, reason: update.reason }]}
            rowKey={() => "completion-details"}
          />
        </DividedTableSection>
      )}
    </Stack>
  );
}

function PullRequestAnalysisSection({ query }: { query: ViewQueryState<UmtPullRequestAnalysis> }) {
  if (query.isPending) return null;
  if (query.isError) {
    return <SectionError title="Pull Request Analysis Results" onRetry={() => void query.refetch()} />;
  }

  const pullRequests = query.data?.pullRequests ?? [];
  const identifiedFiles = query.data?.identifiedFileOperations ?? [];
  const additionalFiles = query.data?.additionalFileOperations ?? [];
  if (pullRequests.length + identifiedFiles.length + additionalFiles.length === 0) return null;

  return (
    <>
      {pullRequests.length > 0 && (
        <DividedTableSection title="Pull Request Analysis Results">
          <Stack spacing={2.5}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Pull Requests
            </Typography>
            <DenseTable
              ariaLabel="Analyzed pull requests"
              columns={pullRequestAnalysisColumns}
              rows={pullRequests}
              rowKey={(row, index) => `${row.pr ?? "pull-request"}-${index}`}
            />
            {identifiedFiles.length > 0 && (
              <AnalysisFileTable title="Files" rows={identifiedFiles} />
            )}
          </Stack>
        </DividedTableSection>
      )}
      {pullRequests.length === 0 && identifiedFiles.length > 0 && (
        <Stack spacing={1}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Files
          </Typography>
          <DenseTable
            ariaLabel="Identified file operations"
            columns={fileOperationColumns}
            rows={identifiedFiles}
            rowKey={(row, index) => `${row.file ?? "file"}-${index}`}
          />
        </Stack>
      )}
      {additionalFiles.length > 0 && (
        <DividedTableSection title="Additional Files">
          <DenseTable
            ariaLabel="Additional files"
            columns={fileOperationColumns}
            rows={additionalFiles}
            rowKey={(row, index) => `${row.file ?? "file"}-${index}`}
          />
        </DividedTableSection>
      )}
    </>
  );
}

function ProductAnalysisSection({ query }: { query: ViewQueryState<UmtProductAnalysis> }) {
  if (query.isPending) return null;
  if (query.isError) {
    return <SectionError title="Product Analysis Results" onRetry={() => void query.refetch()} />;
  }

  const compatible = query.data?.compatibleProducts ?? [];
  const applicable = query.data?.applicableProducts ?? [];
  if (compatible.length + applicable.length === 0) return null;

  return (
    <>
      {compatible.length > 0 && (
        <DividedTableSection title="Product Analysis Results">
          <Stack spacing={3}>
            {compatible.map((product, index) => (
              <ProductAnalysisTable
                key={`compatible-${product.productId ?? index}`}
                product={product}
                status="Fully Applicable"
                color="success"
              />
            ))}
          </Stack>
        </DividedTableSection>
      )}
      {applicable.map((product, index) => (
        <ProductAnalysisTable
          key={`applicable-${product.productId ?? index}`}
          product={product}
          status="Partially Applicable"
          color="warning"
        />
      ))}
    </>
  );
}

function ProductAnalysisTable({
  product,
  status,
  color,
}: {
  product: UmtProductAnalysisItem;
  status: string;
  color: "success" | "warning";
}) {
  return (
    <Stack spacing={1.25}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {displayValue(product.productName)} - {displayValue(product.baseVersion)}
        </Typography>
        <Chip label={status} color={color} size="small" />
      </Stack>
      <DenseTable
        ariaLabel={`${status} product file operations`}
        columns={fileOperationColumns}
        rows={product.identifiedFiles ?? []}
        rowKey={(row, index) => `${row.file ?? "file"}-${index}`}
      />
    </Stack>
  );
}

function AnalysisFileTable({ title, rows }: { title: string; rows: UmtFileOperation[] }) {
  return (
    <Stack spacing={1}>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      <DenseTable
        ariaLabel={title}
        columns={fileOperationColumns}
        rows={rows}
        rowKey={(row, index) => `${row.file ?? "file"}-${index}`}
      />
    </Stack>
  );
}

function DependencySection({ query }: { query: ViewQueryState<UmtUpdateDependency[]> }) {
  if (query.isPending) return null;
  if (query.isError) {
    return <SectionError title="Regression Updates" onRetry={() => void query.refetch()} />;
  }

  const rows = query.data ?? [];
  if (rows.length === 0) return null;
  return (
    <DividedTableSection title="Regression Updates">
      <DenseTable
        ariaLabel="Regression updates"
        columns={[
          { key: "id", label: "ID", render: (row) => displayValue(row.to?.id) },
        ]}
        rows={rows}
        rowKey={(row, index) => `${row.to?.id ?? "dependency"}-${index}`}
      />
    </DividedTableSection>
  );
}

function HotfixSection({ query }: { query: ViewQueryState<UmtHotfixInfo> }) {
  if (query.isPending) return <SectionSkeleton title="Hotfix Information" />;
  if (query.isError) {
    return <SectionError title="Hotfix Information" onRetry={() => void query.refetch()} />;
  }

  return (
    <DividedTableSection title="Hotfix Information">
      <Stack spacing={2.5}>
        <DenseTable
          ariaLabel="Hotfix locations"
          columns={[
            { key: "hotfix-url", label: "Hotfix URL", render: (row) => renderLinkValue(row.hotfixUrl) },
            { key: "upload-url", label: "Upload URL", render: (row) => renderLinkValue(row.uploadUrl) },
          ]}
          rows={[{ hotfixUrl: query.data?.hotfixUrl, uploadUrl: query.data?.uploadUrl }]}
          rowKey={() => "hotfix-locations"}
        />
        {(query.data?.hotfixList?.length ?? 0) > 0 && (
          <Stack spacing={1}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Files
            </Typography>
            <DenseTable
              ariaLabel="Hotfix files"
              columns={[{ key: "file", label: "Hotfix List", render: displayValue }]}
              rows={query.data?.hotfixList ?? []}
              rowKey={(row, index) => `${row}-${index}`}
            />
          </Stack>
        )}
      </Stack>
    </DividedTableSection>
  );
}

// Shared by the View tab's three editable link-list sections (Public GitHub
// Issues, Public Pull Requests, Integration Test Pull Requests). Each dialog
// open adds one item, matching every other "Add X" dialog already in this
// feature (Manual Files, Bundle Info, Pull Requests, Security Advisories).
function EditableLinkSection({
  title,
  ariaLabel,
  columnLabel,
  hideColumnHeader = false,
  emptyText,
  items,
  canAdd,
  canDelete,
  requireAtLeastOne = false,
  addDialogTitle,
  addFieldLabel,
  validate,
  isSaving,
  onSave,
}: {
  title?: string;
  ariaLabel: string;
  columnLabel: string;
  hideColumnHeader?: boolean;
  emptyText: string;
  items: string[];
  canAdd: boolean;
  canDelete: boolean;
  requireAtLeastOne?: boolean;
  addDialogTitle: string;
  addFieldLabel: string;
  validate?: (value: string) => string | undefined;
  isSaving: boolean;
  onSave: (nextItems: string[]) => Promise<unknown>;
}) {
  const { showSuccess, showError } = useNotifications();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [value, setValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const trimmed = value.trim();
  const validationError = trimmed ? validate?.(trimmed) : undefined;

  async function handleAdd() {
    if (!trimmed || validationError) return;
    try {
      await onSave([...items, trimmed]);
      showSuccess(`${addFieldLabel} added.`);
      setIsAddOpen(false);
      setValue("");
    } catch (error) {
      showError(`Failed to add ${addFieldLabel.toLowerCase()}. ${describeError(error)}`);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    try {
      await onSave(items.filter((item) => item !== deleteTarget));
      showSuccess(`${addFieldLabel} deleted.`);
    } catch (error) {
      showError(`Failed to delete ${addFieldLabel.toLowerCase()}. ${describeError(error)}`);
    } finally {
      setDeleteTarget(null);
    }
  }

  const deleteDisabled = requireAtLeastOne && items.length <= 1;

  const columns: DenseColumn<string>[] = [
    { key: "value", label: columnLabel, render: renderLinkValue },
    ...(canDelete
      ? [
          {
            key: "delete",
            label: "",
            render: (row: string) =>
              deleteDisabled ? (
                <Tooltip title={`At least one ${addFieldLabel} is required`}>
                  <span>
                    <IconButton size="small" disabled aria-label={`Delete ${addFieldLabel.toLowerCase()}`}>
                      <TrashIcon size={16} />
                    </IconButton>
                  </span>
                </Tooltip>
              ) : (
                <IconButton
                  size="small"
                  aria-label={`Delete ${addFieldLabel.toLowerCase()}`}
                  onClick={() => setDeleteTarget(row)}
                >
                  <TrashIcon size={16} />
                </IconButton>
              ),
          },
        ]
      : []),
  ];

  const content = (
    <>
      {items.length > 0 ? (
        <DenseTable ariaLabel={ariaLabel} columns={columns} rows={items} rowKey={(row, index) => `${row}-${index}`} hideHeader={hideColumnHeader} />
      ) : (
        <EmptySectionText>{emptyText}</EmptySectionText>
      )}

      <Dialog open={isAddOpen} onClose={() => setIsAddOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{addDialogTitle}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label={addFieldLabel}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            error={Boolean(validationError)}
            helperText={validationError}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsAddOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!trimmed || Boolean(validationError)} loading={isSaving} onClick={() => void handleAdd()}>
            Add
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogContentText>Are you sure you want to delete this {addFieldLabel.toLowerCase()}?</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="contained" loading={isSaving} onClick={() => void handleConfirmDelete()}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );

  if (!title) return content;

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Typography component="h5" variant="h5" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        {canAdd && (
          <IconButton aria-label={`Add ${addFieldLabel.toLowerCase()}`} size="small" onClick={() => setIsAddOpen(true)}>
            <PlusIcon size={18} />
          </IconButton>
        )}
      </Stack>
      {content}
    </Stack>
  );
}

function TableSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack spacing={1.5}>
      <Typography component="h5" variant="h5" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      {children}
    </Stack>
  );
}

function EmptySectionText({ children }: { children: ReactNode }) {
  return (
    <Typography color="text.secondary" variant="body1">
      {children}
    </Typography>
  );
}

function DividedTableSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <Divider flexItem />
      <TableSection title={title}>{children}</TableSection>
    </>
  );
}

function DenseTable<Row>({
  ariaLabel,
  columns,
  rows,
  rowKey,
  hideHeader = false,
}: {
  ariaLabel: string;
  columns: DenseColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row, index: number) => string;
  hideHeader?: boolean;
}) {
  const gridRows = rows.map((row, index) => ({ id: rowKey(row, index), value: row }));
  const gridColumns: DataGrid.GridColDef[] = columns.map((column) => ({
    field: column.key,
    flex: 1,
    headerName: hideHeader ? "" : column.label,
    minWidth: 160,
    // A single-column table has nothing to resize against, so its header
    // resize handle only misleads.
    resizable: columns.length > 1,
    sortable: false,
    renderCell: (params) => (
      <GridCellContent>{column.render(params.row.value as Row)}</GridCellContent>
    ),
  }));

  return (
    <Paper variant="outlined" sx={{ minWidth: 0, overflow: "hidden", position: "relative" }}>
      <DataGridComponent
        autoHeight
        columnHeaderHeight={hideHeader ? 0 : 40}
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
// explicitly told to wrap. Long values (paths, URLs) were getting cut off
// with no way to read them; this lets them wrap and the auto row height
// then grows to fit the wrapped lines.
const denseDataGridSx = {
  border: 0,
  "& .MuiDataGrid-cell": {
    whiteSpace: "normal",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
  },
} as const;

function GridCellContent({ children }: { children: ReactNode }) {
  return (
    <Stack sx={{ justifyContent: "center", minHeight: "100%", py: 0.75, width: "100%" }}>
      {children}
    </Stack>
  );
}

function SectionSkeleton({ title }: { title: string }) {
  return (
    <DividedTableSection title={title}>
      <Skeleton variant="rounded" height={96} />
    </DividedTableSection>
  );
}

function SectionError({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <DividedTableSection title={title}>
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={onRetry}>
            Retry
          </Button>
        }
      >
        Couldn&apos;t load this section.
      </Alert>
    </DividedTableSection>
  );
}

interface ViewQueryState<Data> {
  data: Data | undefined;
  isError: boolean;
  isPending: boolean;
  refetch: () => unknown;
}

const productColumns: DenseColumn<UmtUpdateProduct>[] = [
  { key: "product", label: "Product", render: (row) => displayValue(row.product?.name) },
  { key: "version", label: "Version", render: (row) => displayValue(row.product?.version) },
  { key: "description", label: "Description", render: (row) => displayValue(row.description) },
  { key: "instruction", label: "Instruction", render: (row) => displayValue(row.instruction) },
  { key: "test-pr", label: "Test PR", render: (row) => renderLinkValue(row.testPr) },
  {
    key: "ignore-test-reason",
    label: "Ignore Test Reason",
    render: (row) => displayValue(row.ignoreTestReason),
  },
];

const pullRequestAnalysisColumns: DenseColumn<UmtPullRequestAnalysisItem>[] = [
  { key: "pull-request", label: "Pull Requests", render: (row) => renderLinkValue(row.pr) },
  {
    key: "preferred-version",
    label: "Preferred Version",
    render: (row) => displayValue(row.preferredVersion),
  },
];

const fileOperationColumns: DenseColumn<UmtFileOperation>[] = [
  { key: "file", label: "Files", render: (row) => displayValue(row.file) },
  { key: "operation", label: "Operation", render: (row) => displayValue(row.operation) },
  { key: "source", label: "Source", render: (row) => renderLinkValue(row.downloadURL) },
];

function renderLinkValue(value: string | null | undefined): ReactNode {
  const normalizedValue = displayValue(value);
  if (normalizedValue === "N/A") return normalizedValue;
  // Public Pull Requests / Integration Pull Requests accept any non-blank
  // text (EditableLinkSection has no `validate` for them), so this can't
  // assume normalizedValue is a URL — rendering it as an href unconditionally
  // would turn arbitrary text into a broken or misleading (or, for a
  // javascript: value, script-executing) link.
  if (!/^https?:\/\//i.test(normalizedValue)) return normalizedValue;

  return (
    <Link
      href={normalizedValue}
      target="_blank"
      rel="noopener noreferrer"
      underline="hover"
    >
      {normalizedValue}
    </Link>
  );
}

function displayValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "N/A";
  const normalizedValue = String(value).trim();
  return normalizedValue || "N/A";
}
