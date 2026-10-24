// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, List, Typography } from "@wso2/oxygen-ui";

// Asked before Proceed on Files Analysis when the product analysis ignored
// files while searching for partially applicable products: the update moves on
// without them reaching those products, so each one is listed for the user to
// acknowledge.
export default function UmtIgnoredFilesDialog({
  open,
  files,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  files: string[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="sm">
      <DialogTitle>Ignored Files</DialogTitle>
      <DialogContent>
        <DialogContentText>
          The following files were ignored when searching for partially applicable products.
        </DialogContentText>
        <List dense>
          {files.map((file, index) => (
            // The list is a plain array of paths, so the index keeps two
            // identical entries apart.
            <Typography key={`${file}-${index}`} variant="body2" sx={{ overflowWrap: "anywhere" }}>
              {file}
            </Typography>
          ))}
        </List>
        <DialogContentText>Do you want to proceed?</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" onClick={onConfirm}>
          Acknowledge and Proceed
        </Button>
      </DialogActions>
    </Dialog>
  );
}
