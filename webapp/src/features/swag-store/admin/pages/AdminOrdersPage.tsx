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
import { Link as RouterLink, useLocation, useNavigate, useParams } from "react-router";
import {
  alpha,
  Alert,
  Box,
  Button,
  Card,
  Chip,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  Link,
  MenuItem,
  Pagination,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { DownloadIcon, SearchIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useDocumentTitle } from "@hooks/useDocumentTitle";
import { useUrlViewState } from "@hooks/useUrlViewState";
import type { SwagStoreOrderStatus } from "../../api/swagStoreTypes";
import OrderStatusChip from "../../components/OrderStatusChip";
import { adminOrdersCodec, ADMIN_ORDERS_PAGE_SIZE, type AdminOrdersView } from "../../util/adminOrdersViewState";
import { formatInstant } from "../../util/civilDate";
import { formatCoins } from "../../util/coins";
import { messageFor } from "../../util/swagStoreError";
import { useAdminOffices, useAdminOrders } from "../api/useAdminData";
import { useExportOrders } from "../api/useAdminMutations";
import OrderDrawer from "../components/OrderDrawer";
import { swagStoreAdminPaths } from "../swagStoreAdminItems";

const STATUS_CHIPS: readonly { readonly value: SwagStoreOrderStatus | ""; readonly label: string }[] = [
  { value: "", label: "All" },
  { value: "CONFIRMED", label: "To prepare" },
  { value: "READY_FOR_PICKUP", label: "Ready for pickup" },
  { value: "PENDING_PAYMENT", label: "Payment pending" },
  { value: "COLLECTED", label: "Collected" },
  { value: "FAILED", label: "Failed" },
];

/**
 * `/people-ops/swag-store/orders(/:orderNo)`: the orders board for fulfilment
 * ops. Filters live in the address; an order number in the path opens its drawer
 * over the list, and closing it keeps the filters.
 */
export default function AdminOrdersPage(): JSX.Element {
  useDocumentTitle("Orders · Swag Store");
  const { orderNo } = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();
  const { view, setView } = useUrlViewState(adminOrdersCodec);
  const apply = (patch: Partial<AdminOrdersView>) => setView({ ...view, ...patch, page: 1 });

  return (
    <Box>
      <Typography variant="overline" color="text.secondary" component="p" sx={{ lineHeight: 1.5 }}>
        Swag Store
      </Typography>
      <Typography component="h1" variant="h5" sx={{ mt: 0, mb: 2 }}>
        Orders
      </Typography>
      <Filters view={view} onApply={apply} />
      <OrdersTable view={view} onPage={(page) => setView({ ...view, page })} search={search} />
      {orderNo && (
        <OrderDrawer orderNo={orderNo} onClose={() => navigate({ pathname: swagStoreAdminPaths.orders, search })} />
      )}
    </Box>
  );
}

function Filters({ view, onApply }: { view: AdminOrdersView; onApply: (patch: Partial<AdminOrdersView>) => void }): JSX.Element {
  const offices = useAdminOffices();
  const exportCsv = useExportOrders();
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 2 }}>
      <Box role="group" aria-label="Status" sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {STATUS_CHIPS.map((c) => {
          const pressed = c.value === view.status;
          return (
            <Chip
              key={c.value || "all"}
              label={c.label}
              size="small"
              variant="outlined"
              color={pressed ? "primary" : "default"}
              aria-pressed={pressed}
              onClick={() => onApply({ status: c.value })}
              sx={(theme) => ({ bgcolor: pressed ? alpha(theme.palette.primary.main, 0.1) : "transparent", fontWeight: pressed ? 600 : 400 })}
            />
          );
        })}
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center" }}>
        <SearchBox applied={view.q} onSearch={(q) => onApply({ q })} />
        {offices.data && offices.data.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="swag-store-orders-office">Pick up at</InputLabel>
            <Select
              labelId="swag-store-orders-office"
              label="Pick up at"
              value={view.office}
              onChange={(e) => onApply({ office: e.target.value })}
            >
              <MenuItem value="">Every office</MenuItem>
              {offices.data.map((o) => (
                <MenuItem key={o.id} value={o.id}>
                  {o.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <Button
          variant="outlined"
          startIcon={<DownloadIcon size={16} />}
          disabled={exportCsv.isPending}
          onClick={() => exportCsv.mutate(view)}
        >
          {exportCsv.isPending ? "Exporting…" : "Export CSV"}
        </Button>
      </Box>
      {exportCsv.isError && <Alert severity="error">Couldn&apos;t export the orders. {messageFor(exportCsv.error)}</Alert>}
    </Box>
  );
}

function SearchBox({ applied, onSearch }: { applied: string; onSearch: (q: string) => void }): JSX.Element {
  const [draft, setDraft] = useState(applied);
  const [synced, setSynced] = useState(applied);
  if (applied !== synced) {
    setSynced(applied);
    setDraft(applied);
  }
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSearch(draft.trim());
  };
  return (
    <Box component="form" role="search" onSubmit={submit} sx={{ flex: "1 1 260px", maxWidth: 380 }}>
      <TextField
        type="search"
        size="small"
        fullWidth
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Order number or email"
        slotProps={{
          htmlInput: { "aria-label": "Search orders", maxLength: 200 },
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton type="submit" size="small" aria-label="Search" edge="end">
                  <SearchIcon size={18} />
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
    </Box>
  );
}

function OrdersTable({ view, onPage, search }: { view: AdminOrdersView; onPage: (page: number) => void; search: string }): JSX.Element {
  const orders = useAdminOrders(view);
  if (orders.isPending) return <Skeleton variant="rounded" height={240} aria-label="Loading the orders" />;
  if (orders.isError) {
    return (
      <ErrorNotice onRetry={() => void orders.refetch()} retrying={orders.isFetching} error={orders.error}>
        Couldn&apos;t load the orders.
      </ErrorNotice>
    );
  }
  const { items, total } = orders.data;
  if (items.length === 0) {
    return (
      <Typography sx={{ py: 4, textAlign: "center" }} color="text.secondary">
        {total > 0 ? "There are no orders on this page." : "No orders match."}
      </Typography>
    );
  }
  const pages = Math.ceil(total / ADMIN_ORDERS_PAGE_SIZE);
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Card variant="outlined" sx={{ borderRadius: 1.5, overflowX: "auto", opacity: orders.isPlaceholderData ? 0.6 : 1 }}>
        <Table size="small" aria-label="Orders">
          <TableHead>
            <TableRow>
              <TableCell>Order</TableCell>
              <TableCell>Placed by</TableCell>
              <TableCell>Placed</TableCell>
              <TableCell>Pick up at</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((o) => (
              <TableRow key={o.id} hover>
                <TableCell>
                  <Link
                    component={RouterLink}
                    to={{ pathname: swagStoreAdminPaths.order(o.orderNo), search }}
                    sx={{ fontWeight: 600 }}
                  >
                    {o.orderNo}
                  </Link>
                </TableCell>
                <TableCell>{o.userName}</TableCell>
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
        <Pagination count={pages} page={Math.min(view.page, pages)} onChange={(_, p) => onPage(p)} sx={{ alignSelf: "center" }} />
      )}
    </Box>
  );
}
