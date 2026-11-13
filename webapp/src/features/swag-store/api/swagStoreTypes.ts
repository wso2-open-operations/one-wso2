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

/** A photo slot, in gallery order (util/photos PHOTO_VIEWS). */
export type SwagStorePhotoView =
  | "front"
  | "back"
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "detail-1"
  | "detail-2"
  | "detail-3"
  | "detail-4";

/** One product photo. `url` is signed for reading and lasts at least a day; null when it can't be shown. */
export interface SwagStoreProductImage {
  readonly view: SwagStorePhotoView;
  /** The blob path, which the editor sends back on Save. */
  readonly path: string;
  readonly url: string | null;
  readonly alt: string;
}

/** A photo as the product PATCH body carries it. */
export interface SwagStorePhotoInput {
  readonly view: SwagStorePhotoView;
  readonly path: string;
  readonly alt: string;
}

/** POST /admin/products/{id}/images: the stored photo. The product changes only when it is saved. */
export interface SwagStorePhotoUpload {
  readonly view: SwagStorePhotoView;
  readonly path: string;
  readonly url: string | null;
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

/**
 * Whether a cart or quote line can be ordered: OK, OUT_OF_STOCK, REMOVED
 * (taken off the store), or LIMIT (over the per-person limit).
 */
export type SwagStoreLineState = "OK" | "OUT_OF_STOCK" | "REMOVED" | "LIMIT";

/** One line of the cart, priced live. */
export interface SwagStoreCartLine {
  readonly id: string;
  readonly variantId: string;
  readonly productSlug: string;
  readonly name: string;
  /** The variant's option values, such as "Black · M". */
  readonly options: string;
  readonly image: string | null;
  readonly unitPrice: number;
  readonly quantity: number;
  readonly lineTotal: number;
  readonly state: SwagStoreLineState;
  /** Why the line can't be ordered, in the backend's words. Null for an OK line. */
  readonly reason: string | null;
  readonly availability: SwagStoreAvailability;
}

/** GET /cart. */
export interface SwagStoreCart {
  readonly lines: readonly SwagStoreCartLine[];
  /** Units over every line, including lines that can't be ordered. */
  readonly itemCount: number;
  /** Whole O2C over the OK lines only. */
  readonly total: number;
}

/** POST /quotes and POST /orders body. There is no payee: the store always pays its own treasury. */
export interface SwagStoreCheckoutInput {
  readonly pickupOfficeId: string;
  readonly walletAddress: string;
  /** The total the shopper confirmed. A different total answers 409 quote_changed instead of charging it. */
  readonly expectedTotal?: number;
}

/** Something that stops an order, such as `insufficient_funds` or `lines_unavailable`. */
export interface SwagStoreProblem {
  readonly code: string;
  readonly message: string;
}

export interface SwagStoreQuoteLine {
  readonly lineId: string;
  readonly name: string;
  readonly options: string;
  readonly unitPrice: number;
  readonly quantity: number;
  readonly state: SwagStoreLineState;
  readonly reason: string | null;
}

/** POST /quotes: the cart priced for one office and wallet. Nothing is stored. */
export interface SwagStoreQuote {
  readonly lines: readonly SwagStoreQuoteLine[];
  /** Whole O2C over the OK lines. */
  readonly total: number;
  readonly pickupOffice: { readonly id: string; readonly name: string; readonly leadTimeDays: number } | null;
  readonly wallet: { readonly walletAddress: string; readonly balance: string } | null;
  /** The backend's verdict. The UI never decides this itself. */
  readonly canPlace: boolean;
  readonly problems: readonly SwagStoreProblem[];
}

export type SwagStoreOrderStatus = "PENDING_PAYMENT" | "CONFIRMED" | "FAILED" | "READY_FOR_PICKUP" | "COLLECTED";

/** POST /orders and POST /orders/{orderNo}/payments. */
export interface SwagStorePlacedOrder {
  readonly id: string;
  /** Such as "SS-10482". */
  readonly orderNo: string;
  /** CONFIRMED when paid (201), PENDING_PAYMENT while the payment is being confirmed (202). */
  readonly status: SwagStoreOrderStatus;
  readonly total: number;
  readonly pickupOffice: { readonly name: string };
  readonly placedAt: string;
}

/** One of the caller's orders in a list. */
export interface SwagStoreOrderSummary {
  readonly id: string;
  readonly orderNo: string;
  readonly status: SwagStoreOrderStatus;
  readonly total: number;
  readonly officeName: string;
  readonly placedAt: string;
  /** Why a FAILED order failed, as an error code. */
  readonly failureCode: string | null;
}

/** GET /orders. */
export interface SwagStoreOrderList {
  readonly items: readonly SwagStoreOrderSummary[];
  readonly total: number;
}

export interface SwagStoreOrderLine {
  readonly name: string;
  readonly options: string;
  readonly sku: string;
  readonly unitPrice: number;
  readonly quantity: number;
}

/** One status change. `from` is null for the first. */
export interface SwagStoreOrderEvent {
  readonly from: string | null;
  readonly to: string;
  readonly note: string | null;
  readonly at: string;
}

/** GET /orders/{orderNo}. */
export interface SwagStoreOrderDetail extends SwagStoreOrderSummary {
  readonly lines: readonly SwagStoreOrderLine[];
  readonly timeline: readonly SwagStoreOrderEvent[];
  readonly pickupOffice: SwagStoreOffice;
  readonly confirmedAt: string | null;
  readonly readyAt: string | null;
  readonly collectedAt: string | null;
}

/**
 * A "Notify me" alert. PENDING waits for stock; NOTIFIED means the back-in-stock
 * email went out; CLOSED means it was cancelled or the item stopped being sold.
 */
export type SwagStoreAlertStatus = "PENDING" | "NOTIFIED" | "CLOSED";

/** One of the caller's alerts, from GET /stock-alerts. */
export interface SwagStoreAlert {
  readonly id: string;
  readonly variantId: string;
  readonly sku: string;
  readonly productSlug: string;
  readonly productName: string;
  /** The variant's option values, such as "Heather grey · S". Empty for a product with no options. */
  readonly options: string;
  readonly status: SwagStoreAlertStatus;
  readonly createdAt: string;
  readonly notifiedAt: string | null;
  readonly closedAt: string | null;
}

/** GET /stock-alerts, newest first. */
export interface SwagStoreAlertList {
  readonly items: readonly SwagStoreAlert[];
}

/** An order as the store team sees it, with who placed it. */
export interface SwagStoreAdminOrder extends SwagStoreOrderSummary {
  readonly userEmail: string;
  readonly userName: string;
  /** Why it needs a person, such as `payment_mismatch` or `uncollected`. Null otherwise. */
  readonly attentionReason: string | null;
}

/** GET /admin/dashboard. Each part is present only for the role that may see it. */
export interface SwagStoreDashboard {
  /** For catalog managers. */
  readonly catalog?: {
    readonly active: number;
    readonly draft: number;
    readonly removed: number;
    readonly lowStockVariants: number;
    readonly outOfStockVariants: number;
    readonly pendingAlerts: number;
  };
  /** For fulfilment ops. */
  readonly orders?: {
    readonly pendingPayment: number;
    readonly toPrepare: number;
    readonly readyForPickup: number;
    readonly collectedToday: number;
    readonly needsAttention: readonly SwagStoreAdminOrder[];
  };
}

/** POST /admin/orders/search body. */
export interface SwagStoreOrderSearch {
  readonly filters: {
    readonly status?: SwagStoreOrderStatus;
    readonly pickupOfficeId?: string;
    /** An order number or an email address. */
    readonly searchQuery?: string;
  };
  readonly pagination: { readonly limit: number; readonly offset: number };
}

/** POST /admin/orders/search. */
export interface SwagStoreAdminOrderList {
  readonly items: readonly SwagStoreAdminOrder[];
  readonly total: number;
}

/** A fulfilment note, newest last. */
export interface SwagStoreOrderNote {
  readonly note: string;
  /** Who wrote it. */
  readonly actor: string;
  readonly at: string;
}

/** GET /admin/orders/{orderNo}: the order with who placed it, the payment reference and the team's notes. */
export interface SwagStoreAdminOrderDetail extends SwagStoreOrderDetail {
  readonly userEmail: string;
  readonly userName: string;
  readonly attentionReason: string | null;
  readonly paymentReference: string;
  /** Who handed it over, once collected. */
  readonly collectedBy: string | null;
  readonly notes: readonly SwagStoreOrderNote[];
}

/** PATCH /admin/orders/{orderNo}: the next step only. COLLECTED needs `idChecked: true`. */
export interface SwagStoreOrderPatch {
  readonly status: "READY_FOR_PICKUP" | "COLLECTED";
  readonly idChecked?: boolean;
  readonly note?: string;
}

/** A pickup office as the store team manages it. */
export interface SwagStoreAdminOffice {
  readonly id: string;
  readonly name: string;
  readonly address: string;
  readonly country: string;
  readonly collectionPoint: string;
  readonly hours: string;
  readonly leadTimeDays: number;
  /** HR location names whose people get this office by default. */
  readonly hrLocations: readonly string[];
  readonly active: boolean;
  readonly sort: number;
}

/** POST /admin/pickup-offices and PATCH /admin/pickup-offices/{id} body. */
export type SwagStoreOfficeInput = Omit<SwagStoreAdminOffice, "id">;

export type SwagStoreProductStatus = "DRAFT" | "ACTIVE" | "REMOVED";

/** A row of GET /admin/products. */
export interface SwagStoreAdminProductRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly status: SwagStoreProductStatus;
  readonly price: number;
  readonly image: string | null;
  /** Units on hand and not reserved, over every variant. */
  readonly freeStock: number;
  readonly unitsSold30d: number;
}

