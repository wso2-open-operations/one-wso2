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
  Box,
  Button,
  CircularProgress,
  DataGrid,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  Link,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { Info } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { UmtMeta } from "../api/umtTypes";
import type {
  UmtBranchCreationRequest,
  UmtUpdateBranch,
  UmtUpdateProduct,
  UmtUpdateSummary,
} from "../api/umtUpdates";
import {
  useUmtBranches,
  useUmtComponentMaxUpdateLevel,
  useUmtCreateBranch,
} from "../api/useUmtBranches";

const { DataGrid: DataGridComponent } = DataGrid;

interface BranchGridRow extends UmtUpdateBranch {
  id: string;
  version?: string | null;
}

interface ProductBranchRow extends BranchGridRow {
  sourceProduct?: UmtUpdateProduct;
}

interface BranchFormValues {
  publicRepoUrl: string;
  releaseTag: string;
}

interface UpdateLevelFormValues extends BranchFormValues {
  productName: string;
  productVersion: string;
}

const EMPTY_BRANCH_FORM: BranchFormValues = { publicRepoUrl: "", releaseTag: "" };
const EMPTY_UPDATE_LEVEL_FORM: UpdateLevelFormValues = {
  publicRepoUrl: "",
  releaseTag: "",
  productName: "",
  productVersion: "",
};

