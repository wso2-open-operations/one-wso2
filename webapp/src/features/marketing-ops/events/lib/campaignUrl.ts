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

import type { CampaignCheck } from "../eventsTypes";
import { campaignIdFrom } from "../rules/validate";

/** What Salesforce said about the campaign, as far as the field knows. */
export interface CampaignLookup {
  checking: boolean;
  /** The answer, once there is one. Absent while checking, or when the request failed. */
  check?: CampaignCheck;
}

export type HintTone = "plain" | "ok" | "error";

/** What a campaign URL is worth, as the person types it: first its shape, then — once
 *  there is an ID — whether Salesforce has that campaign. Automatic review refuses a list
 *  without a real campaign, so it is said on the field rather than at Submit. */
export function campaignUrlHint(url: string, lookup?: CampaignLookup): { tone: HintTone; text: string } {
  if (!url.trim()) {
    return {
      tone: "plain",
      text: "Needed before the list can pass automatic review. Copy it from the campaign’s page in Salesforce.",
    };
  }
  const id = campaignIdFrom(url);
  if (!id) {
    return {
      tone: "error",
      text: "No campaign ID in that link. Open the campaign in Salesforce and copy the URL from its page.",
    };
  }
  if (!lookup || lookup.checking) return { tone: "plain", text: `Campaign ID ${id} — checking Salesforce…` };

  const check = lookup.check;
  if (check?.result === "found" && check.campaign) {
    const c = check.campaign;
    const status = [c.status, c.isActive ? null : "inactive"].filter(Boolean).join(", ");
    return { tone: "ok", text: `${c.name || id}${status ? ` · ${status}` : ""} — added to every row.` };
  }
  if (check?.result === "not_found") {
    return {
      tone: "error",
      text: `Salesforce has no campaign with ID ${id}. Check the link is the campaign’s own page.`,
    };
  }
  return {
    tone: "plain",
    text: `Campaign ID ${id}. Couldn’t check Salesforce just now — it’s checked again when you submit.`,
  };
}
