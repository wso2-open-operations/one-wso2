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
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import type { SwagStoreAdminVariant, SwagStoreStockReason, SwagStoreStockResult } from "../../api/swagStoreTypes";
import { messageFor } from "../../util/swagStoreError";
import { useStockMovement } from "../api/useAdminMutations";

const REASONS: readonly { readonly value: SwagStoreStockReason; readonly label: string; readonly hint: string }[] = [
  { value: "RECEIVE", label: "Receive", hint: "New stock arrived. People waiting for it are emailed." },
  { value: "ADJUST", label: "Adjust", hint: "Correct a count. Use a minus sign to take units away." },
  { value: "WRITE_OFF", label: "Write off", hint: "Damaged, lost or left over after removal." },
];

interface StockDialogProps {
  readonly variant: SwagStoreAdminVariant;
  readonly onClose: () => void;
  readonly onSaved: (result: SwagStoreStockResult) => void;
}

/** Receive, adjust or write off one variant's stock. Receive and write-off take a positive number. */
export default function StockDialog({ variant, onClose, onSaved }: StockDialogProps): JSX.Element {
  const move = useStockMovement();
  const [reason, setReason] = useState<SwagStoreStockReason>("RECEIVE");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const delta = Number(quantity);
  const valid =
    quantity.trim() !== "" &&
    Number.isInteger(delta) &&
    (reason === "ADJUST" ? delta !== 0 && Math.abs(delta) <= 100_000 : delta >= 1 && delta <= 100_000);
  const title = `Stock for ${variant.sku}`;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    move.mutate(
      { variantId: variant.id, movement: { delta, reason, ...(note.trim() ? { note: note.trim() } : {}) } },
      {
        onSuccess: (result) => {
          onSaved(result);
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open onClose={move.isPending ? undefined : onClose} maxWidth="xs" fullWidth aria-labelledby="swag-store-stock-dialog">
      <Box component="form" onSubmit={submit} noValidate>
        <DialogTitle id="swag-store-stock-dialog">{title}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
          <Typography variant="body2" color="text.secondary">
            {variant.options || "No options"} · on hand {variant.onHand}, reserved {variant.reserved}, free {variant.free}
          </Typography>
          <FormControl size="small">
            <InputLabel id="swag-store-stock-reason">Reason</InputLabel>
            <Select
              labelId="swag-store-stock-reason"
              label="Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value as SwagStoreStockReason)}
            >
              {REASONS.map((r) => (
                <MenuItem key={r.value} value={r.value}>
                  {r.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Quantity"
            size="small"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            error={quantity !== "" && !valid}
            helperText={REASONS.find((r) => r.value === reason)?.hint}
          />
          <TextField
            label="Note (optional)"
            size="small"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 500 } }}
          />
          {move.isError && <Alert severity="error">{messageFor(move.error)}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={move.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={!valid || move.isPending}
            startIcon={move.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {move.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
