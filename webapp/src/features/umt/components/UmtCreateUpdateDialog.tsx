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
import {
  AdapterDateFns,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  DatePickers,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
} from "@wso2/oxygen-ui";
import { XIcon } from "@wso2/oxygen-ui-icons-react";
import { useUmtMeta } from "../api/useUmtMeta";
import MaintenanceDialog from "./MaintenanceDialog";

const { DatePicker, LocalizationProvider } = DatePickers;

// Regular updates are planned on Thursdays in the source workflow. "Next"
// means a future Thursday even when today is Thursday; the three estimates
// start one week apart and hotfixes may then select any date.
function nextThursday(): Date {
  const date = new Date();
  const days = (4 - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + days);
  return date;
}

function laterDate(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// First-stage port of the source Create Update form. Product/version choices
// are live metadata, but submission remains intentionally unavailable and opens
// MaintenanceDialog until POST /update and duplicate-case handling are ported.
export default function UmtCreateUpdateDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const meta = useUmtMeta();
  const [isProactive, setIsProactive] = useState(false);
  const [isHotfix, setIsHotfix] = useState(false);
  const [updateType, setUpdateType] = useState("regular");
  const [issueType, setIssueType] = useState("bug");
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
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);

  const productOptions = useMemo(() => {
    const names = Object.keys(meta.data?.products ?? {});
    // Cloud-support updates are limited to the two cloud products in the source.
    return updateType === "cloud-support"
      ? names.filter((name) => ["asgardeo", "choreo"].includes(name.toLowerCase()))
      : names;
  }, [meta.data?.products, updateType]);

  const versionOptions = useMemo(() => {
    if (!product) return [];
    // Default to each row's latest supported version; the checkbox exposes the
    // source product versions when an older target is required.
    const versions = (meta.data?.products[product] ?? []).map((item) =>
      showAllVersions ? item.version : item.latestVersion,
    );
    return [...new Set(versions.filter(Boolean))];
  }, [meta.data?.products, product, showAllVersions]);

  const isSecurityUpdate = updateType === "security";
  const isCloudSupportUpdate = updateType === "cloud-support";

  // Dialog visibility does not unmount this component, so reset explicitly to
  // avoid carrying abandoned form values into the next creation attempt.
  const handleClose = () => {
    const nextEstimate = nextThursday();
    setIsProactive(false);
    setIsHotfix(false);
    setUpdateType("regular");
    setIssueType("bug");
    setProduct(null);
    setShowAllVersions(false);
    setVersion(null);
    setBestCaseEstimate(nextEstimate);
    setMostLikelyEstimate(laterDate(nextEstimate, 7));
    setWorstCaseEstimate(laterDate(nextEstimate, 14));
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontSize: 18, fontWeight: 600, pr: 7 }}>
        Create an Update
        <IconButton
          aria-label="Close create update dialog"
          onClick={handleClose}
          sx={{ position: "absolute", right: 12, top: 12 }}
        >
          <XIcon size={18} />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
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
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr auto" } }}>
            <TextField label="Case ID" required={!isProactive} disabled={isProactive} size="small" />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={isHotfix}
                  onChange={(event) => setIsHotfix(event.target.checked)}
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
                setUpdateType(event.target.value);
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
              onChange={(event) => setIssueType(event.target.value)}
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
          />
          <TextField label="Internal Git Issue" required size="small" />

          <Autocomplete
            options={productOptions}
            value={product}
            loading={meta.isPending}
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
              disabled={!product || isCloudSupportUpdate}
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
              slotProps={{ textField: { required: true, size: "small" } }}
            />
            <DatePicker
              label="Most Likely Estimate"
              value={mostLikelyEstimate}
              onChange={setMostLikelyEstimate}
              disablePast
              minDate={bestCaseEstimate ?? undefined}
              shouldDisableDate={(date) => !isHotfix && date.getDay() !== 4}
              slotProps={{ textField: { required: true, size: "small" } }}
            />
            <DatePicker
              label="Worst Case Estimate"
              value={worstCaseEstimate}
              onChange={setWorstCaseEstimate}
              disablePast
              minDate={mostLikelyEstimate ?? undefined}
              shouldDisableDate={(date) => !isHotfix && date.getDay() !== 4}
              slotProps={{ textField: { required: true, size: "small" } }}
            />
          </LocalizationProvider>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button variant="outlined" onClick={handleClose}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => setMaintenanceModalOpen(true)}>
          Create
        </Button>
      </DialogActions>
      <MaintenanceDialog
        open={maintenanceModalOpen}
        onClose={() => setMaintenanceModalOpen(false)}
      />
    </Dialog>
  );
}
