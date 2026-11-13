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

import type { JSX } from "react";
import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@wso2/oxygen-ui";
import { formatCoins } from "../../util/coins";

interface PlaceOrderDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
  /** The order is being placed: nothing can be pressed, and the dialog can't be closed. */
  readonly pending: boolean;
  /** Why the last attempt failed. The confirm button then reads "Try again". */
  readonly error?: string;
  readonly total: number;
  readonly officeName: string;
  readonly walletText: string;
}

/** The last step: what will be paid, from which wallet, and where to pick it up. Orders are final, so it asks first. */
export default function PlaceOrderDialog({
  open,
  onClose,
  onConfirm,
  pending,
  error,
  total,
  officeName,
  walletText,
}: PlaceOrderDialogProps): JSX.Element {
  return (
    <Dialog open={open} onClose={pending ? undefined : onClose} maxWidth="xs" fullWidth aria-labelledby="swag-store-place-order">
      <DialogTitle id="swag-store-place-order">Place this order?</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Typography>
          You&apos;ll pay {formatCoins(total)} from {walletText}, and pick the order up at {officeName}.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Paid orders are final. There are no cancellations, returns or refunds.
        </Typography>
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={onConfirm}
          disabled={pending}
          startIcon={pending ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {pending ? "Placing order…" : error ? "Try again" : "Place order"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
