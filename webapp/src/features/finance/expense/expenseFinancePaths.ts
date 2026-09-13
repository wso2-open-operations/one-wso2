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
  // Finance Approvals, beside filing — the source app's own sidebar entry and
  // its own URL (`routes.tsx:18-20`). Its Lead Approvals entry is not ported
  // here; the screen takes the stage as a parameter, so adding it later is a
  // path, a nav entry and a gate, with no change to the screen itself.
  financeApprovals: `${EXPENSE_FINANCE_PATH}/finance-approvals`,
} as const;
