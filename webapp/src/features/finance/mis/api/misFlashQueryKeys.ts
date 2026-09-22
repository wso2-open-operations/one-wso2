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

// The React Query key prefixes of the Flash reads a Forecast can move.
//
// One module rather than a constant beside each hook, because a Forecast write
// marks all three stale by prefix (`useWriteFlashForecast`), and a copy of the
// literal there would go on matching nothing — silently — the day one of these
// moved. Apart from the hooks for a second reason: their suites and the page's
// replace those modules wholesale with `vi.mock` factories, which would drop
// any constant exported beside them.

/** Every P&L read — `useFlashBalanceStatement`. */
export const FLASH_BALANCE_STATEMENT_KEY = ["mis", "balance-statement"] as const;

/**
 * Every financial-account detail read — `useFlashDetail`'s account half. The
 * customer summary beside it is sales data, which no Forecast touches.
 */
export const FLASH_ACCOUNT_SUMMARY_KEY = ["mis", "account-summary"] as const;

/** Every account list behind a figure — `useFlashAccounts`. */
export const FLASH_ACCOUNTS_KEY = ["mis", "flash-accounts"] as const;
