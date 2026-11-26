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
import { Box, Link, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@wso2/oxygen-ui";
import { useSearchParams } from "react-router";
import type { DashboardCampaigns } from "../../api/amplifyTypes";
import { useDashboardCampaigns } from "../../api/useAmplifyDashboards";
import type { PersonRef } from "../../api/usePersonLookup";
import AmplifyShell from "../../components/AmplifyShell";
import { Block, BoardState, Empty, StatCard } from "../../components/DashboardParts";
import RepostGrid from "../../components/RepostGrid";
import { commentedReposts, compactNum, num, plainReposts, reachNote, updatedStamp } from "../../util/dashboardFormat";
import CampaignDetailDialog from "./CampaignDetailDialog";
import PersonDetailDialog from "./PersonDetailDialog";

/** This month's reposts, reactions, comments and reach (design 08), when the API sends them. */
export function MonthTiles({ data }: { data: DashboardCampaigns }) {
  const m = data.monthTotals;
  if (!m) return null;
  return (
    <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" } }}>
      <StatCard label="Reposts" value={num(m.reposts)} detail="This month" />
      <StatCard label="Reactions" value={num(m.reactions)} detail="On Choreo Labs posts, by employees" />
      <StatCard label="Comments" value={num(m.comments)} detail="On Choreo Labs posts, by employees" />
      <StatCard label="Reach" value={compactNum(m.reach.impressions)} detail="Impressions on employee reposts" />
    </Box>
  );
}

/**
 * Reactions, comments and reach per post, beside its reposts (design 08). Reach is the impressions on the employees'
 * reposts, approximate: it counts only people who allowed Reach. A post's name opens its popup.
 */
export function EngagementTable({ data, onSelect }: { data: DashboardCampaigns; onSelect: (campaignId: string) => void }) {
  if (!data.campaigns.some((c) => c.reactions !== undefined || c.comments !== undefined || c.reach)) return null;
  return (
    <Block title="Reactions, comments and reach per post">
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" aria-label="Reactions, comments and reach per post">
          <TableHead>
            <TableRow>
              <TableCell>Post</TableCell>
              <TableCell align="right">Reposts</TableCell>
              <TableCell align="right">Reactions</TableCell>
              <TableCell align="right">Comments</TableCell>
              <TableCell align="right">Reach</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.campaigns.map((c) => (
              <TableRow key={c.campaignId}>
                <TableCell sx={{ overflowWrap: "anywhere" }}>
                  <Link component="button" type="button" onClick={() => onSelect(c.campaignId)} color="inherit" underline="hover" sx={{ textAlign: "left" }}>
                    {c.title}
                  </Link>
                </TableCell>
                <TableCell align="right">{num(c.reposts)}</TableCell>
                <TableCell align="right">{num(c.reactions)}</TableCell>
                <TableCell align="right">{num(c.comments)}</TableCell>
                <TableCell align="right">{c.reach ? compactNum(c.reach.impressions) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
        {reachNote(data.monthTotals?.reachConsenting)}
      </Typography>
    </Block>
  );
}

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
      <MonthTiles data={data} />
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
      <EngagementTable data={data} onSelect={onSelect} />
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
