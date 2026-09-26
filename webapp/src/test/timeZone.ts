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

// Running one test somewhere other than where the suite is pinned.
//
// This lives beside `setup.ts` because `setup.ts` is what makes it necessary:
// it pins the whole suite to `America/Los_Angeles`, deliberately, since that
// zone is hostile to this codebase's commonest date bug. The side effect is
// that code which is SUPPOSED to work in Pacific Time — Finance MIS's Period
// boundaries, spec §3 — is being tested in exactly the one zone where getting
// Pacific wrong and reading the host clock look identical. A test of that code
// has to name its own zone, or it proves nothing.
//
// One zone is not enough either. UTC and Asia/Colombo are both east of Pacific,
// so a regression that read the host calendar shifts them the same way and an
// "the two agree" assertion watches it happen. Assert absolute dates.

/**
 * Run `fn` as though the browser were in `tz` — an IANA name, e.g. `"UTC"` or
 * `"Asia/Colombo"`.
 *
 * Node re-reads `process.env.TZ` on the next `Date` operation, so this reaches
 * everything the code under test does with local time. It does NOT reach
 * `Intl.DateTimeFormat` calls that name a `timeZone` explicitly — which is the
 * point: those are the ones that should come out the same everywhere.
 *
 * The previous zone is restored even if `fn` throws, so a failing assertion
 * inside a zone cannot leak it into the next test. `fn` must be synchronous:
 * an `await` inside would resume after the zone had already been put back.
 */
export function inZone<T>(tz: string, fn: () => T): T {
  const previous = process.env.TZ;
  process.env.TZ = tz;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
}
