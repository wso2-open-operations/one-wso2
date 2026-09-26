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

import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Stack, Box, Alert } from "@wso2/oxygen-ui";
import { Trash2 } from "@wso2/oxygen-ui-icons-react";

export type CascadeImpact = {
  label: string;
  count: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isPending?: boolean;
  impactLoading?: boolean;
  entityType: string;
  entityName: string;
  impact?: CascadeImpact[];
  warnings?: string[];
  error?: string | null;
};

export default function ConfirmDeleteDialog({
  open,
  onClose,
  onConfirm,
  isPending = false,
  impactLoading = false,
  entityType,
  entityName,
  impact = [],
  warnings = [],
  error = null,
}: Props) {
  const totalImpact = impact.reduce((sum, i) => sum + i.count, 0);

  return (
    <Dialog open={open} onClose={isPending ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{ color: "error.main", display: "flex" }}>
            <Trash2 size={22} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2 }}>
              Delete {entityType}?
            </Typography>
            <Typography variant="caption" color="text.secondary">
              This action cannot be undone.
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2">
            You're about to delete{" "}
            <Box component="span" sx={{ fontWeight: 700 }}>
              "{entityName}"
            </Box>
            .
          </Typography>

          {warnings.length > 0 && (
            <Alert severity="error" sx={{ "& .MuiAlert-message": { width: "100%" } }}>
              <Stack spacing={0.25}>
                {warnings.map((warning, i) => (
                  <Typography key={i} variant="body2">
                    {warning}
                  </Typography>
                ))}
              </Stack>
            </Alert>
          )}

          {impactLoading ? (
            <Typography variant="caption" color="text.secondary">
              Checking for related records…
            </Typography>
          ) : (
            totalImpact > 0 && (
              <Alert severity="warning" sx={{ "& .MuiAlert-message": { width: "100%" } }}>
                <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>
                  This will also permanently delete:
                </Typography>
                <Stack spacing={0.25} sx={{ pl: 1 }}>
                  {impact
                    .filter((i) => i.count > 0)
                    .map((i) => (
                      <Typography key={i.label} variant="body2">
                        • <strong>{i.count}</strong> {i.label}
                      </Typography>
                    ))}
                </Stack>
              </Alert>
            )
          )}

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.75 }}>
        <Button onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          color="error"
          variant="contained"
          disabled={isPending || impactLoading}
        >
          {isPending ? "Deleting..." : `Delete ${entityType}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
