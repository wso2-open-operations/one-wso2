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
import { Box, Card, CardActionArea, CardContent, Typography } from "@wso2/oxygen-ui";
import type { SwagStoreProductCard } from "../../api/swagStoreTypes";
import PriceTag from "../../components/PriceTag";
import ProductImage from "../../components/ProductImage";
import StockChip from "../../components/StockChip";
import { swagStorePaths } from "../../swagStorePaths";

interface ProductCardProps {
  readonly product: SwagStoreProductCard;
  /** The heading level of the product's name, so it nests under the section it sits in. */
  readonly headingLevel?: 2 | 3;
}

/** One item in a grid: photo, name, price and stock, as one link to its page. */
export default function ProductCard({ product, headingLevel = 2 }: ProductCardProps): JSX.Element {
  return (
    <Card variant="outlined" sx={{ height: "100%", borderRadius: 1.5 }}>
      <CardActionArea
        component={RouterLink}
        to={swagStorePaths.product(product.slug)}
        sx={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "stretch" }}
      >
        <Box sx={{ p: 1 }}>
          <ProductImage src={product.image} alt="" height={160} />
        </Box>
        <CardContent sx={{ pt: 0.5, display: "flex", flexDirection: "column", gap: 1, flexGrow: 1 }}>
          <Typography component={`h${headingLevel}`} variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
            {product.name}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mt: "auto" }}>
            <PriceTag amount={product.price} variant="body1" />
            <StockChip availability={product.availability} />
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
