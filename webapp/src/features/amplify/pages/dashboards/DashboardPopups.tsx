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

import { useState } from "react";
import { useDashboardCampaigns } from "../../api/useAmplifyDashboards";
import type { PersonRef } from "../../api/usePersonLookup";
import CampaignDetailDialog from "./CampaignDetailDialog";
import PersonDetailDialog from "./PersonDetailDialog";

/** What is open: a post's popup, a person's popup, or nothing. */
export type PopupView = { kind: "post"; campaignId: string } | { kind: "person"; person: PersonRef } | null;

function PostPopup({
  campaignId,
  onPerson,
  onClose,
}: {
  campaignId: string;
  onPerson: (p: PersonRef) => void;
  onClose: () => void;
}) {
  // The carousel arrows swap the post under the popup, the same as on Post Performance.
  const [id, setId] = useState(campaignId);
  const q = useDashboardCampaigns(id);
  if (!q.data?.selected) return null;
  return (
    <CampaignDetailDialog
      sel={q.data.selected}
      campaigns={q.data.campaigns}
      loading={q.isPlaceholderData}
      onNavigate={setId}
      onPerson={onPerson}
      onClose={onClose}
    />
  );
}

/**
 * The post and person popups for a page that has no Post Performance board behind it (Operations, Celebrate,
 * Team, Glance). A post opens its popup, a name in it opens that person, and a post title in the person's list
 * opens the post: one popup at a time, like Post Performance.
 */
export default function DashboardPopups({
  view,
  onView,
}: {
  view: PopupView;
  onView: (v: PopupView) => void;
}) {
  if (!view) return null;
  if (view.kind === "post") {
    return (
      <PostPopup
        key={view.campaignId}
        campaignId={view.campaignId}
        onPerson={(person) => onView({ kind: "person", person })}
        onClose={() => onView(null)}
      />
    );
  }
  return (
    <PersonDetailDialog
      person={view.person}
      onClose={() => onView(null)}
      onPost={(campaignId) => onView({ kind: "post", campaignId })}
    />
  );
}
