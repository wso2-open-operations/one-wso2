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

import { describe, expect, it } from "vitest";
import {
  checkOptions,
  checkProductForm,
  EMPTY_PRODUCT_FORM,
  productFormOf,
  productInputOf,
  type ProductForm,
} from "./productForm";
import { photo } from "../testing/fixtures";

const valid: ProductForm = {
  ...EMPTY_PRODUCT_FORM,
  name: "WSO2 Hoodie",
  slug: "wso2-hoodie",
  price: "90",
  images: [photo("front", { alt: "Front" })],
};

describe("checkProductForm", () => {
  it("passes a complete product", () => {
    expect(checkProductForm(valid)).toEqual({});
  });

  it("names each problem by field", () => {
    expect(
      checkProductForm({
        ...valid,
        name: " ",
        slug: "Bad Slug",
        price: "0",
        maxPerUser: "100",
      }),
    ).toEqual({
      name: "Enter a name.",
      slug: "Use lower-case letters, numbers and single hyphens.",
      price: "A whole number from 1 to 1,000,000.",
      maxPerUser: "A whole number from 1 to 99, or empty for no limit.",
    });
  });

  it("allows an empty slug and limit, and rejects a fractional price", () => {
    const errors = checkProductForm({ ...valid, slug: "", maxPerUser: "", price: "9.5" });
    expect(errors).toEqual({ price: "A whole number from 1 to 1,000,000." });
  });
});

describe("productInputOf and productFormOf", () => {
  it("turns the form into the request body, trimming text and sending photos as view, path and alt", () => {
    expect(
      productInputOf({
        ...valid,
        name: " WSO2 Hoodie ",
        maxPerUser: "2",
        images: [photo("front", { alt: " Front " })],
      }),
    ).toEqual({
      name: "WSO2 Hoodie",
      slug: "wso2-hoodie",
      description: "",
      categoryId: null,
      price: 90,
      restockPolicy: "RESTOCKABLE",
      maxPerUser: 2,
      images: [{ view: "front", path: photo("front").path, alt: "Front" }],
      alternatives: [],
    });
  });

  it("keeps photos whose url is null and sends them in view order", () => {
    const images = [photo("detail-1", { url: null }), photo("back", { url: null }), photo("front", { url: null })];
    expect(productInputOf({ ...valid, images }).images).toEqual([
      { view: "front", path: photo("front").path, alt: "" },
      { view: "back", path: photo("back").path, alt: "" },
      { view: "detail-1", path: photo("detail-1").path, alt: "" },
    ]);
  });

  it("leaves the slug out when it is empty, so the backend makes one", () => {
    expect(productInputOf({ ...valid, slug: "" })).not.toHaveProperty("slug");
  });

  it("round-trips a saved product", () => {
    const form = productFormOf({
      id: "p-1",
      slug: "wso2-hoodie",
      name: "WSO2 Hoodie",
      description: "Warm.",
      categoryId: "c-1",
      price: 90,
      restockPolicy: "LIMITED",
      maxPerUser: null,
      limitWindowDays: null,
      status: "DRAFT",
      publishedAt: null,
      removedAt: null,
      removalNote: null,
      options: [],
      variants: [],
      images: [],
      alternatives: ["p-2"],
    });
    expect(form).toMatchObject({ price: "90", maxPerUser: "", categoryId: "c-1", restockPolicy: "LIMITED", alternatives: ["p-2"] });
    expect(productInputOf(form)).toMatchObject({ price: 90, maxPerUser: null, categoryId: "c-1" });
  });
});

describe("checkOptions", () => {
  it("passes named options with distinct values and valid swatches", () => {
    expect(
      checkOptions([
        { name: "Colour", values: [{ value: "Black", swatchHex: "#111111" }, { value: "Grey", swatchHex: "" }] },
      ]),
    ).toBeUndefined();
    expect(checkOptions([])).toBeUndefined();
  });

  it("explains the first problem", () => {
    expect(checkOptions([{ name: "", values: [{ value: "S", swatchHex: "" }] }])).toBe("Every option needs a name.");
    expect(checkOptions([{ name: "Size", values: [] }])).toBe("Size needs at least one value.");
    expect(checkOptions([{ name: "Size", values: [{ value: "S", swatchHex: "" }, { value: "s", swatchHex: "" }] }])).toBe(
      "Size has the value S twice.",
    );
    expect(checkOptions([{ name: "Colour", values: [{ value: "Black", swatchHex: "black" }] }])).toBe(
      "Black's swatch must be a colour like #1A2B3C.",
    );
    expect(
      checkOptions([
        { name: "Size", values: [{ value: "S", swatchHex: "" }] },
        { name: "size", values: [{ value: "M", swatchHex: "" }] },
      ]),
    ).toBe("There are two options called Size.");
  });
});
