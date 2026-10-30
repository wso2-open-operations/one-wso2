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
import { Box, Button, Chip, Skeleton, Typography } from "@wso2/oxygen-ui";
import { LinkedinIcon, PlusIcon } from "@wso2/oxygen-ui-icons-react";
import { useNavigate } from "react-router";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { AMPLIFY_NEW_POST_PATH } from "@constants/perspectives";
import type { Campaign, CampaignStatus } from "../api/amplifyTypes";
import { useAmplifyCampaigns, useAmplifyCategories } from "../api/useAmplifyData";
import AmplifyShell from "../components/AmplifyShell";
import EditPostDialog from "../components/EditPostDialog";
import PostCard, { CategoryChip, PriorityChip } from "../components/PostCard";
import PostCarousel from "../components/PostCarousel";

const STATUS_LABEL: Record<CampaignStatus, string> = {
  OPEN: "Live",
  SCHEDULED: "Next run",
  CLOSED: "Closed",
  ARCHIVED: "Archived",
};

// Current Posts: the official WSO2 LinkedIn posts in Amplify, for PO and
// Marketing to update. Archived posts are left out. Only callers granted
// CAN_CAMPAIGN reach this page (AmplifyEditorRoute); amplify-api limits
// any-status reads and every edit to the same grant.
export default function CurrentPostsPage() {
  const navigate = useNavigate();
  const campaigns = useAmplifyCampaigns("all");
  const categories = useAmplifyCategories();
  const [editing, setEditing] = useState<Campaign | null>(null);

  const categoryLabel = useMemo(() => {
    const labels = new Map((categories.data ?? []).map((c) => [c.code, c.label]));
    return (code: string) => labels.get(code) ?? code;
  }, [categories.data]);

  const current = (campaigns.data?.items ?? []).filter((c) => c.status !== "ARCHIVED");

  return (
    <AmplifyShell
      title="Current Posts"
      subtitle="The official WSO2 LinkedIn posts that are live in Amplify. Edit a published post on LinkedIn itself."
    >
      {campaigns.isPending ? (
        <Skeleton variant="rounded" height={320} sx={{ mb: 3 }} />
      ) : campaigns.isError ? (
        <ErrorNotice
          error={campaigns.error}
          onRetry={() => void campaigns.refetch()}
          retrying={campaigns.isFetching}
          sx={{ mb: 3 }}
        >
          Couldn&apos;t load the posts.
        </ErrorNotice>
      ) : current.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          No posts in Amplify yet.
        </Typography>
      ) : (
        <PostCarousel
          title="Current posts"
          items={current}
          renderItem={(campaign) => (
            <PostCard
              campaign={campaign}
              chips={
                <>
                  <CategoryChip label={categoryLabel(campaign.categoryCode)} />
                  {campaign.isPriority && <PriorityChip />}
                  <Chip size="small" label={STATUS_LABEL[campaign.status]} />
                </>
              }
              action={
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<LinkedinIcon size={14} />}
                  onClick={() => setEditing(campaign)}
                >
                  Update post
                </Button>
              }
            />
          )}
        />
      )}

      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Button variant="contained" startIcon={<PlusIcon size={16} />} onClick={() => navigate(AMPLIFY_NEW_POST_PATH)}>
          Create new post
        </Button>
      </Box>

      {editing && <EditPostDialog key={editing.id} campaign={editing} onClose={() => setEditing(null)} />}
    </AmplifyShell>
  );
}
