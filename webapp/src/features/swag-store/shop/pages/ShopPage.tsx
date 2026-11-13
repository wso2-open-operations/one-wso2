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
import { useDocumentTitle } from "@hooks/useDocumentTitle";
import { useUrlViewState } from "@hooks/useUrlViewState";
import { shopViewCodec } from "../../util/shopViewState";
import ProductGrid from "../components/ProductGrid";
import ShopFilters from "../components/ShopFilters";
import WalletBalance from "../components/WalletBalance";

/** `/store`: the shopper's balance, then every item for sale, filtered and sorted from the address. */
export default function ShopPage(): JSX.Element {
  useDocumentTitle("Swag Store");
  const { view, setView } = useUrlViewState(shopViewCodec);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box>
        <Typography component="h1" variant="h5" sx={{ mb: 0.5, mt: 0 }}>
          Swag Store
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: "70ch", mb: 2 }}>
          Spend your O2C coins on WSO2 swag, and pick your order up at your office.
        </Typography>
        <WalletBalance />
      </Box>
      <ShopFilters view={view} onChange={setView} />
      <ProductGrid view={view} onChange={setView} />
    </Box>
  );
}
