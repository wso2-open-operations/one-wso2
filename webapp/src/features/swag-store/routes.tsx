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
import { Route } from "react-router";
import { Skeleton } from "@wso2/oxygen-ui";
import SwagStoreShell from "./components/SwagStoreShell";

// Every page loads on first use, so none of the store is downloaded until it is opened.
const ShopPage = lazy(() => import("./shop/pages/ShopPage"));
const ProductPage = lazy(() => import("./shop/pages/ProductPage"));

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
  </Route>
);
