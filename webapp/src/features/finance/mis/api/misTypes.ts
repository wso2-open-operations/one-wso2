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

// Finance MIS's own privilege numbers, read from the MIS ARR backend's
// /user-info and NOWHERE ELSE.
//
// Both numbers already mean something different inside this app, which is the
// whole reason this file exists rather than reusing what is here:
//
//   987  MIS: "may see the ARR dashboards".
//        One WSO2 (appMenu.ts PRIVILEGE.EMPLOYEE): "every authenticated user".
//        leave-app (leaveTypes.ts LEAVE_PRIVILEGE.EMPLOYEE): same.
//   789  MIS: "may see the Flash Dashboard".
//        leave-app (leaveTypes.ts LEAVE_PRIVILEGE.PEOPLE_OPS_TEAM): a People
//        Ops team member.
//
// Only 987 is read here. The Flash Dashboard stays in the MIS app (ADR 0005),
// so 789 arrives in the same array and opens nothing in One WSO2 — which is why
// it has no constant below: a name for it would be one step from a check.
//
// Reading MIS access off the shared capability set would therefore hand
// company-wide revenue reporting to every employee in the company. The numbers
// are only meaningful next to the endpoint that issued them — see CONTEXT.md
// and docs/adr/0001-mis-backends-untouched.md.
export const MIS_PRIVILEGE = {
  ARR_DASHBOARD: 987,
} as const;

// The /user-info body. The Ballerina record declares the five strings as
// `string?`, but the service coalesces every one to "" before returning
// (arr-backend service.bal:63-67, employee.bal:41-47), so they are non-null on
// the wire.
//
// `privileges` is `number[]`, never strings: every consumer matches by numeric
// equality, so a "987" would silently grant nothing and drop the user on an
// empty app with no error.
export interface MisUserInfo {
  firstName: string;
  lastName: string;
  workEmail: string;
  employeeThumbnail: string;
  jobRole: string;
  privileges: number[];
}

// Narrow rather than trust. The type above is the backend's contract, not the
// client boundary's: a 200 carrying an unexpected content type resolves to a
// body that is not this shape at all. The source app guards the same way
// (HomePage.js:255-257), and getting it wrong here fails open on a revenue
// screen.
export function misHasPrivilege(
  info: Partial<MisUserInfo> | undefined,
  privilege: number,
): boolean {
  const privileges = info?.privileges;
  return Array.isArray(privileges) && privileges.includes(privilege);
}
