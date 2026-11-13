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
import { Link as RouterLink } from "react-router";
import { Box, Button, Card, Link, Pagination, Skeleton, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useDocumentTitle } from "@hooks/useDocumentTitle";
import { useUrlViewState, type UrlViewCodec } from "@hooks/useUrlViewState";
import OrderStatusChip from "../../components/OrderStatusChip";
import { swagStorePaths } from "../../swagStorePaths";
import { formatInstant } from "../../util/civilDate";
import { formatCoins } from "../../util/coins";
import { ORDERS_PAGE_SIZE, useOrders } from "../api/useCheckout";

const PAGE = /^[1-9]\d{0,3}$/;

/** `?page=` only. Anything else reads as the first page. */
const ordersViewCodec: UrlViewCodec<{ page: number }> = {
  parse(search) {
    const page = new URLSearchParams(search).get("page") ?? "";
    return { page: PAGE.test(page) ? Number(page) : 1 };
  },
  serialize({ page }) {
    return page > 1 ? `page=${page}` : "";
  },
};

/** `/store/orders`: the shopper's orders, newest first. */
export default function OrdersPage(): JSX.Element {
  useDocumentTitle("Your orders · Swag Store");
  const { view, setView } = useUrlViewState(ordersViewCodec);
  const orders = useOrders(view.page);

  let body: JSX.Element;
  if (orders.isPending) {
    body = <Skeleton variant="rounded" height={200} aria-label="Loading your orders" />;
  } else if (orders.isError) {
    body = (
      <ErrorNotice onRetry={() => void orders.refetch()} retrying={orders.isFetching} error={orders.error}>
        Couldn&apos;t load your orders.
      </ErrorNotice>
    );
  } else if (orders.data.items.length === 0 && orders.data.total === 0) {
    body = (
      <Box sx={{ py: 6, display: "grid", justifyItems: "center", gap: 1.5 }}>
        <Typography>You haven&apos;t placed an order yet.</Typography>
        <Button component={RouterLink} to={swagStorePaths.shop} variant="outlined">
          Browse the store
        </Button>
      </Box>
    );
  } else {
    const pages = Math.ceil(orders.data.total / ORDERS_PAGE_SIZE);
    body = (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Card variant="outlined" sx={{ borderRadius: 1.5, overflowX: "auto" }}>
          <Table size="small" aria-label="Your orders">
            <TableHead>
              <TableRow>
                <TableCell>Order</TableCell>
                <TableCell>Placed</TableCell>
                <TableCell>Pick up at</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.data.items.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <Link component={RouterLink} to={swagStorePaths.order(o.orderNo)} sx={{ fontWeight: 600 }}>
                      {o.orderNo}
                    </Link>
                  </TableCell>
                  <TableCell>{formatInstant(o.placedAt)}</TableCell>
                  <TableCell>{o.officeName}</TableCell>
                  <TableCell align="right">{formatCoins(o.total)}</TableCell>
                  <TableCell>
                    <OrderStatusChip status={o.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        {pages > 1 && (
          <Pagination
            count={pages}
            page={Math.min(view.page, pages)}
            onChange={(_, page) => setView({ page })}
            sx={{ alignSelf: "center" }}
          />
        )}
      </Box>
    );
  }

  return (
    <Box>
      <Typography component="h1" variant="h5" sx={{ mt: 0, mb: 2 }}>
        Your orders
      </Typography>
      {body}
    </Box>
  );
}
