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

// Every CadO2 route, as one fragment for App.tsx. All of them render inside
// Cado2Shell, which resolves access before any page asks for data. App.tsx
// mounts this only while the `cado2` preview flag is on.

import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route } from "react-router";
import { Skeleton } from "@wso2/oxygen-ui";
import Cado2Shell, { Cado2Landing, Cado2Requires } from "./components/Cado2Shell";
import { cado2Paths } from "./cado2Paths";
import MyQuotesPage from "./quotes/pages/MyQuotesPage";
import MyApprovalsPage from "./approvals/pages/MyApprovalsPage";
import Cado2AdminLayout from "./admin/components/Cado2AdminLayout";
import { FIRST_ADMIN_SECTION } from "./admin/adminSections";
import ApprovalMatrixPage from "./admin/approval-matrix/pages/ApprovalMatrixPage";
import ApprovalSlasPage from "./admin/approval-slas/pages/ApprovalSlasPage";
import LegalEntitiesPage from "./admin/legal-entities/pages/LegalEntitiesPage";
import CurrenciesPage from "./admin/currencies/pages/CurrenciesPage";
import ProductCategoriesPage from "./admin/product-categories/pages/ProductCategoriesPage";
import ProductBundlesPage from "./admin/product-bundles/pages/ProductBundlesPage";
import LegalTextsPage from "./admin/legal-texts/pages/LegalTextsPage";
import QuoteAccessPage from "./admin/quote-access/pages/QuoteAccessPage";
import SalesforceSyncPage from "./admin/salesforce-sync/pages/SalesforceSyncPage";
import EmailNotificationsPage from "./admin/email-notifications/pages/EmailNotificationsPage";
import PricingFormulasPage from "./admin/pricing-formulas/pages/PricingFormulasPage";
import PricingFormulaHistoryPage from "./admin/pricing-formulas/pages/PricingFormulaHistoryPage";

// The heavy screens load on first use.
const QuoteWizardPage = lazy(() => import("./quotes/pages/QuoteWizardPage"));
const QuoteDetailPage = lazy(() => import("./quotes/pages/QuoteDetailPage"));
const InsightsPage = lazy(() => import("./insights/pages/InsightsPage"));

const loading = <Skeleton variant="rounded" height={240} />;
const deferred = (page: ReactNode) => <Suspense fallback={loading}>{page}</Suspense>;

export const cado2Routes = (
  <Route path="sales/cado2" element={<Cado2Shell />}>
    <Route index element={<Cado2Landing />} />
    <Route
      path="quotes"
      element={
        <Cado2Requires need="quote">
          <MyQuotesPage />
        </Cado2Requires>
      }
    />
    <Route
      path="quotes/new"
      element={<Cado2Requires need="quote">{deferred(<QuoteWizardPage />)}</Cado2Requires>}
    />
    <Route
      path="quotes/:quoteId/versions/:version/edit"
      element={<Cado2Requires need="quote">{deferred(<QuoteWizardPage />)}</Cado2Requires>}
    />
    {/* A quote is open to its owner, CadO2 admins and its approvers; the
        backend decides per quote, so no role guard here. Each tab is a route,
        and the page sends an unknown tab to the Quote tab. */}
    <Route path="quotes/:quoteId" element={<Navigate to="quote" replace />} />
    <Route path="quotes/:quoteId/:tab" element={deferred(<QuoteDetailPage />)} />
    <Route
      path="approvals"
      element={
        <Cado2Requires need="approve">
          <MyApprovalsPage />
        </Cado2Requires>
      }
    />
    <Route path="insights" element={<Navigate to={cado2Paths.insights()} replace />} />
    <Route
      path="insights/:tab"
      element={<Cado2Requires need="insights">{deferred(<InsightsPage />)}</Cado2Requires>}
    />
    <Route
      path="admin"
      element={
        <Cado2Requires need="admin">
          <Cado2AdminLayout />
        </Cado2Requires>
      }
    >
      <Route index element={<Navigate to={cado2Paths.adminSection(FIRST_ADMIN_SECTION)} replace />} />
      <Route path="approval-matrix" element={<ApprovalMatrixPage />} />
      <Route path="approval-slas" element={<ApprovalSlasPage />} />
      <Route path="legal-entities" element={<LegalEntitiesPage />} />
      <Route path="currencies" element={<CurrenciesPage />} />
      <Route path="product-categories" element={<ProductCategoriesPage />} />
      <Route path="product-bundles" element={<ProductBundlesPage />} />
      <Route path="legal-texts" element={<LegalTextsPage />} />
      <Route path="quote-access" element={<QuoteAccessPage />} />
      <Route path="salesforce-sync" element={<SalesforceSyncPage />} />
      <Route path="email-notifications" element={<EmailNotificationsPage />} />
      <Route path="pricing-formulas" element={<PricingFormulasPage />} />
      <Route path="pricing-formulas/:productId" element={<PricingFormulaHistoryPage />} />
      <Route path="*" element={<Navigate to={cado2Paths.adminSection(FIRST_ADMIN_SECTION)} replace />} />
    </Route>
    <Route path="*" element={<Navigate to={cado2Paths.home} replace />} />
  </Route>
);
