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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import { UMT_LIFECYCLE_STATES, UMT_LIFECYCLES, type UmtLifecycle, type UmtLifecycleState } from "../api/umtTypes";

// Lifecycle states reach the app as plain strings from the backend, so a value
// is only treated as a known state once it has been checked here. Anything
// else comes back undefined: it matches no state, exactly as it would in a
// string comparison, while the code that does match states stays type-checked.
export function umtLifecycleState(value: string | null | undefined): UmtLifecycleState | undefined {
  return UMT_LIFECYCLE_STATES.find((state) => state === value);
}

export function umtLifecycle(value: string | null | undefined): UmtLifecycle | undefined {
  return UMT_LIFECYCLES.find((lifecycle) => lifecycle === value);
}
