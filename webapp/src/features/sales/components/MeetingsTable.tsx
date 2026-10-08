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

import { Link as RouterLink } from "react-router";
import {
  Box,
  Chip,
  IconButton,
  Link,
  ListingTable,
  Skeleton,
  TablePagination,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import {
  PaperclipIcon,
  Trash2Icon,
} from "@wso2/oxygen-ui-icons-react";
import type { Meeting, MeetingScope } from "../api/salesTypes";
import { meetingCustomer, meetingTypeLabel } from "../api/salesTypes";
import { formatDateTime, formatDuration, parseUtc } from "../util/salesTime";
import MeetingCoverageCell from "../meddpicc/components/MeetingCoverageCell";
import type { LetterKey, MeetingCoverage } from "../meddpicc/types";

const PAGE_SIZE_OPTIONS = [5, 10, 20];

/**
 * Columns, declared once so the header and the skeleton rows can't drift.
 *
 * No End column: calls run minutes to a couple of hours, so when one started is what
 * people scan for, and its length rides along in the Start cell with the exact end
 * time on hover.
 */
const COLUMNS = [
  // Account leads: it is what people remember a call by. The title sits beside it as
  // the way into the meeting.
  { key: "customer", label: "Account", width: 240 },
  { key: "title", label: "Title", width: "auto" },
  { key: "meddpicc", label: "MEDDPICC", width: 230 },
  { key: "host", label: "Account Owner", width: 190 },
  { key: "start", label: "Start", width: 170 },
  { key: "attachments", label: "Files", width: 60, center: true },
] as const;

/** Start time in ms for ordering; a row with no readable start sorts last. */
function startMs(meeting: Meeting): number {
  return parseUtc(meeting.startTime)?.getTime() ?? Number.NEGATIVE_INFINITY;
}

/**
 * Who the call was with: the account on top, and the call type beneath it.
 *
 * No attendee emails: nobody recalls a call by the customer's address, and the account
 * already says who it was with. A meeting with no account (an internal one, say) leads
 * with its call type.
 */
function AccountCell({ meeting }: { meeting: Meeting }) {
  const account = meetingCustomer(meeting);
  const typeLabel = meetingTypeLabel(meeting.meetingType);
  const headline = account ?? typeLabel;
  const details = account ? typeLabel : null;
  const hover = [account, typeLabel].filter(Boolean).join(" · ");
  const clip = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const;

  if (!headline && !details) return null;
  return (
    <Box sx={{ minWidth: 0 }} title={hover || undefined}>
      {headline && (
        <Typography
          variant="body2"
          sx={{ ...clip, color: account ? "text.primary" : "text.secondary", fontWeight: account ? 500 : 400 }}
        >
          {headline}
        </Typography>
      )}
      {details && (
        <Typography variant="caption" color="text.secondary" component="div" sx={clip}>
          {details}
        </Typography>
      )}
    </Box>
  );
}

/**
 * The meeting list.
 *
 * Built on Oxygen's ListingTable rather than hand-rolled Table primitives: it
 * already carries the toolbar, footer pagination and empty state, and its
 * Provider takes `totalCount` separately from the rows, which is exactly the
 * shape server-side paging needs.
 *
 * The MEDDPICC column appears when the page passes `coverage`: one batched
 * lookup for the visible page, made by the page rather than per row. A row
 * whose call belongs to a deal opens that deal's panel; the links and buttons
 * inside it keep their own clicks.
 *
 * The Cancel column appears only in the All scope, matching the standalone app.
 * The reasoning holds up: in the Past scope nothing is cancellable — every row
 * has already happened — so the column would be a full width of disabled
 * buttons.
 */
export default function MeetingsTable({
  meetings,
  totalCount,
  loading,
  scope,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onOpenAttachments,
  onCancelMeeting,
  canCancel,
  coverage,
  coverageLoading = false,
  onOpenDeal,
  canReanalyse,
  onReanalyse,
  reanalysingId = null,
}: {
  meetings: Meeting[];
  totalCount: number;
  loading: boolean;
  scope: MeetingScope;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onOpenAttachments: (meeting: Meeting) => void;
  onCancelMeeting: (meeting: Meeting) => void;
  canCancel: (meeting: Meeting) => boolean;
  /** MEDDPICC coverage by meetingId. Omit to leave the column out. */
  coverage?: Map<number, MeetingCoverage>;
  coverageLoading?: boolean;
  onOpenDeal?: (opportunityId: string, letter?: LetterKey) => void;
  canReanalyse?: (meeting: Meeting) => boolean;
  onReanalyse?: (meeting: Meeting) => void;
  /** The meeting whose re-analysis request is in flight. */
  reanalysingId?: number | null;
}) {
  const showCancel = scope === "all";
  const showMeddpicc = coverage !== undefined;
  const baseColumns = showMeddpicc ? COLUMNS : COLUMNS.filter((column) => column.key !== "meddpicc");
  // Latest first, whatever order a page arrives in. The backend already returns meetings
  // newest first, so this keeps a page's rows in that order rather than reshuffling paging.
  const rows = [...meetings].sort((a, b) => startMs(b) - startMs(a));
  const columns = showCancel
    ? [...baseColumns, { key: "cancel", label: "Cancel", width: 60, center: true } as const]
    : baseColumns;

  return (
    <ListingTable.Provider
      page={page}
      rowsPerPage={pageSize}
      totalCount={totalCount}
      onPageChange={onPageChange}
      onRowsPerPageChange={onPageSizeChange}
      loading={loading}
    >
      <ListingTable.Container>
        {/* Compact rows, as the audit log's table has: the Account cell's two short lines
            are the tallest thing in a row, so the default padding only spreads a page of
            meetings over more scrolling. */}
        <ListingTable bordered size="small" density="compact">
          <ListingTable.Head>
            <ListingTable.Row>
              {columns.map((column) => (
                <ListingTable.Cell
                  key={column.key}
                  align={"center" in column && column.center ? "center" : "left"}
                  sx={{ width: column.width, whiteSpace: "nowrap" }}
                >
                  {column.label}
                </ListingTable.Cell>
              ))}
            </ListingTable.Row>
          </ListingTable.Head>

          <ListingTable.Body>
            {loading && meetings.length === 0
              ? // Skeleton rows rather than a spinner: the table keeps its shape,
                // so the page doesn't jump when the rows land.
                Array.from({ length: Math.min(pageSize, 5) }).map((_, rowIndex) => (
                  <ListingTable.Row key={`skeleton-${rowIndex}`}>
                    {columns.map((column) => (
                      <ListingTable.Cell key={column.key}>
                        <Skeleton variant="text" />
                      </ListingTable.Cell>
                    ))}
                  </ListingTable.Row>
                ))
              : rows.map((meeting) => {
                  const cancellable = canCancel(meeting);
                  const isCancelled = meeting.meetingStatus === "CANCELLED";
                  const duration = formatDuration(meeting.startTime, meeting.endTime);
                  const meetingCoverage = coverage?.get(meeting.meetingId);
                  // The backend's link first: an included call belongs to a deal the
                  // meeting row itself was never linked to.
                  const dealId = meetingCoverage?.opportunityId ?? meeting.opportunityId ?? null;
                  const openDeal = dealId && onOpenDeal ? () => onOpenDeal(dealId) : undefined;

                  return (
                    <ListingTable.Row
                      key={meeting.meetingId}
                      clickable={Boolean(openDeal)}
                      hover={Boolean(openDeal)}
                      onClick={openDeal}
                      sx={openDeal ? { cursor: "pointer" } : undefined}
                    >
                      <ListingTable.Cell sx={{ maxWidth: 240 }}>
                        {/* Blank rather than a dash when there is no link at all: a
                            meeting scheduled through the old form was never linked to
                            Salesforce, so there is nothing missing to point at. The call
                            type is plain text, not a chip: a chip reads as a status, but
                            every linked meeting has a call type. */}
                        <AccountCell meeting={meeting} />
                      </ListingTable.Cell>

                      <ListingTable.Cell>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          {/* A link, not a row click: the title is the thing that names
                              this meeting, so it is what should look and behave like the
                              way in. A whole-row target would also swallow the file and
                              cancel buttons sitting in it. */}
                          <Link
                            component={RouterLink}
                            to={`/sales/meetings/${meeting.meetingId}`}
                            underline="hover"
                            variant="body2"
                            sx={{
                              // The title carries the customer and meeting type
                              // and is routinely longer than the column; clipping
                              // it keeps every row one line tall, and the tooltip
                              // gives back what the clip took.
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              textDecoration: isCancelled ? "line-through" : "none",
                              color: isCancelled ? "text.disabled" : "text.primary",
                            }}
                            title={meeting.title}
                            onClick={(event) => event.stopPropagation()}
                          >
                            {meeting.title}
                          </Link>
                          {meeting.timeStatus === "UPCOMING" && (
                            <Chip
                              label="Upcoming"
                              size="small"
                              color="primary"
                              variant="outlined"
                              sx={{ height: 20, fontSize: "0.65rem" }}
                            />
                          )}
                        </Box>
                      </ListingTable.Cell>

                      {showMeddpicc && (
                        <ListingTable.Cell>
                          <MeetingCoverageCell
                            meetingTitle={meeting.title}
                            coverage={meetingCoverage}
                            loading={coverageLoading}
                            canReanalyse={Boolean(onReanalyse && canReanalyse?.(meeting))}
                            reanalysing={reanalysingId === meeting.meetingId}
                            onReanalyse={() => onReanalyse?.(meeting)}
                            onLetterClick={
                              dealId && onOpenDeal ? (letter) => onOpenDeal(dealId, letter) : undefined
                            }
                          />
                        </ListingTable.Cell>
                      )}

                      <ListingTable.Cell sx={{ whiteSpace: "nowrap" }}>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ overflow: "hidden", textOverflow: "ellipsis" }}
                          title={meeting.host}
                        >
                          {meeting.host}
                        </Typography>
                      </ListingTable.Cell>

                      <ListingTable.Cell sx={{ whiteSpace: "nowrap" }}>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          title={meeting.endTime ? `Ends ${formatDateTime(meeting.endTime)}` : undefined}
                        >
                          {formatDateTime(meeting.startTime)}
                          {duration && (
                            <Box component="span" sx={{ color: "text.disabled" }}>
                              {` · ${duration}`}
                            </Box>
                          )}
                        </Typography>
                      </ListingTable.Cell>

                      <ListingTable.Cell align="center">
                        <Tooltip title="View files" arrow>
                          <IconButton
                            size="small"
                            onClick={(event) => {
                              event.stopPropagation();
                              onOpenAttachments(meeting);
                            }}
                            aria-label={`View files for ${meeting.title}`}
                          >
                            <PaperclipIcon size={16} />
                          </IconButton>
                        </Tooltip>
                      </ListingTable.Cell>

                      {showCancel && (
                        <ListingTable.Cell align="center">
                          <Tooltip
                            title={
                              cancellable
                                ? "Cancel meeting"
                                : "Only the host or a Sales admin can cancel an upcoming meeting"
                            }
                            arrow
                          >
                            {/* The span is required: a disabled button fires no
                                pointer events, so without it the tooltip that
                                explains WHY it is disabled never appears. */}
                            <Box
                              component="span"
                              sx={{ display: "inline-flex" }}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <IconButton
                                size="small"
                                color="error"
                                disabled={!cancellable}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onCancelMeeting(meeting);
                                }}
                                aria-label={`Cancel ${meeting.title}`}
                              >
                                <Trash2Icon size={16} />
                              </IconButton>
                            </Box>
                          </Tooltip>
                        </ListingTable.Cell>
                      )}
                    </ListingTable.Row>
                  );
                })}
          </ListingTable.Body>
        </ListingTable>

        {!loading && meetings.length === 0 && (
          <ListingTable.EmptyState
            title="No meetings found"
            description="Try a different scope, region, or search term."
          />
        )}

        {/* Pagination is rendered here rather than through ListingTable.Footer.
            `component="div"` because this sits outside <table>, where the
            default `td` element would be invalid markup. */}
        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          rowsPerPage={pageSize}
          rowsPerPageOptions={PAGE_SIZE_OPTIONS}
          onPageChange={(_, next) => onPageChange(next)}
          onRowsPerPageChange={(event) => onPageSizeChange(Number(event.target.value))}
          labelRowsPerPage="Per page"
        />
      </ListingTable.Container>
    </ListingTable.Provider>
  );
}
