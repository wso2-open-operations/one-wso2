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

// Backend responses for the store's tests. Each builder returns a valid value
// that a test overrides only where it matters.

import type {
  SwagStoreAlert,
  SwagStoreCart,
  SwagStoreCartLine,
  SwagStoreMe,
  SwagStoreOffice,
  SwagStoreOrderDetail,
  SwagStoreOrderSummary,
  SwagStorePlacedOrder,
  SwagStoreProductCard,
  SwagStoreProductDetail,
  SwagStoreQuote,
  SwagStoreVariant,
  SwagStoreWallet,
} from "../api/swagStoreTypes";

/** A shopper with no store role. */
export function me(overrides: Partial<SwagStoreMe> = {}): SwagStoreMe {
  return {
    email: "shopper@wso2.com",
    firstName: "Sam",
    lastName: "Shopper",
    roles: [],
    employeeStatus: "Active",
    ...overrides,
  };
}

/** The caller's default wallet. */
export function wallet(overrides: Partial<SwagStoreWallet> = {}): SwagStoreWallet {
  return { walletAddress: "0xWALLET", balance: "202.50", defaultWallet: true, ...overrides };
}

/** A product in the grid. */
export function productCard(overrides: Partial<SwagStoreProductCard> = {}): SwagStoreProductCard {
  return {
    id: "p-hoodie",
    slug: "wso2-hoodie",
    name: "WSO2 Hoodie",
    price: 90,
    image: "https://wso2.cachefly.net/swag/hoodie.png",
    availability: "IN_STOCK",
    status: "ACTIVE",
    ...overrides,
  };
}

/** One variant of the hoodie. */
export function variant(overrides: Partial<SwagStoreVariant> = {}): SwagStoreVariant {
  return {
    id: "v-black-m",
    sku: "HOODIE-BLK-M",
    price: 90,
    options: "Black · M",
    optionValueIds: ["black", "m"],
    availability: "IN_STOCK",
    stockLeft: null,
    restockEta: null,
    ...overrides,
  };
}

/**
 * The hoodie: Colour (Black, Heather grey) × Size (S, M). Black S is low,
 * grey S is out of stock until a known date, and there is no grey M.
 */
export function hoodie(overrides: Partial<SwagStoreProductDetail> = {}): SwagStoreProductDetail {
  return {
    id: "p-hoodie",
    slug: "wso2-hoodie",
    name: "WSO2 Hoodie",
    description: "A warm hoodie.\nMachine washable.",
    price: 90,
    status: "ACTIVE",
    restockPolicy: "RESTOCKABLE",
    maxPerUser: 2,
    options: [
      {
        name: "Colour",
        values: [
          { id: "black", value: "Black", swatchHex: "#111111" },
          { id: "grey", value: "Heather grey", swatchHex: "#9A9A9A" },
        ],
      },
      {
        name: "Size",
        values: [
          { id: "s", value: "S", swatchHex: null },
          { id: "m", value: "M", swatchHex: null },
        ],
      },
    ],
    variants: [
      variant({ id: "v-black-s", sku: "HOODIE-BLK-S", options: "Black · S", optionValueIds: ["black", "s"], availability: "LOW_STOCK", stockLeft: 2 }),
      variant(),
      variant({
        id: "v-grey-s",
        sku: "HOODIE-GRY-S",
        price: 95,
        options: "Heather grey · S",
        optionValueIds: ["grey", "s"],
        availability: "OUT_OF_STOCK",
        restockEta: "2026-12-12",
      }),
    ],
    images: [{ url: "https://wso2.cachefly.net/swag/hoodie.png", alt: "Black WSO2 hoodie, front" }],
    alternatives: [],
    ...overrides,
  };
}

/** A product with no options: one variant. */
export function powerbank(overrides: Partial<SwagStoreProductDetail> = {}): SwagStoreProductDetail {
  return {
    ...hoodie(),
    id: "p-powerbank",
    slug: "wso2-powerbank",
    name: "WSO2 Powerbank",
    description: "10,000 mAh.",
    price: 70,
    maxPerUser: null,
    options: [],
    variants: [variant({ id: "v-powerbank", sku: "POWERBANK", price: 70, options: "", optionValueIds: [] })],
    images: [],
    ...overrides,
  };
}

