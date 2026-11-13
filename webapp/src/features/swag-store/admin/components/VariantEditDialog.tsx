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

import { useState, type FormEvent, type JSX } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  TextField,
} from "@wso2/oxygen-ui";
import type { SwagStoreAdminVariant } from "../../api/swagStoreTypes";
import { messageFor } from "../../util/swagStoreError";
import { usePatchVariant } from "../api/useAdminMutations";

const INTEGER = /^-?\d+$/;

interface VariantEditDialogProps {
  readonly productId: string;
  readonly variant: SwagStoreAdminVariant;
  readonly onClose: () => void;
}

/** One variant's SKU, price change, restock date and whether shoppers can buy it. */
export default function VariantEditDialog({ productId, variant, onClose }: VariantEditDialogProps): JSX.Element {
  const patch = usePatchVariant(productId);
  const [sku, setSku] = useState(variant.sku);
  const [priceDelta, setPriceDelta] = useState(String(variant.priceDelta));
  const [restockEta, setRestockEta] = useState(variant.restockEta ?? "");
  const [active, setActive] = useState(variant.active);
  const valid = sku.trim() !== "" && INTEGER.test(priceDelta.trim());
  const title = `Edit ${variant.sku}`;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    patch.mutate(
      {
        variantId: variant.id,
        patch: { sku: sku.trim(), priceDelta: Number(priceDelta), active, restockEta: restockEta || null },
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open onClose={patch.isPending ? undefined : onClose} maxWidth="xs" fullWidth aria-labelledby="swag-store-variant-dialog">
      <Box component="form" onSubmit={submit} noValidate>
        <DialogTitle id="swag-store-variant-dialog">{title}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
          <TextField label="SKU" size="small" value={sku} onChange={(e) => setSku(e.target.value)} slotProps={{ htmlInput: { maxLength: 64 } }} />
          <TextField
            label="Price change (O2C)"
            size="small"
            value={priceDelta}
            onChange={(e) => setPriceDelta(e.target.value)}
            error={!INTEGER.test(priceDelta.trim())}
            helperText="Added to the product's price. Use a minus sign for less."
            slotProps={{ htmlInput: { inputMode: "numeric" } }}
          />
          <TextField
            label="Restock date"
            size="small"
            type="date"
            value={restockEta}
            onChange={(e) => setRestockEta(e.target.value)}
            helperText="Shown to shoppers while it is out of stock."
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <FormControlLabel
            control={<Checkbox checked={active} onChange={(e) => setActive(e.target.checked)} />}
            label="Sold in the store"
          />
          {patch.isError && <Alert severity="error">{messageFor(patch.error)}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={patch.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={!valid || patch.isPending}
            startIcon={patch.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {patch.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
