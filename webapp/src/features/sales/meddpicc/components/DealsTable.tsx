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

import { Box, IconButton, Link, ListingTable, Skeleton, Tooltip, Typography } from "@wso2/oxygen-ui";
import { InfoIcon } from "@wso2/oxygen-ui-icons-react";
import type { DealSummary, LetterKey } from "../types";
import { journeyOf, rowSourcesOf, timelineOf } from "../util/evidenceSource";
import { formatAmount, formatSalesforceDate } from "../util/meddpiccFormat";
import DealJourney, { DealJourneyLegend } from "./DealJourney";
import MeddpiccCircles from "./MeddpiccCircles";
import StageChip from "./StageChip";
import DealScore from "./DealScore";
import { DealFlagMarker } from "./DealFlags";
import { useNow } from "../../util/useNow";

/**
 * Three columns, MEDDPICC first after the name: it is what the list is for. The stage,
 * amount, close date and any flags ride under the opportunity's name; Salesforce's score
 * rides beside the circles (nothing there when Salesforce has none), and the count to
 * review under them. The journey takes the width that is left, saying only the activity
 * and when it last moved under its track, since the stage and close date are already
 * beside the name.
 */
const COLUMNS = [
  { key: "deal", label: "Opportunity", width: 300 },
  { key: "meddpicc", label: "MEDDPICC · Score", width: 340 },
  { key: "activity", label: "Journey", width: "auto" },
] as const;

/**
 * The deal list: one row per Opportunity with at least one analysed call.
 *
 * Not paged. The backend scopes the list to deals with recorded calls and
 * returns it whole, and a sales team's open deals of that kind fit on a page.
 *
 * The deal name is the way in, as a meeting's title is in MeetingsTable; the
 * row is clickable too, for the wide target a board wants. The circles open the
 * deal already filtered to the Letter clicked; a call on the journey opens that
 * call's analysis.
 */
export default function DealsTable({
  deals,
  loading,
  onOpenDeal,
  onOpenCall,
  stageOrder = [],
  now: fixedNow,
}: {
  deals: DealSummary[];
  loading: boolean;
  onOpenDeal: (opportunityId: string, letter?: LetterKey) => void;
  /** Open a call from the timeline, on its analysis. */
  onOpenCall?: (meetingId: number) => void;
  /** The stages in the gates' order, so later stages shade darker. */
  stageOrder?: readonly string[];
  /** The clock the timelines are drawn against; fixed in tests. */
  now?: number;
}) {
  // One clock for every row, so all the tracks share the same "today".
  const clock = useNow();
  const now = fixedNow ?? clock;
  return (
    <ListingTable.Provider loading={loading}>
      <ListingTable.Container>
        <ListingTable bordered>
          <ListingTable.Head>
            <ListingTable.Row>
              {COLUMNS.map((column) => (
                <ListingTable.Cell key={column.key} sx={{ width: column.width, whiteSpace: "nowrap" }}>
                  {column.label}
                  {/* The key lives in a tooltip, keeping the header to one line. It opens on
                      hover and on keyboard focus, and every mark also names itself. */}
                  {column.key === "activity" && (
                    <Tooltip title={<DealJourneyLegend />} arrow placement="bottom-start">
                      <IconButton size="small" aria-label="What the journey shows" sx={{ ml: 0.5, p: 0.25 }}>
                        <InfoIcon size={14} />
                      </IconButton>
                    </Tooltip>
                  )}
                </ListingTable.Cell>
              ))}
            </ListingTable.Row>
          </ListingTable.Head>

          <ListingTable.Body>
            {loading && deals.length === 0
              ? Array.from({ length: 4 }).map((_, rowIndex) => (
                  <ListingTable.Row key={`skeleton-${rowIndex}`}>
                    {COLUMNS.map((column) => (
                      <ListingTable.Cell key={column.key}>
                        <Skeleton variant="text" />
                      </ListingTable.Cell>
                    ))}
                  </ListingTable.Row>
                ))
              : deals.map((deal) => (
                  <ListingTable.Row
                    key={deal.opportunityId}
                    clickable
                    hover
                    onClick={() => onOpenDeal(deal.opportunityId)}
                    sx={{ cursor: "pointer" }}
                  >
                    <ListingTable.Cell sx={{ maxWidth: 300 }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      >
                        {deal.accountName}
                      </Typography>
                      <Link
                        component="button"
                        type="button"
                        variant="body2"
                        underline="hover"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenDeal(deal.opportunityId);
                        }}
                        sx={{ textAlign: "left", color: "text.primary", fontWeight: 600 }}
                      >
                        {deal.name}
                      </Link>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap", rowGap: 0.25, mt: 0.5 }}>
                        <StageChip stage={deal.stage} />
                        <DealFlagMarker flags={deal.flags} />
                        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                          {formatAmount(deal.amount, deal.currencyIsoCode)}
                          {" · closes "}
                          {formatSalesforceDate(deal.closeDate)}
                        </Typography>
                      </Box>
                    </ListingTable.Cell>
                    <ListingTable.Cell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", rowGap: 0.5 }}>
                        <MeddpiccCircles
                          variant="dealState"
                          values={deal.dealState}
                          onLetterClick={(letter) => onOpenDeal(deal.opportunityId, letter)}
                          label={`MEDDPICC for ${deal.name}`}
                        />
                        {deal.dealScore != null && <DealScore score={deal.dealScore} />}
                      </Box>
                      {/* The circles already mark which Letters hold a suggestion; this
                          only says how many fields wait, quietly, under them. */}
                      {deal.pendingCount > 0 && (
                        <Typography
                          variant="caption"
                          aria-label={`${deal.pendingCount} AI proposals waiting for approval`}
                          sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5, color: "warning.dark", fontWeight: 600 }}
                        >
                          <Box component="span" aria-hidden sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "warning.main" }} />
                          {deal.pendingCount} to review
                        </Typography>
                      )}
                    </ListingTable.Cell>
                    <ListingTable.Cell>
                      <DealJourney
                        marks={timelineOf(deal)}
                        journey={journeyOf(deal)}
                        sources={rowSourcesOf(deal)}
                        closeDate={deal.closeDate}
                        stageOrder={stageOrder}
                        now={now}
                        onOpenCall={onOpenCall}
                        caption="activity"
                      />
                    </ListingTable.Cell>
                  </ListingTable.Row>
                ))}
          </ListingTable.Body>
        </ListingTable>

        {!loading && deals.length === 0 && (
          <ListingTable.EmptyState
            title="No opportunities found"
            description="Opportunities appear here once one of their calls has been analysed. Try a different filter."
          />
        )}
      </ListingTable.Container>
    </ListingTable.Provider>
  );
}