export default function UmtUpdateBranchTab({
  id,
  update,
  products,
}: {
  id: string;
  update: UmtUpdateSummary;
  products: UmtMeta["products"];
}) {
  const branches = useUmtBranches(id);
  const createBranch = useUmtCreateBranch(id, Boolean(update.isHotfix));
  const findUpdateLevel = useUmtComponentMaxUpdateLevel(id);
  const { showError, showSuccess } = useNotifications();
  const [branchForm, setBranchForm] = useState<BranchFormValues>(EMPTY_BRANCH_FORM);
  const [branchFormSubmitted, setBranchFormSubmitted] = useState(false);
  const [updateLevelOpen, setUpdateLevelOpen] = useState(false);
  const [updateLevelForm, setUpdateLevelForm] = useState<UpdateLevelFormValues>(EMPTY_UPDATE_LEVEL_FORM);
  const [updateLevelSubmitted, setUpdateLevelSubmitted] = useState(false);
  const [identifiedVersion, setIdentifiedVersion] = useState<string | null>(null);
  const [productColumnVisibility, setProductColumnVisibility] = useState<DataGrid.GridColumnVisibilityModel>({
    publicRepoUrl: false,
  });

  const branchRows = branches.data ?? [];
  const componentRows: BranchGridRow[] = branchRows
    .filter((branch) => branch.branchType === "ComponentBranch")
    .map((branch, index) => ({ ...branch, id: branchRowId(branch, index) }));
  const createdProductRows: ProductBranchRow[] = branchRows
    .filter((branch) => branch.branchType === "ProductBranch")
    .map((branch, index) => ({ ...branch, id: branchRowId(branch, index) }));
  const initialProductRows: ProductBranchRow[] = (update.products ?? []).map((updateProduct, index) => {
      const productName = updateProduct.product?.name ?? "N/A";
      const rawVersion = updateProduct.product?.version ?? "N/A";
      const version = rawVersion.endsWith(".full") ? rawVersion.slice(0, -5) : rawVersion;
      const metadata = products[productName]?.find((product) => product.version === rawVersion);

      return {
        id: String(updateProduct.productId ?? updateProduct.product?.id ?? `${productName}-${index}`),
        productName,
        version,
        releaseTag: version,
        supportRepoUrl: metadata?.supportRepoUrl ?? "N/A",
        publicRepoUrl: metadata?.publicRepoUrl ?? "N/A",
        branchUrl: "N/A",
        jenkinsJobUrl: "N/A",
        status: "Not Created",
        sourceProduct: updateProduct,
      };
    });
  const productRows = createdProductRows.length > 0 ? createdProductRows : initialProductRows;
  const compatibleInitialProduct = update.products?.find((product) => product.type === "CompatibleInitial");

  const submitBranch = async (request: UmtBranchCreationRequest, successMessage: string) => {
    try {
      await createBranch.mutateAsync(withHotfixFields(request, update));
      showSuccess(successMessage);
      return true;
    } catch (error) {
      showError(`Branch creation failed. ${describeError(error)}`);
      return false;
    }
  };

  const handleCreateComponentBranch = async () => {
    setBranchFormSubmitted(true);
    if (branchFormError(branchForm)) return;

    const created = await submitBranch(
      {
        ...branchForm,
        branchType: "ComponentBranch",
        channel: "full",
        productName: compatibleInitialProduct?.product?.name ?? "",
        productVersion: compatibleInitialProduct?.product?.version ?? "",
      },
      `${update.isHotfix ? "Hotfix" : "Update"} branch requested successfully`,
    );
    if (created) {
      setBranchForm(EMPTY_BRANCH_FORM);
      setBranchFormSubmitted(false);
    }
  };

  const handleCreateProductBranch = async (row: ProductBranchRow) => {
    await submitBranch(
      {
        publicRepoUrl: displayValue(row.publicRepoUrl),
        releaseTag: displayValue(row.version ?? row.releaseTag),
        channel: "full",
        productName: displayValue(row.productName),
        branchType: "ProductBranch",
        productVersion: displayValue(row.version ?? row.productVersion),
      },
      `Product branch requested for ${displayValue(row.productName)}`,
    );
  };

  const handleFindUpdateLevel = async () => {
    setUpdateLevelSubmitted(true);
    if (branchFormError(updateLevelForm)) return;
    try {
      const response = await findUpdateLevel.mutateAsync(updateLevelForm);
      setIdentifiedVersion(displayValue(response?.version));
      setUpdateLevelOpen(false);
      setUpdateLevelSubmitted(false);
      showSuccess("Fetched update level successfully");
    } catch (error) {
      showError(`Couldn't fetch the update level. ${describeError(error)}`);
    }
  };

  const componentColumns = branchColumns(false, createBranch.isPending, handleCreateProductBranch);
  const productColumns = branchColumns(
    createdProductRows.length === 0,
    createBranch.isPending,
    handleCreateProductBranch,
  );

  return (
    <Stack spacing={3}>
      <BranchUpdateSummary id={id} update={update} />

      <Divider />
      <SectionHeading title="Create Branch" />
      <Stack spacing={2}>
        <TextField
          error={branchFormSubmitted && Boolean(publicRepoError(branchForm.publicRepoUrl))}
          fullWidth
          helperText={branchFormSubmitted ? publicRepoError(branchForm.publicRepoUrl) : undefined}
          label="Public Repository URL"
          onChange={(event) => setBranchForm((current) => ({ ...current, publicRepoUrl: event.target.value }))}
          placeholder="Enter Public Repository URL"
          size="small"
          value={branchForm.publicRepoUrl}
        />
        <TextField
          error={branchFormSubmitted && !branchForm.releaseTag.trim()}
          fullWidth
          helperText={branchFormSubmitted && !branchForm.releaseTag.trim() ? "Release Version is required" : undefined}
          label="Release Version"
          onChange={(event) => setBranchForm((current) => ({ ...current, releaseTag: event.target.value }))}
          placeholder="Enter Release Version"
          size="small"
          value={branchForm.releaseTag}
        />
        <Stack direction="row" spacing={2} sx={{ justifyContent: "flex-end" }}>
          <Button variant="outlined" onClick={() => setUpdateLevelOpen(true)}>Find Update Level</Button>
          <Button
            loading={createBranch.isPending}
            variant="contained"
            onClick={() => void handleCreateComponentBranch()}
          >
            Create Branch
          </Button>
        </Stack>
      </Stack>

      <Divider />
      <SectionHeading
        title="Component Branches"
        help="Once branch creation is requested, this table shows its progress and then the created support-repository branch details."
      />
      {branches.isError && (
        <ErrorNotice error={branches.error} onRetry={() => void branches.refetch()} retrying={branches.isFetching}>
          Couldn&apos;t load branch details for update #{id}.
        </ErrorNotice>
      )}
      <BranchGrid
        ariaLabel="Component branches"
        columns={componentColumns.filter(
          (column) => column.field !== "productName" && column.field !== "action",
        )}
        loading={branches.isPending}
        rows={componentRows}
      />

      <Divider />
      <SectionHeading title="Product Branches" help="Displays the existing product branches created for this update." />
      <BranchGrid
        ariaLabel="Product branches"
        columnVisibilityModel={productColumnVisibility}
        columns={productColumns}
        loading={branches.isPending}
        onColumnVisibilityModelChange={setProductColumnVisibility}
        rows={productRows}
      />

      <UpdateLevelDialog
        form={updateLevelForm}
        loading={findUpdateLevel.isPending}
        open={updateLevelOpen}
        submitted={updateLevelSubmitted}
        onChange={setUpdateLevelForm}
        onClose={() => setUpdateLevelOpen(false)}
        onSubmit={() => void handleFindUpdateLevel()}
      />
      <Dialog open={identifiedVersion !== null} onClose={() => setIdentifiedVersion(null)}>
        <DialogTitle>Identified Version</DialogTitle>
        <DialogContent><Typography>Version = {identifiedVersion}</Typography></DialogContent>
        <DialogActions><Button onClick={() => setIdentifiedVersion(null)}>Close</Button></DialogActions>
      </Dialog>
    </Stack>
  );
}

