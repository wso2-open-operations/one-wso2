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

import { useState, type JSX } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Skeleton,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import type { SwagStoreAdminProduct } from "../../api/swagStoreTypes";
import { messageFor } from "../../util/swagStoreError";
import { useRemovalImpact } from "../api/useAdminData";
import { useSetProductStatus } from "../api/useAdminMutations";

interface RemoveProductDialogProps {
  readonly product: SwagStoreAdminProduct;
  readonly onClose: () => void;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * "Remove from store": reads what the removal touches when it opens, and
 * confirms only once that is on screen. Orders already placed are still served.
 * While removing, nothing can be pressed and the dialog can't be closed.
 */
export default function RemoveProductDialog({ product, onClose }: RemoveProductDialogProps): JSX.Element {
  const impact = useRemovalImpact(product.id, true);
  const remove = useSetProductStatus(product.id);
  const [note, setNote] = useState("");
  const ready = impact.isSuccess && !impact.isFetching;

  const confirm = () =>
    remove.mutate(
      { status: "REMOVED", ...(note.trim() ? { removalNote: note.trim() } : {}) },
      { onSuccess: onClose },
    );

  return (
    <Dialog open onClose={remove.isPending ? undefined : onClose} maxWidth="sm" fullWidth aria-labelledby="swag-store-remove-product">
      <DialogTitle id="swag-store-remove-product">Remove {product.name} from the store?</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Typography variant="body2" color="text.secondary">
          Shoppers stop seeing it. You can restore it later.
        </Typography>
        {impact.isPending ? (
          <Skeleton variant="rounded" height={96} aria-label="Checking what removing it touches" />
        ) : impact.isError ? (
          <ErrorNotice onRetry={() => void impact.refetch()} retrying={impact.isFetching} error={impact.error}>
            Couldn&apos;t check what removing it touches.
          </ErrorNotice>
        ) : (
          <Box component="ul" sx={{ m: 0, pl: 2.5, display: "flex", flexDirection: "column", gap: 0.5 }}>
            <li>
              <Typography variant="body2">
                {impact.data.openOrders.length === 0
                  ? "No open orders."
                  : `${plural(impact.data.openOrders.length, "open order", "open orders")} (${plural(impact.data.openUnits, "unit", "units")}) still served: ${impact.data.openOrders.map((o) => o.orderNo).join(", ")}.`}
              </Typography>
            </li>
            <li>
              <Typography variant="body2">
                In {plural(impact.data.carts, "cart", "carts")} ({plural(impact.data.cartUnits, "unit", "units")}). Those lines stop
                counting toward checkout.
              </Typography>
            </li>
            <li>
              <Typography variant="body2">
                {plural(impact.data.pendingAlerts, "person waiting", "people waiting")} for it. Their alerts close.
              </Typography>
            </li>
            <li>
              <Typography variant="body2">
                {plural(impact.data.freeStock, "unit", "units")} left in stock. You can write it off after removing.
              </Typography>
            </li>
          </Box>
        )}
        <TextField
          label="Note (optional)"
          size="small"
          multiline
          minRows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          helperText="Why it was removed. Kept with the product."
          slotProps={{ htmlInput: { maxLength: 500 } }}
        />
        {remove.isError && <Alert severity="error">{messageFor(remove.error)}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={remove.isPending}>
          Keep it
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={confirm}
          disabled={!ready || remove.isPending}
          startIcon={remove.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {remove.isPending ? "Removing…" : "Remove from store"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
