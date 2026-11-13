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

import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route } from "react-router";
import { Skeleton } from "@wso2/oxygen-ui";
import SwagStoreShell from "./components/SwagStoreShell";
import SwagStoreAdminLanding from "./admin/components/SwagStoreAdminLanding";
import SwagStoreAdminRequires from "./admin/components/SwagStoreAdminRequires";
import SwagStoreAdminShell from "./admin/components/SwagStoreAdminShell";

// Every page loads on first use, so none of the store is downloaded until it is opened.
const ShopPage = lazy(() => import("./shop/pages/ShopPage"));
const ProductPage = lazy(() => import("./shop/pages/ProductPage"));
const CartPage = lazy(() => import("./shop/pages/CartPage"));
const CheckoutPage = lazy(() => import("./shop/pages/CheckoutPage"));
const OrdersPage = lazy(() => import("./shop/pages/OrdersPage"));
const OrderPage = lazy(() => import("./shop/pages/OrderPage"));
const AlertsPage = lazy(() => import("./shop/pages/AlertsPage"));
const DashboardPage = lazy(() => import("./admin/pages/DashboardPage"));
const AdminOrdersPage = lazy(() => import("./admin/pages/AdminOrdersPage"));
const OfficesPage = lazy(() => import("./admin/pages/OfficesPage"));
const ProductsPage = lazy(() => import("./admin/pages/ProductsPage"));
const ProductEditorPage = lazy(() => import("./admin/pages/ProductEditorPage"));

const deferred = (page: ReactNode) => (
  <Suspense fallback={<Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5 }} />}>{page}</Suspense>
);

/**
 * Every shop route, as one fragment for App.tsx. All of them render inside
 * SwagStoreShell, which resolves access before any page asks for data. App.tsx
 * mounts this only while the `swagStore` preview flag is on.
 */
export const swagStoreShopRoutes = (
  <Route path="store" element={<SwagStoreShell />}>
    <Route index element={deferred(<ShopPage />)} />
    <Route path="p/:slug" element={deferred(<ProductPage />)} />
    <Route path="cart" element={deferred(<CartPage />)} />
    <Route path="cart/checkout" element={deferred(<CheckoutPage />)} />
    <Route path="orders" element={deferred(<OrdersPage />)} />
    <Route path="orders/:orderNo" element={deferred(<OrderPage />)} />
    <Route path="alerts" element={deferred(<AlertsPage />)} />
  </Route>
);

/**
 * The store team's screens under People Ops, as one fragment for App.tsx. All
 * render inside SwagStoreAdminShell, and each leaf checks its own role.
 * App.tsx mounts this only while the `swagStore` preview flag is on.
 */
export const swagStoreAdminRoutes = (
  <Route path="people-ops/swag-store" element={<SwagStoreAdminShell />}>
    <Route index element={<SwagStoreAdminLanding />} />
    <Route
      path="dashboard"
      element={<SwagStoreAdminRequires need="ANY">{deferred(<DashboardPage />)}</SwagStoreAdminRequires>}
    />
    <Route
      path="orders"
      element={<SwagStoreAdminRequires need="FULFILMENT_OPS">{deferred(<AdminOrdersPage />)}</SwagStoreAdminRequires>}
    />
    <Route
      path="orders/:orderNo"
      element={<SwagStoreAdminRequires need="FULFILMENT_OPS">{deferred(<AdminOrdersPage />)}</SwagStoreAdminRequires>}
    />
    <Route path="products" element={<Navigate to="active" replace />} />
    {(["active", "draft", "removed"] as const).map((tab) => (
      <Route
        key={tab}
        path={`products/${tab}`}
        element={<SwagStoreAdminRequires need="CATALOG_MANAGER">{deferred(<ProductsPage />)}</SwagStoreAdminRequires>}
      />
    ))}
    <Route
      path="products/new"
      element={<SwagStoreAdminRequires need="CATALOG_MANAGER">{deferred(<ProductEditorPage />)}</SwagStoreAdminRequires>}
    />
    <Route
      path="products/:productId"
      element={<SwagStoreAdminRequires need="CATALOG_MANAGER">{deferred(<ProductEditorPage />)}</SwagStoreAdminRequires>}
    />
    <Route
      path="settings/offices"
      element={<SwagStoreAdminRequires need="FULFILMENT_OPS">{deferred(<OfficesPage />)}</SwagStoreAdminRequires>}
    />
  </Route>
);
