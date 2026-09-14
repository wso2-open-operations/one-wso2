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

/**
 * The list in a response, whatever shape it arrived in.
 *
 * The source writes `Array.isArray(resp) ? resp : (resp?.data || [])` at BOTH
 * list endpoints — `useCustomerAccounts.js:48` and
 * `useArrSummaryCustomers.js:48` — which is the kind of line someone adds after
 * being surprised once. The Ballerina services return bare arrays, so the
 * envelope branch is unreachable against the real backend; it is kept because a
 * gateway between the service and the browser is exactly the thing that would
 * make it reachable, and because the failure it prevents is silent.
 *
 * A bare object would otherwise reach a row builder and be spread into nothing,
 * so the table would show no rows AND no error — the worst of the three
 * possible outcomes.
 */
export function arrayIn<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  const wrapped = (payload as { data?: unknown } | null)?.data;
  return Array.isArray(wrapped) ? (wrapped as T[]) : [];
}
