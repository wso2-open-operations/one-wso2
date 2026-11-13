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

import type { SwagStoreProductDetail, SwagStoreVariant } from "../api/swagStoreTypes";

/** The shopper's choice so far: option name → chosen value id. */
export type OptionSelection = Readonly<Record<string, string>>;

/**
 * What choosing a value would lead to, given the other choices:
 * - available: a variant can be bought now
 * - out_of_stock: every match is out of stock, and may come back
 * - sold_out: every match is gone for good
 * - unavailable: no variant has this value with the other choices
 */
export type OptionValueState = "available" | "out_of_stock" | "sold_out" | "unavailable";

type Product = Pick<SwagStoreProductDetail, "options" | "variants" | "price">;

/** The address word for an option, such as `colour` for "Colour". */
export function optionParamName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * The choice an address describes (`?colour=Black&size=M`). Values are matched
 * by their text, ignoring case. An option with a single value is chosen for
 * the shopper.
 */
export function selectionFromSearch(product: Product, search: string): OptionSelection {
  const params = new URLSearchParams(search);
  const selection: Record<string, string> = {};
  for (const option of product.options) {
    const wanted = params.get(optionParamName(option.name))?.trim().toLowerCase();
    const match = wanted ? option.values.find((v) => v.value.toLowerCase() === wanted) : undefined;
    if (match) selection[option.name] = match.id;
    else if (option.values.length === 1) selection[option.name] = option.values[0].id;
  }
  return selection;
}

/** The address for a choice, in the product's option order. */
export function selectionToSearch(product: Product, selection: OptionSelection): string {
  const params = new URLSearchParams();
  for (const option of product.options) {
    const value = option.values.find((v) => v.id === selection[option.name]);
    if (value) params.set(optionParamName(option.name), value.value);
  }
  return params.toString();
}

const matches = (variant: SwagStoreVariant, selection: OptionSelection): boolean =>
  Object.values(selection).every((id) => variant.optionValueIds.includes(id));

/** The options not chosen yet, by name. */
export function missingOptions(product: Product, selection: OptionSelection): string[] {
  return product.options.filter((o) => !selection[o.name]).map((o) => o.name);
}

/** The variant for a complete choice, or undefined while a choice is missing or no variant has it. */
export function selectedVariant(product: Product, selection: OptionSelection): SwagStoreVariant | undefined {
  if (missingOptions(product, selection).length > 0) return undefined;
  return product.variants.find((v) => matches(v, selection));
}

const BUYABLE = new Set(["IN_STOCK", "LOW_STOCK"]);

/** What choosing `valueId` for `optionName` leads to, keeping the other options' choices. */
export function valueState(
  product: Product,
  selection: OptionSelection,
  optionName: string,
  valueId: string,
): OptionValueState {
  const candidate = { ...selection, [optionName]: valueId };
  const candidates = product.variants.filter((v) => matches(v, candidate));
  if (candidates.length === 0) return "unavailable";
  if (candidates.some((v) => BUYABLE.has(v.availability))) return "available";
  if (candidates.some((v) => v.availability === "OUT_OF_STOCK")) return "out_of_stock";
  return "sold_out";
}

/** The lowest and highest variant price, so the page can say "From 90 O2C" before a choice. */
export function priceRange(product: Product): { min: number; max: number } {
  if (product.variants.length === 0) return { min: product.price, max: product.price };
  const prices = product.variants.map((v) => v.price);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}
