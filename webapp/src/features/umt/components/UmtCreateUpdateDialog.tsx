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

import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  AdapterDateFns,
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  DatePickers,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Link,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { XIcon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { UmtCreateUpdateRequest, UmtUpdateSummary } from "../api/umtUpdates";
import { useUmtMeta } from "../api/useUmtMeta";
import { useUmtCheckDuplicateUpdatesByCaseId, useUmtCreateUpdate } from "../api/useUmtCreateUpdate";
import {
  buildUmtCreateUpdateRequest,
  isAfterDay,
  isCreateUpdateFormValid,
  isValidCaseId,
  isValidEstimateDate,
  isValidGithubIssueUrl,
  laterDate,
  nextThursday,
  resolveCreateUpdateProductId,
  type UmtCreateIssueType,
  type UmtCreateUpdateFormValues,
  type UmtCreateUpdateType,
} from "../lib/umtCreateUpdate";

const { DatePicker, LocalizationProvider } = DatePickers;

// Create submits POST /update, and first runs a client-side duplicate-case
// pre-check (see UmtDuplicateUpdatesDialog below). The backend's own
// duplicate rejection is hotfix-specific and only ever surfaces as an error
// from the create call itself; there is no separate pre-check endpoint.
export default function UmtCreateUpdateDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const meta = useUmtMeta();
  const navigate = useNavigate();
  const { showSuccess } = useNotifications();
  const checkDuplicates = useUmtCheckDuplicateUpdatesByCaseId();
  const createUpdate = useUmtCreateUpdate();

  const [isProactive, setIsProactive] = useState(false);
  const [isHotfix, setIsHotfix] = useState(false);
  const [updateType, setUpdateType] = useState<UmtCreateUpdateType>("regular");
  const [issueType, setIssueType] = useState<UmtCreateIssueType>("bug");
  const [caseId, setCaseId] = useState("");
  const [internalGitIssue, setInternalGitIssue] = useState("");
  const [publicOrSecurityGitIssue, setPublicOrSecurityGitIssue] = useState("");
  const [product, setProduct] = useState<string | null>(null);
  const [showAllVersions, setShowAllVersions] = useState(false);
  const [version, setVersion] = useState<string | null>(null);
  const [bestCaseEstimate, setBestCaseEstimate] = useState<Date | null>(nextThursday);
  const [mostLikelyEstimate, setMostLikelyEstimate] = useState<Date | null>(() =>
    laterDate(nextThursday(), 7),
  );
  const [worstCaseEstimate, setWorstCaseEstimate] = useState<Date | null>(() =>
    laterDate(nextThursday(), 14),
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateResults, setDuplicateResults] = useState<UmtUpdateSummary[]>([]);
  const [pendingRequest, setPendingRequest] = useState<UmtCreateUpdateRequest | null>(null);

  const isSecurityUpdate = updateType === "security";
  const isCloudSupportUpdate = updateType === "cloud-support";

  const productOptions = useMemo(() => {
    const names = Object.keys(meta.data?.products ?? {});
    // Cloud-support updates are limited to the two cloud products in the source.
    return isCloudSupportUpdate
      ? names.filter((name) => ["asgardeo", "choreo"].includes(name.toLowerCase()))
      : names;
  }, [meta.data?.products, isCloudSupportUpdate]);

  const versionOptions = useMemo(() => {
    if (!product) return [];
    // Default to each row's latest supported version; the checkbox exposes the
    // source product versions when an older target is required.
    const versions = (meta.data?.products[product] ?? []).map((item) =>
      showAllVersions ? item.version : item.latestVersion,
    );
    return [...new Set(versions.filter(Boolean))];
  }, [meta.data?.products, product, showAllVersions]);

  const productId = resolveCreateUpdateProductId(
    meta.data?.products ?? {},
    product,
    version,
    showAllVersions,
    isCloudSupportUpdate,
  );

  const formValues: UmtCreateUpdateFormValues = {
    isProactive,
    isHotfix,
    updateType,
    issueType,
    caseId,
    internalGitIssue,
    publicOrSecurityGitIssue,
    productId,
    bestCaseEstimate,
    mostLikelyEstimate,
    worstCaseEstimate,
  };
  const isFormValid = isCreateUpdateFormValid(formValues);

  // Per-field validation messages, surfaced only once a date is present (a
  // blank/invalid field is already covered by the DatePicker's own
  // required/invalid state).
  const isValidDate = (date: Date | null): date is Date => date !== null && !Number.isNaN(date.getTime());
  const bestCaseEstimateError =
    isValidDate(bestCaseEstimate) && !isValidEstimateDate(bestCaseEstimate, isHotfix)
      ? "Best Case Date must be a Thursday unless it's a Hotfix."
      : undefined;
  const mostLikelyEstimateError = !isValidDate(mostLikelyEstimate)
    ? undefined
    : isValidDate(bestCaseEstimate) && !isAfterDay(bestCaseEstimate, mostLikelyEstimate)
      ? "Must be after Best Case Estimate."
      : !isValidEstimateDate(mostLikelyEstimate, isHotfix)
        ? "Most Likely Date must be a Thursday unless it's a Hotfix."
        : undefined;
  const worstCaseEstimateError = !isValidDate(worstCaseEstimate)
    ? undefined
    : isValidDate(mostLikelyEstimate) && !isAfterDay(mostLikelyEstimate, worstCaseEstimate)
      ? "Must be after Most Likely Estimate."
      : !isValidEstimateDate(worstCaseEstimate, isHotfix)
        ? "Worst Case Date must be a Thursday unless it's a Hotfix."
        : undefined;

  const isChecking = checkDuplicates.isPending;
  const isCreating = createUpdate.isPending;
  const isBusy = isChecking || isCreating;

  // Shared by handleClose and the Hotfix toggle: resets all three estimates
  // to next-Thursday/+7/+14 whenever Hotfix turns off, so a date typed or
  // picked while Hotfix allowed any day can't be left violating the
  // Thursday rule.
  function resetEstimatesToNextThursday() {
    const nextEstimate = nextThursday();
    setBestCaseEstimate(nextEstimate);
    setMostLikelyEstimate(laterDate(nextEstimate, 7));
    setWorstCaseEstimate(laterDate(nextEstimate, 14));
  }

  // Dialog visibility does not unmount this component, so reset explicitly to
  // avoid carrying abandoned form values into the next creation attempt.
  const handleClose = () => {
    if (isBusy) return;
    setIsProactive(false);
    setIsHotfix(false);
    setUpdateType("regular");
    setIssueType("bug");
    setCaseId("");
    setInternalGitIssue("");
    setPublicOrSecurityGitIssue("");
    setProduct(null);
    setShowAllVersions(false);
    setVersion(null);
    resetEstimatesToNextThursday();
    setSubmitError(null);
    setDuplicateDialogOpen(false);
    setDuplicateResults([]);
    setPendingRequest(null);
    onClose();
  };

  async function submitCreate(request: UmtCreateUpdateRequest) {
    try {
      const created = await createUpdate.mutateAsync(request);
      const newId = created[0]?.id;
      showSuccess("Update created successfully.");
      handleClose();
      if (newId) navigate(`/umt/updates/${newId}`);
    } catch (error) {
      setSubmitError(describeError(error));
      setDuplicateDialogOpen(false);
    }
  }

  async function handleCreateClick() {
    setSubmitError(null);
    if (!isFormValid || productId === null) return;
    const request = buildUmtCreateUpdateRequest(formValues);

    if (!isProactive && caseId.trim()) {
      try {
        const response = await checkDuplicates.mutateAsync(caseId.trim());
        const existing = response.updates ?? [];
        if (existing.length > 0) {
          setDuplicateResults([...existing].sort((a, b) => b.id - a.id));
          setPendingRequest(request);
          setDuplicateDialogOpen(true);
          return;
        }
      } catch (error) {
        setSubmitError(describeError(error));
        return;
      }
    }

    await submitCreate(request);
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontSize: 18, fontWeight: 600, pr: 7 }}>
        Create an Update
        <IconButton
          aria-label="Close create update dialog"
          onClick={handleClose}
          disabled={isBusy}
          sx={{ position: "absolute", right: 12, top: 12 }}
        >
          <XIcon size={18} />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {meta.isError && (
          <ErrorNotice
            error={meta.error}
            onRetry={() => void meta.refetch()}
            retrying={meta.isFetching}
            sx={{ mb: 3 }}
          >
            Couldn&apos;t load product and version options.
          </ErrorNotice>
        )}

        <Tabs
          value={isProactive ? "proactive" : "customer"}
          onChange={(_event, value) => setIsProactive(value === "proactive")}
          variant="fullWidth"
          aria-label="Update source"
          sx={{ mb: 3 }}
        >
          <Tab label="Customer Reported" value="customer" />
          <Tab label="Proactive" value="proactive" />
        </Tabs>

        <Stack spacing={2.25}>
          {submitError && <Alert severity="error">{submitError}</Alert>}

          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr auto" } }}>
            <TextField
              label="Case ID"
              required={!isProactive}
              disabled={isProactive}
              size="small"
              value={caseId}
              onChange={(event) => setCaseId(event.target.value)}
              error={!isProactive && caseId.trim().length > 0 && !isValidCaseId(caseId)}
              helperText={
                !isProactive && caseId.trim().length > 0 && !isValidCaseId(caseId)
                  ? "Invalid Case ID."
                  : undefined
              }
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={isHotfix}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setIsHotfix(checked);
                    if (!checked) resetEstimatesToNextThursday();
                  }}
                />
              }
              label="Hotfix"
              disabled={isProactive}
              sx={{ m: 0, alignSelf: "center" }}
            />
          </Box>

          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
            <TextField
              select
              label="Update Type"
              size="small"
              value={updateType}
              onChange={(event) => {
                setUpdateType(event.target.value as UmtCreateUpdateType);
                setProduct(null);
                setVersion(null);
              }}
            >
              <MenuItem value="regular">Regular</MenuItem>
              <MenuItem value="security">Security</MenuItem>
              <MenuItem value="cloud-support">Cloud Support</MenuItem>
            </TextField>
            <TextField
              select
              label="Issue Type"
              size="small"
              value={issueType}
              onChange={(event) => setIssueType(event.target.value as UmtCreateIssueType)}
            >
              <MenuItem value="bug">Bug</MenuItem>
              <MenuItem value="improvement">Improvement</MenuItem>
              <MenuItem value="new-feature">New Feature</MenuItem>
            </TextField>
          </Box>

          <TextField
            label={isSecurityUpdate ? "Security Internal Git Issue" : "Public Git Issue"}
            required
            size="small"
            value={publicOrSecurityGitIssue}
            onChange={(event) => setPublicOrSecurityGitIssue(event.target.value)}
            error={publicOrSecurityGitIssue.length > 0 && !isValidGithubIssueUrl(publicOrSecurityGitIssue)}
            helperText={
              publicOrSecurityGitIssue.length > 0 && !isValidGithubIssueUrl(publicOrSecurityGitIssue)
                ? "Must be a WSO2 GitHub issue URL."
                : undefined
            }
          />
          <TextField
            label="Internal Git Issue"
            required
            size="small"
            value={internalGitIssue}
            onChange={(event) => setInternalGitIssue(event.target.value)}
            error={internalGitIssue.length > 0 && !isValidGithubIssueUrl(internalGitIssue)}
            helperText={
              internalGitIssue.length > 0 && !isValidGithubIssueUrl(internalGitIssue)
                ? "Must be a WSO2 GitHub issue URL."
                : undefined
            }
          />

          <Autocomplete
            options={productOptions}
            value={product}
            loading={meta.isPending}
            disabled={meta.isError}
            onChange={(_event, selected) => {
              setProduct(selected);
              setVersion(null);
              setShowAllVersions(false);
            }}
            renderInput={(params) => <TextField {...params} label="Product" required size="small" />}
          />

          <Box>
            <FormControlLabel
              control={
                <Checkbox
                  checked={showAllVersions}
                  onChange={(event) => {
                    setShowAllVersions(event.target.checked);
                    setVersion(null);
                  }}
                  disabled={!product || isCloudSupportUpdate}
                />
              }
              label="Show all versions"
            />
            <Autocomplete
              options={versionOptions}
              value={version}
              loading={meta.isPending}
              disabled={!product || isCloudSupportUpdate || meta.isError}
              onChange={(_event, selected) => setVersion(selected)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Version"
                  required={!isCloudSupportUpdate}
                  size="small"
                />
              )}
            />
          </Box>

          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Best Case Estimate"
              value={bestCaseEstimate}
              onChange={setBestCaseEstimate}
              disablePast
              shouldDisableDate={(date) => !isHotfix && date.getDay() !== 4}
              slotProps={{
                textField: {
                  required: true,
                  size: "small",
                  error: Boolean(bestCaseEstimateError),
                  helperText: bestCaseEstimateError,
                },
              }}
            />
            <DatePicker
              label="Most Likely Estimate"
              value={mostLikelyEstimate}
              onChange={setMostLikelyEstimate}
              disablePast
              minDate={bestCaseEstimate ?? undefined}
              shouldDisableDate={(date) => !isHotfix && date.getDay() !== 4}
              slotProps={{
                textField: {
                  required: true,
                  size: "small",
                  error: Boolean(mostLikelyEstimateError),
                  helperText: mostLikelyEstimateError,
                },
              }}
            />
            <DatePicker
              label="Worst Case Estimate"
              value={worstCaseEstimate}
              onChange={setWorstCaseEstimate}
              disablePast
              minDate={mostLikelyEstimate ?? undefined}
              shouldDisableDate={(date) => !isHotfix && date.getDay() !== 4}
              slotProps={{
                textField: {
                  required: true,
                  size: "small",
                  error: Boolean(worstCaseEstimateError),
                  helperText: worstCaseEstimateError,
                },
              }}
            />
          </LocalizationProvider>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button variant="outlined" onClick={handleClose} disabled={isBusy}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!isFormValid || isBusy}
          loading={isBusy}
          onClick={() => void handleCreateClick()}
        >
          {isChecking ? "Checking…" : isCreating ? "Creating…" : "Create"}
        </Button>
      </DialogActions>

      <UmtDuplicateUpdatesDialog
        open={duplicateDialogOpen}
        updates={duplicateResults}
        busy={isCreating}
        onCancel={() => {
          setDuplicateDialogOpen(false);
          setPendingRequest(null);
          setDuplicateResults([]);
        }}
        onProceed={() => {
          if (pendingRequest) void submitCreate(pendingRequest);
        }}
      />
    </Dialog>
  );
}

