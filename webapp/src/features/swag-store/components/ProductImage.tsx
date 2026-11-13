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
import { Box } from "@wso2/oxygen-ui";
import { ShoppingBagIcon } from "@wso2/oxygen-ui-icons-react";

interface ProductImageProps {
  readonly src: string | null;
  /** Empty when the product's name is already next to the image. */
  readonly alt: string;
  /** A size, or one per breakpoint. */
  readonly height?: number | string | Partial<Record<"xs" | "sm" | "md" | "lg", number | string>>;
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** https only; a dev build also takes http from this machine (the local Blob emulator). */
function loadable(src: string | null): boolean {
  if (!src) return false;
  try {
    const u = new URL(src);
    return u.protocol === "https:" || (import.meta.env.DEV && u.protocol === "http:" && LOOPBACK.has(u.hostname));
  } catch {
    return false;
  }
}

/**
 * A product photo, or a plain placeholder when there is none, it isn't https,
 * or it fails to load (a signed URL can expire in a tab left open for days).
 * Photos come from Blob storage, which the CSP's img-src already allows.
 */
export default function ProductImage({ src, alt, height = 180 }: ProductImageProps): JSX.Element {
  // The URL that failed, not a flag: when the gallery shows another photo, that one gets its chance.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const usable = loadable(src) && src !== failedSrc;
  return (
    <Box
      sx={{
        height,
        display: "grid",
        placeItems: "center",
        bgcolor: "action.hover",
        borderRadius: 1,
        overflow: "hidden",
        color: "text.disabled",
      }}
    >
      {usable ? (
        <Box
          component="img"
          src={src ?? undefined}
          alt={alt}
          loading="lazy"
          onError={() => setFailedSrc(src)}
          sx={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      ) : (
        <Box aria-hidden="true">
          <ShoppingBagIcon size={40} />
        </Box>
      )}
    </Box>
  );
}
