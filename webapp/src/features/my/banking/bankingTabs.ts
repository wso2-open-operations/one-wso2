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

import type { RoutedTabDef } from "@components/routed-tabs/RoutedTabs";

// One tab today — the employee-facing panels. Kept as a real route (not
// folded into BankingPage itself) so a second, admin-facing tab can be
// added here later as a new entry plus its own route in App.tsx, without
// reshaping this page: the same additive-not-reshape treatment Claim
// Approval's tabs already get.
export const BANKING_PATH = "/me/banking";

export const BANKING_TABS: readonly RoutedTabDef[] = [
  { segment: "my-accounts", label: "My Accounts" },
] as const;
