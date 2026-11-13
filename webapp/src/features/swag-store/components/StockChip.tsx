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
import type { SwagStoreAvailability } from "../api/swagStoreTypes";
import { formatCivilDate } from "../util/civilDate";
import TintedChip from "./TintedChip";

interface StockChipProps {
  readonly availability: SwagStoreAvailability;
  /** Units left, shown while stock is low. */
  readonly stockLeft?: number | null;
  /** When an out-of-stock item is due back, as a civil date. */
  readonly restockEta?: string | null;
  /** The product was taken off the store. Overrides availability. */
  readonly removed?: boolean;
}

/** The label for how available an item is. Wording only, never colour alone. */
function stockLabel({ availability, stockLeft, restockEta, removed }: StockChipProps): string {
  if (removed) return "No longer sold";
  switch (availability) {
    case "IN_STOCK":
      return "In stock";
    case "LOW_STOCK":
      return stockLeft ? `Only ${stockLeft} left` : "Low stock";
    case "OUT_OF_STOCK": {
      const back = restockEta ? formatCivilDate(restockEta) : undefined;
      return back ? `Out of stock · back ~${back}` : "Out of stock";
    }
    case "SOLD_OUT":
      return "Sold out";
  }
}

/** In stock, Only N left, Out of stock · back ~date, Sold out, or No longer sold. */
export default function StockChip(props: StockChipProps): JSX.Element {
  const color = props.removed
    ? "default"
    : props.availability === "IN_STOCK"
      ? "success"
      : props.availability === "LOW_STOCK"
        ? "warning"
        : "default";
  return <TintedChip color={color} label={stockLabel(props)} />;
}
