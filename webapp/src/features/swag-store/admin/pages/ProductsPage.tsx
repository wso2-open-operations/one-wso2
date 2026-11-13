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
import { Link as RouterLink, useLocation } from "react-router";
import {
  Box,
  Button,
  Card,
  Link,
  Pagination,
  Skeleton,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from "@wso2/oxygen-ui";
import { PlusIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useDocumentTitle } from "@hooks/useDocumentTitle";
import type { SwagStoreProductStatus } from "../../api/swagStoreTypes";
import { formatCoins } from "../../util/coins";
import { ADMIN_PRODUCTS_PAGE_SIZE, useAdminProducts } from "../api/useAdminData";
import { swagStoreAdminPaths } from "../swagStoreAdminItems";

type TabKey = "active" | "draft" | "removed";

const TABS: readonly { readonly key: TabKey; readonly label: string; readonly status: SwagStoreProductStatus; readonly empty: string }[] = [
  { key: "active", label: "Active", status: "ACTIVE", empty: "No active products." },
  { key: "draft", label: "Drafts", status: "DRAFT", empty: "No drafts." },
  { key: "removed", label: "Removed", status: "REMOVED", empty: "No removed products." },
];

/** `/people-ops/swag-store/products/(active|draft|removed)`: the catalog, one routed tab per status. */
export default function ProductsPage(): JSX.Element {
  useDocumentTitle("Products · Swag Store");
  const { pathname } = useLocation();
  const tab = TABS.find((t) => pathname.endsWith(`/${t.key}`)) ?? TABS[0];

  return (
    <Box>
      <Typography variant="overline" color="text.secondary" component="p" sx={{ lineHeight: 1.5 }}>
        Swag Store
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
        <Typography component="h1" variant="h5" sx={{ m: 0 }}>
          Products
        </Typography>
        <Button component={RouterLink} to={swagStoreAdminPaths.newProduct} variant="contained" startIcon={<PlusIcon size={16} />}>
          New product
        </Button>
      </Box>
      <Tabs value={tab.key} aria-label="Product status" sx={{ mt: 1, mb: 2 }}>
        {TABS.map((t) => (
          <Tab key={t.key} value={t.key} label={t.label} component={RouterLink} to={swagStoreAdminPaths.productsTab(t.key)} />
        ))}
      </Tabs>
      {/* Keyed by tab, so each tab starts on its first page. */}
      <ProductsTable key={tab.key} status={tab.status} empty={tab.empty} />
    </Box>
  );
}

function ProductsTable({ status, empty }: { status: SwagStoreProductStatus; empty: string }): JSX.Element {
  const [page, setPage] = useState(1);
  const products = useAdminProducts(status, page);
  if (products.isPending) return <Skeleton variant="rounded" height={220} aria-label="Loading the products" />;
  if (products.isError) {
    return (
      <ErrorNotice onRetry={() => void products.refetch()} retrying={products.isFetching} error={products.error}>
        Couldn&apos;t load the products.
      </ErrorNotice>
    );
  }
  const { items, total } = products.data;
  if (items.length === 0) return <Typography color="text.secondary">{empty}</Typography>;
  const pages = Math.ceil(total / ADMIN_PRODUCTS_PAGE_SIZE);
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Card variant="outlined" sx={{ borderRadius: 1.5, overflowX: "auto" }}>
        <Table size="small" aria-label="Products">
          <TableHead>
            <TableRow>
              <TableCell>Product</TableCell>
              <TableCell align="right">Price</TableCell>
              <TableCell align="right">Free stock</TableCell>
              <TableCell align="right">Sold, last 30 days</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((p) => (
              <TableRow key={p.id} hover>
                <TableCell>
                  <Link component={RouterLink} to={swagStoreAdminPaths.product(p.id)} sx={{ fontWeight: 600 }}>
                    {p.name}
                  </Link>
                </TableCell>
                <TableCell align="right">{formatCoins(p.price)}</TableCell>
                <TableCell align="right">{p.freeStock.toLocaleString()}</TableCell>
                <TableCell align="right">{p.unitsSold30d.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      {pages > 1 && <Pagination count={pages} page={Math.min(page, pages)} onChange={(_, p) => setPage(p)} sx={{ alignSelf: "center" }} />}
    </Box>
  );
}
