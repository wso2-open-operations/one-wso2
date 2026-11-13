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
import { Alert, Box, Typography } from "@wso2/oxygen-ui";
import type { SwagStorePhotoView, SwagStoreProductImage } from "../../api/swagStoreTypes";
import { PHOTO_VIEWS } from "../../util/photos";
import PhotoSlot from "./PhotoSlot";

type Photos = readonly SwagStoreProductImage[];

interface PhotosFieldProps {
  /** Undefined until the product is saved: photos are stored under its id. */
  readonly productId: string | undefined;
  readonly productName: string;
  readonly images: Photos;
  /**
   * Takes an update, not a list: two slots can finish uploading at once, and
   * each must apply to the latest list.
   */
  readonly onChange: (update: (images: Photos) => Photos) => void;
}

const byView = (a: SwagStoreProductImage, b: SwagStoreProductImage) => PHOTO_VIEWS.indexOf(a.view) - PHOTO_VIEWS.indexOf(b.view);

/** The product's photos, one slot per view. Changes are saved with the rest of the form. */
export default function PhotosField({ productId, productName, images, onChange }: PhotosFieldProps): JSX.Element {
  const [notConfigured, setNotConfigured] = useState(false);
  const off = !productId || notConfigured;

  const put = (view: SwagStorePhotoView, next: (current: SwagStoreProductImage | undefined) => SwagStoreProductImage | null) =>
    onChange((list) => {
      const replaced = next(list.find((i) => i.view === view));
      const rest = list.filter((i) => i.view !== view);
      return replaced ? [...rest, replaced].sort(byView) : rest;
    });

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Typography variant="subtitle2" component="h3">
        Photos
      </Typography>
      <Typography variant="body2" color="text.secondary">
        JPEG, PNG or WebP. Large photos are scaled down to 1600 px. Square photos look best.
      </Typography>
      {!productId && <Alert severity="info">Save the draft to add photos.</Alert>}
      {notConfigured && <Alert severity="warning">Photos aren&apos;t set up in this environment.</Alert>}
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)", md: "repeat(5, 1fr)" } }}>
        {PHOTO_VIEWS.map((view) => (
          <PhotoSlot
            key={view}
            productId={productId ?? ""}
            view={view}
            image={images.find((i) => i.view === view)}
            productName={productName}
            disabled={off}
            onUploaded={(u) => put(view, (current) => ({ view, path: u.path, url: u.url, alt: current?.alt ?? "" }))}
            onRemove={() => put(view, () => null)}
            onAltChange={(alt) => put(view, (current) => (current ? { ...current, alt } : null))}
            onNotConfigured={() => setNotConfigured(true)}
          />
        ))}
      </Box>
    </Box>
  );
}
