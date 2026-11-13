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
import { Box, ButtonBase } from "@wso2/oxygen-ui";
import type { SwagStoreProductImage } from "../../api/swagStoreTypes";
import ProductImage from "../../components/ProductImage";

/** The product's photos: one large, with thumbnails to switch between them when there are several. */
export default function ProductGallery({ images, name }: { images: readonly SwagStoreProductImage[]; name: string }): JSX.Element {
  const [shown, setShown] = useState(0);
  const current = images[Math.min(shown, images.length - 1)];
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <ProductImage src={current?.url ?? null} alt={current?.alt || name} height={{ xs: 260, md: 380 }} />
      {images.length > 1 && (
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {images.map((image, i) => (
            <ButtonBase
              key={`${image.url}-${i}`}
              onClick={() => setShown(i)}
              aria-label={`Show image ${i + 1} of ${images.length}`}
              aria-pressed={i === shown}
              sx={{
                width: 64,
                borderRadius: 1,
                border: 2,
                borderColor: i === shown ? "primary.main" : "transparent",
                overflow: "hidden",
              }}
            >
              <ProductImage src={image.url} alt="" height={56} />
            </ButtonBase>
          ))}
        </Box>
      )}
    </Box>
  );
}
