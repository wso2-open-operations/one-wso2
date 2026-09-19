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

export const SECURITY_ADVISORY_REGEX = /^WSO2-\d{4}-\d{4}$/;

// Client-side format check, run before ever hitting the backend existence
// check — a debounced backend call only happens once the format already
// passes.
export function umtSecurityAdvisoryFormatValid(advisoryId: string): boolean {
  return SECURITY_ADVISORY_REGEX.test(advisoryId.trim());
}
