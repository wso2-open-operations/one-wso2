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

import type { SwagStorePhotoView } from "../api/swagStoreTypes";

/** Photo slots in gallery order. Front is the main photo: cards and cart lines show it. */
export const PHOTO_VIEWS: readonly SwagStorePhotoView[] = [
  "front",
  "back",
  "left",
  "right",
  "top",
  "bottom",
  "detail-1",
  "detail-2",
  "detail-3",
  "detail-4",
];

/** The largest photo the backend accepts. */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
/** The largest original the editor will try to scale down. */
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
/** Photos are scaled down to fit this many pixels on their longest side. */
export const MAX_PHOTO_EDGE = 1600;

const PHOTO_TYPES: readonly string[] = ["image/jpeg", "image/png", "image/webp"];

const LABELS: Readonly<Record<SwagStorePhotoView, string>> = {
  front: "Front",
  back: "Back",
  left: "Left side",
  right: "Right side",
  top: "Top",
  bottom: "Bottom",
  "detail-1": "Detail 1",
  "detail-2": "Detail 2",
  "detail-3": "Detail 3",
  "detail-4": "Detail 4",
};

export function photoLabel(view: SwagStorePhotoView): string {
  return LABELS[view];
}

/** The admin's alt text, or "{product name}, {label}" when there is none. */
export function photoAlt(image: { readonly view: SwagStorePhotoView; readonly alt: string }, productName: string): string {
  return image.alt.trim() || `${productName}, ${photoLabel(image.view)}`;
}

/** Why a picked file can't be used, or null. Large photos pass: they are scaled down before upload. */
export function checkPhotoFile(file: File): string | null {
  if (!PHOTO_TYPES.includes(file.type)) return "Use a JPEG, PNG or WebP photo.";
  if (file.size === 0) return "The file is empty.";
  if (file.size > MAX_SOURCE_BYTES) return "Photos are at most 25 MB.";
  return null;
}
