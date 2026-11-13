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

import { useRef, useState, type ChangeEvent, type JSX } from "react";
import { Box, Button, CircularProgress, TextField, Typography } from "@wso2/oxygen-ui";
import type { SwagStorePhotoUpload, SwagStorePhotoView, SwagStoreProductImage } from "../../api/swagStoreTypes";
import ProductImage from "../../components/ProductImage";
import TintedChip from "../../components/TintedChip";
import { checkPhotoFile, photoAlt, photoLabel } from "../../util/photos";
import { PhotoPrepError, preparePhoto } from "../../util/photoResize";
import { errorCodeOf, messageFor } from "../../util/swagStoreError";
import { useUploadProductPhoto } from "../api/useAdminMutations";

interface PhotoSlotProps {
  readonly productId: string;
  readonly view: SwagStorePhotoView;
  readonly image: SwagStoreProductImage | undefined;
  readonly productName: string;
  /** No product yet, or photos aren't set up. */
  readonly disabled: boolean;
  readonly onUploaded: (upload: SwagStorePhotoUpload) => void;
  readonly onRemove: () => void;
  readonly onAltChange: (alt: string) => void;
  readonly onNotConfigured: () => void;
  readonly onBusyChange: (busy: boolean) => void;
}

/** One view's photo: pick a file, scale it down if it's large, upload it, and describe it. */
export default function PhotoSlot({
  productId,
  view,
  image,
  productName,
  disabled,
  onUploaded,
  onRemove,
  onAltChange,
  onNotConfigured,
  onBusyChange,
}: PhotoSlotProps): JSX.Element {
  const upload = useUploadProductPhoto(productId);
  const input = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<"idle" | "preparing" | "uploading">("idle");
  const [error, setError] = useState<string | null>(null);
  const label = photoLabel(view);
  const busy = phase !== "idle";
  const off = disabled || busy;

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    // Cleared so picking the same file again (after Remove, say) still fires.
    e.currentTarget.value = "";
    if (!file) return;
    setError(null);
    const problem = checkPhotoFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    setPhase("preparing");
    onBusyChange(true);
    let ready: File;
    try {
      ready = await preparePhoto(file);
    } catch (err) {
      setPhase("idle");
      onBusyChange(false);
      setError(err instanceof PhotoPrepError ? err.message : "This photo couldn't be read. Try another file.");
      return;
    }
    setPhase("uploading");
    upload.mutate(
      { view, file: ready },
      {
        onSuccess: onUploaded,
        onError: (err) => {
          if (errorCodeOf(err) === "assets_not_configured") onNotConfigured();
          else setError(messageFor(err));
        },
        onSettled: () => {
          setPhase("idle");
          onBusyChange(false);
        },
      },
    );
  };

  return (
    <Box
      role="group"
      aria-label={`${label} photo`}
      sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, p: 1, display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, minHeight: 24 }}>
        <Typography variant="subtitle2" component="span">
          {label}
        </Typography>
        {view === "front" && <TintedChip label="Main photo" color="primary" />}
      </Box>
      <Box sx={{ position: "relative" }}>
        <ProductImage src={image?.url ?? null} alt={image ? photoAlt(image, productName) : ""} height={120} />
        {busy && (
          <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", bgcolor: "action.disabledBackground", borderRadius: 1 }}>
            <CircularProgress size={24} />
          </Box>
        )}
      </Box>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        aria-label={`${label} photo file`}
        onChange={(e) => void pick(e)}
      />
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        <Button
          size="small"
          variant="outlined"
          disabled={off}
          onClick={() => input.current?.click()}
          aria-label={`${image ? "Replace" : "Upload"} ${label} photo`}
          startIcon={busy ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          {phase === "preparing" ? "Preparing…" : phase === "uploading" ? "Uploading…" : image ? "Replace" : "Upload"}
        </Button>
        {image && (
          <Button size="small" color="error" disabled={off} onClick={onRemove} aria-label={`Remove ${label} photo`}>
            Remove
          </Button>
        )}
      </Box>
      {image && (
        <TextField
          size="small"
          label={`${label} description`}
          value={image.alt}
          placeholder={photoAlt({ view, alt: "" }, productName)}
          onChange={(e) => onAltChange(e.target.value)}
          disabled={disabled}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { maxLength: 300 } }}
        />
      )}
      {error && (
        <Typography variant="caption" color="error" role="alert">
          {error}
        </Typography>
      )}
    </Box>
  );
}
