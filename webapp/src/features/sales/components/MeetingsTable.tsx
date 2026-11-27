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
import { dealPath } from "../util/salesPaths";
import {
  NO_CONTEXT,
  opportunityCell,
  ownerCell,
  regionCell,
  type CallContextView,
} from "../callContext/util/callContext";

// From 10: the Echo backend serves pages of 10 to 100 calls.
const PAGE_SIZE_OPTIONS = [10, 20, 50];

/**
 * Columns, declared once so the header and the skeleton rows can't drift.
 *
 * No End column: calls run minutes to a couple of hours, so when one started is what
 * people scan for, and its length rides along in the Start cell with the exact end
 * time on hover.
 */
const COLUMNS = [
  // The account leads, at every width: it is what people remember a call by.
  { key: "account", label: "Account", width: 180 },
  // The title, the way into the call: `auto`, the column that grows. Nothing of MEDDPICC
  // here: a call's analysis is on its own page, and a deal's under Opportunities.
  { key: "meeting", label: "Meeting", width: "auto" },
  // The columns with a `from` give way as the screen narrows, least needed first, from that
  // breakpoint up.
  { key: "type", label: "Call type", width: 170, from: "lg" },
  { key: "opportunity", label: "Opportunity", width: 200, from: "md" },
  // In WSO2's process the opportunity owner is the AM who hosts the call; a call with no
  // opportunity shows its host, marked as such.
  { key: "owner", label: "Opportunity Owner (AM)", width: 190, from: "md" },
  { key: "region", label: "Region", width: 90, from: "lg" },
  { key: "start", label: "Start", width: 170 },
  { key: "attachments", label: "Files", width: 60, center: true },
] as const;

type Column = (typeof COLUMNS)[number];
const COLUMN = Object.fromEntries(COLUMNS.map((column) => [column.key, column])) as Record<
  Column["key"],
  Column
>;

/** Hidden below the column's breakpoint, a table cell from it up. */
function columnDisplay(column: Column) {
  return "from" in column ? { display: { xs: "none", [column.from]: "table-cell" } } : {};
}

/** Start time in ms for ordering; a row with no readable start sorts last. */
function startMs(meeting: Meeting): number {
  return parseUtc(meeting.startTime)?.getTime() ?? Number.NEGATIVE_INFINITY;
}

const CLIP = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const;

/**
 * The call's account, in bold. No attendee emails: nobody recalls a call by the customer's
 * address. Blank rather than a dash when there is none: an internal meeting has no account,
 * and a meeting scheduled through the old form was never linked, so there is nothing
 * missing to point at.
 */
function AccountCell({ meeting }: { meeting: Meeting }) {
  const account = meetingCustomer(meeting);
  if (!account) return null;
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
      <Typography variant="body2" sx={{ ...CLIP, fontWeight: 600, color: "text.primary" }} title={account}>
        {account}
      </Typography>
      {/* An Inbound call's name is a lead's company, not a customer's; the chip says so. */}
      {isLeadMeeting(meeting) && (
        <Chip label="Lead" size="small" variant="outlined" sx={{ height: 20, fontSize: "0.65rem", flexShrink: 0 }} />
      )}
    </Box>
  );
}

/**
 * The call type, as plain text, not a chip: a chip reads as a status, but every linked
 * meeting has a call type. Blank for a meeting that was never given one.
 */
function CallTypeCell({ meeting }: { meeting: Meeting }) {
  const typeLabel = meetingTypeLabel(meeting.meetingType);
  if (!typeLabel) return null;
  return (
    <Typography variant="body2" color="text.secondary" sx={CLIP} title={typeLabel}>
      {typeLabel}
    </Typography>
  );
}

/** The meeting's title, the link into the call, with an Upcoming chip where it applies. */
function MeetingCell({ meeting }: { meeting: Meeting }) {
  const isCancelled = meeting.meetingStatus === "CANCELLED";

  return (
    <Box sx={{ minWidth: 0 }}>
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
            sx={{ height: 20, fontSize: "0.65rem", flexShrink: 0 }}
          />
        )}
      </Box>
    </Box>
  );
}

/** Nothing to point at for this call: a dash, so the row still reads as considered. */
function Dash() {
  return (
    <Typography variant="body2" color="text.disabled">
      —
    </Typography>
  );
}

