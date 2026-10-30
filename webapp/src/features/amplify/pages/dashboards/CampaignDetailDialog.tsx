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


import { Box, Button, Chip, Dialog, DialogContent, Divider, IconButton, Typography } from "@wso2/oxygen-ui";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import { dialogPaperSx } from "@components/confirmation-dialog/dialogPaperSx";
import type { DashboardCampaignDetail, DashboardCampaignRow, DashboardPerson } from "../../api/amplifyTypes";
import { usePersonLookup, type PersonRef } from "../../api/usePersonLookup";
import { SectionLabel } from "../../components/DashboardParts";
import PersonLink from "../../components/PersonLink";
import PostCard, { CategoryChip, PriorityChip } from "../../components/PostCard";
import { announcementLabel, commentedReposts, num, plainReposts, rate } from "../../util/dashboardFormat";

function DayChart({ byDay }: { byDay: { day: number; reposts: number }[] }) {
  const max = Math.max(1, ...byDay.map((d) => d.reposts));
  const w = 400 / Math.max(1, byDay.length);
  const label = byDay.map((d) => `day ${d.day}: ${d.reposts}`).join(", ");
  return (
    <svg viewBox="0 0 400 110" role="img" aria-label={`Reposts per day. ${label}`} style={{ width: "100%", height: "auto" }}>
      <line x1="0" y1="100" x2="400" y2="100" stroke="currentColor" strokeOpacity="0.25" />
      {byDay.map((d, i) => {
        const h = (d.reposts / max) * 88;
        return <rect key={d.day} x={i * w + w * 0.15} y={100 - h} width={w * 0.7} height={h} rx="4" fill="#60A5FA" />;
      })}
    </svg>
  );
}

/** The four numbers. Columns wrap by width, so a label never runs into the next one. */
function Numbers({ sel }: { sel: DashboardCampaignDetail }) {
  const items: [string, string][] = [
    ["Reposts", num(plainReposts(sel))],
    ["Reposts / comments", num(commentedReposts(sel))],
    ["Share of connected", sel.shareOfConnected == null ? "-" : rate(sel.shareOfConnected)],
    ["First 24h", num(sel.first24Hours)],
  ];
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 2 }}>
      {items.map(([label, value]) => (
        <Box key={label} sx={{ minWidth: 0 }}>
          <SectionLabel>{label}</SectionLabel>
          <Typography sx={{ fontSize: 26, fontWeight: 600 }}>{value}</Typography>
        </Box>
      ))}
    </Box>
  );
}

/** One column of the people list: a header with the count, then a pill per name. A name opens that person's popup. */
function PeopleColumn({ title, people, onPerson }: { title: string; people: DashboardPerson[]; onPerson: (p: PersonRef) => void }) {
  const lookup = usePersonLookup();
  return (
    <Box component="section" aria-label={title} sx={{ minWidth: 0 }}>
      <SectionLabel>
        {title} ({people.length})
      </SectionLabel>
      {people.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Nobody yet.
        </Typography>
      ) : (
        <Box component="ul" sx={{ listStyle: "none", m: 0, mt: 1, p: 0, display: "flex", flexWrap: "wrap", gap: 0.75 }}>
          {people.map((p) => {
            const name = lookup(p).name;
            return (
              <li key={p.employeeId}>
                <Chip
                  size="small"
                  variant="outlined"
                  label={
                    <PersonLink person={p} onSelect={onPerson}>
                      {name}
                    </PersonLink>
                  }
                />
              </li>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

/**
 * The popup behind a post name on Post Performance: the post's normal card in a carousel (arrows step through the
 * listed posts), a box with the numbers and the per-day graph, then who reposted it in two columns, Reposts and
 * With comments. Clicking a name hands off to the person popup.
 */
export default function CampaignDetailDialog({
  sel,
  campaigns,
  loading = false,
  onNavigate,
  onPerson,
  onClose,
}: {
  sel: DashboardCampaignDetail;
  /** The posts in the list behind the popup, in order; the carousel steps through them. */
  campaigns: DashboardCampaignRow[];
  /** Another post is loading; the current one stays up, dimmed. */
  loading?: boolean;
  onNavigate: (campaignId: string) => void;
  onPerson: (p: PersonRef) => void;
  onClose: () => void;
}) {
  const at = campaigns.findIndex((c) => c.campaignId === sel.campaignId);
  const step = (by: number) => {
    const next = campaigns[at + by];
    if (next) onNavigate(next.campaignId);
  };
  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
      aria-label={`Post detail: ${sel.title}`}
      slotProps={{ paper: { sx: dialogPaperSx } }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2.5, pt: 2 }}>
        <Typography component="h2" sx={{ flexGrow: 1, fontSize: 17, fontWeight: 700 }}>
          Post detail
        </Typography>
        <IconButton aria-label="Close" onClick={onClose} size="small">
          <XIcon size={18} />
        </IconButton>
      </Box>
      <DialogContent sx={{ opacity: loading ? 0.6 : 1, transition: "opacity 120ms" }} aria-busy={loading}>
        <Box
          role="group"
          aria-roledescription="carousel"
          aria-label="Campaign card"
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") step(-1);
            if (e.key === "ArrowRight") step(1);
          }}
          sx={{ display: "flex", alignItems: "center", gap: 1 }}
        >
          <IconButton size="small" aria-label="Previous post" disabled={loading || at <= 0} onClick={() => step(-1)} sx={{ border: "1px solid", borderColor: "primary.main" }}>
            <ChevronLeftIcon size={16} />
          </IconButton>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <PostCard
              campaign={{
                resourceUrn: sel.resourceUrn ?? "",
                resourceUrl: sel.resourceUrl,
                title: sel.title,
                opensAt: sel.opensAt,
                imageUrl: sel.imageUrl,
                summary: sel.summary,
              }}
              chips={
                <>
                  {sel.isPriority && <PriorityChip />}
                  <CategoryChip label={sel.categoryLabel} />
                </>
              }
            />
          </Box>
          <IconButton
            size="small"
            aria-label="Next post"
            disabled={loading || at < 0 || at >= campaigns.length - 1}
            onClick={() => step(1)}
            sx={{ border: "1px solid", borderColor: "primary.main" }}
          >
            <ChevronRightIcon size={16} />
          </IconButton>
        </Box>
        {at >= 0 && (
          <Typography variant="caption" color="text.secondary" component="div" aria-live="polite" sx={{ textAlign: "center", mt: 0.5 }}>
            {at + 1} of {campaigns.length}
          </Typography>
        )}

        <Box sx={{ mt: 2, border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}>
          <Numbers sel={sel} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Novera: {announcementLabel(sel.announcement)}
          </Typography>
          <Divider sx={{ my: 2 }} />
          <SectionLabel>Reposts per day</SectionLabel>
          <DayChart byDay={sel.byDay} />
          <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "text.secondary" }}>
            {sel.byDay.map((d) => (
              <span key={d.day}>Day {d.day}</span>
            ))}
          </Box>
        </Box>

        <Box sx={{ mt: 2.5, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2.5 }}>
          <PeopleColumn title="Reposts" people={sel.people?.reposts ?? []} onPerson={onPerson} />
          <PeopleColumn title="With comments" people={sel.people?.withComments ?? []} onPerson={onPerson} />
        </Box>
        <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2.5 }}>
          <Button onClick={onClose} variant="outlined">
            Close
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
