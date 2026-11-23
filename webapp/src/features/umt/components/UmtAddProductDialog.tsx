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

import { useState, type ChangeEvent } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
} from "@wso2/oxygen-ui";
import { XIcon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import {
  EMPTY_CREATE_PRODUCT_FORM,
  isValidEmail,
  isValidFtpPort,
  buildUmtCreateProductRequest,
  isCreateProductFormValid,
  isValidProductVersion,
  unwrapUmtErrorMessage,
  type UmtCreateProductFormValues,
} from "../lib/umtProducts";
import { PLATFORM_OPTIONS } from "../lib/umtPlatforms";
import { useUmtCreateProduct } from "../api/useUmtProducts";

// The "Add a Product" form. It does not add the product at once: the backend
// saves the request for onboarding and answers 202. A scheduled job later
// downloads the pack from the given FTP location and adds the product, and
// the admins and the ED get an email when that completes or fails.
//
// Every field is required except Platform. The FTP password is masked, because
// credentials must never be shown on screen. Every field resets on close, and
// nothing here is ever written to browser storage.
export default function UmtAddProductDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { showSuccess } = useNotifications();
  const createProduct = useUmtCreateProduct();
  const [values, setValues] = useState<UmtCreateProductFormValues>(EMPTY_CREATE_PRODUCT_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isBusy = createProduct.isPending;
  const isFormValid = isCreateProductFormValid(values);

  const field = (key: keyof UmtCreateProductFormValues, label: string) => {
    const text = values[key].trim();
    const isMissing = submitted && text.length === 0;
    // An address is checked as it is typed, once there is something to check.
    const isMalformedEmail = (key === "leadMail" || key === "edMail") && text.length > 0 && !isValidEmail(text);
    // So is a port.
    const isMalformedPort = key === "ftpPort" && text.length > 0 && !isValidFtpPort(text);
    return {
      value: values[key],
      onChange: (event: ChangeEvent<HTMLInputElement>) =>
        setValues((current) => ({ ...current, [key]: event.target.value })),
      error: isMissing || isMalformedEmail || isMalformedPort,
      helperText: isMissing
        ? `${label} is required`
        : isMalformedEmail
          ? "Enter a valid email address."
          : isMalformedPort
            ? "Enter a port number from 1 to 65535."
            : undefined,
    };
  };

  const handleClose = () => {
    if (isBusy) return;
    setValues(EMPTY_CREATE_PRODUCT_FORM);
    setSubmitted(false);
    setSubmitError(null);
    createProduct.reset();
    onClose();
  };

  async function handleAdd() {
    setSubmitted(true);
    setSubmitError(null);
    if (!isFormValid) return;

    try {
      await createProduct.mutateAsync(buildUmtCreateProductRequest(values));
      showSuccess("Product submitted for onboarding. An email is sent when onboarding completes or fails.");
      handleClose();
    } catch (error) {
      setSubmitError(unwrapUmtErrorMessage(describeError(error)));
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontSize: 18, fontWeight: 600, pr: 7 }}>
        Add a Product
        <IconButton
          aria-label="Close add product dialog"
          onClick={handleClose}
          disabled={isBusy}
          sx={{ position: "absolute", right: 12, top: 12 }}
        >
          <XIcon size={18} />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.25}>
          {submitError && <Alert severity="error">{submitError}</Alert>}

          <TextField label="Product Name (eg: wso2am)" required size="small" {...field("name", "Product name")} />
          <TextField
            label="Product Version (eg: 4.0.0)"
            required
            size="small"
            {...field("version", "Product version")}
            error={submitted && !isValidProductVersion(values.version)}
            helperText={
              submitted && !isValidProductVersion(values.version)
                ? values.version.trim().length === 0
                  ? "Product version is required"
                  : "Use the X.Y.Z format, for example 4.0.0."
                : undefined
            }
          />
          <TextField label="Lead Email" required size="small" {...field("leadMail", "Lead email")} />
          <TextField label="ED Email" required size="small" {...field("edMail", "ED email")} />
          <TextField
            select
            label="Platform"
            size="small"
            value={values.platform}
            onChange={(event) => setValues((current) => ({ ...current, platform: event.target.value }))}
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {PLATFORM_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField label="FTP Host" required size="small" {...field("ftpHost", "FTP host")} />
          <TextField label="FTP Port" required size="small" {...field("ftpPort", "FTP port")} />
          <TextField label="FTP Username" required size="small" {...field("ftpUsername", "FTP username")} />
          {/* new-password, not off/current-password: this is a shared service
              credential, not this admin's own login, so the browser must
              neither offer to save it to their personal password manager nor
              autofill it in from one. */}
          <TextField
            label="FTP Password"
            type="password"
            required
            size="small"
            autoComplete="new-password"
            {...field("ftpPassword", "FTP password")}
          />
          <TextField label="FTP Absolute Path" required size="small" {...field("ftpAbsolutePath", "FTP absolute path")} />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button variant="outlined" onClick={handleClose} disabled={isBusy}>
          Cancel
        </Button>
        <Button variant="contained" disabled={isBusy} loading={isBusy} onClick={() => void handleAdd()}>
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
}
