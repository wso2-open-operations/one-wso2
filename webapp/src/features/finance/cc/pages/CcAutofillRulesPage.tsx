/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import ErrorNotice from "@components/error-notice/ErrorNotice";
import { isCcBackendConfigured } from "@config/apiConfig";
import { FINANCE_EYEBROW } from "@constants/financeApps";
import { Alert, Skeleton } from "@wso2/oxygen-ui";
import FinanceShell from "../../components/FinanceShell";
import { ccHasAccess } from "../ccTypes";
import { useCcUserInfo } from "../useCc";

/** Finance → Credit Card Expenses → Autofill Rules: the card holder's own rules. */
export default function CcAutofillRulesPage() {
  const userInfo = useCcUserInfo();

  return (
    <FinanceShell
      eyebrow={FINANCE_EYEBROW.cc}
      title="Autofill Rules"
      subtitle="Rules that fill in your card transactions' expense details when a bill matches."
      configured={isCcBackendConfigured()}
      configKey="ONE_WSO2_CC_EXPENSES_BACKEND_URL"
    >
      {userInfo.isLoading ? (
        <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 1.5 }} />
      ) : userInfo.isError ? (
        <ErrorNotice
          error={userInfo.error}
          onRetry={() => void userInfo.refetch()}
          retrying={userInfo.isFetching}
        >
          Couldn&apos;t check your access to this page.
        </ErrorNotice>
      ) : !ccHasAccess(userInfo.data, "cc_owner") ? (
        <Alert severity="info">Autofill rules are for card holders.</Alert>
      ) : null}
    </FinanceShell>
  );
}
