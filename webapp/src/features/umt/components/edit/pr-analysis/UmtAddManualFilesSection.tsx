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

import { useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  DataGrid,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { PlusIcon, TrashIcon, UploadIcon } from "@wso2/oxygen-ui-icons-react";
import JSZip from "jszip";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import {
  bundleInfoApplies,
  bundlesInfoPathError,
  extractZipEntriesWithinLimits,
  githubRawUrlError,
  isManualFileTooLarge,
  isZipDisallowedForPath,
  jarNameError,
  manualFileNameMatchesPath,
  manualFilePathError,
  relativeJarPathError,
  sourceUrlFileNameError,
  umtSvnLocationRegex,
  UmtZipRejectedError,
  zipTargetDirectory,
} from "../../../lib/umtPrAnalysis";
import type { UmtBundleInfoChange, UmtFileOperation } from "../../../api/umtUpdates";
import { useUmtUploadPullRequestAnalysisFile } from "../../../api/useUmtPrAnalysis";
import { renderLinkValue } from "../../umtViewSectionPrimitives";

const { DataGrid: DataGridComponent } = DataGrid;

class UmtPartialZipUploadError extends Error {
  constructor(
    public readonly uploadedRows: UmtFileOperation[],
    public readonly failedEntry: string,
    public readonly uploadCause: unknown,
  ) {
    super(
      `Uploaded ${uploadedRows.length} entr${uploadedRows.length === 1 ? "y" : "ies"} before "${failedEntry}" failed.`,
    );
    this.name = "UmtPartialZipUploadError";
  }
}

type UmtManualFileOperation = "Added" | "Modified" | "Removed";
type UmtManualFileSource = "upload" | "svn" | "github";
type UmtBundleEntryType = "New" | "Update" | "Delete";

interface UmtAddManualFilesSectionProps {
  updateId: string;
  disabled: boolean;
  files: UmtFileOperation[];
  onFilesChange: (files: UmtFileOperation[]) => void;
  bundlesInfoChanges: UmtBundleInfoChange[];
  onBundlesInfoChanged: (changes: UmtBundleInfoChange[]) => void;
  onDirty: () => void;
}

/** Manual Files section of the PR Analysis step, with its Add Manual File dialog. */
export default function UmtAddManualFilesSection({
  updateId,
  disabled,
  files,
  onFilesChange,
  bundlesInfoChanges,
  onBundlesInfoChanged,
  onDirty,
}: UmtAddManualFilesSectionProps) {
  const upload = useUmtUploadPullRequestAnalysisFile(updateId);
  const { showError, showWarning } = useNotifications();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [relativePath, setRelativePath] = useState("");
  const [operation, setOperation] = useState<UmtManualFileOperation | "">("");
  const [source, setSource] = useState<UmtManualFileSource>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [svnLocation, setSvnLocation] = useState("");
  const [githubRawUrl, setGithubRawUrl] = useState("");
  const [formError, setFormError] = useState<string | undefined>();

  const [bundlesInfoPath, setBundlesInfoPath] = useState("");
  const [jarName, setJarName] = useState("");
  const [jarVersion, setJarVersion] = useState("");
  const [relativeJarPath, setRelativeJarPath] = useState("");
  const [entryType, setEntryType] = useState<UmtBundleEntryType>("New");

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteBundleTarget, setDeleteBundleTarget] = useState<string | null>(null);
  // Stable per-entry ids independent of `bundlesInfoPath`, so two entries
  // sharing a path never collapse into a single grid row or get deleted
  // together; the collision itself is surfaced inline for the user to resolve.
  const bundleEntryIdsRef = useRef(new WeakMap<UmtBundleInfoChange, string>());
  const nextBundleEntryId = useRef(0);
  function bundleEntryId(row: UmtBundleInfoChange): string {
    const cache = bundleEntryIdsRef.current;
    let id = cache.get(row);
    if (!id) {
      id = `bundle-${nextBundleEntryId.current++}`;
      cache.set(row, id);
    }
    return id;
  }
  // Same reasoning, for the manual-files grid: a zip entry can legitimately
  // land on a path an earlier add already produced, and `row.file` as a grid id
  // collapses the two into one row while a value-based delete filter removes
  // both. Ids only need to be stable within a session, so a WeakMap keyed on
  // the row object is enough — `files` is replaced wholesale but the individual
  // row objects are carried over by spread.
  const fileEntryIdsRef = useRef(new WeakMap<UmtFileOperation, string>());
  const nextFileEntryId = useRef(0);
  function fileEntryId(row: UmtFileOperation): string {
    const cache = fileEntryIdsRef.current;
    let id = cache.get(row);
    if (!id) {
      id = `manual-file-${nextFileEntryId.current++}`;
      cache.set(row, id);
    }
    return id;
  }
  // Spans the whole Add operation, including every sequential upload inside
  // a zip's entry loop — unlike `upload.isPending`, which flips true/false
  // once per individual mutateAsync call and made the button (and its
  // cursor) flicker across a multi-entry zip.
  const [isSubmitting, setIsSubmitting] = useState(false);

  const needsBundleInfo = bundleInfoApplies(relativePath, operation);
  const relativePathError = relativePath ? manualFilePathError(relativePath) : undefined;

  function resetForm() {
    setRelativePath("");
    setOperation("");
    setSource("upload");
    setSelectedFile(null);
    setSvnLocation("");
    setGithubRawUrl("");
    setFormError(undefined);
    setBundlesInfoPath("");
    setJarName("");
    setJarVersion("");
    setRelativeJarPath("");
    setEntryType("New");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    // Clear whatever was previously selected up front — otherwise a rejected
    // replacement (too large, wrong extension, name mismatch) would leave the
    // *previous* file both showing in the dialog and attached to Add.
    setSelectedFile(null);
    const file = event.target.files?.[0];
    if (!file) return;

    if (isManualFileTooLarge(file)) {
      showError("The file exceeds 50MB. Please provide an SVN location instead.");
      event.target.value = "";
      return;
    }
    if (isZipDisallowedForPath(file.name, relativePath)) {
      showError("Zip files are not supported for the /plugins directory.");
      event.target.value = "";
      return;
    }
    if (!manualFileNameMatchesPath(file.name, relativePath)) {
      showError("The uploaded file name does not match the file path name.");
      event.target.value = "";
      return;
    }
    setSelectedFile(file);
  }

  /** Validates the Add Manual File form, then uploads the file or zip and adds its rows. */
  async function handleAdd() {
    setFormError(undefined);
    if (!relativePath.trim() || !operation) {
      setFormError("Path and operation are required.");
      return;
    }
    const pathError = manualFilePathError(relativePath);
    if (pathError) {
      setFormError(pathError);
      return;
    }

    const svnTrimmed = svnLocation.trim();
    const githubTrimmed = githubRawUrl.trim();
    if (source === "upload" && !selectedFile) {
      setFormError("Choose a file to upload.");
      return;
    }
    if (source === "svn") {
      if (!svnTrimmed || !umtSvnLocationRegex(updateId).test(svnTrimmed)) {
        setFormError(
          "SVN location should start with http/https, contain '/svn/largefileSVN/', and contain the update ID.",
        );
        return;
      }
    }
    if (source === "github") {
      const githubError = githubRawUrlError(githubTrimmed);
      if (githubError) {
        setFormError(githubError);
        return;
      }
    }

    if (needsBundleInfo) {
      const errors = [
        bundlesInfoPathError(bundlesInfoPath),
        jarNameError(jarName, jarVersion),
        relativeJarPathError(relativeJarPath),
      ].filter(Boolean);
      if (!bundlesInfoPath.trim() || !jarName.trim() || !relativeJarPath.trim() || errors.length > 0) {
        setFormError(errors[0] ?? "Bundle info fields are required for plugin JAR changes.");
        return;
      }
      if (bundlesInfoChanges.some((row) => row.bundlesInfoPath === bundlesInfoPath.trim())) {
        setFormError("This Bundle Info has already been added.");
        return;
      }
    }

    // The externally-sourced path (SVN location or GitHub raw URL) that the
    // backend's `sourceFilePath` field carries when there is no local file —
    // routed through the same field GitHub-raw URLs already use, so validated
    // user input is never silently dropped.
    const sourceFilePath = source === "svn" ? svnTrimmed : source === "github" ? githubTrimmed : "";
    // Only ever carry the locally-picked file when "Upload File" is the
    // chosen source — otherwise a file picked earlier under "Upload File"
    // and left selected while the user switches to SVN/GitHub would get
    // uploaded instead of the URL-only placeholder those sources expect.
    const fileForUpload = source === "upload" ? selectedFile : null;

    // The Java tool rejects a duplicate manual path *before* uploading anything
    // ("<path> file is already added to the uploading file list"), so do the
    // same here for a single file, whose resolved path is known up front. A
    // zip's entries aren't known until it is unpacked and uploaded, so that
    // case can only be reported afterwards — see below.
    const isZip = Boolean(fileForUpload?.name.toLowerCase().endsWith(".zip"));
    if (!isZip) {
      if (!fileForUpload) {
        const fileNameError = sourceUrlFileNameError(lastPathSegment(sourceFilePath));
        if (fileNameError) {
          setFormError(fileNameError);
          return;
        }
      }
      const filePath = singleEntryFilePath(fileForUpload, relativePath, sourceFilePath);
      if (files.some((row) => row.file === filePath)) {
        setFormError(`"${filePath}" has already been added.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const newRows = isZip
        ? await addZipEntries(fileForUpload as File, relativePath, operation, sourceFilePath)
        : await addSingleEntry(fileForUpload, relativePath, operation, sourceFilePath);

      // Zip entries are already on the server by now, so refusing them would
      // orphan the uploads (the failure mode #14 fixed). The stable row ids
      // above make a duplicate path addressable instead — both rows render and
      // either can be deleted — so add them and say which ones collided.
      const existingPaths = new Set(files.map((row) => row.file));
      const collisions = newRows.filter((row) => existingPaths.has(row.file));
      if (collisions.length > 0) {
        showWarning(
          collisions.length === 1
            ? `"${collisions[0].file}" was already in the list and has been added again. Delete whichever entry you don't want.`
            : `${collisions.length} of these files were already in the list (e.g. "${collisions[0].file}") and have been added again. Delete whichever entries you don't want.`,
        );
      }

      onFilesChange([...files, ...newRows]);
      if (needsBundleInfo) {
        onBundlesInfoChanged([
          ...bundlesInfoChanges,
          {
            bundlesInfoPath: bundlesInfoPath.trim(),
            jarName: jarName.trim(),
            jarVersion,
            relativeJarPath: relativeJarPath.trim(),
            entryType,
          },
        ]);
      }
      onDirty();
      resetForm();
      setIsOpen(false);
    } catch (error) {
      if (error instanceof UmtZipRejectedError) {
        setFormError(error.message);
      } else if (error instanceof UmtPartialZipUploadError) {
        if (error.uploadedRows.length > 0) {
          onFilesChange([...files, ...error.uploadedRows]);
          onDirty();
        }
        // Deliberately leave the dialog open and the form populated so the user
        // can see which zip failed and retry the remaining entries.
        showError(
          `${error.message} ${describeError(error.uploadCause)} Remove the listed files and retry the remaining ones.`,
        );
      } else {
        showError(`Upload failed. ${describeError(error)}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function addSingleEntry(
    file: File | null,
    path: string,
    op: UmtManualFileOperation,
    sourceFilePath: string,
  ): Promise<UmtFileOperation[]> {
    await upload.mutateAsync({
      relativePath: path,
      sourceFilePath,
      file: file ?? new Blob([], { type: "application/octet-stream" }),
    });
    return [{ file: singleEntryFilePath(file, path, sourceFilePath), operation: op, sourceFilePath }];
  }

  /** Checks and unpacks a zip, then uploads its entries into the target directory. */
  async function addZipEntries(
    zipFile: File,
    path: string,
    op: UmtManualFileOperation,
    sourceFilePath: string,
  ): Promise<UmtFileOperation[]> {
    const zip = await JSZip.loadAsync(zipFile);
    const entries = Object.values(zip.files).filter((entry) => !entry.dir);
    const extracted = await extractZipEntriesWithinLimits(entries);
    const rows: UmtFileOperation[] = [];
    // Resolve once: `path` may still carry the archive's own name on the end,
    // which would otherwise become a directory segment in every entry's path.
    const targetDir = zipTargetDirectory(path, zipFile.name);

    for (const entry of extracted) {
      const extractedFile = new File([entry.blob], entry.name);
      try {
        await upload.mutateAsync({ relativePath: targetDir, sourceFilePath, file: extractedFile });
      } catch (error) {
        // Entries already uploaded exist on the server. Hand them back so the
        // caller can still list them — otherwise they're orphaned: invisible in
        // the grid, undeletable, and re-uploaded if the user retries the zip.
        throw new UmtPartialZipUploadError(rows, entry.name, error);
      }
      rows.push({ file: `${targetDir}/${entry.name}`, operation: op, sourceFilePath });
    }

    return rows;
  }

  function confirmDeleteFile() {
    if (!deleteTarget) return;
    onFilesChange(files.filter((row) => fileEntryId(row) !== deleteTarget));
    onDirty();
    setDeleteTarget(null);
  }

  function confirmDeleteBundleInfo() {
    if (!deleteBundleTarget) return;
    onBundlesInfoChanged(bundlesInfoChanges.filter((row) => bundleEntryId(row) !== deleteBundleTarget));
    onDirty();
    setDeleteBundleTarget(null);
  }

  return (
    <Box sx={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? "none" : "auto" }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mt: 2 }}>
        <Typography variant="h6">Manual Files</Typography>
        <IconButton aria-label="Add manual file" size="small" onClick={() => setIsOpen(true)}>
          <PlusIcon size={18} />
        </IconButton>
      </Stack>

      {files.length > 0 ? (
        <DataGridComponent
          autoHeight
          columnHeaderHeight={40}
          disableColumnMenu
          disableRowSelectionOnClick
          getRowHeight={() => "auto"}
          getRowId={(row: UmtFileOperation) => fileEntryId(row)}
          hideFooter
          rows={files}
          sx={{ mt: 2, ...denseDataGridSx }}
          columns={[
            {
              field: "file",
              headerName: "File",
              flex: 3,
              sortable: false,
              renderCell: (params: { row: UmtFileOperation }) => (
                <Stack sx={{ justifyContent: "center", minHeight: "100%", py: 0.75, width: "100%" }}>
                  {params.row.file}
                </Stack>
              ),
            },
            {
              field: "operation",
              headerName: "Operation",
              flex: 1,
              sortable: false,
              renderCell: (params: { row: UmtFileOperation }) => (
                <Stack sx={{ justifyContent: "center", minHeight: "100%", py: 0.75, width: "100%" }}>
                  {params.row.operation}
                </Stack>
              ),
            },
            {
              field: "sourceFilePath",
              headerName: "Source",
              flex: 2,
              sortable: false,
              // renderLinkValue never emits an href for a non-http(s) value.
              // Input validation only covers rows this UI creates; rows loaded
              // from the backend (including ones written by the legacy tool)
              // bypass it entirely, so the guard has to be here too.
              renderCell: (params: { row: UmtFileOperation }) => (
                <Stack sx={{ justifyContent: "center", minHeight: "100%", py: 0.75, width: "100%" }}>
                  {renderLinkValue(params.row.sourceFilePath)}
                </Stack>
              ),
            },
            {
              field: "delete",
              headerName: "",
              width: 52,
              sortable: false,
              renderCell: (params: { row: UmtFileOperation }) => (
                <Stack sx={{ justifyContent: "center", minHeight: "100%", width: "100%" }}>
                  <IconButton
                    aria-label="Delete file"
                    size="small"
                    onClick={() => setDeleteTarget(fileEntryId(params.row))}
                  >
                    <TrashIcon size={16} />
                  </IconButton>
                </Stack>
              ),
            },
          ]}
        />
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          No manual files added.
        </Typography>
      )}

      {bundlesInfoChanges.length > 0 && (
        <DataGridComponent
          autoHeight
          columnHeaderHeight={40}
          disableColumnMenu
          disableRowSelectionOnClick
          getRowHeight={() => "auto"}
          getRowId={(row: UmtBundleInfoChange) => bundleEntryId(row)}
          hideFooter
          rows={bundlesInfoChanges}
          sx={{ mt: 2 }}
          columns={[
            {
              field: "bundlesInfoPath",
              headerName: "Bundles Info Path",
              flex: 3,
              sortable: false,
              renderCell: (params: { row: UmtBundleInfoChange }) => (
                <Stack sx={{ justifyContent: "center", minHeight: "100%", py: 0.75, width: "100%" }}>
                  {params.row.bundlesInfoPath}
                </Stack>
              ),
            },
            {
              field: "jarName",
              headerName: "JAR Name",
              flex: 2,
              sortable: false,
              renderCell: (params: { row: UmtBundleInfoChange }) => (
                <Stack sx={{ justifyContent: "center", minHeight: "100%", py: 0.75, width: "100%" }}>
                  {params.row.jarName}
                </Stack>
              ),
            },
            {
              field: "relativeJarPath",
              headerName: "Relative JAR Path",
              flex: 3,
              sortable: false,
              renderCell: (params: { row: UmtBundleInfoChange }) => (
                <Stack sx={{ justifyContent: "center", minHeight: "100%", py: 0.75, width: "100%" }}>
                  {params.row.relativeJarPath}
                </Stack>
              ),
            },
            {
              field: "entryType",
              headerName: "Change Type",
              flex: 1,
              sortable: false,
              renderCell: (params: { row: UmtBundleInfoChange }) => (
                <Stack sx={{ justifyContent: "center", minHeight: "100%", py: 0.75, width: "100%" }}>
                  {params.row.entryType}
                </Stack>
              ),
            },
            {
              field: "delete",
              headerName: "",
              width: 52,
              sortable: false,
              renderCell: (params: { row: UmtBundleInfoChange }) => (
                <Stack sx={{ justifyContent: "center", minHeight: "100%", width: "100%" }}>
                  <IconButton
                    aria-label="Delete bundle info entry"
                    size="small"
                    onClick={() => setDeleteBundleTarget(bundleEntryId(params.row))}
                  >
                    <TrashIcon size={16} />
                  </IconButton>
                </Stack>
              ),
            },
          ]}
        />
      )}

      <Dialog open={isOpen} onClose={() => setIsOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add Manual File</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Path in Product Pack"
              value={relativePath}
              onChange={(e) => setRelativePath(e.target.value)}
              error={Boolean(relativePathError)}
              helperText={relativePathError}
            />
            <FormControl fullWidth>
              <InputLabel id="manual-file-operation-label">Operation</InputLabel>
              <Select
                labelId="manual-file-operation-label"
                label="Operation"
                value={operation}
                onChange={(e) => setOperation(e.target.value as UmtManualFileOperation)}
              >
                <MenuItem value="Added">Added</MenuItem>
                <MenuItem value="Modified">Modified</MenuItem>
                <MenuItem value="Removed">Removed</MenuItem>
              </Select>
            </FormControl>

            <RadioGroup
              row
              value={source}
              onChange={(e) => {
                const nextSource = e.target.value as UmtManualFileSource;
                setSource(nextSource);
                if (nextSource !== "upload") {
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }
              }}
            >
              <FormControlLabel value="upload" control={<Radio />} label="Upload File" />
              <FormControlLabel value="svn" control={<Radio />} label="SVN Location" />
              <FormControlLabel value="github" control={<Radio />} label="GitHub Raw URL" />
            </RadioGroup>

            {source === "upload" && (
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<UploadIcon size={16} />}
                >
                  Choose File
                  <input ref={fileInputRef} hidden type="file" onChange={handleFileChange} />
                </Button>
                {selectedFile && <Typography variant="body2">{selectedFile.name}</Typography>}
              </Stack>
            )}
            {source === "svn" && (
              <TextField
                fullWidth
                label="SVN Location"
                value={svnLocation}
                onChange={(e) => setSvnLocation(e.target.value)}
              />
            )}
            {source === "github" && (
              <TextField
                fullWidth
                label="GitHub Raw Source URL"
                value={githubRawUrl}
                onChange={(e) => setGithubRawUrl(e.target.value)}
              />
            )}

            {needsBundleInfo && (
              <>
                <Divider />
                <Typography variant="subtitle2">Bundle Info Changes</Typography>
                <TextField
                  fullWidth
                  label="Bundles Info Path"
                  value={bundlesInfoPath}
                  onChange={(e) => setBundlesInfoPath(e.target.value)}
                  error={Boolean(bundlesInfoPath) && Boolean(bundlesInfoPathError(bundlesInfoPath))}
                  helperText={bundlesInfoPath ? bundlesInfoPathError(bundlesInfoPath) : undefined}
                />
                <TextField
                  fullWidth
                  label="JAR Name"
                  value={jarName}
                  onChange={(e) => setJarName(e.target.value)}
                  error={Boolean(jarName) && Boolean(jarNameError(jarName, jarVersion))}
                  helperText={jarName ? jarNameError(jarName, jarVersion) : undefined}
                />
                <TextField
                  fullWidth
                  label="JAR Version"
                  value={jarVersion}
                  onChange={(e) => setJarVersion(e.target.value)}
                />
                <TextField
                  fullWidth
                  label="Relative JAR Path"
                  value={relativeJarPath}
                  onChange={(e) => setRelativeJarPath(e.target.value)}
                  error={Boolean(relativeJarPath) && Boolean(relativeJarPathError(relativeJarPath))}
                  helperText={relativeJarPath ? relativeJarPathError(relativeJarPath) : undefined}
                />
                <FormControl fullWidth>
                  <InputLabel id="bundle-info-change-type-label">Change Type</InputLabel>
                  <Select
                    labelId="bundle-info-change-type-label"
                    label="Change Type"
                    value={entryType}
                    onChange={(e) => setEntryType(e.target.value as UmtBundleEntryType)}
                  >
                    <MenuItem value="New">New</MenuItem>
                    <MenuItem value="Update">Update</MenuItem>
                    <MenuItem value="Delete">Delete</MenuItem>
                  </Select>
                </FormControl>
              </>
            )}

            {formError && <Alert severity="error">{formError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button variant="contained" loading={isSubmitting} onClick={() => void handleAdd()}>
            Add
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>Are you sure you want to delete this file?</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="contained" onClick={confirmDeleteFile}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteBundleTarget)} onClose={() => setDeleteBundleTarget(null)}>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>Are you sure you want to delete this bundle info entry?</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteBundleTarget(null)}>Cancel</Button>
          <Button variant="contained" onClick={confirmDeleteBundleInfo}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// getRowHeight="auto" above only lets the ROW grow to fit its content — MUI
// DataGrid's own cell CSS still clips text with nowrap/ellipsis unless
// explicitly told to wrap. Long File/Source values (paths, URLs) were
// getting cut off with no way to read them; this lets them wrap and the auto
// row height then grows to fit the wrapped lines.
const denseDataGridSx = {
  border: 0,
  "& .MuiDataGrid-cell": {
    whiteSpace: "normal",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
  },
} as const;

// `path` may already be the full file path — manualFileNameMatchesPath accepts
// a relativePath whose last segment equals the uploaded file's name — so only
// append fileName when path is still just the directory. Resolved without the
// upload so handleAdd can check for a duplicate before sending anything.
function singleEntryFilePath(file: File | null, path: string, sourceFilePath: string): string {
  const fileName = file?.name ?? lastPathSegment(sourceFilePath);
  return path.endsWith(`/${fileName}`) ? path : `${path}/${fileName}`;
}

function lastPathSegment(url: string): string {
  const withoutQuery = url.split("?")[0] ?? url;
  return withoutQuery.split("/").filter(Boolean).pop() ?? "";
}
