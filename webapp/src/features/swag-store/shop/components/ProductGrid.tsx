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
import { Box, Button, Pagination, Skeleton, Typography } from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { DEFAULT_SHOP_VIEW, isFiltered, SHOP_PAGE_SIZE, type ShopView } from "../../util/shopViewState";
import { useProducts } from "../api/useShopData";
import ProductCard from "./ProductCard";
import { PRODUCT_GRID_SX } from "./productGridSx";

interface ProductGridProps {
  readonly view: ShopView;
  readonly onChange: (next: ShopView) => void;
}

/**
 * One page of products for the view. A failure blanks only the grid, and an
 * empty answer says whether the filters or the store are empty.
 */
export default function ProductGrid({ view, onChange }: ProductGridProps): JSX.Element {
  const products = useProducts(view);

  if (products.isPending) {
    return (
      <Box sx={PRODUCT_GRID_SX} aria-busy="true" aria-label="Loading items">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} variant="rounded" height={260} />
        ))}
      </Box>
    );
  }

  if (products.isError) {
    return (
      <ErrorNotice onRetry={() => void products.refetch()} retrying={products.isFetching} error={products.error}>
        Couldn&apos;t load the items.
      </ErrorNotice>
    );
  }

  const { items, total } = products.data;
  const pages = Math.ceil(total / SHOP_PAGE_SIZE);

  if (items.length === 0) {
    return (
      <Box sx={{ py: 6, textAlign: "center", display: "grid", justifyItems: "center", gap: 1.5 }}>
        <Typography variant="body1">
          {total > 0
            ? "There are no items on this page."
            : isFiltered(view)
              ? "No items match your filters."
              : "There's nothing in the store yet."}
        </Typography>
        {total > 0 ? (
          <Button variant="outlined" onClick={() => onChange({ ...view, page: 1 })}>
            Go to the first page
          </Button>
        ) : isFiltered(view) ? (
          <Button variant="outlined" onClick={() => onChange({ ...DEFAULT_SHOP_VIEW, sort: view.sort })}>
            Clear filters
          </Button>
        ) : null}
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography variant="body2" color="text.secondary" role="status">
        {total === 1 ? "1 item" : `${total} items`}
      </Typography>
      <Box
        sx={{ ...PRODUCT_GRID_SX, opacity: products.isPlaceholderData ? 0.6 : 1, transition: "opacity 150ms" }}
        aria-busy={products.isPlaceholderData}
      >
        {items.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </Box>
      {pages > 1 && (
        <Pagination
          count={pages}
          page={Math.min(view.page, pages)}
          onChange={(_, page) => onChange({ ...view, page })}
          sx={{ alignSelf: "center" }}
        />
      )}
    </Box>
  );
}
