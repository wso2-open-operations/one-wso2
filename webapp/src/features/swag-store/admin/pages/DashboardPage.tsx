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

import { useId, type JSX } from "react";
import {
  Box,
  Card,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useDocumentTitle } from "@hooks/useDocumentTitle";
import type { SwagStoreAdminOrder, SwagStoreDashboard } from "../../api/swagStoreTypes";
import OrderStatusChip from "../../components/OrderStatusChip";
import { formatInstant } from "../../util/civilDate";
import { useAdminDashboard } from "../api/useAdminData";

const ATTENTION: Readonly<Record<string, string>> = {
  payment_mismatch: "Payment needs checking",
  uncollected: "Not collected",
};

const COUNTS_SX = {
  display: "grid",
  gap: 1.5,
  gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)", lg: "repeat(6, 1fr)" },
} as const;

/** `/people-ops/swag-store/dashboard`: the store team's counts. Each part shows only for the role the backend sent it to. */
export default function DashboardPage(): JSX.Element {
  useDocumentTitle("Dashboard · Swag Store");
  const dashboard = useAdminDashboard();

  let body: JSX.Element;
  if (dashboard.isPending) {
    body = <Skeleton variant="rounded" height={200} aria-label="Loading the dashboard" />;
  } else if (dashboard.isError) {
    body = (
      <ErrorNotice onRetry={() => void dashboard.refetch()} retrying={dashboard.isFetching} error={dashboard.error}>
        Couldn&apos;t load the dashboard.
      </ErrorNotice>
    );
  } else {
    body = (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {dashboard.data.orders && <OrdersPart orders={dashboard.data.orders} />}
        {dashboard.data.catalog && <CatalogPart catalog={dashboard.data.catalog} />}
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="overline" color="text.secondary" component="p" sx={{ lineHeight: 1.5 }}>
        Swag Store
      </Typography>
      <Typography component="h1" variant="h5" sx={{ mt: 0, mb: 2 }}>
        Dashboard
      </Typography>
      {body}
    </Box>
  );
}

function OrdersPart({ orders }: { orders: NonNullable<SwagStoreDashboard["orders"]> }): JSX.Element {
  return (
    <Box component="section" aria-labelledby="swag-store-dashboard-orders">
      <Typography id="swag-store-dashboard-orders" component="h2" variant="h6" sx={{ mb: 1.5 }}>
        Orders
      </Typography>
      <Box sx={COUNTS_SX}>
        <Count label="To prepare" value={orders.toPrepare} />
        <Count label="Ready for pickup" value={orders.readyForPickup} />
        <Count label="Payment not confirmed" value={orders.pendingPayment} />
        <Count label="Collected today" value={orders.collectedToday} />
      </Box>
      <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 600, mt: 3, mb: 1 }}>
        Needs attention
      </Typography>
      {orders.needsAttention.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No order needs attention.
        </Typography>
      ) : (
        <AttentionTable orders={orders.needsAttention} />
      )}
    </Box>
  );
}

function AttentionTable({ orders }: { orders: readonly SwagStoreAdminOrder[] }): JSX.Element {
  return (
    <Card variant="outlined" sx={{ borderRadius: 1.5, overflowX: "auto" }}>
      <Table size="small" aria-label="Orders that need attention">
        <TableHead>
          <TableRow>
            <TableCell>Order</TableCell>
            <TableCell>Placed by</TableCell>
            <TableCell>Placed</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Why</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {orders.map((o) => (
            <TableRow key={o.id}>
              <TableCell sx={{ fontWeight: 600 }}>{o.orderNo}</TableCell>
              <TableCell>{o.userName}</TableCell>
              <TableCell>{formatInstant(o.placedAt)}</TableCell>
              <TableCell>
                <OrderStatusChip status={o.status} />
              </TableCell>
              <TableCell>{o.attentionReason ? (ATTENTION[o.attentionReason] ?? o.attentionReason) : "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function CatalogPart({ catalog }: { catalog: NonNullable<SwagStoreDashboard["catalog"]> }): JSX.Element {
  return (
    <Box component="section" aria-labelledby="swag-store-dashboard-catalog">
      <Typography id="swag-store-dashboard-catalog" component="h2" variant="h6" sx={{ mb: 1.5 }}>
        Catalog
      </Typography>
      <Box sx={COUNTS_SX}>
        <Count label="Active products" value={catalog.active} />
        <Count label="Drafts" value={catalog.draft} />
        <Count label="Removed" value={catalog.removed} />
        <Count label="Low stock" value={catalog.lowStockVariants} hint="variants" />
        <Count label="Out of stock" value={catalog.outOfStockVariants} hint="variants" />
        <Count label="Waiting alerts" value={catalog.pendingAlerts} />
      </Box>
    </Box>
  );
}

/** One count, named by its label so a screen reader hears "To prepare, 4". */
function Count({ label, value, hint }: { label: string; value: number; hint?: string }): JSX.Element {
  const labelId = useId();
  return (
    <Card variant="outlined" role="group" aria-labelledby={labelId} sx={{ p: 1.5, borderRadius: 1.5 }}>
      <Typography id={labelId} variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" component="p" sx={{ fontWeight: 600 }}>
        {value.toLocaleString()}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Card>
  );
}
