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
  Divider,
  Drawer,
  FormControlLabel,
  IconButton,
  Skeleton,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { XIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import type { SwagStoreAdminOrderDetail } from "../../api/swagStoreTypes";
import OrderStatusChip from "../../components/OrderStatusChip";
import { formatInstant } from "../../util/civilDate";
import { formatCoins } from "../../util/coins";
import { errorCodeOf, messageFor } from "../../util/swagStoreError";
import { useAdminOrder } from "../api/useAdminData";
import { useAddOrderNote, useTransitionOrder } from "../api/useAdminMutations";

const NOTE_MAX = 1000;

interface OrderDrawerProps {
  readonly orderNo: string;
  readonly onClose: () => void;
}

/** One order for the store team: who collects, what to hand over, the next step only, notes and history. */
export default function OrderDrawer({ orderNo, onClose }: OrderDrawerProps): JSX.Element {
  const order = useAdminOrder(orderNo);
  const titleId = "swag-store-order-drawer-title";
  return (
    <Drawer
      anchor="right"
      open
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: "100%", sm: 460 }, p: 2.5 }, role: "dialog", "aria-labelledby": titleId } }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Typography id={titleId} component="h2" variant="h6" sx={{ m: 0 }}>
            Order {orderNo}
          </Typography>
          {order.data && <OrderStatusChip status={order.data.status} />}
        </Box>
        <IconButton aria-label="Close" onClick={onClose} size="small">
          <XIcon size={18} />
        </IconButton>
      </Box>
      {order.isPending ? (
        <Skeleton variant="rounded" height={320} aria-label="Loading the order" />
      ) : order.isError ? (
        <ErrorNotice onRetry={() => void order.refetch()} retrying={order.isFetching} error={order.error}>
          Couldn&apos;t load this order.
        </ErrorNotice>
      ) : (
        <OrderDetails order={order.data} />
      )}
    </Drawer>
  );
}

function Label({ children }: { children: string }): JSX.Element {
  return (
    <Typography variant="overline" color="text.secondary" component="h3" sx={{ lineHeight: 1.6, mt: 2 }}>
      {children}
    </Typography>
  );
}

