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
import { DEFAULT_SHOP_VIEW, isFiltered, productListQuery, shopViewCodec, SHOP_PAGE_SIZE } from "./shopViewState";

const parse = shopViewCodec.parse;
const serialize = shopViewCodec.serialize;

describe("shopViewCodec.parse", () => {
  it("reads an empty address as the default view", () => {
    expect(parse("")).toEqual(DEFAULT_SHOP_VIEW);
  });

  it("reads every filter", () => {
    expect(parse("q=hoodie&category=apparel&sort=price_asc&inStock=1&page=2")).toEqual({
      q: "hoodie",
      category: "apparel",
      sort: "price_asc",
      inStock: true,
      page: 2,
    });
  });

  it("falls back to the default for values it doesn't know, rather than sending them on", () => {
    expect(parse("sort=cheapest&inStock=yes&page=-3&category=Bad%20Slug")).toEqual(DEFAULT_SHOP_VIEW);
    expect(parse("page=1.5").page).toBe(1);
  });

  it("trims the search and caps it at the backend's 100 characters", () => {
    expect(parse("q=%20%20mug%20").q).toBe("mug");
    expect(parse(`q=${"a".repeat(150)}`).q).toHaveLength(100);
  });
});

describe("shopViewCodec.serialize", () => {
  it("writes nothing for the default view", () => {
    expect(serialize(DEFAULT_SHOP_VIEW)).toBe("");
  });

  it("writes only what differs from the default, and round-trips", () => {
    const view = { ...DEFAULT_SHOP_VIEW, q: "tote bag", sort: "newest" as const, inStock: true };
    expect(serialize(view)).toBe("q=tote+bag&sort=newest&inStock=1");
    expect(parse(serialize(view))).toEqual(view);
  });
});

describe("isFiltered", () => {
  it("is true when a filter narrows the list, and false for sort or page alone", () => {
    expect(isFiltered(DEFAULT_SHOP_VIEW)).toBe(false);
    expect(isFiltered({ ...DEFAULT_SHOP_VIEW, sort: "newest", page: 3 })).toBe(false);
    expect(isFiltered({ ...DEFAULT_SHOP_VIEW, q: "mug" })).toBe(true);
    expect(isFiltered({ ...DEFAULT_SHOP_VIEW, category: "tech" })).toBe(true);
    expect(isFiltered({ ...DEFAULT_SHOP_VIEW, inStock: true })).toBe(true);
  });
});

describe("productListQuery", () => {
  it("asks the backend for one page of the view", () => {
    const query = new URLSearchParams(
      productListQuery({ q: "mug", category: "drinkware", sort: "price_desc", inStock: true, page: 3 }),
    );
    expect(Object.fromEntries(query)).toEqual({
      q: "mug",
      category: "drinkware",
      sort: "price_desc",
      inStock: "true",
      limit: String(SHOP_PAGE_SIZE),
      offset: String(2 * SHOP_PAGE_SIZE),
    });
  });

  it("leaves out empty filters", () => {
    expect(productListQuery(DEFAULT_SHOP_VIEW)).toBe(`sort=popular&limit=${SHOP_PAGE_SIZE}&offset=0`);
  });
});
