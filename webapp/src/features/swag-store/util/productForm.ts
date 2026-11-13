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

import type { SwagStoreAdminProduct, SwagStoreProductInput } from "../api/swagStoreTypes";

/** The product editor's basics, as the inputs hold them: numbers stay text until saved. */
export interface ProductForm {
  readonly name: string;
  /** Empty lets the backend make one from the name. */
  readonly slug: string;
  readonly description: string;
  readonly categoryId: string;
  readonly price: string;
  readonly restockPolicy: "RESTOCKABLE" | "LIMITED";
  /** Empty for no limit. */
  readonly maxPerUser: string;
  readonly images: readonly { readonly url: string; readonly alt: string }[];
  readonly alternatives: readonly string[];
}

export const EMPTY_PRODUCT_FORM: ProductForm = {
  name: "",
  slug: "",
  description: "",
  categoryId: "",
  price: "",
  restockPolicy: "RESTOCKABLE",
  maxPerUser: "",
  images: [],
  alternatives: [],
};

export type ProductFormErrors = Partial<Record<"name" | "slug" | "description" | "price" | "maxPerUser" | "images", string>>;

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const WHOLE = /^\d+$/;
const HEX = /^#[0-9A-Fa-f]{6}$/;

const wholeIn = (text: string, min: number, max: number) =>
  WHOLE.test(text.trim()) && Number(text) >= min && Number(text) <= max;

const filledImages = (form: ProductForm) => form.images.filter((i) => i.url.trim() !== "");

/** What is wrong with the basics, by field. Empty when the form can be saved. The backend checks again. */
export function checkProductForm(form: ProductForm): ProductFormErrors {
  const errors: ProductFormErrors = {};
  if (!form.name.trim()) errors.name = "Enter a name.";
  else if (form.name.trim().length > 200) errors.name = "At most 200 characters.";
  if (form.slug.trim() && !SLUG.test(form.slug.trim())) errors.slug = "Use lower-case letters, numbers and single hyphens.";
  if (form.description.length > 2000) errors.description = "At most 2,000 characters.";
  if (!wholeIn(form.price, 1, 1_000_000)) errors.price = "A whole number from 1 to 1,000,000.";
  if (form.maxPerUser.trim() && !wholeIn(form.maxPerUser, 1, 99)) {
    errors.maxPerUser = "A whole number from 1 to 99, or empty for no limit.";
  }
  if (filledImages(form).some((i) => !i.url.trim().startsWith("https://"))) {
    errors.images = "Image links must start with https://.";
  }
  return errors;
}

/** The request body for a form that passed checkProductForm. */
export function productInputOf(form: ProductForm): SwagStoreProductInput {
  const slug = form.slug.trim();
  return {
    name: form.name.trim(),
    ...(slug ? { slug } : {}),
    description: form.description.trim(),
    categoryId: form.categoryId || null,
    price: Number(form.price),
    restockPolicy: form.restockPolicy,
    maxPerUser: form.maxPerUser.trim() ? Number(form.maxPerUser) : null,
    images: filledImages(form).map((i) => ({ url: i.url.trim(), alt: i.alt.trim() })),
    alternatives: [...form.alternatives],
  };
}

/** A saved product as the editor's form. */
export function productFormOf(product: SwagStoreAdminProduct): ProductForm {
  return {
    name: product.name,
    slug: product.slug,
    description: product.description,
    categoryId: product.categoryId ?? "",
    price: String(product.price),
    restockPolicy: product.restockPolicy,
    maxPerUser: product.maxPerUser === null ? "" : String(product.maxPerUser),
    images: product.images.map((i) => ({ url: i.url, alt: i.alt })),
    alternatives: [...product.alternatives],
  };
}

/** An option as the options editor holds it. An empty swatch means none. */
export interface OptionDraft {
  readonly name: string;
  readonly values: readonly { readonly value: string; readonly swatchHex: string }[];
}

/** The first thing wrong with a set of options, or undefined when it can be saved. */
export function checkOptions(options: readonly OptionDraft[]): string | undefined {
  const names = new Map<string, string>();
  for (const option of options) {
    const name = option.name.trim();
    if (!name) return "Every option needs a name.";
    const firstName = names.get(name.toLowerCase());
    if (firstName) return `There are two options called ${firstName}.`;
    names.set(name.toLowerCase(), name);
    if (option.values.length === 0) return `${name} needs at least one value.`;
    // Lower-cased value → its first spelling, so a clash is named as first written.
    const values = new Map<string, string>();
    for (const v of option.values) {
      const value = v.value.trim();
      if (!value) return `${name} has an empty value.`;
      const first = values.get(value.toLowerCase());
      if (first) return `${name} has the value ${first} twice.`;
      values.set(value.toLowerCase(), value);
      if (v.swatchHex.trim() && !HEX.test(v.swatchHex.trim())) return `${value}'s swatch must be a colour like #1A2B3C.`;
    }
  }
  return undefined;
}
