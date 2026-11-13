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

import { useEffect, useState, type JSX } from "react";
import { Link as RouterLink, useParams, useSearchParams } from "react-router";
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import { ArrowLeftIcon } from "@wso2/oxygen-ui-icons-react";
import { HttpError } from "@api/http";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useDocumentTitle } from "@hooks/useDocumentTitle";
import type { SwagStoreOrderDetail } from "../../api/swagStoreTypes";
import OrderStatusChip from "../../components/OrderStatusChip";
import { swagStorePaths } from "../../swagStorePaths";
import { formatInstant } from "../../util/civilDate";
import { formatCoins } from "../../util/coins";
import { messageFor, orderFailureMessage } from "../../util/swagStoreError";
import { PAYMENT_POLL_WINDOW_MS, useOrder, useRetryPayment } from "../api/useCheckout";
import OrderTimeline from "../components/OrderTimeline";

/** The backend's order number format. Anything else is never sent to it. */
const ORDER_NO = /^SS-\d{5,12}$/;

/** `/store/orders/:orderNo`: one order, its progress, and where to collect it. `?placed=1` greets a new order. */
export default function OrderPage(): JSX.Element {
  const { orderNo: raw = "" } = useParams();
  const orderNo = ORDER_NO.test(raw) ? raw : "";
  useDocumentTitle(orderNo ? `Order ${orderNo} · Swag Store` : "Swag Store");

  return (
    <Box>
      <Button
        component={RouterLink}
        to={swagStorePaths.orders}
        size="small"
        startIcon={<ArrowLeftIcon size={16} />}
        sx={{ mb: 1, ml: -1 }}
      >
        Orders
      </Button>
      {orderNo ? <OrderBody key={orderNo} orderNo={orderNo} /> : <NotFound />}
    </Box>
  );
}

function NotFound(): JSX.Element {
  return (
    <Box sx={{ py: 6, display: "grid", justifyItems: "center", gap: 1.5 }}>
      <Typography>We couldn&apos;t find that order.</Typography>
      <Button component={RouterLink} to={swagStorePaths.orders} variant="outlined">
        Your orders
      </Button>
    </Box>
  );
}

function OrderBody({ orderNo }: { orderNo: string }): JSX.Element {
  const [searchParams] = useSearchParams();
  const justPlaced = searchParams.get("placed") === "1";
  // The payment is asked about for two minutes at most; after that the page
  // says it is taking longer instead of polling forever.
  const [pollExpired, setPollExpired] = useState(false);
  const order = useOrder(orderNo, !pollExpired);
  const pending = order.data?.status === "PENDING_PAYMENT";

  useEffect(() => {
    if (!pending || pollExpired) return undefined;
    const timer = setTimeout(() => setPollExpired(true), PAYMENT_POLL_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [pending, pollExpired]);

  if (order.isPending) return <Skeleton variant="rounded" height={320} aria-label="Loading the order" />;
  if (order.isError) {
    return order.error instanceof HttpError && order.error.status === 404 ? (
      <NotFound />
    ) : (
      <ErrorNotice onRetry={() => void order.refetch()} retrying={order.isFetching} error={order.error}>
        Couldn&apos;t load this order.
      </ErrorNotice>
    );
  }

  const o = order.data;
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          <Typography component="h1" variant="h5" sx={{ m: 0 }}>
            Order {o.orderNo}
          </Typography>
          <OrderStatusChip status={o.status} />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Placed {formatInstant(o.placedAt)} · {formatCoins(o.total)}
        </Typography>
      </Box>

      {justPlaced && o.status === "CONFIRMED" && (
        <Alert severity="success">
          Order placed. We&apos;ll email you when it&apos;s ready for pickup at {o.pickupOffice.name}.
        </Alert>
      )}
      {pending && <PendingPayment orderNo={o.orderNo} slow={pollExpired} onRetried={() => setPollExpired(false)} />}
      {o.status === "FAILED" && (
        <Alert
          severity="error"
          action={
            <Button component={RouterLink} to={swagStorePaths.cart} color="inherit" size="small">
              Back to cart
            </Button>
          }
        >
          Payment failed. {orderFailureMessage(o.failureCode)}
        </Alert>
      )}
      {o.status === "READY_FOR_PICKUP" && (
        <Alert severity="info">
          It&apos;s ready at {o.pickupOffice.name}. Bring your WSO2 ID when you collect it.
        </Alert>
      )}

      <Box
        sx={{
          display: "grid",
          gap: 3,
          gridTemplateColumns: { xs: "1fr", md: "minmax(0, 3fr) minmax(260px, 2fr)" },
          alignItems: "start",
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
          <OrderLines order={o} />
          {o.status !== "FAILED" && o.status !== "PENDING_PAYMENT" && (
            <Box component="section" aria-labelledby="swag-store-order-progress">
              <Typography id="swag-store-order-progress" component="h2" variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                Progress
              </Typography>
              <OrderTimeline order={o} />
            </Box>
          )}
        </Box>
        <PickupCard order={o} />
      </Box>
    </Box>
  );
}

function PendingPayment({ orderNo, slow, onRetried }: { orderNo: string; slow: boolean; onRetried: () => void }): JSX.Element {
  const retry = useRetryPayment(orderNo);
  return (
    <Alert
      severity="info"
      icon={slow ? undefined : <CircularProgress size={18} />}
      action={
        <Button
          color="inherit"
          size="small"
          disabled={retry.isPending}
          onClick={() => retry.mutate(undefined, { onSuccess: onRetried })}
        >
          {retry.isPending ? "Retrying…" : "Retry payment"}
        </Button>
      }
    >
      {slow
        ? "Confirming your payment is taking longer than usual. We'll email you once it's settled."
        : "Confirming your payment… This usually takes a few seconds."}
      {retry.isError && (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {messageFor(retry.error)}
        </Typography>
      )}
    </Alert>
  );
}

function OrderLines({ order }: { order: SwagStoreOrderDetail }): JSX.Element {
  return (
    <Card variant="outlined" sx={{ borderRadius: 1.5, overflowX: "auto" }}>
      <Table size="small" aria-label="Items">
        <TableHead>
          <TableRow>
            <TableCell>Item</TableCell>
            <TableCell align="right">Qty</TableCell>
            <TableCell align="right">Price</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {order.lines.map((line) => (
            <TableRow key={line.sku}>
              <TableCell>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {line.name}
                </Typography>
                {line.options && (
                  <Typography variant="body2" color="text.secondary">
                    {line.options}
                  </Typography>
                )}
              </TableCell>
              <TableCell align="right">{line.quantity}</TableCell>
              <TableCell align="right">{formatCoins(line.unitPrice * line.quantity)}</TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell colSpan={2} sx={{ fontWeight: 600 }}>
              Total
            </TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>
              {formatCoins(order.total)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Card>
  );
}

function PickupCard({ order }: { order: SwagStoreOrderDetail }): JSX.Element {
  const office = order.pickupOffice;
  return (
    <Card variant="outlined" sx={{ p: 2, borderRadius: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
      <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 600 }}>
        Pick up at
      </Typography>
      <Typography sx={{ fontWeight: 600 }}>{office.name}</Typography>
      <Typography variant="body2" color="text.secondary">
        {office.address}
      </Typography>
      <Typography variant="body2">Collect from {office.collectionPoint}</Typography>
      <Typography variant="body2" color="text.secondary">
        {office.hours}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Something wrong with this order? Contact the store team and mention {order.orderNo}.
      </Typography>
    </Card>
  );
}
