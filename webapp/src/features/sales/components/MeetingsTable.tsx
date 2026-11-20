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
import { PaperclipIcon } from "@wso2/oxygen-ui-icons-react";
import type { Meeting } from "../api/salesTypes";
import { isLeadMeeting, meetingCustomer, meetingTypeLabel } from "../api/salesTypes";
import { formatDateTime, formatDuration, parseUtc } from "../util/salesTime";

const PAGE_SIZE_OPTIONS = [5, 10, 20];

/**
 * Columns, declared once so the header and the skeleton rows can't drift.
 *
 * No End column: calls run minutes to a couple of hours, so when one started is what
 * people scan for, and its length rides along in the Start cell with the exact end
 * time on hover.
 */
const COLUMNS = [
  // Account, call type and title in one column: `auto`, the column that grows. Nothing of
  // MEDDPICC here: a call's analysis is on its own page, and a deal's under Opportunities.
  { key: "meeting", label: "Meeting", width: "auto" },
  { key: "host", label: "Account Owner", width: 190 },
  { key: "start", label: "Start", width: 170 },
  { key: "attachments", label: "Files", width: 60, center: true },
] as const;

/** Start time in ms for ordering; a row with no readable start sorts last. */
function startMs(meeting: Meeting): number {
  return parseUtc(meeting.startTime)?.getTime() ?? Number.NEGATIVE_INFINITY;
}

const CLIP = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const;

/**
 * The meeting in one cell: the account and call type on top, the title beneath it.
 *
 * The account leads because it is what people remember a call by; the title is the link
 * into the meeting. No attendee emails: nobody recalls a call by the customer's address.
 * A meeting with no account (an internal one, say) leads with its call type. Blank rather
 * than a dash when there is no Salesforce link at all: a meeting scheduled through the old
 * form was never linked, so there is nothing missing to point at. The call type is plain
 * text, not a chip: a chip reads as a status, but every linked meeting has a call type.
 */
function MeetingCell({ meeting }: { meeting: Meeting }) {
  const account = meetingCustomer(meeting);
  const isLead = isLeadMeeting(meeting);
  const typeLabel = meetingTypeLabel(meeting.meetingType);
  const isCancelled = meeting.meetingStatus === "CANCELLED";

  return (
    <Box sx={{ minWidth: 0 }}>
      {(account || typeLabel) && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
          <Typography
            variant="body2"
            sx={CLIP}
            title={[account, typeLabel].filter(Boolean).join(" · ")}
          >
            {account && (
              <Box component="span" sx={{ fontWeight: 600, color: "text.primary" }}>
                {account}
              </Box>
            )}
            {typeLabel && (
              <Box component="span" sx={{ color: "text.secondary" }}>
                {account ? ` · ${typeLabel}` : typeLabel}
              </Box>
            )}
          </Typography>
          {/* An Inbound call's name is a lead's company, not a customer's; the chip says so. */}
          {isLead && (
            <Chip label="Lead" size="small" variant="outlined" sx={{ height: 20, fontSize: "0.65rem", flexShrink: 0 }} />
          )}
        </Box>
      )}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
        {/* A link, not a row click: the title is the thing that names this meeting, so it
            is what should look and behave like the way in. A whole-row target would also
            swallow the file button sitting in it. Clipped to one line, with the tooltip
            giving back what the clip took. */}
        <Link
          component={RouterLink}
          to={`/sales/meetings/${meeting.meetingId}`}
          underline="hover"
          variant="body2"
          sx={{
            ...CLIP,
            textDecoration: isCancelled ? "line-through" : "none",
            color: isCancelled ? "text.disabled" : "text.secondary",
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
            sx={{ height: 20, fontSize: "0.65rem", flexShrink: 0 }}
          />
        )}
      </Box>
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
 * A row opens its meeting when the page passes `onOpenMeeting`; the title link
 * does too, and the other links and buttons inside the row keep their own clicks.
 *
 * There is no Cancel column: every scope lists meetings that have already
 * happened, and those cannot be called off.
 */
export default function MeetingsTable({
  meetings,
  totalCount,
  loading,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onOpenAttachments,
  onOpenMeeting,
}: {
  meetings: Meeting[];
  totalCount: number;
  loading: boolean;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onOpenAttachments: (meeting: Meeting) => void;
  /** Open the meeting from its row. Omit for rows that only link from their title. */
  onOpenMeeting?: (meeting: Meeting) => void;
}) {
  const columns = COLUMNS;
  // Latest first, whatever order a page arrives in. The backend already returns meetings
  // newest first, so this keeps a page's rows in that order rather than reshuffling paging.
  const rows = [...meetings].sort((a, b) => startMs(b) - startMs(a));

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
        {/* Compact rows, as the audit log's table has: the Meeting cell's two short lines
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
                  const duration = formatDuration(meeting.startTime, meeting.endTime);
                  // A row is a meeting, so it opens the meeting.
                  const openMeeting = onOpenMeeting ? () => onOpenMeeting(meeting) : undefined;

                  return (
                    <ListingTable.Row
                      key={meeting.meetingId}
                      clickable={Boolean(openMeeting)}
                      hover={Boolean(openMeeting)}
                      onClick={openMeeting}
                      sx={openMeeting ? { cursor: "pointer" } : undefined}
                    >
                      <ListingTable.Cell>
                        <MeetingCell meeting={meeting} />
                      </ListingTable.Cell>

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
                    </ListingTable.Row>
                  );
                })}
          </ListingTable.Body>
        </ListingTable>

        {!loading && meetings.length === 0 && (
          <ListingTable.EmptyState
            title="No meetings found"
            description="Try a different filter, region, or search term."
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
