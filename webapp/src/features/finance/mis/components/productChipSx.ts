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

import type { Theme } from "@mui/material/styles";

/**
 * One outlined chip per product in the "Products in Use" column.
 *
 * The text, the border and a light wash are the product's own colour, so a
 * row of products reads as a legend rather than as six copies of the same
 * chip. A name this map does not know takes the slate, still outlined.
 *
 * The light scheme uses a dark ink. That same ink is about 3:1 on the dark
 * canvas, so the dark scheme uses a lighter shade of the same hue.
 */
const API_PLATFORM = chip("#1d4ed8", "29, 78, 216", "#60a5fa", "96, 165, 250");

const PRODUCT_CHIP_COLOURS = {
  "API Platform": API_PLATFORM,
  // The accounts list sends the short name.
  APIM: API_PLATFORM,
  IAM: chip("#6d28d9", "109, 40, 217", "#c4b5fd", "196, 181, 253"),
  Integration: chip("#0f766e", "15, 118, 110", "#5eead4", "94, 234, 212"),
  Choreo: chip("#b34c00", "179, 76, 0", "#fdba74", "253, 186, 116"),
  "Agent Platform": chip("#b45309", "180, 83, 9", "#fcd34d", "252, 211, 77"),
  Moesif: chip("#0e7490", "14, 116, 144", "#67e8f9", "103, 232, 249"),
} as const;

const SLATE = chip("#475569", "71, 85, 105", "#cbd5e1", "203, 213, 225");

function chip(text: string, rgb: string, darkText: string, darkRgb: string) {
  return {
    text,
    border: `rgba(${rgb}, 0.45)`,
    wash: `rgba(${rgb}, 0.1)`,
    darkText,
    darkBorder: `rgba(${darkRgb}, 0.55)`,
    darkWash: `rgba(${darkRgb}, 0.16)`,
  };
}

export function productChipSx(product: string) {
  const colour = PRODUCT_CHIP_COLOURS[product as keyof typeof PRODUCT_CHIP_COLOURS] ?? SLATE;
  return (theme: Theme) => ({
    height: 21,
    fontWeight: 600,
    color: colour.text,
    borderColor: colour.border,
    backgroundColor: colour.wash,
    "& .MuiChip-label": { fontSize: 11, px: 0.75 },
    ...theme.applyStyles("dark", {
      color: colour.darkText,
      borderColor: colour.darkBorder,
      backgroundColor: colour.darkWash,
    }),
  });
}
