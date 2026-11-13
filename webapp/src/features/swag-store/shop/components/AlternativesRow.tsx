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
import { Box, Typography } from "@wso2/oxygen-ui";
import type { SwagStoreProductCard } from "../../api/swagStoreTypes";
import ProductCard from "./ProductCard";
import { PRODUCT_GRID_SX } from "./productGridSx";

/** "You might also like": up to four other items. Renders nothing when there are none. */
export default function AlternativesRow({ items }: { items: readonly SwagStoreProductCard[] }): JSX.Element | null {
  if (items.length === 0) return null;
  return (
    <Box component="section" aria-labelledby="swag-store-alternatives" sx={{ mt: 4 }}>
      <Typography id="swag-store-alternatives" component="h2" variant="h6" sx={{ mb: 1.5 }}>
        You might also like
      </Typography>
      <Box sx={PRODUCT_GRID_SX}>
        {items.slice(0, 4).map((p) => (
          <ProductCard key={p.id} product={p} headingLevel={3} />
        ))}
      </Box>
    </Box>
  );
}