/**
 * The call's opportunity, by name, linking to its deal page. Without live details it is the
 * meeting's own customer name, still linking to the deal; blank for a call linked to nothing.
 */
function OpportunityCellView({ meeting, context }: { meeting: Meeting; context: CallContextView }) {
  const cell = opportunityCell(meeting, context);
  if (cell.kind === "blank") return null;
  if (cell.kind === "none") return <Dash />;
  if (cell.kind === "loading") return <Skeleton variant="text" width="80%" />;
  const live = cell.kind === "live";
  const label = live ? cell.name : cell.label;
  return (
    <Link
      component={RouterLink}
      to={dealPath(cell.id)}
      underline="hover"
      variant="body2"
      sx={{ ...CLIP, display: "block", color: live ? "text.primary" : "text.secondary" }}
      title={live && cell.stage ? `${label} · ${cell.stage}` : label}
      onClick={(event) => event.stopPropagation()}
    >
      {label}
    </Link>
  );
}

/** The opportunity owner, with their email on hover; else the host, marked where it stands in. */
function OwnerCellView({ meeting, context }: { meeting: Meeting; context: CallContextView }) {
  const cell = ownerCell(meeting, context);
  if (cell.kind === "owner") {
    return (
      <Typography variant="body2" color="text.secondary" sx={CLIP} title={cell.email ?? cell.name}>
        {cell.name}
      </Typography>
    );
  }
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
      <Typography variant="body2" color="text.secondary" sx={CLIP} title={cell.email}>
        {cell.email}
      </Typography>
      {cell.marked && (
        <Chip
          label="Host"
          size="small"
          variant="outlined"
          title="No opportunity owner to show for this call: this is the meeting host."
          sx={{ height: 20, fontSize: "0.65rem", flexShrink: 0 }}
        />
      )}
    </Box>
  );
}

/** The Sales Region: the opportunity's, else its account's. */
function RegionCellView({ meeting, context }: { meeting: Meeting; context: CallContextView }) {
  const cell = regionCell(meeting, context);
  if (cell.kind === "blank") return null;
  if (cell.kind === "none") return <Dash />;
  if (cell.kind === "loading") return <Skeleton variant="text" width="70%" />;
  return (
    <Typography variant="body2" color="text.secondary" sx={CLIP} title={cell.title}>
      {cell.value}
    </Typography>
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
 *
 * `context` is the live Salesforce details of the page's opportunities and accounts, asked
 * for by the page in one request. Without it (still loading, failed, or the Echo backend not
 * configured) the rows show the meeting's own data, so the list never waits on it.
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
  context = NO_CONTEXT,
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
  context?: CallContextView;
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
                  sx={{ width: column.width, whiteSpace: "nowrap", ...columnDisplay(column) }}
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
                      <ListingTable.Cell key={column.key} sx={columnDisplay(column)}>
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
                      <ListingTable.Cell sx={{ maxWidth: 180 }}>
                        <AccountCell meeting={meeting} />
                      </ListingTable.Cell>

                      {/* maxWidth 0: the title takes the room the fixed columns leave and
                          clips to it, rather than widening the table past the screen. */}
                      <ListingTable.Cell sx={{ maxWidth: 0, minWidth: 140 }}>
                        <MeetingCell meeting={meeting} />
                      </ListingTable.Cell>

                      <ListingTable.Cell sx={{ maxWidth: 170, ...columnDisplay(COLUMN.type) }}>
                        <CallTypeCell meeting={meeting} />
                      </ListingTable.Cell>

                      <ListingTable.Cell sx={{ maxWidth: 200, ...columnDisplay(COLUMN.opportunity) }}>
                        <OpportunityCellView meeting={meeting} context={context} />
                      </ListingTable.Cell>

                      <ListingTable.Cell sx={{ maxWidth: 190, ...columnDisplay(COLUMN.owner) }}>
                        <OwnerCellView meeting={meeting} context={context} />
                      </ListingTable.Cell>

                      <ListingTable.Cell sx={{ maxWidth: 90, ...columnDisplay(COLUMN.region) }}>
                        <RegionCellView meeting={meeting} context={context} />
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
            description="Try a different filter, host team, or search term."
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
