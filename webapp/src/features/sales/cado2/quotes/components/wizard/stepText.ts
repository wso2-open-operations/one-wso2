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

/** Short descriptions shown under each step's name when browsing a read-only version. */
export const STEP_HINTS = ["Customer & opportunity", "Products, term & figures", "Billing, addresses & contacts", "Terms, notices & special terms", "Check & submit"] as const;

/** What each wizard step is for, shown in its intro. */
export const STEP_HINTS_LONG = [
  "Who the quote is for and which WSO2 entity issues it.",
  "The products, brought in from the opportunity and priced from its price book, then how long the subscription runs.",
  "Billing, payment terms, and who is billed and receives it, with their contacts.",
  "The order form's legal sections as they will print: the terms for the products, Legal's notices, and any special terms.",
  "Check everything, then submit. A submitted version is frozen.",
] as const;
