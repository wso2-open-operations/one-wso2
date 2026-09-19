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

import { useMemo, useState, type ReactNode } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  DataGrid,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Link,
  List,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { ChevronDownIcon, PlusIcon, TrashIcon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type {
  UmtFileOperation,
  UmtProductAnalysisItem,
  UmtProductAnalysisRequest,
  UmtUpdateProduct,
  UmtUpdateSummary,
} from "../../../api/umtUpdates";
import { useUmtMeta } from "../../../api/useUmtMeta";
import { useUmtProductAnalysis } from "../../../api/useUmtUpdateViewData";
import { UmtPartialProductAnalysisSaveError, useUmtSaveProductAnalysis } from "../../../api/useUmtProductAnalysis";
import { groupFileOperationsByType } from "../../../lib/umtPrAnalysis";

const { DataGrid: DataGridComponent } = DataGrid;

interface DenseColumn<Row> {
  key: string;
  label: string;
  render: (row: Row) => ReactNode;
}

function productKey(name: string | null | undefined, version: string | null | undefined): string {
  return JSON.stringify([name ?? "", version ?? ""]);
}

export default function UmtProductAnalysisStep({ id, update }: { id: string; update: UmtUpdateSummary }) {
  const { showSuccess, showError } = useNotifications();
  const productAnalysis = useUmtProductAnalysis(id, update.lifecycleState, { alwaysEnabled: true });
  const meta = useUmtMeta();
  const saveAnalysis = useUmtSaveProductAnalysis(id);

  const compatibleProducts = useMemo(
    () => productAnalysis.data?.compatibleProducts ?? [],
    [productAnalysis.data],
  );
  const applicableProducts = useMemo(
    () => productAnalysis.data?.applicableProducts ?? [],
    [productAnalysis.data],
  );

  const [addedProducts, setAddedProducts] = useState<UmtUpdateProduct[]>([]);
  const [applicableProductRows, setApplicableProductRows] = useState<Record<string, UmtFileOperation[]>>({});
  const isDirty = addedProducts.length > 0 || Object.keys(applicableProductRows).length > 0;

  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [selectedProductName, setSelectedProductName] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [deleteProductKey, setDeleteProductKey] = useState<string | null>(null);

  const [addFileTarget, setAddFileTarget] = useState<UmtProductAnalysisItem | null>(null);
  const [chosenFile, setChosenFile] = useState<string | null>(null);

  const ignoredFilePaths = productAnalysis.data?.ignoredFilePathsDuringPartialProductAnalysis ?? [];
  const ignoredProducts = productAnalysis.data?.ignoredPartiallyApplicableProducts ?? [];
  const ignoredReason = productAnalysis.data?.partiallyApplicableProductIgnoredReason;
  const ignoredReasonMessages = [
    ignoredReason?.isRemoveOnly && "The condition 'Remove Only' is true.",
    ignoredReason?.isTomcatUpgrade && "The condition 'Tomcat Upgrade' is true.",
    ignoredReason?.isJreUpgrade && "The condition 'Jre Upgrade' is true.",
    ignoredReason?.isBundleInfoChange && "The condition 'Contains bundles.info changes' is true.",
  ].filter((message): message is string => Boolean(message));
  const hasIgnoredReason = ignoredReasonMessages.length > 0;

  const [ignoredReasonDialogOpen, setIgnoredReasonDialogOpen] = useState(false);
  // React's endorsed "adjust state during render" pattern (not an effect —
  // see react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes),
  // same as UmtPrAnalysisStep.tsx: pops this dialog once whenever a fresh
  // analysis result newly explains why the automated partial-applicability
  // check was skipped, without an extra effect-triggered render pass.
  // `lastHasIgnoredReason` starts `false` (not seeded from the current
  // value) so that a query resolving from cache with the flag already true
  // on this component's very first render still counts as "newly explained"
  // and opens the dialog — seeding it from `hasIgnoredReason` would make a
  // cache-hit's already-true flag look unchanged and never surface it.
  const [lastHasIgnoredReason, setLastHasIgnoredReason] = useState(false);
  if (hasIgnoredReason !== lastHasIgnoredReason) {
    setLastHasIgnoredReason(hasIgnoredReason);
    if (hasIgnoredReason) setIgnoredReasonDialogOpen(true);
  }

  const existingProductVersions = useMemo(
    () => [
      ...compatibleProducts.map((p) => ({ name: p.productName, version: p.baseVersion })),
      ...applicableProducts.map((p) => ({ name: p.productName, version: p.baseVersion })),
      ...(update.products ?? []).map((p) => ({ name: p.product?.name, version: p.product?.version })),
      ...addedProducts.map((p) => ({ name: p.product?.name, version: p.product?.version })),
    ],
    [compatibleProducts, applicableProducts, update.products, addedProducts],
  );

  const availableVersions = useMemo(() => {
    if (!selectedProductName) return [];
    const catalog = meta.data?.products?.[selectedProductName] ?? [];
    return catalog
      .filter((product) => product.isLatest)
      .map((product) => product.version)
      .filter(
        (version) => !existingProductVersions.some((epv) => epv.name === selectedProductName && epv.version === version),
      );
  }, [selectedProductName, meta.data, existingProductVersions]);

  // Scoped to the product currently targeted by "Add File to Product",
  // excluding only files already added *to that product*. A global exclusion
  // (every applicable product's files, plus every local addition) would
  // wrongly stop the same file from being added to a second
  // partially-applicable product, which is the normal case when one file
  // belongs in several product packs.
  const targetProductFileSet = useMemo(() => {
    if (!addFileTarget) return new Set<string | null | undefined>();
    const key = productKey(addFileTarget.productName, addFileTarget.baseVersion);
    const fromResult = (addFileTarget.identifiedFiles ?? []).map((f) => f.file);
    const fromLocal = (applicableProductRows[key] ?? []).map((f) => f.file);
    return new Set([...fromResult, ...fromLocal]);
  }, [addFileTarget, applicableProductRows]);

  const compatibleFiles = useMemo(
    () =>
      compatibleProducts
        .flatMap((p) => p.identifiedFiles ?? [])
        .filter((f) => !targetProductFileSet.has(f.file)),
    [compatibleProducts, targetProductFileSet],
  );

  function resetAddProductForm() {
    setSelectedProductName(null);
    setSelectedVersion(null);
  }

  function addProduct() {
    if (!selectedProductName || !selectedVersion) return;
    const catalogEntry = meta.data?.products?.[selectedProductName]?.find((p) => p.version === selectedVersion);
    setAddedProducts([
      ...addedProducts,
      {
        productId: catalogEntry?.id ?? null,
        product: { id: catalogEntry?.id ?? null, name: selectedProductName, version: selectedVersion },
      },
    ]);
    resetAddProductForm();
    setIsAddProductOpen(false);
  }

  function confirmDeleteProduct() {
    if (!deleteProductKey) return;
    setAddedProducts(addedProducts.filter((p) => productKey(p.product?.name, p.product?.version) !== deleteProductKey));
    setDeleteProductKey(null);
  }

  function addFileToProduct(file: UmtFileOperation) {
    if (!addFileTarget) return;
    const key = productKey(addFileTarget.productName, addFileTarget.baseVersion);
    setApplicableProductRows({
      ...applicableProductRows,
      [key]: [...(applicableProductRows[key] ?? []), file],
    });
    setAddFileTarget(null);
    setChosenFile(null);
  }

  async function handleAnalyze() {
    // Preserves each applicable product's existing identifiedFiles, merging
    // in this session's newly-added rows rather than replacing the list, so
    // pre-existing files for a product are never dropped when a new file is
    // added to it.
    const mergedApplicableProducts: UmtProductAnalysisItem[] = applicableProducts.map((product) => {
      const key = productKey(product.productName, product.baseVersion);
      const added = applicableProductRows[key] ?? [];
      return { ...product, identifiedFiles: [...(product.identifiedFiles ?? []), ...added] };
    });

    const analysis: UmtProductAnalysisRequest = {
      updateNo: id,
      compatibleProducts,
      applicableProducts: mergedApplicableProducts,
      ignoredFilePathsDuringPartialProductAnalysis: [],
      ignoredPartiallyApplicableProducts: [],
      partiallyApplicableProductIgnoredReason: {
        isRemoveOnly: false,
        isTomcatUpgrade: false,
        isJreUpgrade: false,
        isBundleInfoChange: false,
      },
    };
    const products = [...(update.products ?? []), ...addedProducts];

    try {
      await saveAnalysis.mutateAsync({ products, analysis, previousProducts: update.products ?? [] });
      showSuccess("Product analysis updated.");
      setAddedProducts([]);
      setApplicableProductRows({});
    } catch (error) {
      if (error instanceof UmtPartialProductAnalysisSaveError) {
        showError(error.message);
      } else {
        showError(`Failed to update product analysis. ${describeError(error)}`);
      }
    }
  }

  function handleReset() {
    setAddedProducts([]);
    setApplicableProductRows({});
  }

  if (productAnalysis.isPending) {
    return (
      <Typography variant="body2" color="text.secondary">
        Loading product analysis…
      </Typography>
    );
  }

  if (productAnalysis.isError) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={() => void productAnalysis.refetch()}>
            Retry
          </Button>
        }
      >
        Failed to load product analysis results.
      </Alert>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Typography variant="h5">Product Analysis Results</Typography>
        <IconButton aria-label="Add product" size="small" onClick={() => setIsAddProductOpen(true)}>
          <PlusIcon size={18} />
        </IconButton>
      </Stack>

      {compatibleProducts.map((product) => (
        <ProductAccordion
          key={productKey(product.productName, product.baseVersion)}
          title={`${product.productName ?? "N/A"} - ${product.baseVersion ?? "N/A"}`}
          chipLabel="Fully Applicable"
          chipColor="success"
        >
          <FileGroups files={product.identifiedFiles ?? []} />
        </ProductAccordion>
      ))}

      {applicableProducts.map((product) => {
        const key = productKey(product.productName, product.baseVersion);
        const files = [...(product.identifiedFiles ?? []), ...(applicableProductRows[key] ?? [])];
        return (
          <ProductAccordion
            key={key}
            title={`${product.productName ?? "N/A"} - ${product.baseVersion ?? "N/A"}`}
            chipLabel="Partially Applicable"
            chipColor="warning"
            actions={
              <Button size="small" variant="outlined" startIcon={<PlusIcon size={16} />} onClick={() => setAddFileTarget(product)}>
                File
              </Button>
            }
          >
            <FileGroups files={files} />
          </ProductAccordion>
        );
      })}

      {(ignoredFilePaths.length > 0 || hasIgnoredReason) && (
        <Box>
          {ignoredFilePaths.length > 0 && (
            <Accordion defaultExpanded disableGutters>
              <AccordionSummary expandIcon={<ChevronDownIcon size={18} />}>
                <Typography variant="h6">
                  Ignored File Paths During Partial Product Analysis ({ignoredFilePaths.length})
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <List>
                  {ignoredFilePaths.map((path) => (
                    <Typography key={path} variant="body2">
                      {path}
                    </Typography>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          )}
          {hasIgnoredReason && (
            <Box sx={{ mt: ignoredFilePaths.length > 0 ? 2 : 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                You can create separate updates for the applicable products to send the missing configuration
                files if required.
              </Typography>
              {ignoredProducts.length > 0 ? (
                <List>
                  {ignoredProducts.map((product, index) => (
                    <Typography key={index} variant="body2">
                      {typeof product === "string"
                        ? product
                        : `${product.productName ?? "Unknown product"}${product.baseVersion ? ` - ${product.baseVersion}` : ""}`}
                    </Typography>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No specific products listed.
                </Typography>
              )}
            </Box>
          )}
        </Box>
      )}

      {addedProducts.length > 0 && (
        <Box>
          <Typography variant="h6">Added Products</Typography>
          <DataGridComponent
            autoHeight
            columnHeaderHeight={40}
            disableColumnMenu
            disableRowSelectionOnClick
            getRowHeight={() => "auto"}
            getRowId={(row: UmtUpdateProduct) => productKey(row.product?.name, row.product?.version)}
            hideFooter
            rows={addedProducts}
            sx={{ mt: 2, ...denseDataGridSx }}
            columns={[
              {
                field: "name",
                headerName: "Product Name",
                flex: 3,
                sortable: false,
                renderCell: (params: { row: UmtUpdateProduct }) => (
                  <CellCenter>{params.row.product?.name}</CellCenter>
                ),
              },
              {
                field: "version",
                headerName: "Version",
                flex: 1,
                sortable: false,
                renderCell: (params: { row: UmtUpdateProduct }) => (
                  <CellCenter>{params.row.product?.version}</CellCenter>
                ),
              },
              {
                field: "delete",
                headerName: "",
                width: 52,
                sortable: false,
                renderCell: (params: { row: UmtUpdateProduct }) => (
                  <CellCenter>
                    <IconButton
                      aria-label="Delete product"
                      size="small"
                      onClick={() => setDeleteProductKey(productKey(params.row.product?.name, params.row.product?.version))}
                    >
                      <TrashIcon size={16} />
                    </IconButton>
                  </CellCenter>
                ),
              },
            ]}
          />
        </Box>
      )}

      <Stack direction="row" spacing={2} sx={{ justifyContent: "flex-end" }}>
        <Button variant="outlined" disabled={!isDirty} onClick={handleReset}>
          Reset
        </Button>
        <Button variant="contained" disabled={!isDirty} loading={saveAnalysis.isPending} onClick={() => void handleAnalyze()}>
          Analyze
        </Button>
      </Stack>

      <Dialog open={isAddProductOpen} onClose={() => setIsAddProductOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add Compatible Product</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Autocomplete<string, false, false, false>
              options={Object.keys(meta.data?.products ?? {})}
              value={selectedProductName}
              onChange={(_event, value) => {
                setSelectedProductName(value);
                setSelectedVersion(null);
              }}
              renderInput={(params) => <TextField {...params} label="Product" required />}
            />
            <Autocomplete<string, false, false, false>
              disabled={!selectedProductName}
              options={availableVersions}
              value={selectedVersion}
              onChange={(_event, value) => setSelectedVersion(value)}
              renderInput={(params) => <TextField {...params} label="Version" required />}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsAddProductOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!selectedProductName || !selectedVersion} onClick={addProduct}>
            Add
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(addFileTarget)} onClose={() => setAddFileTarget(null)} fullWidth maxWidth="sm">
        <DialogTitle>Add File to Product</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Product" value={`${addFileTarget?.productName ?? ""} - ${addFileTarget?.baseVersion ?? ""}`} disabled fullWidth />
            <Autocomplete<string, false, false, false>
              options={compatibleFiles.map((f) => f.file ?? "").filter(Boolean)}
              value={chosenFile}
              onChange={(_event, value) => setChosenFile(value)}
              renderInput={(params) => <TextField {...params} label="Choose File" required />}
            />
            {chosenFile &&
              (() => {
                const fileDetails = compatibleFiles.find((f) => f.file === chosenFile);
                return (
                  <>
                    <TextField label="Operation" value={fileDetails?.operation ?? ""} disabled fullWidth />
                    <TextField label="Source" value={fileDetails?.downloadURL ?? ""} disabled fullWidth />
                  </>
                );
              })()}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddFileTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!chosenFile}
            onClick={() => {
              const fileDetails = compatibleFiles.find((f) => f.file === chosenFile);
              if (fileDetails) addFileToProduct(fileDetails);
            }}
          >
            Submit
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteProductKey)} onClose={() => setDeleteProductKey(null)}>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>Are you sure you want to delete this product?</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteProductKey(null)}>Cancel</Button>
          <Button variant="contained" onClick={confirmDeleteProduct}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={ignoredReasonDialogOpen} onClose={() => setIgnoredReasonDialogOpen(false)}>
        <DialogTitle>Partially Applicable Ignored Products</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Please add products to this update or create separate updates for other applicable products.
          </DialogContentText>
          <DialogContentText sx={{ mt: 2 }}>
            Automated partially applicable check is disabled and the update will be sent only to the specified
            products as this update meets the below criteria.
          </DialogContentText>
          <DialogContentText sx={{ mt: 2, fontWeight: 600 }}>{ignoredReasonMessages.join(" ")}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setIgnoredReasonDialogOpen(false)}>
            Ok
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function ProductAccordion({
  title,
  chipLabel,
  chipColor,
  actions,
  children,
}: {
  title: string;
  chipLabel: string;
  chipColor: "success" | "warning";
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Accordion defaultExpanded disableGutters>
      <AccordionSummary expandIcon={<ChevronDownIcon size={18} />}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center", justifyContent: "space-between", width: "100%", pr: 1 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Typography variant="h6">{title}</Typography>
            <Chip label={chipLabel} color={chipColor} size="small" />
          </Stack>
          {actions && (
            <Box onClick={(e) => e.stopPropagation()}>{actions}</Box>
          )}
        </Stack>
      </AccordionSummary>
      <AccordionDetails>{children}</AccordionDetails>
    </Accordion>
  );
}

function FileGroups({ files }: { files: UmtFileOperation[] }) {
  const { added, modified, removed, other } = groupFileOperationsByType(files);
  const groups = [
    { title: "Added Files", rows: added },
    { title: "Modified Files", rows: modified },
    { title: "Removed Files", rows: removed },
    { title: "Other Files", rows: other },
  ];

  return (
    <Stack spacing={2}>
      {groups.map(({ title, rows }) =>
        rows.length === 0 ? null : (
          <Box key={title}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
              {title} ({rows.length})
            </Typography>
            <FileTable rows={rows} />
          </Box>
        ),
      )}
      {added.length === 0 && modified.length === 0 && removed.length === 0 && other.length === 0 && (
        <List sx={{ color: "text.secondary" }}>No files.</List>
      )}
    </Stack>
  );
}

function FileTable({ rows }: { rows: UmtFileOperation[] }) {
  const columns: DenseColumn<UmtFileOperation>[] = [
    { key: "file", label: "Files", render: (row) => row.file ?? "N/A" },
    { key: "operation", label: "Operation", render: (row) => row.operation ?? "N/A" },
    {
      key: "source",
      label: "Source",
      render: (row) =>
        row.downloadURL ? (
          <Link href={row.downloadURL} target="_blank" rel="noopener noreferrer" underline="hover">
            {row.downloadURL}
          </Link>
        ) : (
          "N/A"
        ),
    },
  ];
  const gridRows = rows.map((row, index) => ({ id: row.file ?? String(index), value: row }));
  const gridColumns: DataGrid.GridColDef[] = columns.map((column) => ({
    field: column.key,
    flex: 1,
    headerName: column.label,
    minWidth: 160,
    sortable: false,
    renderCell: (params) => <CellCenter>{column.render(params.row.value as UmtFileOperation)}</CellCenter>,
  }));

  return (
    <Paper variant="outlined" sx={{ minWidth: 0, overflow: "hidden" }}>
      <DataGridComponent
        autoHeight
        columnHeaderHeight={40}
        columns={gridColumns}
        disableColumnMenu
        disableRowSelectionOnClick
        getRowHeight={() => "auto"}
        hideFooter
        rows={gridRows}
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

function CellCenter({ children }: { children: ReactNode }) {
  return (
    <Stack sx={{ justifyContent: "center", minHeight: "100%", py: 0.75, width: "100%" }}>{children}</Stack>
  );
}
