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
import { Box, IconButton, Typography } from "@wso2/oxygen-ui";
import { MinusIcon, PlusIcon } from "@wso2/oxygen-ui-icons-react";

interface QuantityStepperProps {
  readonly value: number;
  readonly max: number;
  readonly onChange: (next: number) => void;
  readonly disabled?: boolean;
  /** Names the item when a page has several steppers, such as the cart. */
  readonly label?: string;
}

/** − value + with the limits enforced. The count is announced as it changes. */
export default function QuantityStepper({ value, max, onChange, disabled = false, label = "Quantity" }: QuantityStepperProps): JSX.Element {
  return (
    <Box
      role="group"
      aria-label={label}
      sx={{ display: "inline-flex", alignItems: "center", border: 1, borderColor: "divider", borderRadius: 1 }}
    >
      <IconButton
        size="small"
        aria-label="Decrease quantity"
        disabled={disabled || value <= 1}
        onClick={() => onChange(value - 1)}
      >
        <MinusIcon size={16} />
      </IconButton>
      <Typography component="span" aria-live="polite" sx={{ minWidth: 32, textAlign: "center", fontWeight: 600 }}>
        {value}
      </Typography>
      <IconButton
        size="small"
        aria-label="Increase quantity"
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
      >
        <PlusIcon size={16} />
      </IconButton>
    </Box>
  );
}
