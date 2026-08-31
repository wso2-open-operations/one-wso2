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

// The Procurement overview — the perspective's landing page.
//
// Ported from the standalone app's pages/HomePage.tsx: one section per role group
// the caller belongs to (staff / approver / procurement), each a row of count
// tiles plus a "latest activity" feed. The BACKEND decides which blocks apply, so
// this renders whatever /api/v1/home returns and nothing else — no client-side
// role logic duplicating that decision.
//
// Dropped from the source: its "Welcome back, <name>" banner. The portal already
// greets the user on the Me perspective, and greeting them again per perspective
// reads oddly inside a shell that has one identity.

import { Link } from "react-router";
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import PrReferenceLink from "@features/procurement/components/PrReferenceLink";
import ProcurementShell from "@features/procurement/components/ProcurementShell";
import { useProcurementHome } from "@features/procurement/api/usePurchaseRequests";
import { procurementRoutes } from "@features/procurement/constants/routes";
import { activityKey, activityLabel, relativeTime } from "@features/procurement/util/prDisplay";
import type {
  ApprovalsHome,
  HomeActivity,
  ProcurementHome,
  StaffHome,
} from "@features/procurement/api/purchasingTypes";

export default function ProcurementOverviewPage() {
  const { data, isPending, isError, error, refetch } = useProcurementHome();

  return (
    <ProcurementShell
      title="Procurement"
      subtitle="A snapshot of what's relevant to you across the purchasing process."
    >
      {isPending && <CircularProgress size={24} />}
      {isError && (
        <ErrorNotice error={error} onRetry={() => void refetch()}>
          Couldn&apos;t load your overview.
        </ErrorNotice>
      )}

      {data && (
        <Stack spacing={4}>
          {data.staff && <StaffSection block={data.staff} />}
          {data.approvals && <ApprovalsSection block={data.approvals} />}
          {data.procurement && <ProcurementSection block={data.procurement} />}
          {!data.staff && !data.approvals && !data.procurement && (
            <Typography variant="body2" color="text.secondary">
              Nothing to show yet. Once you submit a request — or someone asks for your approval —
              it appears here.
            </Typography>
          )}
        </Stack>
      )}
    </ProcurementShell>
  );
}

function StaffSection({ block }: { block: StaffHome }) {
  return (
    <Section title="My requests" subtitle="Requests you've submitted.">
      <TileRow>
        <StatTile
          to={procurementRoutes.myRequests}
          label="My requests"
          value={block.my_requests_count}
          accent="primary"
        />
        <StatTile
          to={procurementRoutes.myRequests}
          label="Completed"
          value={block.completed_count}
          accent="success"
        />
      </TileRow>
      <ActivityCard
        title="Latest activity on my requests"
        items={block.recent_activity}
        empty="No activity on your requests yet."
      />
    </Section>
  );
}

function ApprovalsSection({ block }: { block: ApprovalsHome }) {
  return (
    <Section title="Approvals" subtitle="Requests awaiting or decided by you.">
      <TileRow>
        <StatTile
          to={procurementRoutes.approvals}
          label="Pending approvals"
          value={block.pending_count}
          accent="warning"
        />
        <StatTile
          to={procurementRoutes.approvals}
          label="Completed approvals"
          value={block.completed_count}
          accent="success"
        />
      </TileRow>
      <ActivityCard
        title="Latest activity on pending approvals"
        items={block.recent_activity}
        empty="Nothing awaiting your approval."
      />
    </Section>
  );
}

function ProcurementSection({ block }: { block: ProcurementHome }) {
  // The queue's own screens land in Phase 2, so these tiles are counts rather
  // than links for now — a tile that navigated nowhere would be worse.
  return (
    <Section title="Procurement queue" subtitle="The team's purchasing queue.">
      <TileRow>
        <StatTile label="Pending requests" value={block.pending_count} accent="primary" />
        <StatTile label="Awaiting delivery" value={block.awaiting_delivery_count} accent="warning" />
        <StatTile label="Completed" value={block.completed_count} accent="success" />
      </TileRow>
      <ActivityCard
        title="Latest activity on the queue"
        items={block.recent_activity}
        empty="No recent procurement activity."
      />
    </Section>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <Box component="section">
      <Box sx={{ mb: 1.5 }}>
        <Typography component="h2" variant="h6" sx={{ fontWeight: 600, mt: 0 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
      </Box>
      {children}
    </Box>
  );
}

function TileRow({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: {
          xs: "repeat(2, 1fr)",
          sm: "repeat(3, 1fr)",
          lg: "repeat(4, 1fr)",
        },
      }}
    >
      {children}
    </Box>
  );
}

/** A count tile. Navigates when `to` is given, otherwise it is just a figure. */
function StatTile({
  to,
  label,
  value,
  accent,
}: {
  to?: string;
  label: string;
  value: number;
  accent: "primary" | "warning" | "success";
}) {
  const body = (
    <CardContent sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
      <Typography
        variant="h4"
        sx={{ fontWeight: 600, color: `${accent}.main`, fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500 }} color="text.secondary">
        {label}
      </Typography>
    </CardContent>
  );

  return (
    <Card variant="outlined">
      {to ? (
        <CardActionArea component={Link} to={to} sx={{ height: "100%" }}>
          {body}
        </CardActionArea>
      ) : (
        body
      )}
    </Card>
  );
}

function ActivityCard({
  title,
  items,
  empty,
}: {
  title: string;
  items: HomeActivity[];
  empty: string;
}) {
  return (
    <Card variant="outlined" sx={{ mt: 2 }}>
      <CardContent>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
          {title}
        </Typography>
        {items.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {empty}
          </Typography>
        ) : (
          <Box>
            {items.map((a, i) => (
              <Box key={activityKey(a)}>
                {i > 0 && <Divider />}
                {/* The source app made the whole row a link to the request. The
                    detail view isn't ported, so the link is now on the reference
                    alone (PrReferenceLink, which leaves the app) — and the row
                    is inert, with no hover wash promising a click it can't
                    honour. Restore the row link in Phase 2, when there is an
                    in-app destination for it. */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1.5,
                    py: 1.25,
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography component="span" variant="body2" sx={{ fontWeight: 500 }}>
                      {activityLabel(a.action, a.qualifier)}
                    </Typography>
                    <Box component="span" sx={{ ml: 1 }}>
                      <PrReferenceLink
                        pr={{ id: a.purchase_request_id, reference: a.reference }}
                        variant="caption"
                        fontWeight={500}
                      />
                    </Box>
                    {a.title && (
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.secondary"
                        sx={{ ml: 0.5 }}
                        noWrap
                      >
                        — {a.title}
                      </Typography>
                    )}
                  </Box>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ flexShrink: 0, alignItems: "center", color: "text.secondary" }}
                  >
                    <Typography
                      component="span"
                      variant="caption"
                      sx={{ display: { xs: "none", sm: "inline" } }}
                    >
                      {a.actor_email}
                    </Typography>
                    <Typography
                      component="span"
                      variant="caption"
                      title={new Date(a.created_at).toLocaleString()}
                    >
                      {relativeTime(a.created_at)}
                    </Typography>
                  </Stack>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
