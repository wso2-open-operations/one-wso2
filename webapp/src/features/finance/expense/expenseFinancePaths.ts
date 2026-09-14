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

export const EXPENSE_FINANCE_PATH = "/finance/expense-claims";

export const expenseFinancePaths = {
  new: `${EXPENSE_FINANCE_PATH}/new`,
  history: `${EXPENSE_FINANCE_PATH}/history`,
  // The two approval entries, beside filing, on the source app's own two URLs
  // (`routes.tsx:15-21`). One screen serves both: it takes the stage as a
  // parameter, exactly as the source mounts one component twice.
  //
  // Two entries rather than one screen with a switch, because the backend flags
  // are independent — somebody holding both sees both, as they do in the app
  // this is ported from, and somebody holding one sees only that one.
  leadApprovals: `${EXPENSE_FINANCE_PATH}/lead-approvals`,
  financeApprovals: `${EXPENSE_FINANCE_PATH}/finance-approvals`,
} as const;
