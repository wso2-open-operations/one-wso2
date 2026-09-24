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

/**
 * The record in a response, whatever shape it arrived in.
 *
 * The mirror of `arrayIn`, and the shape worth naming is the opposite one: an
 * ARRAY reaching a caller that expects a record gets its INDICES read as field
 * names, so a table grows rows called "0" and "1"; a string — which is what a
 * gateway error page resolves to on a 200 — gets every field read as
 * `undefined`, so the screen draws its headings and no figures and calls that an
 * answer.
 *
 * An empty record instead, which reads everywhere as a call that ANSWERED with
 * nothing — different from one still in flight, and different from one that
 * failed.
 *
 * One caller: the two Exit ARR summaries and the Region Summary's movement
 * view (`useExitArr`). (The Flash reads that also used it were removed with the
 * Flash Dashboard, which stays in the MIS app — ADR 0005.)
 */
export function recordIn<T>(payload: unknown): T {
  const isRecord = typeof payload === "object" && payload !== null && !Array.isArray(payload);
  return (isRecord ? payload : {}) as T;
}
