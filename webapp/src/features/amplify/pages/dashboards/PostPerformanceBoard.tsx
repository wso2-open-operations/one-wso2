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

import { useState } from "react";
import { Box, Typography } from "@wso2/oxygen-ui";
import { useSearchParams } from "react-router";
import type { DashboardCampaigns } from "../../api/amplifyTypes";
import { useDashboardCampaigns } from "../../api/useAmplifyDashboards";
import type { PersonRef } from "../../api/usePersonLookup";
import AmplifyShell from "../../components/AmplifyShell";
import { Block, BoardState, Empty } from "../../components/DashboardParts";
import RepostGrid from "../../components/RepostGrid";
import { commentedReposts, plainReposts, updatedStamp } from "../../util/dashboardFormat";
import CampaignDetailDialog from "./CampaignDetailDialog";
import PersonDetailDialog from "./PersonDetailDialog";

/** Post performance: reposts per post (a click opens the post's popup) and reposts by category. */
export function PostPerformanceBoard({
  data,
  onSelect,
  detailOpen = false,
  loading = false,
  person = null,
  onPerson = () => undefined,
  onClose = () => undefined,
}: {
  data: DashboardCampaigns;
  /** A post name was clicked, or the popup's arrows moved to another post. */
  onSelect: (campaignId: string) => void;
  /** Show the post popup for `data.selected`. */
  detailOpen?: boolean;
  /** Another post is loading behind the popup. */
  loading?: boolean;
  /** Show the person popup for this person (the post popup closes first). */
  person?: PersonRef | null;
  onPerson?: (p: PersonRef) => void;
  /** Closes whichever popup is up. */
  onClose?: () => void;
}) {
  const sel = data.selected;
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography variant="caption" color="text.secondary">
        {updatedStamp(data.asOf)} · last {data.windowDays} days
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-start" }}>
        <Box sx={{ flex: "1 1 520px", minWidth: 0 }}>
          <Block title="Reposts per post">
            <RepostGrid
              label="Reposts per post"
              empty={<Empty>No posts in this window.</Empty>}
              onPick={onSelect}
              rows={data.campaigns.map((p) => ({
                key: p.campaignId,
                title: p.title,
                subtitle: `${p.categoryLabel}${p.isPriority ? " · Priority" : ""}`,
                total: p.reposts,
                plain: plainReposts(p),
                commented: commentedReposts(p),
              }))}
            />
          </Block>
        </Box>

        <Box sx={{ flex: "1 1 360px", minWidth: 0 }}>
          <Block title={`Reposts by category, ${data.windowDays} days`}>
            <RepostGrid
              label="Reposts by category"
              empty={<Empty>No reposts in this window.</Empty>}
              rows={data.byCategory.map((c) => ({
                key: c.code,
                title: c.label,
                total: c.reposts,
                plain: plainReposts(c),
                commented: commentedReposts(c),
              }))}
            />
            <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1.5 }}>
              The bar is every repost, with or without a comment.
            </Typography>
          </Block>
        </Box>
      </Box>
      {detailOpen && sel && !person && (
        <CampaignDetailDialog
          sel={sel}
          campaigns={data.campaigns}
          loading={loading}
          onNavigate={onSelect}
          onPerson={onPerson}
          onClose={onClose}
        />
      )}
      {person && <PersonDetailDialog person={person} onClose={onClose} />}
    </Box>
  );
}

export default function PostPerformancePage() {
  const [params, setParams] = useSearchParams();
  const campaignId = params.get("campaignId") ?? undefined;
  // Popup state lives here, not in the board: picking another post swaps the data under the board.
  const [detailOpen, setDetailOpen] = useState(false);
  const [person, setPerson] = useState<PersonRef | null>(null);
  const q = useDashboardCampaigns(campaignId);
  return (
    <AmplifyShell title="Post Performance" subtitle="Which posts people are reposting, and how fast.">
      <BoardState queries={[q]}>
        {q.data && (
          <PostPerformanceBoard
            data={q.data}
            onSelect={(id) => {
              setParams({ campaignId: id }, { replace: true });
              setDetailOpen(true);
            }}
            detailOpen={detailOpen}
            loading={q.isPlaceholderData}
            person={person}
            onPerson={(p) => {
              setDetailOpen(false);
              setPerson(p);
            }}
            onClose={() => {
              setDetailOpen(false);
              setPerson(null);
            }}
          />
        )}
      </BoardState>
    </AmplifyShell>
  );
}