function OrderDetails({ order }: { order: SwagStoreAdminOrderDetail }): JSX.Element {
  return (
    <Box>
      <Typography variant="body2" color="text.secondary">
        Placed {formatInstant(order.placedAt)} · {formatCoins(order.total)}
      </Typography>

      <Label>Who collects</Label>
      <Typography sx={{ fontWeight: 600 }}>{order.userName}</Typography>
      <Typography variant="body2" color="text.secondary">
        {order.userEmail}
      </Typography>

      <Label>Hand over</Label>
      <Box component="ul" sx={{ m: 0, p: 0 }}>
        {order.lines.map((line) => (
          <Box component="li" key={line.sku} sx={{ listStyle: "none", display: "flex", justifyContent: "space-between", py: 0.5 }}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {line.quantity} × {line.name}
                {line.options ? ` · ${line.options}` : ""}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                {line.sku}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>

      <Label>Pick up at</Label>
      <Typography variant="body2">
        {order.pickupOffice.name} · {order.pickupOffice.collectionPoint}
      </Typography>

      <Label>Payment reference</Label>
      <Typography variant="body2" sx={{ fontFamily: "monospace", wordBreak: "break-all" }}>
        {order.paymentReference}
      </Typography>

      <Divider sx={{ my: 2 }} />
      <NextStep order={order} />
      <Divider sx={{ my: 2 }} />
      <Notes order={order} />
      <History order={order} />
    </Box>
  );
}

/** Only the step that comes next: ready for pickup once paid, collected once ready. */
function NextStep({ order }: { order: SwagStoreAdminOrderDetail }): JSX.Element {
  if (order.status === "CONFIRMED") return <ReadyForPickupForm orderNo={order.orderNo} />;
  if (order.status === "READY_FOR_PICKUP") return <MarkCollectedForm orderNo={order.orderNo} />;
  const done =
    order.status === "COLLECTED"
      ? `Collected${order.collectedBy ? `, handed over by ${order.collectedBy}` : ""}.`
      : order.status === "PENDING_PAYMENT"
        ? "Waiting for the payment to be confirmed."
        : "This order failed. There is nothing to hand over.";
  return <Typography variant="body2">{done}</Typography>;
}

function transitionError(error: Error | null): string | undefined {
  if (!error) return undefined;
  return errorCodeOf(error) === "state_conflict"
    ? "Someone already did this. The order has been reloaded."
    : messageFor(error);
}

function ReadyForPickupForm({ orderNo }: { orderNo: string }): JSX.Element {
  const move = useTransitionOrder(orderNo);
  const [note, setNote] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    move.mutate({ status: "READY_FOR_PICKUP", ...(note.trim() ? { note: note.trim() } : {}) });
  };
  return (
    <Box component="form" onSubmit={submit} sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Typography variant="subtitle2">Next: ready for pickup</Typography>
      <Typography variant="body2" color="text.secondary">
        The shopper gets an email saying where to collect it.
      </Typography>
      <TextField
        label="Note (optional)"
        size="small"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        slotProps={{ htmlInput: { maxLength: NOTE_MAX } }}
      />
      {move.isError && <Alert severity="error">{transitionError(move.error)}</Alert>}
      <Box>
        <Button
          type="submit"
          variant="contained"
          disabled={move.isPending}
          startIcon={move.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {move.isPending ? "Saving…" : "Mark ready for pickup"}
        </Button>
      </Box>
    </Box>
  );
}

function MarkCollectedForm({ orderNo }: { orderNo: string }): JSX.Element {
  const move = useTransitionOrder(orderNo);
  const [idChecked, setIdChecked] = useState(false);
  const [note, setNote] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!idChecked) return;
    move.mutate({ status: "COLLECTED", idChecked: true, ...(note.trim() ? { note: note.trim() } : {}) });
  };
  return (
    <Box component="form" onSubmit={submit} sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Typography variant="subtitle2">Next: hand it over</Typography>
      <FormControlLabel
        control={<Checkbox checked={idChecked} onChange={(e) => setIdChecked(e.target.checked)} />}
        label="I checked their WSO2 ID"
      />
      <TextField
        label="Note (optional)"
        size="small"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        slotProps={{ htmlInput: { maxLength: NOTE_MAX } }}
      />
      {move.isError && <Alert severity="error">{transitionError(move.error)}</Alert>}
      <Box>
        <Button
          type="submit"
          variant="contained"
          disabled={!idChecked || move.isPending}
          startIcon={move.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {move.isPending ? "Saving…" : "Mark collected"}
        </Button>
      </Box>
    </Box>
  );
}

function Notes({ order }: { order: SwagStoreAdminOrderDetail }): JSX.Element {
  const add = useAddOrderNote(order.orderNo);
  const [note, setNote] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = note.trim();
    if (!text) return;
    add.mutate(text, { onSuccess: () => setNote("") });
  };
  return (
    <Box>
      <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
        Notes
      </Typography>
      {order.notes.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No notes yet.
        </Typography>
      ) : (
        <Box component="ul" sx={{ m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1 }}>
          {order.notes.map((n, i) => (
            <Box component="li" key={`${n.at}-${i}`} sx={{ listStyle: "none" }}>
              <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>
                {n.note}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {n.actor} · {formatInstant(n.at)}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
      <Box component="form" onSubmit={submit} sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 1.5 }}>
        <TextField
          label="Add a note"
          size="small"
          multiline
          minRows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          slotProps={{ htmlInput: { maxLength: NOTE_MAX } }}
        />
        {add.isError && <Alert severity="error">{messageFor(add.error)}</Alert>}
        <Box>
          <Button type="submit" size="small" variant="outlined" disabled={!note.trim() || add.isPending}>
            {add.isPending ? "Adding…" : "Add note"}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

const STEP: Readonly<Record<string, string>> = {
  PENDING_PAYMENT: "Payment pending",
  CONFIRMED: "Paid",
  READY_FOR_PICKUP: "Ready for pickup",
  COLLECTED: "Collected",
  FAILED: "Failed",
};

function History({ order }: { order: SwagStoreAdminOrderDetail }): JSX.Element | null {
  if (order.timeline.length === 0) return null;
  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
        History
      </Typography>
      <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
        {order.timeline.map((e, i) => (
          <li key={`${e.at}-${i}`}>
            <Typography variant="body2">
              {STEP[e.to] ?? e.to} · {formatInstant(e.at)}
            </Typography>
            {e.note && (
              <Typography variant="caption" color="text.secondary">
                {e.note}
              </Typography>
            )}
          </li>
        ))}
      </Box>
    </Box>
  );
}
