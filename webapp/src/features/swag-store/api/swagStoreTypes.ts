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

// Wire types of the ONE_WSO2_SWAG_STORE_BACKEND_URL backend, as its OpenAPI
// document describes them. Coin amounts are whole O2C, except wallet balances,
// which arrive as decimal strings so no precision is lost.

/** A store role. A shopper holds none. */
export type SwagStoreRole = "catalog_manager" | "fulfilment_ops";

/** GET /users/me. */
export interface SwagStoreMe {
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly roles: readonly SwagStoreRole[];
  /** The HR employee status, or null when HR could not be asked. */
  readonly employeeStatus: string | null;
}

/** One coin wallet of the caller, from GET /wallets. */
export interface SwagStoreWallet {
  readonly walletAddress: string;
  /** A decimal string such as "202.50". */
  readonly balance: string;
  /** The wallet payments use unless the shopper picks another. Listed first. */
  readonly defaultWallet: boolean;
}

/** GET /cart/summary. */
export interface SwagStoreCartSummary {
  /** Units in the cart, summed over every line. */
  readonly itemCount: number;
}

/** GET /categories: a category that has active products. */
export interface SwagStoreCategory {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
}

/**
 * How available a product or variant is. OUT_OF_STOCK can come back (a
 * restockable item); SOLD_OUT is gone for good (a limited batch).
 */
export type SwagStoreAvailability = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "SOLD_OUT";

/** A product in a list: the grid, or a product's alternatives. */
export interface SwagStoreProductCard {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  /** Whole O2C. */
  readonly price: number;
  /** The first image's URL, or null when the product has none. */
  readonly image: string | null;
  readonly availability: SwagStoreAvailability;
  readonly status: string;
}

/** GET /products. */
export interface SwagStoreProductList {
  readonly items: readonly SwagStoreProductCard[];
  /** Matches across every page. */
  readonly total: number;
}

/** One value of an option, such as "Black" for "Colour". */
export interface SwagStoreOptionValue {
  readonly id: string;
  readonly value: string;
  /** A colour to draw the swatch with, from the catalog. Null for options that aren't colours. */
  readonly swatchHex: string | null;
}

/** A choice the shopper makes, such as "Colour" or "Size". Only values some variant uses are listed. */
export interface SwagStoreOption {
  readonly name: string;
  readonly values: readonly SwagStoreOptionValue[];
}

/** One buyable combination of option values. */
export interface SwagStoreVariant {
  readonly id: string;
  readonly sku: string;
  /** Whole O2C, with any variant price change already applied. */
  readonly price: number;
  /** Its option values as one label, such as "Black · M". Empty for a product with no options. */
  readonly options: string;
  readonly optionValueIds: readonly string[];
  readonly availability: SwagStoreAvailability;
  /** Units left, only while LOW_STOCK. */
  readonly stockLeft: number | null;
  /** A civil date ("2026-12-12"), only while OUT_OF_STOCK and only when known. */
  readonly restockEta: string | null;
}

export interface SwagStoreProductImage {
  readonly url: string;
  readonly alt: string;
}

/**
 * GET /products/{slug}. A REMOVED product comes back with no options, variants
 * or images: only its name and alternatives, so the page can say it is no longer sold.
 */
export interface SwagStoreProductDetail {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  /** Plain text. Never rendered as HTML. */
  readonly description: string;
  /** The base price, whole O2C. */
  readonly price: number;
  readonly status: "ACTIVE" | "REMOVED";
  readonly restockPolicy: string;
  /** The most one person may buy, or null for no limit. */
  readonly maxPerUser: number | null;
  readonly options: readonly SwagStoreOption[];
  readonly variants: readonly SwagStoreVariant[];
  readonly images: readonly SwagStoreProductImage[];
  readonly alternatives: readonly SwagStoreProductCard[];
}

/** POST /cart/lines body. Adding a variant already in the cart adds to that line. */
export interface SwagStoreCartLineInput {
  readonly variantId: string;
  /** 1 to 99. */
  readonly quantity: number;
}

/** An active pickup office, from GET /pickup-offices. */
export interface SwagStoreOffice {
  readonly id: string;
  readonly name: string;
  readonly address: string;
  /** Where in the office orders are handed over. */
  readonly collectionPoint: string;
  /** Opening hours as the store team wrote them. */
  readonly hours: string;
  /** Working days from payment to ready for pickup. */
  readonly leadTimeDays: number;
}

/** GET /pickup-offices. */
export interface SwagStoreOfficeList {
  readonly items: readonly SwagStoreOffice[];
  /** The caller's office from their HR location, or null when none matches. */
  readonly defaultOfficeId: string | null;
}
