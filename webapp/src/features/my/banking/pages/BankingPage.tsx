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

import { Navigate, Outlet } from "react-router";
import { Box } from "@wso2/oxygen-ui";
import PerspectiveHeader from "@components/perspective-header/PerspectiveHeader";
import RoutedTabs from "@components/routed-tabs/RoutedTabs";
import { BANKING_PATH, BANKING_TABS } from "../bankingTabs";

// The frame every Banking tab shares: the header and the tab bar, with an
// <Outlet /> for whichever tab the URL names — same shape as Claim
// Approval's own page/tabs split (see MyAccountsTab and SummaryTab). This
// is what keeps a later, admin-facing tab additive — a new entry in
// bankingTabs.ts plus a new route in App.tsx — rather than a reshape of
// this component.
export default function BankingPage() {
  return (
    <Box>
      <PerspectiveHeader
        title="Banking"
        subtitle="Your salary, consultancy, and reimbursement bank accounts."
      />
      <RoutedTabs basePath={BANKING_PATH} tabs={BANKING_TABS} ariaLabel="Banking sections" />
      <Outlet />
    </Box>
  );
}

/** `/me/banking` itself has nothing to show — send the caller to the first tab. */
export function BankingIndex() {
  return <Navigate to={`${BANKING_PATH}/${BANKING_TABS[0].segment}`} replace />;
}
