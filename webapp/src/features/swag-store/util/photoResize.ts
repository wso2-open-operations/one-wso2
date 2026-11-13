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

import { MAX_PHOTO_BYTES, MAX_PHOTO_EDGE } from "./photos";

/** The quality WebP and JPEG are encoded at when a photo is scaled down. */
const QUALITY = 0.85;

type OutputType = "image/webp" | "image/jpeg" | "image/png";

const EXTENSION: Readonly<Record<OutputType, string>> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

/** A photo the editor can't prepare; the message is for the admin. */
export class PhotoPrepError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhotoPrepError";
  }
}

/** The size that fits within max × max, keeping the shape. Never larger than the original, never 0. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Whether a photo must be scaled down: over 1600 px on its longest side, or over 5 MB. */
export function needsScaling(size: { width: number; height: number }, bytes: number): boolean {
  return Math.max(size.width, size.height) > MAX_PHOTO_EDGE || bytes > MAX_PHOTO_BYTES;
}

/** WebP where the browser can encode it; else PNG for a PNG (keeps transparency) and JPEG for the rest. */
export function outputType(sourceType: string, webpSupported: boolean): OutputType {
  if (webpSupported) return "image/webp";
  return sourceType === "image/png" ? "image/png" : "image/jpeg";
}

function canvasOf(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new PhotoPrepError("This photo couldn't be read. Try another file.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return { canvas, ctx };
}

function encode(canvas: HTMLCanvasElement, type: OutputType): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

/**
 * The photo to upload: the file itself when it already fits, else a copy scaled
 * down to fit 1600 × 1600 px (shape kept, nothing cropped) and re-encoded.
 * Phone photos are turned upright first, and re-encoding drops their metadata.
 */
export async function preparePhoto(file: File): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new PhotoPrepError("This photo couldn't be read. Try another file.");
  }
  try {
    if (!needsScaling(bitmap, file.size)) return file;
    const target = fitWithin(bitmap.width, bitmap.height, MAX_PHOTO_EDGE);
    // One big jump blurs and aliases; halving until within 2× keeps detail.
    let source: CanvasImageSource = bitmap;
    let width = bitmap.width;
    let height = bitmap.height;
    while (width / target.width > 2) {
      width = Math.round(width / 2);
      height = Math.round(height / 2);
      const step = canvasOf(width, height);
      step.ctx.drawImage(source, 0, 0, width, height);
      source = step.canvas;
    }
    const final = canvasOf(target.width, target.height);
    final.ctx.drawImage(source, 0, 0, target.width, target.height);

    let type = outputType(file.type, true);
    let blob = await encode(final.canvas, type);
    if (!blob || blob.type !== type) {
      // Some browsers can't encode WebP and quietly hand back a PNG.
      type = outputType(file.type, false);
      blob = await encode(final.canvas, type);
    }
    if (!blob) throw new PhotoPrepError("This photo couldn't be read. Try another file.");
    if (blob.size > MAX_PHOTO_BYTES) throw new PhotoPrepError("This photo is still over 5 MB after scaling. Try a smaller one.");
    const base = file.name.replace(/\.[^.]*$/, "") || "photo";
    return new File([blob], `${base}.${EXTENSION[type]}`, { type });
  } finally {
    bitmap.close();
  }
}
