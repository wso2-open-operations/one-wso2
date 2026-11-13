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
import { Box, ToggleButton, Typography } from "@wso2/oxygen-ui";
import type { SwagStoreOption, SwagStoreProductDetail } from "../../api/swagStoreTypes";
import { valueState, type OptionSelection, type OptionValueState } from "../../util/variantState";

interface OptionPickerProps {
  readonly product: Pick<SwagStoreProductDetail, "options" | "variants" | "price">;
  readonly selection: OptionSelection;
  readonly onChange: (next: OptionSelection) => void;
}

const STATE_SUFFIX: Record<OptionValueState, string> = {
  available: "",
  out_of_stock: ", out of stock",
  sold_out: ", sold out",
  unavailable: ", not available in this combination",
};

/**
 * One row of buttons per option. A value that can't be bought now is struck
 * through but stays focusable, and its name says why, so nothing relies on
 * colour or strike-through alone. Colour values show their swatch beside the name.
 */
export default function OptionPicker({ product, selection, onChange }: OptionPickerProps): JSX.Element {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {product.options.map((option) => (
        <OptionRow
          key={option.name}
          option={option}
          chosen={selection[option.name]}
          stateOf={(valueId) => valueState(product, selection, option.name, valueId)}
          onPick={(valueId) => onChange({ ...selection, [option.name]: valueId })}
        />
      ))}
    </Box>
  );
}

interface OptionRowProps {
  readonly option: SwagStoreOption;
  readonly chosen: string | undefined;
  readonly stateOf: (valueId: string) => OptionValueState;
  readonly onPick: (valueId: string) => void;
}

function OptionRow({ option, chosen, stateOf, onPick }: OptionRowProps): JSX.Element {
  const chosenValue = option.values.find((v) => v.id === chosen);
  const labelId = `swag-store-option-${option.name.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <Box role="group" aria-labelledby={labelId}>
      <Typography id={labelId} variant="body2" sx={{ mb: 1 }}>
        <Box component="span" sx={{ fontWeight: 600 }}>
          {option.name}
        </Box>
        {chosenValue ? `: ${chosenValue.value}` : ""}
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {option.values.map((value) => {
          const state = stateOf(value.id);
          return (
            <ToggleButton
              key={value.id}
              value={value.id}
              size="small"
              selected={value.id === chosen}
              onChange={() => onPick(value.id)}
              aria-label={`${value.value}${STATE_SUFFIX[state]}`}
              sx={{
                textTransform: "none",
                gap: 1,
                px: 1.5,
                borderRadius: 1,
                ...(state === "available" ? {} : { textDecoration: "line-through", color: "text.secondary" }),
              }}
            >
              {value.swatchHex && (
                <Box
                  component="span"
                  aria-hidden="true"
                  sx={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    bgcolor: value.swatchHex,
                    border: 1,
                    borderColor: "divider",
                    flexShrink: 0,
                  }}
                />
              )}
              {value.value}
            </ToggleButton>
          );
        })}
      </Box>
    </Box>
  );
}