// A confirm dialog listing existing updates for the same case ID, letting
// the user proceed anyway or go back and edit. Not a real backend
// constraint by itself — the backend's own duplicate rejection
// (hotfix-specific) only ever surfaces as an error from the create call,
// surfaced via submitError instead.
function UmtDuplicateUpdatesDialog({
  open,
  updates,
  busy,
  onCancel,
  onProceed,
}: {
  open: boolean;
  updates: UmtUpdateSummary[];
  busy: boolean;
  onCancel: () => void;
  onProceed: () => void;
}) {
  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="sm">
      <DialogTitle>Existing updates found</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          We found existing update(s) for this case ID. Proceed anyway, or cancel and review them first.
        </DialogContentText>
        <Stack spacing={1.5}>
          {updates.map((update) => (
            <Box key={update.id}>
              <Link
                href={`/umt/updates/${update.id}`}
                target="_blank"
                rel="noopener noreferrer"
                underline="hover"
              >
                Update {update.id}
              </Link>
              <Typography variant="body2" color="text.secondary">
                {[
                  update.wso2CaseId ?? "N/A",
                  update.lifecycle ?? "N/A",
                  update.lifecycleState ?? "N/A",
                  (update.products ?? [])
                    .map((p) => `${p.product?.name ?? "N/A"}-${p.product?.version ?? "N/A"}`)
                    .join(", ") || "N/A",
                ].join(" | ")}
              </Typography>
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" loading={busy} onClick={onProceed}>
          Proceed
        </Button>
      </DialogActions>
    </Dialog>
  );
}