export interface SwagStoreAdminProductList {
  readonly items: readonly SwagStoreAdminProductRow[];
  readonly total: number;
}

/** A variant as the catalog manager sees it, with its stock. */
export interface SwagStoreAdminVariant {
  readonly id: string;
  readonly sku: string;
  /** Its option values as one label, such as "Black · M". */
  readonly options: string;
  readonly optionValueIds: readonly string[];
  /** Added to the product's price. */
  readonly priceDelta: number;
  readonly onHand: number;
  /** Held by orders waiting for payment or handover. */
  readonly reserved: number;
  readonly free: number;
  /** A civil date, or null. */
  readonly restockEta: string | null;
  readonly active: boolean;
}

/** GET /admin/products/{id}. */
export interface SwagStoreAdminProduct {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly categoryId: string | null;
  readonly price: number;
  readonly restockPolicy: "RESTOCKABLE" | "LIMITED";
  readonly maxPerUser: number | null;
  readonly limitWindowDays: number | null;
  readonly status: SwagStoreProductStatus;
  readonly publishedAt: string | null;
  readonly removedAt: string | null;
  readonly removalNote: string | null;
  readonly options: readonly SwagStoreOption[];
  readonly variants: readonly SwagStoreAdminVariant[];
  readonly images: readonly SwagStoreProductImage[];
  /** Product ids offered when this one can't be bought. */
  readonly alternatives: readonly string[];
}

