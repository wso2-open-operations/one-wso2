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
import { Alert, Box, Button, CircularProgress, IconButton, TextField, Typography } from "@wso2/oxygen-ui";
import { PlusIcon, Trash2Icon } from "@wso2/oxygen-ui-icons-react";
import type { SwagStoreAdminProduct } from "../../api/swagStoreTypes";
import { checkOptions, type OptionDraft } from "../../util/productForm";
import { messageFor } from "../../util/swagStoreError";
import { useSetOptions } from "../api/useAdminMutations";

/**
 * The product's options and their values, such as Size: S, M, L. Saving
 * replaces them all, and the backend makes a variant for each combination.
 */
export default function OptionsEditor({ product }: { product: SwagStoreAdminProduct }): JSX.Element {
  const save = useSetOptions(product.id);
  const [options, setOptions] = useState<OptionDraft[]>(() =>
    product.options.map((o) => ({ name: o.name, values: o.values.map((v) => ({ value: v.value, swatchHex: v.swatchHex ?? "" })) })),
  );
  const problem = checkOptions(options);

  const update = (i: number, next: OptionDraft) => setOptions((all) => all.map((o, j) => (j === i ? next : o)));

  const submit = () => {
    if (problem) return;
    save.mutate({
      options: options.map((o) => ({
        name: o.name.trim(),
        values: o.values.map((v) => ({ value: v.value.trim(), ...(v.swatchHex.trim() ? { swatchHex: v.swatchHex.trim() } : {}) })),
      })),
    });
  };

  return (
    <Box component="section" aria-labelledby="swag-store-options-title" sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Typography id="swag-store-options-title" component="h2" variant="h6">
        Options
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Saving makes a variant for each combination. A product with no options has one variant.
      </Typography>
      {options.map((option, i) => (
        <Box key={i} sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <TextField
              label="Option name"
              size="small"
              value={option.name}
              onChange={(e) => update(i, { ...option, name: e.target.value })}
              slotProps={{ htmlInput: { maxLength: 40 } }}
            />
            <IconButton aria-label={`Remove the ${option.name || "unnamed"} option`} onClick={() => setOptions((all) => all.filter((_, j) => j !== i))}>
              <Trash2Icon size={16} />
            </IconButton>
          </Box>
          {option.values.map((v, k) => (
            <Box key={k} sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
              <TextField
                size="small"
                value={v.value}
                onChange={(e) =>
                  update(i, { ...option, values: option.values.map((x, m) => (m === k ? { ...x, value: e.target.value } : x)) })
                }
                slotProps={{ htmlInput: { "aria-label": `${option.name || "Option"} value ${k + 1}`, maxLength: 40 } }}
              />
              <TextField
                size="small"
                placeholder="#1A2B3C"
                value={v.swatchHex}
                onChange={(e) =>
                  update(i, { ...option, values: option.values.map((x, m) => (m === k ? { ...x, swatchHex: e.target.value } : x)) })
                }
                slotProps={{ htmlInput: { "aria-label": `Swatch for ${v.value || `value ${k + 1}`} (optional)`, maxLength: 7 } }}
                sx={{ width: 140 }}
              />
              <IconButton
                aria-label={`Remove ${v.value || `value ${k + 1}`}`}
                onClick={() => update(i, { ...option, values: option.values.filter((_, m) => m !== k) })}
              >
                <Trash2Icon size={16} />
              </IconButton>
            </Box>
          ))}
          <Box>
            <Button
              size="small"
              startIcon={<PlusIcon size={14} />}
              aria-label={`Add a value to ${option.name || "this option"}`}
              onClick={() => update(i, { ...option, values: [...option.values, { value: "", swatchHex: "" }] })}
            >
              Add value
            </Button>
          </Box>
        </Box>
      ))}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        <Button size="small" startIcon={<PlusIcon size={14} />} onClick={() => setOptions((all) => [...all, { name: "", values: [{ value: "", swatchHex: "" }] }])}>
          Add option
        </Button>
        <Button
          variant="contained"
          size="small"
          onClick={submit}
          disabled={Boolean(problem) || save.isPending}
          startIcon={save.isPending ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          {save.isPending ? "Saving…" : "Save options"}
        </Button>
      </Box>
      {problem && options.length > 0 && (
        <Typography variant="body2" color="warning.main">
          {problem}
        </Typography>
      )}
      {save.isError && <Alert severity="error">{messageFor(save.error)}</Alert>}
    </Box>
  );
}
