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

import { useNotifications } from "@context/notifications/NotificationsContext";
import type { Campaign } from "./amplifyTypes";
import { useAmplifyConfig } from "./useAmplifyData";
import { useRecordNativeIntent } from "./useAmplifyMutations";
import { describeAmplifyError } from "../util/amplifyError";
import { linkedInPostUrl } from "../util/linkedinPost";

export type RepostTarget = Pick<Campaign, "id" | "resourceUrn" | "resourceUrl">;

/**
 * Opens the post on LinkedIn in a new tab and records the click (POST /campaigns/{id}/native-intent), so Amplify
 * looks for the repost for the next 24 hours. The tab opens first, inside the click, so a popup blocker lets it
 * through.
 */
export function useOpenOnLinkedIn(): { open: (campaign: RepostTarget) => void; busy: boolean } {
  const record = useRecordNativeIntent();
  const { showError } = useNotifications();
  const { campaignLinkOrigins } = useAmplifyConfig();
  const open = (campaign: RepostTarget) => {
    window.open(linkedInPostUrl(campaign.resourceUrn, campaign.resourceUrl, campaignLinkOrigins), "_blank", "noopener,noreferrer");
    record.mutate({ campaignId: campaign.id }, { onError: (err) => showError(describeAmplifyError(err)) });
  };
  return { open, busy: record.isPending };
}
