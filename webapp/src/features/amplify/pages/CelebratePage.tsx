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

import { useMemo, useState } from "react";
import { Button, Skeleton } from "@wso2/oxygen-ui";
import { Volume2Icon } from "@wso2/oxygen-ui-icons-react";
import { useNavigate, useSearchParams } from "react-router";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { AMPLIFY_CELEBRATE_PATH } from "@constants/perspectives";
import type { Campaign } from "../api/amplifyTypes";
import {
  useAmplifyCampaigns,
  useAmplifyCategories,
  useAmplifyLeaderboard,
  useAmplifyMe,
  useAmplifyTopBoard,
  useMyShares,
} from "../api/useAmplifyData";
import { useAmplifyPeople } from "../api/useAmplifyPeople";
import AmplifyShell from "../components/AmplifyShell";
import { TeamLeaderboardPanel, TopAmplifiersPanel } from "../components/LeaderboardPanels";
import LinkLinkedInDialog from "../components/LinkLinkedInDialog";
import PostCard, { CategoryChip, PriorityChip } from "../components/PostCard";
import PostCarousel from "../components/PostCarousel";
import ShareDialog from "../components/ShareDialog";

// Celebrate: every employee's Amplify page. In order (phase 1 UX review):
//  1. Posts to amplify, priority first then newest. Gone once you've shared
//     them all ("all caught up").
//  2. Top three leaders, company wide, this month by default (leaderboard.top_scope).
//  3. My position, for the same scope.
//  4. Team leaderboard.
// No My Coins section in phase 1.
export default function CelebratePage() {
  const me = useAmplifyMe();
  const campaigns = useAmplifyCampaigns("open");
  const shares = useMyShares();
  const board = useAmplifyLeaderboard();
  const topBoard = useAmplifyTopBoard();
  const categories = useAmplifyCategories();
  const people = useAmplifyPeople();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [linking, setLinking] = useState<Campaign | null>(null);
  const [sharing, setSharing] = useState<Campaign | null>(null);

  const categoryLabel = useMemo(() => {
    const labels = new Map((categories.data ?? []).map((c) => [c.code, c.label]));
    return (code: string) => labels.get(code) ?? code;
  }, [categories.data]);

  // Posts still to amplify: open ones the caller hasn't shared yet. A FAILED
  // share stays in the list, since asking again retries it.
  const toAmplify = useMemo(() => {
    const done = new Set(
      (shares.data?.items ?? []).filter((s) => s.status !== "FAILED").map((s) => s.campaignId),
    );
    return (campaigns.data?.items ?? []).filter((c) => !done.has(c.id));
  }, [campaigns.data, shares.data]);

  const linkStatus = me.data?.linkedin.status;
  const linked = linkStatus === "ACTIVE" || linkStatus === "EXPIRING";

  const amplify = (campaign: Campaign) => {
    if (linked) setSharing(campaign);
    else setLinking(campaign);
  };

  // Back from LinkedIn consent: /amplify/celebrate?share=<id> opens that
  // post's share dialog, so the click that started it carries on. Derived from
  // the URL rather than copied into state; closing the dialog clears both.
  const pendingShareId = searchParams.get("share");
  const pendingShare =
    pendingShareId && linked ? (toAmplify.find((c) => c.id === pendingShareId) ?? null) : null;
  const shareTarget = sharing ?? pendingShare;
  const closeShare = () => {
    setSharing(null);
    if (pendingShareId) setSearchParams({}, { replace: true });
  };

  // "I don't consent": close every popup and land on a plain Celebrate page (no ?share=).
  const backToCelebrate = () => {
    setLinking(null);
    setSharing(null);
    navigate(AMPLIFY_CELEBRATE_PATH, { replace: true });
  };

  const postsLoading = campaigns.isPending || shares.isPending || me.isPending;
  const postsError = campaigns.error ?? shares.error ?? me.error;

  return (
    <AmplifyShell title="Celebrate" subtitle="Share WSO2's posts on LinkedIn, earn points, and see where you rank.">
      {postsLoading ? (
        <Skeleton variant="rounded" height={320} sx={{ mb: 3 }} />
      ) : postsError ? (
        <ErrorNotice
          error={postsError}
          onRetry={() => {
            void campaigns.refetch();
            void shares.refetch();
            void me.refetch();
          }}
          sx={{ mb: 3 }}
        >
          Couldn&apos;t load the posts to amplify.
        </ErrorNotice>
      ) : (
        toAmplify.length > 0 && (
          <PostCarousel
            title="Posts to amplify"
            items={toAmplify}
            renderItem={(campaign) => (
              <PostCard
                campaign={campaign}
                chips={
                  <>
                    {campaign.isPriority && <PriorityChip />}
                    <CategoryChip label={categoryLabel(campaign.categoryCode)} />
                  </>
                }
                action={
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<Volume2Icon size={14} />}
                    onClick={() => amplify(campaign)}
                  >
                    Amplify
                  </Button>
                }
              />
            )}
          />
        )
      )}

      {topBoard.isPending ? (
        <Skeleton variant="rounded" height={320} sx={{ mb: 3 }} />
      ) : topBoard.isError ? (
        <ErrorNotice error={topBoard.error} onRetry={() => void topBoard.refetch()} retrying={topBoard.isFetching} sx={{ mb: 3 }}>
          Couldn&apos;t load the top amplifiers.
        </ErrorNotice>
      ) : (
        <TopAmplifiersPanel board={topBoard.data} people={people} />
      )}

      {board.isPending ? (
        <Skeleton variant="rounded" height={220} />
      ) : board.isError ? (
        <ErrorNotice error={board.error} onRetry={() => void board.refetch()} retrying={board.isFetching}>
          Couldn&apos;t load the team leaderboard.
        </ErrorNotice>
      ) : (
        <TeamLeaderboardPanel board={board.data} people={people} />
      )}

      <LinkLinkedInDialog
        open={linking !== null}
        onClose={() => setLinking(null)}
        onDeclined={backToCelebrate}
        returnTo={linking ? `${AMPLIFY_CELEBRATE_PATH}?share=${encodeURIComponent(linking.id)}` : AMPLIFY_CELEBRATE_PATH}
        pendingCampaignId={linking?.id}
        reconnect={linkStatus === "NEEDS_RECONNECT"}
      />
      <ShareDialog campaign={shareTarget} onClose={closeShare} />
    </AmplifyShell>
  );
}