function BranchUpdateSummary({ id, update }: { id: string; update: UmtUpdateSummary }) {
  const fields: Array<[string, ReactNode]> = [
    ["Update/Hotfix ID", id],
    ["Update Type", update.isHotfix ? "Hotfix" : "Update"],
    ["WSO2 Case ID", displayValue(update.wso2CaseId)],
    ["ServiceNow Case ID", displayValue(update.caseId)],
    ["Internal GitHub Issue", <InternalIssueLink key="internal" value={update.internalGitIssue} />],
    ["Security Internal GitHub Issue", <InternalIssueLink key="security" value={update.securityInternalGitIssue} />],
  ];
  return (
    <Grid container spacing={{ xs: 2, md: 3 }}>
      {fields.map(([label, value]) => (
        <Grid key={label} size={{ xs: 12, sm: 6, lg: 4 }}>
          <Typography color="text.secondary" variant="body2">{label}</Typography>
          <Typography component="div" sx={{ fontWeight: 600 }}>{value}</Typography>
        </Grid>
      ))}
    </Grid>
  );
}

function SectionHeading({ title, help }: { title: string; help?: string }) {
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
      <Typography component="h3" variant="h5" sx={{ fontWeight: 700 }}>{title}</Typography>
      {help && (
        <Tooltip title={help}>
          <Box component="span" sx={{ color: "text.secondary", display: "inline-flex" }}>
            <Info size={17} />
          </Box>
        </Tooltip>
      )}
    </Stack>
  );
}

function BranchGrid({
  ariaLabel,
  columns,
  loading,
  rows,
  columnVisibilityModel,
  onColumnVisibilityModelChange,
}: {
  ariaLabel: string;
  columns: DataGrid.GridColDef[];
  loading: boolean;
  rows: BranchGridRow[];
  columnVisibilityModel?: DataGrid.GridColumnVisibilityModel;
  onColumnVisibilityModelChange?: (model: DataGrid.GridColumnVisibilityModel) => void;
}) {
  return (
    <Paper variant="outlined" sx={{ minWidth: 0, overflow: "hidden" }}>
      <DataGridComponent
        aria-label={ariaLabel}
        autoHeight
        columnHeaderHeight={40}
        columns={columns}
        columnVisibilityModel={columnVisibilityModel}
        disableRowSelectionOnClick
        getRowHeight={() => "auto"}
        hideFooter
        loading={loading}
        onColumnVisibilityModelChange={onColumnVisibilityModelChange}
        rows={rows}
        sx={branchGridSx}
      />
    </Paper>
  );
}

// See UmtUpdateViewSections.tsx's denseDataGridSx: MUI DataGrid clips long
// cell text (repository URLs, branch/job URLs) with nowrap/ellipsis unless
// told to wrap.
const branchGridSx = {
  border: 0,
  minHeight: 100,
  "& .MuiDataGrid-cell": {
    whiteSpace: "normal",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
  },
} as const;

function branchColumns(
  includeAction: boolean,
  creating: boolean,
  onCreate: (row: ProductBranchRow) => Promise<void>,
): DataGrid.GridColDef[] {
  const columns: DataGrid.GridColDef[] = [
    branchColumn("productName", "Product Name", 150),
    branchColumn("releaseTag", "Release Tag", 150, (row) => row.releaseTag ?? row.version),
    branchColumn("supportRepoUrl", "Support Repository", 250, (row) => row.supportRepoUrl, true),
    branchColumn("publicRepoUrl", "Public Repository", 250, (row) => row.publicRepoUrl, true),
    branchColumn("branchUrl", "Branch URL", 300, (row) => row.branchUrl, true),
    branchColumn("jenkinsJobUrl", "Job URL", 300, (row) => row.jenkinsJobUrl, true),
    {
      field: "status",
      headerName: "Status",
      minWidth: 150,
      sortable: false,
      width: 150,
      renderCell: (params) => (
        <CenteredCell>
          {params.row.status === "Pending" ? <CircularProgress size={22} /> : displayValue(params.row.status)}
        </CenteredCell>
      ),
    },
  ];
  if (includeAction) {
    columns.push({
      field: "action",
      headerName: "Action",
      minWidth: 120,
      resizable: false,
      sortable: false,
      width: 120,
      renderCell: (params) => (
        <CenteredCell>
          {params.row.status !== "Completed" && params.row.status !== "Pending" ? (
            <Button
              disabled={creating}
              size="small"
              variant="contained"
              onClick={() => void onCreate(params.row as ProductBranchRow)}
            >
              Create
            </Button>
          ) : "N/A"}
        </CenteredCell>
      ),
    });
  }
  return columns;
}

