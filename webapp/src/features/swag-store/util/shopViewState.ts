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

import type { UrlViewCodec } from "@hooks/useUrlViewState";

/** How the shop's grid is ordered. The backend accepts exactly these. */
export type ShopSort = "popular" | "price_asc" | "price_desc" | "newest";

export const SHOP_SORTS: readonly { readonly value: ShopSort; readonly label: string }[] = [
  { value: "popular", label: "Popular" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "newest", label: "Newest" },
];

/** What the shop's grid shows. The address holds it, so a filtered grid can be linked and survives a refresh. */
export interface ShopView {
  /** Search text, trimmed. Empty for none. */
  readonly q: string;
  /** A category slug. Empty for every category. */
  readonly category: string;
  readonly sort: ShopSort;
  readonly inStock: boolean;
  /** 1-based. */
  readonly page: number;
}

export const DEFAULT_SHOP_VIEW: ShopView = { q: "", category: "", sort: "popular", inStock: false, page: 1 };

/** Products per page of the grid: four full rows on a wide screen. */
export const SHOP_PAGE_SIZE = 24;

/** The backend refuses a longer search. */
const MAX_QUERY = 100;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PAGE = /^[1-9]\d{0,3}$/;

const isSort = (value: string | null): value is ShopSort => SHOP_SORTS.some((s) => s.value === value);

/**
 * The shop's address codec. Anything it doesn't recognise reads as the
 * default, so a hand-edited link shows the grid instead of a backend 400.
 */
export const shopViewCodec: UrlViewCodec<ShopView> = {
  parse(search) {
    const params = new URLSearchParams(search);
    const category = params.get("category") ?? "";
    const sort = params.get("sort");
    const page = params.get("page") ?? "";
    return {
      q: (params.get("q") ?? "").trim().slice(0, MAX_QUERY),
      category: SLUG.test(category) ? category : "",
      sort: isSort(sort) ? sort : DEFAULT_SHOP_VIEW.sort,
      inStock: params.get("inStock") === "1",
      page: PAGE.test(page) ? Number(page) : 1,
    };
  },
  serialize(view) {
    const params = new URLSearchParams();
    if (view.q) params.set("q", view.q);
    if (view.category) params.set("category", view.category);
    if (view.sort !== DEFAULT_SHOP_VIEW.sort) params.set("sort", view.sort);
    if (view.inStock) params.set("inStock", "1");
    if (view.page > 1) params.set("page", String(view.page));
    return params.toString();
  },
};

/** True when a filter narrows the grid, so an empty grid means "nothing matches", not "nothing for sale". */
export function isFiltered(view: ShopView): boolean {
  return Boolean(view.q || view.category || view.inStock);
}

/** The GET /products query string for one page of a view. */
export function productListQuery(view: ShopView): string {
  const params = new URLSearchParams();
  if (view.q) params.set("q", view.q);
  if (view.category) params.set("category", view.category);
  params.set("sort", view.sort);
  if (view.inStock) params.set("inStock", "true");
  params.set("limit", String(SHOP_PAGE_SIZE));
  params.set("offset", String((view.page - 1) * SHOP_PAGE_SIZE));
  return params.toString();
}
