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

import { useState } from "react";
import { Box, Button, MenuItem, Skeleton, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useAmplifyTeamPage, type TeamPageParams } from "../../api/useAmplifyData";
import type { TeamPage, TeamPageEntry } from "../../api/amplifyTypes";
import AmplifyShell from "../../components/AmplifyShell";
import PersonLink from "../../components/PersonLink";

/** Rows per page on the team page. The API caps `size` at 100; 25 keeps the table short. */
export const TEAM_PAGE_SIZE = 25;

const SORT_LABEL: Record<TeamPageParams["sort"], string> = {
  rank: "Company rank",
  points: "Points",
  name: "Name",
};

/**
 * The full team page. Lists the whole roster from the people directory, joined to the standings, with search, sort
 * and paging. Open to anyone with the dashboards grant, who sees the whole company.
 */
export default function TeamBoard() {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<TeamPageParams["sort"]>("rank");
  const [page, setPage] = useState(0);
  const team = useAmplifyTeamPage({ q: q.trim(), sort, page, size: TEAM_PAGE_SIZE });

  // A new search or sort starts again at the first page.
  const changeQuery = (next: string) => {
    setQ(next);
    setPage(0);
  };
  const changeSort = (next: TeamPageParams["sort"]) => {
    setSort(next);
    setPage(0);
  };

  return (
    <AmplifyShell
      title="Team"
      subtitle="Everyone in the company, with their points. People who haven't earned points yet are listed too."
    >
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          size="small"
          label="Search by name or email"
          value={q}
          onChange={(e) => changeQuery(e.target.value)}
          slotProps={{ htmlInput: { maxLength: 100 } }}
        />
        <TextField select size="small" label="Sort by" value={sort} onChange={(e) => changeSort(e.target.value as TeamPageParams["sort"])} sx={{ minWidth: 200 }}>
          {(Object.keys(SORT_LABEL) as TeamPageParams["sort"][]).map((key) => (
            <MenuItem key={key} value={key}>
              {SORT_LABEL[key]}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {team.isPending ? (
        <Skeleton variant="rounded" height={320} />
      ) : team.isError ? (
        <ErrorNotice error={team.error} onRetry={() => void team.refetch()} retrying={team.isFetching}>
          Couldn&apos;t load the team.
        </ErrorNotice>
      ) : (
        <TeamRosterBody data={team.data} page={page} onPage={setPage} searching={q.trim() !== ""} />
      )}
    </AmplifyShell>
  );
}

/** The summary, the partial-list note and the table for a loaded page. */
function TeamRosterBody({
  data,
  page,
  onPage,
  searching,
}: {
  data: TeamPage;
  page: number;
  onPage: (page: number) => void;
  searching: boolean;
}) {
  if (data.teamStatus === "NO_TEAM") {
    return <Typography color="text.secondary">We couldn&apos;t find your team.</Typography>;
  }
  const lastPage = Math.max(0, Math.ceil(data.total / data.size) - 1);
  return (
    <>
      <TeamStatusNote data={data} />
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {summaryLine(data)}
      </Typography>
      {data.entries.length === 0 ? (
        <Typography color="text.secondary">{searching ? "No one matches that search." : "No one to show yet."}</Typography>
      ) : (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" aria-label="Team roster">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 96 }}>Company rank</TableCell>
                <TableCell sx={{ width: 96 }}>Team rank</TableCell>
                <TableCell>Team member</TableCell>
                <TableCell>House</TableCell>
                <TableCell align="right">Points</TableCell>
                <TableCell>Last activity</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.entries.map((entry) => (
                <RosterRow key={entry.email} entry={entry} />
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
      {data.total > data.size && (
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 2 }}>
          <Button size="small" disabled={page === 0} onClick={() => onPage(page - 1)}>
            Previous
          </Button>
          <Typography variant="body2" color="text.secondary">
            Page {page + 1} of {lastPage + 1}
          </Typography>
          <Button size="small" disabled={page >= lastPage} onClick={() => onPage(page + 1)}>
            Next
          </Button>
        </Stack>
      )}
    </>
  );
}

/** Says why the list may be partial. The team view with the directory down lists only the caller. */
function TeamStatusNote({ data }: { data: TeamPage }) {
  if (data.teamStatus !== "UNAVAILABLE") return null;
  const message =
    data.scope === "COMPANY"
      ? "Partial list: the people directory isn't available right now, so only people with points are shown."
      : "Only you are shown: your team's roster isn't available right now.";
  return (
    <Typography variant="body2" color="warning.main" sx={{ mb: 2 }}>
      {message}
    </Typography>
  );
}

/** The headline counts. `headcount` is null when the directory can't supply it, so the count stands alone. */
function summaryLine(data: TeamPage): string {
  const { activeCount, headcount } = data.summary;
  const active = `${activeCount} with points`;
  return headcount == null ? active : `${active} of ${headcount} people`;
}

/** One roster row. A null `rank` or `employeeId` is shown as a dash or plain text, with no link. */
function RosterRow({ entry }: { entry: TeamPageEntry }) {
  return (
    <TableRow>
      <TableCell>{entry.rank ?? "—"}</TableCell>
      <TableCell>{entry.teamRank}</TableCell>
      <TableCell>
        <RosterName entry={entry} />
      </TableCell>
      <TableCell>{entry.houseName ?? "—"}</TableCell>
      <TableCell align="right">{entry.points} pts</TableCell>
      <TableCell>{entry.lastActivityAt ? new Date(entry.lastActivityAt).toLocaleDateString() : "—"}</TableCell>
    </TableRow>
  );
}

/** Linked to the person page only when there is a standing row to open. */
function RosterName({ entry }: { entry: TeamPageEntry }) {
  if (entry.employeeId === null) return <>{entry.displayName}</>;
  return (
    <PersonLink person={{ employeeId: entry.employeeId, displayName: entry.displayName, email: entry.email }}>
      {entry.displayName}
    </PersonLink>
  );
}