function branchColumn(
  field: string,
  headerName: string,
  width: number,
  getValue: (row: BranchGridRow) => string | null | undefined = (row) => row[field as keyof BranchGridRow] as string | null | undefined,
  link = false,
): DataGrid.GridColDef {
  return {
    field,
    headerName,
    minWidth: width,
    sortable: false,
    width,
    renderCell: (params) => (
      <CenteredCell>{link ? <ExternalValue value={getValue(params.row)} /> : displayValue(getValue(params.row))}</CenteredCell>
    ),
  };
}

function CenteredCell({ children }: { children: ReactNode }) {
  return <Stack sx={{ justifyContent: "center", minHeight: "100%", py: 0.75, width: "100%" }}>{children}</Stack>;
}

function ExternalValue({ value }: { value: string | null | undefined }) {
  const normalized = displayValue(value);
  if (normalized === "N/A") return normalized;
  return <Link href={normalized} target="_blank" rel="noopener noreferrer" underline="hover">{normalized}</Link>;
}

function InternalIssueLink({ value }: { value: string | null | undefined }) {
  if (!value?.includes("internal/")) return "N/A";
  const parts = value.split("/");
  return (
    <Link href={value} target="_blank" rel="noopener noreferrer" underline="hover">
      {parts[4] && parts.at(-1) ? `${parts[4]}#${parts.at(-1)}` : value}
    </Link>
  );
}

function UpdateLevelDialog({
  form,
  loading,
  open,
  submitted,
  onChange,
  onClose,
  onSubmit,
}: {
  form: UpdateLevelFormValues;
  loading: boolean;
  open: boolean;
  submitted: boolean;
  onChange: (value: UpdateLevelFormValues) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const fields: Array<{ key: keyof UpdateLevelFormValues; label: string; placeholder: string }> = [
    { key: "publicRepoUrl", label: "Public Repository URL", placeholder: "Enter Public Repository URL" },
    { key: "releaseTag", label: "Release Tag", placeholder: "Enter Release Tag" },
    { key: "productName", label: "Product Name", placeholder: "Enter Product Name" },
    { key: "productVersion", label: "Product Version", placeholder: "Enter Product Version" },
  ];
  return (
    <Dialog fullWidth maxWidth="md" open={open} onClose={onClose}>
      <Box
        component="form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!loading) onSubmit();
        }}
      >
        <DialogTitle>Find Update Level</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {fields.map(({ key, label, placeholder }) => {
              const requiredError = submitted && (key === "releaseTag" || key === "publicRepoUrl") && !form[key].trim();
              const repoError = key === "publicRepoUrl" && submitted
                ? publicRepoError(form.publicRepoUrl)
                : undefined;
              return (
                <TextField
                  error={Boolean(requiredError || repoError)}
                  fullWidth
                  helperText={repoError ?? (requiredError ? `${label} is required` : undefined)}
                  key={key}
                  label={label}
                  onChange={(event) => onChange({ ...form, [key]: event.target.value })}
                  placeholder={placeholder}
                  value={form[key]}
                />
              );
            })}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={loading} type="button" onClick={onClose}>Cancel</Button>
          <Button loading={loading} type="submit" variant="contained">Find</Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

function withHotfixFields(request: UmtBranchCreationRequest, update: UmtUpdateSummary): UmtBranchCreationRequest {
  if (!update.isHotfix) {
    return {
      branchType: request.branchType,
      channel: request.channel,
      productName: request.productName,
      publicRepoUrl: request.publicRepoUrl,
      releaseTag: request.releaseTag,
    };
  }
  return {
    ...request,
    jiraId: update.jiraId ?? "",
    wso2CaseId: update.wso2CaseId ?? "",
    productVersion: request.productVersion ?? "",
  };
}

function branchRowId(branch: UmtUpdateBranch, index: number): string {
  return `${branch.branchType ?? "branch"}-${branch.productName ?? "product"}-${branch.branchUrl ?? index}-${index}`;
}

function branchFormError(values: BranchFormValues): boolean {
  return Boolean(publicRepoError(values.publicRepoUrl) || !values.releaseTag.trim());
}

function publicRepoError(value: string): string | undefined {
  if (!value.trim()) return "Public Repository URL is required";
  if (!value.startsWith("https://github.com/wso2")) {
    return "Public Repository URL must start with https://github.com/wso2";
  }
  return undefined;
}

function displayValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "N/A";
  return String(value).trim() || "N/A";
}
