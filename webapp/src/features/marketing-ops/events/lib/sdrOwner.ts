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

// The SDR owner: the sales development rep who follows up a submission's leads, and who
// owns them once they are in Salesforce. Required — automatic review refuses a list
// without one — and a WSO2 address.
//
// The server is the authority (invariants.sdr_owner_problems, whose domains come from
// EVENTS_SDR_EMAIL_DOMAINS). This mirrors it so the field can say so as it is typed;
// keep the two lists in step.

import { EMAIL_RE } from "../rules/validate";

export const SDR_DOMAINS = ["wso2.com", "choreolabs.com"] as const;

const DOMAINS_TEXT = SDR_DOMAINS.map((d) => `@${d}`).join(" or ");

/** The address as it will be stored. */
export function normaliseSdr(value: string): string {
  return value.trim().toLowerCase();
}

/** Why this can't be the SDR owner, worded as the server words it; null when it can. */
export function sdrOwnerProblem(value: string | null | undefined): string | null {
  const v = normaliseSdr(value ?? "");
  if (!v) return "Add the SDR owner — the sales development rep who follows up these leads.";
  const domain = v.split("@").pop() ?? "";
  if (!EMAIL_RE.test(v) || !(SDR_DOMAINS as readonly string[]).includes(domain)) {
    return `“${v}” isn’t a WSO2 address. Use the SDR’s ${DOMAINS_TEXT} email.`;
  }
  return null;
}

/** The line under the field: a prompt while it's empty, the problem once it's typed. */
export function sdrOwnerHint(value: string): { tone: "plain" | "ok" | "error"; text: string } {
  if (!value.trim()) {
    return { tone: "plain", text: `Required. The sales development rep who follows up these leads — an ${DOMAINS_TEXT} address.` };
  }
  const problem = sdrOwnerProblem(value);
  return problem
    ? { tone: "error", text: problem }
    : { tone: "ok", text: "They’ll own these leads once they’re in Salesforce." };
}
