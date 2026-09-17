/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import { XIcon } from "@wso2/oxygen-ui-icons-react";
import { CcStatementDropZone } from "./CcStatementDropZone";
import type { CcBankCode } from "./ccTypes";

// FilterMenu.tsx:115-124 — the source's `banks` predefined list, in its order.
// Two banks, and nothing reads them from the backend, so they are named here
// rather than fetched.
const BANKS: readonly { code: CcBankCode; label: string }[] = [
  { code: "amex", label: "Amex" },
  { code: "svb", label: "SVB" },
];

const TITLE_ID = "cc-statement-upload-title";

/**
 * Where a bank statement is chosen and sent for parsing.
 *
 * `index.tsx:216-320` — the source asks for the file and the bank in a dialog
 * off an "Upload Statement" button, not on the page itself. Picking a file
 * does not send it: the file sits in the dialog with its name and size, the
 * bank can still be changed, and **Upload** is what calls the backend. The
 * port had the whole thing inline on the page and parsed the moment a file was
 * picked, so the bank select was effectively a before-the-fact setting nobody
 * could revise, and there was no step at which to change your mind.
 *
 * Controlled by the page, which is the thing that has to hold the file and the
 * bank code past the dialog closing — they are what the parsed group gets
 * saved under.
 */
export function CcStatementUploadDialog({
  open,
  bank,
  file,
  pending,
  error,
  onBankChange,
  onPick,
  onClearFile,
  onUpload,
  onClose,
}: {
  open: boolean;
  bank: CcBankCode;
  file: File | null;
  pending: boolean;
  /** The parse failure, shown in the dialog so the file is still to hand. */
  error: string | null;
  onBankChange: (bank: CcBankCode) => void;
  onPick: (file: File) => void;
  onClearFile: () => void;
  onUpload: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      // Not dismissable mid-parse: the request is already in flight and its
      // result lands on this dialog.
      onClose={() => {
        if (!pending) onClose();
      }}
      maxWidth="sm"
      fullWidth
      aria-labelledby={TITLE_ID}
    >
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Typography id={TITLE_ID} sx={{ fontSize: 20, fontWeight: 600 }}>
            Upload Bank Statement
          </Typography>
          <IconButton size="small" aria-label="Close" onClick={onClose} disabled={pending}>
            <XIcon size={18} />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent>
        {/* :262-266 — the failure is reported here rather than as a snackbar,
            beside the file that caused it. */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <CcStatementDropZone
          file={file}
          disabled={pending}
          onPick={onPick}
          onClear={onClearFile}
        />

        <Box sx={{ height: 20 }} />

        {/* :273-279 — FilterMenu, which is a labelled select. */}
        <FormControl fullWidth size="medium">
          <InputLabel id="cc-bank-label">Select a Bank</InputLabel>
          <Select
            labelId="cc-bank-label"
            label="Select a Bank"
            value={bank}
            disabled={pending}
            onChange={(e) => onBankChange(e.target.value as CcBankCode)}
          >
            {BANKS.map((b) => (
              <MenuItem key={b.code} value={b.code}>
                {b.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 2 }}>
          <Button variant="outlined" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          {/* :303-313 — disabled until there is a file, and while one is being
              parsed, with the spinner in the button's start slot. */}
          <Button
            variant="contained"
            onClick={onUpload}
            disabled={!file || pending}
            startIcon={pending ? <CircularProgress size={20} color="inherit" /> : undefined}
          >
            Upload
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