/** A pickup office. */
export function office(overrides: Partial<SwagStoreOffice> = {}): SwagStoreOffice {
  return {
    id: "office-colombo",
    name: "Colombo",
    address: "20 Palm Grove, Colombo 3",
    collectionPoint: "Reception, level 2",
    hours: "Mon–Fri, 9:00–17:00",
    leadTimeDays: 2,
    ...overrides,
  };
}

/** A cart line for the hoodie, Black · M. */
export function cartLine(overrides: Partial<SwagStoreCartLine> = {}): SwagStoreCartLine {
  return {
    id: "line-hoodie",
    variantId: "v-black-m",
    productSlug: "wso2-hoodie",
    name: "WSO2 Hoodie",
    options: "Black · M",
    image: null,
    unitPrice: 90,
    quantity: 2,
    lineTotal: 180,
    state: "OK",
    reason: null,
    availability: "IN_STOCK",
    ...overrides,
  };
}

/** A cart whose total is the sum of its OK lines, as the backend computes it. */
export function cart(lines: SwagStoreCartLine[] = [cartLine()]): SwagStoreCart {
  return {
    lines,
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    total: lines.filter((l) => l.state === "OK").reduce((n, l) => n + l.lineTotal, 0),
  };
}

/** A quote that can be placed: the hoodie line, at Colombo, from the default wallet. */
export function quote(overrides: Partial<SwagStoreQuote> = {}): SwagStoreQuote {
  return {
    lines: [
      { lineId: "line-hoodie", name: "WSO2 Hoodie", options: "Black · M", unitPrice: 90, quantity: 2, state: "OK", reason: null },
    ],
    total: 180,
    pickupOffice: { id: "office-colombo", name: "Colombo", leadTimeDays: 2 },
    wallet: { walletAddress: "0xWALLET", balance: "202.50" },
    canPlace: true,
    problems: [],
    ...overrides,
  };
}

/** What POST /orders answers for a paid order. */
export function placedOrder(overrides: Partial<SwagStorePlacedOrder> = {}): SwagStorePlacedOrder {
  return {
    id: "order-1",
    orderNo: "SS-10482",
    status: "CONFIRMED",
    total: 180,
    pickupOffice: { name: "Colombo" },
    placedAt: "2026-11-13T04:30:00Z",
    ...overrides,
  };
}

/** An order in the caller's list. */
export function orderSummary(overrides: Partial<SwagStoreOrderSummary> = {}): SwagStoreOrderSummary {
  return {
    id: "order-1",
    orderNo: "SS-10482",
    status: "CONFIRMED",
    total: 180,
    officeName: "Colombo",
    placedAt: "2026-11-13T04:30:00Z",
    failureCode: null,
    ...overrides,
  };
}

/** A paid order for two hoodies, to collect at Colombo. */
export function orderDetail(overrides: Partial<SwagStoreOrderDetail> = {}): SwagStoreOrderDetail {
  return {
    ...orderSummary(),
    lines: [{ name: "WSO2 Hoodie", options: "Black · M", sku: "HOODIE-BLK-M", unitPrice: 90, quantity: 2 }],
    timeline: [
      { from: null, to: "PENDING_PAYMENT", note: null, at: "2026-11-13T04:30:00Z" },
      { from: "PENDING_PAYMENT", to: "CONFIRMED", note: null, at: "2026-11-13T04:30:02Z" },
    ],
    pickupOffice: office(),
    confirmedAt: "2026-11-13T04:30:02Z",
    readyAt: null,
    collectedAt: null,
    ...overrides,
  };
}

/** A waiting alert on the grey hoodie in S, which is out of stock. */
export function stockAlert(overrides: Partial<SwagStoreAlert> = {}): SwagStoreAlert {
  return {
    id: "alert-1",
    variantId: "v-grey-s",
    sku: "HOODIE-GRY-S",
    productSlug: "wso2-hoodie",
    productName: "WSO2 Hoodie",
    options: "Heather grey · S",
    status: "PENDING",
    createdAt: "2026-11-10T08:00:00Z",
    notifiedAt: null,
    closedAt: null,
    ...overrides,
  };
}
