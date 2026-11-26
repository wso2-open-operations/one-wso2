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

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Skeleton } from "@wso2/oxygen-ui";
import { Volume2Icon } from "@wso2/oxygen-ui-icons-react";
import { useNavigate, useSearchParams } from "react-router";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { AMPLIFY_CELEBRATE_PATH } from "@constants/perspectives";
import type { Campaign, Share } from "../api/amplifyTypes";
import {
  useAmplifyCampaigns,
  useAmplifyConfig,
  useAmplifyCategories,
  useAmplifyLeaderboard,
  useAmplifyMe,
  useAmplifyTopBoard,
  sharesFailedSince,
  useMyShares,
  useRefreshAmplifyMe,
} from "../api/useAmplifyData";
import { useAmplifyPeople } from "../api/useAmplifyPeople";
import AmplifyShell from "../components/AmplifyShell";
import { TeamLeaderboardPanel, TopAmplifiersPanel } from "../components/LeaderboardPanels";
import LinkLinkedInDialog from "../components/LinkLinkedInDialog";
import PostCard, { CategoryChip, PriorityChip } from "../components/PostCard";
import PostCarousel from "../components/PostCarousel";
import ShareDialog from "../components/ShareDialog";
import { campaignForShareParam } from "../util/linkedinPost";

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
  const { showSuccess, showError, showWarning } = useNotifications();
  const refreshMe = useRefreshAmplifyMe();
  const { campaignLinkOrigins } = useAmplifyConfig();

  // The link dialog: `campaign` is the post to carry on with after linking, null when there is none to name.
  const [linking, setLinking] = useState<{ campaign: Campaign | null } | null>(null);
  // Set when a share failed with NEEDS_RECONNECT or POST /shares said the link is broken. /me is refetched too,
  // but this keeps the next Amplify click on the link dialog even before (or if) /me catches up.
  const [linkBroken, setLinkBroken] = useState(false);
  const [sharing, setSharing] = useState<Campaign | null>(null);

  const categoryLabel = useMemo(() => {
    const labels = new Map((categories.data ?? []).map((c) => [c.code, c.label]));
    return (code: string) => labels.get(code) ?? code;
  }, [categories.data]);

  // Posts still to amplify: open ones the caller hasn't shared yet. A FAILED
  // share stays in the list, since asking again retries it.
  const openCampaigns = useMemo(() => campaigns.data?.items ?? [], [campaigns.data]);
  const sharedCampaignIds = useMemo(
    () =>
      new Set(
        (shares.data?.items ?? []).filter((s) => s.status !== "FAILED").map((s) => s.campaignId),
      ),
    [shares.data],
  );
  const toAmplify = useMemo(
    () => openCampaigns.filter((c) => !sharedCampaignIds.has(c.id)),
    [openCampaigns, sharedCampaignIds],
  );

  const linkStatus = me.data?.linkedin.status;
  const linked = (linkStatus === "ACTIVE" || linkStatus === "EXPIRING") && !linkBroken;
  const reconnect = linkStatus === "NEEDS_RECONNECT" || linkBroken;

  const amplify = (campaign: Campaign) => {
    if (linked) setSharing(campaign);
    else setLinking({ campaign });
  };

  // LinkedIn stopped accepting the employee's link (they revoked Amplify's access, or the token was refused).
  // Say so, refetch /me, and open the link dialog in reconnect mode for that post.
  const askToRelink = (campaign: Campaign | null) => {
    setLinkBroken(true);
    setSharing(null);
    void refreshMe();
    showWarning("Your LinkedIn link was disconnected. Link LinkedIn again to amplify this post.");
    setLinking({ campaign });
  };

  // A queued share that the poll sees come back FAILED. Shares that were already FAILED when the page loaded
  // are old news: the post is simply back in the list.
  const seenShares = useRef<Share[] | undefined>(undefined);
  // What the poll effect reads when the poll answers. Kept in a ref so the effect reruns only on new poll data:
  // rerunning when these change would report the same failure twice.
  const pollContext = useRef({ openCampaigns, askToRelink, showError });
  useEffect(() => {
    pollContext.current = { openCampaigns, askToRelink, showError };
  });
  useEffect(() => {
    const items = shares.data?.items;
    if (!items) return;
    const before = seenShares.current;
    seenShares.current = items;
    if (!before) return;
    const failed = sharesFailedSince(before, items);
    if (failed.length === 0) return;
    const latest = pollContext.current;
    const titleOf = (s: Share) => latest.openCampaigns.find((c) => c.id === s.campaignId)?.title;
    const disconnected = failed.find((s) => s.failureReason === "NEEDS_RECONNECT");
    if (disconnected) {
      latest.askToRelink(latest.openCampaigns.find((c) => c.id === disconnected.campaignId) ?? null);
      return;
    }
    const title = titleOf(failed[0]);
    const what = title ? `your repost of "${title}"` : "your repost";
    latest.showError(
      failed[0].failureReason === "PROVIDER_REJECTED"
        ? `LinkedIn didn't accept ${what}. Try amplifying it again.`
        : `We couldn't post ${what} to LinkedIn. Try amplifying it again.`,
    );
  }, [shares.data]);

  // Back from LinkedIn consent: /amplify/celebrate?share=<id> opens that
  // post's share dialog, so the click that started it carries on. Derived from
  // the URL rather than copied into state; closing the dialog clears both.
  const pendingShareId = searchParams.get("share");
  // Novera sends the campaign id; a LinkedIn post id or post URL resolves to the same campaign.
  const pendingCampaign = campaignForShareParam(pendingShareId, openCampaigns, campaignLinkOrigins);
  const pendingShare =
    pendingCampaign && linked && !sharedCampaignIds.has(pendingCampaign.id) ? pendingCampaign : null;

  // The same link for an unlinked caller: the card's Amplify button would have
  // opened the consent popup, so arriving through the card must do the same.
  // Only once /me has answered — until then `linked` is false for everyone.
  const pendingLink =
    pendingCampaign && me.data !== undefined && !linked && !sharedCampaignIds.has(pendingCampaign.id)
      ? pendingCampaign
      : null;
  const linkOpen = linking !== null || pendingLink !== null;
  const linkTarget = linking ? linking.campaign : pendingLink;

  // Novera's card button always opens /amplify/celebrate?share=<id>. When the
  // caller already amplified that post there is no dialog to open, so answer
  // the click with a thank-you instead of a page that quietly ignores it. The
  // title comes from the open list; a post that has closed since gives the
  // plain message. The param is cleared so a refresh doesn't repeat it.
  const thankedShareId = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingShareId) {
      // Cleared again (or never set): a later click on the same post is a new
      // arrival and should be answered again. This also absorbs React's
      // development double-run of the effect below.
      thankedShareId.current = null;
      return;
    }
    if (shares.isPending || campaigns.isPending) return;
    // The share rows key on the campaign id, so a post id or URL in the link
    // is looked up as its campaign first; only a campaign id can match when
    // the post has closed and the open list no longer names it.
    const targetId = pendingCampaign?.id ?? pendingShareId;
    if (!sharedCampaignIds.has(targetId)) return;
    if (thankedShareId.current === targetId) return;
    thankedShareId.current = targetId;
    showSuccess(
      pendingCampaign
        ? `Thank you for already amplifying this campaign: ${pendingCampaign.title}`
        : "Thank you for already amplifying this campaign.",
    );
    setSearchParams({}, { replace: true });
  }, [
    pendingShareId,
    shares.isPending,
    campaigns.isPending,
    sharedCampaignIds,
    pendingCampaign,
    showSuccess,
    setSearchParams,
  ]);

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
    <AmplifyShell title="Celebrate" subtitle="Share Choreo Labs' posts on LinkedIn, earn points, and see where you rank.">
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
        open={linkOpen}
        onClose={() => {
          setLinking(null);
          // Closing a popup opened by the URL link clears it, so the page does
          // not reopen it on the next render.
          if (pendingLink) setSearchParams({}, { replace: true });
        }}
        onDeclined={backToCelebrate}
        returnTo={linkTarget ? `${AMPLIFY_CELEBRATE_PATH}?share=${encodeURIComponent(linkTarget.id)}` : AMPLIFY_CELEBRATE_PATH}
        pendingCampaignId={linkTarget?.id}
        reconnect={reconnect}
      />
      <ShareDialog
        campaign={shareTarget}
        onClose={closeShare}
        onNeedsReconnect={(campaign) => {
          closeShare();
          askToRelink(campaign);
        }}
      />
    </AmplifyShell>
  );
}