/** POST /admin/products and PATCH /admin/products/{id} body (not a status change). */
export interface SwagStoreProductInput {
  readonly name: string;
  readonly slug?: string;
  readonly description: string;
  readonly categoryId: string | null;
  readonly price: number;
  readonly restockPolicy: "RESTOCKABLE" | "LIMITED";
  readonly maxPerUser: number | null;
  readonly images: readonly SwagStorePhotoInput[];
  readonly alternatives: readonly string[];
}

/** GET /admin/products/{id}/removal-impact: what removing a product touches. */
export interface SwagStoreRemovalImpact {
  /** Still served after removal. */
  readonly openOrders: readonly { readonly orderNo: string; readonly status: string; readonly units: number }[];
  readonly openUnits: number;
  readonly carts: number;
  readonly cartUnits: number;
  readonly pendingAlerts: number;
  readonly freeStock: number;
}

/** PUT /admin/products/{id}/options body. Variants are rebuilt from the options. */
export interface SwagStoreOptionsInput {
  readonly options: readonly {
    readonly name: string;
    readonly values: readonly { readonly value: string; readonly swatchHex?: string }[];
  }[];
}

/** PATCH /admin/products/{id}/variants/{variantId} body. */
/** GET /admin/demand: one variant people are waiting for. */
export interface SwagStoreDemandRow {
  readonly productId: string;
  readonly productName: string;
  readonly variantId: string;
  readonly sku: string;
  /** "Black · M"; empty for a product with no options. */
  readonly options: string;
  readonly pendingAlerts: number;
  /** When the first of those people asked (an instant). */
  readonly firstAlertAt: string;
  /** The restock date as a UTC-midnight timestamp, or null when none is set. */
  readonly restockEta: string | null;
  readonly free: number;
}

export interface SwagStoreVariantPatch {
  readonly sku?: string;
  readonly priceDelta?: number;
  readonly active?: boolean;
  readonly restockEta?: string | null;
}

export type SwagStoreStockReason = "RECEIVE" | "ADJUST" | "WRITE_OFF";

/** POST /admin/variants/{id}/stock-movements body. RECEIVE and WRITE_OFF take a positive delta. */
export interface SwagStoreStockMovement {
  readonly delta: number;
  readonly reason: SwagStoreStockReason;
  readonly note?: string;
}

/** The variant's stock after a movement, and how many alerts it set off. */
export interface SwagStoreStockResult {
  readonly onHand: number;
  readonly reserved: number;
  readonly free: number;
  readonly notified: number;
}

/** GET /admin/categories row. */
export interface SwagStoreAdminCategory {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly sort: number;
}
