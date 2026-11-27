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

import type { RoutedTabDef } from "@components/routed-tabs/RoutedTabs";
import type { ExternalShareStatus } from "../api/amplifyTypes";
import { REASON_MAX_LENGTH } from "./points";

/** The longest note for the reviewer amplify-api accepts on an own post. */
export const OWN_POST_NOTE_MAX_LENGTH = 500;

/**
 * Points an approved own post earns, and a featured one in total. The default `OWN_POST` and `OWN_POST_AMPLIFIED`
 * rules; reviewers can't read the rules, so the labels state them.
 */
export const OWN_POST_APPROVED_POINTS = 10;
export const OWN_POST_FEATURED_POINTS = 25;

/** The extra points featuring an approved post adds. */
export const OWN_POST_FEATURE_TOP_UP = OWN_POST_FEATURED_POINTS - OWN_POST_APPROVED_POINTS;

/** Each status in the words the employee and the PO team see. */
export const OWN_POST_STATUS_LABELS: Readonly<Record<ExternalShareStatus, string>> = {
  PENDING: "Waiting for review",
  APPROVED: "Approved",
  AMPLIFIED: "Featured",
  REJECTED: "Declined",
};

/** The reasons a reviewer picks from when declining an own post. */
export const DECLINE_REASONS = ["Not about Choreo Labs", "Not their own post", "Already rewarded", "Other"] as const;
export type DeclineReason = (typeof DECLINE_REASONS)[number];

const DECLINE_SEPARATOR = " — ";

/** The most characters the optional message may have after `reason`, so the whole stays within the API's limit. */
export function declineMessageMaxLength(reason: DeclineReason): number {
  return REASON_MAX_LENGTH - reason.length - DECLINE_SEPARATOR.length;
}

/** The `reason` sent with a decline: the chosen reason, plus " — " and the message when there is one. */
export function declineReasonText(reason: DeclineReason, message: string): string {
  const text = message.trim();
  return text ? `${reason}${DECLINE_SEPARATOR}${text}` : reason;
}

/** One tab of Review own posts: its URL segment, label and the claims it lists. */
export interface ReviewTabDef extends RoutedTabDef {
  status: ExternalShareStatus;
}

/** Review own posts' tabs, in order. Each is a route under `/amplify/review`. */
export const REVIEW_TABS: readonly ReviewTabDef[] = [
  { segment: "waiting", label: "Waiting", status: "PENDING" },
  { segment: "approved", label: "Approved", status: "APPROVED" },
  { segment: "featured", label: "Featured", status: "AMPLIFIED" },
  { segment: "declined", label: "Declined", status: "REJECTED" },
];
