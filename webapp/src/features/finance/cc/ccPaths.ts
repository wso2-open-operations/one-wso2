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

// Where the credit-card screens live.
//
// Under Finance rather than Me: a corporate card is not something everyone
// has, so unlike leave or claims this is not part of the set every employee
// needs.
//
// Named rather than written out at each call site — the app moved once, and a
// hardcoded link inside the dashboard survived the move as a dead button until
// a grep found it.
export const CC_PATH = "/finance/cc";

export const ccPaths = {
  dashboard: `${CC_PATH}/dashboard`,
  newTransactions: `${CC_PATH}/new`,
  pending: `${CC_PATH}/pending`,
  approve: `${CC_PATH}/approve`,
  history: `${CC_PATH}/history`,
  admin: `${CC_PATH}/admin`,
} as const;
